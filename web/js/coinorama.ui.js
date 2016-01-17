/*
 * coinorama.ui.js
 * Coinorama user interface
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


/*
 * Window
 */

var windows = { };

function windowClose ( win_id )
{
    $('div#win_'+win_id).remove ( );
    $('body').css ( 'cursor', 'default' );
}

function windowReduce ( win_id )
{
    var ctnt = $('div#win_ctnt_'+win_id);

    if ( ctnt.css('display') == 'none' )
        $('a#ctred_'+win_id).text ( '-' );
    else
        $('a#ctred_'+win_id).text ( 'o' );

    $(ctnt).slideToggle ( );
    $('div#win_cl_'+win_id).slideToggle ( );
}

function windowRaise ( win )
{
    for ( w in windows )
        if ( windows[w] !== undefined )
            windows[w].css ( 'z-index', '1' );

    win.css ( 'z-index', '2' );
}

function windowHide ( win )
{
    if ( windows[win] !== undefined )
        windows[win].hide ( );
}

function windowToggle ( win )
{
    if ( windows[win] !== undefined )
    {
        windows[win].slideToggle ( );

        if ( windows[win].css('display') != 'none' )
            windowRaise ( windows[win] );
    }
}

function windowShow ( win )
{
    if ( windows[win] !== undefined )
    {
        if ( windows[win].css('display') == 'none' )
            windowToggle ( win );
        else
            windowRaise ( windows[win] );
    }
}

function windowUI ( win, winbar )
{
    var relX, relY;
    var maxX, maxY;
    var mouseDown;

    win.css ( 'position', 'absolute' );

    win.on ( 'mousedown', function(e) {
        windowRaise ( win );
    });

    winbar.on ( 'mousedown', function(e) {
        e.preventDefault ( );
        var pos = win.offset();
        maxX = $('body').width() - win.width() - 10;
        maxY = $('body').height() - win.height() - 10;
        relX = e.pageX - pos.left;
        relY = e.pageY - pos.top;
        mouseDown = true;
        windowRaise ( win );
    });

    $(document).on ( 'mousemove', function(e) {
        e.preventDefault ( );
        if ( mouseDown )
        {
            var diffX = e.pageX - relX;
            var diffY = e.pageY - relY;
            if ( diffX < 0)   diffX = 0;
            if ( diffY < 0)   diffY = 0;
            if ( diffX > maxX) diffX = maxX;
            /*if ( diffY > maxY) diffY = maxY;*/
            /*
            win.css ( 'top', (diffY)+'px');
            win.css ( 'left', (diffX)+'px');
            */
            win.css ( 'transform', 'translate(' + diffX + 'px,' + diffY + 'px)' );
        }
    });

    $(window).on ( 'mouseup', function(e) {
        mouseDown = false;
    });

    winbar.on ( 'mouseenter', function(e) {
        winbar.css ( 'background-color', '#c6881d' );
        $('body').css ( 'cursor', 'move' );
    });

    winbar.on ( 'mouseleave', function(e) {
        winbar.css ( 'background-color', '#e8a634' );
        $('body').css ( 'cursor', 'default' );
    });
}



$( function() {

    var win_ui = [ 'message', 'about', 'markets_help', 'network_help' ];

    var defaultY = $('body').height() * 0.2;

    for ( w in win_ui )
    {
        var win_div = $('div#'+win_ui[w]);
        windowUI ( win_div, $('div#winbar_'+win_ui[w]) );
        windows[win_ui[w]] = win_div;
        win_div.css ( 'transform', 'translate(200px,'+defaultY+'px)' );
    }

    $('a#ct_message').on ( 'click', function(e) { e.preventDefault(); windowToggle('message'); } );
    $('a#ct_about').on ( 'click', function(e) { e.preventDefault(); windowToggle('about'); } );
    $('a#ct_markets_help').on ( 'click', function(e) { e.preventDefault(); windowToggle('markets_help'); } );
    $('a#ct_network_help').on ( 'click', function(e) { e.preventDefault(); windowToggle('network_help'); } );
});
