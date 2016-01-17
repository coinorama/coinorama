/*
 * store.c
 *
 * Generic Timeseries Storage
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
#include "store.h"


/*
 * block
 */

/*
 * block_new
 * todo: use glib memory pool
 */
block *
block_new ( const guint nb_cols )
{
  guint i;
  block *b;

  b = g_malloc ( sizeof(block) );

  for ( i=0; i<STORE_BLOCK_SIZE; ++i )
    b->data[i] = g_malloc ( nb_cols*sizeof(gdouble) );

  b->nb_cols = nb_cols;
  b->next_line = 0;
  b->next_block = NULL;
  b->prev_block = NULL;
  return b;
}


/*
 * block_append
 */
gboolean
block_append ( block *b,
               gdouble *data )
{
  memcpy ( b->data[b->next_line], data, b->nb_cols*sizeof(gdouble) );
  b->next_line++;
  return FALSE;
}


/*
 * block_generate_data_from_text
 */
void
block_generate_data_from_text ( gchar *text,
                                gdouble *data,
                                const guint nb_cols )
{
  guint j;
  gchar *begin = text;
  gchar *endptr;

  begin = text;

  for ( j=0; j<nb_cols; ++j )
    {
      data[j] = strtod ( begin, &endptr );
      begin = endptr + 1;
    }
}


/*
 * block_load_from_text
 */
guint
block_load_from_text ( block *b,
                       gchar *data,
                       gchar **end,
                       guint nb_entries )
{
  guint i, j;
  const gchar *begin = data;
  gchar *endptr = data;
  const guint limit = min ( nb_entries, STORE_BLOCK_SIZE );

  if ( block_is_full(b) )
    return 0;

   /* read */
  for ( i=0, begin=data; i<limit; ++i )
    {
      for ( j=0; j<b->nb_cols; ++j )
        {
          b->data[i][j] = strtod ( begin, &endptr );
          begin = endptr + 1;
        }
    }

  *end = endptr;
  b->next_line = i;
  return limit;
}


/*
 * block_dump
 */
void
block_dump ( block *b,
             FILE *f )
{
  guint i, j;

  for ( i=0; i<b->next_line; ++i )
    {
      for ( j=0; j<(b->nb_cols-1); ++j )
        fprintf ( f, "%f ", b->data[i][j] );
      fprintf ( f, "%f\n ", b->data[i][j] );
    }
}


/*
 * block_free
 */
void
block_free ( block *b )
{
  guint i;

  for ( i=0; i<STORE_BLOCK_SIZE; ++i )
    g_free ( b->data[i] );

  g_free ( b );
}


/*
 * blocks list utils
 */
void
blocks_list_clear ( block *head )
{
  block *next;

  while ( head != NULL )
    {
      next = head->next_block;
      block_free ( head );
      head = next;
    }
}



/*
 * store
 */

/*
 * store_new
 */
store *
store_new ( const gchar *config,
            const gchar *path )
{
  store *s;
  s = (store *) g_malloc ( sizeof(store) );

  s->config = g_strdup ( config );
  s->path = g_strdup ( path );

  s->epoch = time ( NULL );

  s->nb_entries = 0;
  s->blocks_head = NULL;
  s->blocks_tail = NULL;
  s->most_recent_data = NULL;

  if ( store_read_config(s) )
    {
      log_print ( "core: store: unable to load config \'%s\'\n", config );
      return NULL;
    }

  g_rw_lock_init ( &(s->lock) );

  return s;
}


/*
 * store_read_config
 */
gboolean
store_read_config ( store *s )
{
  GIOChannel *input;
  GIOStatus status;
  GError *error;
  gchar *line;
  gsize len, term;

  error = NULL;
  input = g_io_channel_new_file ( s->config, "r", &error );

  if ( error != NULL )
    {
      log_print ( "core: store: unable to open file \'%s\' : %s\n", s->config, error->message );
      return TRUE;
    }

  s->cols = NULL;
  s->cols = g_list_append ( s->cols, g_strdup("timestamp") );
  s->nb_cols = 1;

  status = G_IO_STATUS_NORMAL;
  while ( status == G_IO_STATUS_NORMAL )
    {
      status = g_io_channel_read_line ( input, &line, &len, &term, &error );

      if ( ( status == G_IO_STATUS_NORMAL ) && ( line != NULL ) )
        {
          line[term] = '\0';
          s->cols = g_list_append ( s->cols, line );
          s->nb_cols++;
        }
    }

  g_io_channel_shutdown ( input, TRUE, &error );

  if ( error != NULL )
    {
      log_print ( "core: store: unable to close file \'%s\' : %s\n", s->config, error->message );
      return TRUE;
    }

  g_io_channel_unref ( input );

  if ( s->most_recent_data != NULL )
    g_free ( s->most_recent_data );

  s->most_recent_data = g_malloc ( s->nb_cols * sizeof(gdouble) );

  return FALSE;
}


/*
 * store_clear
 */
void
store_clear ( store *s,
              gboolean reset_counter )
{
  if ( s->nb_entries == 0 )
    return;

  blocks_list_clear ( s->blocks_head );

  if ( reset_counter )
    s->nb_entries = 0;

  s->blocks_head = NULL;
  s->blocks_tail = NULL;
}


/*
 * store_process_input_file
 */
gboolean
store_process_input_file ( store *s,
                           store_line_process_func cb,
                           gpointer cb_data )
{
  GIOChannel *input;
  GIOStatus status;
  GError *error;
  gchar *line, *begin, *end;
  gsize len, term;
  gdouble *data;
  guint i;

  error = NULL;
  input = g_io_channel_new_file ( s->path, "r", &error );

  if ( error != NULL )
    {
      log_print ( "core: store: unable to open input file \'%s\' : %s\n", s->path, error->message );
      return TRUE;
    }

  data = g_malloc ( s->nb_cols * sizeof(gdouble) );

  status = G_IO_STATUS_NORMAL;
  while ( status == G_IO_STATUS_NORMAL )
    {
      status = g_io_channel_read_line ( input, &line, &len, &term, &error );

      if ( ( status == G_IO_STATUS_NORMAL ) && ( line != NULL ) )
        {
          begin = line;
          bzero ( data, s->nb_cols * sizeof(gdouble) );

          for ( i=0; i<s->nb_cols; ++i )
            {
              data[i] = strtod ( begin, &end );
              if ( *end == '\0' || *end == '\n' )
                break;
              begin = end + 1;
            }

          cb ( cb_data, data ); /* callback to store line processor (used to feed view) */
          g_free ( line );
        }
    }

  memcpy ( s->most_recent_data, data, s->nb_cols*sizeof(gdouble) );
  g_free ( data );

  g_io_channel_shutdown ( input, TRUE, &error );

  if ( error != NULL )
    {
      log_print ( "core: store: unable to close file \'%s\' : %s\n", s->path, error->message );
      return TRUE;
    }
  
  g_io_channel_unref ( input );

  return FALSE;
}


/*
 * store_read_from_file
 */
#define FILE_BUFFER_SIZE 65536
gboolean
store_read_from_file ( store *s )
{
  gchar *begin, *end, *eof;
  guint i, j;
  block *b, *prev;
  FILE *input;
  gchar buffer[FILE_BUFFER_SIZE];
  size_t nbread;
  guint nb_entries_read = 0;
  guint offset = 0;

  store_clear ( s, TRUE );

  input = fopen ( s->path, "r" );

  if ( input == NULL )
    return TRUE;

  /* alloc memory */
  b = block_new ( s->nb_cols );
  s->blocks_head = b;

  /* read data and parse it, last incomplete line is moved at the beginning of the bufffer */
  nbread = fread ( buffer, 1, FILE_BUFFER_SIZE, input );

  while ( nbread > 0 )
    {
      begin = buffer;
      eof = &(buffer[(nbread+offset)-1]);
      for ( i=nbread+offset; (i > 1) && (*eof != '\n'); --i )
        --eof;

      while ( begin < eof )
        {
          if ( block_is_full(b) )
            {
              prev = b;
              b = block_new ( s->nb_cols );
              prev->next_block = b;
              b->prev_block = prev;
            }

          for ( j=0; j<s->nb_cols; ++j )
            {
              b->data[b->next_line][j] = strtod ( begin, &end );
              begin = end + 1;
            }

          b->next_line++;
          ++nb_entries_read;
        }

      offset = (&buffer[(nbread+offset)-1] - eof); /* remaining bytes after last \n encountered */
      memmove ( buffer, end+1, offset );

      nbread = fread ( buffer+offset, 1, FILE_BUFFER_SIZE-offset, input );
    }

  s->nb_entries = nb_entries_read;
  s->blocks_tail = b;
  s->epoch = time ( NULL );

  fclose ( input );

  /* todo: integrate and remove */
  store_get_last_data ( s, s->most_recent_data );

  return FALSE;
}


/*
 * store_append_single_data
 */
void
store_append_single_data ( store *s,
                           gdouble *data )
{
  g_rw_lock_writer_lock ( &(s->lock) );
  memcpy ( s->most_recent_data, data, sizeof(gdouble)*s->nb_cols );
  s->nb_entries++;
  g_rw_lock_writer_unlock ( &(s->lock) );
}


/*
 * store_get_most_recent_data
 */
void
store_get_most_recent_data ( store *s,
                             gdouble *data )
{
  g_rw_lock_reader_lock ( &(s->lock) );
  memcpy ( data, s->most_recent_data, sizeof(gdouble)*s->nb_cols );
  g_rw_lock_reader_unlock ( &(s->lock) );
  return;
}


/*
 * store_write_most_recent_data_json
 */
void
store_write_most_recent_data_json ( store *s,
                                    const gdouble min,
                                    FILE *f )
{
  GList *iter;
  guint i;

  g_rw_lock_reader_lock ( &(s->lock) );

  iter = g_list_next ( g_list_first(s->cols) ); /* skip 'timestamp' column */
  i = 1;
  fprintf ( f, "{\"%s\":%.0f", (gchar *) iter->data, s->most_recent_data[i] );

  /* todo: adapt column format, it may be necessary to have something else than %.0f */

  for ( iter=g_list_next(iter),++i; iter!=NULL; iter=g_list_next(iter),++i )
    {
      if ( s->most_recent_data[i] >= min )
        fprintf ( f, ",\"%s\":%.0f", (gchar *) iter->data, s->most_recent_data[i] );
    }

  fputc ( '}', f );

  g_rw_lock_reader_unlock ( &(s->lock) );
}


/*
 * store_get_last_data
 */
gint
store_get_last_data ( store *s,
                      gdouble *data )
{
  block *b;
  b = s->blocks_tail;

  if ( block_is_empty(b) )
    {
      if ( block_is_list_head(b) )
        return 1;

      b = b->prev_block;
    }

  memcpy ( data, b->data[b->next_line-1], sizeof(gdouble)*s->nb_cols );
  return 0;
}


/*
 * store_dump
 */
void
store_dump ( store *s,
             FILE *f )
{
  GList *iter;
  block *b;

  for ( iter=g_list_first(s->cols); iter!=NULL; iter=g_list_next(iter) )
    fprintf ( f, "%s ", (gchar *) iter->data );
  fputc ( '\n', f );

  for ( b=s->blocks_head; b!=NULL; b=b->next_block )
    block_dump ( b, f );

  fflush ( f );
}


/*
 * store_free
 */
void
store_free ( store *s )
{
  if ( s->most_recent_data != NULL )
    g_free ( s->most_recent_data );

  g_list_free_full ( s->cols, g_free );

  store_clear ( s, TRUE );

  g_free ( s->path );
  g_free ( s->config );
  g_rw_lock_clear ( &(s->lock) );
  g_free ( s );
}
