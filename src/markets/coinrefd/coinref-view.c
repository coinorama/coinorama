/*
 * coinref-view.c
 *
 * Database view for coinref.
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


#include <stdlib.h>
#include <stdio.h>
#include <string.h>
#include <unistd.h>
#include <strings.h>
#include <errno.h>
#include <math.h>
#include <glib.h>
#include <glib/gprintf.h>

#include "coinref-utils.h"
#include "coinref-view.h"


/*
 * viewblock
 */

/*
 * viewblock_new
 * todo: use glib memory pool
 */
viewblock *
viewblock_new ( void )
{
  viewblock *b = g_malloc ( sizeof(viewblock) );
  b->next_line = 0;
  b->next_block = NULL;
  b->prev_block = NULL;
  return b;
}


/*
 * viewblock_append
 */
gboolean
viewblock_append ( viewblock *b,
                   gdouble *data )
{
  memcpy ( &(b->data[b->next_line]), data, sizeof(gdouble)*VIEW_BLOCK_COLS );
  b->next_line++;
  return FALSE;
}


/*
 * viewblock_dump
 */
void
viewblock_dump ( viewblock *b,
                 FILE *f )
{
  guint i, j;

  for ( i=0; i<b->next_line; ++i )
    {
      for ( j=0; j<(VIEW_BLOCK_COLS-1); ++j )
        fprintf ( f, "%f ", b->data[i][j] );
      fprintf ( f, "%f\n ", b->data[i][j] );
    }
}


/*
 * viewblock_free
 */
void
viewblock_free ( viewblock *b )
{
  g_free ( b );
}


/*
 * viewblocks list utils
 */

void
viewblocks_list_clear ( viewblock *head )
{
  viewblock *next;

  while ( head != NULL )
    {
      next = head->next_block;
      viewblock_free ( head );
      head = next;
    }
}



/* views */

/*
 * view_mode_lookup
 */
view_mode_id
view_mode_lookup ( const gchar *name )
{
  view_mode_id mid;

  switch ( name[0] )
    {
      case 'c':
        mid = VIEW_MODE_MULTI;
        break;

      case 'v':
        mid = VIEW_MODE_AVERAGE;
        break;

      case 's':
      default:
        mid = VIEW_MODE_SINGLE;
        break;
    }

  return mid;
}


/*
 * view_length_lookup
 */
view_length_id
view_length_lookup ( const gchar *name )
{
  view_length_id lid = VIEW_LENGTH_8_H;

  switch ( name[0] )
    {
      case 't':
        lid = VIEW_LENGTH_10_MN;
        break;

      case 'h':
        lid = VIEW_LENGTH_1_H;
        break;

      case 'a':
        lid = VIEW_LENGTH_2_H;
        break;

      case 'o':
        lid = VIEW_LENGTH_4_H;
        break;

      case 's':
        lid = VIEW_LENGTH_8_H;
        break;

      case 'n':
        lid = VIEW_LENGTH_12_H;
        break;

      case 'd':
        lid = VIEW_LENGTH_1_D;
        break;

      case 'r':
        lid = VIEW_LENGTH_3_D;
        break;

      case 'w':
        lid = VIEW_LENGTH_1_W;
        break;

      case 'q':
        lid = VIEW_LENGTH_2_W;
        break;

      case 'm':
        lid = VIEW_LENGTH_1_M;
        break;

      case 'e':
        lid = VIEW_LENGTH_3_M;
        break;

      case 'b':
        lid = VIEW_LENGTH_6_M;
        break;

      case 'y':
        lid = VIEW_LENGTH_1_Y;
        break;

      case 'z':
        lid = VIEW_LENGTH_2_Y;
        break;

      case 'f':
        lid = VIEW_LENGTH_4_Y;
        break;

      default:
        break;
    }

  return lid;
}



/* variance */

/*
 * variance_new
 */
variance *
variance_new ( const guint N )
{
  variance *v;

  v = (variance *) g_malloc ( sizeof(variance) );

  v->N = N;
  v->buffer = (gdouble *) g_malloc ( sizeof(gdouble) * N );
  bzero ( v->buffer, N * sizeof(gdouble) );

  v->idx = 0;
  v->sum = 0;
  v->current = 0;

  return v;
}


/*
 * variance_update
 */

static gdouble
_variance_compute ( variance *v )
{
  guint i;
  gdouble avg;
  gdouble delta_sum = 0;

  avg = v->sum / ((gdouble) v->N);

  for ( i=0; i<v->N; ++i )
    delta_sum += ( (avg - v->buffer[i]) * (avg - v->buffer[i]));

  return ( delta_sum / ((gdouble) v->N) );
}

gdouble
variance_update ( variance *v,
                  const gdouble val,
                  const guint nb_vals )
{
  v->sum -= v->buffer[v->idx];
  v->sum += val;
  v->buffer[v->idx] = val;

  v->current = _variance_compute ( v );

  v->idx++;
  if ( v->idx >= v->N )
    v->idx = 0;

  return v->current;
}


/*
 * variance_estimate
 */
gdouble
variance_estimate ( variance *v,
                    const gdouble val,
                    const guint nb_vals )
{
  gdouble var;
  gdouble prev;
  gdouble prev_sum;

  prev = v->buffer[v->idx];
  prev_sum = v->sum;

  v->buffer[v->idx] = val;
  v->sum += (val-prev);

  var = _variance_compute ( v );

  v->sum = prev_sum;
  v->buffer[v->idx] = prev;

  return var;
}


/*
 * variance_free
 */
void
variance_free ( variance *v )
{
  g_free ( v->buffer );
  g_free ( v );
}


/* ema */

/*
 * ema_new
 */
ema *
ema_new ( const guint N )
{
  ema *ma;

  ma = (ema *) g_malloc ( sizeof(ema) );

  ma->N = N;
  ma->k = 2 / ((gdouble) (N + 1 ));
  ma->k_inv = 1 - ma->k;
  ma->sum = 0;
  ma->current = 0;
  ma->previous = 0;

  return ma;
}


/*
 * ema_update
 */
gdouble
ema_update ( ema *ma,
             const gdouble val,
             const guint nb_vals )
{
  ma->previous = ma->current;

  if ( nb_vals < ma->N )
    {
      ma->sum += val;
      ma->current = ma->sum / ((gdouble) (nb_vals+1));
      return ma->current;
    }

  ma->current = (val*ma->k) + (ma->previous*ma->k_inv);
  return ma->current;
}


/*
 * ema_estimate
 */
gdouble
ema_estimate ( ema *ma,
               const gdouble val,
               const guint nb_vals )
{
  if ( nb_vals < ma->N )
    return (ma->sum+val) / ((gdouble) (nb_vals+1));

  return (val*ma->k) + (ma->current*ma->k_inv);
}


/*
 * ema_free
 */
void
ema_free ( ema *ma )
{
  g_free ( ma );
}



/* refview */

/*
 * refview_new
 */
refview *
refview_new ( refstore *store,
              gchar code,
              const gchar *name,
              gdouble length,
              const gchar *name_prec,
              gdouble precision )
{
  refview *rv;

  rv = (refview *) g_malloc ( sizeof(refview) );

  rv->store = store;

  rv->code = code;
  rv->name = g_strdup ( name );
  rv->name_prec = g_strdup ( name_prec );

  rv->length = length;
  rv->precision = precision;

  rv->nb_entries = 0;

  rv->price_ema12 = ema_new ( 12 );
  rv->price_ema26 = ema_new ( 26 );
  rv->macd_ema9 = ema_new ( 9 );

  rv->tr_ema14 = ema_new ( 14 );

  rv->rsi_down_ema14 = ema_new ( 14 );
  rv->rsi_up_ema14 = ema_new ( 14 );

  rv->tsi_moment_ema25 = ema_new ( 25 );
  rv->tsi_m_ema13 = ema_new ( 13 );
  rv->tsi_abs_moment_ema25 = ema_new ( 25 );
  rv->tsi_absm_ema13 = ema_new ( 13 );
  rv->tsi_ema7 = ema_new ( 7 );

  rv->adx_dmp_ema14 = ema_new ( 14 );
  rv->adx_dmn_ema14 = ema_new ( 14 );
  rv->adx_ema14 = ema_new ( 14 );

  rv->variance7 = variance_new ( 7 );
  rv->variance21 = variance_new ( 21 );

  /*expected number of entries : rv->nb_entries = 1 + (guint) ceil(length/precision);*/

  g_rw_lock_init ( &(rv->lock) );

  rv->blocks_head = viewblock_new ( );
  rv->blocks_tail = rv->blocks_head;

  rv->window_block = rv->blocks_head;
  rv->window_index = 0;
  rv->window_length = 0;
  rv->window_sum_price = 0;
  rv->window_sum_volume = 0;

  rv->nb_entries = 0;
  rv->current_nb_values = 0;

  rv->tick = 0;
  rv->tick_next = 0;

  bzero ( rv->current_line, VIEW_BLOCK_COLS * sizeof(gdouble) );
  rv->price_prev_high = 0;
  rv->price_prev_low = 0;
  rv->price_prev_close = 0;

  rv->cache_short = jcache_new ( 4*VIEW_BLOCK_COLS );
  rv->cache_short_full = jcache_new ( 256*VIEW_BLOCK_COLS );
  rv->cache_long = jcache_new ( 4*VIEW_BLOCK_COLS );
  rv->cache_long_full = jcache_new ( 256*VIEW_BLOCK_COLS );

  return rv;
}


/*
 * refview_write_config_json
 * writes a json description of a view (timing are converted to milliseconds)
 */
void
refview_write_config_json ( refview *rv,
                            FILE *f )
{
  fprintf ( f, "{"                                                   \
            "\"code\":\"%c\","                                       \
            "\"name\":\"%s\","                                       \
            "\"precname\":\"%s\","                                   \
            "\"length\":\%.0f,"                                      \
            "\"precision\":%.0f}",
            rv->code, rv->name, rv->name_prec, rv->length*1000, rv->precision*1000 );
}


/*
 * refview_sync_floating_line
 */
void
refview_sync_floating_line ( refview *rv,
                             gdouble *data )
{
  gdouble tmp;
  gdouble up, down;
  gdouble tr, atr;
  gdouble m, mabs;
  gdouble dm_n=0, dm_p=0;

  memcpy ( rv->current_line_most_recent_data, data, sizeof(gdouble)*STORE_BLOCK_COLS );
  rv->current_line_most_recent_data[VIEW_COLUMN_VOLUME] = rv->current_line[VIEW_COLUMN_VOLUME]; /* use accumulated value */
  rv->current_line_most_recent_data[VIEW_COLUMN_NB_TRADES] = rv->current_line[VIEW_COLUMN_NB_TRADES]; /* use accumulated value */
  rv->current_line_most_recent_data[VIEW_COLUMN_LAG] = rv->current_line[VIEW_COLUMN_LAG] / rv->current_nb_values; /* use averaged value */
  rv->current_line_most_recent_data[VIEW_COLUMN_OPEN] = rv->current_line[VIEW_COLUMN_OPEN];     /* use updated value */
  rv->current_line_most_recent_data[VIEW_COLUMN_CLOSE] = rv->current_line[VIEW_COLUMN_CLOSE];   /* use updated value */
  rv->current_line_most_recent_data[VIEW_COLUMN_MIN] = rv->current_line[VIEW_COLUMN_MIN];       /* use updated value */
  rv->current_line_most_recent_data[VIEW_COLUMN_MAX] = rv->current_line[VIEW_COLUMN_MAX];       /* use updated value */

  /* price EMAs */
  rv->current_line_most_recent_data[VIEW_COLUMN_EMA12] = ema_estimate ( rv->price_ema12, data[STORE_COLUMN_PRICE], rv->nb_entries );
  rv->current_line_most_recent_data[VIEW_COLUMN_EMA26] = ema_estimate ( rv->price_ema26, data[STORE_COLUMN_PRICE], rv->nb_entries );

  /* price MACD */
  tmp = rv->current_line_most_recent_data[VIEW_COLUMN_EMA12] - rv->current_line_most_recent_data[VIEW_COLUMN_EMA26];
  rv->current_line_most_recent_data[VIEW_COLUMN_MACD_EMA9] = ema_estimate ( rv->macd_ema9, tmp, rv->nb_entries );

  /* average true range */
  tr = rv->current_line[VIEW_COLUMN_MAX] - rv->current_line[VIEW_COLUMN_MIN];
  tmp = fabs ( rv->current_line[VIEW_COLUMN_MAX]- rv->price_prev_close );
  tr = max ( tr, tmp );
  tmp = fabs ( rv->current_line[VIEW_COLUMN_MIN]- rv->price_prev_close );
  tr = max ( tr, tmp );
  atr = ema_estimate ( rv->tr_ema14, tr, rv->nb_entries );
  rv->current_line_most_recent_data[VIEW_COLUMN_ATR] = atr;

  /* price RSI */
  tmp = rv->current_line[VIEW_COLUMN_CLOSE] - rv->price_prev_close;
  if ( tmp > 0 )
    {
      down = ema_estimate ( rv->rsi_down_ema14, 0, rv->nb_entries );
      up = ema_estimate ( rv->rsi_up_ema14, tmp, rv->nb_entries );
    }
  else
    {
      down = ema_estimate ( rv->rsi_down_ema14, -tmp, rv->nb_entries );
      up = ema_estimate ( rv->rsi_up_ema14, 0, rv->nb_entries );
    }
  if ( down == 0 )
    down = DBL_MIN;
  rv->current_line_most_recent_data[VIEW_COLUMN_RSI] = 100.0 - (100.0 / ( 1.0 + (up / down) ) );

  /* price TSI */
  tmp = rv->current_line[VIEW_COLUMN_CLOSE] - rv->price_prev_close;
  m = ema_estimate ( rv->tsi_m_ema13, ema_estimate(rv->tsi_moment_ema25,tmp,rv->nb_entries), rv->nb_entries );
  mabs = ema_estimate ( rv->tsi_absm_ema13, ema_estimate(rv->tsi_abs_moment_ema25,fabs(tmp),rv->nb_entries), rv->nb_entries );
  if ( mabs == 0 )
    mabs = DBL_MIN;
  tmp = 100.0 * ( m / mabs );
  rv->current_line_most_recent_data[VIEW_COLUMN_TSI] = tmp;
  rv->current_line_most_recent_data[VIEW_COLUMN_TSI_EMA7] = ema_estimate ( rv->tsi_ema7, tmp, rv->nb_entries );

  /* price ADX */
  up = rv->current_line_most_recent_data[VIEW_COLUMN_MAX] - rv->price_prev_high;
  down = rv->current_line_most_recent_data[VIEW_COLUMN_MIN] - rv->price_prev_low;
  if ( ( up > down ) && ( up > 0 ) )
    dm_p = up;
  if ( ( down > up ) && ( down > 0 ) )
    dm_n = down;
  if ( atr == 0 )
    atr = DBL_MIN;
  dm_p = 100 * ema_estimate ( rv->adx_dmp_ema14, (dm_p/atr), rv->nb_entries );
  dm_n = 100 * ema_estimate ( rv->adx_dmn_ema14, (dm_n/atr), rv->nb_entries );
  rv->current_line_most_recent_data[VIEW_COLUMN_ADX_DMP] = dm_p;
  rv->current_line_most_recent_data[VIEW_COLUMN_ADX_DMN] = dm_n;
  tmp = dm_p + dm_n;
  if ( tmp == 0 )
    tmp = DBL_MIN;
  tmp = ( fabs(dm_p-dm_n) / tmp ) ;
  rv->current_line_most_recent_data[VIEW_COLUMN_ADX] = 100 * ema_estimate ( rv->adx_ema14, tmp, rv->nb_entries );

  /* variance */
  rv->current_line_most_recent_data[VIEW_COLUMN_VARIANCE7] = variance_estimate ( rv->variance7, rv->current_line[VIEW_COLUMN_CLOSE], rv->nb_entries );
  rv->current_line_most_recent_data[VIEW_COLUMN_VARIANCE21] = variance_estimate ( rv->variance21, rv->current_line[VIEW_COLUMN_CLOSE], rv->nb_entries );
}


/*
 * refview_append_single_data_nolock
 */
void
refview_append_single_data_nolock ( refview *rv,
                                    gdouble *data )
{
  viewblock *b;
  guint j;
  const gdouble rate = data[STORE_COLUMN_PRICE];
  gdouble tmp;
  gdouble tr, atr;
  gdouble up, down;
  gdouble dm_n=0, dm_p=0;

  if ( rv->tick_next == 0 )
    {
      gdouble price;
      rv->tick = rv->precision * floor ( data[STORE_COLUMN_TIME] / rv->precision );
      rv->tick_next = rv->tick + rv->precision;

      bzero ( rv->current_line, VIEW_BLOCK_COLS * sizeof(gdouble) );
      price = data[STORE_COLUMN_PRICE];
      rv->current_line[VIEW_COLUMN_OPEN] = price;
      rv->current_line[VIEW_COLUMN_CLOSE] = price;
      rv->current_line[VIEW_COLUMN_MIN] = price;
      rv->current_line[VIEW_COLUMN_MAX] = price;
      rv->price_prev_high = price;
      rv->price_prev_low = price;
      rv->price_prev_close = price;
    }

  if ( data[STORE_COLUMN_TIME] < rv->tick_next )
    {
      /* put new data in accumulator */
      for ( j=0; j<STORE_BLOCK_COLS; ++j )
        rv->current_line[j] += data[j];
      rv->current_nb_values++;
      rv->current_line[VIEW_COLUMN_CLOSE] = rate;
      if ( rate < rv->current_line[VIEW_COLUMN_MIN] )
        rv->current_line[VIEW_COLUMN_MIN] = rate;
      if ( rate > rv->current_line[VIEW_COLUMN_MAX] )
        rv->current_line[VIEW_COLUMN_MAX] = rate;
    }
  else
    {
      /* store current accumulator and store data in a fresh one */
      rv->current_line[VIEW_COLUMN_TIME] = rv->tick + (rv->precision/2);

      rv->current_line[VIEW_COLUMN_PRICE] = rv->current_line[VIEW_COLUMN_PRICE] / rv->current_nb_values;
      rv->current_line[VIEW_COLUMN_SUM_ASKS] = rv->current_line[VIEW_COLUMN_SUM_ASKS] / rv->current_nb_values;
      rv->current_line[VIEW_COLUMN_SUM_BIDS] = rv->current_line[VIEW_COLUMN_SUM_BIDS] / rv->current_nb_values;
      /* volume is not averaged */
      /* nb trades is not averaged */
      rv->current_line[VIEW_COLUMN_LAG] = rv->current_line[VIEW_COLUMN_LAG] / rv->current_nb_values;
      rv->current_line[VIEW_COLUMN_TOP_ASK] = rv->current_line[VIEW_COLUMN_TOP_ASK] / rv->current_nb_values;
      rv->current_line[VIEW_COLUMN_TOP_BID] = rv->current_line[VIEW_COLUMN_TOP_BID] / rv->current_nb_values;
      rv->current_line[VIEW_COLUMN_USD_CONVRATE] = rv->current_line[VIEW_COLUMN_USD_CONVRATE] / rv->current_nb_values;

      /* price EMAs */
      rv->current_line[VIEW_COLUMN_EMA12] = ema_update ( rv->price_ema12, rv->current_line[VIEW_COLUMN_PRICE], rv->nb_entries );
      rv->current_line[VIEW_COLUMN_EMA26] = ema_update ( rv->price_ema26, rv->current_line[VIEW_COLUMN_PRICE], rv->nb_entries );

      /* price MACD */
      tmp = rv->price_ema12->current - rv->price_ema26->current;
      rv->current_line[VIEW_COLUMN_MACD_EMA9] = ema_update ( rv->macd_ema9, tmp, rv->nb_entries );

      /* true range */
      tr = rv->current_line[VIEW_COLUMN_MAX] - rv->current_line[VIEW_COLUMN_MIN];
      tmp = fabs ( rv->current_line[VIEW_COLUMN_MAX] - rv->price_prev_close );
      tr = max ( tr, tmp );
      tmp = fabs ( rv->current_line[VIEW_COLUMN_MIN] - rv->price_prev_close );
      tr = max ( tr, tmp );
      atr = ema_update ( rv->tr_ema14, tr, rv->nb_entries );
      rv->current_line[VIEW_COLUMN_ATR] = atr;

      /* price RSI */
      tmp = rv->current_line[VIEW_COLUMN_CLOSE] - rv->price_prev_close;
      if ( tmp > 0 )
        {
          tmp = ema_update ( rv->rsi_down_ema14, 0, rv->nb_entries );
          ema_update ( rv->rsi_up_ema14, tmp, rv->nb_entries );
        }
      else
        {
          tmp = ema_update ( rv->rsi_down_ema14, -tmp, rv->nb_entries );
          ema_update ( rv->rsi_up_ema14, 0, rv->nb_entries );
        }
      if ( tmp == 0 )
        tmp = DBL_MIN;
      rv->current_line[VIEW_COLUMN_RSI] = 100.0 - (100.0 / ( 1.0 + (rv->rsi_up_ema14->current / tmp) ) );

      /* price TSI */
      tmp = rv->current_line[VIEW_COLUMN_CLOSE] - rv->price_prev_close;
      ema_update ( rv->tsi_m_ema13, ema_update(rv->tsi_moment_ema25,tmp,rv->nb_entries), rv->nb_entries );
      tmp = ema_update ( rv->tsi_absm_ema13, ema_update(rv->tsi_abs_moment_ema25,fabs(tmp),rv->nb_entries), rv->nb_entries );
      if ( tmp == 0 )
        tmp = DBL_MIN;
      tmp = 100.0 * ( rv->tsi_m_ema13->current / tmp );
      rv->current_line[VIEW_COLUMN_TSI] = tmp;
      rv->current_line[VIEW_COLUMN_TSI_EMA7] = ema_update ( rv->tsi_ema7, tmp, rv->nb_entries );

      /* price ADX */
      up = rv->current_line[VIEW_COLUMN_MAX] - rv->price_prev_high;
      down = rv->current_line[VIEW_COLUMN_MIN] - rv->price_prev_low;
      if ( ( up > down ) && ( up > 0 ) )
        dm_p = up;
      if ( ( down > up ) && ( down > 0 ) )
        dm_n = down;
      if ( atr == 0 )
        atr = DBL_MIN;
      dm_p = 100 * ema_update ( rv->adx_dmp_ema14, (dm_p/atr), rv->nb_entries );
      dm_n = 100 * ema_update ( rv->adx_dmn_ema14, (dm_n/atr), rv->nb_entries );
      rv->current_line[VIEW_COLUMN_ADX_DMP] = dm_p;
      rv->current_line[VIEW_COLUMN_ADX_DMN] = dm_n;
      tmp = dm_p + dm_n;
      if ( tmp == 0 )
        tmp = DBL_MIN;
      tmp = ( fabs(dm_p-dm_n) / tmp );
      rv->current_line[VIEW_COLUMN_ADX] = 100 * ema_update ( rv->adx_ema14, tmp, rv->nb_entries );

      /* price variance */
      rv->current_line[VIEW_COLUMN_VARIANCE7] = variance_update ( rv->variance7, rv->current_line[VIEW_COLUMN_CLOSE], rv->nb_entries );
      rv->current_line[VIEW_COLUMN_VARIANCE21] = variance_update ( rv->variance21, rv->current_line[VIEW_COLUMN_CLOSE], rv->nb_entries );

      /* prepare data append */
      if ( refblock_is_full(rv->blocks_tail) )
        {
          b = viewblock_new ( );
          rv->blocks_tail->next_block = b;
          b->prev_block = rv->blocks_tail;
          rv->blocks_tail = b;
#ifndef _WITHOUT_PRUNING
          /* we always have at least two viewblocks when reaching this point, if the head is not used anymore, prune it */
          if ( rv->blocks_head != rv->window_block )
            {
              b = rv->blocks_head;
              rv->blocks_head = b->next_block;
              rv->blocks_head->prev_block = NULL;
              viewblock_free ( b );
            }
          /* after that, rv->current_line will be pushed ; thus it will always contain at least one line of data */
#endif
        }

      /* append block */
      viewblock_append ( rv->blocks_tail, rv->current_line );
      rv->nb_entries++;

      rv->window_length++;
      rv->window_sum_price += rv->current_line[VIEW_COLUMN_PRICE];
      rv->window_sum_volume += rv->current_line[VIEW_COLUMN_VOLUME];

      rv->price_prev_close = rv->current_line[VIEW_COLUMN_CLOSE];
      rv->price_prev_high = rv->current_line[VIEW_COLUMN_MAX];
      rv->price_prev_low = rv->current_line[VIEW_COLUMN_MIN];

      /* update view window block & index */
      b = rv->window_block;
      tmp = rv->tick_next - rv->length;

      while ( b->data[rv->window_index][VIEW_COLUMN_TIME] < tmp )
        {
          rv->window_length--;
          rv->window_sum_price -= b->data[rv->window_index][VIEW_COLUMN_PRICE];
          rv->window_sum_volume -= b->data[rv->window_index][VIEW_COLUMN_VOLUME];
          rv->window_index++;

          if ( rv->window_index >= b->next_line )
            {
              b = b->next_block;
              rv->window_index = 0;
            }
        }

      rv->window_sum_volume = max ( 0, rv->window_sum_volume); /* may become instable over time, fix it partially */
      rv->window_block = b;

      /* taint JSON cache */
      rv->cache_short->dirty = TRUE;
      rv->cache_short_full->dirty = TRUE;
      rv->cache_long->dirty = TRUE;
      rv->cache_long_full->dirty = TRUE;

      /* initialize new accumulation */
      memcpy ( rv->current_line, data, sizeof(gdouble)*STORE_BLOCK_COLS );
      rv->current_line[VIEW_COLUMN_OPEN] = rv->current_line[VIEW_COLUMN_CLOSE];
      rv->current_line[VIEW_COLUMN_CLOSE] = rate;
      rv->current_line[VIEW_COLUMN_MIN] = rate;
      rv->current_line[VIEW_COLUMN_MAX] = rate;

      rv->current_nb_values = 1;

      rv->tick = rv->precision * floor ( rv->current_line[VIEW_COLUMN_TIME] / rv->precision );
      rv->tick_next = rv->tick + rv->precision;
    }
}


/*
 * refview_append_single_data
 */
void
refview_append_single_data ( refview *rv,
                             gdouble *data )
{
  g_rw_lock_writer_lock ( &(rv->lock) );
  refview_append_single_data_nolock ( rv, data );
  refview_sync_floating_line ( rv, data );
  g_rw_lock_writer_unlock ( &(rv->lock) );
}


/*
 * refview_get_window_tick
 * data is expected to be a triple of gdouble (openprice,avgprice,volume)
 */
void
refview_get_window_tick ( refview *rv,
                          gdouble *data )
{
  g_rw_lock_reader_lock ( &(rv->lock) );

  data[0] = rv->window_block->data[rv->window_index][VIEW_COLUMN_PRICE];

  if ( rv->window_length > 0 )
    data[1] = rv->window_sum_price / ((gdouble) rv->window_length);
  else
    data[1] = 0;

  data[2] = rv->window_sum_volume;

  g_rw_lock_reader_unlock ( &(rv->lock) );
}


/*
 * refview_dump
 */
void
refview_dump ( refview *rv,
               FILE *f )
{
  viewblock *b;

  fputs ( "time rate abratio volume lag top_ask top_bid open close min max\n", f );

  for ( b=rv->blocks_head; b!=NULL; b=b->next_block )
    viewblock_dump ( b, f );

  fflush ( f );
}


/*
 * refview_lookup_time
 */
#undef DEBUG_VIEW_JSON
#undef PROFILE_VIEW_JSON

void
refview_lookup_time ( refview *rv,
                      const gdouble offset,
                      viewblock **retb,
                      gint *retj )
{
  gint j;
  viewblock *b;
#ifdef PROFILE_VIEW_JSON
  GTimer *timer;
  gdouble duration;
  gulong residual;
  timer = g_timer_new ( );
  g_timer_start ( timer );
#endif

  /* search for block */
  b = rv->blocks_tail;
  j = 0; /* safe default to turn-off compilation warning */

  if ( ( b->next_line == 0 ) && ( b != NULL ) )
    b = b->prev_block;

  if ( b == NULL )
    {
      *retb = NULL;
      return;
    }

  while ( b != NULL )
    {
      if ( b->data[0][VIEW_COLUMN_TIME] < offset )
        break;

      if ( b->prev_block != NULL )
        b = b->prev_block;
      else
        break;
    }

  /* search for entry */
  while ( b != NULL )
    {
      for ( j=(b->next_line-1); j>=0; --j )
        {
#ifdef DEBUG_VIEW_JSON
          fprintf ( stderr, "comparing offset=%f with time=%f at position %d\n", offset, b->data[j][VIEW_COLUMN_TIME], j );
#endif
          if ( b->data[j][VIEW_COLUMN_TIME] < offset )
            break;
        }

      if ( j >= 0 )
        {
#ifdef DEBUG_VIEW_JSON
          fprintf ( stderr, "found offset=%f at position %d\n", offset, j );
#endif
        if ( b->data[j][VIEW_COLUMN_TIME] < offset )
          break;
        }

      if ( ( j < 0 ) && ( b->prev_block != NULL ) )
        b = b->prev_block;
      else
        break;
    }

#ifdef DEBUG_VIEW_JSON
  fprintf ( stderr, "after seek : j=%d ; block: %lX ; next_line=%u\n", j, b, b->next_line );
#endif

  ++j;
  if ( j >= b->next_line )
    {
      j = 0;
      b = b->next_block;
    }

#ifdef PROFILE_VIEW_JSON
  g_timer_stop ( timer );
  duration = g_timer_elapsed ( timer, &residual );
  fprintf ( stderr, "profile: lookup_time: %f ms + %lu µs\n", duration*1000, residual );
  g_timer_destroy ( timer );
#endif

  *retb = b;
  *retj = j;
  return;
}


/*
 * refview_write_json
 */

typedef struct st_cformat
{
  guint col;
  guint precision;
  guint modes;
} cformat ;

#define F_MODE_FIRST  1
#define F_MODE_LONG   2
#define F_MODE_SHORT  4

cformat F[] = { { VIEW_COLUMN_TIME,         1, F_MODE_LONG|F_MODE_SHORT },
                { VIEW_COLUMN_PRICE,        4, F_MODE_LONG|F_MODE_SHORT },
                { VIEW_COLUMN_SUM_ASKS,     2, F_MODE_LONG|F_MODE_SHORT },
                { VIEW_COLUMN_SUM_BIDS,     2, F_MODE_LONG|F_MODE_SHORT },
                { VIEW_COLUMN_VOLUME,       6, F_MODE_LONG|F_MODE_SHORT },
                { VIEW_COLUMN_NB_TRADES,    0, F_MODE_LONG|F_MODE_SHORT },
                { VIEW_COLUMN_LAG,          2, F_MODE_LONG|F_MODE_SHORT },
                { VIEW_COLUMN_TOP_ASK,      4, F_MODE_LONG|F_MODE_SHORT },
                { VIEW_COLUMN_TOP_BID,      4, F_MODE_LONG|F_MODE_SHORT },
                { VIEW_COLUMN_USD_CONVRATE, 7, F_MODE_LONG|F_MODE_SHORT },
                { VIEW_COLUMN_ATR,          4, F_MODE_LONG|F_MODE_SHORT },
                { VIEW_COLUMN_RSI,          4, F_MODE_LONG|F_MODE_SHORT },
                { VIEW_COLUMN_TSI,          4, F_MODE_LONG|F_MODE_SHORT },
                { VIEW_COLUMN_OPEN,         4, F_MODE_LONG },
                { VIEW_COLUMN_CLOSE,        4, F_MODE_LONG },
                { VIEW_COLUMN_MIN,          4, F_MODE_LONG },
                { VIEW_COLUMN_MAX,          4, F_MODE_LONG },
                { VIEW_COLUMN_ADX_DMP,      4, F_MODE_LONG },
                { VIEW_COLUMN_ADX_DMN,      4, F_MODE_LONG },
                { VIEW_COLUMN_ADX,          4, F_MODE_LONG },
                { VIEW_COLUMN_VARIANCE7,    4, F_MODE_LONG },
                { VIEW_COLUMN_VARIANCE21,   4, F_MODE_LONG },
                { VIEW_COLUMN_EMA12,        4, F_MODE_FIRST },
                { VIEW_COLUMN_EMA26,        4, F_MODE_FIRST },
                { VIEW_COLUMN_MACD_EMA9,    4, F_MODE_FIRST },
                { VIEW_COLUMN_TSI_EMA7,     4, F_MODE_FIRST },
                { VIEW_BLOCK_COLS,          0, 0 }
};

static gchar *
write_data_line ( gchar *buffer,
                  gdouble *line,
                  gchar extra,
                  const gint mode )
{
  gchar *ptr;
  guint i;
  gdouble val;

  ptr = buffer;
  *ptr = '[';
  ++ptr;

  for ( i=0; F[i].col!=VIEW_BLOCK_COLS; ++i )
    {
      if ( (mode & F[i].modes) == 0 )
        continue;

      val = line[F[i].col];

      if ( i > 0 )
        {
          *ptr = ',';
          ++ptr;
        }

      print_float ( val, F[i].precision, ptr );
    }

  *ptr = ']';
  ++ptr;
  *ptr = extra;
  ++ptr;
  return ptr;
}


static gchar *
write_json ( refview *rv,
             gchar *buffer,
             const guint mode )
{
  gint j;
  viewblock *b;
  gchar *ptr;

  ptr = buffer;
  *ptr = '[';
  ++ptr;

  /* send only last line */

  b = rv->blocks_tail;
  j = 0; /* safe default to turn-off compilation warning */

  if ( b != NULL )
    {
      if ( viewblock_is_empty(b) )
        {
          b = b->prev_block;
          j = VIEW_BLOCK_SIZE - 1;
        }
      else
        j = b->next_line - 1;

      if ( b != NULL )
        ptr = write_data_line ( ptr, b->data[j], ',', mode );
    }

  return ptr;
}


static gchar *
write_json_full ( refview *rv,
                  gchar *buffer,
                  const guint mode,
                  const gdouble offset )
{
  gint j;
  viewblock *b;
  gchar *ptr;

  ptr = buffer;
  *ptr = '[';
  ++ptr;

  /* send multiple lines, according to offset */

  /* refview_lookup_time ( rv, offset, &b, &j ); */
  b = rv->window_block;
  j = rv->window_index;

  if ( b == NULL )
    return ptr;

  /* dump block which contains offset */
  ptr = write_data_line ( ptr, b->data[j], ',', mode|((mode==F_MODE_LONG)?F_MODE_FIRST:0) ); /* 'first' enabled only for long mode */
  ++j;

  for ( ; j<b->next_line; ++j )
    ptr = write_data_line ( ptr, b->data[j], ',', mode );

  /* if more blocks to print, then process them */
  b = b->next_block;
  for ( ; b!=NULL; b=b->next_block )
    for ( j=0; j<b->next_line; ++j )
      ptr = write_data_line ( ptr, b->data[j], ',', mode );

  return ptr;
}


void
refview_write_json ( refview *rv,
                     view_mode_id mid,
                     gboolean sendFull,
                     const gdouble user_offset,
                     FILE *f )
{
  gdouble offset;
  jcache *jc = NULL;
  guint mode;
  gchar *end;

#ifdef DEBUG_VIEW_JSON
  fprintf ( stderr, "user offset=%f\n", user_offset );
#endif

  g_rw_lock_reader_lock ( &(rv->lock) );

  if ( user_offset == -1 )
    offset = rv->tick - rv->length;
  else if ( user_offset > rv->tick )
    offset = rv->tick - 60;
  else
    offset = user_offset;

  /* WARNING : if offset!=-1, current caching implementation is broken */

#ifdef DEBUG_VIEW_JSON
  fprintf ( stderr, "final offset=%f\n", offset );
#endif

  if ( ( mid == VIEW_MODE_MULTI ) || ( mid == VIEW_MODE_AVERAGE ) )
    {
      mode = F_MODE_SHORT;

      if ( sendFull )
        jc = rv->cache_short_full;
      else
        jc = rv->cache_short;
    }
  else
    {
      mode = F_MODE_LONG;

      if ( sendFull )
        jc = rv->cache_long_full;
      else
        jc = rv->cache_long;
    }

  if ( jc->dirty )
    {
      if ( sendFull )
        jc->end = write_json_full ( rv, jc->content, mode, offset );
      else
        jc->end = write_json ( rv, jc->content, mode );

      jc->dirty = FALSE;
    }

  end = write_data_line ( jc->end, rv->current_line_most_recent_data, ']', mode );
  fwrite ( jc->content, sizeof(gchar), end-jc->content, f );

  g_rw_lock_reader_unlock ( &(rv->lock) );
}


/*
 * refview_free
 */
void
refview_free ( refview *rv )
{
  viewblocks_list_clear ( rv->blocks_head );

  ema_free ( rv->price_ema12 );
  ema_free ( rv->price_ema26 );
  ema_free ( rv->macd_ema9 );

  ema_free ( rv->tr_ema14 );

  ema_free ( rv->rsi_down_ema14 );
  ema_free ( rv->rsi_up_ema14 );

  ema_free ( rv->tsi_moment_ema25 );
  ema_free ( rv->tsi_m_ema13 );
  ema_free ( rv->tsi_abs_moment_ema25 );
  ema_free ( rv->tsi_absm_ema13 );
  ema_free ( rv->tsi_ema7 );

  ema_free ( rv->adx_dmp_ema14 );
  ema_free ( rv->adx_dmn_ema14 );
  ema_free ( rv->adx_ema14 );

  variance_free ( rv->variance7 );
  variance_free ( rv->variance21 );

  jcache_free ( rv->cache_long );
  jcache_free ( rv->cache_long_full );
  jcache_free ( rv->cache_short );
  jcache_free ( rv->cache_short_full );

  g_rw_lock_clear ( &(rv->lock) );

  g_free ( rv->name_prec );
  g_free ( rv->name );

  g_free ( rv );
}
