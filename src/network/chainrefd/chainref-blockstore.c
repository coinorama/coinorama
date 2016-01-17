/*
 * chainref-blockstore.c
 *
 * Core storage for blocks.
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
#include "chainref-blockstore.h"


/*
 * refblock
 */

/*
 * refblock_new
 * todo: use glib memory pool
 */
refblock *
refblock_new ( void )
{
  refblock *b = g_malloc ( sizeof(refblock) );
  b->next_line = 0;
  b->next_block = NULL;
  b->prev_block = NULL;
  return b;
}


/*
 * refblock_append
 */
gboolean
refblock_append ( refblock *b,
                  gdouble *data )
{
  memcpy ( &(b->data[b->next_line]), data, sizeof(gdouble)*STORE_BLOCK_COLS );
  b->next_line++;
  return FALSE;
}


/*
 * refblock_generate_data_from_text
 */
void
refblock_generate_data_from_text ( gchar *text,
                                   gdouble *data )
{
  guint j;
  gchar *begin = text;
  gchar *endptr;

  begin = text;

  for ( j=0; j<STORE_BLOCK_COLS; ++j )
    {
      data[j] = strtod ( begin, &endptr );
      begin = endptr + 1;
    }
}


/*
 * refblock_load_from_text
 */
guint
refblock_load_from_text ( refblock *b,
                          gchar *data,
                          gchar **end,
                          guint nb_entries )
{
  guint i, j;
  const gchar *begin = data;
  gchar *endptr = data;
  const guint limit = min ( nb_entries, STORE_BLOCK_SIZE );

  if ( refblock_is_full(b) )
    return 0;

   /* read */
  for ( i=0, begin=data; i<limit; ++i )
    {
      for ( j=0; j<STORE_BLOCK_COLS; ++j )
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
 * refblock_dump
 */
void
refblock_dump ( refblock *b,
                FILE *f )
{
  guint i, j;

  for ( i=0; i<b->next_line; ++i )
    {
      for ( j=0; j<(STORE_BLOCK_COLS-1); ++j )
        fprintf ( f, "%f ", b->data[i][j] );
      fprintf ( f, "%f\n ", b->data[i][j] );
    }
}


/*
 * refblock_free
 */
void
refblock_free ( refblock *b )
{
  g_free ( b );
}


/*
 * refblocks list utils
 */
void
refblocks_list_clear ( refblock *head )
{
  refblock *next;

  while ( head != NULL )
    {
      next = head->next_block;
      g_free ( head );
      head = next;
    }
}



/*
 * refstore
 */

/*
 * refstore_new
 */
refstore *
refstore_new ( gchar *path )
{
  refstore *rs;
  rs = (refstore *) g_malloc ( sizeof(refstore) );

  rs->path = g_strdup ( path );

  rs->epoch = time ( NULL );

  rs->nb_entries = 0;
  rs->blocks_head = NULL;
  rs->blocks_tail = NULL;

  g_rw_lock_init ( &(rs->lock) );

  return rs;
}


/*
 * refstore_clear
 */
void
refstore_clear ( refstore *rs,
                 gboolean reset_counter )
{
  if ( rs->nb_entries == 0 )
    return;

  refblocks_list_clear ( rs->blocks_head );

  if ( reset_counter )
    rs->nb_entries = 0;

  rs->blocks_head = NULL;
  rs->blocks_tail = NULL;
}


/*
 * refstore_read_from_file
 */
#define FILE_BUFFER_SIZE 65536
gboolean
refstore_read_from_file ( refstore *rs )
{
  gchar *begin, *end, *eof;
  guint i, j;
  refblock *b, *prev;
  FILE *input;
  gchar buffer[FILE_BUFFER_SIZE];
  size_t nbread;
  guint nb_entries_read = 0;
  guint offset = 0;

  refstore_clear ( rs, TRUE );

  input = fopen ( rs->path, "r" );

  if ( input == NULL )
    return TRUE;

  /* alloc memory */
  b = refblock_new ( );
  rs->blocks_head = b;

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
          if ( refblock_is_full(b) )
            {
              prev = b;
              b = refblock_new ( );
              prev->next_block = b;
              b->prev_block = prev;
            }

          for ( j=0; j<STORE_BLOCK_COLS; ++j )
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

  rs->nb_entries = nb_entries_read;
  rs->blocks_tail = b;
  rs->epoch = time ( NULL );

  fclose ( input );

  refstore_get_last_data ( rs, rs->most_recent_data );

  return FALSE;
}


/*
 * refstore_append_single_data
 */
void
refstore_append_single_data ( refstore *rs,
                              gdouble *data )
{
  g_rw_lock_writer_lock ( &(rs->lock) );
  memcpy ( rs->most_recent_data, data, sizeof(gdouble)*STORE_BLOCK_COLS );
  rs->nb_entries++;
  g_rw_lock_writer_unlock ( &(rs->lock) );
}


/*
 * refstore_get_most_recent_data
 */
void
refstore_get_most_recent_data ( refstore *rs,
                                gdouble *data )
{
  g_rw_lock_reader_lock ( &(rs->lock) );
  memcpy ( data, rs->most_recent_data, sizeof(gdouble)*STORE_BLOCK_COLS );
  g_rw_lock_reader_unlock ( &(rs->lock) );
  return;
}


/*
 * refstore_get_last_data
 */
gint
refstore_get_last_data ( refstore *rs,
                         gdouble *data )
{
  refblock *b;
  b = rs->blocks_tail;

  if ( refblock_is_empty(b) )
    {
      if ( refblock_is_list_head(b) )
        return 1;

      b = b->prev_block;
    }

  memcpy ( data, b->data[b->next_line-1], sizeof(gdouble)*STORE_BLOCK_COLS );
  return 0;
}


/*
 * refstore_dump
 */
void
refstore_dump ( refstore *rs,
                FILE *f )
{
  refblock *b;

  fputs ( "uid time difficulty version size nb_tx volume fees mempool mempool_max\n", f );

  for ( b=rs->blocks_head; b!=NULL; b=b->next_block )
    refblock_dump ( b, f );

  fflush ( f );
}


/*
 * refstore_free
 */
void
refstore_free ( refstore *rs )
{
  refstore_clear ( rs, TRUE );
  g_free ( rs->path );
  g_rw_lock_clear ( &(rs->lock) );
  g_free ( rs );
}
