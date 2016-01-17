/*
 * coinref-utils.h
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

#ifndef __COINREF_UTILS_H__
#define __COINREF_UTILS_H__

#include <stdio.h>

/* various utilities */
#define min(A,B) A<B?A:B
#define max(A,B) A>B?A:B

#define str2bool(STR) (STR[0] == '1' || STR[0] == 't' || STR[0] == 'T')

#define print_float(_VAL,_PREC,_PTR)                              \
  {                                                               \
    if ( ( floor(_VAL) == _VAL ) || ( _PREC == 0 ) )              \
      _PTR += sprintf ( _PTR, "%.0f", _VAL );                     \
    else                                                          \
      {                                                           \
        _PTR += sprintf ( _PTR, "%.*f", _PREC, _VAL ) - 1;        \
        while ( *_PTR == '0' )                                    \
          {                                                       \
            --_PTR;                                               \
            if ( *_PTR == '.' )                                   \
              {                                                   \
                --_PTR;                                           \
                break;                                            \
              }                                                   \
          }                                                       \
        ++_PTR;                                                   \
      }                                                           \
  }



/* simple cache */
typedef struct jcache_st
{
  gboolean dirty;
  gchar *content;
  gchar *start;
  gchar *end;
} jcache ;

jcache *jcache_new ( guint );
void jcache_free ( jcache * );



/* logging */
gboolean log_open ( const char * );
void log_print ( const char *, ... );
void log_close ( void );


#endif
