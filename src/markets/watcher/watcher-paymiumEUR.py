#!/usr/bin/python
#
# Coinorama/coinref: watch and store raw Paymium EUR market info
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
import os
import sys
import json
import coinwatcher


# Watcher class
class PaymiumEURWatcher (coinwatcher.CoinWatcher) :
    def __init__ ( self, shortname, with_coinrefd, logger ):
        coinwatcher.CoinWatcher.__init__ ( self, shortname, with_coinrefd, logger )
        self.mostRecentTransactionID = 5447056 # keep this value updated if possible
        self.readPrevTradeID ( self.logger.filename )
        self.logger.write ( 'startup from trade ID=%d' % self.mostRecentTransactionID )
        if ( self.findCurrentTradeID() == None ):
            sys.exit ( 1 )
        self.logger.write ( 'startup last trade ID=%d' % self.mostRecentTransactionID )
        self.mostRecentPrice = 0
        self.EUR_USD_rate = 1.3695
        self.EUR_USD_stamp = 0
        return

    def findCurrentTradeID ( self ):
        try:
            tradesData = 'non-empty'
            connection = httplib.HTTPSConnection ( 'paymium.com', timeout=4 )
            while ( len(tradesData) > 4 ):
                trades = '/api/v1/bitcoin_charts/eur/trades?since=%d' % self.mostRecentTransactionID
                self.mostRecentTransactionID += 100
                connection.request ( 'GET', trades )
                r = connection.getresponse ( )
                if ( r.status == 200 ):
                    tradesData = r.read ( )
                else:
                    break
            connection.close ( )
        except Exception as e:
            self.logger.write ( 'error findCurrentTradeID %s\n' % e )
            return None
        self.mostRecentTransactionID = self.mostRecentTransactionID - 100
        return self.mostRecentTransactionID

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
            ed.USD_conv_rate = self.EUR_USD_rate
        except Exception:
            self.logger.write ( 'error buildData ticker\n' + str(traceback.format_exc()) )
            return None

        return ed

    def fetchData ( self ):
        if ( (time.time()-self.EUR_USD_stamp) > 3600.0 ): # get USD/EUR rate every hour
            try:
                connection = httplib.HTTPConnection ( 'download.finance.yahoo.com', timeout=5 )
                connection.request ( 'GET', '/d/quotes.csv?s=EURUSD=X&f=sl1&e=.csv' )
                r = connection.getresponse ( )
                if ( r.status == 200 ):
                    rate_txt = r.read ( )
                    rate = float ( rate_txt.split(',')[1] )
                    if ( rate > 0 ):
                        self.EUR_USD_rate = rate
                        self.EUR_USD_stamp = time.time ( )
                        #self.logger.write ( 'rate: %f ' % self.EUR_USD_rate )
                else:
                    self.logger.write ( 'error: EUR_USD status %d' % r.status )
                connection.close ( )
            except Exception:
                self.logger.write ( 'error: unable to get EUR/USD\n' + str(traceback.format_exc()) )
                pass

        trades = '/api/v1/bitcoin_charts/eur/trades?since=%d' % self.mostRecentTransactionID
        ed = coinwatcher.CoinWatcher.fetchData ( self, httplib.HTTPSConnection, 'paymium.com', '/api/v1/bitcoin_charts/eur/depth', trades )
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
    coinwatcher.main ( 'Paymium-EUR', 'paymiumEUR', PaymiumEURWatcher )
