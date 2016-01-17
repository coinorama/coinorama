/*
 * coinref-store.c
 *
 * Core storage for coinref.
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
#include <strings.h>
#include <errno.h>
#include <math.h>
#ifdef _WITH_STORE_GZIP_PACKS
#include <zlib.h>
#endif
#include <glib.h>
#include <glib/gprintf.h>

#include <sys/types.h>
#include <sys/stat.h>
#include <fcntl.h>

#include "coinref-utils.h"
#include "coinref-store.h"


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
                          const gchar *eof )
{
  guint i, j;
  const gchar *begin = data;
  gchar *endptr = data;

  if ( refblock_is_full(b) )
    return 0;

   /* read */
  for ( i=0, begin=data; (i<STORE_BLOCK_SIZE) && (begin<eof); ++i )
    {
      for ( j=0; j<STORE_BLOCK_COLS; ++j )
        {
          b->data[i][j] = strtod ( begin, &endptr );
          begin = endptr + 1;
        }
    }

  *end = endptr;
  b->next_line = i;
  return i;
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
refstore_new ( gchar *path,
               refstore_cb_append *cb_append,
               gpointer cb_append_p )
{
  refstore *rs;
  rs = (refstore *) g_malloc ( sizeof(refstore) );

  rs->path = g_strdup ( path );

  rs->epoch = time ( NULL );

  rs->nb_entries = 0;
  rs->blocks_head = NULL;
  rs->blocks_tail = NULL;

  rs->cb_append = cb_append;
  rs->cb_append_p = cb_append_p;

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
 * fast_strtod
 * converts a string to a double, faster than strtod by making a few assumptions
 *  # exponential format is not supported
 *  # negative values are not supported
 * inspired by Tom Van Baak (tvb) www.LeapSecond.com fast_atof
 */

#define white_space(c) ((c) == ' ')
#define valid_digit(c) ((c) >= '0' && (c) <= '9')

#define FAST_STRTOD

#ifdef FAST_STRTOD
static double
fast_strtod ( const char *p,
              const char **endp )
{
  double value;

  while ( white_space(*p) )
    ++p;

  /* Get digits before decimal point or exponent, if any */
  for ( value=0; valid_digit(*p); ++p )
    value = value * 10.0 + (*p - '0');

  /* Get digits after decimal point, if any */
  if ( *p == '.' )
    {
      double pow10 = 10.0;
      ++p;
      while ( valid_digit(*p) )
        {
          value += (*p - '0') / pow10;
          pow10 *= 10.0;
          ++p;
        }
    }

  *endp = p;
  return value;
}
#endif


/*
 * refstore_read_from_buffer
 * reads data from a text buffer
 * returns the number of lines read
 */
#define FILE_BUFFER_SIZE 65536
#undef CHECK_INPUT
#undef LOAD_IN_MEM /* if defined, full input data are kept in-memory until refstore is cleared */

guint
refstore_read_from_buffer ( refstore *rs,
                            gchar *buffer,
                            size_t nbread,
                            guint *offset,
                            refblock **current_block )
{
  guint i;
  refblock *b, *prev;
  const gchar *begin, *end;
  gchar *eob; /* pointer to the end of the buffer */
  guint nb_entries_read = 0;
#ifdef CHECK_INPUT
  gdouble prev_tstamp = 0;
  guint nb_warns = 0;
#endif

  b = *current_block;
  end = NULL; /* turn-off compiler warning */

#ifndef LOAD_IN_MEM
  b->next_line = 0;
#endif

  begin = buffer;
  eob = &(buffer[(nbread+(*offset))-1]); /* look-up line separator */
  for ( i=nbread+(*offset); (i > 1) && (*eob != '\n'); --i )
    --eob;

  while ( begin < eob )
    {
      if ( refblock_is_full(b) )
        {
          prev = b;
          b = refblock_new ( );
          prev->next_block = b;
          b->prev_block = prev;
        }

      for ( i=0; i<STORE_BLOCK_COLS; ++i )
        {
          b->data[b->next_line][i] = fast_strtod ( begin, &end );
          begin = end + 1;
        }

#ifdef CHECK_INPUT
      if ( ( prev_tstamp > b->data[b->next_line][STORE_COLUMN_TIME] ) && ( nb_warns < 2 ) )
        {
          guint l;
          log_print ( "warning: store \'%s\': timestamp %f is too low\n", rs->path, b->data[b->next_line][STORE_COLUMN_TIME] );
          for ( l=0; l<STORE_BLOCK_COLS; ++l )
            log_print ( " %f", b->data[b->next_line][l] );
          log_print ( "\n" );
          ++nb_warns;
        }
      prev_tstamp = b->data[b->next_line][STORE_COLUMN_TIME];
#endif

      if ( rs->cb_append )
        rs->cb_append ( rs->cb_append_p, b->data[b->next_line] );

#ifdef LOAD_IN_MEM
      b->next_line++;
#endif
      ++nb_entries_read;
    }

  *offset = (&buffer[(nbread+(*offset))-1] - eob); /* remaining bytes after last \n encountered */
  memmove ( buffer, end+1, *offset );
  *current_block = b;

#ifndef LOAD_IN_MEM
  b->next_line = 1; /* the last line read can be accessed normally */
#endif

  return nb_entries_read;
}


/*
 * refstore_read_from_filez
 * loads a refstore from a set of files (named packs)
 * packs can either be plain-text or gzip
 * returns FALSE if no error occurred
 */
#ifdef _WITH_STORE_GZIP_PACKS
#define MAX_PACKS 100000

gboolean
refstore_read_from_filez ( refstore *rs )
{
  gchar *packname, *zpackname;
  gint packid;
  refblock *b;
  guint offset;
  gchar buffer[FILE_BUFFER_SIZE];
  size_t nbread;
  gboolean error = FALSE;
  gboolean has_base;

  refstore_clear ( rs, TRUE );

  /* alloc memory */
  b = refblock_new ( );
  rs->blocks_head = b;

  zpackname = g_malloc ( (12+strlen(rs->path)) * sizeof(char) ); /* 12 is hardcoded length ; broken with large MAX_PACKS values */
  packname = g_malloc ( (12+strlen(rs->path)) * sizeof(char) );

  has_base = g_file_test ( rs->path, G_FILE_TEST_EXISTS );

  /* process packs */
  for ( packid=0; packid<MAX_PACKS; ++packid )
    {
      offset = 0;
      g_sprintf ( zpackname, "%s.%.5d.gz", rs->path, packid );

      if ( g_file_test(zpackname,G_FILE_TEST_EXISTS) )
        {
          /* read a gzipped pack */
          gzFile fz;
          fz = gzopen ( zpackname, "r" );

          if ( fz == Z_NULL )
            {
              log_print ( "warning: store \'%s\': unable to read dataset: %s\n", rs->path, g_strerror(errno) );
              error = TRUE;
              break;
            }

          gzbuffer ( fz, FILE_BUFFER_SIZE*2 );
          nbread = gzread ( fz, buffer, FILE_BUFFER_SIZE );

          while ( nbread > 0 )
            {
              rs->nb_entries += refstore_read_from_buffer ( rs, buffer, nbread, &offset, &b );
              nbread = gzread ( fz, buffer+offset, FILE_BUFFER_SIZE-offset );
            }

          gzclose ( fz );
        }
      else
        {
          gboolean has_pack;

          g_sprintf ( packname, "%s.%.5d", rs->path, packid );
          has_pack = g_file_test ( packname, G_FILE_TEST_EXISTS );

          if ( has_pack || has_base )
            {
              /* read a plain-text pack or fall-back to base file */
              int fd;
              fd = open ( has_pack?packname:rs->path , O_RDONLY );

              if ( fd < 0 )
                {
                  log_print ( "warning: store \'%s\': unable to read dataset: %s\n", rs->path, g_strerror(errno) );
                  error = TRUE;
                  break;
                }

              nbread = read ( fd, buffer, FILE_BUFFER_SIZE );

              while ( nbread > 0 )
                {
                  rs->nb_entries += refstore_read_from_buffer ( rs, buffer, nbread, &offset, &b );
                  nbread = read ( fd, buffer+offset, FILE_BUFFER_SIZE-offset );
                }

              close ( fd );

              if ( has_pack )
                has_base = FALSE;

              if ( has_base )
                break;
            }
          else if ( rs->nb_entries == 0 )
            {
              log_print ( "warning: store \'%s\': no dataset found\n", rs->path );
              error = TRUE;
              break;
            }
        }
    }

  g_free ( packname );
  g_free ( zpackname );

  rs->blocks_tail = b;
  rs->epoch = time ( NULL );
  refstore_get_last_data ( rs, rs->most_recent_data );

  return error;
}
#endif


/*
 * refstore_read_from_file
 * loads a refstore from a plain-text file
 */
gboolean
refstore_read_from_file ( refstore *rs )
{
  refblock *b;
  gchar buffer[FILE_BUFFER_SIZE];
  size_t nbread;
  guint offset = 0;
  gboolean error = FALSE;
  int fd;

  refstore_clear ( rs, TRUE );

  /* alloc memory */
  b = refblock_new ( );
  rs->blocks_head = b;

  fd = open ( rs->path, O_RDONLY );

  if ( fd < 0 )
    {
      log_print ( "warning: store \'%s\': unable to read dataset: %s\n", rs->path, g_strerror(errno) );
      error = TRUE;
    }
  else
    {
      /* read data and parse it, last incomplete line is moved at the beginning of the bufffer */
      nbread = read ( fd, buffer, FILE_BUFFER_SIZE );

      while ( nbread > 0 )
        {
          rs->nb_entries += refstore_read_from_buffer ( rs, buffer, nbread, &offset, &b );
          nbread = read ( fd, buffer+offset, FILE_BUFFER_SIZE-offset );
        }

      close ( fd );
    }

  rs->blocks_tail = b;
  rs->epoch = time ( NULL );
  refstore_get_last_data ( rs, rs->most_recent_data );

  return error;
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

  fputs ( "time rate sum_asks sum_bids volume nb_trades lag top_ask top_bid usd_ratio\n", f );

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
