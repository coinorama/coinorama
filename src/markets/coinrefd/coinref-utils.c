/*
 * coinref-utils.c
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

#include <glib.h>
#include <errno.h>
#include <string.h>
#include <stdarg.h>

#include "coinref-utils.h"


/* cache structure */

/*
 * jcache_new
 */
jcache *
jcache_new ( guint nb_values )
{
  jcache *jc;

  jc = (jcache *) g_malloc ( sizeof(jcache) );
  jc->dirty = TRUE;
  jc->content = (gchar *) g_malloc ( sizeof(gchar) * 16 * nb_values );
  jc->start = jc->content;
  jc->end = jc->content;

  return jc;
}

/*
 * jcache_free
 */
void
jcache_free ( jcache *jc )
{
  g_free ( jc->content );
  g_free ( jc );
}



/* LOGGING */

static FILE *logfile = NULL;
static gboolean logf;
time_t date;
gchar datebuf[256];

static GMutex lock;

gchar *
timestamp ( void )
{
  date = time ( NULL );
  strftime ( datebuf, 256, "%Y-%m-%d %H:%M:%S", localtime(&date) );
  return datebuf;
}

gboolean
log_open ( const char *filename )
{
  logf = FALSE;

  g_mutex_init ( &lock );

  if ( filename == NULL )
    logfile = stderr;
  else
    {
      logfile = fopen ( filename, "a" );
      if ( logfile == NULL )
        {
          fprintf ( stderr, "*** unable to open log: %s", strerror(errno) );
          return TRUE;
        }
      logf = TRUE;
    }

  return FALSE;
}


void
log_print ( const char *format, ... )
{
  va_list ap;
  va_start ( ap, format );

  g_mutex_lock ( &lock );

  fprintf ( logfile, "%s ", timestamp() );
  vfprintf ( logfile, format, ap);
  fflush ( logfile );

  g_mutex_unlock ( &lock );

  va_end(ap);
}

void
log_close ( void )
{
  g_mutex_clear ( &lock );

  if ( logf )
    fclose ( logfile );
}
