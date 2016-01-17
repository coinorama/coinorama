#!/usr/bin/python
#
# Coinorama/coinref: watch and store raw Kraken ETH market info
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
class KrakenETHWatcher (coinwatcher.CoinWatcher) :
    def __init__ ( self, shortname, with_coinrefd, logger ):
        coinwatcher.CoinWatcher.__init__ ( self, shortname, with_coinrefd, logger )
        self.mostRecentTransactionID = "%.0f" % ((time.time() - 1) * 1000000000)
        self.mostRecentTransaction = 0
        self.mostRecentPrice = 0
        self.ETH_USD_rate = 3.0
        self.ETH_USD_stamp = 0

    def buildData ( self, book, trades, lag ):
        ed = coinwatcher.ExchangeData ( )

        mostRecent = 0
        mostRecentPrice = self.mostRecentPrice
        try:
            for t in trades['result']['XETHXXBT']:
                tprice = float ( t[0] )
                tvol = tprice * float ( t[1] ) # amount is ETH, convert to BTC using price
                tdate = float ( t[2] )
                if ( ( tdate > self.mostRecentTransaction ) and ( tdate > self.epoch ) ):
                    ed.volume += tvol
                    ed.nb_trades += 1
                if ( tdate > mostRecent ):
                    mostRecent = tdate
                    mostRecentPrice = 1 / tprice  # amount is ETH, convert to BTC using price
        except Exception:
            self.logger.write ( 'error buildData trades\n' + str(traceback.format_exc()) )
            return None

        try: # bids and asks are inverted
            for b in book['result']['XETHXXBT']['asks']:
                bprice = 1 / float ( b[0] ) # trade pair must be inverted ethbtc -> btceth
                bvol = float ( b[0] ) * float ( b[1] )
                ed.bids.append ( [ bprice, bvol ] )
                ed.total_bid += bprice * bvol
            ed.bids.sort ( reverse=True )

            for a in book['result']['XETHXXBT']['bids']:
                aprice = 1 / float ( a[0] ) # trade pair must be inverted ethbtc -> btceth
                avol = float ( a[0] ) * float ( a[1] )
                ed.asks.append ( [ aprice, avol ] )
                ed.total_ask += avol
            ed.asks.sort ( )
        except Exception:
            self.logger.write ( 'error buildData book\n' + str(traceback.format_exc()) )
            return None

        try:
            if ( mostRecent != 0 ):
                self.mostRecentPrice = mostRecentPrice
            if ( self.mostRecentPrice == 0 ):
                self.mostRecentPrice = ed.bids[0][0]
            if ( mostRecent != 0 ):
                self.mostRecentTransactionID = trades['result']['last']
                self.mostRecentTransaction = mostRecent
            ed.rate = self.mostRecentPrice
            ed.lag = lag
            ed.ask_value = ed.asks[0][0]
            ed.bid_value = ed.bids[0][0]
            ed.USD_conv_rate = self.ETH_USD_rate
        except Exception:
            self.logger.write ( 'error buildData ticker\n' + str(traceback.format_exc()) )
            return None

        return ed

    def fetchData ( self ):
        if ( (time.time()-self.ETH_USD_stamp) > 60.0 ): # get USD/ETH rate every minute
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

        trades = '/0/public/Trades?pair=XETHXXBT&since=%s' % self.mostRecentTransactionID
        ed = coinwatcher.CoinWatcher.fetchData ( self, httplib.HTTPSConnection, 'api.kraken.com', '/0/public/Depth?pair=XETHXXBT', trades )
        return ed


#
#
# main program
#

if __name__ == "__main__":
    coinwatcher.main ( 'Kraken-ETH', 'krakenETH', KrakenETHWatcher )
