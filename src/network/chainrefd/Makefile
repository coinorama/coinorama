#
# Makefile for chainrefd
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

ifeq ($(NO_PRUNING),1)
	CFLAGS+=-DWITHOUT_PRUNING
	LDFLAGS+=-DWITHOUT_PRUNING
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
BIN_chainrefd=chainrefd

all: $(BIN_chainrefd)

# shared object files
store.o: store.c store.h
	$(call ccompile,store.c);

view.o: view.c view.h store.h
	$(call ccompile,view.c);

ema.o: ema.c ema.h
	$(call ccompile,ema.c);

chainref-blockstore.o: chainref-blockstore.c chainref-blockstore.h chainref-utils.h
	$(call ccompile,chainref-blockstore.c);

chainref-blockview.o: chainref-blockview.c chainref-blockview.h chainref-blockstore.h ema.h chainref-utils.h
	$(call ccompile,chainref-blockview.c);

chainref-blockchain.o: chainref-blockchain.c chainref-blockchain.h chainref-blockstore.h chainref-blockview.h chainref-utils.h view.h store.h
	$(call ccompile,chainref-blockchain.c);

chainref-utils.o: chainref-utils.c chainref-utils.h
	$(call ccompile,chainref-utils.c);

chainref-ajax.o: chainref-ajax.c chainref-ajax.h chainref-blockstore.h chainref-blockview.h chainref-utils.h
	$(call ccompile,chainref-ajax.c);

# chainrefd
SRC_chainrefd=chainrefd.c chainref-blockstore.c chainref-blockview.c chainref-blockchain.c chainref-utils.c chainref-ajax.c store.c view.c ema.c
OBJ_chainrefd=$(SRC_chainrefd:.c=.o)

chainrefd.o: chainrefd.c chainrefd.h chainref-blockstore.h chainref-blockchain.h chainref-blockview.h chainref-ajax.h chainref-utils.h store.c view.c
	$(call ccompile,chainrefd.c);

$(BIN_chainrefd): $(OBJ_chainrefd)
	$(call clink,$(OBJ_chainrefd),$(BIN_chainrefd));


# distribution
dist: clean
	@( cd .. ; cp -r chainref chainref-$(TIMESTAMP) ; rm -rf chainref-$(TIMESTAMP)/.git; tar -c chainref-$(TIMESTAMP) | bzip2 --best > chainref-$(TIMESTAMP).tar.bz2 ; rm -rf chainref-$(TIMESTAMP) )

clean:
	@rm -f *~ *.o *.pyc *.pyo $(BIN_chainrefd)
