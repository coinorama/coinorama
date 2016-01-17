#!/bin/bash
#
# Coinorama markets data extraction tool
# usage: dataset-extract.sh [nblines|full]
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

if [ ! -d ../../../data ]; then
    echo "error: no dataset found"
    exit 1
fi

# make room for freshly extracted data
if [ -d data ]; then
    TIMESTAMP=`date +%-Y%m%d%H%M%S`
    if [ -a "data-$TIMESTAMP" ]; then
        echo "error: dataset backup data-$TIMESTAMP/ already exists"
        exit 1
    else
        echo "warning: moving previous dataset into data-$TIMESTAMP"
        mv "data" "data-$TIMESTAMP"
        if [ $? -ne 0 ]; then
            exit 1
        fi
    fi
fi


mkdir "data"
if [ $? -ne 0 ]; then
    exit 1
fi

# read configuration from command-line
nb_lines=500000
if [ "$1" = "full" ]; then
    nb_lines=0
elif [ -n "$1" ]; then
    nb_lines=$1 # todo: check $1
fi

# extract each data
PACK_NB_LINES=131072 #262144 #1369088
PACK_GZ_LEVEL=6

for d in ../../../data/*
do
    name=`basename "$d"`

    if [ "$name" = "blockchain" ]; then
        continue
    fi

    mkdir "data/$name"

    if [ -f "$d/data.csv" ]; then
        # Plain-text mode
        if [ $nb_lines -eq 0 ]; then
            split -d -a 5 -l $PACK_NB_LINES "$d/data.csv" "data/$name/data.csv."
        else
            tail -n $nb_lines "$d/data.csv" | split -d -a 5 -l $PACK_NB_LINES - "data/$name/data.csv."
        fi
        if [ $? -ne 0 ]; then
            echo "error: dataset $name could not be processed"
            exit 1
        fi

        i=0
        packname="data/$name/data.csv.$(printf '%.5d' $i)"
        while true
        do
            let i+=1
            next_packname="data/$name/data.csv.$(printf '%.5d' $i)"
            if [ -f $packname -a -f $next_packname ]; then
                gzip -$PACK_GZ_LEVEL $packname
            else
                break
            fi
            packname="$next_packname"
        done
    else
        # Pack mode (grab last text file)
        i=0
        while true
        do
            packname="$d/data.csv.$(printf '%.5d' $i)"
            if [ ! -f "$packname.gz" ]; then
                break
            fi
            let i+=1
        done
        cp "$packname" "data/$name/data.csv.00000"
    fi
    cp "$d/asks.csv" "$d/bids.csv" "data/$name" >& /dev/null
done

exit 0
