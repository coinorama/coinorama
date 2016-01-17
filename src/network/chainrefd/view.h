/*
 * view.h
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

#ifndef __VIEW_H__
#define __VIEW_H__


#include "store.h"


/* generalities */
struct vblock_st;
typedef struct vblock_st vblock;

struct view_st;
typedef struct view_st view;

/* viewblock */

#define VIEW_BLOCK_SIZE 512

#define VIEW_COLUMN_TIMESTAMP STORE_COLUMN_TIMESTAMP

struct vblock_st
{
  gdouble *data[VIEW_BLOCK_SIZE];
  guint nb_cols;
  guint next_line;   /* index of the next free line */
  vblock *next_block;
  vblock *prev_block;
};

vblock *vblock_new ( guint );
#define vblock_is_empty(B) (B->next_line==0)
#define vblock_is_full(B) (B->next_line>=VIEW_BLOCK_SIZE)
#define vblock_is_list_head(B) (B->prev_block==NULL)
#define vblock_is_list_tail(B) (B->next_block==NULL)
gboolean vblock_append ( vblock *, gdouble * );
void view_get_moving_tick ( view *, gdouble * );
void vblock_dump ( vblock *, FILE * );
void vblock_free ( vblock * );

void vblocks_list_clear ( vblock * );


/* view */
struct view_st
{
  gchar *name;
  store *store;

  guint nb_cols;
  GList *cols;

  gdouble length;
  gdouble precision;
  gdouble most_recent_entry;

  guint nb_entries;
  vblock *blocks_head;
  vblock *blocks_tail;

  gdouble *current_line;
  gdouble current_nb_values;
  gdouble *current_line_most_recent_data;

  GRWLock lock;
};

view *view_new ( store *, gdouble, gdouble );
void view_build ( view * );
void view_append_single_data ( view *, gdouble * );
void view_dump ( view *, FILE * );
void view_lookup_time ( view *, const gdouble, vblock **, gint * );
void view_write_json ( view *, gboolean, const gdouble, FILE * );
void view_free ( view * );


#endif
