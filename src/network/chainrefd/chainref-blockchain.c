/*
 * chainref-blockchain.c
 *
 * Blockchain descriptor for chainref.
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
#include "chainref-blockchain.h"


/* global variables */
blockchain *BLOCKCHAIN;


/*
 * _create_pools_data
 */
#ifdef WITH_POOLS
static void
_append_pools_data ( view **varray,
                     gdouble *data )
{
  guint i;
  for ( i=0; i<NB_VIEW_LENGTHS; ++i )
    if ( varray[i] != NULL )
      view_append_single_data ( varray[i], data );
}

static store *
_create_pools_data ( const gchar *path,
                     const gchar *configname,
                     const gchar *fname,
                     view **varray )
{
  store *s;
  gchar *filename;

  filename = g_build_filename ( path, "blockchain", fname, NULL );
  s = store_new ( configname, filename );
  g_free ( filename );

  if ( s == NULL )
    {
      log_print ( "core: blockchain: unable to create store for \'%s\'.\n", fname );
      return NULL;
    }

  varray[VIEW_LENGTH_PER_BLOCK] = NULL;

  varray[VIEW_LENGTH_1_D] = view_new ( s, 3600*24, 1800 );
  varray[VIEW_LENGTH_1_W] = view_new ( s, 3600*24*7, 3600*1 );
  varray[VIEW_LENGTH_1_M] = view_new ( s, 3600*24*31, 3600*2 );
  varray[VIEW_LENGTH_3_M] = view_new ( s, 3600*24*92, 3600*6 );
  varray[VIEW_LENGTH_6_M] = view_new ( s, 3600*24*183, 3600*12 );
  varray[VIEW_LENGTH_1_Y] = view_new ( s, 3600*24*365, 3600*24 );
  varray[VIEW_LENGTH_2_Y] = view_new ( s, 3600*24*365*2, 3600*24*2 );
  varray[VIEW_LENGTH_4_Y] = view_new ( s, 3600*24*365*4, 3600*24*4 );
  varray[VIEW_LENGTH_ALL] = view_new ( s, 3600*24*365*VIEW_ALL_LIMIT, 3600*24*7 );

  if ( store_process_input_file(s, (store_line_process_func)_append_pools_data,varray) )
    {
      log_print ( "core: blockchain: unable to load \'%s\' data.\n", fname );
      return NULL;
    }

  return s;
}
#endif


/*
 * blockchain_new
 */

static void
_build_views ( blockchain *c )
{
  refblock *sb;
  guint current_line;
  guint i;

  current_line = 1; /* skip first line (genesis block) */
  sb = c->store->blocks_head;

  while ( sb != NULL )
    {
      for ( i=0; i<NB_VIEW_LENGTHS; ++i )
        refview_append_single_data_nolock ( c->views[i], sb->data[current_line] );

      ++current_line;

      /* move to next block if necessary */
      if ( sb->next_line == current_line )
        {
          current_line = 0;
          sb = sb->next_block;
        }
    }

  for ( i=0; i<NB_VIEW_LENGTHS; ++i )
    refview_sync_floating_line ( c->views[i], c->store->most_recent_data );
}

blockchain *
blockchain_new ( blockchain_id uid,
                 gchar *name,
                 gchar *path )
{
  blockchain *c;
  gchar *filename;
#ifdef WITH_POOLS
  gchar *configname;
#endif
  gboolean error;

  c = (blockchain *) g_malloc ( sizeof(blockchain) );

  c->uid = uid;
  c->name = g_strdup ( name );
  c->path = g_strdup ( path );

  filename = g_build_filename ( path, "blockchain", "data.csv", NULL );
  c->store = refstore_new ( filename );
  error = refstore_read_from_file ( c->store );

  if ( error )
    {
      log_print ( "core: store %s: unable to load store \'%s\'\n", c->name, filename );
      return NULL;
    }

  c->views[VIEW_LENGTH_PER_BLOCK] = refview_new ( c->store, 3600*6, 1, 224, 224 );
  c->views[VIEW_LENGTH_1_D] = refview_new ( c->store, 3600*24, 1800, 24, 24 );
  c->views[VIEW_LENGTH_1_W] = refview_new ( c->store, 3600*24*7, 3600*1, 24, 24 );
  c->views[VIEW_LENGTH_1_M] = refview_new ( c->store, 3600*24*31, 3600*2, 24, 24 );
  c->views[VIEW_LENGTH_3_M] = refview_new ( c->store, 3600*24*92, 3600*6, 16, 24 );
  c->views[VIEW_LENGTH_6_M] = refview_new ( c->store, 3600*24*183, 3600*12, 12, 16 );
  c->views[VIEW_LENGTH_1_Y] = refview_new ( c->store, 3600*24*365, 3600*24, 8, 6 );
  c->views[VIEW_LENGTH_2_Y] = refview_new ( c->store, 3600*24*365*2, 3600*24*2, 6, 4 );
  c->views[VIEW_LENGTH_4_Y] = refview_new ( c->store, 3600*24*365*4, 3600*24*4, 4, 4 );
  c->views[VIEW_LENGTH_ALL] = refview_new ( c->store, 3600*24*365*VIEW_ALL_LIMIT, 3600*24*7, 2, 2 );

  _build_views ( c );

  /* storage can bee freed after views init */
  refstore_clear ( c->store, FALSE );

  g_free ( filename );

  /* mining pools */
#ifdef WITH_POOLS
  configname = g_build_filename ( path, "blockchain", "pools.csv", NULL );

  c->pools_2016_store = _create_pools_data ( path, configname, "origin-2016.csv", c->pools_2016_views );

  if ( c->pools_2016_store == NULL )
    {
      log_print ( "core: blockchain: unable to load 2016 pools data.\n" );
      return NULL;
    }

  c->pools_672_store = _create_pools_data ( path, configname, "origin-672.csv", c->pools_672_views );

  if ( c->pools_672_store == NULL )
    {
      log_print ( "core: blockchain: unable to load 672 pools data.\n" );
      return NULL;
    }

  c->pools_224_store = _create_pools_data ( path, configname, "origin-224.csv", c->pools_224_views );

  if ( c->pools_224_store == NULL )
    {
      log_print ( "core: blockchain: unable to load 224 pools data.\n" );
      return NULL;
    }

  g_free ( configname );
#endif

  c->cache_block_ticker = jcache_new ( 2*7 );
  c->cache_block_ticker->start += sprintf ( c->cache_block_ticker->content, "{\"name\":\"%s\",", c->name );

  return c;
}


/*
 * blockchain_append_single_block_data
 */
void
blockchain_append_single_block_data ( blockchain *c,
                                      gdouble *data )
{
  guint i;
  refstore_append_single_data ( c->store, data );

  for ( i=0; i<NB_VIEW_LENGTHS; ++i )
    refview_append_single_data ( c->views[i], data );

  c->cache_block_ticker->dirty = TRUE;
}


/*
 * blockchain_append_single_pools_data
 */
#ifdef WITH_POOLS
void
blockchain_append_single_pools_data ( blockchain *c,
                                      const gint window,
                                      gdouble *data )
{
  guint i;
  store *s;
  view **varray;

  if ( window == 224 )
    {
      s = c->pools_224_store;
      varray = c->pools_224_views;
    }
  else if ( window == 2016 )
    {
      s = c->pools_2016_store;
      varray = c->pools_2016_views;
    }
  else
    {
      s = c->pools_672_store;
      varray = c->pools_672_views;
    }

  store_append_single_data ( s, data );

  for ( i=0; i<NB_VIEW_LENGTHS; ++i )
    if ( varray[i] != NULL )
      view_append_single_data ( varray[i], data );
}
#endif


/*
 * blockchain_write_json
 */
void
blockchain_write_json ( blockchain *c,
                        view_length_id lid,
                        gboolean sendFull,
                        const gdouble offset,
#ifdef WITH_POOLS
                        const gint pools_window,
#endif
                        FILE *f )
{
#ifdef WITH_POOLS
  view *v;
#endif

  fprintf ( f, "{\"name\":\"%s\",", c->name );
  fputs ( "\"stats\":", f );
  refview_write_json ( c->views[lid], sendFull, offset, f );

#ifdef WITH_POOLS
  if ( pools_window == 224 )
    v = c->pools_224_views[lid];
  else if ( pools_window == 2016 )
    v = c->pools_2016_views[lid];
  else
    v = c->pools_672_views[lid];

  if ( v != NULL )
    {
      fputs ( ",\"poolstats\":", f );
      view_write_json ( v, sendFull, offset, f );
    }
#endif

  fputc ( '}', f );
}


/*
 * blockchain_write_json_ticker
 */
void
blockchain_write_json_ticker ( blockchain *c,
                               FILE *f )
{
  gdouble data[STORE_MAX_NB_COLS];
  gdouble view_tick;
  gchar *ptr;

  if ( c->cache_block_ticker->dirty )
    {
      refstore_get_most_recent_data ( c->store, data );
      refview_get_moving_tick ( c->views[VIEW_LENGTH_1_M], (gdouble *) &view_tick );

      ptr = c->cache_block_ticker->start;

      ptr += sprintf ( ptr, "\"tick\":" );
      ptr += sprintf ( ptr, "{\"last\":" );
      print_float ( data[STORE_COLUMN_UID], 0, ptr );
      ptr += sprintf ( ptr, ",\"time\":" );
      print_float ( data[STORE_COLUMN_TIME], 1, ptr );
      ptr += sprintf ( ptr, ",\"diff\":" );
      print_float ( data[STORE_COLUMN_DIFFICULTY], 4, ptr );
      ptr += sprintf ( ptr, ",\"hrate\":" );
      print_float ( view_tick, 1, ptr );
      *ptr = '}';
      ++ptr;

      c->cache_block_ticker->end = ptr;
      c->cache_block_ticker->dirty = FALSE;
    }

  fwrite ( c->cache_block_ticker->content, sizeof(gchar), c->cache_block_ticker->end-c->cache_block_ticker->content, f );
#ifdef WITH_POOLS
  fputs ( ",\"pools\":", f );
  store_write_most_recent_data_json ( c->pools_672_store, 20, f );
#endif
  fputc ( '}', f );

  return;
}


/*
 * blockchain_free
 */
void
blockchain_free ( blockchain *c )
{
  guint i;

  g_free ( c->name );
  g_free ( c->path );

  for ( i=0; i<NB_VIEW_LENGTHS; ++i )
    if ( c->views[i] != NULL )
      refview_free ( c->views[i] );

  refstore_free ( c->store );

#ifdef WITH_POOLS
  for ( i=0; i<NB_VIEW_LENGTHS; ++i )
    {
      if ( c->pools_2016_views[i] != NULL )
        view_free ( c->pools_2016_views[i] );

      if ( c->pools_672_views[i] != NULL )
        view_free ( c->pools_672_views[i] );

      if ( c->pools_224_views[i] != NULL )
        view_free ( c->pools_224_views[i] );
    }

  store_free ( c->pools_2016_store );
  store_free ( c->pools_672_store );
  store_free ( c->pools_224_store );
#endif

  jcache_free ( c->cache_block_ticker );

  g_free ( c );
}
