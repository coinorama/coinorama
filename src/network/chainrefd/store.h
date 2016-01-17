/*
 * store.h
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

#ifndef __STORE_H__
#define __STORE_H__


/* generalities */
struct block_st;
typedef struct block_st block;

struct store_st;
typedef struct store_st store;


/* block */

#define STORE_BLOCK_SIZE 512

#define STORE_MAX_NB_COLS 512
#define STORE_COLUMN_TIMESTAMP 0

struct block_st
{
  gdouble *data[STORE_BLOCK_SIZE];
  guint nb_cols;
  guint next_line;   /* index of the next free line */
  block *next_block;
  block *prev_block;
};

block *block_new ( const guint );
#define block_is_empty(B) (B->next_line==0)
#define block_is_full(B) (B->next_line>=STORE_BLOCK_SIZE)
#define block_is_list_head(B) (B->prev_block==NULL)
#define block_is_list_tail(B) (B->next_block==NULL)
gboolean block_append ( block *, gdouble * );
void block_generate_data_from_text ( gchar *, gdouble *, const guint );
guint block_load_from_text ( block *, gchar *, gchar **, guint );
void block_dump ( block *, FILE * );
void block_free ( block * );

void blocks_list_clear ( block * );


/* store */
struct store_st
{
  gchar *config;
  gchar *path;

  guint nb_cols;
  GList *cols;

  guint nb_entries;
  block *blocks_head;
  block *blocks_tail;

  GRWLock lock;
  gdouble *most_recent_data;

  time_t epoch;  /* timestamp of last update */
};

store *store_new ( const gchar *, const gchar * );
gboolean store_read_config ( store * );

typedef void (*store_line_process_func) ( gpointer, gdouble * );
gboolean store_process_input_file ( store *, store_line_process_func, gpointer );

gboolean store_read_from_file ( store * );
void store_dump ( store *, FILE * );
void store_append_single_data ( store *, gdouble * );
void store_get_most_recent_data ( store *, gdouble * );
void store_write_most_recent_data_json ( store *, const gdouble, FILE * );
gint store_get_last_data ( store *, gdouble * );
void store_clear ( store *, gboolean );
void store_free ( store * );


#endif
