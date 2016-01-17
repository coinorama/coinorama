/*
 * coinref-book.c
 *
 * Order Book Storage for coinref.
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

#include "coinref-utils.h"
#include "coinref-book.h"


/*
 * refbook
 */

/*
 * refbook_new
 */
refbook *
refbook_new ( gchar *path_asks,
              gchar *path_bids )
{
  refbook *rb;
  rb = (refbook *) g_malloc ( sizeof(refbook) );

  rb->path_asks = g_strdup ( path_asks );
  rb->path_bids = g_strdup ( path_bids );

  rb->epoch = time ( NULL );

  rb->nb_asks_entries = 0;
  rb->asks_rate = NULL;
  rb->asks_volume = NULL;

  rb->nb_bids_entries = 0;
  rb->bids_rate = NULL;
  rb->bids_volume = NULL;

  rb->shadow_nb_asks_entries = 0;
  rb->shadow_asks_rate = NULL;
  rb->shadow_asks_volume = NULL;

  rb->shadow_nb_bids_entries = 0;
  rb->shadow_bids_rate = NULL;
  rb->shadow_bids_volume = NULL;

  g_rw_lock_init ( &(rb->lock) );

  return rb;
}


/*
 * refstore_clear
 */
void
refbook_clear ( refbook *rb )
{
  if ( rb->nb_asks_entries > 0 )
    {
      g_free ( rb->asks_rate );
      g_free ( rb->asks_volume );
      rb->nb_asks_entries = 0;
    }

  if ( rb->nb_bids_entries > 0 )
    {
      g_free ( rb->bids_rate );
      g_free ( rb->bids_volume );
      rb->nb_bids_entries = 0;
    }
}


/*
 * refbook_read_from_files
 */
gboolean
#ifdef _WITH_BOOK_STAMP
refbook_read_from_files ( refbook *rb,
                          const gchar *stamp )
#else
refbook_read_from_files ( refbook *rb )
#endif
{
  int fd;
  struct stat sb;
  char *addr;
  guint i;
  char *end;
  char *begin;
  guint nb_entries;
#ifdef _WITH_BOOK_STAMP
  gchar *filename;
  gchar tmpname[256];
#endif

  /* shadow memory is in the standard storage, it can be overwritten */
  rb->shadow_nb_bids_entries = 0;
  rb->shadow_nb_bids_entries = 0;

  /* deal with asks */

#ifdef _WITH_BOOK_STAMP
  if ( stamp != NULL )
    {
      g_sprintf ( tmpname, "asks-%s.csv", stamp );
      filename = g_build_filename ( rb->path_asks, tmpname, NULL );
    }
  else
    filename = g_build_filename ( rb->path_asks, "asks.csv", NULL );

  fd = open ( filename, O_RDONLY );
#else
  fd = open ( rb->path_asks, O_RDONLY );
#endif

  if ( fd == -1 )
    return TRUE;

  if ( fstat(fd, &sb) == -1 )
    return TRUE;

  addr = mmap ( NULL, sb.st_size, PROT_READ, MAP_PRIVATE, fd, 0 );

  if ( addr == MAP_FAILED )
    return TRUE;

  for ( nb_entries=0, i=0; i<sb.st_size; ++i )
    if ( addr[i] == '\n' )
      ++nb_entries;

  rb->shadow_nb_asks_entries = nb_entries;
  rb->shadow_asks_rate = (gdouble *) g_malloc ( sizeof(gdouble) * nb_entries );
  rb->shadow_asks_volume = (gdouble *) g_malloc ( sizeof(gdouble) * nb_entries );

  i = 0;
  begin = addr;
  while ( i < nb_entries )
    {
      rb->shadow_asks_rate[i] = strtod ( begin, &end );
      begin = end + 1;
      rb->shadow_asks_volume[i] = strtod ( begin, &end );
      begin = end + 1;
      ++i;
    }

  munmap ( addr, sb.st_size );
  close ( fd );

#ifdef _WITH_BOOK_STAMP
  g_free ( filename );
#endif

  /* deal with bids */

#ifdef _WITH_BOOK_STAMP
  if ( stamp != NULL )
    {
      g_sprintf ( tmpname, "bids-%s.csv", stamp );
      filename = g_build_filename ( rb->path_bids, tmpname, NULL );
    }
  else
    filename = g_build_filename ( rb->path_bids, "bids.csv", NULL );

  fd = open ( filename, O_RDONLY );
#else
  fd = open ( rb->path_bids, O_RDONLY );
#endif

  if ( fd == -1 )
    return TRUE;

  if ( fstat(fd, &sb) == -1 )
    return TRUE;

  addr = mmap ( NULL, sb.st_size, PROT_READ, MAP_PRIVATE, fd, 0 );

  if ( addr == MAP_FAILED )
    return TRUE;

  for ( nb_entries=0, i=0; i<sb.st_size; ++i )
    if ( addr[i] == '\n' )
      ++nb_entries;

  rb->shadow_nb_bids_entries = nb_entries;
  rb->shadow_bids_rate = (gdouble *) g_malloc ( sizeof(gdouble) * nb_entries );
  rb->shadow_bids_volume = (gdouble *) g_malloc ( sizeof(gdouble) * nb_entries );

  i = 0;
  begin = addr;
  while ( i < nb_entries )
    {
      rb->shadow_bids_rate[i] = strtod ( begin, &end );
      begin = end + 1;
      rb->shadow_bids_volume[i] = strtod ( begin, &end );
      begin = end + 1;
      ++i;
    }

  munmap ( addr, sb.st_size );
  close ( fd );

#ifdef _WITH_BOOK_STAMP
  g_free ( filename );
#endif

  /* link standard storage to shadow */
  refbook_swap_shadow ( rb );

  return FALSE;
}


/*
 * refbook_swap_shadow
 */
void
refbook_swap_shadow ( refbook *rb )
{
  gdouble *prev_asks_rate = rb->asks_rate;
  gdouble *prev_asks_volume = rb->asks_volume;
  gdouble *prev_bids_rate = rb->bids_rate;
  gdouble *prev_bids_volume = rb->bids_volume;

  g_rw_lock_writer_lock ( &(rb->lock) );
  rb->nb_asks_entries = rb->shadow_nb_asks_entries;
  rb->asks_rate = rb->shadow_asks_rate;
  rb->asks_volume = rb->shadow_asks_volume;
  rb->nb_bids_entries = rb->shadow_nb_bids_entries;
  rb->bids_rate = rb->shadow_bids_rate;
  rb->bids_volume = rb->shadow_bids_volume;
  g_rw_lock_writer_unlock ( &(rb->lock) );

  if ( prev_asks_rate != NULL )
    {
      g_free ( prev_asks_rate );
      g_free ( prev_asks_volume );
      g_free ( prev_bids_rate );
      g_free ( prev_bids_volume );
    }
}


/*
 * refbook_dump
 */
void
refbook_dump ( refbook *rb,
               FILE *f )
{
  guint i;

  fputs ( "rate volume\n", f );

  for ( i=0; i<rb->nb_bids_entries; ++i )
    fprintf ( f, "%f %f\n", rb->bids_rate[i], rb->bids_volume[i] );

  fputs ( "****\n", f );

  for ( i=0; i<rb->nb_asks_entries; ++i )
    fprintf ( f, "%f %f\n", rb->asks_rate[i], rb->asks_volume[i] );

  fflush ( f );
}


/*
 * refbook_write_json
 */
void
refbook_write_json ( refbook *rb,
                     FILE *f )
{
  guint i;
  fputs ( "{\"asks\": [", f );
  g_rw_lock_reader_lock ( &(rb->lock) );
  fprintf ( f, "%.1f,[", rb->asks_rate[0] );
  for ( i=0; i<(rb->nb_asks_entries-1); ++i )
    fprintf ( f, "%.2f,", rb->asks_volume[i] );
  fprintf ( f, "%.2f]],", rb->asks_volume[i] );
  fprintf ( f, "\"bids\": [%.1f,[", rb->bids_rate[0] );
  for ( i=0; i<(rb->nb_bids_entries-1); ++i )
    fprintf ( f, "%.2f,", rb->bids_volume[i] );
  fprintf ( f, "%.2f]]}", rb->bids_volume[i] );
  g_rw_lock_reader_unlock ( &(rb->lock) );
}

/*
 * refbook_free
 */
void
refbook_free ( refbook *rb )
{
  refbook_clear ( rb );
  g_free ( rb->path_asks );
  g_free ( rb->path_bids );
  g_rw_lock_clear ( &(rb->lock) );
  g_free ( rb );
}
