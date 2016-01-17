#!/usr/bin/python
#
# Coinorama markets data checking tool
# usage: dataset-check.py <input file>
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

if len(sys.argv) < 2:
    print ( 'usage: check-tstamps.py <infile>' )
    sys.exit ( 1 )

def format_float ( f, fs='%f' ):
    s = fs % f
    nn = s.rstrip('0')
    if ( len(nn) == 0 ):
        return '0'
    if ( nn[-1] == '.' ):
        return nn[:-1]
    return nn

# read and fix data.csv
fi = open ( sys.argv[1], 'r' )
fo = open ( sys.argv[1]+'.fixed', 'w' )

prev_stamp = 0

l = fi.readline ( )
nb_cols = len(l.split(' '))

while ( len(l) > 0 ):
    l = l[:-1]
    cols = l.split(' ')
    cstamp_str = cols[0]
    cstamp = float ( cstamp_str )
    fl = [ ]
    for c in cols:
        if 'e' in c:
            print ( 'error: column %s contains an \'e\'' % c )
            ff = float ( c )
            fs = format_float ( ff )
            fl.append ( fs )
        else:
            fl.append ( c )
    fo.write ( ' '.join(fl) + '\n' )
    if ( cstamp < prev_stamp ):
        print ( 'error: timestamp %s is too low' % cstamp_str )
    if ( cstamp-prev_stamp > 3600 ):
        print ( 'warning: timestamp %s is too far away' % cstamp_str )
    if ( nb_cols != len(cols) ):
        print ( 'warning: timestamp %s has a different number of columns: %d' % (cstamp_str, len(cols)) )
    prev_stamp = cstamp
    l = fi.readline ( )

fi.close ( )
fo.close
