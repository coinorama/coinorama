#!/usr/bin/python
#
# Coinorama watcher for Bitcoin Blockchain
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


import authproxy
import datetime
from decimal import Decimal
import argparse
import locale
import math
import os
import io
import socket
import sys
import time
import traceback
import threading
import signal


rpcuser = 'bitcoinrpc'
rpcpass = '' # FILL IN THIS FIELD WITH THE RPC PASSWORD YOUR BITCOIND IS CONFIGURED WITH


# Bitcoind RPC access class
class BitcoinRPC:
    def __init__ ( self, logger, max_attempts=2 ):
        self.access = authproxy.AuthServiceProxy ( 'http://' + rpcuser + ':' + rpcpass + '@localhost:8332' )
        self.logger = logger
        self.max_attempts = max_attempts
        return

    def call ( self, method, *args ):
        attempt = 0
        while ( ( self.max_attempts == 0 ) or ( attempt < self.max_attempts ) ):
            try:
                return self.access.__getattr__(method) ( *args )
            except Exception as e:
                self.logger.write ( 'error BitcoinRPC %s' % e )
            self.access = None
            while ( self.access == None ):
                time.sleep ( 5 ) # wait some time and create a new connection
                try:
                    self.access = authproxy.AuthServiceProxy ( 'http://' + rpcuser + ':' + rpcpass + '@localhost:8332' )
                except Exception as e:
                    self.logger.write ( 'error BitcoinRPC %s' % e )
                    self.access = None
            attempt += 1
        raise Exception ( 'BitcoinRPC keeps failing' )
        return None


# Timer class
class Timer:
    def __init__ ( self, interval, callback_object ):
        self.interval = interval
        self.timer_thread = None
        self.callback_object = callback_object

    def fire(self):
        self.callback_object.timeout ( )
        self.start ( )
        return

    def start(self):
        self.timer_thread = threading.Timer ( self.interval, self.fire )
        self.timer_thread.daemon = True
        self.timer_thread.start ( )
        return

    def stop ( self ):
        if ( self.timer_thread != None ):
            self.timer_thread.cancel ( )
        return


# BlockData class
class BlockData:
    def __init__ ( self, block, timestamp, btcrpc, logger ):
        self.timestamp = timestamp
        self.uid = block['height']
        self.difficulty = block['difficulty']
        self.version = block['version']
        self.size = block['size']
        self.nb_tx = len(block['tx'])
        self.volume = 0
        self.fees = 0
        self.btcrpc = btcrpc
        self.logger = logger
        self.computeFees ( block )
        self.computeVolume ( block )

    def getBlockReward ( self ):
        nb_halvings = self.uid / 210000
        return Decimal(50) / Decimal( math.pow(2,nb_halvings) )

    def computeFees ( self, block ):
        self.fees = 0
        try:
            rawt = self.btcrpc.call ( 'getrawtransaction', block['tx'][0] )
            tx = self.btcrpc.call ( 'decoderawtransaction', rawt )
            for txout in tx['vout']:
                self.fees += txout['value']
            self.fees = self.fees - self.getBlockReward()
        except Exception as e:
            self.logger.write ( 'error computeFees %s' % e )
            pass
        if self.fees < Decimal('1E-8'):
            self.fees = 0
        return

    def computeVolume ( self, block ):
        self.volume = 0
        try:
            for t in block['tx']:
                rawt = self.btcrpc.call ( 'getrawtransaction', t )
                tx = self.btcrpc.call ( 'decoderawtransaction', rawt )
                for txout in tx['vout']:
                    self.volume += txout['value']
        except Exception as e:
            self.logger.write ( 'error computeVolume %s' % e )
            pass
        return


# Watcher class
class BlockchainWatcher:
    def __init__ ( self, logger ):
        self.logger = logger
        if not os.path.isdir('data'):
            os.mkdir ( 'data' )
        if not os.path.isdir('data/blockchain'):
            os.mkdir ( 'data/blockchain' )
        data_fname = 'data/blockchain/data.csv'
        self.csv_file = io.open ( data_fname, 'ab', 256 )
        self.timer = Timer ( 10, self )
        try:
            self.btcrpc = BitcoinRPC ( self.logger, 0 ) # will keep retrying forever if connection to bitcoind is lost
        except:
            self.logger.write ( 'error bitcoind not responding' )
            raise Exception ( 'cannot initialize RPC with bitcoind' )
        if not self.readPrevData ( data_fname ):
            try:
                self.mostRecentBlock = self.btcrpc.call ( 'getblockcount' )
                self.maxMempoolSize = self.btcrpc.call ( 'getmempoolinfo' ) ['size']
            except:
                self.logger.write ( 'error bitcoind not responding' )
                raise Exception ( 'cannot contact bitcoind' )
        self.logger.write ( 'startup at block %d' % self.mostRecentBlock )

    def readPrevData ( self, fname ):
        if ( fname != '' ):
            try:
                f = open ( fname, 'r' )
                f.seek ( 0, os.SEEK_END )
                fsize = f.tell ( )
                f.seek ( max(fsize-500,0), 0 )
                lines = f.readlines ( )
                f.close ( )
                cols = lines[-1].strip().split ( )
                self.logger.write ( 'startup using dataset block count' )
                self.mostRecentBlock = int ( cols[0] )
                self.maxMempoolSize = int ( cols[9] )
                return True
            except:
                self.logger.write ( 'startup using bitcoind block count' )
                pass
        return False

    # bitcoind polling function, called frequently by the timer
    def timeout ( self ):
        self.queryNewBlocks ( )
        return

    def queryNewBlocks ( self ):
        b = None
        bd = None
        try:
            mempool = self.btcrpc.call ( 'getmempoolinfo' )
            self.maxMempoolSize = max ( self.maxMempoolSize, mempool['size'] )
            timestamp = time.time ( )
            last_block_uid = self.btcrpc.call ( 'getblockcount' )
            if last_block_uid > self.mostRecentBlock:
                for n in range(self.mostRecentBlock+1,last_block_uid+1):
                    blockhash = self.btcrpc.call ( 'getblockhash', n )
                    block = self.btcrpc.call ( 'getblock', blockhash )
                    bd = BlockData ( block, timestamp, self.btcrpc, self.logger )
                    self.dispatchData ( bd, mempool['size'] )
                    self.maxMempoolSize = mempool['size']
                    timestamp = timestamp + 4
        except Exception as e:
            self.logger.write ( 'error queryNewBlocks\n' + str(traceback.format_exc()) )
            return
        return

    def dispatchData ( self, bd, mempool_size ):
        self.logger.write ( 'tick new block %d' % bd.uid )
        data = '%d %f %f %d %d %d %f %s %d %d\n' % (bd.uid, bd.timestamp, bd.difficulty, bd.version, bd.size, bd.nb_tx, bd.volume, str(bd.fees), mempool_size, self.maxMempoolSize)
        self.csv_file.write ( data )
        self.csv_file.flush ( )
        self.mostRecentBlock = bd.uid
        # send the new data to chainrefd
        host='/tmp/chainrefd'
        s = socket.socket ( socket.AF_UNIX, socket.SOCK_STREAM )
        try:
            s.connect ( host )
            s.send ( 'a block %s\n' % data )
        except Exception,e:
            pass
        s.close ( )
        return


    def start ( self ):
        self.timer.start ( )
        return
    
    def stop ( self ):
        self.timer.stop ( )
        self.csv_file.close ( )
        return


#
#
# logging, printing, etc...
#

class LogWriter():
    def __init__ ( self, log_filename ):
        if ( log_filename != '' ):
            self.log_file = open ( log_filename, 'ab', 1 )
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
            self.log_file.write (timestr + ' ' + msg + '\n' )
        else:
            print "%s: %s" % (timestr, msg)
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
            self.logger.write ( self, string )
        return


#
#
# main program
#

class maincontext:
    def __init__ ( self ):
        self.keep_running = True


def main():
    """main funtion, called at the start of the program"""

    debug_tb = []

    def main_loop ( log_filename ):
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
            watcher = BlockchainWatcher ( logwriter )
            watcher.start ( )
            while ctxt.keep_running:
                time.sleep ( 2 )

        except KeyboardInterrupt:
            logwriter.write ( "got Ctrl+C, trying to shut down cleanly.")

        except Exception:
            debug_tb.append(traceback.format_exc())

        # Now trying to shutdown everything in an orderly manner.
        logwriter.write ( 'shutdown' )

        try:
            if ( watcher != None ):
                watcher.stop ( )
        except Exception:
            debug_tb.append(traceback.format_exc())

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
    argp = argparse.ArgumentParser(description='Bitcoin blockchain monitor' )
    argp.add_argument ( '--log', action="store", default="", help="output log to a file" )
    argp.add_argument ( '--daemon', action="store_true", help="run in the background" )
    args = argp.parse_args ( )

    # if its ok then we can finally enter the main loop
    if ( args.daemon ):
        if ( args.log == "" ):
            args.log = "watcher-blockchain.log"
        try:
            pid = os.fork ( )
            if ( pid > 0 ):
                sys.exit ( 0 )
        except OSError, e:
            sys.stderr.write("error: fork failed: %d (%s)\n" % (e.errno, e.strerror))
            sys.exit(1)
    main_loop ( args.log )
    if len(debug_tb):
        if ( args.log == "" ):
            print "\n\n*** error(s) in main_loop() that caused unclean shutdown:\n"
            for trb in debug_tb:
                print trb
        else:
            f = open ( args.log, 'ab' )
            f.write ( '\n*** error(s) in main_loop() that caused unclean shutdown:\n' )
            for trb in debug_tb:
                f.write ( trb + '\n' )
            f.close ( )

if __name__ == "__main__":
    main()
