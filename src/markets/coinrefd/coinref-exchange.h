/*
 * coinref-exchange.h
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

#ifndef __COINREF_EXCHANGE_H__
#define __COINREF_EXCHANGE_H__


#include "coinref-store.h"
#include "coinref-book.h"
#include "coinref-view.h"


/* generalities */
struct exchange_st;
typedef struct exchange_st exchange;


/* exchange */
struct exchange_st
{
  guint uid;
  gchar *name;
  gchar *desc;
  gchar *path;
  refstore *store;
  refbook *book;
  refview *views[NB_VIEW_LENGTHS];
  jcache *cache_ticker;
};

exchange *exchange_new ( const guint, const gchar *, const gchar *, const gchar * );
void exchange_append_single_data ( exchange *, gdouble * );
#ifdef _WITH_BOOK_STAMP
void exchange_read_new_book ( exchange *, const gchar * );
#else
void exchange_read_new_book ( exchange * );
#endif
void exchange_write_json ( exchange *, view_mode_id, view_length_id, gboolean, gboolean, const gdouble, FILE * );
void exchange_write_json_ticker ( exchange *, FILE * );
void exchange_free ( exchange * );


/* exchanges array */

#define EXCH_NB_MAX 64
extern exchange *EXCHANGES[EXCH_NB_MAX];

gboolean exchanges_load ( void );
gdouble exchanges_get_stats ( void );

void exchanges_write_json_config ( FILE * );
void exchanges_write_json_ticker ( FILE * );

exchange *exchanges_lookup_by_name ( const gchar * );
exchange *exchanges_lookup_by_uid ( const gchar * );

#define EXCH_NB_MAX_MULTI 5
gint exchanges_lookup_multi_by_uid ( const gchar *, exchange ** );

void exchanges_free ( void );

#endif
