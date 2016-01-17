#!/usr/bin/python
#
# Coinorama/coinref: Module to watch and store market info
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


import argparse
import locale
import math
import os
import io
import socket
import sys
import time
import json
import traceback
import threading
import signal
import gzip
import shutil


# Timer class
class Timer:
    def __init__ ( self, interval, callback_object ):
        self.interval = interval
        self.timer_thread = None
        self.callback_object = callback_object

    def fire ( self ):
        self.callback_object.timeout ( )
        self.start ( )
        return

    def start ( self ):
        self.timer_thread = threading.Timer ( self.interval, self.fire )
        self.timer_thread.daemon = True
        self.timer_thread.start ( )
        return

    def stop ( self ):
        if ( self.timer_thread != None ):
            self.timer_thread.cancel ( )
        return


# Counter of lines in a file
def _bufreader ( reader ):
    b = reader ( 1024 * 1024 )
    while b:
        yield b
        b = reader ( 1024*1024 )

def count_lines_in_file ( fname ):
    f = io.open ( fname, 'rb' )
    f_buf = _bufreader ( f.raw.read )
    return sum( buf.count(b'\n') for buf in f_buf )


# float formatting, removes trailing 0
# beware: does not work with %.0f
def format_float ( f, fs='%f' ):
    s = fs % f
    nn = s.rstrip('0')
    if ( len(nn) == 0 ):
        return '0'
    if ( nn[-1] == '.' ):
        return nn[:-1]
    return nn

# ExchangeData class
class ExchangeData:
    def __init__ ( self ):
        self.timestamp = 0
        self.rate = 0
        self.ask_value = 0
        self.asks = [ ]
        self.total_ask = 0
        self.bid_value = 0
        self.bids = [ ]
        self.total_bid = 0
        self.lag = 0
        self.volume = 0
        self.nb_trades = 0
        self.USD_conv_rate = 1.0

    def load_from_string ( self, l ):
        cols = l.split ( )
        self.timestamp = float ( cols[0] )
        self.rate = float ( cols[1] )
        self.total_ask = float ( cols[2] )
        self.total_bid = float ( cols[3] )
        self.volume = float ( cols[4] )
        self.nb_trades = int ( cols[5] )
        self.lag = float ( cols[6] )
        self.asks = [ [  float(cols[7]) ] ]
        self.bids = [ [  float(cols[8]) ] ]
        self.USD_conv_rate = float ( cols[9] )
        return

    def __str__ ( self ):
        s = format_float ( self.timestamp )
        s += ' ' + format_float(self.rate)
        s += ' ' + format_float(self.total_ask)
        s += ' ' + format_float(self.total_bid)
        s += ' ' + format_float(self.volume,'%.8f')
        s += ' %d' % self.nb_trades
        s += ' ' + format_float(self.lag,'%.3f')
        s += ' ' + format_float(self.asks[0][0])
        s += ' ' + format_float(self.bids[0][0])
        s += ' ' + format_float(self.USD_conv_rate,'%.8f')
        return s


# Watcher class
# (abstract, cannot be used on its own)
class CoinWatcher:
    def __init__ ( self, shortname, with_coinrefd, logger, delay=10 ):
        self.shortname = shortname
        self.with_coinrefd = with_coinrefd
        self.logger = logger
        self.csv_file = None
        self.io_busy = threading.Lock ( )
        self.timer = Timer ( delay, self )
        self.prev_data = None
        self.prev_bookchart_time = 0
        self.epoch = int ( time.time()-1 )

        if not os.path.isdir('data'):
            os.mkdir ( 'data' )
        if not os.path.isdir('data/%s'%shortname):
            os.mkdir ( 'data/%s'%shortname )
        data_fname = self.makeCSVfilename ( )
        # check pack files
        self.packing = True
        self.pack_lines = 0
        self.pack_id = 0
        self.pack_limit = 128 * 1024
        data_packname = self.makeCSVfilename ( self.pack_id, True )
        while os.path.exists(data_packname):
            self.pack_id += 1
            data_packname = self.makeCSVfilename ( self.pack_id, True )
        data_packname = self.makeCSVfilename ( self.pack_id )
        has_textpack = os.path.exists ( data_packname )
        if has_textpack or self.packing:
            # check that there is not other plain-text pack file
            if os.path.exists(self.makeCSVfilename(self.pack_id+1)):
                self.logger.write ( 'error found more than one plain-text pack file' )
                raise Exception ( 'more than one plain-text pack file' )
            # use plain-text pack file as output and count its line number
            data_fname =  data_packname
            if has_textpack:
                self.pack_lines = count_lines_in_file ( data_fname )
            self.logger.write ( 'startup at pack %.5d with %d lines' % (self.pack_id,self.pack_lines) )
        else:
            self.packing = False
        # read previous data, if possible
        self.readPrevData ( data_fname )
        # open output file
        self.csv_file = io.open ( data_fname, 'ab', 256 )
        return

    def makeCSVfilename ( self, packid=-1, compressed=False ):
        fname = 'data/%s/data.csv' % self.shortname
        if packid >= 0:
            fname += '.%.5d' % packid
            if compressed:
                fname += '.gz'
        return fname

    def compressCSVfile ( self, packid ):
        try:
            fname_in = self.makeCSVfilename ( packid )
            fname_out = self.makeCSVfilename ( packid, True )
            self.logger.write ( 'packing %s' % fname_in )
            f_in = open ( fname_in, 'rb' )
            f_out = gzip.open ( fname_out, 'wb', 6 )
            shutil.copyfileobj ( f_in, f_out )
            f_in.close ( )
            f_out.close ( )
            os.unlink ( self.makeCSVfilename(packid) )
            self.logger.write ( 'produced %s' % fname_out )
        except:
            self.logger.write ( 'error output compression failed\n' + str(traceback.format_exc()) )
        return

    def readPrevData ( self, fname ):
        if ( fname != '' ):
            try:
                f = open ( fname, 'r' )
                f.seek ( 0, os.SEEK_END )
                fsize = f.tell ( )
                f.seek ( max(fsize-500,0), 0 )
                lines = f.readlines ( )
                f.close ( )
                self.prev_data = ExchangeData ( )
                self.prev_data.load_from_string ( lines[-1].strip() )
            except:
                pass
        return

    # timer callback: fetch, process and emit data
    def timeout ( self ):
        ed = self.fetchData ( )
        try:
            self.processData ( ed )
        except Exception as e:
            self.logger.write ( 'error processData %s' % e )
            return
        try:
            self.io_busy.acquire ( )
            self.emitData ( ed )
        except Exception as e:
            self.logger.write ( 'error emitData %s' % e )
        finally:
            self.io_busy.release ( )
        return

    def buildData ( self, tickerJSON, bookJSON, transactionsJSON, lag ):
        # This function must be overloaded by CoinWatcher sub-classes
        return None

    def makeJSON ( self, book, trades ):
        bookDict = { }
        transactionsDict = { }
        try:
            bookDict = json.loads ( book )
            transactionsDict = json.loads ( trades )
        except Exception as e:
            self.logger.write ( 'error makeJSON %s' % e )
            return (None,None)
        return (bookDict,transactionsDict)

    def fetchData ( self, connecter, server, orderbook, trades, reuse=True ):
        # This function can be overloaded by CoinWatcher sub-classes
        ed = None
        bookData = None
        tradesData = None
        start = time.time ( )
        try:
            connection = connecter ( server, timeout=15 )
            start = time.time ( )
            connection.request ( 'GET', orderbook, headers={'User-Agent':'coinorama.net/coinwatcher'} )
            r = connection.getresponse ( )
            if ( r.status == 200 ):
                bookData = r.read ( )
            else:
                raise Exception ( 'book http %d' % r.status )
            if ( not reuse ):
                connection.close ( )
                connection = connecter ( server, timeout=15 )
            connection.request ( 'GET', trades, headers={'User-Agent':'coinorama.net/coinwatcher'} )
            r = connection.getresponse ( )
            if ( r.status == 200 ):
                tradesData = r.read ( )
            else:
                raise Exception ( 'trades http %d' % r.status )
            connection.close ( )
        except Exception as e:
            self.logger.write ( 'error fetchData %s' % e )
            return None
        lag = time.time() - start

        # convert to JSON
        (book,trades) = self.makeJSON ( bookData, tradesData )

        # build exchange data
        if ( (book != None) and (trades != None) ):
            ed = self.buildData ( book, trades, lag )
            if ( ed != None ):
                ed.timestamp = start
        return ed

    # notify Coinref through UNIX socket
    def notifyCoinref ( self, message ):
        if ( self.with_coinrefd ):
            host='/tmp/coinrefd'
            s = socket.socket ( socket.AF_UNIX, socket.SOCK_STREAM )
            try:
                s.connect ( host )
                s.send ( message )
            except Exception,e:
                pass
            s.close ( )
        return

    # process fetched data
    def processData ( self, ed ):
        if ( ed == None ):
            if ( self.prev_data != None ):
                # notify coinref that we're lagging with previous data
                t = time.time ( )
                self.prev_data.lag += t - self.prev_data.timestamp
                self.prev_data.timestamp = t
                self.prev_data.volume = 0
                self.prev_data.nb_trades = 0
                self.notifyCoinref ( 'a %s %s\n' % (self.shortname,self.prev_data) )
            return

        # update book
        if ( (ed.timestamp - self.prev_bookchart_time) >= 60 ):
            self.prev_bookchart_time = ed.timestamp

            # 'data/%s/bids/bids-%.0f.csv'%(self.shortname,ed.timestamp)
            snap_iterfile = io.open ( 'data/%s/bids.csv'%(self.shortname), 'wb', 4096 )
            price = math.floor ( ed.bids[0][0] )
            if ( (ed.bids[0][0] - price) > 1.0 ):
                price += 1.0
            vol = ed.bids[0][1]
            for l in ed.bids:
                if ( l[0] < min(20,ed.rate/2) ):
                    break
                while ( l[0] < price ):
                    snap_iterfile.write ( "%.1f %f\n" % (price,vol) )
                    price -= 1.0
                    vol = 0
                vol += l[1]
            snap_iterfile.write ( "%.1f %f\n" % (price,vol) )
            snap_iterfile.close ( )

            # 'data/%s/asks/asks-%.0f.csv'%(self.shortname,ed.timestamp)
            snap_iterfile = io.open ( 'data/%s/asks.csv'%(self.shortname), 'wb', 4096 )
            price = math.ceil ( ed.asks[0][0] )
            if ( (price - ed.asks[0][0]) > 1.0 ):
                price -= 1.0
            vol = ed.asks[0][1]
            for l in ed.asks:
                if ( l[0] > max(227,ed.rate*1.6) ):
                    break
                while ( l[0] > price ):
                    snap_iterfile.write ( "%.1f %f\n" % (price,vol) )
                    vol = 0
                    price += 1.0
                vol += l[1]
            snap_iterfile.write ( "%.1f %f\n" % (price,vol) )
            snap_iterfile.close ( )

            # tell coinrefd that a new book is available
            self.notifyCoinref ( 'b %s %.0f\n' % (self.shortname,ed.timestamp) )
            self.logger.write ( 'tick %f %f' % (ed.bids[0][0],ed.asks[0][0]) )

        # fix ticker if necessary
        if ( ( ed.nb_trades == 0 ) and ( ed.volume > 0 ) ):
            ed.nb_trades = 1
        return

    # emit processed data to output file and coinref
    def emitData ( self, ed ):
        if ( ed == None ):
            return
        # write to output file
        if self.packing:
            if self.pack_lines >= self.pack_limit:
                # perform packing if current file is full
                self.csv_file.close ( )
                self.compressCSVfile ( self.pack_id )
                # open next pack
                self.pack_id += 1
                self.pack_lines = 0
                data_packname = self.makeCSVfilename ( self.pack_id )
                self.csv_file = io.open ( data_packname, 'ab', 256 )
        self.csv_file.write ( '%s\n' % ed )
        self.csv_file.flush ( )
        if self.packing:
            self.pack_lines += 1
        self.notifyCoinref ( 'a %s %s\n' % (self.shortname,ed) )
        self.prev_data = ed
        return

    def start ( self ):
        self.timeout ( )
        self.timer.start ( )
        return
    
    def stop ( self ):
        while not self.io_busy.acquire(False):
            self.logger.write ( 'warning shutdown delayed by busy i/o' )
            time.sleep ( 1 )
        self.timer.stop ( )
        self.csv_file.close ( )
        return


#
#
# logging, printing, etc...
#

class LogWriter():
    def __init__ ( self, filename ):
        self.filename = filename
        if ( filename != '' ):
            self.log_file = open ( filename, 'ab', 1 )
        else:
            self.log_file = None

    def close ( self ):
        if ( self.log_file != None ):
            self.log_file.close ( )
            self.log_file = None
        return

    def write ( self, msg ):
        timestr = time.strftime ( "%Y-%m-%d %H:%M:%S", time.localtime() )
        if self.log_file != None:
            self.log_file.write ( timestr+' '+msg+'\n' )
            self.log_file.flush ( )
        else:
            print "%s %s" % (timestr, msg)
            sys.stdout.flush ( )
        return


class PrintHook():
    def __init__(self, logger ):
        self.stdout = sys.stdout
        self.stderr = sys.stderr
        if ( logger.log_file != None ):
            sys.stdout = self
            sys.stderr = self
        self.logger = logger

    def close(self):
        sys.stdout = self.stdout
        sys.stderr = self.stderr
        return

    def write(self, string):
        string = string.strip()
        if string != "":
            self.logger.write ( string )
        return


#
#
# main program
#

class maincontext:
    def __init__ ( self ):
        self.keep_running = True


def main ( name, shortname, wclass ):
    """main funtion, called at the start of the program"""

    debug_tb = []

    def main_loop ( with_coinrefd, log_filename ):
        """Only the code inside this function runs while normal operation"""

        ctxt = maincontext ( )
        watcher = None

        def signal_handler ( signum, frame ):
            ctxt.keep_running = False
            return

        signal.signal ( signal.SIGTERM, signal_handler )

        # this function may under no circumstancs raise an exception.
        # We have a list debug_tb[] where we can append tracebacks.
        logwriter = sys.stdout
        printhook = None
        try:
            logwriter = LogWriter ( log_filename )
            printhook = PrintHook ( logwriter )
            watcher = wclass ( shortname, with_coinrefd, logwriter )
            watcher.start ( )
            while ctxt.keep_running:
                time.sleep ( 2 )

        except KeyboardInterrupt:
            logwriter.write ( "got Ctrl+C, trying to shut down cleanly.")

        except Exception:
            debug_tb.append(traceback.format_exc())

        # Now trying to shutdown everything in an orderly manner.
        logwriter.write ( 'shutting down' )

        try:
            if ( watcher != None ):
                watcher.stop ( )
        except Exception:
            debug_tb.append(traceback.format_exc())

        logwriter.write ( 'shutdown' )

        try:
            if ( printhook != None ):
                printhook.close ( )
        except Exception:
            debug_tb.append(traceback.format_exc())

        try:
            logwriter.close ( )
        except Exception:
            debug_tb.append(traceback.format_exc())

        # Main loop ends here, we must reach this point under all circumstances.


    # Here it begins. The very first thing is to always set US or GB locale
    # to have always the same well defined behavior for number formatting.
    for loc in ["en_US.UTF8", "en_GB.UTF8", "en_EN", "en_GB", "C"]:
        try:
            locale.setlocale(locale.LC_NUMERIC, loc)
            break
        except locale.Error:
            continue

    # before we can finally start the watcher we might need to do some configuration
    argp = argparse.ArgumentParser ( description='%s live market data monitor'%name )
    argp.add_argument ( '--log', action="store", default="", help="output log to a file" )
    argp.add_argument ( '--daemon', action="store_true", help="run in the background" )
    argp.add_argument ( '--no-coinrefd', action="store_true", help="do not send updates to coinrefd" )
    args = argp.parse_args ( )

    # if its ok then we can finally enter the main loop
    if ( args.daemon ):
        if ( args.log == '' ):
            args.log = 'watcher-%s.log' % shortname
        try:
            pid = os.fork ( )
            if ( pid > 0 ):
                sys.exit ( 0 )
        except OSError, e:
            sys.stderr.write ( 'error: fork failed: %d (%s)\n' % (e.errno, e.strerror) )
            sys.exit(1)
    main_loop ( (not args.no_coinrefd), args.log )
    if len(debug_tb):
        if ( args.log == "" ):
            sys.stderr.write ( "\n\n*** error(s) in main_loop() that caused unclean shutdown:\n" )
            for trb in debug_tb:
                sys.stderr.write ( str(trb) )
        else:
            f = open ( args.log, 'ab' )
            f.write ( '\n*** error(s) in main_loop() that caused unclean shutdown:\n' )
            for trb in debug_tb:
                f.write ( trb + '\n' )
            f.close ( )

if __name__ == "__main__":
    print 'Coinwatcher module cannot be used alone, please extend Coinwatcher class with it.'
    sys.exit ( -1 )
