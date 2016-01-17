#!/usr/bin/python
#
# Coinorama/coinref: watch and store raw Gatecoin ETH market info
#
# This file is part of Coinorama <http://coinorama.net>
#
# Copyright (C) 2013-2016 Nicolas BENOIT
#
# This program is free software: you can redistribute it and/or modify
# it under the terms of the GNU Affero General Public License as published by
# the Free Software Foundation, either version 3 of the License, or
# (at your option) any later version.
#
# This program is distributed in the hope that it will be useful,
# but WITHOUT ANY WARRANTY; without even the implied warranty of
# MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
# GNU Affero General Public License for more details.
#
# You should have received a copy of the GNU Affero General Public License
# along with this program.  If not, see <http://www.gnu.org/licenses/>.
#


import time
import traceback
import json
import httplib
import coinwatcher


# Watcher class
class GatecoinETHWatcher (coinwatcher.CoinWatcher) :
    def __init__ ( self, shortname, with_coinrefd, logger ):
        coinwatcher.CoinWatcher.__init__ ( self, shortname, with_coinrefd, logger )
        self.mostRecentTransactionID = 0
        self.mostRecentPrice = 0
        self.ETH_USD_rate = 3.0
        self.ETH_USD_stamp = 0

    def buildData ( self, book, trades, lag ):
        ed = coinwatcher.ExchangeData ( )

        mostRecentID = 0
        mostRecentPrice = self.mostRecentPrice
        try:
            for t in trades['transactions']:
                tprice = float ( t['price'] )
                tvol = tprice * float ( t['quantity'] ) # amount is ETH, convert to BTC using price
                tid = float ( t['transactionId'] )
                tdate = float ( t['transactionTime'] )
                if ( ( tid > self.mostRecentTransactionID ) and ( tdate > self.epoch ) ):
                    ed.volume += tvol
                    ed.nb_trades += 1
                if ( tid > mostRecentID ):
                    mostRecentID = tid
                    mostRecentPrice = 1 / tprice # amount is ETH, convert to BTC using price
        except Exception:
            self.logger.write ( 'error: buildData trades\n' + str(traceback.format_exc()) )
            return None

        try: # bids and asks are inverted
            for b in book['asks']:
                bprice = 1 / float ( b['price'] ) # trade pair must be inverted ethbtc -> btceth
                bvol = float ( b['price'] ) * float ( b['volume'] )
                ed.bids.append ( [ bprice, bvol ] )
                ed.total_bid += bprice * bvol
            ed.bids.sort ( reverse=True )

            for a in book['bids']:
                aprice = 1 / float ( a['price'] ) # trade pair must be inverted ethbtc -> btceth
                avol = float ( a['price'] ) * float ( a['volume'] )
                ed.asks.append ( [ aprice, avol ] )
                ed.total_ask += avol
            ed.asks.sort ( )
        except Exception:
            self.logger.write ( 'error: buildData book\n' + str(traceback.format_exc()) )
            return None

        try:
            if ( mostRecentID != 0 ):
                self.mostRecentPrice = mostRecentPrice
            if ( self.mostRecentPrice == 0 ):
                self.mostRecentPrice = ed.bids[0][0]
            if ( mostRecentID != 0 ):
                self.mostRecentTransactionID = mostRecentID
            ed.rate = self.mostRecentPrice
            ed.lag = lag
            ed.ask_value = ed.asks[0][0]
            ed.bid_value = ed.bids[0][0]
            ed.USD_conv_rate = self.ETH_USD_rate
        except Exception:
            self.logger.write ( 'error: buildData ticker\n' + str(traceback.format_exc()) )
            return None

        return ed

    def fetchData ( self ):
        if ( (time.time()-self.ETH_USD_stamp) > 60.0 ): # get USD/ETH rate from Kraken every minute
            try:
                connection = httplib.HTTPSConnection ( 'api.kraken.com', timeout=5 )
                connection.request ( 'GET', '/0/public/Ticker?pair=XETHZUSD' )
                r = connection.getresponse ( )
                if ( r.status == 200 ):
                    ticker_txt = r.read ( )
                    ticker_json = json.loads ( ticker_txt )
                    rate = float ( ticker_json['result']['XETHZUSD']['c'][0] )
                    if ( rate > 0 ):
                        self.ETH_USD_rate = rate
                        self.ETH_USD_stamp = time.time ( )
                        #self.logger.write ( 'rate: %f ' % self.ETH_USD_rate )
                else:
                    self.logger.write ( 'error ETH_USD http %d' % r.status )
                connection.close ( )
            except Exception:
                self.logger.write ( 'error ETH_USD\n' + str(traceback.format_exc()) )
                pass

        trades = '/api/Public/Transactions/ETHBTC'
        if ( self.mostRecentTransactionID > 0 ):
            trades += '?TransactionsId=%s' % self.mostRecentTransactionID
        ed = coinwatcher.CoinWatcher.fetchData ( self, httplib.HTTPSConnection, 'www.gatecoin.com', '/api/Public/MarketDepth/ETHBTC', trades )
        return ed


#
#
# main program
#

if __name__ == "__main__":
    coinwatcher.main ( 'Gatecoin-ETH', 'gatecoinETH', GatecoinETHWatcher )
