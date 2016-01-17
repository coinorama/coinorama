/*
 * chainref-blockchain.h
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

#ifndef __CHAINREF_BLOCKCHAIN_H__
#define __CHAINREF_BLOCKCHAIN_H__


#include "chainref-blockstore.h"
#include "chainref-blockview.h"
#include "view.h"


/* generalities */
struct blockchain_st;
typedef struct blockchain_st blockchain;

enum blockchain_id_en;
typedef enum blockchain_id_en blockchain_id;


/* blockchain */
struct blockchain_st
{
  guint uid;
  gchar *name;
  gchar *path;
  refstore *store;
  refview *views[NB_VIEW_LENGTHS];

#ifdef WITH_POOLS
  store *pools_224_store;
  store *pools_672_store;
  store *pools_2016_store;
  view *pools_224_views[NB_VIEW_LENGTHS];
  view *pools_672_views[NB_VIEW_LENGTHS];
  view *pools_2016_views[NB_VIEW_LENGTHS];
#endif

  jcache *cache_block_ticker;
};

blockchain *blockchain_new ( guint, gchar *, gchar * );
void blockchain_append_single_block_data ( blockchain *, gdouble * );
#ifdef WITH_POOLS
void blockchain_append_single_pools_data ( blockchain *, const gint, gdouble * );
void blockchain_write_json ( blockchain *, view_length_id, gboolean, const gdouble, const gint, FILE * );
#else
void blockchain_write_json ( blockchain *, view_length_id, gboolean, const gdouble, FILE * );
#endif

void blockchain_write_json_ticker ( blockchain *, FILE * );
void blockchain_free ( blockchain * );


/* blockchain export */
enum blockchain_id_en
  {
    CHAIN_BITCOIN,
    NB_CHAINS
  };

extern blockchain *BLOCKCHAIN;


#endif
