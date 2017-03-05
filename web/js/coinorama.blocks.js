/*
 * coinorama.blocks.js
 * Chainref latest blocks display
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


$( function() {

    var fetchFull = true;
    var previous_blocks_data = null;
    var previous_blocks_last = 0;
    var nb_fetch_errors = 3; /* at startup, fetch errors must be reported */

    network_timeout_id = -1;


    /****************
     ** Formatters **
     ****************/

    function prettySizeUnit ( s )
    {
        if ( s < 1000 )
            return s.toString() + ' bytes';
        else if ( s < 1000*1000 )
            return (s/1000.0).toFixed(2) + ' KB';
        else if ( s < 1000*1000*1000 )
            return (s/(1000.0*1000.0)).toFixed(2) + ' MB';
        else
            return (s/(1000.0*1000.0*1000.0)).toFixed(2) + ' GB';
    }

    /* may not be 100% accurate (float instead of Big decimal) */
    function prettyAmountUnit ( a )
    {
        if ( a < 0.001 )
            return (a*1e6).toPrecision(3) + ' µɃ';
        else if ( a < 1 )
            return (a*1e3).toPrecision(5) + ' mɃ';
        return a.toString() + ' Ƀ';
    }


    /******************************
     ** Display of Latest Blocks **
     ******************************/

    function updateBlockchainDisplay ( )
    {
        var animate = false;
        var rawstats = previous_blocks_data[0].stats;

        if ( rawstats == null )
            return;

        if ( previous_blocks_last != rawstats[rawstats.length-1][0] )
            animate = true;

        previous_blocks_last = rawstats[rawstats.length-1][0];

        var div = $('div#blocks_last');

        var ins = '<table class="blocks_table"><colgroup><col/><col/><col/><col/><col/><col/></colgroup>';
        ins += '<tr style="font-weight:bold"><td>ID</td><td>Date</td><td>Difficulty</td><td>Mining Time</td><td>Size</td><td>Nb. Tx</td><td>Volume</td><td>Fees</td></tr>';

        for ( var i=(rawstats.length-1); i>1; --i )
        {
            var now = (new Date ()).getTime() / 1000;
            ins += '<tr><td>' + rawstats[i][0] + '</td>';
            ins += '<td>' + formatTickDuration(now-rawstats[i][1]) + ' ago</td>';
            ins += '<td>' + rawstats[i][2].toExponential(1) + '</td>';
            ins += '<td>~ ' + formatTickDurationRounded(rawstats[i][12]) + '</td>';
            ins += '<td>' + prettySizeUnit(rawstats[i][4]) + '</td>';
            ins += '<td>' + rawstats[i][6] + '</td>';
            ins += '<td>' + prettyAmountUnit(rawstats[i][7]) + '</td>';
            ins += '<td>' + prettyAmountUnit(rawstats[i][8]) + '</td>' + '</tr>';
        }

        if ( animate )
            div.css ( 'opacity', 0 );

        div.empty ( );
        div.append ( ins + '</table>' );

        if ( animate )
            div.animate ( {opacity:1} , 500, 'linear' );
    }


    /****************************
     ** Network Stats Fetching **
     ****************************/

    function onNetworkFetchSuccess ( data )
    {
        nb_fetch_errors = 0;

        if ( fetchFull )
        {
            /* full dataset requested but it's not it, bail out */
            if ( data.f != 1 )
                return;

            /* the full dataset was fetched, overwrite previous_data with it */
            previous_blocks_data = jQuery.makeArray ( data.data );
            fetchFull = false;
        }
        else if ( data.f == 0 )
        {
            /* only the two most recent lines were fetched, use them to update previous_data */
            new_data = jQuery.makeArray ( data.data );
            var new_stats = new_data[0].stats;
            var prev_stats = previous_blocks_data[0].stats;

            if ( prev_stats.length > 0 )
            {
                prev_stats.pop ( ); /* remove previous floating line */
                if ( prev_stats.length > 0 )
                {
                    var l = prev_stats.pop ( ); /* remove newest solid line */
                    if ( l[0] != new_stats[0][0] ) /* if newest solid line is different */
                    {
                        if ( prev_stats.length > 0 )
                        {
                            /* if oldest solid line is too old, 2 hours */
                            if ( (l[1] - prev_stats[0][1]) > (3600*2) )
                                prev_stats.shift ( ); /* skip oldest solid line */
                        }
                        prev_stats.push ( l ); /* put previously newest solid line back */
                    }
                }
            }
            prev_stats.push ( new_stats[0] ); /* append new solid line */

            if ( new_stats.length > 1 )
                prev_stats.push ( new_stats[1] ); /* append new floating line */
        }

        coinorama_ticks_updateNetwork ( jQuery.makeArray(data.ticks) );
        updateBlockchainDisplay ( );
    }

    function onNetworkFetchError ( qid, text, error )
    {
        nb_fetch_errors += 1;

        if ( nb_fetch_errors > 3 )
        {
            $('span#winmsg_title').text ( 'Error' );
            $('div#winmsg_ctnt').html ( 'Sorry, latest blockchain data could not be fetched.<br/>' + 
                                        'Just in case, please reload the page in a couple of minutes.<br/><br/>' );
            windowShow ( 'message' );
        }
    }

    function fetchNetworkData ( )
    {
        var params = [ ];
        var data_url = '/coinorama/data.bf';

        /* detailed view, no tick-only & full */
        params.push ( 'v=p' );
        params.push ( 'k=0' );

        /* fetch full history if required */
        if ( fetchFull )
            params.push ( 'f=1' );

        if ( params.length > 0 )
            data_url = data_url + '?' + params.join('&');

        $.ajax ( { url:data_url, type:'GET', dataType:'json', success:onNetworkFetchSuccess, error:onNetworkFetchError } );
        network_timeout_id = setTimeout ( fetchNetworkData, 30000 );
    }



    /*****************
     ** ENTRY POINT **
     *****************/

    if ( coinorama_getCurrentSection() != 'B' )
        return;

    fetchNetworkData ( );
});
