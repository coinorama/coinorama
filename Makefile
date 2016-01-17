#
# Coinorama : Root Makefile
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


include conf/coinorama.conf

all: compile

compile: conf/coinorama.conf
	@make -C src/markets/coinrefd
	@make -C src/network/chainrefd

clean:
	@make -C src/markets/coinrefd clean
	@make -C src/network/chainrefd clean

distclean: clean
	@rm -f bin/coinrefd
	@rm -f bin/chainrefd
	@rm -f bin/coinorama
	@rm -f bin/coinorama-monitor
	@rm -f bin/*.py bin/*.pyc

install: src/utils/coinorama.sh src/utils/coinorama-monitor.sh conf/coinorama.conf
	@mkdir -p $(COINORAMA_BIN)
	@cp -f src/markets/coinrefd/coinrefd $(COINORAMA_BIN)
	@cp -f src/network/chainrefd/chainrefd $(COINORAMA_BIN)
	@cp -f src/utils/coinorama.sh $(join $(COINORAMA_BIN),"/coinorama")
	@cp -f src/utils/coinorama-monitor.sh $(join $(COINORAMA_BIN),"/coinorama-monitor")
	@cp -f src/markets/watcher/coinwatcher.py $(COINORAMA_BIN)
	@for exch in `echo $(EXCHANGES)` ; do \
		cp -f src/markets/watcher/watcher-$$exch.py $(COINORAMA_BIN) ; \
	done
	@cp -f src/network/watcher/authproxy.py $(COINORAMA_BIN)
	@cp -f src/network/watcher/watcher-blockchain.py $(COINORAMA_BIN)
