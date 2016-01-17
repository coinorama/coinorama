#!/usr/bin/python
#
# ajax-perf.py : fake AJAX request for performance evaluation
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


def print_usage ( ):
    print ( 'usage: ajax-perf [-b n|--backend n] [-f|--full] [-i n|--iter=n] [-t|--ticker] <coinref|chainref>' )
    return


# PAYLOAD

PAYLOAD = 'CONTENT_LENGTH\0' \
          '0\0' \
          'SCGI\0' \
          '1\0' \
          'SERVER_SOFTWARE\0' \
          'lighttpd/1.4.32\0' \
          'SERVER_NAME\0' \
          'localhost\0' \
          'GATEWAY_INTERFACE\0' \
          'CGI/1.1\0' \
          'SERVER_PORT\0' \
          '8080\0' \
          'SERVER_ADDR\0' \
          '127.0.0.1\0' \
          'REMOTE_PORT\0' \
          '35856\0' \
          'REMOTE_ADDR\0' \
          '127.0.0.1\0' \
          'SCRIPT_NAME\0' \
          '/data.cft\0' \
          'PATH_INFO\0' \
          '\0' \
          'SCRIPT_FILENAME\0' \
          './web/data.bft\0' \
          'DOCUMENT_ROOT\0' \
          './web/\0' \
          'REQUEST_URI\0' \
          '/data.cf\0' \
          'QUERY_STRING\0' \
          '%s\0' \
          'REQUEST_METHOD\0' \
          'GET\0' \
          'REDIRECT_STATUS\0' \
          '200\0' \
          'SERVER_PROTOCOL\0' \
          'HTTP/1.1\0' \
          'HTTP_USER_AGENT\0' \
          'Wget/1.14 (linux-gnu)\0' \
          'HTTP_ACCEPT\0' \
          '*/*\0' \
          'HTTP_HOST\0' \
          'localhost:8080\0' \
          'HTTP_CONNECTION\0' \
          'Keep-Alive\0'


# ENTRY
def coinref_request ( fsock, payload ):
    s = socket.socket ( socket.AF_UNIX, socket.SOCK_STREAM )
    try:
        s.connect ( fsock )
        s.send ( payload )
        d = "empty"
        while len(d) > 0:
            d = s.recv ( 8192 )
    except Exception,e:
        print 'ajax-perf: communication with server failed: %s' % str(e)
        s.close ( )
        sys.exit ( 1 )
    s.close ( )
    return



# MAIN
if ( __name__ == '__main__' ):
    N = 10000
    db = 'coinref'
    backend = '0'
    payload = PAYLOAD % 'f=0&m=c&E=323&v=s&k=0'
    
    # parse command line
    options = 'hb:fi:t'
    long_options = [ 'help', 'backend', 'full', 'iter', 'ticker' ]
    
    try:
        opts, args = getopt.gnu_getopt ( sys.argv[1:], options, long_options )
    except getopt.GetoptError, e:
        print str(e)
        print_usage ( )
        sys.exit ( 2 )
    
    # process options
    for opt, val in opts:
        if opt in ('-h','--help'):
            print_usage ( )
            sys.exit ( 0 )
        elif opt in ('-b','--backend'):
            backend = val
        elif opt in ('-f','--full'):
            payload = PAYLOAD % 'f=1&m=c&E=323&v=s&k=0'
        elif opt in ('-i','--iter'):
            N = int(val)
        elif opt in ('-t','--ticker'):
            payload = PAYLOAD % ''
        else:
            assert False, 'unhandled option'
            print_usage ( )
            sys.exit ( -1 )

    for a in args:
        db = a
    
    full_payload = str(len(payload))+':'+payload
    sock = '/tmp/%s-ajax-%s' % (db,backend)
    start = time.time ( )
    for n in range(0,N):
        coinref_request ( sock, full_payload )
    duration = time.time() - start
    print ( 'duration : %.2f secs (~%.0f rq/sec)' % (duration,N/duration) )
    sys.exit ( 0 )
