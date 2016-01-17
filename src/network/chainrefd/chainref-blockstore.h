/*
 * chainref-blockstore.h
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

#ifndef __CHAINREF_BLOCKSTORE_H__
#define __CHAINREF_BLOCKSTORE_H__


/* generalities */
struct refblock_st;
typedef struct refblock_st refblock;

struct refstore_st;
typedef struct refstore_st refstore;


/* refblock */

#define STORE_BLOCK_SIZE 512

enum block_columns_en
  {
    STORE_COLUMN_UID,
    STORE_COLUMN_TIME,
    STORE_COLUMN_DIFFICULTY,
    STORE_COLUMN_VERSION,
    STORE_COLUMN_SIZE,
    STORE_COLUMN_NB_TX,
    STORE_COLUMN_VOLUME,
    STORE_COLUMN_FEES,
    STORE_COLUMN_MEMPOOL_SIZE,
    STORE_COLUMN_MEMPOOL_MAX_SIZE,
    STORE_BLOCK_COLS
 };

struct refblock_st
{
  gdouble data[STORE_BLOCK_SIZE][STORE_BLOCK_COLS];
  guint next_line;   /* index of the next free line */
  refblock *next_block;
  refblock *prev_block;
};

refblock *refblock_new ( void );
#define refblock_is_empty(B) (B->next_line==0)
#define refblock_is_full(B) (B->next_line>=STORE_BLOCK_SIZE)
#define refblock_is_list_head(B) (B->prev_block==NULL)
#define refblock_is_list_tail(B) (B->next_block==NULL)
gboolean refblock_append ( refblock *, gdouble * );
void refblock_generate_data_from_text ( gchar *, gdouble * );
guint refblock_load_from_text ( refblock *, gchar *, gchar **, guint );
void refblock_dump ( refblock *, FILE * );
void refblock_free ( refblock * );

void refblocks_list_clear ( refblock * );


/* refstore */
struct refstore_st
{
  gchar *path;

  guint nb_entries;
  refblock *blocks_head;
  refblock *blocks_tail;

  GRWLock lock;
  gdouble most_recent_data[STORE_BLOCK_COLS];

  time_t epoch;  /* timestamp of last update */
};

refstore *refstore_new ( gchar * );
gboolean refstore_read_from_file ( refstore * );
void refstore_dump ( refstore *, FILE * );
void refstore_append_single_data ( refstore *, gdouble * );
void refstore_get_most_recent_data ( refstore *, gdouble * );
gint refstore_get_last_data ( refstore *, gdouble * );
void refstore_clear ( refstore *, gboolean );
void refstore_free ( refstore * );


#endif
