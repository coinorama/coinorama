#!/usr/bin/python
#
# Coinorama ticker API demo, markets and network info
#
# This file is part of Coinorama <http://coinorama.net>
#
# version 0.6.2 ; 2015-02-07
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


import json
from httplib import HTTPConnection
from datetime import datetime
from sys import stdout, stderr


def get_version ( ):
    return '0.6.2'


def fetchData ( server, markets, network ):
    marketsData = None
    networkData = None

    connection = HTTPConnection ( server, timeout=5 )

    # markets
    connection.request ( 'GET', markets )
    r = connection.getresponse ( )
    if ( r.status == 200 ):
        marketsData = r.read ( )
    else:
        stderr.write ( 'error: fetchData() got status %d for markets\n' % r.status )
        return None

    # network
    connection.request ( 'GET', network )
    r = connection.getresponse ( )
    if ( r.status == 200 ):
        networkData = r.read ( )
    else:
        stderr.write ( 'error: fetchData() got status %d for network\n' % r.status )
        return None

    connection.close ( )

    # parse JSON
    return ( json.loads(marketsData), json.loads(networkData), '' )



# markets
MKT_DIRECTION_CHAR = [ u'\u2193', u'\u2192', u'\u2191' ] # down, stable, up

def getAvgPrice ( markets ):
    total_volume = 0.0
    mkt_sum = 0.0
    # weighted USD average of all available exchanges
    for e in markets['ticks']:
        t = markets['ticks'][e]
        mkt_sum += (t['last'] * t['rusd']) * t['volume']
        total_volume += t['volume']
    return (mkt_sum / total_volume)

def getPriceDirection ( avg, last ):
    if ( abs(avg-last) <= 0.01 ):
        return 1
    elif ( avg > last ):
        return 0
    return 2

class exchange:
    def __init__ ( self, name, tick ):
        self.name = name[0:len(name)-3]
        self.price = tick['last']
        self.volume = tick['volume']
        self.direction = getPriceDirection ( tick['avg'], tick['last'] )
        self.usd_conv = tick['rusd']
        self.currency = name[len(name)-3:]

    def __unicode__ ( self ):
        return u'%s: %s %.2f %s ; %.1f BTCs traded the past 24 hours' % ( self.name, MKT_DIRECTION_CHAR[self.direction],
                                                                          self.price, self.currency, self.volume )
    def __str__(self):
        return unicode(self).encode('utf-8')

    def __cmp__ ( self, other ):
        return (self.volume - other.volume)

def printMarkets ( data ):
    markets = { }
    for t in data['ticks']:
        e = exchange ( t, data['ticks'][t] )
        if e.currency not in markets:
            markets[e.currency] = [ ]
        markets[e.currency].append ( e )
    for c in markets:
        markets[c].sort ( reverse=True )
        print ( ' %s' % c )
        for e in markets[c]:
            print ( '  %s' % e )
    return



# network
def printNetwork ( data ):
    t = data['ticks'][0]['tick'] # for now, only one crypto-currency available : Bitcoin
    print ( ' Block: %d ; %s UTC' % (t['last'],datetime.utcfromtimestamp(t['time'])) )
    print ( ' Difficulty: %s' % t['diff'] )
    print ( ' Hashrate: %.1f Phash/sec' % (t['hrate']/1000000000) ) # MegaHash/sec converted to PetaHash/sec

    # mining pools
    pools = [ (data['ticks'][0]['pools'][p],p) for p in data['ticks'][0]['pools'] ]
    pools_sum = sum ( [ t[0] for t in pools ] )
    pools.sort ( reverse=True )
    print ( ' Top 5 Mining Pools:' )
    for i in range ( 5 ):
        print ( '  %s %.1f%%' % (pools[i][1],pools[i][0]*100.0/pools_sum) )
    return


# market cap
def getNbCoinsMined ( block_id ):
    reward = 50
    halving = 210000
    total = 0
    while ( block_id > 0 ):
        nb_blocks = min ( halving, block_id )
        total += reward * nb_blocks
        block_id -= nb_blocks
        reward /= 2.0
    return total

def printMarketCap ( markets, block_id ):
    nbcoins = getNbCoinsMined ( block_id )
    avg = getAvgPrice(markets)
    print ( ' Nb. Coins: %d BTCs' % getNbCoinsMined(block_id) )
    print ( ' Average Price: %.2f USD/BTC' % avg )
    print ( ' Market Cap: %.2f Billions USD' % ((nbcoins*avg)/1000000000) )
    return


#
# main program
#
if __name__ == "__main__":
    t = fetchData ( 'localhost:8080', '/coinorama/api/markets', '/coinorama/api/network' )
    if ( t != None ):
        (mkt_data,nwk_data,bc_data) = t
        print ( '\nCoinorama.net Ticker API demo v%s' % get_version() )
        print ( '\nMarkets:' )
        printMarkets ( mkt_data )
        print ( '\nNetwork:' )
        printNetwork ( nwk_data )
        print ( '\nMarket Cap:' )
        printMarketCap ( mkt_data, nwk_data['ticks'][0]['tick']['last'] )
        print ( '' )
