#!/usr/bin/python
#
# Coinorama/coinref: watch and store raw BTCE LTC market info
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
import json
import urllib
import coinwatcher


# Watcher class
class BTCELTCWatcher (coinwatcher.CoinWatcher) :
    def __init__ ( self, shortname, with_coinrefd, logger ):
        coinwatcher.CoinWatcher.__init__ ( self, shortname, with_coinrefd, logger )
        self.mostRecentTransactionID = 0
        self.mostRecentPrice = 0
        self.LTC_USD_rate = 8.0
        self.nonce = 0

    def buildData ( self, book, trades, lag ):
        ed = coinwatcher.ExchangeData ( )

        mostRecentID = self.mostRecentTransactionID
        mostRecentPrice = self.mostRecentPrice
        try:
            for t in trades:
                tid = int ( t['tid'] )
                tprice = float ( t['price'] )
                tvol = tprice * float ( t['amount'] ) # amount is LTC, convert to BTC using price
                tdate = float ( t['date'] )
                if ( ( tid > self.mostRecentTransactionID ) and ( tdate > self.epoch ) ):
                    ed.volume += tvol
                    ed.nb_trades += 1
                if ( tid > mostRecentID ):
                    mostRecentID = tid
                    mostRecentPrice = 1 / tprice # trade pair must be inverted ltcbtc -> btcltc
        except Exception:
            self.logger.write ( 'error buildData trades\n' + str(traceback.format_exc()) )
            return None

        try: # bids and asks are inverted
            for b in book['asks']:
                bprice = 1 / float ( b[0] ) # trade pair must be inverted ltcbtc -> btcltc
                bvol = float ( b[0] ) * float ( b[1] )
                ed.bids.append ( [ bprice, bvol ] )
                ed.total_bid += bprice * bvol
            ed.bids.sort ( reverse=True )

            for a in book['bids']:
                aprice = 1 / float ( a[0] ) # trade pair must be inverted ltcbtc -> btcltc
                avol = float ( a[0] ) * float ( a[1] )
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
            if ( mostRecentID != 0 ):
                self.mostRecentTransactionID = mostRecentID
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
        headers = {"Content-type": "application/x-www-form-urlencoded"}
        tickerData = None
        bookData = None
        tradesData = None
        ed = None
        start = time.time ( )        
        try:
            connection = httplib.HTTPSConnection ( 'btc-e.com', timeout=4 )
            # LTC/USD ticker
            self.nonce += 1
            params = urllib.urlencode ( { 'nonce':str(self.nonce)} )
            start = time.time ( )
            connection.request ( 'POST', '/api/2/ltc_usd/ticker', params, headers )
            r = connection.getresponse ( )
            if ( r.status == 200 ):
                tickerData = r.read ( )
                tickerDict = json.loads ( tickerData )
                self.LTC_USD_rate = tickerDict['ticker']['last']
            else:
                self.logger.write ( 'error fetchData ticker http %d' % r.status )
            # order book
            self.nonce += 1
            params = urllib.urlencode ( { 'nonce':str(self.nonce)} )
            start = time.time ( )
            connection.request ( 'POST', '/api/2/ltc_btc/depth', params, headers )
            r = connection.getresponse ( )
            if ( r.status == 200 ):
                bookData = r.read ( )
            else:
                self.logger.write ( 'error: fetchData book http %d' % r.status )
            # past trades
            self.nonce += 1
            params = urllib.urlencode ( { 'nonce':str(self.nonce)} )
            connection.request ( 'POST', '/api/2/ltc_btc/trades', params, headers )
            r = connection.getresponse ( )
            if ( r.status == 200 ):
                tradesData = r.read ( )
            else:
                self.logger.write ( 'error fetchData trades http %d' % r.status )
            connection.close ( )
        except Exception:
            self.logger.write ( 'error fetchData connection\n' + str(traceback.format_exc()) )
            return None
        lag = time.time() - start

        # convert to JSON
        (book,trades) = self.makeJSON ( bookData, tradesData )

        if ( (book != None) and (trades != None) ):
            ed = self.buildData ( book, trades, lag )
            if ( ed != None ):
                ed.timestamp = start
        return ed



#
#
# main program
#

if __name__ == "__main__":
    coinwatcher.main ( 'BTCE-LTC', 'btceLTC', BTCELTCWatcher )
