#!/usr/bin/python
#
# Coinorama/coinref: watch and store raw Kraken LTC market info
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
class KrakenLTCWatcher (coinwatcher.CoinWatcher) :
    def __init__ ( self, shortname, with_coinrefd, logger ):
        coinwatcher.CoinWatcher.__init__ ( self, shortname, with_coinrefd, logger )
        self.mostRecentTransactionID = "%.0f" % ((time.time() - 1) * 1000000000)
        self.mostRecentTransaction = 0
        self.mostRecentPrice = 0
        self.LTC_USD_rate = 8.0
        self.LTC_USD_stamp = 0

    def buildData ( self, book, trades, lag ):
        ed = coinwatcher.ExchangeData ( )

        mostRecent = 0
        mostRecentPrice = self.mostRecentPrice
        try:
            for t in trades['result']['XXBTXLTC']:
                tvol = float ( t[1] )
                tdate = float ( t[2] )
                if ( ( tdate > self.mostRecentTransaction ) and ( tdate > self.epoch ) ):
                    ed.volume += tvol
                    ed.nb_trades += 1
                if ( tdate > mostRecent ):
                    mostRecent = tdate
                    mostRecentPrice = float ( t[0] )
        except Exception:
            self.logger.write ( 'error buildData trades\n' + str(traceback.format_exc()) )
            return None

        try:
            for b in book['result']['XXBTXLTC']['bids']:
                bprice = float ( b[0] )
                bvol = float ( b[1] )
                ed.bids.append ( [ bprice, bvol ] )
                ed.total_bid += bprice * bvol
            ed.bids.sort ( reverse=True )

            for a in book['result']['XXBTXLTC']['asks']:
                aprice = float ( a[0] )
                avol = float ( a[1] )
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
            ed.USD_conv_rate = self.LTC_USD_rate
        except Exception:
            self.logger.write ( 'error buildData ticker\n' + str(traceback.format_exc()) )
            return None

        return ed

    def fetchData ( self ):
        if ( (time.time()-self.LTC_USD_stamp) > 60.0 ): # get USD/LTC rate every minute
            try:
                connection = httplib.HTTPSConnection ( 'api.kraken.com', timeout=5 )
                connection.request ( 'GET', '/0/public/Ticker?pair=XLTCZUSD' )
                r = connection.getresponse ( )
                if ( r.status == 200 ):
                    ticker_txt = r.read ( )
                    ticker_json = json.loads ( ticker_txt )
                    rate = float ( ticker_json['result']['XLTCZUSD']['c'][0] )
                    if ( rate > 0 ):
                        self.LTC_USD_rate = rate
                        self.LTC_USD_stamp = time.time ( )
                        #self.logger.write ( 'rate: %f ' % self.LTC_USD_rate )
                else:
                    self.logger.write ( 'error LTC_USD http %d' % r.status )
                connection.close ( )
            except Exception:
                self.logger.write ( 'error LTC_USD\n' + str(traceback.format_exc()) )
                pass

        trades = '/0/public/Trades?pair=XXBTXLTC&since=%s' % self.mostRecentTransactionID
        ed = coinwatcher.CoinWatcher.fetchData ( self, httplib.HTTPSConnection, 'api.kraken.com', '/0/public/Depth?pair=XXBTXLTC', trades )
        return ed


#
#
# main program
#

if __name__ == "__main__":
    coinwatcher.main ( 'Kraken-LTC', 'krakenLTC', KrakenLTCWatcher )
