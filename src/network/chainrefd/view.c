/*
 * view.c
 *
 * Generic database view
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
#include "view.h"


/*
 * vblock
 */

/*
 * vblock_new
 * todo: use glib memory pool
 */
vblock *
vblock_new ( guint nb_cols )
{
  guint i;
  vblock *vb;

  vb = g_malloc ( sizeof(vblock) );

  for ( i=0; i<VIEW_BLOCK_SIZE; ++i )
    vb->data[i] = g_malloc ( nb_cols*sizeof(gdouble) );

  vb->nb_cols = nb_cols;
  vb->next_line = 0;
  vb->next_block = NULL;
  vb->prev_block = NULL;
  return vb;
}


/*
 * vblock_append
 */
gboolean
vblock_append ( vblock *vb,
                gdouble *data )
{
  memcpy ( vb->data[vb->next_line], data, vb->nb_cols*sizeof(gdouble) );
  vb->next_line++;
  return FALSE;
}


/*
 * vblock_dump
 */
void
vblock_dump ( vblock *vb,
              FILE *f )
{
  guint i, j;

  for ( i=0; i<vb->next_line; ++i )
    {
      for ( j=0; j<(vb->nb_cols-1); ++j )
        fprintf ( f, "%f ", vb->data[i][j] );
      fprintf ( f, "%f\n ", vb->data[i][j] );
    }
}


/*
 * vblock_free
 */
void
vblock_free ( vblock *vb )
{
  guint i;

  for ( i=0; i<VIEW_BLOCK_SIZE; ++i )
    g_free ( vb->data[i] );

  g_free ( vb );
}


/*
 * vblocks list utils
 */
vblock *
vblocks_prune ( vblock *head,
                gdouble minimum_time )
{
  /* we MUST have at least two blocks when this is called */
  if ( head->data[VIEW_BLOCK_SIZE-1][VIEW_COLUMN_TIMESTAMP] < minimum_time )
    {
      vblock *ret = head->next_block;
      ret->prev_block = NULL;
      vblock_free ( head );
      return ret;
    }

  return head;
}

void
vblocks_list_clear ( vblock *head )
{
  vblock *next;

  while ( head != NULL )
    {
      next = head->next_block;
      vblock_free ( head );
      head = next;
    }
}



/* view */

/*
 * view_new
 */
view *
view_new ( store *store,
           gdouble length,
           gdouble precision )
{
  view *v;

  v = (view *) g_malloc ( sizeof(view) );

  v->store = store;

  v->nb_cols = store->nb_cols;
  v->cols = NULL; /*todo : allow customization and use GList_alloc ( ); */

  v->current_line = g_malloc ( v->nb_cols * sizeof(gdouble) );
  v->current_line_most_recent_data = g_malloc ( v->nb_cols * sizeof(gdouble) );

  v->most_recent_entry = 0;

  v->length = length;
  v->precision = precision;

  /*expected number of entries : v->nb_entries = 1 + (guint) ceil(length/precision);*/

  v->blocks_head = vblock_new ( v->nb_cols );
  v->blocks_tail = v->blocks_head;

  g_rw_lock_init ( &(v->lock) );

  return v;
}


/*
 * view_append_single_data
 */
void
view_append_single_data ( view *v,
                          gdouble *data )
{
  vblock *vb;
  guint i;

  g_rw_lock_writer_lock ( &(v->lock) );

  if ( (data[STORE_COLUMN_TIMESTAMP] - v->most_recent_entry) <= v->precision )
    {
      for ( i=0; i<v->store->nb_cols; ++i )
        v->current_line[i] += data[i];

      /* todo: add update of view additional columns */

      v->current_nb_values++;
    }
  else
    {
      if ( v->most_recent_entry > 0 )
        {
          for ( i=0; i<v->store->nb_cols; ++i )
            v->current_line[i] = v->current_line[i] / v->current_nb_values;

          /* todo: add update of view additional columns */

          if ( vblock_is_full(v->blocks_tail) )
            {
              vb = vblock_new ( v->nb_cols );
              v->blocks_tail->next_block = vb;
              vb->prev_block = v->blocks_tail;
              v->blocks_tail = vb;
#ifndef _WITHOUT_PRUNING
              /* we always have at least two vblocks when reaching this point */
              v->blocks_head = vblocks_prune ( v->blocks_head, v->current_line[VIEW_COLUMN_TIMESTAMP]-(v->length+1) );
              /* after that, v->current_line will be pushed ; thus it will always contain at least one line of data */
#endif
            }

          vblock_append ( v->blocks_tail, v->current_line );
          v->nb_entries++;
        }

      /* and store new data in a fresh line */
      for ( i=0; i<v->store->nb_cols; ++i )
        v->current_line[i] = data[i];

      /* todo: add update of view additional columns */

      v->current_nb_values = 1;
      v->most_recent_entry = data[STORE_COLUMN_TIMESTAMP];
    }

  for ( i=0; i<v->nb_cols; ++i )
    v->current_line_most_recent_data[i] = v->current_line[i] / v->current_nb_values;

  g_rw_lock_writer_unlock ( &(v->lock) );
}


/*
 * view_get_moving_tick
 */
void
view_get_moving_tick ( view *v,
                       gdouble *data )
{
  vblock *vb;
  guint i;

  g_rw_lock_reader_lock ( &(v->lock) );

  vb = v->blocks_tail;

  if ( vblock_is_empty(vb) )
    {
      if ( vblock_is_list_head(vb) )
        {
          g_rw_lock_reader_unlock ( &(v->lock) );
          bzero ( data, v->nb_cols * sizeof(gdouble) );
          return;
        }

      vb = vb->prev_block;
    }

  /* todo: replace by actual moving tick */
  for ( i=0; i<v->nb_cols; ++i )
    data = v->current_line_most_recent_data;

  g_rw_lock_reader_unlock ( &(v->lock) );
}


/*
 * view_dump
 */
void
view_dump ( view *v,
            FILE *f )
{
  vblock *vb;

  /*
  for ( iter=g_list_first(s->cols); iter!=NULL; iter=g_list_next(s->cols) )
    fprintf ( f, "%s ", (gchar *) iter->data );
  fputc ( '\n', f );
  */

  for ( vb=v->blocks_head; vb!=NULL; vb=vb->next_block )
    vblock_dump ( vb, f );

  fflush ( f );
}


/*
 * view_lookup_time
 */
#undef DEBUG_VIEW_JSON
#undef PROFILE_VIEW_JSON

void
view_lookup_time ( view *v,
                   const gdouble offset,
                   vblock **retb,
                   gint *retj )
{
  gint j;
  vblock *vb;
#ifdef PROFILE_VIEW_JSON
  GTimer *timer;
  gdouble duration;
  gulong residual;
  timer = g_timer_new ( );
  g_timer_start ( timer );
#endif

  /* search for block */
  vb = v->blocks_tail;
  j = 0; /* safe default to turn-off compilation warning */

  if ( ( vb->next_line == 0 ) && ( vb != NULL ) )
    vb = vb->prev_block;

  while ( vb != NULL )
    {
      if ( vb->data[0][VIEW_COLUMN_TIMESTAMP] < offset )
        break;

      if ( vb->prev_block != NULL )
        vb = vb->prev_block;
      else
        break;
    }

  /* search for entry */
  while ( vb != NULL )
    {
      for ( j=(vb->next_line-1); j>=0; --j )
        {
#ifdef DEBUG_VIEW_JSON
          fprintf ( stderr, "comparing offset=%f with time=%f at position %d\n", offset, vb->data[j][VIEW_COLUMN_TIMESTAMP], j );
#endif
          if ( vb->data[j][VIEW_COLUMN_TIMESTAMP] < offset )
            break;
        }

      if ( j >= 0 )
        {
#ifdef DEBUG_VIEW_JSON
          fprintf ( stderr, "found offset=%f at position %d\n", offset, j );
#endif
        if ( vb->data[j][VIEW_COLUMN_TIMESTAMP] < offset )
          break;
        }

      if ( ( j < 0 ) && ( vb->prev_block != NULL ) )
        vb = vb->prev_block;
      else
        break;
    }

#ifdef DEBUG_VIEW_JSON
  fprintf ( stderr, "after seek : j=%d ; block: %lX ; next_line=%u\n", j, vb, vb->next_line );
#endif

  ++j;
  if ( j >= vb->next_line )
    {
      j = 0;
      vb = vb->next_block;
    }

#ifdef PROFILE_VIEW_JSON
  g_timer_stop ( timer );
  duration = g_timer_elapsed ( timer, &residual );
  fprintf ( stderr, "profile: lookup_time: %f ms + %lu µs\n", duration*1000, residual );
  g_timer_destroy ( timer );
#endif

  *retb = vb;
  *retj = j;
  return;
}


/* todo: adapt column format, it may be necessary to have something else than %.0f */
#define print_json_line(d,nbc,extra)                                    \
  {                                                                     \
    fputc ( '[', f );                                                   \
    fprintf ( f, "%.0f", d[0] );                                        \
    for ( k=1; k<nbc; ++k )                                             \
      fprintf ( f, ",%.0f",d[k] );                                      \
    fprintf ( f, "]%c", extra );                                        \
  }

static void
write_json ( view *v,
             gboolean sendFull,
             const gdouble offset,
             FILE *f )
{
  gint j, k;
  vblock *vb;

  fputc ( '[', f );

  if ( sendFull )
    {
      /* send multiple lines, according to offset */

      GList *iter = g_list_first ( v->store->cols );
      fprintf ( f, "[\"%s\"", (gchar *) iter->data );
      for ( iter=g_list_next(iter); iter!=NULL; iter=g_list_next(iter) )
        fprintf ( f, ",\"%s\"", (gchar *) iter->data );
      fputs ( "],", f );

      view_lookup_time ( v, offset, &vb, &j );

      /* dump block which contains offset */
      if ( vblock_is_full(vb) )
        {
          for ( ; j<VIEW_BLOCK_SIZE; ++j )
            print_json_line ( vb->data[j], v->nb_cols, ',' );

          if ( vb->next_block != NULL )
            {
              vb = vb->next_block;
              j = 0;
            }
        }
      else
        {
          for ( ; j<vb->next_line; ++j )
            print_json_line ( vb->data[j], v->nb_cols, ',' );
        }

      /* if more blocks to print, then process them */
      if ( j < vb->next_line )
        {
          for ( ; vb!=NULL; vb=vb->next_block )
            {
              if ( vblock_is_full(vb) )
                {
                  for ( j=0; j<VIEW_BLOCK_SIZE; ++j )
                    print_json_line ( vb->data[j], v->nb_cols, ',' );

                  if ( vb->next_block == NULL )
                    break;
                }
              else
                {
                  for ( j=0; j<vb->next_line; ++j )
                    print_json_line ( vb->data[j], v->nb_cols, ',' );
                }
            }
        }
    }
  else
    {
      /* send only last line */

      vb = v->blocks_tail;
      j = 0; /* safe default to turn-off compilation warning */

      if ( vb != NULL )
        {
          if ( vblock_is_empty(vb) )
            {
              vb = vb->prev_block;
              j = VIEW_BLOCK_SIZE - 1;
            }
          else
            j = vb->next_line - 1;

          print_json_line ( vb->data[j], v->nb_cols, ',' );
        }
    }

  print_json_line ( v->current_line_most_recent_data, v->nb_cols, ']' );
}


void
view_write_json ( view *v,
                  gboolean sendFull,
                  const gdouble user_offset,
                  FILE *f )
{
  gdouble offset;

#ifdef DEBUG_VIEW_JSON
  fprintf ( stderr, "user offset=%f\n", user_offset );
#endif

  g_rw_lock_reader_lock ( &(v->lock) );

  if ( user_offset == -1 )
    offset = v->most_recent_entry - v->length;
  else if ( user_offset > v->most_recent_entry )
    offset = v->most_recent_entry - 60;
  else
    offset = user_offset;

#ifdef DEBUG_VIEW_JSON
  fprintf ( stderr, "final offset=%f\n", offset );
#endif

  write_json ( v, sendFull, offset, f );

  g_rw_lock_reader_unlock ( &(v->lock) );
}


/*
 * view_free
 */
void
view_free ( view *v )
{
  g_free ( v->current_line );
  g_free ( v->current_line_most_recent_data );
  vblocks_list_clear ( v->blocks_head );
  g_rw_lock_clear ( &(v->lock) );
  g_free ( v );
}
