#!/usr/bin/python
#
# Coinorama/coinref: watch and store raw OK-Coin CNY market info
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
import httplib
import coinwatcher


# Watcher class
class OKCoinCNYWatcher (coinwatcher.CoinWatcher):
    def __init__ ( self, shortname, with_coinrefd, logger ):
        coinwatcher.CoinWatcher.__init__ ( self, shortname, with_coinrefd, logger )
        self.mostRecentTransactionID = 0
        self.mostRecentPrice = 0
        self.CNY_USD_rate = 1 / 6.0606
        self.CNY_USD_stamp = 0

    def buildData ( self, book, trades, lag ):
        ed = coinwatcher.ExchangeData ( )

        mostRecentID = self.mostRecentTransactionID
        mostRecentPrice = self.mostRecentPrice
        try:
            for t in trades:
                tid = int ( t['tid'] )
                tvol = float ( t['amount'] )
                if ( ( tid > self.mostRecentTransactionID ) and ( t['date'] > self.epoch ) ):
                    ed.volume += tvol
                    ed.nb_trades += 1
                if ( tid > mostRecentID ):
                    mostRecentID = tid
                    mostRecentPrice = float ( t['price'] )
        except Exception as e:
            self.logger.write ( 'error buildData %s' % e )
            return None

        try:
            maxbprice = max ( [ float(b[0]) for b in book['bids'] ] )
            for b in book['bids']:
                bprice = float ( b[0] )
                bvol = float ( b[1] )
                if ( (maxbprice-bprice) < 700 ):
                    ed.bids.append ( [ bprice, bvol ] )
                ed.total_bid += bprice * bvol
            ed.bids.sort ( reverse=True )

            minaprice = min ( [ float(a[0]) for a in book['asks'] ] )
            for a in book['asks']:
                aprice = float ( a[0] )
                avol = float ( a[1] )
                if ( (aprice-minaprice) < 700 ):
                    ed.asks.append ( [ aprice, avol ] )
                ed.total_ask += avol
            ed.asks.sort ( )
        except Exception as e:
            self.logger.write ( 'error buildData %s' % e )
            return None

        try:
            if ( mostRecentID != 0 ):
                self.mostRecentPrice = mostRecentPrice
            if ( self.mostRecentPrice == 0 ):
                self.mostRecentPrice = ed.bids[0][0]
            if ( mostRecentID != 0 ): # comes last as line above may fail
                self.mostRecentTransactionID = mostRecentID
            ed.rate = self.mostRecentPrice
            ed.lag = lag
            ed.ask_value = ed.asks[0][0]
            ed.bid_value = ed.bids[0][0]
            ed.USD_conv_rate = self.CNY_USD_rate
        except Exception as e:
            self.logger.write ( 'error buildData %s' % e )
            return None

        return ed

    def fetchData ( self ):
        # get USD/CNY rate every hour
        if ( (time.time()-self.CNY_USD_stamp) > 3600.0 ):
            try:
                connection = httplib.HTTPConnection ( 'download.finance.yahoo.com', timeout=4 )
                connection.request ( 'GET', '/d/quotes.csv?s=USDCNY=X&f=sl1&e=.csv' )
                r = connection.getresponse ( )
                if ( r.status == 200 ):
                    rate_txt = r.read ( )
                    rate = float ( rate_txt.split(',')[1] )
                    if ( rate > 0 ):
                        self.CNY_USD_rate = 1/rate
                        self.CNY_USD_stamp = time.time ( )
                        #self.logger.write ( 'rate: %f ' % self.CNY_USD_rate )
                else:
                    self.logger.write ( 'error: CNY_USD status %d' % r.status )
                connection.close ( )
            except Exception:
                self.logger.write ( 'error: unable to get USD/CNY\n' + str(traceback.format_exc()) )
                pass

        trades = '/api/v1/trades.do?symbol=btc_cny'
        if ( self.mostRecentTransactionID > 0 ):
            trades = trades + '&since=%d' % self.mostRecentTransactionID
        ed = coinwatcher.CoinWatcher.fetchData ( self, httplib.HTTPSConnection, 'www.okcoin.cn', '/api/v1/depth.do?symbol=btc_cny', trades )
        return ed



#
#
# main program
#

if __name__ == "__main__":
    coinwatcher.main ( 'OK-CoinCNY', 'okcoinCNY', OKCoinCNYWatcher )
