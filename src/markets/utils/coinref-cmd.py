#!/usr/bin/python
#
# coinref-cmd : sends command to a coinref daemon
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

import sys
import getopt
import os
import time
import socket


# USAGE
def version ( ):
    return '0.1.0'

def print_usage ( ):
    print ''
    print 'coinref-cmd version %s' % version()
    print 'sends a command to a coinref daemon'
    print ''
    print 'usage: coinref-cmd.py [OPTIONS] <command> <command arg>'
    print ''
    print 'commands:'
    print '\tjunk\t\t\tsend junk data to the daemon'
    print '\tbook\t\t\thint the daemon about a new book'
    print '\tstats\t\t\tquery some statistics about the daemon'
    print '\tajax\t\t\tquery ajax data to the daemon'
    print '\tstop|halt|shutdown\thalt the daemon'
    print ''
    print 'options:'
    print '\t-h\t--help\t\tshow this help message'
    print '\t-d D\t--daemon=D\tset the daemon name'
    print ''
    return



# COMMANDS
COMMANDS = { }

def cmd_junk ( exchname='bstamp' ):
    return 'a %s %f 130.0 341.2 9873.1 0.01 1.0 130.6 129.5 1.0\n' % (exchname,time.time())

COMMANDS['junk'] = cmd_junk


def cmd_ajax ( exchname='bstamp' ):
    return '36\0bla\0QUERY_STRING\0v=t&t=1360002991\0bla\0'

COMMANDS['ajax'] = cmd_ajax


def cmd_book ( exchname='bstamp' ):
    return 'b %s 1369499973\n' % (exchname)

COMMANDS['book'] = cmd_book


def cmd_stats ( ):
    return 's\n'

COMMANDS['stats'] = cmd_stats


def cmd_shutdown ( ):
    return 'h\n'

COMMANDS['shutdown'] = cmd_shutdown
COMMANDS['halt'] = cmd_shutdown
COMMANDS['stop'] = cmd_shutdown


# ENTRY
def coinref_cmd ( cmd, host='/tmp/coinrefd', log=None ):
    if ( len(cmd) > 1 ):
        arg = cmd[1]
    else:
        arg = None

    if ( cmd[0] not in COMMANDS ):
        print 'coinref-cmd: invalid command \'%s\'' % cmd[0]
        return

    if ( cmd[0].startswith('ajax') ):
        host = '/tmp/coinref-ajax-0'

    if ( arg != None ):
        content = COMMANDS[cmd[0]] ( arg )
    else:
        content = COMMANDS[cmd[0]] ( )

    s = socket.socket ( socket.AF_UNIX, socket.SOCK_STREAM )

    try:
        s.connect ( host )
        s.send ( content )
    except Exception,e:
        print 'coinref-cmd: communication with server failed: %s' % str(e)
        s.close ( )
        sys.exit ( 1 )
    s.close ( )
    return



# MAIN
if ( __name__ == '__main__' ):
    # parse command line
    options = 'hd:'
    long_options = [ 'help', 'daemon' ]
    
    try:
        opts, args = getopt.gnu_getopt ( sys.argv[1:], options, long_options )
    except getopt.GetoptError, e:
        print str(e)
        print_usage ( )
        sys.exit ( 2 )

    # defaults
    host = '/tmp/coinrefd'
    log = None

    # process options
    for opt, val in opts:
        if opt in ('-h','--help'):
            print_usage ( )
            sys.exit ( 0 )
        elif opt in ('-d','--daemon'):
            host = val
        else:
            assert False, 'unhandled option'
            print_usage ( )
            sys.exit ( -1 )
    
    if ( len(args) < 1 ):
        print 'coinref-cmd: no command provided'
        print_usage ( )
        sys.exit ( -1 )

    # call coinref_cmd
    coinref_cmd ( args, host, log )
    sys.exit ( 0 )
