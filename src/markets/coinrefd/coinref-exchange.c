/*
 * coinref-exchange.c
 *
 * Exchange descriptor for coinref.
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
#include "coinref-exchange.h"


/* global variables */

guint nb_exchanges = 0;

exchange *EXCHANGES[EXCH_NB_MAX];

GHashTable *EXCH_TABLE = NULL;

struct exchange_desc_st
{
  gchar *name;
  gchar *desc;
};
typedef struct exchange_desc_st exchange_desc;

exchange_desc EXCH_DESC[EXCH_NB_MAX];


/*
 * exchange_new
 */

static void
_append_data_to_views ( exchange *e,
                        gdouble *d )
{
  guint i;
  for ( i=0; i<NB_VIEW_LENGTHS; ++i )
    refview_append_single_data_nolock ( e->views[i], d );
}

static void
_finalize_views ( exchange *e )
{
  guint i;
  for ( i=0; i<NB_VIEW_LENGTHS; ++i )
    refview_sync_floating_line ( e->views[i], e->store->most_recent_data );
}

#undef PROFILE_EXCHANGE_NEW

exchange *
exchange_new ( const guint uid,
               const gchar *name,
               const gchar *desc,
               const gchar *path )
{
  exchange *e;
  gchar *filename, *path_asks, *path_bids;
  gboolean error;

#ifdef PROFILE_EXCHANGE_NEW
  GTimer *timer;
  gdouble duration_store;
  gdouble duration_clear;
  timer = g_timer_new ( );
#endif

  e = (exchange *) g_malloc ( sizeof(exchange) );

  e->uid = uid;
  e->name = g_strdup ( name );
  e->desc = g_strdup ( desc );
  e->path = g_strdup ( path );

#ifdef PROFILE_EXCHANGE_NEW
  g_timer_start ( timer );
#endif

  filename = g_build_filename ( path, name, "data.csv", NULL );

  e->store = refstore_new ( filename, (refstore_cb_append *) _append_data_to_views, e );

  e->views[VIEW_LENGTH_10_MN] = refview_new ( e->store, 't', "10min", 600, "10s", 10 );
  e->views[VIEW_LENGTH_1_H] = refview_new ( e->store, 'h', "1h", 3600, "30s", 30 );
  e->views[VIEW_LENGTH_2_H] = refview_new ( e->store, 'a', "2h", 3600*2, "1m", 60 );
  e->views[VIEW_LENGTH_4_H] = refview_new ( e->store, 'o', "4h", 3600*4, "2m", 120 );
  e->views[VIEW_LENGTH_8_H] = refview_new ( e->store, 's', "8h", 3600*8, "3m", 180 );
  e->views[VIEW_LENGTH_12_H] = refview_new ( e->store, 'n', "12h", 3600*12, "5m", 300 );
  e->views[VIEW_LENGTH_1_D] = refview_new ( e->store, 'd', "1d", 3600*24, "10m", 600 );
  e->views[VIEW_LENGTH_3_D] = refview_new ( e->store, 'r', "3d", 3600*24*3, "30m", 600*3 );
  e->views[VIEW_LENGTH_1_W] = refview_new ( e->store, 'w', "1w", 3600*24*7, "1h", 3600 );
  e->views[VIEW_LENGTH_2_W] = refview_new ( e->store, 'q', "2w", 3600*24*14, "2h", 3600*2 );
  e->views[VIEW_LENGTH_1_M] = refview_new ( e->store, 'm', "1m", 3600*24*31, "6h", 3600*6 );
  e->views[VIEW_LENGTH_3_M] = refview_new ( e->store, 'e', "3m", 3600*24*92, "12h", 3600*12 );
  e->views[VIEW_LENGTH_6_M] = refview_new ( e->store, 'b', "6m", 3600*24*183, "1d", 3600*24 );
  e->views[VIEW_LENGTH_1_Y] = refview_new ( e->store, 'y', "1y", 3600*24*365, "2d", 3600*24*2 );
  e->views[VIEW_LENGTH_2_Y] = refview_new ( e->store, 'z', "2y", 3600*24*365*2, "4d", 3600*24*4 );
  e->views[VIEW_LENGTH_4_Y] = refview_new ( e->store, 'f', "4y", 3600*24*365*4, "1w", 3600*24*7 );

#ifdef _WITH_STORE_GZIP_PACKS
  error = refstore_read_from_filez ( e->store );
#else
  error = refstore_read_from_file ( e->store );
#endif

  if ( error )
    log_print ( "core: store %s: unable to load store \'%s\'\n", e->name, filename );

  _finalize_views ( e );

#ifdef PROFILE_EXCHANGE_NEW
  g_timer_stop ( timer );
  duration_store = g_timer_elapsed ( timer, NULL );
  g_timer_start ( timer );
#endif

  refstore_clear ( e->store, FALSE ); /* in case it is fully in-memory, storage can bee freed after views init */

#ifdef PROFILE_EXCHANGE_NEW
  g_timer_stop ( timer );
  duration_clear = g_timer_elapsed ( timer, NULL );
  log_print ( "profile: %s: store=%.1fms  clear=%.1fms\n", name, duration_store*1000, duration_clear*1000 );
  g_timer_destroy ( timer );
#endif

#ifdef _WITH_BOOK_STAMP
  path_asks = g_build_filename ( path, name, "asks", NULL );
  path_bids = g_build_filename ( path, name, "bids", NULL );
#else
  path_asks = g_build_filename ( path, name, "asks.csv", NULL );
  path_bids = g_build_filename ( path, name, "bids.csv", NULL );
#endif

  e->book = refbook_new ( path_asks, path_bids );

#ifdef _WITH_BOOK_STAMP
  error = refbook_read_from_files ( e->book, NULL );
#else
  error = refbook_read_from_files ( e->book );
#endif

  e->cache_ticker = jcache_new ( 2*7 );
  e->cache_ticker->start += sprintf ( e->cache_ticker->content, "\"%s\":{", e->name );

  if ( error )
    log_print ( "core: book %s: unable to load initial book\n", e->name );

  g_free ( filename );
  g_free ( path_asks );
  g_free ( path_bids );
  return e;
}


/*
 * exchange_estimate_mem_size
 */
void
exchange_estimate_mem_size ( exchange *e )
{
  gint i;
  refblock *rb;
  viewblock *vb;
  gint nb_blocks;
  gdouble size = 0;

  for ( i=0; i<NB_VIEW_LENGTHS; ++i )
    {
      nb_blocks = 1;
      vb = e->views[i]->blocks_head;
      while ( vb !=NULL )
        {
          vb = vb->next_block;
          ++nb_blocks;
        }
      size +=(nb_blocks*VIEW_BLOCK_SIZE*sizeof(gdouble)*VIEW_BLOCK_COLS) / 1024.0;
      log_print ( "%s: view[%d]: %d blocks (size= %d Kbytes)\n", e->name, i, nb_blocks, (nb_blocks*VIEW_BLOCK_SIZE*sizeof(gdouble)*VIEW_BLOCK_COLS)/1024 );
    }

  nb_blocks = 1;
  rb = e->store->blocks_head;
  while ( rb !=NULL )
    {
      rb = rb->next_block;
      ++nb_blocks;
    }
  size +=(nb_blocks*STORE_BLOCK_SIZE*sizeof(gdouble)*STORE_BLOCK_COLS) / 1024.0;
  log_print ( "%s: store: %d blocks (size= %d Kbytes)\n", e->name, nb_blocks, (nb_blocks*STORE_BLOCK_SIZE*sizeof(gdouble)*STORE_BLOCK_COLS)/1024 );

  size +=(e->book->shadow_nb_asks_entries * sizeof(gdouble) * 2) / 1024.0;
  size +=(e->book->shadow_nb_bids_entries * sizeof(gdouble) * 2) / 1024.0;
  log_print ( "%s: %.2f Mbytes\n", e->name, size/1024 );
}


/*
 * exchange_append_single_data
 */
void
exchange_append_single_data ( exchange *e,
                              gdouble *data )
{
  guint i;
  refstore_append_single_data ( e->store, data );

  for ( i=0; i<NB_VIEW_LENGTHS; ++i )
    refview_append_single_data ( e->views[i], data );

  e->cache_ticker->dirty = TRUE;
}


/*
 * exchange_read_new_book
 */
#ifdef _WITH_BOOK_STAMP
void
exchange_read_new_book ( exchange *e,
                         const gchar *stamp )
{
  if ( refbook_read_from_files(e->book,stamp) )
    log_print ( "core: book %s: unable to load book %s\n", e->name, stamp );
}
#else
void
exchange_read_new_book ( exchange *e )
{
  if ( refbook_read_from_files(e->book) )
    log_print ( "core: book %s: unable to load book\n", e->name );
}
#endif


/*
 * exchange_write_config_json
 */
void
exchange_write_config_json ( exchange *e,
                             FILE *f )
{
  fprintf ( f, "{\"name\":\"%s\",\"desc\":\"%s\",\"uid\":%lu}", e->name, e->desc, ((unsigned long int)1)<<e->uid );
}


/*
 * exchange_write_json
 */
void
exchange_write_json ( exchange *e,
                      view_mode_id mid,
                      view_length_id lid,
                      gboolean sendFull,
                      gboolean sendBook,
                      const gdouble offset,
                      FILE *f )
{
  fprintf ( f, "{\"name\":\"%s\",\"stats\":", e->name );
  refview_write_json ( e->views[lid], mid, sendFull, offset, f );

  fputs ( ",\"book\":", f );
  if ( sendBook )
    refbook_write_json ( e->book, f );
  else
    fputs ( "null", f );

  fputc ( '}', f );
}


/*
 * exchange_write_json_ticker
 */
void
exchange_write_json_ticker ( exchange *e,
                             FILE *f )
{
  gdouble data[STORE_BLOCK_COLS];
  gdouble window1d[3];
  gchar *ptr;

  if ( e->cache_ticker->dirty )
    {
      refstore_get_most_recent_data ( e->store, data );
      refview_get_window_tick ( e->views[VIEW_LENGTH_1_D], (gdouble *) &window1d );

      ptr = e->cache_ticker->start;

      ptr += sprintf ( ptr, "\"last\":" );
      print_float ( data[STORE_COLUMN_PRICE], 4, ptr );
      ptr += sprintf ( ptr, ",\"open\":" );
      print_float ( window1d[0], 4, ptr );
      ptr += sprintf ( ptr, ",\"avg\":" );
      print_float ( window1d[1], 4, ptr );
      ptr += sprintf ( ptr, ",\"ask\":" );
      print_float ( data[STORE_COLUMN_TOP_ASK], 4, ptr );
      ptr += sprintf ( ptr, ",\"bid\":" );
      print_float ( data[STORE_COLUMN_TOP_BID], 4, ptr );
      ptr += sprintf ( ptr, ",\"volume\":" );
      print_float ( window1d[2], 4, ptr );
      ptr += sprintf ( ptr, ",\"rusd\":" );
      print_float ( data[STORE_COLUMN_USD_CONVRATE], 7, ptr );

      *ptr = '}';
      ++ptr;
      e->cache_ticker->end = ptr;

      e->cache_ticker->dirty = FALSE;
    }

  fwrite ( e->cache_ticker->content, sizeof(gchar), e->cache_ticker->end-e->cache_ticker->content, f );
  return;
}


/*
 * exchange_free
 */
void
exchange_free ( exchange *e )
{
  guint i;

  g_free ( e->name );
  g_free ( e->desc );
  g_free ( e->path );

  for ( i=0; i<NB_VIEW_LENGTHS; ++i )
    refview_free ( e->views[i] );

  refstore_free ( e->store );
  refbook_free ( e->book );
  jcache_free ( e->cache_ticker );

  g_free ( e );
}



/* exchanges */


/*
 * exchanges loading system (multi-threaded)
 * beware: the more loaders, the more memory usage peaks
 */
#ifndef NB_LOADERS
#define NB_LOADERS 2
#endif

#define CONFIG_FILENAME "conf/coinorama.conf"
#define CONFIG_HEADER   "[markets]\n"

#undef PROFILE_EXCHANGES_LOADING

gpointer
exchanges_loader_run ( guint *uid )
{
  guint i;
  for ( i=*uid; i<nb_exchanges; i+=NB_LOADERS ) /* warning: this requires a valid nb_exchanges value */
    {
      /* log_print ( "core: loading exchange \'%s\'\n", EXCH_DESC[i].name ); */
      EXCHANGES[i] = exchange_new ( i, EXCH_DESC[i].name, EXCH_DESC[i].desc, "data" );
    }
  return NULL;
}

gboolean
exchanges_load_config ( void )
{
  GMappedFile *f;
  GKeyFile *kf;
  GError *error = NULL;
  gsize flen, len_config;
  gchar *config;
  gchar *finput;
  gchar *exch_name_str;
  gchar **exch_name_str_list;
  gchar *exch_desc_str;
  gchar **exch_desc_str_list;
  gint i;

  /* read configuration file */
  f = g_mapped_file_new ( CONFIG_FILENAME, FALSE, &error );

  if ( f == NULL )
    {
      log_print ( "error: exchanges_load_config(): file \'%s\' cannot be read: %s\n", CONFIG_FILENAME, error->message  );
      g_error_free ( error );
      return TRUE;
    }

  flen = g_mapped_file_get_length ( f );
  len_config = strlen(CONFIG_HEADER) + flen + 1;

  /* copy configuration in a buffer after prepending a key-file group name to make GLib happy */
  config = (gchar *) g_malloc ( sizeof(gchar) * len_config );
  strcpy ( config, CONFIG_HEADER );
  finput = g_mapped_file_get_contents ( f );
  memcpy ( config+strlen(CONFIG_HEADER), finput, flen );
  g_mapped_file_unref ( f );
  config[len_config-1] = '\0';

  /* parse configuration file to get exchanges list */
  kf = g_key_file_new ( );
  g_key_file_load_from_data ( kf, config, len_config, G_KEY_FILE_NONE, &error );

  if ( error != NULL )
    {
      log_print ( "error: exchanges_load_config(): unable to parse config file \'%s\': %s\n", CONFIG_FILENAME, error->message  );
      g_error_free ( error );
      return TRUE;
    }

  exch_name_str = g_key_file_get_string ( kf, "markets", "EXCHANGES", &error );

  if ( exch_name_str == NULL )
    {
      log_print ( "error: exchanges_load_config(): unable to find \'EXCHANGES\' key\n"  );
      return TRUE;
    }

  if ( exch_name_str[0] == '\"' )
    exch_name_str[0] = ' '; /* remove \" characters */
  if ( exch_name_str[strlen(exch_name_str)-1] == '\"' )
    exch_name_str[strlen(exch_name_str)-1] = ' ';

  exch_desc_str = g_key_file_get_string ( kf, "markets", "EXCHANGES_DESC", &error );

  if ( exch_desc_str == NULL )
    {
      log_print ( "error: exchanges_load_config(): unable to find \'EXCHANGES_DESC\' key\n"  );
      return TRUE;
    }

  if ( exch_desc_str[0] == '\"' )
    exch_desc_str[0] = ' '; /* remove \" characters */
  if ( exch_desc_str[strlen(exch_desc_str)-1] == '\"' )
    exch_desc_str[strlen(exch_desc_str)-1] = ' ';

  /* build EXCH_DESC array */
  exch_name_str_list = g_strsplit_set ( exch_name_str, " ", 0 );
  exch_desc_str_list = g_strsplit_set ( exch_desc_str, " ", 0 );

  for ( i=0; i<EXCH_NB_MAX; ++i )
    {
      if ( exch_name_str_list[i] == NULL )
        break;

      if ( strlen(exch_name_str_list[i]) == 0 )
        continue;

      /* log_print ( "core: adding exchange \'%s\'\n", exch_name_str_list[i] ); */
      EXCH_DESC[nb_exchanges].name = g_strdup ( exch_name_str_list[i] );

      if ( ( exch_desc_str_list[i] != NULL ) && ( strlen(exch_desc_str_list[i]) > 0 ) )
        EXCH_DESC[nb_exchanges].desc = g_strdup ( exch_desc_str_list[i] );
      else
        EXCH_DESC[nb_exchanges].desc = g_strdup ( exch_name_str_list[i] );

      ++nb_exchanges;
    }

  /* clean up */
  g_key_file_free ( kf );
  g_free ( config );
  g_free ( exch_name_str );
  g_free ( exch_desc_str );
  g_strfreev ( exch_name_str_list );
  g_strfreev ( exch_desc_str_list );

  return FALSE;
}

gboolean
exchanges_load ( void )
{
  gint i;
  GThread *loaders[NB_LOADERS];
  guint loaders_id[NB_LOADERS];

#ifdef PROFILE_EXCHANGES_LOADING
  GTimer *timer;
  gdouble duration;
  timer = g_timer_new ( );
#endif

  /* load configuration */
  if ( exchanges_load_config() )
    return TRUE;

  if ( nb_exchanges == 0 )
    {
      log_print ( "error: exchanges_load(): no exchanges to load\n"  );
      return TRUE;
    }

  /* spawn threads for exchanges data loading */
  log_print ( "core: loading %d exchanges with %d thread(s)\n", nb_exchanges, NB_LOADERS );

  for ( i=0; i<NB_LOADERS; ++i )
    {
      loaders_id[i] = i;
      loaders[i] = g_thread_new ( "exchloader", (GThreadFunc) exchanges_loader_run, &loaders_id[i] );
    }

  for ( i=0; i<NB_LOADERS; ++i )
    g_thread_join ( loaders[i] );

  /* feed hash table */
  EXCH_TABLE = g_hash_table_new ( g_str_hash, g_str_equal );
  for ( i=0; i<nb_exchanges; ++i )
    g_hash_table_insert ( EXCH_TABLE, EXCHANGES[i]->name, EXCHANGES[i] );

#ifdef PROFILE_EXCHANGES_LOADING
  g_timer_stop ( timer );
  duration = g_timer_elapsed ( timer, NULL );
  log_print ( "profile: markets: loading=%.1fms\n", duration*1000 );
  g_timer_destroy ( timer );
#endif

  return FALSE;
}


/*
 * exchanges_get_stats
 */
gdouble
exchanges_get_stats ( void )
{
  guint i;
  gdouble nb_samples = 0;

  for ( i=0; i<nb_exchanges; ++i )
    if ( EXCHANGES[i] != NULL )
      nb_samples += (gdouble) EXCHANGES[i]->store->nb_entries;

  return nb_samples;
}


/*
 * exchanges_write_json_config
 */
void
exchanges_write_json_config ( FILE *f )
{
  guint i;
  exchange *e = NULL;

  fputs ( "\"config\":{", f );

  /* exchanges list */
  fputs ( "\"markets\":[", f );

  for ( i=0; i<nb_exchanges; ++i )
    {
      e = EXCHANGES[i];
      if ( e != NULL )
        {
          if ( i > 0 )
            fputc ( ',', f );
          exchange_write_config_json ( e, f );
        }
    }

  fputs ( "],", f );

  /* views list */
  fputs ( "\"views\":[", f );

  e = EXCHANGES[0];
  for ( i=0; i<NB_VIEW_LENGTHS; ++i )
    {
      if ( i > 0 )
        fputc ( ',', f );
      refview_write_config_json ( e->views[i], f );
    }

  fputs ( "]}", f );

  return;
}


/*
 * exchanges_write_ticker_json
 */
void
exchanges_write_json_ticker ( FILE *f )
{
  guint i;

  fputs ( "\"ticks\":{", f );

  for ( i=0; i<nb_exchanges; ++i )
    {
      if ( i > 0 )
        fputc ( ',', f );
      exchange_write_json_ticker ( EXCHANGES[i], f );
    }

  fputc ( '}', f );
}


/*
 * exchanges_lookup_by_name
 * this can be made static with utils/gperf_exch_table.sh which relies on gperf
 */
exchange *
exchanges_lookup_by_name ( const gchar *str )
{
  exchange *e = g_hash_table_lookup ( EXCH_TABLE, str );

  if ( e == NULL )
    log_print ( "warning: exchanges_lookup_by_name(): unknown exchange \'%s\'\n", str  );

  return e;
}


/*
 * exchanges_lookup_by_uid
 */
exchange *
exchanges_lookup_by_uid ( const gchar *uid )
{
  long int nuid;

  nuid =  __builtin_ctzl ( strtoul(uid,NULL,10) );

  if ( ( nuid < 0 ) || ( nuid >= nb_exchanges ) )
    return NULL;

  return EXCHANGES[nuid];
}


/*
 * exchanges_lookup_multi_by_uid
 */
gint
exchanges_lookup_multi_by_uid ( const gchar *uids,
                                exchange **exch )
{
  unsigned long int nuids, nuid;
  gint nb_exch = 0;

  nuids = strtoul ( uids, NULL, 10 );

  if ( nuids < 0 )
    return 0;

  while ( ( nuids != 0 ) && ( nb_exch < EXCH_NB_MAX_MULTI ) )
    {
      nuid =  __builtin_ctzl ( nuids );

      nuids = nuids ^ (((unsigned long int)1) << nuid);

      if ( ( nuid >= 0 ) && ( nuid < nb_exchanges ) )
        {
          exch[nb_exch] = EXCHANGES[nuid];
          ++nb_exch;
        }
    }

  return nb_exch;
}


/*
 * exchanges_free
 */
void
exchanges_free ( void )
{
  guint i;

  for ( i=0; i<nb_exchanges; ++i )
    {
      exchange_free ( EXCHANGES[i] );
      g_free ( EXCH_DESC[i].name );
      g_free ( EXCH_DESC[i].desc );
    }

  g_hash_table_destroy ( EXCH_TABLE );
}
