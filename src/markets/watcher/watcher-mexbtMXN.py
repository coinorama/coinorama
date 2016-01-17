#!/usr/bin/python
#
# Coinorama/coinref: watch and store raw Mexbt MXN market info
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


import os
import time
import traceback
import httplib
import coinwatcher


# Watcher class
class MexbtMXNWatcher (coinwatcher.CoinWatcher) :
    def __init__ ( self, shortname, with_coinrefd, logger ):
        coinwatcher.CoinWatcher.__init__ ( self, shortname, with_coinrefd, logger )
        self.mostRecentTransactionID = 0
        self.readPrevTradeID ( self.logger.filename )
        self.logger.write ( 'startup from trade ID=%d' % self.mostRecentTransactionID )
        self.mostRecentPrice = 0
        self.MXN_USD_rate = 0.0621
        self.MXN_USD_stamp = 0

    def readPrevTradeID ( self, fname ):
        if ( fname != '' ):
            try:
                f = open ( fname, 'r' )
                f.seek ( 0, os.SEEK_END )
                fsize = f.tell ( )
                f.seek ( max(fsize-500,0), 0 )
                lines = f.readlines ( )
                f.close ( )
                lines.reverse ( )
                for l in lines:
                    if ' ID=' in l:
                        self.mostRecentTransactionID = int ( l.partition('=')[2] )
                        break
            except Exception as e:
                self.logger.write ( 'error readPrevTradeID %s\n' % e )
                pass
        return

    def buildData ( self, book, trades, lag ):
        ed = coinwatcher.ExchangeData ( )

        mostRecent = self.mostRecentTransactionID
        mostRecentPrice = self.mostRecentPrice
        try:
            for t in trades:
                tid = int ( t['tid'] )
                tvol = float ( t['amount'] )
                if ( ( tid > self.mostRecentTransactionID ) and ( t['date'] > self.epoch ) ):
                    ed.volume += tvol
                    ed.nb_trades += 1
                if ( tid > mostRecent ):
                    mostRecent = tid
                    mostRecentPrice = float ( t['price'] )
        except Exception:
            self.logger.write ( 'error buildData trades\n' + str(traceback.format_exc()) )
            return None

        try:
            for b in book['bids']:
                bprice = float ( b[0] )
                bvol = float ( b[1] )
                ed.bids.append ( [ bprice, bvol ] )
                ed.total_bid += bprice * bvol
            ed.bids.sort ( reverse=True )

            for a in book['asks']:
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
                self.mostRecentTransactionID = mostRecent
            ed.rate = self.mostRecentPrice
            ed.lag = lag
            ed.ask_value = ed.asks[0][0]
            ed.bid_value = ed.bids[0][0]
            ed.USD_conv_rate = self.MXN_USD_rate
        except Exception:
            self.logger.write ( 'error buildData ticker\n' + str(traceback.format_exc()) )
            return None

        return ed

    def fetchData ( self ):
        if ( (time.time()-self.MXN_USD_stamp) > 3600.0 ): # get USD/MXN rate every hour
            try:
                connection = httplib.HTTPConnection ( 'download.finance.yahoo.com', timeout=5 )
                connection.request ( 'GET', '/d/quotes.csv?s=MXNUSD=X&f=sl1&e=.csv' )
                r = connection.getresponse ( )
                if ( r.status == 200 ):
                    rate_txt = r.read ( )
                    rate = float ( rate_txt.split(',')[1] )
                    if ( rate > 0 ):
                        self.MXN_USD_rate = rate
                        self.MXN_USD_stamp = time.time ( )
                        #self.logger.write ( 'rate: %f ' % self.MXN_USD_rate )
                else:
                    self.logger.write ( 'error MXN_USD http %d' % r.status )
                connection.close ( )
            except Exception:
                self.logger.write ( 'error MXN_USD\n' + str(traceback.format_exc()) )
                pass

        trades = '/trades/btcmxn?since=%d' % self.mostRecentTransactionID
        ed = coinwatcher.CoinWatcher.fetchData ( self, httplib.HTTPSConnection, 'data.mexbt.com', '/order-book/btcmxn', trades )
        return ed

    def stop ( self ):
        self.logger.write ( 'shutdown last trade ID=%d' % self.mostRecentTransactionID )
        coinwatcher.CoinWatcher.stop ( self )
        return


#
#
# main program
#

if __name__ == "__main__":
    coinwatcher.main ( 'Mexbt-MXN', 'mexbtMXN', MexbtMXNWatcher )
