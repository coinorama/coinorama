#!/bin/bash
#
# Coinorama markets data packing tool
# usage: dataset-pack.sh <exchange>
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

# check out configuration
if [ -n "$COINORAMA_HOME" ]; then
    source "$COINORAMA_HOME/conf/coinorama.conf"
elif [ -f "conf/coinorama.conf" ]; then
    source "conf/coinorama.conf"
fi

if [ -z "$EXCHANGES" ]; then
    echo "error: no exchanges defined, does the configuration file exist ?"
    exit 1
fi


if [ $# -lt 1 ]
then
    echo "usage: dataset-pack.sh <exchange>"
    exit 1
fi


# select exchange
for e in $EXCHANGES
do
    if [ "$1" = $e ]
    then
        exchange="$1"
        break
    fi
done

for e in $EXCHANGES_OFF
do
    if [ "$1" = $e ]
    then
        exchange="$1"
    fi
done

# check selected exchange
if [ -z $exchange ]
then
    echo "error: unknown exchange $1"
    exit 1
fi

if [ ! -d data/$exchange ]; then
    echo "error: no data directory found for $exchange"
    exit 1
fi

if [ ! -f data/$exchange/data.csv ]; then
    echo "error: no dataset found for $exchange"
    exit 1
fi

pid=$(pgrep -fl /usr/bin/python | grep watcher-$exchange.py | awk '{print $1}')
if [ -n "$pid" ]
then
    echo "error: exchange watcher $exchange seems to be running (pid=$pid)"
    exit 1
fi

# extract each data pack and compress it
PACK_NB_LINES=131072
PACK_GZ_LEVEL=6

split -d -a 5 -l $PACK_NB_LINES "data/$exchange/data.csv" "data/$exchange/data.csv."

i=0
packname="data/$exchange/data.csv.$(printf '%.5d' $i)"
while true
do
    let i+=1
    next_packname="data/$exchange/data.csv.$(printf '%.5d' $i)"
    if [ -f $packname -a -f $next_packname ]; then
        gzip -$PACK_GZ_LEVEL $packname
    else
        break
    fi
    packname="$next_packname"
done

mv "data/$exchange/data.csv" "data/$exchange/data.csv.PLAIN"

exit 0
