#!/usr/bin/python
#
# chainref-cmd : sends command to a chainref daemon
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
    print 'chainref-cmd version %s' % version()
    print 'sends a command to a chainref daemon'
    print ''
    print 'usage: chainref-cmd.py [OPTIONS] <command> <command arg>'
    print ''
    print 'commands:'
    print '\tjunk\t\t\tsend junk data to the daemon'
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

def cmd_junk ( ):
    return 'a block 308993 %f 16818461371.161112 498859 1271 21981.887892\n' % (time.time())

COMMANDS['junk'] = cmd_junk


def cmd_ajax ( ):
    rq = '\0bla\0QUERY_STRING\0v=p&k=0&f=1\0bla\0'
    return '%d%s' % (len(rq)-1,rq)

COMMANDS['ajax'] = cmd_ajax


def cmd_stats ( ):
    return 's\n'

COMMANDS['stats'] = cmd_stats


def cmd_shutdown ( ):
    return 'h\n'

COMMANDS['shutdown'] = cmd_shutdown
COMMANDS['halt'] = cmd_shutdown
COMMANDS['stop'] = cmd_shutdown


# ENTRY
def chainref_cmd ( cmd, host='/tmp/chainrefd', log=None ):
    if ( len(cmd) > 1 ):
        arg = cmd[1]
    else:
        arg = None

    if ( cmd[0] not in COMMANDS ):
        print 'chainref-cmd: invalid command \'%s\'' % cmd[0]
        return

    if ( cmd[0].startswith('ajax') ):
        host = '/tmp/chainref-ajax-0'

    if ( arg != None ):
        content = COMMANDS[cmd[0]] ( arg )
    else:
        content = COMMANDS[cmd[0]] ( )

    s = socket.socket ( socket.AF_UNIX, socket.SOCK_STREAM )

    try:
        s.connect ( host )
        s.send ( content )
    except Exception,e:
        print 'chainref-cmd: communication with server failed: %s' % str(e)
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
    host = '/tmp/chainrefd'
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
        print 'chainref-cmd: no command provided'
        print_usage ( )
        sys.exit ( -1 )

    # call coinref_cmd
    chainref_cmd ( args, host, log )
    sys.exit ( 0 )
