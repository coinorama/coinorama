#
# Makefile for coinrefd
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

CC=gcc

DIR=`pwd`

GLIB_CFLAGS=`pkg-config --cflags glib-2.0 gthread-2.0`
GLIB_LDFLAGS=`pkg-config --libs glib-2.0 gthread-2.0`

CFLAGS=-ansi -Wall -fstack-protector-all
LDFLAGS=-lm

TIMESTAMP=`date +%-Y%m%d%H%M%S`

include Makefile.conf

ifeq ($(OPTIMIZE),1)
	CFLAGS+=-O3 -s -march=native
else
	CFLAGS+=-g
endif

CFLAGS+=-DNB_LOADERS=$(NB_THREADS)

ifeq ($(GZIP_PACKS),1)
	CFLAGS+=-D_WITH_STORE_GZIP_PACKS
	LDFLAGS+=-lz
endif

ifeq ($(NO_PRUNING),1)
	CFLAGS+=-D_WITHOUT_PRUNING
endif

ifeq ($(PROFILE),1)
	CFLAGS+=-pg
	LDFLAGS+=-pg
endif

# C compiler calls
define ccompile
	@echo " CC $1"
	@$(CC) $(CFLAGS) $(GLIB_CFLAGS) -c $1
endef

define clink
	@echo " LD $2"
	@$(CC) -o $2 $1 $(LDFLAGS) $(GLIB_LDFLAGS)
endef


# makefile content
BIN_coinrefd=coinrefd

all: $(BIN_coinrefd)

# shared object files
coinref-store.o: coinref-store.c coinref-store.h coinref-utils.h
	$(call ccompile,coinref-store.c);

coinref-book.o: coinref-book.c coinref-book.h coinref-utils.h
	$(call ccompile,coinref-book.c);

coinref-view.o: coinref-view.c coinref-view.h coinref-store.h coinref-utils.h
	$(call ccompile,coinref-view.c);

coinref-exchange.o: coinref-exchange.c coinref-exchange.h coinref-store.h coinref-book.h coinref-view.h coinref-utils.h
	$(call ccompile,coinref-exchange.c);

coinref-utils.o: coinref-utils.c coinref-utils.h
	$(call ccompile,coinref-utils.c);

coinref-ajax.o: coinref-ajax.c coinref-ajax.h coinref-store.h coinref-view.h coinref-exchange.h coinref-utils.h
	$(call ccompile,coinref-ajax.c);

# coinrefd
SRC_coinrefd=coinrefd.c coinref-store.c coinref-book.c coinref-view.c coinref-exchange.c coinref-utils.c coinref-ajax.c
OBJ_coinrefd=$(SRC_coinrefd:.c=.o)

coinrefd.o: coinrefd.c coinrefd.h coinref-store.h coinref-book.h coinref-view.h coinref-exchange.h coinref-ajax.h coinref-utils.h
	$(call ccompile,coinrefd.c);

$(BIN_coinrefd): $(OBJ_coinrefd)
	$(call clink,$(OBJ_coinrefd),$(BIN_coinrefd));


# distribution
dist: clean
	@( cd .. ; cp -r coinref coinref-$(TIMESTAMP) ; rm -rf coinref-$(TIMESTAMP)/.git; tar -c coinref-$(TIMESTAMP) | bzip2 --best > coinref-$(TIMESTAMP).tar.bz2 ; rm -rf coinref-$(TIMESTAMP) )

clean:
	@rm -f *~ *.o *.pyc *.pyo $(BIN_coinrefd) $(BIN_coinref)
