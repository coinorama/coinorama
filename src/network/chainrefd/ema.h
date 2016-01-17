/*
 * ema.h
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

#ifndef __EMA_H__
#define __EMA_H__


/* generalities */
struct mavg_st;
typedef struct mavg_st mavg;

struct ema_st;
typedef struct ema_st ema;


/* mavg */
struct mavg_st
{
  gdouble *window;
  guint win_index;
  gdouble N;
  gdouble sum;
  gdouble current;
};

mavg *mavg_new ( const guint );
gdouble mavg_update ( mavg *, const gdouble, const guint );
gdouble mavg_estimate ( mavg *, const gdouble, const guint );
void mavg_free ( mavg * );


/* ema */
struct ema_st
{
  gdouble N;
  gdouble k;
  gdouble k_inv;
  gdouble sum;
  gdouble current;
  gdouble previous;
};

ema *ema_new ( const guint );
gdouble ema_update ( ema *, const gdouble, const guint );
gdouble ema_estimate ( ema *, const gdouble, const guint );
void ema_free ( ema * );


#endif
