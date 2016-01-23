Coinorama
=========

What is Coinorama ?
-------------------
Coinorama is a monitoring framework for Bitcoin markets, network and blockchain.
It's been active since May 2013 as Coinorama.net and released under GNU Affero GPL v3 in 2016.

The framework includes : data collection tools, database for timeseries and a web frontend.


License
-------

Coinorama is Copyright (c) 2013-2016 Nicolas BENOIT, released under the terms of the GNU Affero General Public License version 3.
See [COPYING](COPYING) for more information or see http://www.gnu.org/licenses/.

The web frontend distribution comes with : JQuery and Flot (a Javascript plotting library for jQuery) :
 * JQuery is Copyright (c) 2012 jQuery Foundation and other contributors, released under the MIT license.
 * Flot is Copyright (c) 2007-2014 IOLA and Ole Laursen, released under the MIT license.


Installation
------------

Dependencies are the following :
 * lighttpd
 * glib-2.0
 * python 2.7
 * bitcoind (for network/blocks data)

After unpacking the distribution tarball :
```sh
$ ./configure # add '-o' to enable compiler's optimizations
$ make
$ make install
```
The installation will be performed in the current directory, copying all necessary tools in a 'bin/' directory.


Running
-------

The framework can be managed using a single script : *bin/coinorama*

Have a look at this script (or call it without any argument) to get its syntax.

Most settings are located in [conf/coinorama.conf](conf/coinorama.conf).
Check out this file and fill in the markets you would like to monitor.
Check-out the content of [src/markets/watcher/](src/markets/watcher/) to find out which markets have a watcher.

### Markets
To start collecting market data (for example bitstamp USD market) :
```sh
$ ./bin/coinorama watcher bitstampUSD start  # start collecting data
$ ./bin/coinorama watcher bitstampUSD log    # inspect log
$ ./bin/coinorama watcher bitstampUSD status # check watcher status
$ ./bin/coinorama watcher bitstampUSD stop   # stop collecting data
```

You may also use the *markets* keyword to process all markets declared in the configuration file : 
```sh
$ ./bin/coinorama watcher markets start     # start collecting data for all markets
```

If you're looking for Coinorama.net's historical data, get it from : http://openair.free.fr/coinorama-20160119/

Once you have collected a few minutes of data, you may start the markets database service :
```sh
$ ./bin/coinorama coinrefd start
```

### Blockchain
Before starting the collection of blockchain data, update the *bin/watcher-blockchain.py* file with the RPC password configured for your Bitcoind.
Please note that you will also need to enable Bitcoind txindex to have accurate TX data.

You may download an initial data file from : http://nbenoit.tuxfamily.org/projects/coinorama/blockchain.csv.gz

Uncompress it and rename/move it as *data/blockchain/data.csv*

To start collecting blockchain data :
```sh
$ ./bin/coinorama watcher blockchain start
```

When the initial dataset is empty, it may require many hours of processing before actually reaching the current block.
In addition, the hashrate estimation may be broken given that timestamp of past blocks is not properly set.

Once you're ready, you may start the network/blockchain database service :
```sh
$ ./bin/coinorama chainrefd start
```

Note that the blockchain monitoring services (watcher & database) are not mandatory to have a working Coinorama.
However, you will be nagged from times to times that the blockchain data cannot be fetched.

### Web frontend
The web frontend relies on Ajax to get updated data from the databases, while databases are connected to the web server through SCGI.

A localhost configuration for lighttpd is included in 'conf/lighttpd.conf'. It can be started with :
```sh
$ ./bin/coinorama lighttpd start
```

When all the steps above are OK, open your web browser : http://localhost:8080/coinorama
