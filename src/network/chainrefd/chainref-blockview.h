/*
 * chainref-blockview.h
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

#ifndef __CHAINREF_BLOCKVIEW_H__
#define __CHAINREF_BLOCKVIEW_H__


#include "chainref-blockstore.h"
#include "chainref-utils.h"
#include "ema.h"


/* generalities */
struct viewblock_st;
typedef struct viewblock_st viewblock;

struct refview_st;
typedef struct refview_st refview;


/* supported view length */
typedef enum view_length_id_en
  {
    VIEW_LENGTH_PER_BLOCK,
    VIEW_LENGTH_1_D,
    VIEW_LENGTH_1_W,
    VIEW_LENGTH_1_M,
    VIEW_LENGTH_3_M,
    VIEW_LENGTH_6_M,
    VIEW_LENGTH_1_Y,
    VIEW_LENGTH_2_Y,
    VIEW_LENGTH_4_Y,
    VIEW_LENGTH_ALL,
    NB_VIEW_LENGTHS
  } view_length_id;

view_length_id view_length_lookup ( const gchar * );

#define VIEW_ALL_LIMIT 20 /* this is an artificially high limit (20 years) for view of length ALL */


/* viewblock */

#define VIEW_BLOCK_SIZE 512

enum viewblock_columns_en
  {
    VIEW_COLUMN_FIRST_BLOCK_ID,
    VIEW_COLUMN_TIME,
    VIEW_COLUMN_DIFFICULTY,
    VIEW_COLUMN_VERSION,
    VIEW_COLUMN_SIZE,
    VIEW_COLUMN_NB_TX,
    VIEW_COLUMN_VOLUME,
    VIEW_COLUMN_FEES,
    VIEW_COLUMN_MEMPOOL_SIZE,
    VIEW_COLUMN_MEMPOOL_MAX_SIZE, /* the first columns must be the same as store blocks */
    VIEW_COLUMN_NB_BLOCKS,
    VIEW_COLUMN_WORK,       /* this is the amount of time spent mining those NB_BLOCKS */
    VIEW_COLUMN_HASHRATE,
    VIEW_COLUMN_VERSION_EMA,
    VIEW_COLUMN_SIZE_MAX,
    VIEW_COLUMN_SIZE_EMA,
    VIEW_COLUMN_NB_TX_EMA,
    VIEW_COLUMN_NB_TX_TOTAL,
    VIEW_COLUMN_VOLUME_EMA,
    VIEW_COLUMN_FEES_EMA,
    VIEW_COLUMN_NB_BLOCKS_EMA,
    VIEW_COLUMN_WORK_EMA,
    VIEW_COLUMN_HASHRATE_EMA,
    VIEW_BLOCK_COLS
 };

struct viewblock_st
{
  gdouble data[VIEW_BLOCK_SIZE][VIEW_BLOCK_COLS];
  guint next_line;   /* index of the next free line */
  viewblock *next_block;
  viewblock *prev_block;
};

viewblock *viewblock_new ( void );
#define viewblock_is_empty(B) (B->next_line==0)
#define viewblock_is_full(B) (B->next_line>=VIEW_BLOCK_SIZE)
#define viewblock_is_list_head(B) (B->prev_block==NULL)
#define viewblock_is_list_tail(B) (B->next_block==NULL)
gboolean viewblock_append ( viewblock *, gdouble * );
void refview_get_moving_tick ( refview *, gdouble * );
void viewblock_dump ( viewblock *, FILE * );
void viewblock_free ( viewblock * );

void viewblocks_list_clear ( viewblock * );


/* refview */
struct refview_st
{
  gchar *name;
  refstore *store;

  gdouble length;
  gdouble precision;
  gdouble tick;
  gdouble tick_next;

  guint nb_entries;
  viewblock *blocks_head;
  viewblock *blocks_tail;

  viewblock *window_block;
  guint window_index;
  guint window_length;
  gdouble window_sum_nb_tx;

  gdouble *window_diff;
  guint window_diff_length;
  guint window_diff_start;
  guint window_diff_current;

  gdouble current_line[VIEW_BLOCK_COLS];
  gdouble current_nb_values;
  gdouble current_line_most_recent_data[VIEW_BLOCK_COLS];

  long double diff_sum;

  ema *version_ema;
  ema *size_ema;
  ema *nb_tx_ema;
  ema *volume_ema;
  ema *fees_ema;
  ema *nb_blocks_ema;
  ema *work_ema;
  mavg *hashrate_mavg;
  ema *hashrate_ema;

  jcache *cache;
  jcache *cache_full;

  GRWLock lock;
};

refview *refview_new ( refstore *, const gdouble, const gdouble, const gdouble, const gdouble );
void refview_sync_floating_line ( refview *, gdouble * );
void refview_append_single_data_nolock ( refview *, gdouble * );
void refview_append_single_data ( refview *, gdouble * );
void refview_dump ( refview *, FILE * );
void refview_lookup_time ( refview *, const gdouble, viewblock **, gint * );
void refview_write_json ( refview *, gboolean, const gdouble, FILE * );
void refview_free ( refview * );


#endif
