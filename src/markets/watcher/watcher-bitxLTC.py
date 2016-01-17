#!/usr/bin/python
#
# Coinorama/coinref: watch and store raw Bit-X LTC market info
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
import json
import traceback
import httplib
import coinwatcher


# Watcher class
class BitXLTCWatcher (coinwatcher.CoinWatcher) :
    def __init__ ( self, shortname, with_coinrefd, logger ):
        coinwatcher.CoinWatcher.__init__ ( self, shortname, with_coinrefd, logger )
        self.mostRecentTransactionID = 0
        self.mostRecentPrice = 0
        self.LTC_USD_rate = 8.0
        self.LTC_USD_stamp = 0

    def buildData ( self, book, trades, lag ):
        ed = coinwatcher.ExchangeData ( )

        mostRecentID = 0
        mostRecentPrice = self.mostRecentPrice
        try:
            for t in trades['data']:
                tprice = float ( t['price'] )
                tvol = tprice * float ( t['amount'] ) # amount is LTC, convert to BTC using price
                tid = float ( t['date_time'] ) # no tx id available
                tdate = float ( t['date_time'] )
                if ( ( tid > self.mostRecentTransactionID ) and ( tdate > self.epoch ) ):
                    ed.volume += tvol
                    ed.nb_trades += 1
                if ( tid > mostRecentID ):
                    mostRecentID = tid
                    mostRecentPrice = 1 / tprice # trade pair must be inverted ltcbtc -> btcltc
        except Exception:
            self.logger.write ( 'error: buildData trades\n' + str(traceback.format_exc()) )
            return None

        try: # bids and asks are inverted (ltcbtc -> btcltc)
            for b in book['data']['sell']:
                bprice = 1 / float ( b['rate'] ) # trade pair must be inverted ltcbtc -> btcltc
                bvol = float ( b['rate'] ) * float ( b['amount'] )
                ed.bids.append ( [ bprice, bvol ] )
                ed.total_bid += bprice * bvol
            ed.bids.sort ( reverse=True )

            for a in book['data']['buy']:
                aprice = 1 / float ( a['rate'] ) # trade pair must be inverted ltcbtc -> btcltc
                avol = float ( a['rate'] ) * float ( a['amount'] )
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
            ed.USD_conv_rate = self.LTC_USD_rate
        except Exception:
            self.logger.write ( 'error: buildData ticker\n' + str(traceback.format_exc()) )
            return None

        return ed

    def fetchData ( self ):
        if ( (time.time()-self.LTC_USD_stamp) > 60.0 ): # get USD/LTC rate every minute
            try:
                connection = httplib.HTTPSConnection ( 'bit-x.com', timeout=5 )
                connection.request ( 'GET', '/api/public/ticker?pair=LTCUSD' )
                r = connection.getresponse ( )
                if ( r.status == 200 ):
                    ticker_txt = r.read ( )
                    ticker_json = json.loads ( ticker_txt )
                    rate = float ( ticker_json['data']['last'] )
                    if ( rate > 0 ):
                        self.LTC_USD_rate = rate
                        self.LTC_USD_stamp = time.time ( )
                else:
                    self.logger.write ( 'error LTC_USD http %d' % r.status )
                connection.close ( )
            except Exception:
                self.logger.write ( 'error LTC_USD\n' + str(traceback.format_exc()) )
                pass

        trades = '/api/public/transactions?pair=LTCBTC'
        ed = coinwatcher.CoinWatcher.fetchData ( self, httplib.HTTPSConnection, 'bit-x.com', '/api/public/orderBook?pair=LTCBTC', trades )
        return ed


#
#
# main program
#

if __name__ == "__main__":
    coinwatcher.main ( 'BitX-LTC', 'bitxLTC', BitXLTCWatcher )
