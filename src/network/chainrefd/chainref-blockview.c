/*
 * chainref-blockview.c
 *
 * Blocks database view for chainref.
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


#include <stdlib.h>
#include <stdio.h>
#include <string.h>
#include <unistd.h>
#include <sys/types.h>
#include <sys/stat.h>
#include <fcntl.h>
#include <strings.h>
#include <sys/mman.h>
#include <errno.h>
#include <math.h>
#include <glib.h>
#include <glib/gprintf.h>

#include "chainref-utils.h"
#include "chainref-blockview.h"


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
 * view_length_lookup
 */
view_length_id
view_length_lookup ( const gchar *name )
{
  view_length_id lid;

  switch ( name[0] )
    {
      case 'p':
        lid = VIEW_LENGTH_PER_BLOCK;
        break;

      case 'w':
        lid = VIEW_LENGTH_1_W;
        break;

      case 'm':
        lid = VIEW_LENGTH_1_M;
        break;

      case 'r':
        lid = VIEW_LENGTH_3_M;
        break;

      case 'b':
        lid = VIEW_LENGTH_6_M;
        break;

      case 'y':
        lid = VIEW_LENGTH_1_Y;
        break;

      case 'l':
        lid = VIEW_LENGTH_2_Y;
        break;

      case 'q':
        lid = VIEW_LENGTH_4_Y;
        break;

      case 'a':
        lid = VIEW_LENGTH_ALL;
        break;

      case 'd':
      default:
        lid = VIEW_LENGTH_1_D;
        break;
    }

  return lid;
}


/*
 * utility function to compute hashrate
 */
static gdouble
computeSumDiffHashrate ( const long double difficulty_sum,
                         const gdouble worktime,
                         const gdouble nb_blocks )
{
  long double avg_difficulty = difficulty_sum / ((long double) nb_blocks);
  long double target_hashrate = avg_difficulty * 7.158278826666667 * 600; /* Mhash/s */
  long double real_hashrate = (target_hashrate*((long double)nb_blocks)) / ((long double) worktime);
  return (gdouble) real_hashrate;
}

static gdouble
computeHashrate ( const gdouble difficulty,
                  const gdouble worktime,
                  const gdouble nb_blocks )
{
  gdouble target_hashrate = difficulty * 7.158278826666667 * 600; /* Mhash/s */
  gdouble real_hashrate = (target_hashrate*nb_blocks) / worktime;
  return real_hashrate;
}


/* refview */

/*
 * refview_new
 */
refview *
refview_new ( refstore *store,
              const gdouble length,
              const gdouble precision,
              const gdouble hrate_window,
              const gdouble hrate_ema )
{
  refview *rv;

  rv = (refview *) g_malloc ( sizeof(refview) );

  rv->store = store;

  rv->length = length;
  rv->precision = precision;

  /*expected number of entries : rv->nb_entries = 1 + (guint) ceil(length/precision);*/

  rv->version_ema = ema_new ( 10 );
  rv->size_ema = ema_new ( 26 );
  rv->nb_tx_ema = ema_new ( 26 );
  rv->volume_ema = ema_new ( 26 );
  rv->fees_ema = ema_new ( 26 );

  rv->nb_blocks_ema = ema_new ( 26 );
  rv->work_ema = ema_new ( 26 );

  rv->hashrate_mavg = mavg_new ( hrate_window );
  rv->hashrate_ema = ema_new ( hrate_ema );

  g_rw_lock_init ( &(rv->lock) );

  rv->blocks_head = viewblock_new ( );
  rv->blocks_tail = rv->blocks_head;

  rv->window_block = rv->blocks_head;
  rv->window_index = 0;
  rv->window_length = 0;
  rv->window_sum_nb_tx = 0;

  rv->nb_entries = 0;

  rv->current_nb_values = 1;

  rv->tick = rv->precision * floor ( rv->store->blocks_head->data[0][STORE_COLUMN_TIME] / rv->precision );
  rv->tick_next = rv->tick + rv->precision;

  rv->window_diff_length = 1 + (guint) ceil(length/(3600.0*24.0*7.0)); /* we can store difficulty change up to every 7 days */
  rv->window_diff = (gdouble *) g_malloc ( 2* sizeof(gdouble) * rv->window_diff_length );

  memcpy ( rv->current_line, rv->store->blocks_head->data[0], sizeof(gdouble)*STORE_BLOCK_COLS );
  rv->current_line[VIEW_COLUMN_NB_BLOCKS] = 1;
  rv->current_line[VIEW_COLUMN_WORK] = 600;
  rv->current_line[VIEW_COLUMN_HASHRATE] = computeHashrate ( rv->current_line[VIEW_COLUMN_DIFFICULTY], 600, 1 );
  rv->current_line[VIEW_COLUMN_SIZE_MAX] = rv->current_line[VIEW_COLUMN_SIZE];
  rv->current_line[VIEW_COLUMN_NB_TX_TOTAL] = rv->current_line[VIEW_COLUMN_NB_TX];
  rv->diff_sum = rv->current_line[VIEW_COLUMN_DIFFICULTY];
  refview_sync_floating_line ( rv, rv->store->blocks_head->data[0] );

  rv->window_diff[0] = rv->current_line[STORE_COLUMN_TIME];
  rv->window_diff[1] = rv->current_line[STORE_COLUMN_DIFFICULTY];
  rv->window_diff_start = 0;
  rv->window_diff_current = 0;

  rv->cache = jcache_new ( 4*VIEW_BLOCK_COLS );
  rv->cache_full = jcache_new ( 512*VIEW_BLOCK_COLS );

  return rv;
}


/*
 * refview_sync_floating_line
 */
void
refview_sync_floating_line ( refview *rv,
                             gdouble *data )
{
  gdouble tmp;

  memcpy ( rv->current_line_most_recent_data, data, sizeof(gdouble)*STORE_BLOCK_COLS );

  rv->current_line[VIEW_COLUMN_VERSION_EMA] = ema_estimate ( rv->version_ema, data[STORE_COLUMN_VERSION], rv->nb_entries );
  rv->current_line[VIEW_COLUMN_SIZE_EMA] = ema_estimate ( rv->size_ema, data[STORE_COLUMN_SIZE], rv->nb_entries );
  rv->current_line[VIEW_COLUMN_NB_TX_EMA] = ema_estimate ( rv->nb_tx_ema, data[STORE_COLUMN_NB_TX], rv->nb_entries );
  rv->current_line[VIEW_COLUMN_VOLUME_EMA] = ema_estimate ( rv->volume_ema, data[STORE_COLUMN_VOLUME], rv->nb_entries );
  rv->current_line[VIEW_COLUMN_FEES_EMA] = ema_estimate ( rv->volume_ema, data[STORE_COLUMN_FEES], rv->nb_entries );

  rv->current_line[VIEW_COLUMN_NB_BLOCKS_EMA] = ema_estimate ( rv->nb_blocks_ema, data[VIEW_COLUMN_NB_BLOCKS], rv->nb_entries );
  rv->current_line[VIEW_COLUMN_WORK_EMA] = ema_estimate ( rv->work_ema, data[VIEW_COLUMN_WORK], rv->nb_entries );

  tmp = computeSumDiffHashrate ( rv->diff_sum, rv->current_line[VIEW_COLUMN_WORK], rv->current_line[VIEW_COLUMN_NB_BLOCKS] );
  rv->current_line[VIEW_COLUMN_HASHRATE] = mavg_estimate ( rv->hashrate_mavg, tmp, rv->nb_entries );
  rv->current_line[VIEW_COLUMN_HASHRATE_EMA] = ema_estimate ( rv->hashrate_ema, rv->current_line[VIEW_COLUMN_HASHRATE], rv->nb_entries );
}


/*
 * refview_append_single_data_nolock
 */
void
refview_append_single_data_nolock ( refview *rv,
                                    gdouble *data )
{
  viewblock *b;
  gdouble tmp;

  /* update difficulty table */
  if ( data[STORE_COLUMN_DIFFICULTY] != rv->window_diff[(rv->window_diff_current*2)+1] )
    {
      rv->window_diff_current++;
      if ( rv->window_diff_current >= rv->window_diff_length )
        rv->window_diff_current = 0;
      rv->window_diff[(rv->window_diff_current*2)+0] = rv->current_line_most_recent_data[STORE_COLUMN_TIME];
      rv->window_diff[(rv->window_diff_current*2)+1] = data[STORE_COLUMN_DIFFICULTY];
    }

  tmp = rv->tick_next - (rv->precision+rv->length);
  if ( rv->window_diff[(rv->window_diff_start*2)+0] < tmp )
    {
      rv->window_diff_start++;
      if ( rv->window_diff_start >= rv->window_diff_length )
        rv->window_diff_start = 0;
    }

  /* update block storage */
  if ( data[STORE_COLUMN_TIME] < rv->tick_next )
    {
      /* first block ID and timestamps are not accumulated, diff is not updated */
      rv->current_line[VIEW_COLUMN_VERSION] += data[STORE_COLUMN_VERSION];
      rv->current_line[VIEW_COLUMN_SIZE] += data[STORE_COLUMN_SIZE];
      rv->current_line[VIEW_COLUMN_NB_TX] += data[STORE_COLUMN_NB_TX];
      rv->current_line[VIEW_COLUMN_VOLUME] += data[STORE_COLUMN_VOLUME];
      rv->current_line[VIEW_COLUMN_FEES] += data[STORE_COLUMN_FEES];
      rv->current_line[VIEW_COLUMN_MEMPOOL_SIZE] = MAX ( data[STORE_COLUMN_MEMPOOL_SIZE], rv->current_line[VIEW_COLUMN_MEMPOOL_SIZE] );
      rv->current_line[VIEW_COLUMN_MEMPOOL_MAX_SIZE] = MAX ( data[STORE_COLUMN_MEMPOOL_MAX_SIZE], rv->current_line[VIEW_COLUMN_MEMPOOL_MAX_SIZE] );
      rv->current_line[VIEW_COLUMN_NB_BLOCKS] += 1;
      rv->current_line[VIEW_COLUMN_WORK] += data[STORE_COLUMN_TIME]-rv->current_line_most_recent_data[STORE_COLUMN_TIME];
      rv->current_line[VIEW_COLUMN_SIZE_MAX] = MAX ( data[STORE_COLUMN_SIZE], rv->current_line[VIEW_COLUMN_SIZE_MAX] );
      rv->current_line[VIEW_COLUMN_NB_TX_TOTAL] += data[STORE_COLUMN_NB_TX];
      rv->diff_sum += data[STORE_COLUMN_DIFFICULTY];
      rv->current_nb_values++;
    }
  else
    {
      /* store current accumulator */
      rv->current_line[VIEW_COLUMN_TIME] = rv->tick + (rv->precision/2);       /* todo: check if we use central value */
      /* first timestamp is not modified */
      /* first block id is not modified*/
      /* difficulty is not averaged */
      rv->current_line[VIEW_COLUMN_VERSION] = rv->current_line[STORE_COLUMN_VERSION] / rv->current_nb_values;
      rv->current_line[VIEW_COLUMN_SIZE] = rv->current_line[STORE_COLUMN_SIZE] / rv->current_nb_values;
      /* nb_tx is not averaged */
      /* nb_tx total is not modified */
      /* volume is not averaged */
      /* fees are not averaged */
      /* mempool size is not averaged */
      /* mempool max size is not averaged */
      /* nb blocks is not averaged */
      /* work is not averaged */
      tmp = computeSumDiffHashrate ( rv->diff_sum, rv->current_line[VIEW_COLUMN_WORK], rv->current_line[VIEW_COLUMN_NB_BLOCKS] );
      rv->current_line[VIEW_COLUMN_VERSION_EMA] = ema_update ( rv->version_ema, rv->current_line[VIEW_COLUMN_VERSION], rv->nb_entries );
      rv->current_line[VIEW_COLUMN_SIZE_EMA] = ema_update ( rv->size_ema, rv->current_line[VIEW_COLUMN_SIZE], rv->nb_entries );
      rv->current_line[VIEW_COLUMN_NB_TX_EMA] = ema_update ( rv->nb_tx_ema, rv->current_line[VIEW_COLUMN_NB_TX], rv->nb_entries );
      rv->current_line[VIEW_COLUMN_VOLUME_EMA] = ema_update ( rv->volume_ema, rv->current_line[VIEW_COLUMN_VOLUME], rv->nb_entries );
      rv->current_line[VIEW_COLUMN_FEES_EMA] = ema_update ( rv->fees_ema, rv->current_line[VIEW_COLUMN_FEES], rv->nb_entries );
      rv->current_line[VIEW_COLUMN_NB_BLOCKS_EMA] = ema_update ( rv->nb_blocks_ema, rv->current_line[VIEW_COLUMN_NB_BLOCKS], rv->nb_entries );
      rv->current_line[VIEW_COLUMN_WORK_EMA] = ema_update ( rv->work_ema, rv->current_line[VIEW_COLUMN_WORK], rv->nb_entries );
      rv->current_line[VIEW_COLUMN_HASHRATE] = mavg_update ( rv->hashrate_mavg, tmp, rv->nb_entries );
      rv->current_line[VIEW_COLUMN_HASHRATE_EMA] = ema_update ( rv->hashrate_ema, rv->current_line[VIEW_COLUMN_HASHRATE], rv->nb_entries );

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
      rv->window_sum_nb_tx += rv->current_line[VIEW_COLUMN_NB_TX];

      /* update view window block & index */
      b = rv->window_block;
      tmp = rv->tick_next - rv->length;

      while ( b->data[rv->window_index][VIEW_COLUMN_TIME] < tmp )
        {
          rv->window_length--;
          rv->window_sum_nb_tx -= b->data[rv->window_index][VIEW_COLUMN_NB_TX];
          rv->window_index++;

          if ( rv->window_index >= b->next_line )
            {
              b = b->next_block;
              rv->window_index = 0;
            }
        }

      rv->window_block = b;

      /* taint JSON cache */
      rv->cache->dirty = TRUE;
      rv->cache_full->dirty = TRUE;

      /* initialize new accumulation */
      rv->current_line[VIEW_COLUMN_FIRST_BLOCK_ID] = data[STORE_COLUMN_UID];
      rv->current_line[VIEW_COLUMN_TIME] = data[STORE_COLUMN_TIME];
      rv->current_line[VIEW_COLUMN_DIFFICULTY] = data[STORE_COLUMN_DIFFICULTY];
      rv->current_line[VIEW_COLUMN_VERSION] = data[STORE_COLUMN_VERSION];
      rv->current_line[VIEW_COLUMN_SIZE] = data[STORE_COLUMN_SIZE];
      rv->current_line[VIEW_COLUMN_NB_TX] = data[STORE_COLUMN_NB_TX];
      rv->current_line[VIEW_COLUMN_VOLUME] = data[STORE_COLUMN_VOLUME];
      rv->current_line[VIEW_COLUMN_FEES] = data[STORE_COLUMN_FEES];
      rv->current_line[VIEW_COLUMN_MEMPOOL_SIZE] = data[STORE_COLUMN_MEMPOOL_SIZE];
      rv->current_line[VIEW_COLUMN_MEMPOOL_MAX_SIZE] = data[STORE_COLUMN_MEMPOOL_MAX_SIZE];
      rv->current_line[VIEW_COLUMN_NB_BLOCKS] = 1;
      rv->current_line[VIEW_COLUMN_WORK] = data[STORE_COLUMN_TIME] - rv->current_line_most_recent_data[STORE_COLUMN_TIME];
      rv->current_line[VIEW_COLUMN_HASHRATE] = computeHashrate ( data[STORE_COLUMN_DIFFICULTY], rv->current_line[VIEW_COLUMN_WORK], 1 );
      rv->current_line[VIEW_COLUMN_SIZE_MAX] = data[STORE_COLUMN_SIZE];
      rv->current_line[VIEW_COLUMN_NB_TX_TOTAL] += data[STORE_COLUMN_NB_TX];
      rv->diff_sum = data[STORE_COLUMN_DIFFICULTY];
      rv->current_nb_values = 1;

      rv->tick = rv->precision * floor ( rv->current_line[VIEW_COLUMN_TIME] / rv->precision );
      rv->tick_next = rv->tick + rv->precision;
    }

  rv->current_line_most_recent_data[STORE_COLUMN_TIME] = data[STORE_COLUMN_TIME];
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
 * refview_get_moving_tick
 * data is expected to be a single value: hash rate
 */
void
refview_get_moving_tick ( refview *rv,
                          gdouble *data )
{
  viewblock *b;

  g_rw_lock_reader_lock ( &(rv->lock) );

  b = rv->blocks_tail;

  if ( viewblock_is_empty(b) )
    {
      if ( viewblock_is_list_head(b) )
        {
          g_rw_lock_reader_unlock ( &(rv->lock) );
          data[0] = 0;
          return;
        }

      b = b->prev_block;
    }

  data[0] = ( (b->data[b->next_line-1][VIEW_COLUMN_HASHRATE_EMA] * 3 ) + rv->current_line[VIEW_COLUMN_HASHRATE_EMA] ) / 4 ;

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

  fputs ( "first_uid time difficulty size nb_tx volume nb_blocks work\n", f );

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
          fprintf ( stderr, "comparing offset=%f with time=%f at position %d\n", offset, b->data[j][COLUMN_TIME], j );
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
#define F_MODE_NORMAL 2

cformat F[] = { { VIEW_COLUMN_FIRST_BLOCK_ID,   0, F_MODE_NORMAL },
                { VIEW_COLUMN_TIME,             1, F_MODE_NORMAL },
                { VIEW_COLUMN_DIFFICULTY,       4, F_MODE_NORMAL },
                { VIEW_COLUMN_VERSION,          2, F_MODE_NORMAL },
                { VIEW_COLUMN_SIZE,             1, F_MODE_NORMAL },
                { VIEW_COLUMN_SIZE_MAX,         0, F_MODE_NORMAL },
                { VIEW_COLUMN_NB_TX,            0, F_MODE_NORMAL },
                { VIEW_COLUMN_VOLUME,           4, F_MODE_NORMAL },
                { VIEW_COLUMN_FEES,             6, F_MODE_NORMAL },
                { VIEW_COLUMN_MEMPOOL_SIZE,     0, F_MODE_NORMAL },
                { VIEW_COLUMN_MEMPOOL_MAX_SIZE, 0, F_MODE_NORMAL },
                { VIEW_COLUMN_NB_BLOCKS,        0, F_MODE_NORMAL },
                { VIEW_COLUMN_WORK,             1, F_MODE_NORMAL },
                { VIEW_COLUMN_HASHRATE,         1, F_MODE_NORMAL },
                { VIEW_COLUMN_VERSION_EMA,      2, F_MODE_FIRST },
                { VIEW_COLUMN_SIZE_EMA,         1, F_MODE_FIRST },
                { VIEW_COLUMN_NB_TX_EMA,        2, F_MODE_FIRST },
                { VIEW_COLUMN_NB_TX_TOTAL,      0, F_MODE_FIRST },
                { VIEW_COLUMN_VOLUME_EMA,       3, F_MODE_FIRST },
                { VIEW_COLUMN_FEES_EMA,         6, F_MODE_FIRST },
                { VIEW_COLUMN_NB_BLOCKS_EMA,    0, F_MODE_FIRST },
                { VIEW_COLUMN_WORK_EMA,         1, F_MODE_FIRST },
                { VIEW_COLUMN_HASHRATE_EMA,     1, F_MODE_FIRST },
                { VIEW_BLOCK_COLS,              0, 0 }
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
  ptr = write_data_line ( ptr, b->data[j], ',', mode|F_MODE_FIRST ); /* first line of data */
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


static void
write_difficulty_json ( refview *rv,
                        gboolean sendFull,
                        FILE *f )
{
  fputc ( '[', f );

  if ( sendFull )
    {
      gint j = rv->window_diff_start;
      while ( j != rv->window_diff_current )
        {
          fprintf ( f, "[%.0f,%f],", ceil(rv->window_diff[j*2+0]), rv->window_diff[j*2+1] );
          ++j;
          if ( j >= rv->window_diff_length )
            j = 0;
        }
    }

  fprintf ( f, "[%.0f,%f]]", ceil(rv->window_diff[rv->window_diff_current*2+0]), rv->window_diff[rv->window_diff_current*2+1] );

}


void
refview_write_json ( refview *rv,
                     gboolean sendFull,
                     const gdouble user_offset,
                     FILE *f )
{
  gdouble offset;
  jcache *jc = NULL;
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

  if ( sendFull )
    jc = rv->cache_full;
  else
    jc = rv->cache;


  if ( jc->dirty )
    {
      if ( sendFull )
        jc->end = write_json_full ( rv, jc->content, F_MODE_NORMAL, offset );
      else
        jc->end = write_json ( rv, jc->content, F_MODE_NORMAL );

      jc->dirty = FALSE;
    }

  /* write_json ( rv, sendFull, offset, f ); */

  end = write_data_line ( jc->end, rv->current_line, ']', F_MODE_NORMAL );
  fwrite ( jc->content, sizeof(gchar), end-jc->content, f );

  fputs ( ",\"diff\":", f );
  write_difficulty_json ( rv, sendFull, f );

  g_rw_lock_reader_unlock ( &(rv->lock) );
}


/*
 * refview_free
 */
void
refview_free ( refview *rv )
{
  viewblocks_list_clear ( rv->blocks_head );

  ema_free ( rv->version_ema );
  ema_free ( rv->size_ema );
  ema_free ( rv->nb_tx_ema );
  ema_free ( rv->volume_ema );
  ema_free ( rv->fees_ema );

  ema_free ( rv->nb_blocks_ema );
  ema_free ( rv->work_ema );

  mavg_free ( rv->hashrate_mavg );
  ema_free ( rv->hashrate_ema );

  jcache_free ( rv->cache );
  jcache_free ( rv->cache_full );

  g_free ( rv->window_diff );

  g_rw_lock_clear ( &(rv->lock) );
  g_free ( rv );
}
