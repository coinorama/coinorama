#!/bin/bash
#
# Coinorama monitoring tool
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

if [ -z "$COINORAMA_LOG" ]; then
    COINORAMA_LOG="logs"
fi

if [ -z "$EXCHANGES" ]; then
    echo "error: no exchanges defined, does the configuration file exist ?"
    exit 1
fi

if [ -z "$CURRENCIES" ]; then
    echo "error: no currencies defined, does the configuration file exist ?"
    exit 1
fi

# build exchanges table according to their currency
declare -A EXCHANGES_TABLE
for e in $EXCHANGES $EXCHANGES_OFF
do
    cur="${e: -3}"
    prev=${EXCHANGES_TABLE[$cur]}
    EXCHANGES_TABLE[$cur]="$prev $e"
done

# begin
cd "$COINORAMA_LOG"
set -o pipefail

function date2delta
{
    st=$(date -d "$1" +%s)
    en=$(date +%s)
    delta=$(echo $(($en-$st)))
    if [ $delta -gt 3600 ]
    then
        deltam=$(($delta%3600))
        printf "%dh%.2dm%.2ds" $(($delta/3600)) $(($deltam/60)) $(($deltam%60))
    elif [ $delta -gt 60 ]
    then
        printf "%dm%.2ds" $(($delta/60)) $(($delta%60))
    else
        echo -n "${delta}s"
    fi
}

pad=$(printf '%0.1s' " "{1..70})
padlength=38

year=$(date "+%Y")
echo
date "+%Y-%m-%d %H:%M:%S"
echo


# COINREFD
coinrefd_str=""
lastline=$(/usr/bin/tac coinrefd.log | /bin/grep -m 1 "core")
stamp=$(echo "$lastline" | /usr/bin/awk '{{print $1,$2}}')
cointicks="0"
if echo "$lastline" | grep -q "alive"
then
    nbsamples=$(echo "$lastline" | /usr/bin/awk '{{print $6}}')
    nbreq=$(/usr/bin/tac coinrefd.log | /bin/grep -m 1 "ajax-0" | /usr/bin/awk '{{print $6}}')
    cointicks=$(/usr/bin/tac coinrefd.log | /bin/grep -m 1 "ajax-1" | /usr/bin/awk '{{print $6}}')
    coinrefd_str="coinrefd    $nbsamples lines, $(($nbreq/6)) users" # ajax request every 10s
elif echo "$lastline" | grep -q "shutdown"
then
    coinrefd_str="coinrefd    stopped"
else
    msg=$(echo "$lastline" | awk '{{print $3,$4}}')
    coinrefd_str="coinrefd    error ($msg)"
fi

delta=$(date2delta "$stamp")
echo -e "$coinrefd_str $(printf '%*.*s' 0 $((padlength - ${#coinrefd_str})) "$pad") [$delta]"


# CHAINREFD
if [ -f chainrefd.log ]
then
    chainrefd_str=""
    lastline=$(/usr/bin/tac chainrefd.log | /bin/grep -m 1 "core")
    stamp=$(echo "$lastline" | /usr/bin/awk '{{print $1,$2}}')
    chainticks="0"
    if echo "$lastline" | grep -q "alive"
    then
        nbblocks=$(echo "$lastline" | /usr/bin/awk '{{print $6}}')
        nbreq=$(/usr/bin/tac chainrefd.log | /bin/grep -m 1 "ajax-0" | /usr/bin/awk '{{print $6}}')
        chainticks=$(/usr/bin/tac chainrefd.log | /bin/grep -m 1 "ajax-1" | /usr/bin/awk '{{print $6}}')
        chainrefd_str="chainrefd   $nbblocks blocks, $(($nbreq/2)) users" # ajax request every 30s
    elif echo "$lastline" | grep -q "shutdown"
    then
        chainrefd_str="chainrefd   stopped"
    else
        msg=$(echo "$lastline" | awk '{{print $3,$4}}')
        chainrefd_str="chainrefd   error ($msg)"
    fi

    delta=$(date2delta "$stamp")
    echo -e "$chainrefd_str $(printf '%*.*s' 0 $((padlength - ${#chainrefd_str})) "$pad") [$delta]"
fi

# COINREFD and CHAINREFD tickers
echo -e "tickers     mkt $cointicks   net $chainticks"
echo


# CHAINREF WATCHER
if [ -f watcher-blockchain.log ]
then
    wchainref_str=""
    lastline=$(/usr/bin/tac watcher-blockchain.log | /bin/grep -m 1 "$year")
    stamp=$(echo "$lastline" | /usr/bin/awk '{{print $1,$2}}')
    if echo "$lastline" | /bin/grep -q "tick"
    then
        block=$(echo "$lastline" | /usr/bin/awk '{{print $6}}')
        wchainref_str="chainref-w  $block"
    elif echo "$lastline" | grep -q shutdown
    then
        wchainref_str="chainref-w  stopped"
    elif echo "$lastline" | grep -q startup
    then
        msg=$(echo "$lastline" | /usr/bin/cut -d ' ' -f 3-)
        wchainref_str="chainref-w  $msg"
    else
        msg=$(echo "$lastline" | /usr/bin/cut -d ' ' -f 4-)
        wchainref_str="chainref-w  error ($msg)"
    fi

    delta=$(date2delta "$stamp")
    echo -e "$wchainref_str $(printf '%*.*s' 0 $((padlength - ${#wchainref_str})) "$pad") [$delta]"
fi


# BLOCKORIGIN WATCHER
if [ -f watcher-$1.log ]
then
    wblockorigin_str=""
    lastline=$(/usr/bin/tac watcher-blockorigin.log | /bin/grep -m 1 "$year")
    stamp=$(echo "$lastline" | /usr/bin/awk '{{print $1,$2}}')
    if echo "$lastline" | /bin/grep -q "tick"
    then
        lastline=$(/usr/bin/tac watcher-blockorigin.log | /bin/grep -m 1 "warning 2016")
        nb_unk=$(echo "$lastline" | /usr/bin/awk '{{print $5}}')
        nb_zero=$(echo "$lastline" | /usr/bin/cut -d ';' -f 2 | /usr/bin/awk '{{print $1}}')
        wblockorigin_str="bkorigin-w  ok  new:$nb_unk  unset:$nb_zero"
    elif echo "$lastline" | grep -q shutdown
    then
        wblockorigin_str="bkorigin-w  stopped"
    elif echo "$lastline" | grep -q startup
    then
        msg=$(echo "$lastline" | /usr/bin/cut -d ' ' -f 3-)
        wblockorigin_str="bkorigin-w  $msg"
    else
        msg=$(echo "$lastline" | /usr/bin/cut -d ' ' -f 4-)
        wblockorigin_str="bkorigin-w  error ($msg)"
    fi

    delta=$(date2delta "$stamp")
    echo -e "$wblockorigin_str $(printf '%*.*s' 0 $((padlength - ${#wblockorigin_str})) "$pad") [$delta]"
fi

echo


# EXCHANGES WATCHERS
function exchange_status
{
    if [ ! -f watcher-$1.log ]
    then
        return
    fi

    price_padlength=14
    coinwatch_str=""
    lastline=$(/usr/bin/tac watcher-$1.log | /bin/grep -m 1 "^$year")
    lasttick=$(/usr/bin/tac watcher-$1.log | /bin/grep -m 1 "tick ")
    stamp=$(echo "$lasttick" | /usr/bin/awk '{{print $1,$2}}')
    if echo "$lastline" | /bin/grep -q "tick "
    then
        bid=$(printf %.2f $(echo "$lastline" | /usr/bin/awk '{{print $4}}'))
        ask=$(printf %.2f $(echo "$lastline" | /usr/bin/awk '{{print $5}}'))
        s=$(echo -e "$1 $(printf '%*.*s' 0 $((price_padlength - ${#1})) "$pad") $bid")
        t=$(echo -e "$(printf '%*.*s' 0 $((10 - ${#bid})) "$pad") $ask")
        coinwatch_str="$s$t"
    elif echo "$lastline" | /bin/grep -q "shutdown"
    then
        coinwatch_str=$(echo -e "$1 $(printf '%*.*s' 0 $((price_padlength - ${#1})) "$pad") stopped")
    else
        msg=$(echo "$lastline" | /usr/bin/cut -d ' ' -f 4) # skip 'error:', full msg with cut -d ' ' -f 4-
        coinwatch_str=$(echo -e "$1 $(printf '%*.*s' 0 $((price_padlength - ${#1})) "$pad") error in $msg")
    fi

    delta=$(date2delta "$stamp")
    echo -e " $coinwatch_str $(printf '%*.*s' 0 $((padlength - ${#coinwatch_str})) "$pad") [$delta]"
}


for c in $CURRENCIES
do
    echo "$c"
    for e in ${EXCHANGES_TABLE[$c]}
    do
        exchange_status $e
    done
done

exit 0
