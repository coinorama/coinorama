/*
 * coinref-book.h
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

#ifndef __COINREF_BOOK_H__
#define __COINREF_BOOK_H__


/* generalities */
struct refbook_st;
typedef struct refbook_st refbook;


/* refbook */
struct refbook_st
{
  gchar *path_asks;
  gchar *path_bids;

  guint nb_asks_entries;
  gdouble *asks_rate;
  gdouble *asks_volume;

  guint nb_bids_entries;
  gdouble *bids_rate;
  gdouble *bids_volume;

  guint shadow_nb_asks_entries;
  gdouble *shadow_asks_rate;
  gdouble *shadow_asks_volume;

  guint shadow_nb_bids_entries;
  gdouble *shadow_bids_rate;
  gdouble *shadow_bids_volume;

  GRWLock lock;

  time_t epoch;  /* timestamp of last update */
};

refbook *refbook_new ( gchar *, gchar * );
#ifdef _WITH_BOOK_STAMP
gboolean refbook_read_from_files ( refbook *, const gchar * );
#else
gboolean refbook_read_from_files ( refbook * );
#endif
void refbook_swap_shadow ( refbook * );
void refbook_dump ( refbook *, FILE * );
void refbook_write_json ( refbook *, FILE * );
void refbook_clear ( refbook * );
void refbook_free ( refbook * );


#endif
