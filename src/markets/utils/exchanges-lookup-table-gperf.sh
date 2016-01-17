#!/bin/bash
#
# Coinorama exchanges name hash table generation with gperf
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
if [ -f ../../../conf/coinorama.conf ]; then
    source ../../../conf/coinorama.conf
elif [ -n "$COINORAMA_HOME" ]; then
    source "$COINORAMA_HOME/conf/coinorama.conf"
elif [ -f "conf/coinorama.conf" ]; then
    source "conf/coinorama.conf"
fi

if [ -z "$EXCHANGES" ]; then
    echo "error: no exchanges defined, does the configuration file exist ?"
    exit 1
fi

listfile=$(mktemp)

for e in $EXCHANGES
do
    echo $e >> $listfile
done

nbexch=$(cat $listfile | wc -l)

echo "generating code for $nbexch exchanges"
echo

outfile=$(mktemp)
gperf --no-strlen -m 10000 --output-file=$outfile $listfile

table_stats=$(grep 'maximum key range' $outfile)

if [ -z "$table_stats" ]; then
    echo "error: unable to find table statistics in gperf output"
    exit 1
fi

nbdups=$(echo "$table_stats" | cut -f 9 -d ' ')
if [ "$nbdups" -ne 0 ]; then
    echo "warning: gperf could not generate a table without duplicates"
    exit 1
fi

#keyrange=$(echo "$table_stats" | cut -f 6 -d ' ' | cut -f 1 -d ',')
#if [ "$keyrange" -ne "$nbexch" ]; then
#    echo "warning: gperf could not generate a table without holes"
#fi

sed -i s:'const char \* wordlist':'const int exchlist': $outfile

for e in $EXCHANGES
do
    len=$((${#e} - 3))
    exch_enum="EXCH_${e: 0:$len}_${e: -3}"
    sed -i s:\"$e\":"${exch_enum^^}": $outfile
done

sed -i s:\"\":'-1':g $outfile

cat $outfile

rm -f $listfile
rm -f $outfile
