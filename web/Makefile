#
# Coinorama : Makefile for web components
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

CLOSURE=1

# JS compiler calls
ifeq ($(CLOSURE),1)

JSC=closure
JSFLAGS=" --third_party" # --compilation_level ADVANCED_OPTIMIZATIONS" --language_in ECMASCRIPT6
define jscompile
	@echo " JSC $1"
	@$(JSC) $(JSFLAGS) --js js/$1 --js_output_file $2/$1
endef

else

JSC=yui-compressor
JSFLAGS=
define jscompile
	@echo " JSC $1"
	@$(JSC) $(JSFLAGS) js/$1 -o $2/$1
endef

endif


define jslinter
	@echo " LTR $1"
	@gjslint --max_line_length 180 --jslint_error all --disable 0001,0002,0006,0220 js/$1
endef


all: coinorama.js coinorama.ui.js coinorama.markets.js coinorama.markets.alerts.js coinorama.network.js coinorama.blocks.js

linter:
	$(call jslinter,coinorama.js);
	$(call jslinter,coinorama.ui.js);
	$(call jslinter,coinorama.markets.js);
	$(call jslinter,coinorama.markets.alerts.js);
	$(call jslinter,coinorama.network.js);
	$(call jslinter,coinorama.blocks.js);

coinorama.js: js/coinorama.js
	$(call jscompile,coinorama.js,.);
coinorama.ui.js: js/coinorama.ui.js
	$(call jscompile,coinorama.ui.js,.);
coinorama.markets.js: js/coinorama.markets.js
	$(call jscompile,coinorama.markets.js,.);
coinorama.markets.alerts.js: js/coinorama.markets.alerts.js
	$(call jscompile,coinorama.markets.alerts.js,.);
coinorama.network.js: js/coinorama.network.js
	$(call jscompile,coinorama.network.js,.);
coinorama.blocks.js: js/coinorama.blocks.js
	$(call jscompile,coinorama.blocks.js,.);

extern:
	$(call jscompile,jquery.flot.candlesticks.js,static)
	$(call jscompile,jquery.flot.fillarea.js,static)
	$(call jscompile,jquery.flot.fillbelow.js,static)
	$(call jscompile,jquery.flot.tooltip.js,static)


clean:
	@rm -f coinorama.js coinorama.ui.js coinorama.markets.js coinorama.markets.alerts.js coinorama.network.js coinorama.blocks.js
