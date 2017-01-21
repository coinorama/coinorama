/*
 * coinref-view.h
 *
 * This file is distributed as part of Coinorama
 *
 * Copyright (c) 2013-2017 Nicolas BENOIT
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

#ifndef __COINREF_VIEW_H__
#define __COINREF_VIEW_H__


#include "coinref-store.h"
#include "coinref-utils.h"


/* generalities */
struct viewblock_st;
typedef struct viewblock_st viewblock;

struct variance_st;
typedef struct variance_st variance;

struct ema_st;
typedef struct ema_st ema;

struct refview_st;
typedef struct refview_st refview;


/* supported view modes */
typedef enum view_mode_id_en
  {
    VIEW_MODE_SINGLE,
    VIEW_MODE_MULTI,
    VIEW_MODE_AVERAGE,
    NB_VIEW_MODES
  } view_mode_id ;

view_mode_id view_mode_lookup ( const gchar * );


/* supported view length */
typedef enum view_length_id_en
  {
    VIEW_LENGTH_10_MN,
    VIEW_LENGTH_1_H,
    VIEW_LENGTH_2_H,
    VIEW_LENGTH_4_H,
    VIEW_LENGTH_8_H,
    VIEW_LENGTH_12_H,
    VIEW_LENGTH_1_D,
    VIEW_LENGTH_3_D,
    VIEW_LENGTH_1_W,
    VIEW_LENGTH_2_W,
    VIEW_LENGTH_1_M,
    VIEW_LENGTH_3_M,
    VIEW_LENGTH_6_M,
    VIEW_LENGTH_1_Y,
    VIEW_LENGTH_2_Y,
    VIEW_LENGTH_4_Y,
    NB_VIEW_LENGTHS
  } view_length_id;

view_length_id view_length_lookup ( const gchar * );


/* viewblock */

#define VIEW_BLOCK_SIZE 256

enum viewblock_columns_en
  {
    VIEW_COLUMN_TIME,
    VIEW_COLUMN_PRICE,
    VIEW_COLUMN_SUM_ASKS,
    VIEW_COLUMN_SUM_BIDS,
    VIEW_COLUMN_VOLUME,
    VIEW_COLUMN_NB_TRADES,
    VIEW_COLUMN_LAG,
    VIEW_COLUMN_TOP_ASK,
    VIEW_COLUMN_TOP_BID,
    VIEW_COLUMN_USD_CONVRATE, /* the first columns must be the same as store blocks */
    VIEW_COLUMN_ATR,
    VIEW_COLUMN_RSI,
    VIEW_COLUMN_TSI,
    VIEW_COLUMN_OPEN,
    VIEW_COLUMN_CLOSE,
    VIEW_COLUMN_MIN,
    VIEW_COLUMN_MAX,
    VIEW_COLUMN_ADX_DMP,
    VIEW_COLUMN_ADX_DMN,
    VIEW_COLUMN_ADX,
    VIEW_COLUMN_VARIANCE7,
    VIEW_COLUMN_VARIANCE21,
    VIEW_COLUMN_EMA12,
    VIEW_COLUMN_EMA26,
    VIEW_COLUMN_MACD_EMA9,
    VIEW_COLUMN_TSI_EMA7,
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


/* ema */
struct ema_st
{
  guint N;
  gdouble k;
  gdouble k_inv;
  gdouble sum;
  gdouble current;
  gdouble previous;
};

ema *ema_new ( const guint );
gdouble ema_update ( ema *, const gdouble, const guint );
gdouble ema_estimate ( ema *, const gdouble, const guint );
void ema_free ( ema * );


/* variance */
struct variance_st
{
  guint N;
  guint idx;
  gdouble *buffer;
  gdouble sum;
  gdouble current;
};

variance *variance_new ( const guint );
gdouble variance_update ( variance *, const gdouble, const guint );
gdouble variance_estimate ( variance *, const gdouble, const guint );
void variance_free ( variance * );



/* refview */
struct refview_st
{
  refstore *store;

  gchar code;       /* single unique character to identify view */
  gchar *name;      /* string describing view length */
  gchar *name_prec; /* string describing view precision */

  gdouble length;
  gdouble precision;
  gdouble tick;
  gdouble tick_next;

  guint nb_entries; /* number of entries read by the view (no reset in case of pruning) */
  viewblock *blocks_head;
  viewblock *blocks_tail;

  viewblock *window_block;
  guint window_index;
  guint window_length;
  gdouble window_sum_price;
  gdouble window_sum_volume;

  gdouble current_line[VIEW_BLOCK_COLS];
  gdouble current_nb_values;
  gdouble current_line_most_recent_data[VIEW_BLOCK_COLS];

  ema *price_ema12;
  ema *price_ema26;
  ema *macd_ema9;

  ema *tr_ema14;

  ema *rsi_down_ema14;
  ema *rsi_up_ema14;

  ema *tsi_moment_ema25;
  ema *tsi_m_ema13;
  ema *tsi_abs_moment_ema25;
  ema *tsi_absm_ema13;
  ema *tsi_ema7;

  ema *adx_dmp_ema14;
  ema *adx_dmn_ema14;
  ema *adx_ema14;

  variance *variance7;
  variance *variance21;

  gdouble price_prev_high;
  gdouble price_prev_low;
  gdouble price_prev_close;

  jcache *cache_short;
  jcache *cache_short_full;
  jcache *cache_long;
  jcache *cache_long_full;

  GRWLock lock;
};

refview *refview_new ( refstore *, gchar, const gchar *, gdouble, const gchar *, gdouble );
void refview_write_config_json ( refview *, FILE * );
void refview_sync_floating_line ( refview *, gdouble * );
void refview_append_single_data_nolock ( refview *, gdouble * );
void refview_append_single_data ( refview *, gdouble * );
void refview_get_window_tick ( refview *, gdouble * );
void refview_dump ( refview *, FILE * );
void refview_lookup_time ( refview *, const gdouble, viewblock **, gint * );
void refview_write_json ( refview *, view_mode_id, gboolean, const gdouble, FILE * );
void refview_free ( refview * );


#endif
