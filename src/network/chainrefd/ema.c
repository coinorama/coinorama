/*
 * ema.c
 *
 * Exponential Moving Average and other maths utils
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
#include <errno.h>
#include <math.h>
#include <strings.h>
#include <glib.h>
#include <glib/gprintf.h>

#include "ema.h"


/* mavg */

/*
 * mavg_new
 */
mavg *
mavg_new ( const guint N )
{
  mavg *ma;

  ma = (mavg *) g_malloc ( sizeof(mavg) );

  ma->N = N;

  ma->window = (gdouble *) g_malloc ( sizeof(gdouble) * N );
  bzero ( ma->window, sizeof(gdouble)*N );

  ma->win_index = 0;
  ma->sum = 0;
  ma->current = 0;

  return ma;
}


/*
 * mavg_update
 */
gdouble
mavg_update ( mavg *ma,
              const gdouble val,
              const guint nb_vals )
{
  ma->sum -= ma->window[ma->win_index];
  ma->sum += val;
  ma->window[ma->win_index] = val;
  ma->win_index++;
  if ( ma->win_index >= ma->N )
    ma->win_index = 0;

  if ( nb_vals < ma->N )
    return ma->sum / ((gdouble) (nb_vals+1));

  ma->current = ma->sum / ((gdouble) ma->N);
  return ma->current;
}


/*
 * mavg_estimate
 */
gdouble
mavg_estimate ( mavg *ma,
                const gdouble val,
                const guint nb_vals )
{
  if ( nb_vals < ma->N )
    return (ma->sum+val) / ((gdouble) (nb_vals+1));

  return (ma->sum+val-ma->window[ma->win_index]) / ((gdouble)ma->N);
}


/*
 * mavg_free
 */
void
mavg_free ( mavg *ma )
{
  g_free ( ma->window );
  g_free ( ma );
}



/* ema */

/*
 * ema_new
 */
ema *
ema_new ( const guint N )
{
  ema *ma;

  ma = (ema *) g_malloc ( sizeof(ema) );

  ma->N = N;
  ma->k = 2 / ((gdouble) (N + 1 ));
  ma->k_inv = 1 - ma->k;
  ma->sum = 0;
  ma->current = 0;
  ma->previous = 0;

  return ma;
}


/*
 * ema_update
 */
gdouble
ema_update ( ema *ma,
             const gdouble val,
             const guint nb_vals )
{
  ma->previous = ma->current;

  if ( nb_vals < ma->N )
    {
      ma->sum += val;
      ma->current = ma->sum / ((gdouble) (nb_vals+1));
      return ma->current;
    }

  ma->current = (val*ma->k) + (ma->previous*ma->k_inv);
  return ma->current;
}


/*
 * ema_estimate
 */
gdouble
ema_estimate ( ema *ma,
               const gdouble val,
               const guint nb_vals )
{
  if ( nb_vals < ma->N )
    return (ma->sum+val) / ((gdouble) (nb_vals+1));

  return (val*ma->k) + (ma->current*ma->k_inv);
}


/*
 * ema_free
 */
void
ema_free ( ema *ma )
{
  g_free ( ma );
}
