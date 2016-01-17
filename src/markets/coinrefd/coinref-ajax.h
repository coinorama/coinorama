/*
 * coinref-ajax.h
 *
 * This file is distributed as part of Coinorama
 *
 * Copyright (c) 2013-2016 Nicolas BENOIT
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU Affero General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 *
 * This program is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
 * GNU Affero General Public License for more details.
 *
 * You should have received a copy of the GNU Affero General Public License
 * along with this program.  If not, see <http://www.gnu.org/licenses/>.
 */

#ifndef __COINREF_AJAX_H__
#define __COINREF_AJAX_H__

#define AJAX_QUEUE_SIZE   64
#define AJAX_REQUEST_SIZE 1024*3

#define COINREF_AJAX_HEAD "{"
#define COINREF_AJAX_DATA_HEAD "\"data\":["
#define COINREF_AJAX_DATA_FOOT "],"
#define COINREF_AJAX_FULL_OK   "\"f\":1,"
#define COINREF_AJAX_FULL_REJ  "\"f\":0,"
#define COINREF_AJAX_FOOT "}\n"


#include "coinref-store.h"


struct ajax_worker_st;
typedef struct ajax_worker_st ajax_worker;

struct ajax_worker_st
{
  guint uid;
  GIOChannel *server_chan;
  gint server_socket;
  GSource *server_src;
  GMainContext *context;
  GMainLoop *mainloop;
  GThread *thread;
  guint nb_requests;
};

ajax_worker *ajax_worker_new ( guint );
void ajax_worker_free ( ajax_worker * );
void ajax_worker_shutdown ( ajax_worker * );


#endif
