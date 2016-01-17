#!/bin/bash
#
# Coinorama services & watchers control tool
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

if [ ! -d "$COINORAMA_LOG" ]; then
    mkdir -p "$COINORAMA_LOG"
fi

if [ -z "$SERVICES" ]; then
    echo "error: no services defined, does the configuration file exist ?"
    exit 1
fi

if [ -z "$EXCHANGES" ]; then
    echo "error: no exchanges defined, does the configuration file exist ?"
    exit 1
fi

# tool usage
function usage
{
    echo "usage: coinorama <service> <command>"
    echo " available services : $SERVICES watcher"
    echo " available watchers : blockchain $EXCHANGES"
    echo " available commands : start|stop|restart|status|log|rotate"
}

if [ $# -lt 1 ]
then
    usage
    exit 1
fi

     
# service actions
function start_service
{
    echo "starting $1"
    #export G_SLICE=always-malloc
    #export G_DEBUG=gc-friendly
    bin=$(which $1 2> /dev/null)
    if [ -z "$bin" ]
    then
        bin="$COINORAMA_BIN/$1"
    fi
    $bin --log="$COINORAMA_LOG/$1.log" --daemon
}

function stop_service
{
    echo "stopping $1"
    killall $1
}

function status_service
{
    pid=$(pgrep -x $1)
    if [ -z "$pid" ]
    then
        echo "$1: stopped"
    else
        echo "$1: running (pid=$pid)"
    fi
}

function log_service
{
    echo "==> log of service $1 <=="
    tail -f -n 8 "$COINORAMA_LOG/$1.log"
}

function rotate_service
{
    stop_service $1
    sleep 2
    echo "rotating $1"
    mv "$COINORAMA_LOG/$1.log" "$COINORAMA_LOG/$1.log.1"
    tail -n 8 "$COINORAMA_LOG/$1.log.1" > "$COINORAMA_LOG/$1.log"
    start_service $1
    xz --best "$COINORAMA_LOG/$1.log.1"
}


# lighttpd actions (provided for local testing)
function start_lighttpd
{
    echo "starting lighttpd"
    bin=$(which lighttpd 2> /dev/null)
    if [ -z "$bin" ]
    then
        bin="/opt/lighttpd/sbin/lighttpd"
    fi
    webpath="$PWD/web"
    if [ -n "$COINORAMA_WWW" ]; then
        if [[ "$COINORAMA_WWW" = /* ]]; then
            webpath="$COINORAMA_WWW"
        else
            webpath="$PWD/$COINORAMA_WWW"
        fi
    fi
    mkdir /tmp/www-coinorama
    ln -s $webpath /tmp/www-coinorama/coinorama
    if [ -n "$COINORAMA_HOME" ]; then
        $bin -f "$COINORAMA_HOME/conf/lighttpd.conf"
    elif [ -f "conf/coinorama.conf" ]; then
        $bin -f "conf/lighttpd.conf"
    else
        echo "error: no lighttpd configuration found"
        exit 1
    fi
}

function stop_lighttpd
{
    stop_service "lighttpd"
    rm -f /tmp/lighttpd.log
    rm -f /tmp/www-coinorama/coinorama
    rmdir /tmp/www-coinorama
}

function status_lighttpd
{
    status_service "lighttpd"
}

function log_lighttpd
{
    echo "==> log of lighttpd <=="
    tail -f -n 8 "/tmp/lighttpd.log"
}


# watcher actions
function start_watcher
{
    if [ ! -z "$2" ]
    then
        msg="with extra option $2"
    fi
    echo "starting $1 watcher $msg"
    bin=$(which watcher-$1.py 2> /dev/null)
    if [ -z "$bin" ]
    then
        bin="$COINORAMA_BIN/watcher-$1.py"
    fi
    $bin --log="$COINORAMA_LOG/watcher-$1.log" --daemon $2
}

function stop_watcher
{
    echo "stopping $1 watcher"
    pid=$(pgrep -fla /usr/bin/python | grep watcher-$1.py | awk '{print $1}')
    if [ -z "$pid" ]
    then
        echo "error: $1 watcher seems already stopped"
    else
        kill $pid
    fi
}

function status_watcher
{
    pid=$(pgrep -fla /usr/bin/python | grep watcher-$1.py | awk '{print $1}')
    if [ -z "$pid" ]
    then
        echo "$1: stopped"
    else
        echo "$1: running (pid=$pid)"
    fi
}

function log_watcher
{
    echo "==> log of watcher $1 <=="
    tail -f -n 8 "$COINORAMA_LOG/watcher-$1.log"
}

function rotate_watcher
{
    stop_watcher $1
    sleep 2
    echo "rotating $1 watcher"
    mv "$COINORAMA_LOG/watcher-$1.log" "$COINORAMA_LOG/watcher-$1.log.1"
    tail -n 8 "$COINORAMA_LOG/watcher-$1.log.1" > "$COINORAMA_LOG/watcher-$1.log"
    start_watcher $1
    xz --best "$COINORAMA_LOG/watcher-$1.log.1"
}


# actions
function perform_action_on
{
    case $2 in
        start)
            start_$1 $3 $4
            ;;
        stop)
            stop_$1 $3
            ;;
        restart)
            stop_$1 $3
            sleep 1
            start_$1 $3 $4
            ;;
        status)
            status_$1 $3
            ;;
        log)
            log_$1 $3
            ;;
        rotate)
            rotate_$1 $3
            ;;
        *)
            usage
            exit 1
            ;;
    esac
}



# ALL SERVICES
if [ "$1" = "start" -o "$1" = "stop" -o "$1" = "restart" -o "$1" = "status" -o "$1" = "rotate" ]
then
    if [ $# -gt 1 ]
    then
        usage
        exit 1
    fi
       
    for s in $SERVICES
    do
        perform_action_on "service" "$1" "$s"
    done
    exit 0
elif [ "$1" = "monitor" ]
then
    mon=$(which coinorama-monitor 2> /dev/null)
    if [ -z "$mon" ]
    then
        mon="$COINORAMA_BIN/coinorama-monitor"
    fi
    watch -n 10 -t $mon
    exit 0
fi

# SPECIFIC SERVICE
for s in $SERVICES
do
    if [ "$1" = $s ]
    then
        perform_action_on "service" "$2" "$1"
        exit 0
    fi
done

# LIGHTTPD (provided for local testing)
if [ "$1" = "lighttpd" ]
then
    perform_action_on "lighttpd" "$2"
    exit 0
fi

# WATCHER
if [ "$1" = "watcher" ]
then
    watcher=""
    extra=""
    for e in $EXCHANGES blockchain markets
    do
        if [ "$2" = $e ]
        then
            watcher="$2"
            break
        fi
    done

    for e in $EXCHANGES_OFF
    do
        if [ "$2" = $e ]
        then
            watcher="$2"
            extra="--no-coinrefd"
            break
        fi
    done

    if [ -z $watcher ]
    then
        echo "error: unknown watcher $2"
        usage
        exit 1
    fi

    if [ "$watcher" = "markets" ]
    then
        for watcher in $EXCHANGES
        do
            perform_action_on "watcher" "$3" "$watcher" "$extra"
        done
    else
        perform_action_on "watcher" "$3" "$watcher" "$extra"
    fi
else
    echo "error: unknown service $1"
    usage
    exit 1
fi

exit 0
