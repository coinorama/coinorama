/*
 * chainref-ajax.c
 *
 * This is the chainref webserver part which supports SCGI.
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
#include <unistd.h>

#define __USE_POSIX
#include <stdio.h>

#include <sys/wait.h>
#include <stdio.h>
#include <glib.h>
#include <glib/gstdio.h>
#include <sys/socket.h>
#include <sys/un.h>
#include <string.h>
#include <strings.h>
#include <errno.h>

#include "chainref-utils.h"
#include "chainref-blockchain.h"
#include "chainref-ajax.h"


gpointer ajax_worker_run ( ajax_worker * );


/*
 * handle_alive_timeout
 */
static gboolean
handle_alive_timeout ( ajax_worker *aw )
{
  /* danger: there is a race with connection handler here */
  log_print ( "ajax-%u: alive with %u requests per minute\n", aw->uid, aw->nb_requests );
  aw->nb_requests = 0;
  return TRUE;
}


/*
 * handle_new_connection
 */
static gboolean
handle_new_connection ( GIOChannel *chan,
                        GIOCondition cond,
                        ajax_worker *aw )
{
  gint client_socket;
  struct sockaddr_un client_addr;
  socklen_t client_addr_len = sizeof ( struct sockaddr_un );
  GIOChannel *client_chan;
  gchar *client_input;
  gsize client_input_len;
  gsize client_nbread;
  GError *error = NULL;
  guint i;
  gchar scgi_cmd[AJAX_REQUEST_SIZE];
  gchar *scgi_prev_line, *scgi_request;
  FILE *client_chan_f;

  view_length_id view_length = VIEW_LENGTH_1_D;
  gboolean sendFull = FALSE;
  gboolean tickOnly = TRUE;
  gdouble toffset = -1;
#ifdef WITH_POOLS
  gint pools_window = 672;
#endif

  /* g_assert ( g_main_context_is_owner(aw->context) ); */

  memset ( &client_addr, 0, sizeof(struct sockaddr_un) );

  if ( (client_socket = accept(aw->server_socket, (struct sockaddr *) &client_addr, &client_addr_len)) < 0 )
    {
      log_print ( "ajax-%u: unable to accept new connection: %s.\n", aw->uid, strerror(errno) );
      return FALSE;
    }

  client_chan = g_io_channel_unix_new ( client_socket );

  g_io_channel_read_line ( client_chan, &client_input, &client_nbread, NULL, &error );

  if ( error != NULL )
    {
      log_print ( "ajax-%u: chan reading said %s\n", aw->uid, error->message );
      g_io_channel_shutdown ( client_chan, TRUE, NULL );
      g_io_channel_unref ( client_chan );
      return TRUE;
    }

  client_input_len = atoi(client_input) - 15; /* 15 = strlen("CONTENT_LENGTH\0") */
  /*log_print ( "ajax-%u: scgi request has size: %lu\n", aw->uid, client_input_len );*/

  if ( client_input_len > AJAX_REQUEST_SIZE )
    {
      log_print ( "ajax-%u: scgi request is too big\n", aw->uid );
      client_input_len = AJAX_REQUEST_SIZE - 1;
      scgi_cmd[AJAX_REQUEST_SIZE-1] = '\0';
    }

  g_io_channel_read_chars ( client_chan, scgi_cmd, client_input_len, &client_nbread, &error );

  if ( error != NULL )
    {
      log_print ( "ajax-%u: chan reading said %s\n", aw->uid, error->message );
      g_free ( client_input );
      g_io_channel_shutdown ( client_chan, TRUE, NULL );
      g_io_channel_unref ( client_chan );
      return TRUE;
    }

  /* find the query string content */
  scgi_prev_line = scgi_cmd;
  scgi_request = scgi_cmd;
  for ( i=0; i<client_input_len; ++i )
    {
      if ( scgi_cmd[i] == '\0' )
        {
          scgi_prev_line = scgi_request;
          scgi_request = scgi_cmd + i + 1;
        }

      if ( !strcmp("QUERY_STRING",scgi_prev_line) )
        break;
    }

  /* if a query string was found, parse it */
  if ( i<client_input_len )
    {
      gchar *rq_end;
      gchar *rq_ptr;
      /*log_print ( "ajax-%u: scgi request is \'%s\'\n", aw->uid, scgi_request );*/

      rq_end = index ( scgi_request, '\0' );
      rq_ptr = scgi_request;

      while ( rq_ptr < rq_end )
        {
          if ( ( rq_ptr[1] == '=' ) && ( (rq_end-rq_ptr) > 2 ) )
            {
              switch ( rq_ptr[0] )
                {
                  case 'f':
                    if ( rq_ptr[2] == '1' )
                      sendFull = TRUE;
                    break;

                  case 'v':
                    view_length = view_length_lookup ( rq_ptr+2 );
                    break;

                  case 't':
                    toffset = strtod ( rq_ptr+2, NULL );
                    break;
#ifdef WITH_POOLS
                  case 'p':
                    pools_window = atoi ( rq_ptr+2 );
                    break;
#endif
                  case 'k':
                    if ( rq_ptr[2] == '0' )
                      tickOnly = FALSE;
                    break;

                  default:
                    break;
                }
            }

          rq_ptr = index ( rq_ptr, '&' );
          if ( rq_ptr == NULL )
            break;
          rq_ptr++;
        }
    }

  g_free ( client_input );

  client_chan_f = fdopen ( dup(g_io_channel_unix_get_fd(client_chan)), "w" );

  if ( client_chan_f == NULL )
    {
      log_print ( "ajax-%u: unable to fdopen socket: %s.\n\n", aw->uid, strerror(errno) );
      g_io_channel_shutdown ( client_chan, TRUE, NULL );
      g_io_channel_unref ( client_chan );
      return TRUE;
    }

  fputs ( "Status: 200 OK\nContent-Type: application/json\n\n", client_chan_f );

  fputc ( '{', client_chan_f );

  if ( !tickOnly )
    {
        fputs ( CHAINREF_AJAX_DATA_HEAD, client_chan_f );
#ifdef WITH_POOLS
        blockchain_write_json ( BLOCKCHAIN, view_length, sendFull, toffset, pools_window, client_chan_f );
#else
        blockchain_write_json ( BLOCKCHAIN, view_length, sendFull, toffset, client_chan_f );
#endif

        if ( sendFull )
          fputs ( CHAINREF_AJAX_DATA_FOOT CHAINREF_AJAX_FULL_OK, client_chan_f );
        else
          fputs ( CHAINREF_AJAX_DATA_FOOT CHAINREF_AJAX_FULL_REJ, client_chan_f );
    }

  fputs ( CHAINREF_AJAX_TICK_HEAD, client_chan_f );
  blockchain_write_json_ticker ( BLOCKCHAIN, client_chan_f );
  fputs ( CHAINREF_AJAX_TICK_FOOT, client_chan_f );

  fclose ( client_chan_f );
  g_io_channel_shutdown ( client_chan, TRUE, NULL );
  g_io_channel_unref ( client_chan );

  /*log_print ( "ajax-%u: handled a request\n", aw->uid );*/
  aw->nb_requests++;

  return TRUE;
}


/*
 * ajax_worker_new
 */
ajax_worker *
ajax_worker_new ( guint uid )
{
  ajax_worker *aw;

  gint retval;
  struct sockaddr_un server_addr;
  socklen_t server_len;
  gchar socket_name[256];

  aw = (ajax_worker *) g_malloc ( sizeof(ajax_worker) );

  aw->uid = uid;

  /* spawn network listener */
  aw->server_socket = socket ( AF_UNIX, SOCK_STREAM, 0 );
  if ( aw->server_socket == -1 )
    {
      log_print ( "ajax-%u: unable to create socket: %s.\n", uid, strerror(errno) );
      return NULL;
    }

  sprintf ( socket_name, "/tmp/chainref-ajax-%u", uid );
  unlink ( socket_name );
  memset ( &server_addr, 0, sizeof(struct sockaddr_un) );
  server_addr.sun_family = AF_UNIX;
  strcpy ( server_addr.sun_path, socket_name );
  server_len = strlen(server_addr.sun_path) + sizeof(server_addr.sun_family);

  retval = bind ( aw->server_socket, (struct sockaddr *) &server_addr, server_len );
  if ( retval != 0 )
    {
      log_print ( "ajax-%u: unable to bind socket: %s.\n", uid, strerror(errno) );
      return NULL;
    }

  g_chmod ( socket_name, 0666 );

  aw->thread = g_thread_new ( socket_name, (GThreadFunc) ajax_worker_run, aw );
  return aw;
}


/*
 * ajax_worker_run
 */
gpointer
ajax_worker_run ( ajax_worker *aw )
{
  log_print ( "ajax-%u: worker entering event loop.\n", aw->uid );

  /* spawn main loop driver */
  aw->context = g_main_context_new ( );
  aw->mainloop = g_main_loop_new ( aw->context, FALSE );
  g_main_context_push_thread_default ( aw->context );

  /* attach socket */
  if ( listen(aw->server_socket, AJAX_QUEUE_SIZE) != 0 )
    {
      log_print ( "ajax-%u: unable to listen on socket: %s", aw->uid, strerror(errno) );
      return NULL;
    }

  aw->server_chan = g_io_channel_unix_new ( aw->server_socket );
  aw->server_src = g_io_create_watch ( aw->server_chan, G_IO_IN );
  g_source_set_callback ( aw->server_src, (GSourceFunc)handle_new_connection, aw, NULL );
  g_source_attach ( aw->server_src, aw->context );

  /* enter main loop */
  aw->nb_requests = 0;
  g_timeout_add_seconds ( 60, (GSourceFunc)handle_alive_timeout, aw );
  g_main_loop_run ( aw->mainloop );
  return NULL;
}


/*
 * ajax_worker_shutdown
 */
void
ajax_worker_shutdown ( ajax_worker *aw )
{
  log_print ( "ajax-%d: shut down ordered.\n", aw->uid );

  g_io_channel_shutdown ( aw->server_chan, TRUE, NULL );
  g_io_channel_unref ( aw->server_chan );
  g_source_unref ( aw->server_src );

  g_main_loop_quit ( aw->mainloop );
  g_main_context_unref ( aw->context );
  g_main_loop_unref ( aw->mainloop );
}


/*
 * ajax_worker_free
 */
void
ajax_worker_free ( ajax_worker *aw )
{
  g_thread_join ( aw->thread );
  g_free ( aw );
}
