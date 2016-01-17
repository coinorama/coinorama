/*
 * chainrefd.c
 *
 * This program is the database daemon for chainref.
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


#define _DEFAULT_SOURCE
#include <unistd.h>
#include <stdlib.h>
#include <stdio.h>
#include <string.h>
#include <errno.h>
#include <glib.h>
#include <sys/socket.h>
#include <sys/un.h>
#include <signal.h>

#include "chainref-blockchain.h"
#include "chainref-utils.h"
#include "chainref-ajax.h"
#include "chainrefd.h"



/*
 * globals
 */
gboolean daemonize = FALSE;
gchar *logname = NULL;

gint server_socket;
GIOChannel *server_chan;

GMainLoop *mainloop = NULL;


/*
 * handle_shutdown
 */
static void
handle_shutdown ( int sig )
{
  g_main_loop_quit ( mainloop );
}



/*
 * handle_alive_timeout
 */
static gboolean
handle_alive_timeout ( gpointer data )
{
  gdouble nb_blocks;

  nb_blocks = (gdouble) BLOCKCHAIN->store->nb_entries;
  log_print ( "core: alive with %.1fK blocks\n", nb_blocks/1000.0 );
  return TRUE;
}



/*
 * handle_new_connection
 */

#define BUFFER_SIZE 512

typedef enum
  {
    CMD_NOP,
    CMD_STATS,
    CMD_APPEND_BLOCK_DATA,
#ifdef WITH_POOLS
    CMD_APPEND_POOLS_DATA,
#endif
    CMD_SHUTDOWN,
    CMD_ERROR
  } command_type ;

struct command_st;
typedef struct command_st command;

struct command_st
{
  command_type type;
  blockchain *chain;
  gdouble data[STORE_MAX_NB_COLS];
  gint window;
};


gboolean
chainrefd_read_command ( GIOChannel *chan,
                         command *cmd )
{
  gchar *buffer;
  gsize nbread;
  GError *error = NULL;
  GIOStatus status;
  gboolean abort = FALSE;

  buffer = (gchar *) g_malloc ( sizeof(gchar) * BUFFER_SIZE );
  error = NULL;

  cmd->type = CMD_NOP;

  do
    {
      status = g_io_channel_read_chars ( chan, buffer, BUFFER_SIZE, &nbread, &error );

      if ( error != NULL )
        {
          log_print ( "core: command-read: command channel reading failed: %s.\n", error->message );
          break;
        }

      if ( nbread > 0 )
        {
          /* danger: we assume here that the whole command has been read */
          switch ( buffer[0] )
            {
              case 's':
                cmd->type = CMD_STATS;
                break;

              case 'h':
                cmd->type = CMD_SHUTDOWN;
                break;

              case 'a':
                /* determine data type : 'block' or 'pools' */
                if ( buffer[2] == 'b' )
                  {
                    cmd->type = CMD_APPEND_BLOCK_DATA;
                    refblock_generate_data_from_text ( &buffer[2+6], cmd->data ); /* a block ID STAMP etc.. */
                  }
                else if ( buffer[2] == 'p' )
                  {
                    #ifdef WITH_POOLS
                    cmd->type = CMD_APPEND_POOLS_DATA;
                    cmd->window = 2016;

                    /* a pools [2016|672|224] <data> */
                    if ( buffer[9] == '2' )
                      {
                        block_generate_data_from_text ( &buffer[2+6+4], cmd->data, BLOCKCHAIN->pools_224_store->nb_cols );
                        cmd->window = 224;
                      }
                    else if ( buffer[9] == '7' )
                      {
                        block_generate_data_from_text ( &buffer[2+6+4], cmd->data, BLOCKCHAIN->pools_672_store->nb_cols );
                        cmd->window = 672;
                      }
                    else
                      block_generate_data_from_text ( &buffer[2+6+5], cmd->data, BLOCKCHAIN->pools_2016_store->nb_cols );
                    #else
                    log_print ( "core: warning: ignoring new pools data, feature disabled at compile-time.\n", error->message );
                    #endif
                  }
                break;
            }
        }
    }
  while ( ( status == G_IO_STATUS_NORMAL ) && ( !abort ) );

  if ( abort || ( error != NULL ) )
    {
      log_print ( "core: command-read: command parsing failed.\n" );
      return TRUE;
    }

  g_free ( buffer );
  return FALSE;
}

static gboolean
handle_new_connection ( GIOChannel *chan,
                        GIOCondition cond,
                        gpointer *data )
{
  gint client_socket;
  struct sockaddr_un client_addr;
  socklen_t client_addr_len = sizeof ( struct sockaddr_un );
  GIOChannel *client_chan;
  command cmd;

  memset ( &client_addr, 0, sizeof(struct sockaddr_un) );

  if ( (client_socket = accept(server_socket, (struct sockaddr *) &client_addr, &client_addr_len)) < 0 )
    {
      log_print ( "core: unable to accept new connection: %s.\n", strerror(errno) );
      return FALSE;
    }

  client_chan = g_io_channel_unix_new ( client_socket );

  chainrefd_read_command ( client_chan, &cmd );

  g_io_channel_shutdown ( client_chan, TRUE, NULL );
  g_io_channel_unref ( client_chan );

  switch ( cmd.type )
    {
      case CMD_NOP:
        break;

      case CMD_SHUTDOWN:
        handle_shutdown ( 0 );
        return FALSE;

      case CMD_APPEND_BLOCK_DATA:
        blockchain_append_single_block_data ( BLOCKCHAIN, cmd.data );
        /* log_print ( "core: appending data\n" ); */
        break;

#ifdef WITH_POOLS
      case CMD_APPEND_POOLS_DATA:
        blockchain_append_single_pools_data ( BLOCKCHAIN, cmd.window, cmd.data );
        /* log_print ( "core: appending pools data\n" ); */
        break;
#endif

      case CMD_STATS:
        handle_alive_timeout ( NULL );
        break;

      case CMD_ERROR:
        log_print ( "core: handling of command channel failed.\n" );
        break;
    }

  return TRUE;
}


/*
 * parse_options
 */
static GOptionEntry entries[] =
{
  { "daemon", 'd', 0, G_OPTION_ARG_NONE, &daemonize, "Run the program as a daemon", NULL },
  { "log", 'l', 0, G_OPTION_ARG_STRING, &logname, "Redirect the output to a log file", "filename" },
  { NULL }
};

static void
parse_options ( int argc,
                char *argv[] )
{
  GError *error = NULL;
  GOptionContext *context;

  context = g_option_context_new ( "" );
  g_option_context_add_main_entries ( context, entries, NULL );

  if ( !g_option_context_parse(context,&argc,&argv,&error) )
    {
      g_print ( "chainrefd: option parsing failed: %s\n", error->message );
      exit ( 1 );
    }

  g_option_context_free ( context );
}



/*
 * main
 */
int
main ( int argc,
       char *argv[] )
{
  GMainContext *context;
  gint retval;
  struct sockaddr_un server_addr;
  socklen_t server_len;
  FILE *flock = NULL;
  ajax_worker *aw1;
  ajax_worker *aw2;

  /* configure daemon */
  parse_options ( argc, argv );

  if ( access("/tmp/chainrefd.lock", F_OK ) == 0 )
    {
      fprintf ( stderr, "chainrefd seems to be running already, aborting...\n" );
      fprintf ( stderr, "remove /tmp/chainrefd.lock to override\n" );
      return 2;
    }

  flock = fopen ( "/tmp/chainrefd.lock", "w" );
  fclose ( flock );

  /* spawn log */
  if ( log_open(logname) )
    {
      unlink ( "/tmp/chainrefd.lock" );
      return 1;
    }

  /* daemonization */
  if ( daemonize )
    {
      if ( logname == NULL )
        {
          logname = g_strdup ( "chainrefd.log" );
          log_open ( logname );
        }

      retval = daemon ( 1, 1 );

      if ( retval )
        {
          log_print ( "core: unable to daemonize: %s.\n", strerror(errno) );
          unlink ( "/tmp/chainrefd.lock" );
          return 1;
        }
    }

  log_print ( "chainrefd version %s (api %s)\n", CHAINREFD_VERSION, CHAINREF_API_VERSION );

  /* spawn blockchain descriptor */
  BLOCKCHAIN = blockchain_new ( CHAIN_BITCOIN, "btc", "data" );

  if ( BLOCKCHAIN == NULL )
    {
      log_print ( "core: unable to load blockchain data.\n" );
      unlink ( "/tmp/chainrefd.lock" );
      return 1;
    }

  /* spawn main loop driver */
  context = g_main_context_default ( );
  mainloop = g_main_loop_new ( context, FALSE );
  signal ( SIGTERM, handle_shutdown );
  signal ( SIGINT, handle_shutdown );
  signal ( SIGQUIT, handle_shutdown );
  signal ( SIGPIPE, SIG_IGN );

  /* spawn network listener */
  server_socket = socket ( AF_UNIX, SOCK_STREAM, 0 );
  if ( server_socket == -1 )
    {
      log_print ( "core: unable to create socket: %s.\n", strerror(errno) );
      unlink ( "/tmp/chainrefd.lock" );
      return 1;
    }

  unlink ( "/tmp/chainrefd" );
  memset ( &server_addr, 0, sizeof(struct sockaddr_un) );
  server_addr.sun_family = AF_UNIX;
  strcpy ( server_addr.sun_path, "/tmp/chainrefd" );
  server_len = strlen(server_addr.sun_path) + sizeof(server_addr.sun_family);

  retval = bind ( server_socket, (struct sockaddr *) &server_addr, server_len );
  if ( retval != 0 )
    {
      log_print ( "core: unable to bind socket: %s.\n", strerror(errno) );
      unlink ( "/tmp/chainrefd.lock" );
      return 1;
    }

  if ( listen(server_socket, CHAINREFD_QUEUE_SIZE) != 0 )
    {
      log_print ( "core: unable to listen on socket: %s", strerror(errno) );
      unlink ( "/tmp/chainrefd.lock" );
      return 1;
    }

  server_chan = g_io_channel_unix_new ( server_socket );

  g_io_add_watch ( server_chan, G_IO_IN, (GIOFunc)handle_new_connection, NULL );

  /* run one ajax worker */
  aw1 = ajax_worker_new ( 0 );
  aw2 = ajax_worker_new ( 1 );

  /* enter main loop */
  handle_alive_timeout ( NULL ); /* print startup status */
  g_timeout_add_seconds ( 60, (GSourceFunc)handle_alive_timeout, NULL );
  g_main_loop_run ( mainloop );

  /* prepare for exit */
  log_print ( "core: shut down ordered.\n" );

  ajax_worker_shutdown ( aw1 );
  ajax_worker_free ( aw1 );
  ajax_worker_shutdown ( aw2 );
  ajax_worker_free ( aw2 );

  g_io_channel_shutdown ( server_chan, TRUE, NULL );
  g_io_channel_unref ( server_chan );
  g_main_loop_unref ( mainloop );

  /* dump, clean up and exit */
  unlink ( "/tmp/chainrefd.lock" );

  blockchain_free ( BLOCKCHAIN );

  log_close ( );
  if ( logname != NULL )
    g_free ( logname );

  return 0;
}
