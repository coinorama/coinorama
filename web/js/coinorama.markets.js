/*
 * coinorama.markets.js
 * Coinref data plotting and user configuration
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

function coinorama_markets_load ( )
{
    var views = [ ];

    for ( var i in exchanges_views )
    {
        var v = exchanges_views[i]; /* exchanges_views is obtained from markets configuration data fetched at init */
        views.push ( { code:v['code'], name:v['name'], precname:v['precname'], length:v['length'], precision:v['precision'], shortformat:'%H:%M', format:'%H:%M' } );
        if ( views[i].length >= 365*24*60*60*1000 )
        {
            views[i].shortformat = '%m/%Y';
            views[i].format = '%b. %Y';
        }
        else if ( views[i].length >= 92*24*60*60*1000 )
        {
            views[i].shortformat = '%d/%m';
            views[i].format = '%d. %b';
        }
        else if ( views[i].length >= 7*24*60*60*1000 )
        {
            views[i].shortformat = '%d/%m';
            views[i].format = '%a. %d';
        }
        else if ( views[i].length >= 3*24*60*60*1000 )
        {
            views[i].shortformat = '%d/%m';
            views[i].format = '%a. %Hh';
        }
    }

    var views_table = { };
    for ( var i in views )
        views_table[views[i].code] = views[i];

    var config = { mode:'c',
                   exch:Object.keys(exchanges_uid)[0],
                   exch_multi:1+2+4+32+2048,
                   view:'s',
                   viewmode:'length',
                   rpanel:true,
                   theme:'classic',
                   yaxis:'right',
                   curr:{ },
                   ml1:{name:'price',expand:true},
                   ml2:{name:'baratio',merged:true},
                   ml3:{name:'volume'},
                   mr1:{name:'pricerel'},
                   mr2:{name:'book'},
                   mr3:{name:'lag'}
                 };

    var EMA7_K = 2 / (7+1);
    var EMA9_K = 2 / (9+1);
    var EMA12_K = 2 / (12+1);
    var EMA26_K = 2 / (26+1);

    var MAVG_WINDOW = 7;
    var MAVG_WINDOW_S = 3;

    var MAX_LAG = 28;

    var shown_exchanges = { };
    var nb_shown_exchanges = 0;
    var shown_currency = 'USD';
    var exchanges_merged = { };

    var charts_types = { }; /* chart classes */
    var charts = { 'ml1':null, 'ml2':null, 'ml3':null, 'mr1':null, 'mr2':null, 'mr3':null };

    var fetchFull = true;

    var fetchBook = true;
    var book_timestamp = 0;
    var rawbooks_cache = { };

    /* interface */
    var color_item_enabled = '#fff';
    var color_item_disabled = '#777';
    var color_currency = '#bbb';

    var ui_img_button_enabled = '/coinorama/static/btn-enabled.png';
    var ui_img_button_disabled = '/coinorama/static/btn-disabled.png';
    var ui_img_toggle_enabled = '/coinorama/static/btn-toggle-enabled.png';
    var ui_img_toggle_disabled = '/coinorama/static/btn-toggle-disabled.png';
    var ui_img_reduce = '/coinorama/static/btn-reduce.png';
    var ui_img_expand = '/coinorama/static/btn-expand.png';

    var ui_lpanel_width = '73%';
    var ui_lpanel_width_alone = '100%';
    var ui_lpanel_width_with_large_rpanel = '50%';

    var ui_rpanel_width = '27%';
    var ui_rpanel_width_large = '50%';

    /* charts settings */
    var yaxis_position = 'right';
    var lbl_width = 40;
    var automargin = 0.005;

    /*
     * chart colors
     */
    var color_chart_axis = '#151515';
    var color_chart_axis_text = '#eee';
    var color_chart_legend_bg = '#000';

    /* single */
    var color_chart_theme_classic = '#e5db49';

    var color_chart_theme_classic_price = color_chart_theme_classic;
    var color_chart_theme_classic_price_mavg = '#77a3ef'; //'#bdcd90';
    var color_chart_theme_classic_baratio = color_chart_theme_classic;
    var color_chart_theme_classic_baratio_mavg = '#77a3ef'; //'#bdcd90';
    var color_chart_theme_classic_volume = color_chart_theme_classic;
    var color_chart_theme_classic_lag = color_chart_theme_classic;
    /*
    var color_chart_theme_classic_asks = '#e5db49';
    var color_chart_theme_classic_bids = '#a5bb29';
    */

    var color_chart_theme_perchart_price = '#bdcd00';
    var color_chart_theme_perchart_price_mavg = '#ddffcc';
    var color_chart_theme_perchart_baratio = '#5a50cd';
    var color_chart_theme_perchart_baratio_mavg = '#bbccff';
    var color_chart_theme_perchart_volume = '#46ad60';
    var color_chart_theme_perchart_lag = '#a2c4c7';
    var color_chart_theme_perchart_asks = '#cc3300'; /* '#f00'; */
    var color_chart_theme_perchart_bids = '#33cc03'; /* '#0f0'; */

    var color_chart_price = color_chart_theme_classic_price;
    var color_chart_price_mavg = color_chart_theme_classic_price_mavg;
    var color_chart_price_ema12 = '#77a3ef';
    var color_chart_price_ema26 = '#ef9f5c';
    var color_chart_macd = '#4234df';
    var color_chart_macd_ema9 = '#f61000';
    var color_chart_low = '#f61000';
    var color_chart_high = '#55ef0f';
    var color_chart_baratio = color_chart_theme_classic_baratio;
    var color_chart_baratio_mavg = color_chart_theme_classic_baratio_mavg;
    var color_chart_volume = color_chart_theme_classic_volume;
    var color_chart_lag = color_chart_theme_classic_lag;

    var color_chart_asks = color_chart_theme_perchart_asks; /* classic asks color is not used in single mode */
    var color_chart_bids = color_chart_theme_perchart_bids; /* classic bids color is not used in single mode */


    /* multi */
    var colors_chart_theme_classic = [ color_chart_theme_classic, '#a34696', '#5377bf', '#e5973a', '#ba4c40' ];
    /* classic vivid colors : [ '#dddd27', '#f28a28', '#d22924', '#d80296', '#5369bf', '#ffffff' ] */
    var colors_chart_theme_classic_book = [ ['#e5db49','#a5bb29'], ['#a34696','#632665'],
                                            ['#5377bf','#405988'], ['#e5973a','#a5673a'], ['#ba4c40','#7a2c20'] ];

    var colors_chart_theme_perchart_price = [ '#bdcd00', '#b28a28', '#f28a28', '#d83e02', '#c3503d' ];
    var colors_chart_theme_perchart_baratio = [ '#a191c6', '#5a50cd', '#8450cd', '#a3468f', '#c3266f' ];
    var colors_chart_theme_perchart_volume =[ '#36ad70', '#268fb8', '#3759b9', '#442f6f', '#622f8f' ];
    var colors_chart_theme_perchart_lag = [ '#bfa4a7', '#a2a4a7', '#57585f', '#a2c4b7', '#82b4c7' ];
    var colors_chart_theme_perchart_book = [ ['#00ff00','#ff0000'], ['#00ff99','#ff00cc'],
                                             ['#00cc44','#cc0044'], ['#acf000','#ffcc00'], ['#0fff50','#ff8f00'] ];

    var colors_chart_price = colors_chart_theme_classic;
    var colors_chart_baratio = colors_chart_theme_classic;
    var colors_chart_volume = colors_chart_theme_classic;
    var colors_chart_lag = colors_chart_theme_classic;
    var colors_chart_book = colors_chart_theme_classic_book;

    /* data refresh timeout handler */
    var timeout_id = -1;
    var markets_resize_timeout_id = -1;
    var nb_fetch_errors = 3; /* at startup, fetch errors must be reported */

    var exchangesData = [ ];

    /* encode the shown exchanges UID */
    function getShownExchangesUIDs ( )
    {
        var nuids = 0;

        for ( e in exchanges_uid )
        {
            if ( shown_exchanges[e] )
                nuids += exchanges_uid[e];
        }

        return nuids;
    }


    /* Configuration */
    function decodeConfig ( conf_str )
    {
        var newconf;

        try { newconf = JSON.parse ( conf_str ); }
        catch (e) { return; }

        /* todo: add reset config in settings */

        if ( 'sc'.indexOf(newconf.mode) != -1 )
            config.mode = newconf.mode;

        if ( newconf.exch in exchanges_uid )
            config.exch = newconf.exch;

        if ( newconf.exch_multi < 0 )
            newconf.exch_multi = 595;
        config.exch_multi = newconf.exch_multi;

        if ( newconf.view in views_table )
            config.view = newconf.view;

        if ( newconf.viewmode in {'length':0, 'interval':1} )
            config.viewmode = newconf.viewmode;

        if ( newconf.theme in {'classic':0, 'thematic':1} )
            config.theme = newconf.theme;

        if ( newconf.yaxis in {'left':0, 'right':1} )
            config.yaxis = newconf.yaxis;

        if ( newconf.hasOwnProperty('rpanel') )
            config.rpanel = newconf.rpanel;

        if ( newconf.hasOwnProperty('curr') )
        {
            for ( i in currency_list )
            {
                var c = currency_list[i];
                if ( newconf.curr.hasOwnProperty(c) )
                    config.curr[c] = newconf.curr[c];
            }
        }

        for ( cid in charts )
            if ( newconf.hasOwnProperty(cid) )
                if ( newconf[cid].name in charts_types )
                    config[cid] = newconf[cid];
    }

    function readConfig ( )
    {
        var c_value = document.cookie;
        var c_start = c_value.indexOf ( 'markets=' );
        if ( c_start == -1 )
            return;
        c_start = c_value.indexOf ( '=', c_start ) + 1;
        var c_end = c_value.indexOf ( ';', c_start );
        if ( c_end != -1 )
            c_value = unescape ( c_value.substring(c_start,c_end) );
        else
            c_value = unescape ( c_value.substring(c_start) );
        decodeConfig ( c_value );
    }

    function saveConfig ( )
    {
        var exdate = new Date();
        exdate.setDate ( exdate.getDate() + 366 );

        for ( cid in charts )
            config[cid] = charts[cid].getConfig ( );

        document.cookie = 'markets=' + JSON.stringify(config) + '; expires=' + exdate.toUTCString();
    }

    var common_lines_options = {
        canvas: true,
        tooltip: true,
        tooltipOpts: { content: '%y.2<br/> %x', xDateFormat: '%d-%b-%Y %H:%M:%S' },
        legend: { position:'nw', margin:0, backgroundOpacity:0.5, backgroundColor:color_chart_legend_bg },
        series: { stack:false },
        lines: { show:true },
        grid: { hoverable:true, borderWidth:'0' },
        points: {show:false },
        xaxis: { mode: 'time', timezone:'browser', timeformat:'%H:%M:%S', font:{color:color_chart_axis_text}, color:color_chart_axis, autoscaleMargin:automargin, ticks:null },
        yaxis: { font:{color:color_chart_axis_text}, labelWidth:lbl_width, color:color_chart_axis, position:yaxis_position, tickFormatter:null }
    };


    /*
     * exchangeAppendDataLine
     */
    function exchangeAppendDataLine ( e, l )
    {
        var VIEW_COLUMN_TIME = 0;
        var VIEW_COLUMN_PRICE = 1;
        var VIEW_COLUMN_SUM_ASKS = 2;
        var VIEW_COLUMN_SUM_BIDS = 3;
        var VIEW_COLUMN_VOLUME = 4;
        var VIEW_COLUMN_NB_TRADES = 5;
        var VIEW_COLUMN_LAG = 6;
        var VIEW_COLUMN_TOP_ASK = 7;
        var VIEW_COLUMN_TOP_BID = 8;
        var VIEW_COLUMN_USD_CONVRATE = 9;
        var VIEW_COLUMN_ATR = 10;
        var VIEW_COLUMN_RSI = 11;
        var VIEW_COLUMN_TSI = 12;
        var VIEW_COLUMN_OPEN = 13;
        var VIEW_COLUMN_CLOSE = 14;
        var VIEW_COLUMN_MIN = 15;
        var VIEW_COLUMN_MAX = 16;
        var VIEW_COLUMN_ADX_DMP = 17;
        var VIEW_COLUMN_ADX_DMN = 18;
        var VIEW_COLUMN_ADX = 19;
        var VIEW_COLUMN_VARIANCE7 = 20;
        var VIEW_COLUMN_VARIANCE21 = 21;
        var VIEW_COLUMN_EMA12 = 22;
        var VIEW_COLUMN_EMA26 = 23;
        var VIEW_COLUMN_MACD_EMA9 = 24;
        var VIEW_COLUMN_TSI_EMA7 = 25;

        var timestamp = l[VIEW_COLUMN_TIME] * 1000;

        if ( shown_currency == 'USD' )
            e.usd_conv_rate = l[VIEW_COLUMN_USD_CONVRATE];

        var convtd_price = l[VIEW_COLUMN_PRICE] * e.usd_conv_rate;
        e.prices.push ( [timestamp,convtd_price] );

        e.prices_accum.push ( convtd_price );
        e.prices_sum += convtd_price;
        if ( e.prices_accum.length > MAVG_WINDOW )
            e.prices_sum -= e.prices_accum.shift ( );
        e.prices_mavg.push ( [ timestamp, e.prices_sum/e.prices_accum.length ] );

        e.sum_asks.push ( [timestamp,l[VIEW_COLUMN_SUM_ASKS]] );
        e.sum_bids.push ( [timestamp,l[VIEW_COLUMN_SUM_BIDS]*e.usd_conv_rate] );

        var e_baratio = l[VIEW_COLUMN_SUM_BIDS] / (l[VIEW_COLUMN_SUM_ASKS] * l[VIEW_COLUMN_PRICE]);
        e.baratios.push ( [ timestamp, e_baratio ] );
        e.baratios_accum.push ( e_baratio );
        e.baratios_sum += e_baratio;
        if ( e.baratios_accum.length > MAVG_WINDOW )
            e.baratios_sum -= e.baratios_accum.shift ( );
        e.baratios_mavg.push ( [ timestamp, e.baratios_sum/e.baratios_accum.length ] );

        e.volume.push ( [ timestamp, l[VIEW_COLUMN_VOLUME ] ] );
        e.nb_trades.push ( [ timestamp, l[VIEW_COLUMN_NB_TRADES] ] );

        if ( l[VIEW_COLUMN_NB_TRADES] > 0 )
            e.avg_trade_size.push ( [ timestamp, l[VIEW_COLUMN_VOLUME] / l[VIEW_COLUMN_NB_TRADES] ] );
        else
            e.avg_trade_size.push ( [ timestamp, 0 ] );

        e.lag.push ( [ timestamp, Math.min(MAX_LAG,l[VIEW_COLUMN_LAG]) ] );
        e.top_ask.push ( [ timestamp, l[VIEW_COLUMN_TOP_ASK]*e.usd_conv_rate] );
        e.top_bid.push ( [ timestamp, l[VIEW_COLUMN_TOP_BID]*e.usd_conv_rate] );
        e.atr.push ( [ timestamp, l[VIEW_COLUMN_ATR]*e.usd_conv_rate] );

        var e_rsi = l[VIEW_COLUMN_RSI];
        e.rsi.push ( [ timestamp, e_rsi ] );
        e.rsi_accum.push ( e_rsi );
        e.rsi_sum += e_rsi;
        if ( e.rsi_accum.length > MAVG_WINDOW )
            e.rsi_sum -= e.rsi_accum.shift ( );
        e.rsi_mavg.push ( [ timestamp, e.rsi_sum/e.rsi_accum.length ] );

        e.tsi.push ( [ timestamp, l[VIEW_COLUMN_TSI] ] );

        /* autoswitch to single mode */
        if ( ( config.mode == 's' ) || ( nb_shown_exchanges == 1 ) )
        {
            e.prices_open.push ( [timestamp, l[VIEW_COLUMN_OPEN] ] );
            e.prices_close.push ( [timestamp, l[VIEW_COLUMN_CLOSE] ] );
            e.prices_min.push ( [ timestamp, l[VIEW_COLUMN_MIN] ] );
            e.prices_max.push ( [ timestamp, l[VIEW_COLUMN_MAX] ] );

            e.adx_dmp.push ( [ timestamp, l[VIEW_COLUMN_ADX_DMP] ] );
            e.adx_dmn.push ( [ timestamp, l[VIEW_COLUMN_ADX_DMN] ] );
            e.adx.push ( [ timestamp, l[VIEW_COLUMN_ADX] ] );

            e.variance7.push ( [ timestamp, l[VIEW_COLUMN_VARIANCE7] ] );
            e.variance21.push ( [ timestamp, l[VIEW_COLUMN_VARIANCE21] ] );

            if ( e.macd.length > 0 )
            {
                e.prices_ema12_seed = convtd_price*EMA12_K + e.prices_ema12_seed*(1-EMA12_K);
                e.prices_ema12.push ( [ timestamp, e.prices_ema12_seed ] );
                e.prices_ema26_seed = convtd_price*EMA26_K + e.prices_ema26_seed*(1-EMA26_K);
                e.prices_ema26.push ( [ timestamp, e.prices_ema26_seed ] );

                var macd = e.prices_ema12_seed - e.prices_ema26_seed;
                e.macd.push ( [ timestamp, macd ] );
                e.macd_ema9_seed = macd*EMA9_K + e.macd_ema9_seed*(1-EMA9_K);
                e.macd_ema9.push ( [ timestamp, e.macd_ema9_seed ] );
                e.macd_delta.push ( [ timestamp, macd-e.macd_ema9_seed ] );

                e.tsi_ema7_seed = l[VIEW_COLUMN_TSI]*EMA7_K + e.tsi_ema7_seed*(1-EMA7_K);
                e.tsi_ema7.push ( [ timestamp, e.tsi_ema7_seed ] );
            }
            else
            {
                e.prices_ema12_seed = l[VIEW_COLUMN_EMA12];
                e.prices_ema12.push ( [ timestamp, l[VIEW_COLUMN_EMA12] ] );
                e.prices_ema26_seed = l[VIEW_COLUMN_EMA26];
                e.prices_ema26.push ( [ timestamp, l[VIEW_COLUMN_EMA26] ] );

                var macd = l[VIEW_COLUMN_EMA12] - l[VIEW_COLUMN_EMA26];
                e.macd.push ( [ timestamp, macd ] );
                e.macd_ema9_seed = l[VIEW_COLUMN_MACD_EMA9];
                e.macd_ema9.push ( [ timestamp, l[VIEW_COLUMN_MACD_EMA9] ] );
                e.macd_delta.push ( [ timestamp, macd-l[VIEW_COLUMN_MACD_EMA9] ] );

                e.tsi_ema7_seed = l[VIEW_COLUMN_TSI_EMA7];
                e.tsi_ema7.push ( [ timestamp, l[VIEW_COLUMN_TSI_EMA7] ] );
            }
        }
    }

    /*
     * exchangeShiftDataLine
     * removes the first element of each dataset
     */
    function exchangeShiftDataLine ( e )
    {
        var update_accums = false;

        if ( e.prices.length == 0 )
            return;

        if ( e.prices.length <= MAVG_WINDOW )
            update_accums = true;

        e.prices.shift ( );

        e.prices_mavg.shift ( );
        if ( update_accums )
            e.prices_sum -= e.prices_accum.shift ( );

        /* autoswitch to single mode */
        if ( ( config.mode == 's' ) || ( nb_shown_exchanges == 1 ) )
        {
            e.prices_open.shift ( );
            e.prices_close.shift ( );
            e.prices_min.shift ( );
            e.prices_max.shift ( );

            e.adx_dmp.shift ( );
            e.adx_dmn.shift ( );
            e.adx.shift ( );

            e.variance7.shift ( );
            e.variance21.shift ( );

            e.prices_ema12.shift ( );
            e.prices_ema26.shift ( );
            e.macd.shift ( );
            e.macd_ema9.shift ( );
            e.macd_delta.shift ( );
            e.tsi_ema7.shift ( );
        }

        e.sum_asks.shift ( );
        e.sum_bids.shift ( );
        e.baratios.shift ( );
        e.baratios_mavg.shift ( );
        if ( update_accums )
            e.baratios_sum -= e.baratios_accum.shift ( );

        e.volume.shift ( );
        e.nb_trades.shift ( );
        e.avg_trade_size.shift ( );
        e.lag.shift ( );
        e.atr.pop ( );

        e.rsi.shift ( );
        e.rsi_mavg.shift ( );
        if ( update_accums )
            e.rsi_sum -= e.rsi_accum.shift ( );

        e.tsi.shift ( );
        e.top_ask.shift ( );
        e.top_bid.shift ( );
    }

    /*
     * exchangePopDataLine
     * removes the last element of each dataset
     */
    function exchangePopDataLine ( e )
    {
        if ( e.prices.length == 0 )
            return;

        e.prices.pop ( );
        e.prices_mavg.pop ( );
        e.prices_sum -= e.prices_accum.pop ( );

        /* autoswitch to single mode */
        if ( ( config.mode == 's' ) || ( nb_shown_exchanges == 1 ) )
        {
            e.prices_open.pop ( );
            e.prices_close.pop ( );
            e.prices_min.pop ( );
            e.prices_max.pop ( );

            e.adx_dmp.pop ( );
            e.adx_dmn.pop ( );
            e.adx.pop ( );

            e.variance7.pop ( );
            e.variance21.pop ( );

            e.prices_ema12.pop ( );
            e.prices_ema26.pop ( );
            e.macd.pop ( );
            e.macd_ema9.pop ( );
            e.macd_delta.pop ( );
            e.tsi_ema7.pop ( );

            if ( e.prices.length > 0 )
            {
                e.prices_ema12_seed = e.prices_ema12[e.prices_ema12.length-1][1];
                e.prices_ema26_seed = e.prices_ema26[e.prices_ema26.length-1][1];
                e.macd_ema9_seed = e.macd_ema9[e.macd_ema9.length-1][1];
                e.tsi_ema7_seed = e.tsi_ema7[e.tsi_ema7.length-1][1];
            }
        }

        e.sum_asks.pop ( );
        e.sum_bids.pop ( );
        e.baratios.pop ( );
        e.baratios_mavg.pop ( );
        e.baratios_sum -= e.baratios_accum.pop ( );
        e.volume.pop ( );
        e.nb_trades.pop ( );
        e.avg_trade_size.pop ( );
        e.lag.pop ( );
        e.atr.pop ( );
        e.rsi.pop ( );
        e.rsi_mavg.pop ( );
        e.rsi_sum -= e.rsi_accum.pop ( );
        e.tsi.pop ( );
        e.top_ask.pop ( );
        e.top_bid.pop ( );
    }

    /*
     * Order book data reading
     */
    function exchangeReadBookData ( e, rawbook )
    {
        e.book_bids = [ ];
        e.book_asks = [ ];

        var bids_start = rawbook.bids[0];
        var rawbids = rawbook.bids[1];
        for ( var i=0; i<rawbids.length; ++i )
            e.book_bids.push ( [ (bids_start-i)*e.usd_conv_rate, rawbids[i] ] );

        var asks_start = rawbook.asks[0];
        var rawasks = rawbook.asks[1];
        for ( var i=0; i<rawasks.length; ++i )
            e.book_asks.push ( [ (asks_start+i)*e.usd_conv_rate, rawasks[i] ] );
    }

    /*
     * exchangeUpdateData
     */
    function exchangeUpdateData ( e, newstats, newbook )
    {
        var append_solid_line = true;
        var VIEW_COLUMN_LAG = 6;

        if ( e.prices.length > 0 )
        {
            exchangePopDataLine ( e ); /* remove previous floating line */

            if ( e.prices.length > 0 )
            {
                /* check most recent solid line */
                var last_stamp = e.prices[e.prices.length-1][0];
                var new_stamp = newstats[0][0] * 1000; /* exchange stamps are milliseconds */
                if ( last_stamp != new_stamp )
                {
                    /* if oldest solid line is too old */
                    if ( (new_stamp - e.prices[0][0]) > views_table[config.view].length )
                        exchangeShiftDataLine ( e ); /* remove oldest solid line */
                }
                else /* we already have the most recent solid line */
                    append_solid_line = false;
            }
        }

        if ( append_solid_line )
            exchangeAppendDataLine ( e, newstats[0] );

        /* if it exists, append new floating line */
        if ( newstats.length > 1 )
        {
            var einfo = exchanges_info_by_name[e.name];

            exchangeAppendDataLine ( e, newstats[1] );

            if ( newstats[1][VIEW_COLUMN_LAG] >= MAX_LAG )
                $('span#live_ename_'+einfo.name).html ( '[!] '+einfo.desc );
            else
                $('span#live_ename_'+einfo.name).html ( einfo.desc );
        }

        /* detect new book */
        if ( newbook != null )
            exchangeReadBookData ( e, newbook );
    }

    /*
     * Exchanges data reading
     */
    function readData ( rawexchanges )
    {
        /* explode stats data */
        var exchanges = [ ];

        if ( rawexchanges == null )
            return [ ];

        if ( ( config.mode != 's' ) &&  ( nb_shown_exchanges == 0 ) )
            return [ ];

        for ( var i=0; i<rawexchanges.length; ++i )
        {
            var e_name = rawexchanges[i].name;
            var rawstats = rawexchanges[i].stats;

            /* detect new book or re-use cached one */
            var rawbook = rawexchanges[i].book;
            if ( rawbook != null )
                rawbooks_cache[e_name] = rawbook;
            else
                rawbook = rawbooks_cache[e_name];

            if ( rawbook == null )
            {
                fetchBook = true;
                return [ ];
            }

            /* init exchange object */
            var e = { name:e_name,
                      id:i,
                      usd_conv_rate:1.0,
                      prices:[],
                      prices_mavg:[], prices_accum:[], prices_sum:0,
                      prices_ema12:[], prices_ema12_seed:0,
                      prices_ema26:[], prices_ema26_seed:0,
                      macd:[], macd_ema9:[], macd_ema9_seed:0, macd_delta:[],
                      atr:[],
                      rsi:[], rsi_mavg:[], rsi_accum:[], rsi_sum:0,
                      tsi:[], tsi_ema7:[], tsi_ema7_seed:0,
                      prices_open:[], prices_close:[],
                      prices_min:[],  prices_max:[],
                      adx_dmp:[], adx_dmn:[], adx:[],
                      variance7:[], variance21:[],
                      sum_asks:[], sum_bids:[],
                      baratios:[],
                      baratios_mavg:[], baratios_accum:[], baratios_sum:0,
                      volume:[],
                      nb_trades:[],
                      avg_trade_size:[],
                      lag:[],
                      top_ask:[], top_bid:[],
                      book_asks:[], book_bids:[] };

            /* read stats data */
            for ( var j=0; j<rawstats.length; j++ )
                exchangeAppendDataLine ( e, rawstats[j] );

            exchangeReadBookData ( e, rawbook );
            exchanges.push ( e );
        }

        return exchanges;
    }

    /*
     * Exchanges data merging
     * performs merging of exchanges
     * generates a special exchange object named 'merged'
     */
    function mergeExchangesData ( exchanges, time_table, min_stamp, NB_STAMPS, stride )
    {
        var nbexch = 0;
        var e_prices  = [ ];
        var e_prices_mavg = [ ];
        var e_sum_asks = [ ];
        var e_sum_bids = [ ];
        var e_baratios = [ ];
        var e_baratios_mavg = [ ];
        var baratios_accum = [ ];
        var baratios_sum = 0;
        var e_volume = [ ];
        var e_nb_trades = [ ];
        var e_avg_trade_size = [ ];
        var e_lag = [ ];
        var e_atr = [ ];
        var e_rsi = [ ];
        var e_rsi_mavg = [ ];
        var e_tsi = [ ];
        var prev_N = [ ];

        for ( var j=0, stamp=min_stamp; j<NB_STAMPS; stamp+=stride, ++j )
        {
            e_prices[j] = [stamp,0];
            e_prices_mavg[j] = [stamp,0];
            e_sum_asks[j] = [stamp,0];
            e_sum_bids[j] = [stamp,0];
            e_baratios[j] = [stamp,0];
            e_baratios_mavg[j] = [stamp,0];
            e_volume[j] = [stamp,0];
            e_nb_trades[j] = [stamp,0];
            e_avg_trade_size[j] = [stamp,0];
            e_lag[j] = [stamp,0];
            e_atr[j] = [stamp,0];
            e_rsi[j] = [stamp,0];
            e_rsi_mavg[j] = [stamp,0];
            e_tsi[j] = [stamp,0];
        }

        for ( var i=0; i<exchanges.length; ++i )
            prev_N.push ( -1 );

        /* for every timestamp */
        for ( var j=0; j<NB_STAMPS; ++j )
        {
            nbexch = 0;
            var volume_sum = 0;
            var volume_1d_sum = 0;

            /* accumulate enabled exchanges */
            for ( var i=0; i<exchanges.length; ++i )
            {
                e = exchanges[i];

                if ( !shown_exchanges[e.name] )
                    continue;

                volume_sum += e.volume_synced[j][1]; /* used synchronized volume */

                var N = time_table[i][j];

                if ( N == -1 )
                    N = prev_N[i];

                if ( N != -1 )
                {
                    ++nbexch;
                    volume_1d_sum += exchanges[i].volume_1d;
                    e_prices[j][1] += e.prices[N][1] * e.volume_1d;
                    e_prices_mavg[j][1] += e.prices_mavg[N][1] * e.volume_1d;
                    e_sum_asks[j][1] += e.sum_asks[N][1];
                    e_sum_bids[j][1] += e.sum_bids[N][1];
                    e_nb_trades[j][1] += e.nb_trades[N][1];
                    e_avg_trade_size[j][1] += e.nb_trades[N][1];
                    e_lag[j][1] += e.lag[N][1];
                    e_atr[j][1] += e.atr[N][1];
                    e_rsi[j][1] += e.rsi[N][1];
                    e_rsi_mavg[j][1] += e.rsi_mavg[N][1];
                    e_tsi[j][1] += e.tsi[N][1];
                    prev_N[i] = N;
                }
            }

            e_volume[j][1] = volume_sum;

            if ( volume_1d_sum == 0 )
                volume_1d_sum = 0.0000001;

            if ( nbexch > 0 )
            {
                e_prices[j][1] = e_prices[j][1] / volume_1d_sum;
                e_prices_mavg[j][1] = e_prices_mavg[j][1] / volume_1d_sum;
                e_sum_asks[j][1] = e_sum_asks[j][1]; /* do not average */
                e_sum_bids[j][1] = e_sum_bids[j][1]; /* do not average */
                /* reuse merged bids,asks sums for bids/asks ratio */
                var baratio = e_sum_bids[j][1] / (e_sum_asks[j][1] * e_prices[j][1]);
                e_baratios[j][1] = baratio;
                baratios_accum.push ( baratio );
                baratios_sum += baratio;
                if ( baratios_accum.length > MAVG_WINDOW )
                    baratios_sum -= baratios_accum.shift ( );
                e_baratios_mavg[j][1] = baratios_sum / baratios_accum.length;
                /* nb trades is not averaged */
                if ( e_nb_trades[j][1] > 0 )
                    e_avg_trade_size[j][1] = volume_sum / e_nb_trades[j][1];
                else
                    e_avg_trade_size[j][1] = 0;
                e_lag[j][1] = e_lag[j][1] / nbexch;
                e_atr[j][1] = e_atr[j][1] / nbexch;
                e_rsi[j][1] = e_rsi[j][1] / nbexch;
                e_rsi_mavg[j][1] = e_rsi_mavg[j][1] / nbexch;
                e_tsi[j][1] = e_tsi[j][1] / nbexch;
            }
            else if ( j > 0 )
            {
                e_prices[j][1] = e_prices[j-1][1];
                e_prices_mavg[j][1] = e_prices_mavg[j-1][1];
                e_sum_asks[j][1] = e_sum_asks[j-1][1];
                e_sum_bids[j][1] = e_sum_bids[j-1][1];
                e_baratios[j][1] = e_baratios[j-1][1];
                e_baratios_mavg[j][1] = e_baratios_mavg[j-1][1];
                e_avg_trade_size[j][1] = 0;
                e_lag[j][1] = e_lag[j-1][1];
                e_atr[j][1] = e_atr[j-1][1];
                e_rsi[j][1] = e_rsi[j-1][1];
                e_rsi_mavg[j][1] = e_rsi_mavg[j-1][1];
                e_tsi[j][1] = e_tsi[j-1][1];
            }
        }

        edata = { name:'merged',
                  prices:e_prices, prices_mavg:e_prices_mavg,
                  sum_asks:e_sum_asks, sum_bids:e_sum_bids,
                  baratios:e_baratios, baratios_mavg:e_baratios_mavg,
                  volume:e_volume, nb_trades:e_nb_trades, avg_trade_size:e_avg_trade_size,
                  lag:e_lag, atr:e_atr, rsi:e_rsi, rsi_mavg:e_rsi_mavg, tsi:e_tsi };

        return edata;
    }

    /*
     * Exchanges data synchronization
     * enables and performs synchronization
     * time table reused for merging datasets into the special exchange object named 'merged'
     */
    function synchronizeData ( exchanges )
    {
        if ( exchanges.length == 0 )
            return;

        /* timestamp synchronization */
        if ( config.mode != 's' )
        {
            var time_table = [ ]; /* table where [for each exchange][for each timestamp] = relevant index in exchange dataset */
            var stride = views_table[config.view].precision;
            var NB_STAMPS = 0;

            /* find stamps range */
            var min_stamp = 777777777777777;
            var max_stamp = 0;
            for ( var i=0; i<exchanges.length; ++i )
            {
                e = exchanges[i];
                time_table.push ( new Array() );

                if ( e.prices[0][0] < min_stamp )
                    min_stamp = e.prices[0][0];
                if ( e.prices[e.prices.length-1][0] > max_stamp )
                    max_stamp = e.prices[e.prices.length-1][0];
            }

            var n;
            var volume_sum = [ ]; /* volume accumulator for each time stamp */
            for ( n=0, stamp=min_stamp; stamp<(max_stamp+stride); stamp+=stride, ++n )
                volume_sum[n] = 0;

            NB_STAMPS = n;

            /* build index for all on the shown period */
            for ( var i=0; i<exchanges.length; ++i )
            {
                var j = 0;
                e = exchanges[i];
                for ( var n=0, stamp=min_stamp; n<NB_STAMPS; ++n, stamp+=stride )
                {
                    time_table[i][n] = -1;

                    if ( j < e.prices.length )
                    {
                        if ( e.prices[j][0] <= stamp )
                        {
                            time_table[i][n] = j;
                            ++j;
                        }
                    }
                }
            }

            /* for each exchange, align stamps of price, volume and nb. trades */
            for ( var i=0; i<exchanges.length; ++i )
            {
                var e_prices_synced = [ ];
                var e_volume_synced = [ ];
                var e_nb_trades_synced = [ ];
                var price, volume, nb_trades;

                e = exchanges[i];
                price = 0;

                for ( var j=0, stamp=min_stamp; j<NB_STAMPS; stamp+=stride, ++j )
                {
                    volume = 0;
                    nb_trades = 0;
                    if ( time_table[i][j] != -1 )
                    {
                        price = e.prices[time_table[i][j]][1];
                        volume = e.volume[time_table[i][j]][1];
                        nb_trades = e.nb_trades[time_table[i][j]][1];
                    }

                    e_prices_synced[j] = [stamp,price];
                    e_volume_synced[j] = [stamp,volume];
                    e_nb_trades_synced[j] = [stamp,nb_trades];
                    volume_sum[j] += volume;
                }

                e.prices_synced = e_prices_synced;
                e.volume_synced = e_volume_synced;
                e.nb_trades_synced = e_nb_trades_synced;
            }

            if ( NB_STAMPS >= 2 )
            {
                /* dirty workaround for some synchronization issue on last sample */
                var shiftlast = true;
                for ( var i=0; i<exchanges.length; ++i )
                {
                    if ( time_table[i][NB_STAMPS-2] != -1 )
                    {
                        shiftlast = false;
                        break;
                    }
                }

                if ( shiftlast )
                {
                    for ( var i=0; i<exchanges.length; ++i )
                    {
                        var e = exchanges[i];
                        e.volume_synced[NB_STAMPS-2][1] = e.volume_synced[NB_STAMPS-1][1];
                        e.volume_synced[NB_STAMPS-1][1] = 0;
                        volume_sum[NB_STAMPS-2] = volume_sum[NB_STAMPS-1];
                        volume_sum[NB_STAMPS-1] = 0;
                        e.nb_trades_synced[NB_STAMPS-2][1] = e.nb_trades_synced[NB_STAMPS-1][1];
                        e.nb_trades_synced[NB_STAMPS-1][1] = 0;
                    }
                }
            }

            /* relative volume epilogue */
            for ( var i=0; i<exchanges.length; ++i )
            {
                e = exchanges[i];
                e.volumerel = [ ];
                for ( var j=0; j<NB_STAMPS; ++j )
                    if ( volume_sum[j] > 0 )
                        e.volumerel.push ( [ e.volume_synced[j][0], (e.volume_synced[j][1]/volume_sum[j])*100 ] );
            }

            exchanges_merged = mergeExchangesData ( exchanges, time_table, min_stamp, NB_STAMPS, stride );
        }
    }


    /*
     * Chart Abstract Class
     */
    var Chart = ( function ( )
    {
        var cls = function ( cid, supported_modes, has_merging )
        {
            this.cid = cid; /* name of the div element holding the chart area, control, legend, etc. */
            this.cdiv = 'div#' + cid + '_chart';  /* selector of the div element holding the chart area */
            this.tspan = 'span#' + cid + '_ctrl';  /* selector of the span element holding the controls */
            this.ldiv = 'div#' + cid + '_legend'; /* selector of the div element holding the legend */

            this.supported_modes = supported_modes;
            this.shown = true;
            this.expanded = false;

            this.has_merging = has_merging;

            /* merged display */
            if ( this.has_merging )
            {
                this.merging = false;

                this.toggleMerging = function ( )
                {
                    this.merged = !this.merged;
                    this.updateControls ( );
                    this.update ( true );
                    saveConfig ( );
                };
            }

            /* configuration */
            this.setConfig = function ( conf )
            {
                if ( conf.hasOwnProperty('show') )
                    this.shown = conf.show;

                if ( conf.hasOwnProperty('expand') )
                    this.expanded = conf.expand;

                if ( this.has_merging )
                    if ( conf.hasOwnProperty('merged') )
                        this.merged = conf.merged;

                this.updateControls ( );
            };

            this.getConfig = function ( )
            {
                var conf = { };
                conf.name = this.constructor.getName();
                conf.show = this.shown;
                conf.expand = this.expanded;

                if ( this.has_merging )
                    conf['merged'] = this.merged;

                return conf;
            };

            /* get the appropriate time format */
            this.getTimeFormat = function ( )
            {
                if ( ( this.cid[1] == 'l' ) || this.expanded )
                    return views_table[config.view].format;

                return views_table[config.view].shortformat;
            };

            /* get the operating mode */
            this.getMode = function ( )
            {
                if ( ( config.mode == 's' ) || /* autoswitch to single mode */
                     ( ( this.supported_modes.indexOf('s') != -1 ) && ( nb_shown_exchanges == 1 ) ) )
                    return 's';

                return config.mode;
            };

            /* helper to generate array of log ticks */
            this.computeLogTicks = function ( plots, stacked )
            {
                var lmin=777777777777777;
                var lmax=0;
                var ticks = [ ];

                if ( plots.length == 0 )
                    return ticks;

                if ( !stacked )
                {
                    for ( var i in plots )
                    {
                        var d = plots[i].data;
                        for ( var j in d )
                        {
                            for ( var k=1; k<d[j].length; ++k )
                            {
                                if ( d[j][k] < lmin )
                                    lmin = d[j][k];
                                if ( d[j][k] > lmax )
                                    lmax = d[j][k];
                            }
                        }
                    }
                }
                else
                {
                    /* warning: log display does not go well along stacking */
                    for ( var j in plots[0].data )
                    {
                        var sum = 0;
                        for ( var i in plots )
                            sum += plots[i].data[j][1];

                        if ( plots[0].data[j][1] < lmin )
                            lmin = plots[0].data[j][1];

                        if ( sum > lmax )
                            lmax = sum;
                    }
                }

                lmin = lmin / 10.0;
                lmax = lmax * 10.0;
                var v = 1;

                if ( lmin < 1 )
                {
                    lmin = 0;
                    ticks.push ( 0 );
                    v = 10; /* skip 1, otherwise it overwrites 0 */
                }

                for ( var i=1; i<20; ++i, v*=10 )
                {
                    if ( v < lmin )
                        continue;
                    if ( v > lmax )
                        break;
                    ticks.push ( v );
                }

                if ( ticks.length == 2 )
                {
                    var inc = ticks[1] / 4;
                    ticks.splice ( 1, 0, inc );
                    ticks.splice ( 2, 0, inc*2 );
                    ticks.splice ( 3, 0, inc*3 );
                }
                else if ( ticks.length == 3 )
                {
                    ticks.splice ( 1, 0, ticks[1]/2 );
                    ticks.splice ( 3, 0, ticks[3]/2 );
                }

                // console.debug ( 'ticks: min=' + lmin + ' max=' + lmax + ' -> ' + ticks );
                return ticks;
            };

            /* prepare a chart for plotting */
            this.exchanges = [ ];

            this.prepare = function ( exchanges, nbmsecs, nbpoints )
            {
                this.exchanges = exchanges;
                this.nbmsecs = nbmsecs;   /* number of milliseconds in x-axis */
                this.nbpoints = nbpoints; /* number of points plotted */

                $(this.ldiv).empty ( );

                if ( exchanges.length > 0 )
                    this.update ( false );
            };

            /* update a chart for (re-)plotting */
            this.update = function ( replot )
            {
                if ( this.chart_options.hasOwnProperty('yaxis') )
                    this.chart_options.yaxis.position = yaxis_position;

                if ( replot )
                    this.plot ( );
            };

            /* plot */
            this.plot = function ( )
            {
                if ( !this.shown )
                    return;

                if ( this.exchanges.length == 0 )
                {
                    $(this.cdiv).empty ( );
                    return;
                }

                this.chart_options.legend.container = $(this.ldiv);

                /* autoswitch to single mode */
                var m = this.getMode ( );
                if ( m == 's' )
                    this.plot_single ( );
                else if ( m == 'c' )
                    this.plot_multiple ( );
            };

            /* show/hide */
            this.show = function ( ) { this.shown=true; this.updateControls(); resizeCharts(2); /*this.update(true);*/ };
            this.hide = function ( ) { this.shown=false; this.updateControls(); resizeCharts(2); /*this.update(true);*/ };
            this.toggleVisibility = function ( ) { this.shown=!this.shown; this.updateControls(); resizeCharts(2); /*this.update(true);*/ };

            /* resize */
            this.resize = function ( ) { this.expanded=!this.expanded; updateChartsLayout(this.cid); saveConfig(); };

            /* add_controls */
            this.addControls = function ( )
            {
                $(this.tspan).empty ( );

                var ins = '';
                ins += '<a id="'+this.cid+'_resize" href="#"><img class="btn" id="btn_'+this.cid+'_resize" src="/coinorama/static/btn-expand.png" alt="enlarge"/></a>';
                $(this.tspan).append ( ins );

                var self = this;
                $('a#'+this.cid+'_resize').on ( 'click', function(e) { e.preventDefault(); self.resize(); } );

                if ( this.has_merging )
                {
                    var ins = '';
                    ins += '<span id="'+this.cid+'_merge"> | &nbsp;merge <a id="'+this.cid+'_merge" href="#">';
                    ins += '<img class="btn" id="btn_'+this.cid+'_merge" src="'+ui_img_button_enabled+'" alt="off"/>';
                    ins += '</a></span> ';
                    $(this.tspan).append ( ins );

                    var self = this;
                    $('a#'+this.cid+'_merge').on ( 'click', function(e) { e.preventDefault(); self.toggleMerging(); } );
                }

                this.modeChanged ( );
            };

            /* updateControls */
            this.updateControls = function ( )
            {
                if ( this.shown )
                {
                    $(this.ldiv).show ( );
                    $(this.cdiv).show ( );
                    $('img#btn_'+this.cid+'_view').attr ( 'alt', 'disable' );
                    $('img#btn_'+this.cid+'_view').attr ( 'src', ui_img_button_enabled );
                }
                else
                {
                    $(this.ldiv).hide ( );
                    $(this.cdiv).hide ( );
                    $('img#btn_'+this.cid+'_view').attr ( 'alt', 'enable' );
                    $('img#btn_'+this.cid+'_view').attr ( 'src', ui_img_button_disabled );
                }

                if ( this.expanded )
                {
                    $('img#btn_'+this.cid+'_resize').attr ( 'src', ui_img_reduce );
                    $('img#btn_'+this.cid+'_resize').attr ( 'alt', 'reduce' );

                    $(this.ldiv).css ( 'font-size', 'small' );
                    $(this.cdiv).css ( 'font-size', 'small' );
                }
                else
                {
                    $('img#btn_'+this.cid+'_resize').attr ( 'src', ui_img_expand );
                    $('img#btn_'+this.cid+'_resize').attr ( 'alt', 'expand' );

                    if ( this.cid[1] == 'r' )
                    {
                        $(this.ldiv).css ( 'font-size', 'xx-small' );
                        $(this.cdiv).css ( 'font-size', 'xx-small' );
                    }
                    else
                    {
                        $(this.ldiv).css ( 'font-size', 'small' );
                        $(this.cdiv).css ( 'font-size', 'small' );
                    }
                }

                if ( this.has_merging )
                {
                    if ( this.getMode() != 's' )
                    {
                        $('span#'+this.cid+'_merge').show ( );

                        if ( this.merged )
                        {
                            $('img#btn_'+this.cid+'_merge').attr ( 'src', ui_img_button_enabled );
                            $('img#btn_'+this.cid+'_merge').attr ( 'alt', 'off' );
                        }
                        else
                        {
                            $('img#btn_'+this.cid+'_merge').attr ( 'src', ui_img_button_disabled );
                            $('img#btn_'+this.cid+'_merge').attr ( 'alt', 'on' );
                        }
                    }
                    else
                        $('span#'+this.cid+'_merge').hide ( );
                }

                // console.debug ( 'super: update controls ' + this.cid + this.constructor.getName()  );
            };

            /* removeControls */
            this.removeControls = function ( )
            {
                $(this.tspan).empty ( );
                $('a#'+this.cid+'_resize').off ( );

                if ( this.has_merging )
                    $('a#'+this.cid+'_merge').off ( );
            };

            /* callbacks */
            this.modeChanged = function ( )
            {
                $(this.ldiv).empty ( );
                $(this.cdiv).empty ( );

                if ( this.supported_modes.indexOf(this.getMode()) == -1 )
                    $(this.cdiv).html ( '<span style="font-size:x-small"><br/>/!\\ this chart is not available in this mode /!\\</span>' );

                this.updateControls ( );
                // console.debug ( 'super: mode changed ' + this.cid + this.constructor.getName()  );
            };

            this.viewlengthChanged = function ( )
            {
                this.updateControls ( );
                //console.debug ( 'super: view length changed ' + this.cid + this.constructor.getName()  );
            };

            this.exchangeChanged = function ( )
            {
                if ( this.supported_modes.indexOf(this.getMode()) == -1 )
                {
                    $(this.ldiv).empty ( );
                    $(this.cdiv).empty ( );
                    $(this.cdiv).html ( '<span style="font-size:x-small"><br/>/!\\ this chart is not available in this mode /!\\</span>' );
                }

                this.updateControls ( );
                //console.debug ( 'super: exchange changed ' + this.cid + this.constructor.getName()  );
            };

            /* destructor */
            this.destroy = function ( )
            {
                // console.debug ( 'super: destructor ' + this.cid + ' ' + this.constructor.getName() );
                $(this.cdiv).text ( '' );
                this.removeControls ( );
            };
        };

        return cls;
    } ) ( );

    function inherit ( cls, superCls )
    {
        var construct = function () {};
        construct.prototype = superCls.prototype;
        cls.prototype = new construct;
        cls.prototype.constructor = cls;
        cls['super'] = superCls;
    }


    /*
     * Chart of Price
     */
    var ChartPrice = ( function ( )
    {
        var cls = function ( cid )
        {
            this.constructor['super'].call ( this, cid, 'sc', true );

            this.chart_options = { };
            this.conf_highlow = [ {color:color_chart_low, representation:'asymmetric', opacity:0.4},
                                  {color:color_chart_high, representation:'asymmetric', opacity:0.4} ];
            this.dataset = [ ];

            /* style */
            this.candles = true;

            this.setStyle = function ( style )
            {
                if ( style == 'candles' )
                    this.candles = true;
                else
                    this.candles = false;

                this.updateControls ( );
                this.update ( true );
                saveConfig ( );
            };

            /* display of emas */
            this.show_emas = true;

            this.toggleEMAs = function ( )
            {
                this.show_emas = !this.show_emas;
                this.updateControls ( );
                this.update ( true );
                saveConfig ( );
            };

            /* logarithmic display */
            this.log = false;

            this.toggleLog = function ( )
            {
                this.log = !this.log;
                this.updateControls ( );
                this.update ( true );
                saveConfig ( );
            };

            /* configuration */
            var super_set_config = this.setConfig;
            this.setConfig = function ( conf )
            {
                if ( conf.hasOwnProperty('candles') )
                    this.candles = conf.candles;

                if ( conf.hasOwnProperty('emas') )
                    this.show_emas = conf.emas;

                if ( conf.hasOwnProperty('log') )
                    this.log = conf.log;

                super_set_config.call ( this, conf ); /* called last to update controls */
            };

            var super_get_config = this.getConfig;
            this.getConfig = function ( )
            {
                var conf = super_get_config.call ( this );
                conf['candles'] = this.candles;
                conf['emas'] = this.show_emas;
                conf['log'] = this.log;
                return conf;
            };

            /* update chart */
            var super_update = this.update;
            this.update = function ( replot )
            {
                this.dataset = [ ];
                this.chart_options = jQuery.extend ( true, {}, common_lines_options );
                this.chart_options.xaxis.timeformat = this.getTimeFormat ( );

                if ( this.log )
                {
                    this.chart_options.yaxis.transform = function (v) { if(v<1)return 0; return Math.log(v) / Math.LN10; };
                    this.chart_options.yaxis.inverseTransform = function (v) { if(v==0)return 0; return Math.exp(v*Math.LN10); };
                }
                else
                {
                    this.chart_options.yaxis.transform = null;
                    this.chart_options.yaxis.inverseTransform = null;
                    this.chart_options.yaxis.ticks = null;
                    this.chart_options.yaxis.min = null;
                }

                if ( this.getMode() == 's' )
                {
                    var e = this.exchanges[0];
                    if ( this.candles )
                    {
                        e.prices_candle_min = e.prices_min[0][1];
                        e.prices_candle_max = e.prices_max[0][1];
                        for ( var i=0; i<e.prices.length; ++i )
                        {
                            this.dataset[i] = [e.prices[i][0],e.prices_open[i][1],e.prices_close[i][1],e.prices_min[i][1],e.prices_max[i][1]];
                            e.prices_candle_min = Math.min ( e.prices_candle_min, e.prices_min[i][1] );
                            e.prices_candle_max = Math.max ( e.prices_candle_max, e.prices_max[i][1] );
                        }
                        /* fix last candle time offset */
                        this.dataset[this.dataset.length-1][0] = views_table[config.view].precision *
                            (0.5+(Math.floor(this.dataset[this.dataset.length-1][0] /  views_table[config.view].precision)));
                    }
                    else
                        for ( var i=0; i<e.prices.length; ++i )
                            this.dataset[i] = [e.prices[i][0],e.prices[i][1],e.prices_min[i][1],e.prices[i][1],e.prices[i][1],e.prices_max[i][1]];
                }
                else if ( this.getMode() == 'c' )
                {
                    for ( var i=0; i<this.exchanges.length; ++i )
                    {
                        var e = this.exchanges[i];
                        this.dataset.push ( { data:e.prices, label:e.name, color:colors_chart_price[e.id],
                                              tooltipFormat:(e.name+'<br />%y.2 '+shown_currency+'<br/> %x'), lines:{lineWidth:1} } );
                    }
                }

                super_update.call ( this, replot );
            };

            /* plot a single exchange */
            this.plot_single = function ( )
            {
                var e = this.exchanges[0];
                var plots = [ ];

                this.chart_options.legend.noColumns = 3;
                this.chart_options.yaxis.tickFormatter = null;
                this.chart_options.tooltipOpts.content = '%y.2 ' + shown_currency + '<br/> %x';

                if ( this.candles  )
                {
                    this.chart_options.series.candlestick = { active:true };

                    if ( !this.log ) /* log display sets its own min/max */
                    {
                        this.chart_options.yaxis.min = e.prices_candle_min - (e.prices_candle_max-e.prices_candle_min) * 0.1;
                        this.chart_options.yaxis.max = e.prices_candle_max + (e.prices_candle_max-e.prices_candle_min) * 0.1;
                    }

                    plots.push ( { data:this.dataset, label:'price ('+shown_currency+')', color:'#000',
                                   'candlestick':{show:true,lineWidth:(this.nbmsecs / this.nbpoints)*0.8} } );
                }
                else
                {
                    plots.push ( { data:this.dataset, label:'price ('+shown_currency+')',
                                   fillArea:this.conf_highlow, color:color_chart_price } );
                }

                if ( this.show_emas )
                {
                    plots.push ( { data:e.prices_ema12, label:'ema12', color:color_chart_price_ema12, lines:{show:true,lineWidth:1.3} } );
                    plots.push ( { data:e.prices_ema26, label:'ema26', color:color_chart_price_ema26, lines:{show:true,lineWidth:1.3} } );
                }

                if ( this.log )
                {
                    this.chart_options.yaxis.ticks = this.computeLogTicks ( plots, false );
                    this.chart_options.yaxis.min = this.chart_options.yaxis.ticks[0];
                }

                $.plot ( this.cdiv, plots, this.chart_options );
            };

            /* plot multiple exchanges */
            this.plot_multiple = function ( )
            {
                if ( this.merged )
                {
                    this.plot_merged ( );
                    return;
                }

                this.chart_options.yaxis.tickFormatter = null;
                this.chart_options.legend.noColumns = this.exchanges.length;

                if ( this.log )
                {
                    this.chart_options.yaxis.ticks = this.computeLogTicks ( this.dataset, false );
                    this.chart_options.yaxis.min = this.chart_options.yaxis.ticks[0];
                }

                $.plot ( this.cdiv, this.dataset, this.chart_options );
            };

            /* plot multiple exchanges merged */
            this.plot_merged = function ( )
            {
                var plots = [ ];
                var e = exchanges_merged;

                this.chart_options.legend.noColumns = 2;
                this.chart_options.yaxis.tickFormatter = null;
                this.chart_options.tooltipOpts.content = '%y.2 '+shown_currency+'<br/> %x';

                plots.push ( { data:e.prices, label:'merged price ('+shown_currency+')', color:color_chart_price} );
                plots.push ( { data:e.prices_mavg, label:'moving average', color:color_chart_price_mavg, lines:{lineWidth:1.1} } );

                if ( this.log )
                {
                    this.chart_options.yaxis.ticks = this.computeLogTicks ( plots, false );
                    this.chart_options.yaxis.min = this.chart_options.yaxis.ticks[0];
                }

                $.plot ( this.cdiv, plots, this.chart_options );
            };

            /* addControls */
            var super_add_controls = this.addControls;
            this.addControls = function ( )
            {
                super_add_controls.call ( this );

                var ins = '';
                ins += '<span id="'+this.cid+'_style"> | &nbsp;';
                ins += 'candles <a id="'+this.cid+'_candles" href="#"><img class="btn" id="btn_'+this.cid+'_candles" src="'+ui_img_toggle_enabled+'"></a> ' +
                    'lines <a id="'+this.cid+'_lines" href="#"><img class="btn" id="btn_'+this.cid+'_lines" src="'+ui_img_toggle_disabled+'" /></a>';
                ins += ' | &nbsp;show EMAs <a id="'+this.cid+'_emas" href="#"><img class="btn" id="btn_'+this.cid+'_emas" src="'+ui_img_button_enabled+'" alt="off"/></a> ';
                ins += '</span>';
                ins +=  ' | &nbsp;';
                ins += 'log <a id="'+this.cid+'_log" href="#"><img class="btn" id="btn_'+this.cid+'_log" src="'+ui_img_button_enabled+'" alt="off"/></a> ';
                $(this.tspan).append ( ins );

                var self = this;
                $('a#'+this.cid+'_candles').on ( 'click', function(e) { e.preventDefault(); self.setStyle('candles'); } );
                $('a#'+this.cid+'_lines').on ( 'click', function(e) { e.preventDefault(); self.setStyle('lines'); } );
                $('a#'+this.cid+'_emas').on ( 'click', function(e) { e.preventDefault(); self.toggleEMAs(); } );
                $('a#'+this.cid+'_log').on ( 'click', function(e) { e.preventDefault(); self.toggleLog(); } );

                this.updateControls ( );
            };

            /* updateControls */
            var super_update_controls = this.updateControls;
            this.updateControls = function ( )
            {
                super_update_controls.call ( this );

                if ( this.getMode() != 's' )
                    $('span#'+this.cid+'_style').hide ( );
                else
                {
                    $('span#'+this.cid+'_style').show ( );

                    if ( this.candles )
                    {
                        $('img#btn_'+this.cid+'_candles').attr ( 'src', ui_img_toggle_enabled );
                        $('img#btn_'+this.cid+'_lines').attr ( 'src', ui_img_toggle_disabled );
                    }
                    else
                    {
                        $('img#btn_'+this.cid+'_candles').attr ( 'src', ui_img_toggle_disabled );
                        $('img#btn_'+this.cid+'_lines').attr ( 'src', ui_img_toggle_enabled );
                    }

                    if ( this.show_emas )
                    {
                        $('img#btn_'+this.cid+'_emas').attr ( 'src', ui_img_button_enabled );
                        $('img#btn_'+this.cid+'_emas').attr ( 'alt', 'off' );
                    }
                    else
                    {
                        $('img#btn_'+this.cid+'_emas').attr ( 'src', ui_img_button_disabled );
                        $('img#btn_'+this.cid+'_emas').attr ( 'alt', 'on' );
                    }
                }

                if ( this.log )
                {
                    $('img#btn_'+this.cid+'_log').attr ( 'src', ui_img_button_enabled );
                    $('img#btn_'+this.cid+'_log').attr ( 'alt', 'off' );
                }
                else
                {
                    $('img#btn_'+this.cid+'_log').attr ( 'src', ui_img_button_disabled );
                    $('img#btn_'+this.cid+'_log').attr ( 'alt', 'on' );
                }
            };

            /* removeControls */
            var super_remove_controls = this.removeControls;
            this.removeControls = function ( )
            {
                $('a#'+this.cid+'_candles').off ( );
                $('a#'+this.cid+'_lines').off ( );
                $('a#'+this.cid+'_emas').off ( );
                $('a#'+this.cid+'_log').off ( );
                super_remove_controls.call ( this );
            };

            this.addControls ( );
        };

        inherit ( cls, Chart );
        cls.getName = function ( ) { return 'price'; };
        cls.getTitle = function ( ) { return 'Price'; };
        return cls;
    } ) ( );


    /*
     * Chart of Relative Price
     */
    var ChartPriceRelative = ( function ( )
    {
        var cls = function ( cid )
        {
            this.constructor['super'].call ( this, cid, 'cv', false );

            this.plots = [ ];
            this.exch_rel = Object.keys(exchanges_uid)[0];

            this.chart_options = {
                canvas: true,
                tooltip: true,
                tooltipOpts: { content: '%y.2<br/> %x', xDateFormat: '%d-%b-%Y %H:%M:%S' },
                legend: { position:'nw', margin:0, backgroundOpacity:0.5, backgroundColor:color_chart_legend_bg },
                lines: { show:true },
                grid: { hoverable:true, borderWidth:'0' },
                points: {show:false },
                xaxis: { mode: 'time', timezone:'browser', timeformat:'%H:%M:%S', font:{color:color_chart_axis_text},
                         color:color_chart_axis, autoscaleMargin:automargin, ticks:null },
                yaxis: { font:{color:color_chart_axis_text}, labelWidth:lbl_width, color:color_chart_axis, position:yaxis_position, tickFormatter:formatTickPercent }
            };

            /* select reference exchange */
            this.selectRelExchange = function ( exchname )
            {
                this.exch_rel = exchname;

                /* remove binding from legend links */
                for ( var i=0; i<this.exchanges.length; ++i )
                    $('a#relexch_'+this.cid+'_'+this.exchanges[i].name).off ( );
                /* bindings are re-added by the update() call */

                this.update ( true );
                saveConfig ( );
            };

            /* configuration */
            var super_set_config = this.setConfig;
            this.setConfig = function ( conf )
            {
                if ( conf.hasOwnProperty('exch_rel') )
                    if ( conf.exch_rel in exchanges_uid )
                        this.exch_rel = conf.exch_rel;
                super_set_config.call ( this, conf ); /* called last to update controls */
            };

            var super_get_config = this.getConfig;
            this.getConfig = function ( )
            {
                var conf = super_get_config.call ( this );
                conf['exch_rel'] = this.exch_rel;
                return conf;
            };

            /* prepare chart */
            var super_prepare = this.prepare;
            this.prepare = function ( exchanges, nbmsecs, nbpoints )
            {
                /* remove binding from legend links */
                for ( var i=0; i<this.exchanges.length; ++i )
                    $('a#relexch_'+this.cid+'_'+this.exchanges[i].name).off ( );

                super_prepare.call ( this, exchanges, nbmsecs, nbpoints );
            };

            /* update chart */
            var super_update = this.update;
            this.update = function ( replot )
            {
                this.plots = [ ];

                this.chart_options.xaxis.timeformat = this.getTimeFormat ( );

                if ( this.getMode() != 's' )
                {
                    /* lookup reference exchange */
                    var reid = -1;
                    for ( var i=0; i<this.exchanges.length; ++i )
                    {
                        if ( this.exchanges[i].name == this.exch_rel )
                        {
                            reid = i;
                            break;
                        }
                    }

                    if ( reid == -1 )
                    {
                        reid = 0;
                        this.exch_rel = this.exchanges[0].name;
                    }

                    for ( var i=0; i<this.exchanges.length; ++i )
                    {
                        var e = this.exchanges[i];
                        var e_price_rel = [ ];
                        var mavg_window = [ ];
                        var mavg_sum = 0;

                        for ( var j=0; j<this.exchanges[reid].prices_synced.length; ++j )
                        {
                            var ref_price = this.exchanges[reid].prices_synced[j][1];
                            var e_price = e.prices_synced[j][1];

                            if ( ( ref_price == 0 ) || ( e_price == 0 ) )
                                continue;

                            var rel_price = ((e_price-ref_price) / ref_price) * 100;

                            mavg_window.push ( rel_price );
                            mavg_sum += rel_price;

                            if ( mavg_window.length > MAVG_WINDOW_S )
                                mavg_sum -= mavg_window.shift ( );

                            e_price_rel.push ( [ this.exchanges[reid].prices_synced[j][0], mavg_sum/mavg_window.length ] );
                        }

                        var rel_label = '<a id="relexch_'+this.cid+'_'+e.name+'" href="#" style="text-decoration:none;color:#949494;">'+e.name+'</a>';
                        if ( i == reid )
                            rel_label = '<a id="relexch_'+this.cid+'_'+e.name+'" href="#">'+e.name+'</a>';
                        this.plots.push ( { data:e_price_rel, label:rel_label,color:colors_chart_price[e.id],
                                            tooltipFormat:(e.name+' %y.2 %<br/> %x'), lines:{lineWidth:1} } );
                    }
                }

                super_update.call ( this, replot );
            };

            /* plot single exchange */
            this.plot_single = function ( ) { /* disabled */ };

            /* plot multiple exchanges */
            this.plot_multiple = function ( )
            {
                this.chart_options.legend.noColumns = this.exchanges.length;
                $.plot ( this.cdiv, this.plots, this.chart_options );

                /* add binding to created legend links */
                var self = this;
                $.each ( this.exchanges, function(i)
                         {
                             $('a#relexch_'+self.cid+'_'+self.exchanges[i].name).on ( 'click', function(ev) {
                                 ev.preventDefault(); self.selectRelExchange(self.exchanges[i].name); } );
                         } );
            };

            /* removeControls */
            var super_remove_controls = this.removeControls;
            this.removeControls = function ( )
            {
                /* remove binding from legend links */
                for ( var i=0; i<this.exchanges.length; ++i )
                    $('a#relexch_'+this.cid+'_'+this.exchanges[i].name).off ( );

                super_remove_controls.call ( this );
            };

            this.addControls ( );
        };

        inherit ( cls, Chart );
        cls.getName = function ( ) { return 'pricerel'; };
        cls.getTitle = function ( ) { return 'Price (relative)'; };
        return cls;
    } ) ( );


    /*
     * Chart of Min/Avg/Max Price
     */
    var ChartPriceMAM = ( function ( )
    {
        var cls = function ( cid )
        {
            this.constructor['super'].call ( this, cid, 'cv', false );

            this.data_multi = [ ];

            this.chart_options = {
                canvas: true,
                tooltip: true,
                tooltipOpts: { content: '%y.2<br/> %x', xDateFormat: '%d-%b-%Y %H:%M:%S' },
                legend: { position:'nw', margin:0, backgroundOpacity:0.5, backgroundColor:color_chart_legend_bg },
                lines: { show:false },
                points: { show:true, fill:false, lineWidth:1.7 },
                grid: { hoverable:true, borderWidth:'0' },
                xaxis: { mode: 'time', timezone:'browser', timeformat:'%H:%M:%S', font:{color:color_chart_axis_text},
                         color:color_chart_axis, autoscaleMargin:automargin, ticks:null },
                yaxis: { font:{color:color_chart_axis_text}, labelWidth:lbl_width, yaxis:yaxis_position, color:color_chart_axis }
            };

            /* update chart */
            var super_update = this.update;
            this.update = function ( replot )
            {
                this.data_multi = [ ];

                this.chart_options.xaxis.timeformat = this.getTimeFormat ( );

                if ( this.getMode() != 's' )
                {
                    /* var e_idx = [ ]; */
                    var prices_avg = [ ];
                    var nb_exchanges = this.exchanges.length;

                    for ( var i=0; i<nb_exchanges; ++i )
                    {
                        this.exchanges[i].prices_mam_min = [ ];
                        this.exchanges[i].prices_mam_max = [ ];
                        /* e_idx.push ( 0 ); */
                    }

                    for ( var i=0; i<this.exchanges[0].prices_synced.length; ++i )
                    {
                        var e_min = null;
                        var e_max = null;
                        var vmax = 0;
                        var vmin = 77777777777777777777777;
                        var tstamp = this.exchanges[0].prices_synced[i][0];
                        var avg = 0;
                        var nb_avg = 0;

                        for ( var j=0; j<nb_exchanges; ++j )
                        {
                            var price = this.exchanges[j].prices_synced[i][1];

                            if ( price <= 0 )
                            {
                                /*console.debug ( 'i have price <= on exch ' + this.exchanges[j].name + ' at ' +
                                  tstamp + ' : ' + i + '/' + this.exchanges[0].prices_synced.length );*/
                                continue;
                            }

                            avg += price;
                            ++nb_avg;

                            if ( price < vmin )
                            {
                                e_min = this.exchanges[j];
                                vmin = price;
                            }

                            if ( price > vmax )
                            {
                                e_max = this.exchanges[j];
                                vmax = price;
                            }
                        }

                        if ( e_min != null )
                            e_min.prices_mam_min.push ( [ tstamp, vmin ] );

                        if ( e_max != null )
                            e_max.prices_mam_max.push ( [ tstamp, vmax ] );

                        if ( ( nb_avg > 0 ) && ( avg >  0 ) )
                        {
                            prices_avg.push ( [ tstamp, avg/nb_avg ] );
                        }
                    }

                    /* exhaustive algorithm
                    var e_prev_max = null;
                    var e_prev_min = null;

                    while ( true )
                    {
                        /* find minimum timestamp
                        var e_min_t = null;
                        var idx_min_t = 0;
                        var tstamp = 777777777777777777777;

                        for ( var i=0; i<this.exchanges.length; ++i )
                        {
                            if ( e_idx[i] >= this.exchanges[i].prices.length )
                                continue;

                            if ( this.exchanges[i].prices[e_idx[i]][0] < tstamp )
                            {
                                e_min_t = this.exchanges[i];
                                idx_min_t = e_idx[i];
                                tstamp = this.exchanges[i].prices[e_idx[i]][0];
                            }
                        }

                        if ( e_min_t == null )
                            break;

                        //console.debug ( '' + e_min_t.name + ' @ ' + idx_min_t );

                        /* deal with min price
                        var e = e_min_t;

                        if ( e.prices[idx_min_t][1] < vmin )
                        {
                            if ( ( idx_min_t > 0 ) && ( idx_min_t < e.prices.length-1 ) )
                                e.prices_mam_min.push ( [ tstamp, e.prices[idx_min_t][1] ] );
                            e_prev_min = e;

                            if ( (idx_min_t+1) < e.prices.length )
                                vmin = e.prices[idx_min_t+1][1];
                            else
                                vmin = e.prices[idx_min_t][1];
                        }
                        else if ( e.id == e_prev_min.id )
                        {
                            vmin = e.prices[idx_min_t][1];
                            e_prev_min.prices_mam_min.push ( [ tstamp, vmin ] );
                        }

                        /* deal with max price
                        if ( e.prices[idx_min_t][1] > vmax )
                        {
                            if ( ( idx_min_t > 0 ) && ( idx_min_t < e.prices.length-1 ) )
                                e.prices_mam_max.push ( [ tstamp, e.prices[idx_min_t][1] ] );
                            e_prev_max = e;

                            if ( (idx_min_t+1) < e.prices.length )
                                vmax = e.prices[idx_min_t+1][1];
                            else
                                vmax = e.prices[idx_min_t][1];
                        }
                        else if ( e.id == e_prev_max.id )
                        {
                            vmax = e.prices[idx_min_t][1];
                            e_prev_max.prices_mam_max.push ( [ tstamp, vmax ] );
                        }

                        e_idx[e.id] = idx_min_t + 1;
                    }
                    */

                    for ( var i=0; i<nb_exchanges; ++i )
                    {
                        this.data_multi.push ( { data:this.exchanges[i].prices_mam_max, label:this.exchanges[i].name, color:colors_chart_book[this.exchanges[i].id][0],
                                                 tooltipFormat:('Max: '+this.exchanges[i].name+'<br/>%y.2 '+shown_currency+'<br/> %x') } );
                    }

                    this.data_multi.push ( { data:prices_avg, label:'average', color:'#fff', tooltipFormat:('Avg: %y.2 '+shown_currency+'<br/> %x'),
                                             points:{show:false}, lines:{show:true,lineWidth:0.5} } );

                    for ( var i=0; i<nb_exchanges; ++i )
                    {
                        this.data_multi.push ( { data:this.exchanges[i].prices_mam_min, label:this.exchanges[i].name, color:colors_chart_book[this.exchanges[i].id][1],
                                                 tooltipFormat:('Min: '+this.exchanges[i].name+'<br/>%y.2 '+shown_currency+'<br/> %x') } );
                    }
                }

                super_update.call ( this, replot );
            };

            /* plot single exchange */
            this.plot_single = function ( ) { /* disabled */ };

            /* plot multiple exchanges */
            this.plot_multiple = function ( )
            {
                this.chart_options.legend.noColumns = this.exchanges.length + 1;
                $.plot ( this.cdiv, this.data_multi, this.chart_options );
            };

            this.addControls ( );
        };

        inherit ( cls, Chart );
        cls.getName = function ( ) { return 'pricemam'; };
        cls.getTitle = function ( ) { return 'Price Min/Avg/Max'; };
        return cls;
    } ) ( );


    /*
     * Chart of MACD
     */
    var ChartMACD = ( function ( )
    {
        var cls = function ( cid )
        {
            this.constructor['super'].call ( this, cid, 's', false );

            this.chart_options = { };

            this.color_neg_delta = '#d03010';
            this.color_pos_delta = '#10d030';
            this.neg_delta = [ ];
            this.pos_delta = [ ];

            /* update chart */
            var super_update = this.update;
            this.update = function ( replot )
            {
                this.chart_options = jQuery.extend ( true, {}, common_lines_options );
                this.chart_options.xaxis.timeformat = this.getTimeFormat ( );

                var e = this.exchanges[0];
                this.neg_delta = [ ];
                this.pos_delta = [ ];
                for ( var i=0; i<e.macd_delta.length; ++i )
                {
                    if ( e.macd_delta[i][1] < 0 )
                        this.neg_delta.push ( e.macd_delta[i] );
                    else
                        this.pos_delta.push ( e.macd_delta[i] );
                }

                super_update.call ( this, replot );
            };

            /* plot a single exchange */
            this.plot_single = function ( )
            {
                var e = this.exchanges[0];
                this.chart_options.legend.noColumns = 4;
                this.chart_options.yaxis.tickFormatter = null;
                this.chart_options.tooltipOpts.content = '%y.2<br/> %x';
                $.plot ( this.cdiv, [ {data:this.neg_delta,label:'-', color:this.color_neg_delta, lines:{show:false},
                                       bars:{show:true,barWidth:(this.nbmsecs/this.nbpoints)*0.3}},
                                      {data:this.pos_delta,label:'+', color:this.color_pos_delta, lines:{show:false},
                                       bars:{show:true,barWidth:(this.nbmsecs/this.nbpoints)*0.3}},
                                      {data:e.macd,label:'macd', color:color_chart_macd, lines:{lineWidth:1.2}},
                                      {data:e.macd_ema9,label:'signal', color:color_chart_macd_ema9, lines:{lineWidth:1.2}} ],
                         this.chart_options );
            };

            /* plot multiple exchanges */
            this.plot_multiple = function ( ) { /* disabled */ };

            this.addControls ( );
        };

        inherit ( cls, Chart );
        cls.getName = function ( ) { return 'macd'; };
        cls.getTitle = function ( ) { return 'MACD'; };
        return cls;
    } ) ( );


    /*
     * Chart of ADX
     */
    var ChartADX = ( function ( )
    {
        var cls = function ( cid )
        {
            this.constructor['super'].call ( this, cid, 's', false );

            this.chart_options = { };

            this.color_neg_delta = '#d03010';
            this.color_pos_delta = '#10d030';

            /* update chart */
            var super_update = this.update;
            this.update = function ( replot )
            {
                this.chart_options = jQuery.extend ( true, {}, common_lines_options );
                this.chart_options.xaxis.timeformat = this.getTimeFormat ( );
                super_update.call ( this, replot );
            };

            /* plot a single exchange */
            this.plot_single = function ( )
            {
                var e = this.exchanges[0];
                this.chart_options.legend.noColumns = 3;
                this.chart_options.yaxis.tickFormatter = null;
                $.plot ( this.cdiv, [ { data:e.adx_dmn,label:'dm-', color:this.color_neg_delta, lines:{lineWidth:1}, tooltipFormat:('dm-<br/>%y.2<br/> %x') },
                                      { data:e.adx_dmp,label:'dm+', color:this.color_pos_delta, lines:{lineWidth:1}, tooltipFormat:('dm+<br/>%y.2<br/> %x') },
                                      { data:e.adx,label:'adx', color:color_chart_price, lines:{lineWidth:1.2}, tooltipFormat:('adx<br/>%y.2<br/> %x') } ],
                         this.chart_options );
            };

            /* plot multiple exchanges */
            this.plot_multiple = function ( ) { /* disabled */ };

            this.addControls ( );
        };

        inherit ( cls, Chart );
        cls.getName = function ( ) { return 'adx'; };
        cls.getTitle = function ( ) { return 'ADX'; };
        return cls;
    } ) ( );


    /*
     * Chart of Standard Deviation
     */
    var ChartStdDev = ( function ( )
    {
        var cls = function ( cid )
        {
            this.constructor['super'].call ( this, cid, 's', false );

            this.chart_options = { };
            this.stddev7 = [ ];
            this.stddev21 = [ ];

            /* relative */
            this.relative = true;

            this.toggleRelative = function ( )
            {
                this.relative = !this.relative;
                this.updateControls ( );
                this.update ( true );
                saveConfig ( );
            };

            /* configuration */
            var super_set_config = this.setConfig;
            this.setConfig = function ( conf )
            {
                if ( conf.hasOwnProperty('relative') )
                    this.relative = conf.relative;

                super_set_config.call ( this, conf ); /* called last to update controls */
            };

            var super_get_config = this.getConfig;
            this.getConfig = function ( )
            {
                var conf = super_get_config.call ( this );
                conf['relative'] = this.relative;
                return conf;
            };

            /* update chart */
            var super_update = this.update;
            this.update = function ( replot )
            {
                this.chart_options = jQuery.extend ( true, {}, common_lines_options );
                this.chart_options.xaxis.timeformat = this.getTimeFormat ( );

                this.stddev7 = [ ];
                this.stddev21 = [ ];

                if ( !this.relative )
                {
                    for ( var i in this.exchanges[0].variance7 )
                    {
                        this.stddev7.push ( [this.exchanges[0].variance7[i][0], Math.sqrt(this.exchanges[0].variance7[i][1])] );
                        this.stddev21.push ( [this.exchanges[0].variance21[i][0], Math.sqrt(this.exchanges[0].variance21[i][1])] );
                    }
                }
                else
                {
                    for ( var i in this.exchanges[0].variance7 )
                    {
                        this.stddev7.push ( [this.exchanges[0].variance7[i][0], 100*Math.sqrt(this.exchanges[0].variance7[i][1])/this.exchanges[0].prices[i][1]] );
                        this.stddev21.push ( [this.exchanges[0].variance21[i][0], 100*Math.sqrt(this.exchanges[0].variance21[i][1])/this.exchanges[0].prices[i][1]] );
                    }

                    this.chart_options.yaxis.tickFormatter = function (v) { return v.toFixed(2)+'%'};
                }

                super_update.call ( this, replot );
            };

            /* plot a single exchange */
            this.plot_single = function ( )
            {
                var plots = [ ];
                this.chart_options.legend.noColumns = 3;

                if ( this.relative )
                    this.chart_options.tooltipOpts.content = '%y.2 %<br/> %x';
                else
                    this.chart_options.tooltipOpts.content = '%y.2 '+shown_currency+'<br/> %x';

                plots.push ( { data:this.stddev7 ,label:'stddev7', color:color_chart_price_ema12, lines:{lineWidth:1} } );
                plots.push ( { data:this.stddev21 ,label:'stddev21', color:color_chart_price_ema26, lines:{lineWidth:1} } );

                $.plot ( this.cdiv, plots, this.chart_options );
            };

            /* plot multiple exchanges */
            this.plot_multiple = function ( ) { /* disabled */ };

            /* addControls */
            var super_add_controls = this.addControls;
            this.addControls = function ( )
            {
                super_add_controls.call ( this );
                var ins = ' | &nbsp; ';
                ins += 'relative <a id="'+this.cid+'_relative" href="#"><img class="btn" id="btn_'+this.cid+'_relative" src="'+ui_img_button_enabled+'" alt="off"/></a> ';
                $(this.tspan).append ( ins );

                var self = this;
                $('a#'+this.cid+'_relative').on ( 'click', function(e) { e.preventDefault(); self.toggleRelative(); } );

                this.updateControls ( );
            };

            /* updateControls */
            var super_update_controls = this.updateControls;
            this.updateControls = function ( )
            {
                super_update_controls.call ( this );

                if ( this.relative )
                {
                    $('img#btn_'+this.cid+'_relative').attr ( 'src', ui_img_button_enabled );
                    $('img#btn_'+this.cid+'_relative').attr ( 'alt', 'off' );
                }
                else
                {
                    $('img#btn_'+this.cid+'_relative').attr ( 'src', ui_img_button_disabled );
                    $('img#btn_'+this.cid+'_relative').attr ( 'alt', 'on' );
                }
            };

            /* removeControls */
            var super_remove_controls = this.removeControls;
            this.removeControls = function ( )
            {
                $('a#'+this.cid+'_relative').off ( );
                super_remove_controls.call ( this );
            };

            this.addControls ( );
        };

        inherit ( cls, Chart );
        cls.getName = function ( ) { return 'stddev'; };
        cls.getTitle = function ( ) { return 'Volatility'; };
        return cls;
    } ) ( );


    /*
     * Chart of Price Average True Range
     */
    var ChartATR = ( function ( )
    {
        var cls = function ( cid )
        {
            this.constructor['super'].call ( this, cid, 'sc', true );

            this.chart_options = { };
            this.dataset = [ ];

            /* relative */
            this.relative = false;

            this.toggleRelative = function ( )
            {
                this.relative = !this.relative;
                this.updateControls ( );
                this.update ( true );
                saveConfig ( );
            };

            /* configuration */
            var super_set_config = this.setConfig;
            this.setConfig = function ( conf )
            {
                if ( conf.hasOwnProperty('relative') )
                    this.relative = conf.relative;

                super_set_config.call ( this, conf ); /* called last to update controls */
            };

            var super_get_config = this.getConfig;
            this.getConfig = function ( )
            {
                var conf = super_get_config.call ( this );
                conf['relative'] = this.relative;
                return conf;
            };

            /* update chart */
            var super_update = this.update;
            this.update = function ( replot )
            {
                this.chart_options = jQuery.extend ( true, {}, common_lines_options );
                this.chart_options.xaxis.timeformat = this.getTimeFormat ( );

                if (! this.relative )
                    this.chart_options.tooltipOpts.content = '%y.2 '+shown_currency+'<br/> %x';
                else
                    this.chart_options.tooltipOpts.content = '%y.2 %<br/> %x';

                this.chart_options.yaxis.tickFormatter = null;

                this.dataset = [ ];

                if ( !this.relative )
                {
                    if ( this.getMode() == 'c' )
                    {
                        for ( var i=0; i<this.exchanges.length; ++i )
                        {
                            var e = this.exchanges[i];
                            this.dataset.push ( { data:e.atr,label:e.name, color:colors_chart_price[e.id],
                                                  tooltipFormat:(e.name+'<br />%y.2 '+shown_currency+'<br/> %x'), lines:{lineWidth:1} } );
                        }
                    }
                }
                else
                {
                    if ( this.getMode() == 's' )
                    {
                        var e = this.exchanges[0];
                        for ( var i in e.atr )
                            this.dataset.push ( [e.atr[i][0], (100*e.atr[i][1])/e.prices[i][1]] );
                    }
                    else if ( this.merged )
                    {
                        var e = exchanges_merged;
                        for ( var i in e.atr )
                            this.dataset.push ( [e.atr[i][0], (100*e.atr[i][1])/e.prices[i][1]] );
                    }
                    else
                    {
                        for ( var i=0; i<this.exchanges.length; ++i )
                        {
                            var e = this.exchanges[i];
                            var e_atr_rel = [ ];

                            for ( var j in e.atr )
                                e_atr_rel.push ( [e.atr[j][0], (100*e.atr[j][1])/e.prices[j][1]] );

                            this.dataset.push ( { data:e_atr_rel,label:e.name, color:colors_chart_price[e.id],
                                                  tooltipFormat:(e.name+'<br />%y.2 %<br/> %x'), lines:{lineWidth:1} } );
                        }
                    }

                    this.chart_options.yaxis.tickFormatter = function (v) { return v.toFixed(2)+'%'};
                }

                super_update.call ( this, replot );
            };

            /* plot a single exchange */
            this.plot_single = function ( )
            {
                var e = this.exchanges[0];
                this.chart_options.legend.noColumns = 1;

                if ( !this.relative )
                    $.plot ( this.cdiv, [ { data:e.atr,label:'atr', color:color_chart_price, lines:{lineWidth:1.2} } ],
                             this.chart_options );
                else
                    $.plot ( this.cdiv, [ { data:this.dataset,label:'atr', color:color_chart_price, lines:{lineWidth:1.2} } ],
                             this.chart_options );
            };

            /* plot multiple exchanges */
            this.plot_multiple = function ( )
            {
                if ( this.merged )
                {
                    this.plot_merged ( );
                    return;
                }

                this.chart_options.legend.noColumns = this.exchanges.length;
                $.plot ( this.cdiv, this.dataset, this.chart_options );
            };

            /* plot multiple exchanges merged */
            this.plot_merged = function ( )
            {
                this.chart_options.legend.noColumns = 1;
                var e = exchanges_merged;

                if ( !this.relative )
                    $.plot ( this.cdiv, [ { data:e.atr,label:'merged atr', color:color_chart_price, lines:{lineWidth:1.2} } ],
                             this.chart_options );
                else
                    $.plot ( this.cdiv, [ { data:this.dataset,label:'merged atr', color:color_chart_price, lines:{lineWidth:1.2} } ],
                             this.chart_options );
            };

            /* addControls */
            var super_add_controls = this.addControls;
            this.addControls = function ( )
            {
                super_add_controls.call ( this );
                var ins = ' | &nbsp;';
                ins += 'relative <a id="'+this.cid+'_relative" href="#"><img class="btn" id="btn_'+this.cid+'_relative" src="'+ui_img_button_enabled+'" alt="off"/></a> ';
                $(this.tspan).append ( ins );

                var self = this;
                $('a#'+this.cid+'_relative').on ( 'click', function(e) { e.preventDefault(); self.toggleRelative(); } );

                this.updateControls ( );
            };

            /* updateControls */
            var super_update_controls = this.updateControls;
            this.updateControls = function ( )
            {
                super_update_controls.call ( this );

                if ( this.relative )
                {
                    $('img#btn_'+this.cid+'_relative').attr ( 'src', ui_img_button_enabled );
                    $('img#btn_'+this.cid+'_relative').attr ( 'alt', 'off' );
                }
                else
                {
                    $('img#btn_'+this.cid+'_relative').attr ( 'src', ui_img_button_disabled );
                    $('img#btn_'+this.cid+'_relative').attr ( 'alt', 'on' );
                }
            };

            /* removeControls */
            var super_remove_controls = this.removeControls;
            this.removeControls = function ( )
            {
                $('a#'+this.cid+'_relative').off ( );
                super_remove_controls.call ( this );
            };

            this.addControls ( );
        };

        inherit ( cls, Chart );
        cls.getName = function ( ) { return 'atr'; };
        cls.getTitle = function ( ) { return 'ATR'; };
        return cls;
    } ) ( );


    /*
     * Chart of Price RSI
     */
    var ChartRSI = ( function ( )
    {
        var cls = function ( cid )
        {
            this.constructor['super'].call ( this, cid, 'sc', true );

            this.chart_options = { };
            this.dataset = [ ];
            this.lower_bound = [ ];
            this.upper_bound = [ ];

            /* update chart */
            var super_update = this.update;
            this.update = function ( replot )
            {
                this.chart_options = jQuery.extend ( true, {}, common_lines_options );
                this.chart_options.xaxis.timeformat = this.getTimeFormat ( );
                this.chart_options.tooltipOpts.content = '%y.2<br/> %x';
                this.chart_options.yaxis.tickFormatter = null;
                this.chart_options.yaxis.min = 0;
                this.chart_options.yaxis.max = 100.1;

                this.dataset = [ ];
                this.lower_bound = [ ];
                this.upper_bound = [ ];

                this.lower_bound.push ( [ this.exchanges[0].rsi[0][0], 30 ] );
                this.lower_bound.push ( [ this.exchanges[0].rsi[this.exchanges[0].rsi.length-1][0], 30 ] );
                this.upper_bound.push ( [ this.exchanges[0].rsi[0][0], 70 ] );
                this.upper_bound.push ( [ this.exchanges[0].rsi[this.exchanges[0].rsi.length-1][0], 70 ] );

                if ( this.getMode() == 'c' )
                {
                    for ( var i=0; i<this.exchanges.length; ++i )
                    {
                        var e = this.exchanges[i];
                        this.dataset.push ( { data:e.rsi_mavg,label:e.name, color:colors_chart_price[e.id],
                                              tooltipFormat:(e.name+'<br />%y.2<br/> %x'), lines:{lineWidth:1} } );
                    }

                    this.dataset.push ( { data:this.lower_bound,label:'o.s.', color:'#720', lines:{lineWidth:1} } );
                    this.dataset.push ( { data:this.upper_bound,label:'o.b.', color:'#072', lines:{lineWidth:1} } );
                }

                super_update.call ( this, replot );
            };

            /* plot a single exchange */
            this.plot_single = function ( )
            {
                var e = this.exchanges[0];
                this.chart_options.legend.noColumns = 3;
                $.plot ( this.cdiv, [ { data:this.lower_bound,label:'o.s.', color:'#720', lines:{lineWidth:1} },
                                      { data:this.upper_bound,label:'o.b.', color:'#072', lines:{lineWidth:1} },
                                      { data:e.rsi,label:'rsi', color:color_chart_price, lines:{lineWidth:1.2} } ],
                         this.chart_options );
            };

            /* plot multiple exchanges */
            this.plot_multiple = function ( )
            {
                if ( this.merged )
                {
                    this.plot_merged ( );
                    return;
                }

                this.chart_options.legend.noColumns = this.exchanges.length+2;
                $.plot ( this.cdiv, this.dataset, this.chart_options );
            };

            /* plot multiple exchanges merged */
            this.plot_merged = function ( )
            {
                this.chart_options.legend.noColumns = 3;
                var e = exchanges_merged;
                $.plot ( this.cdiv, [ { data:this.lower_bound,label:'o.s.', color:'#720', lines:{lineWidth:1} },
                                      { data:this.upper_bound,label:'o.b.', color:'#072', lines:{lineWidth:1} },
                                      { data:e.rsi,label:'average rsi', color:color_chart_price, lines:{lineWidth:1.2} } ],
                         this.chart_options );
            };

            this.addControls ( );
        };

        inherit ( cls, Chart );
        cls.getName = function ( ) { return 'rsi'; };
        cls.getTitle = function ( ) { return 'RSI'; };
        return cls;
    } ) ( );


    /*
     * Chart of Price TSI
     */
    var ChartTSI = ( function ( )
    {
        var cls = function ( cid )
        {
            this.constructor['super'].call ( this, cid, 'sc', true );

            this.chart_options = { };
            this.dataset = [ ];
            this.lower_bound = [ ];
            this.upper_bound = [ ];

            /* update chart */
            var super_update = this.update;
            this.update = function ( replot )
            {
                this.chart_options = jQuery.extend ( true, {}, common_lines_options );
                this.chart_options.xaxis.timeformat = this.getTimeFormat ( );
                this.chart_options.tooltipOpts.content = '%y.2<br/> %x';
                this.chart_options.yaxis.tickFormatter = null;
                /* todo: auto-adjust
                this.chart_options.yaxis.min = -100; 
                this.chart_options.yaxis.max = 100.1;*/

                this.dataset = [ ];
                this.lower_bound = [ ];
                this.upper_bound = [ ];

                this.lower_bound.push ( [ this.exchanges[0].tsi[0][0], -25 ] );
                this.lower_bound.push ( [ this.exchanges[0].tsi[this.exchanges[0].tsi.length-1][0], -25 ] );
                this.upper_bound.push ( [ this.exchanges[0].tsi[0][0], 25 ] );
                this.upper_bound.push ( [ this.exchanges[0].tsi[this.exchanges[0].tsi.length-1][0], 25 ] );

                if ( this.getMode() == 'c' )
                {
                    for ( var i=0; i<this.exchanges.length; ++i )
                    {
                        var e = this.exchanges[i];
                        this.dataset.push ( { data:e.tsi,label:e.name, color:colors_chart_price[e.id],
                                              tooltipFormat:(e.name+'<br />%y.2<br/> %x'), lines:{lineWidth:1} } );
                    }

                    this.dataset.push ( { data:this.lower_bound,label:'o.s.', color:'#720', lines:{lineWidth:1} } );
                    this.dataset.push ( { data:this.upper_bound,label:'o.b.', color:'#072', lines:{lineWidth:1} } );
                }

                super_update.call ( this, replot );
            };

            /* plot a single exchange */
            this.plot_single = function ( )
            {
                var e = this.exchanges[0];
                this.chart_options.legend.noColumns = 4;
                $.plot ( this.cdiv, [ { data:this.lower_bound,label:'o.s.', color:'#720', lines:{lineWidth:1} },
                                      { data:this.upper_bound,label:'o.b.', color:'#072', lines:{lineWidth:1} },
                                      { data:e.tsi,label:'tsi', color:color_chart_price, lines:{lineWidth:1.4} },
                                      { data:e.tsi_ema7,label:'ema7', color:color_chart_price_ema12, lines:{lineWidth:1} } ],
                         this.chart_options );
            };

            /* plot multiple exchanges */
            this.plot_multiple = function ( )
            {
                if ( this.merged )
                {
                    this.plot_merged ( );
                    return;
                }

                this.chart_options.legend.noColumns = this.exchanges.length+2;
                $.plot ( this.cdiv, this.dataset, this.chart_options );
            };

            /* plot multiple exchanges merged */
            this.plot_merged = function ( )
            {
                this.chart_options.legend.noColumns = 4;
                var e = exchanges_merged;
                $.plot ( this.cdiv, [ { data:this.lower_bound,label:'o.s.', color:'#720', lines:{lineWidth:1} },
                                      { data:this.upper_bound,label:'o.b.', color:'#072', lines:{lineWidth:1} },
                                      { data:e.tsi,label:'average tsi', color:color_chart_price, lines:{lineWidth:1.2} } ],
                         this.chart_options );
            };

            this.addControls ( );
        };

        inherit ( cls, Chart );
        cls.getName = function ( ) { return 'tsi'; };
        cls.getTitle = function ( ) { return 'TSI'; };
        return cls;
    } ) ( );


    /*
     * Chart of Bids/Asks Ratio
     */
    var ChartBidsAsksRatio = ( function ( )
    {
        var cls = function ( cid )
        {
            this.constructor['super'].call ( this, cid, 'sc', true );

            this.baratios = { };
            this.baratios_mavg = { };
            this.dataset = [ ];

            this.chart_options = {
                canvas: true,
                tooltip: true,
                tooltipOpts: { content: '%y.2<br/> %x', xDateFormat: '%d-%b-%Y %H:%M:%S' },
                legend: { position:'nw', margin:0, backgroundOpacity:0.5, backgroundColor:color_chart_legend_bg },
                lines: { show:true },
                grid: { hoverable:true, borderWidth:'0' },
                xaxis: { mode: 'time', timezone:'browser', timeformat:'%H:%M:%S', font:{color:color_chart_axis_text},
                         color:color_chart_axis, autoscaleMargin:automargin, ticks:null },
                yaxis: { font:{color:color_chart_axis_text}, labelWidth:lbl_width, color:color_chart_axis, yaxis:yaxis_position, tickFormatter:null }
            };

            /*
             * normalization of ratio
             * normalized : sum_bids[CUR] / (sum_asks[BTC] * price[CUR])
             * not normalized : (sum_bids[CUR] / sum_asks[BTC]) * [CUR/USD]
             */
            this.normalized = true;

            this.toggleNormalization = function ( )
            {
                this.normalized = !this.normalized;
                this.updateControls ( );
                this.update ( true );
                saveConfig ( );
            };

            this.denormalize = function ( e )
            {
                var e_baratios = this.baratios[e.name];
                var e_baratios_mavg = this.baratios_mavg[e.name];
                for ( var j=0; j<e_baratios.length; ++ j )
                {
                    e_baratios[j][1] = e_baratios[j][1] * e.prices[j][1];
                    e_baratios_mavg[j][1] = e_baratios_mavg[j][1] * e.prices[j][1];
                }
            };

            /* display of mavg */
            this.show_mavg = true;

            this.toggleMAVG = function ( )
            {
                this.show_mavg = !this.show_mavg;
                this.updateControls ( );
                this.update ( true );
                saveConfig ( );
            };

            /* configuration */
            var super_set_config = this.setConfig;
            this.setConfig = function ( conf )
            {
                if ( conf.hasOwnProperty('norm') )
                    this.normalized = conf.norm;

                if ( conf.hasOwnProperty('mavg') )
                    this.show_mavg = conf.mavg;

                super_set_config.call ( this, conf ); /* called last to update controls */
            };

            var super_get_config = this.getConfig;
            this.getConfig = function ( )
            {
                var conf = super_get_config.call ( this );
                conf['norm'] = this.normalized;
                conf['mavg'] = this.show_mavg;
                return conf;
            };

            /* update chart */
            var super_update = this.update;
            this.update = function ( replot )
            {
                this.dataset = [ ];

                this.chart_options.xaxis.timeformat = this.getTimeFormat ( );

                /* copy exchanges data because we may have to modify them */
                this.baratios = { };
                this.baratios_mavg = { };

                if ( ( this.getMode() == 's' ) || !this.merged )
                {
                    for ( var i=0; i<this.exchanges.length; ++i )
                    {
                        var e = this.exchanges[i];
                        this.baratios[this.exchanges[i].name] = jQuery.extend ( true, [], e.baratios );
                        this.baratios_mavg[this.exchanges[i].name] = jQuery.extend ( true, [], e.baratios_mavg );
                    }
                }
                else
                {
                    this.baratios[exchanges_merged.name] = jQuery.extend ( true, [], exchanges_merged.baratios );
                    this.baratios_mavg[exchanges_merged.name] = jQuery.extend ( true, [], exchanges_merged.baratios_mavg );
                }

                /* de-normalize using price */
                if ( !this.normalized )
                {
                    if ( ( this.getMode() == 's' ) || !this.merged )
                        for ( var i=0; i<this.exchanges.length; ++i )
                            this.denormalize ( this.exchanges[i] );
                    else
                        this.denormalize ( exchanges_merged );
                }

                if ( ( this.getMode() == 'c' ) && !this.merged )
                {
                    var baratio_tooltip = '<br />%y.2 '+shown_currency+'<br/> %x';
                    if ( this.normalized )
                        baratio_tooltip = '<br />%y.3<br/> %x';

                    for ( var i=0; i<this.exchanges.length; ++i )
                    {
                        var e = this.exchanges[i];
                        this.dataset.push ( { data:this.baratios_mavg[e.name], label:e.name, color:colors_chart_baratio[e.id],
                                              tooltipFormat:e.name+baratio_tooltip, lines:{lineWidth:1} } );
                    }
                }

                super_update.call ( this, replot );
            };

            /* plot a single exchange */
            this.plot_single = function ( )
            {
                var e = this.exchanges[0];
                var curr = getExchangeCurrency(e.name);
                var plots = [ ];

                this.chart_options.legend.noColumns = 2;
                this.chart_options.tooltipOpts.content = '%y.2 ' + curr + '<br/> %x';

                if ( this.normalized )
                    this.chart_options.tooltipOpts.content = '%y.3<br/> %x';

                plots.push ( { data:this.baratios[e.name], label:'total bids/asks ratio', color:color_chart_baratio } );

                if ( this.show_mavg )
                    plots.push ( { data:this.baratios_mavg[e.name], label:'moving average',
                                   color:color_chart_baratio_mavg, lines:{lineWidth:1.1} } );

                $.plot ( this.cdiv, plots, this.chart_options );
            };

            /* plot multiple exchanges */
            this.plot_multiple = function ( )
            {
                if ( this.merged )
                {
                    this.plot_merged ( );
                    return;
                }

                this.chart_options.legend.noColumns = this.exchanges.length;
                $.plot ( this.cdiv, this.dataset, this.chart_options );
            };

            /* plot multiple exchanges merged */
            this.plot_merged = function ( )
            {
                var e = exchanges_merged;
                var plots = [ ];

                this.chart_options.legend.noColumns = 2;

                if ( this.normalized )
                    this.chart_options.tooltipOpts.content = '%y.3<br/> %x';

                plots.push ( { data:this.baratios[e.name], label:'ratio of merged bids & asks sums', color:color_chart_baratio} );

                if ( this.show_mavg )
                    plots.push ( { data:this.baratios_mavg[e.name], label:'moving average',
                                   color:color_chart_baratio_mavg, lines:{lineWidth:1.1} } );

                $.plot ( this.cdiv, plots, this.chart_options );
            };

            /* addControls */
            var super_add_controls = this.addControls;
            this.addControls = function ( )
            {
                super_add_controls.call ( this );
                var ins = ' | &nbsp;';
                ins += 'normalize <a id="'+this.cid+'_norm" href="#"><img class="btn" id="btn_'+this.cid+'_norm" src="'+ui_img_button_enabled+'" alt="off"/></a>';
                ins += '<span id="'+this.cid+'_mavg"> | &nbsp;';
                ins += 'show mavg <a id="'+this.cid+'_mavg" href="#"><img class="btn" id="btn_'+this.cid+'_mavg" src="'+ui_img_button_enabled+'" alt="off"/></a>';
                ins += '</span>';
                $(this.tspan).append ( ins );

                var self = this;
                $('a#'+this.cid+'_norm').on ( 'click', function(e) { e.preventDefault(); self.toggleNormalization(); } );
                $('a#'+this.cid+'_mavg').on ( 'click', function(e) { e.preventDefault(); self.toggleMAVG(); } );

                this.updateControls ( );
            };

            /* updateControls */
            var super_update_controls = this.updateControls;
            this.updateControls = function ( )
            {
                super_update_controls.call ( this );

                if ( this.normalized )
                {
                    $('img#btn_'+this.cid+'_norm').attr ( 'src', ui_img_button_enabled );
                    $('img#btn_'+this.cid+'_norm').attr ( 'alt', 'off' );
                }
                else
                {
                    $('img#btn_'+this.cid+'_norm').attr ( 'src', ui_img_button_disabled );
                    $('img#btn_'+this.cid+'_norm').attr ( 'alt', 'on' );
                }

                if ( this.getMode() == 'c' && !this.merged )
                    $('span#'+this.cid+'_mavg').hide ( );
                else
                {
                    $('span#'+this.cid+'_mavg').show ( );

                    if ( this.show_mavg )
                    {
                        $('img#btn_'+this.cid+'_mavg').attr ( 'src', ui_img_button_enabled );
                        $('img#btn_'+this.cid+'_mavg').attr ( 'alt', 'off' );
                    }
                    else
                    {
                        $('img#btn_'+this.cid+'_mavg').attr ( 'src', ui_img_button_disabled );
                        $('img#btn_'+this.cid+'_mavg').attr ( 'alt', 'on' );
                    }
                }
            };

            /* removeControls */
            var super_remove_controls = this.removeControls;
            this.removeControls = function ( )
            {
                $('a#'+this.cid+'_norm').off ( );
                $('a#'+this.cid+'_mavg').off ( );
                super_remove_controls.call ( this );
            };

            this.addControls ( );
        };

        inherit ( cls, Chart );
        cls.getName = function ( ) { return 'baratio'; };
        cls.getTitle = function ( ) { return 'Bids/Asks Ratio'; };
        return cls;
    } ) ( );


    /*
     * Chart of Bids & Asks Sums
     */
    var ChartBidsAsksSums = ( function ( )
    {
        var cls = function ( cid )
        {
            this.constructor['super'].call ( this, cid, 'sc', true );

            this.dataset = [ ];

            this.chart_options = {
                canvas: true,
                tooltip: true,
                tooltipOpts: { content: '%y.2<br/> %x', xDateFormat: '%d-%b-%Y %H:%M:%S' },
                legend: { position:'nw', margin:0, noColumns:2, backgroundOpacity:0.5, backgroundColor:color_chart_legend_bg },
                lines: { show:true, lineWidth:1.1 },
                grid: { hoverable:true, borderWidth:'0' },
                xaxis: { mode: 'time', timezone:'browser', timeformat:'%H:%M:%S', font:{color:color_chart_axis_text},
                         color:color_chart_axis, autoscaleMargin:automargin, ticks:null },
                yaxes: [ { font:{color:color_chart_axis_text}, labelWidth:lbl_width, tickDecimals:1,
                           alignTicksWithAxis:1, color:color_chart_axis, tickFormatter:formatTickUSD },
                         { font:{color:color_chart_axis_text}, labelWidth:lbl_width, tickDecimals:1,
                           alignTicksWithAxis:1, position:yaxis_position, color:color_chart_axis, tickFormatter:formatTickBTC } ]
            };

            /* update chart */
            var super_update = this.update;
            this.update = function ( replot )
            {
                this.dataset = [ ];

                this.chart_options.xaxis.timeformat = this.getTimeFormat ( );

                if ( this.getMode() == 'c' )
                {
                    for ( var i=0; i<this.exchanges.length; ++i )
                    {
                        var e = this.exchanges[i];
                        this.dataset.push ( { data:e.sum_bids, label:e.name+' bids', color:colors_chart_book[e.id][0],
                                              yaxis:1, tooltipFormat:e.name+' bids<br />%y.0 '+shown_currency+' booked<br/>%x' } );
                    }

                    /* this second pass (for asks) allows to maintain legend's order */
                    for ( var i=0; i<this.exchanges.length; ++i )
                    {
                        var e = this.exchanges[i];
                        this.dataset.push ( { data:e.sum_asks, label:e.name+' asks', color:colors_chart_book[e.id][1], yaxis:2,
                                              tooltipFormat:e.name+' asks<br />%y.0 BTC booked<br/>%x' } );
                    }
                }

                super_update.call ( this, replot );
            };

            /* plot a single exchange */
            this.plot_single = function ( )
            {
                var e = this.exchanges[0];
                var curr = getExchangeCurrency(e.name);

                this.chart_options.legend.noColumns = 2;
                this.chart_options.tooltipOpts.content = '%y.2 ' + curr + '<br/> %x';

                this.chart_options.yaxes[0].tickFormatter = currency_formatter[curr];
                $.plot ( this.cdiv,
                         [ { data:e.sum_bids, label:'bids sum ('+curr+')', color:color_chart_bids, yaxis:1, tooltipFormat:'%y.0 '+curr+' booked<br/> %x ' },
                           { data:e.sum_asks, label:'asks sum (BTC)', color:color_chart_asks, yaxis:2, tooltipFormat:'%y.0 BTC booked<br/> %x ' } ],
                         this.chart_options );
            };

            /* plot multiple exchanges */
            this.plot_multiple = function ( )
            {
                if ( this.merged )
                {
                    this.plot_merged ( );
                    return;
                }

                this.chart_options.yaxes[0].tickFormatter = currency_formatter[shown_currency];
                this.chart_options.legend.noColumns = Math.max ( 2, this.exchanges.length );
                $.plot ( this.cdiv, this.dataset, this.chart_options );
            };

            /* plot multiple exchanges merged */
            this.plot_merged = function ( )
            {
                var e = exchanges_merged;
                this.chart_options.yaxes[0].tickFormatter = currency_formatter[shown_currency];
                $.plot ( this.cdiv, [ { data:e.sum_bids, label:'merged bids sum ('+shown_currency+')', color:color_chart_bids, yaxis:1,
                                        tooltipFormat:'%y.0 '+shown_currency+' booked<br/> %x ' },
                                      { data:e.sum_asks, label:'merged asks sum (BTC)', color:color_chart_asks, yaxis:2,
                                        tooltipFormat:'%y.0 BTC booked<br/> %x '} ],
                         this.chart_options );
            };

            this.addControls ( );
        };

        inherit ( cls, Chart );
        cls.getName = function ( ) { return 'basums'; };
        cls.getTitle = function ( ) { return 'Bids/Asks Sums'; };
        return cls;
    } ) ( );


    /*
     * Chart of Volume
     */
    var ChartVolume = ( function ( )
    {
        var cls = function ( cid )
        {
            this.constructor['super'].call ( this, cid, 'sc', true );

            this.dataset = [ ];

            this.chart_options = {
                canvas: true,
                tooltip: true,
                tooltipOpts: { content: '%y.2 BTC<br/> %x', xDateFormat: '%d-%b-%Y %H:%M:%S' },
                series: { stack:true },
                legend: { position:'nw', margin:0, backgroundOpacity:0.5, backgroundColor:color_chart_legend_bg },
                grid: { hoverable:true, borderWidth:'0' },
                bars: { show:true, align:'left' },
                lines: { show:true },
                xaxis: { mode: 'time', timezone:'browser', timeformat:'%H:%M:%S', font:{color:color_chart_axis_text},
                         color:color_chart_axis, autoscaleMargin:automargin, ticks:null },
                yaxis: { font:{color:color_chart_axis_text}, labelWidth:lbl_width, min:0, tickDecimals:1,
                         yaxis:yaxis_position, tickFormatter:formatTickBTC, color:color_chart_axis }
            };

            /* style */
            this.bars = true;

            this.setStyle = function ( style )
            {
                if ( style == 'bars' )
                    this.bars = true;
                else
                    this.bars = false;

                this.updateControls ( );
                this.update ( true );
                saveConfig ( );
            };

            /* logarithmic display */
            this.log = false;

            this.toggleLog = function ( )
            {
                this.log = !this.log;
                this.updateControls ( );
                this.update ( true );
                saveConfig ( );
            };

            /* configuration */
            var super_set_config = this.setConfig;
            this.setConfig = function ( conf )
            {
                if ( conf.hasOwnProperty('bars') )
                    this.bars = conf.bars;

                if ( conf.hasOwnProperty('log') )
                    this.log = conf.log;

                super_set_config.call ( this, conf ); /* called last to update controls */
            };

            var super_get_config = this.getConfig;
            this.getConfig = function ( )
            {
                var conf = super_get_config.call ( this );
                conf['bars'] = this.bars;
                conf['log'] = this.log;
                return conf;
            };

            /* update chart */
            var super_update = this.update;
            this.update = function ( replot )
            {
                this.dataset = [ ];
                this.chart_options.xaxis.timeformat = this.getTimeFormat ( );

                if ( this.bars )
                    this.chart_options.bars.barWidth = (this.nbmsecs / this.nbpoints) * 0.3;

                this.chart_options.bars.show = this.bars;
                this.chart_options.lines.show = !this.bars;

                if ( this.log )
                {
                    this.chart_options.yaxis.transform = function (v) { if(v<1)return 0; return Math.log(v) / Math.LN10; };
                    this.chart_options.yaxis.inverseTransform = function (v) { if(v==0)return 0; return Math.exp(v*Math.LN10); };
                }
                else
                {
                    this.chart_options.yaxis.transform = null;
                    this.chart_options.yaxis.inverseTransform = null;
                    this.chart_options.yaxis.ticks = null;
                    this.chart_options.yaxis.min = 0;
                }

                var nb_exchanges = this.exchanges.length;
                this.chart_options.legend.noColumns = nb_exchanges;

                if ( this.getMode() != 's' )
                {
                    if ( this.bars )
                    {
                        if ( this.merged )
                            this.dataset.push ( { data:exchanges_merged.volume, label:'merged volume (BTC)', color:color_chart_volume,
                                                  tooltipFormat:'%y.2 BTC<br/> %x' } );
                        else
                        {
                            for ( var i=0; i<nb_exchanges; ++i )
                            {
                                var e = this.exchanges[i];
                                this.dataset.push ( { data:e.volume_synced, label:e.name, color:colors_chart_volume[e.id],
                                                      tooltipFormat:(e.name+'<br />%y.2 BTC<br/> %x') } );
                            }
                        }
                    }
                    else
                    {
                        if ( this.merged )
                            this.dataset.push ( { data:exchanges_merged.volume, label:'merged volume (BTC)', color:color_chart_volume, id:'0',
                                                  fillBelowTo:'zero', tooltipFormat:'%y.2 BTC<br/> %x', lines:{lineWidth:1} } );
                        else
                        {
                            var e = this.exchanges[0];
                            this.dataset.push ( { data:e.volume_synced, label:e.name, color:colors_chart_volume[e.id], id:'0',
                                                  fillBelowTo:'zero', tooltipFormat:(e.name+'<br />%y.2 BTC<br/> %x'), lines:{lineWidth:1} } );

                            for ( var i=1; i<nb_exchanges; ++i )
                            {
                                e = this.exchanges[i];
                                this.dataset.push ( { data:e.volume_synced, label:e.name, color:colors_chart_volume[e.id], id:i.toString(),
                                                      fillBelowTo:(i-1).toString(), tooltipFormat:(e.name+'<br />%y.2 BTC<br/> %x'), lines:{lineWidth:1} } );
                            }
                        }
                    }
                }

                super_update.call ( this, replot );
            };

            /* plot a single exchange */
            this.plot_single = function ( )
            {
                var e = this.exchanges[0];
                var plots = [ ];

                if ( this.bars )
                    plots.push ( { data:e.volume, label:'volume (BTC)', color:color_chart_volume } );
                else
                    plots.push ( { data:e.volume, label:'volume (BTC)', color:color_chart_volume, id:'0', fillBelowTo:'zero' } );

                if ( this.log )
                {
                    this.chart_options.yaxis.ticks = this.computeLogTicks ( plots, false );
                    this.chart_options.yaxis.min = this.chart_options.yaxis.ticks[0];
                }

                $.plot ( this.cdiv, plots, this.chart_options );
            };

            /* plot multiple exchanges */
            this.plot_multiple = function ( )
            {
                if ( this.log )
                {
                    this.chart_options.yaxis.ticks = this.computeLogTicks ( this.dataset, true );
                    this.chart_options.yaxis.min = this.chart_options.yaxis.ticks[0];
                }

                $.plot ( this.cdiv, this.dataset, this.chart_options );
            };

            /* addControls */
            var super_add_controls = this.addControls;
            this.addControls = function ( )
            {
                super_add_controls.call ( this );

                var ins = '';
                ins += '<span id="'+this.cid+'_style"> | &nbsp;';
                ins += 'lines <a id="'+this.cid+'_lines" href="#"><img class="btn" id="btn_'+this.cid+'_lines" src="'+ui_img_toggle_enabled+'"></a> ' +
                       'bars <a id="'+this.cid+'_bars" href="#"><img class="btn" id="btn_'+this.cid+'_bars" src="'+ui_img_toggle_disabled+'" /></a>';
                ins += '</span>';
                ins +=  ' | &nbsp;';
                ins += 'log <a id="'+this.cid+'_log" href="#"><img class="btn" id="btn_'+this.cid+'_log" src="'+ui_img_button_enabled+'" alt="off"/></a> ';
                $(this.tspan).append ( ins );

                var self = this;
                $('a#'+this.cid+'_lines').on ( 'click', function(e) { e.preventDefault(); self.setStyle('lines'); } );
                $('a#'+this.cid+'_bars').on ( 'click', function(e) { e.preventDefault(); self.setStyle('bars'); } );
                $('a#'+this.cid+'_log').on ( 'click', function(e) { e.preventDefault(); self.toggleLog(); } );

                this.updateControls ( );
            };

            /* updateControls */
            var super_update_controls = this.updateControls;
            this.updateControls = function ( )
            {
                super_update_controls.call ( this );

                if ( this.bars )
                {
                    $('img#btn_'+this.cid+'_bars').attr ( 'src', ui_img_toggle_enabled );
                    $('img#btn_'+this.cid+'_lines').attr ( 'src', ui_img_toggle_disabled );
                }
                else
                {
                    $('img#btn_'+this.cid+'_bars').attr ( 'src', ui_img_toggle_disabled );
                    $('img#btn_'+this.cid+'_lines').attr ( 'src', ui_img_toggle_enabled );
                }

                if ( this.log )
                {
                    $('img#btn_'+this.cid+'_log').attr ( 'src', ui_img_button_enabled );
                    $('img#btn_'+this.cid+'_log').attr ( 'alt', 'off' );
                }
                else
                {
                    $('img#btn_'+this.cid+'_log').attr ( 'src', ui_img_button_disabled );
                    $('img#btn_'+this.cid+'_log').attr ( 'alt', 'on' );
                }
            };

            /* removeControls */
            var super_remove_controls = this.removeControls;
            this.removeControls = function ( )
            {
                $('a#'+this.cid+'_bars').off ( );
                $('a#'+this.cid+'_lines').off ( );
                $('a#'+this.cid+'_log').off ( );
                super_remove_controls.call ( this );
            };

            this.addControls ( );
        };

        inherit ( cls, Chart );
        cls.getName = function ( ) { return 'volume'; };
        cls.getTitle = function ( ) { return 'Volume (BTC)'; };
        return cls;
    } ) ( );


    /*
     * Chart of Volume Expressed in Selected Currency
     */
    var ChartVolumeCurrency = ( function ( )
    {
        var cls = function ( cid )
        {
            this.constructor['super'].call ( this, cid, 'sc', true );

            this.dataset = [ ];

            this.chart_options = {
                canvas: true,
                tooltip: true,
                tooltipOpts: { content: '%y.2 USD<br/> %x', xDateFormat: '%d-%b-%Y %H:%M:%S' },
                series: { stack:true },
                legend: { position:'nw', margin:0, backgroundOpacity:0.5, backgroundColor:color_chart_legend_bg },
                grid: { hoverable:true, borderWidth:'0' },
                bars: { show:true, align:'left' },
                lines: { show:true },
                xaxis: { mode: 'time', timezone:'browser', timeformat:'%H:%M:%S', font:{color:color_chart_axis_text},
                         color:color_chart_axis, autoscaleMargin:automargin, ticks:null },
                yaxis: { font:{color:color_chart_axis_text}, labelWidth:lbl_width, min:0, tickDecimals:1,
                         yaxis:yaxis_position, tickFormatter:formatTickBTC, color:color_chart_axis }
            };

            /* style */
            this.bars = true;

            this.setStyle = function ( style )
            {
                if ( style == 'bars' )
                    this.bars = true;
                else
                    this.bars = false;

                this.updateControls ( );
                this.update ( true );
                saveConfig ( );
            };

            /* logarithmic display */
            this.log = false;

            this.toggleLog = function ( )
            {
                this.log = !this.log;
                this.updateControls ( );
                this.update ( true );
                saveConfig ( );
            };

            /* configuration */
            var super_set_config = this.setConfig;
            this.setConfig = function ( conf )
            {
                if ( conf.hasOwnProperty('bars') )
                    this.bars = conf.bars;

                if ( conf.hasOwnProperty('log') )
                    this.log = conf.log;

                super_set_config.call ( this, conf ); /* called last to update controls */
            };

            var super_get_config = this.getConfig;
            this.getConfig = function ( )
            {
                var conf = super_get_config.call ( this );
                conf['bars'] = this.bars;
                conf['log'] = this.log;
                return conf;
            };

            /* update chart */
            var super_update = this.update;
            this.update = function ( replot )
            {
                this.dataset = [ ];
                this.chart_options.xaxis.timeformat = this.getTimeFormat ( );

                if ( this.bars )
                    this.chart_options.bars.barWidth = (this.nbmsecs / this.nbpoints) * 0.3;

                this.chart_options.bars.show = this.bars;
                this.chart_options.lines.show = !this.bars;

                this.chart_options.tooltipOpts.content = '%y.2 '+shown_currency+'<br/> %x';

                if ( this.log )
                {
                    this.chart_options.yaxis.transform = function (v) { if(v<1)return 0; return Math.log(v) / Math.LN10; };
                    this.chart_options.yaxis.inverseTransform = function (v) { if(v==0)return 0; return Math.exp(v*Math.LN10); };
                }
                else
                {
                    this.chart_options.yaxis.transform = null;
                    this.chart_options.yaxis.inverseTransform = null;
                    this.chart_options.yaxis.ticks = null;
                    this.chart_options.yaxis.min = 0;
                }

                var nb_exchanges = this.exchanges.length;
                this.chart_options.legend.noColumns = nb_exchanges;

                if ( this.getMode() == 's' )
                {
                    e = this.exchanges[0];
                    e.volume_synced = e.volume;
                    e.prices_synced = e.prices;
                }

                if ( this.merged )
                {
                    /* todo: move duplicated code into function */
                    var volcurr = [ ];
                    var e = exchanges_merged;
                    for ( var j=0; j<e.volume.length; ++j )
                        volcurr.push ( [e.volume[j][0], e.volume[j][1]*e.prices[j][1]] );
                    e.volcurr = volcurr;
                }
                else
                {
                    for ( var i=0; i<nb_exchanges; ++i )
                    {
                        e = this.exchanges[i];
                        var volcurr = [ ];
                        for ( var j=0; j<e.volume_synced.length; ++j )
                            volcurr.push ( [e.volume_synced[j][0], e.volume_synced[j][1]*e.prices_synced[j][1]] );
                        e.volcurr_synced = volcurr;
                    }
                }

                if ( this.getMode() != 's' )
                {
                    if ( this.bars )
                    {
                        if ( this.merged )
                            this.dataset.push ( { data:exchanges_merged.volcurr, label:'merged volume ('+shown_currency+')', color:color_chart_volume,
                                                  tooltipFormat:'%y.2 '+shown_currency+'<br/> %x' } );
                        else
                        {
                            for ( var i=0; i<nb_exchanges; ++i )
                            {
                                var e = this.exchanges[i];
                                this.dataset.push ( { data:e.volcurr_synced, label:e.name, color:colors_chart_volume[e.id],
                                                      tooltipFormat:(e.name+'<br />%y.2 '+shown_currency+'<br/> %x') } );
                            }
                        }
                    }
                    else
                    {
                        if ( this.merged )
                            this.dataset.push ( { data:exchanges_merged.volcurr, label:'merged volume ('+shown_currency+')', color:color_chart_volume, id:'0',
                                                  fillBelowTo:'zero', tooltipFormat:'%y.2 '+shown_currency+'<br/> %x', lines:{lineWidth:1} } );
                        else
                        {
                            var e = this.exchanges[0];
                            this.dataset.push ( { data:e.volcurr_synced, label:e.name, color:colors_chart_volume[e.id], id:'0',
                                                  fillBelowTo:'zero', tooltipFormat:(e.name+'<br />%y.2 '+shown_currency+'<br/> %x'), lines:{lineWidth:1} } );

                            for ( var i=1; i<nb_exchanges; ++i )
                            {
                                e = this.exchanges[i];
                                this.dataset.push ( { data:e.volcurr_synced, label:e.name, color:colors_chart_volume[e.id], id:i.toString(),
                                                      fillBelowTo:(i-1).toString(), tooltipFormat:(e.name+'<br />%y.2 '+shown_currency+'<br/> %x'), lines:{lineWidth:1} } );
                            }
                        }
                    }
                }

                super_update.call ( this, replot );
            };

            /* plot a single exchange */
            this.plot_single = function ( )
            {
                var e = this.exchanges[0];
                var plots = [ ];

                if ( this.bars )
                    plots.push ( { data:e.volcurr_synced, label:'volume ('+shown_currency+')', color:color_chart_volume } );
                else
                    plots.push ( { data:e.volcurr_synced, label:'volume ('+shown_currency+')', color:color_chart_volume, id:'0', fillBelowTo:'zero' } );

                if ( this.log )
                {
                    this.chart_options.yaxis.ticks = this.computeLogTicks ( plots, false );
                    this.chart_options.yaxis.min = this.chart_options.yaxis.ticks[0];
                }

                $.plot ( this.cdiv, plots, this.chart_options );
            };

            /* plot multiple exchanges */
            this.plot_multiple = function ( )
            {
                if ( this.log )
                {
                    this.chart_options.yaxis.ticks = this.computeLogTicks ( this.dataset, true );
                    this.chart_options.yaxis.min = this.chart_options.yaxis.ticks[0];
                }

                $.plot ( this.cdiv, this.dataset, this.chart_options );
            };

            /* addControls */
            var super_add_controls = this.addControls;
            this.addControls = function ( )
            {
                super_add_controls.call ( this );

                var ins = '';
                ins += '<span id="'+this.cid+'_style"> | &nbsp;';
                ins += 'lines <a id="'+this.cid+'_lines" href="#"><img class="btn" id="btn_'+this.cid+'_lines" src="'+ui_img_toggle_enabled+'"></a> ' +
                       'bars <a id="'+this.cid+'_bars" href="#"><img class="btn" id="btn_'+this.cid+'_bars" src="'+ui_img_toggle_disabled+'" /></a>';
                ins += '</span>';
                ins +=  ' | &nbsp;';
                ins += 'log <a id="'+this.cid+'_log" href="#"><img class="btn" id="btn_'+this.cid+'_log" src="'+ui_img_button_enabled+'" alt="off"/></a> ';
                $(this.tspan).append ( ins );

                var self = this;
                $('a#'+this.cid+'_lines').on ( 'click', function(e) { e.preventDefault(); self.setStyle('lines'); } );
                $('a#'+this.cid+'_bars').on ( 'click', function(e) { e.preventDefault(); self.setStyle('bars'); } );
                $('a#'+this.cid+'_log').on ( 'click', function(e) { e.preventDefault(); self.toggleLog(); } );

                this.updateControls ( );
            };

            /* updateControls */
            var super_update_controls = this.updateControls;
            this.updateControls = function ( )
            {
                super_update_controls.call ( this );

                if ( this.bars )
                {
                    $('img#btn_'+this.cid+'_bars').attr ( 'src', ui_img_toggle_enabled );
                    $('img#btn_'+this.cid+'_lines').attr ( 'src', ui_img_toggle_disabled );
                }
                else
                {
                    $('img#btn_'+this.cid+'_bars').attr ( 'src', ui_img_toggle_disabled );
                    $('img#btn_'+this.cid+'_lines').attr ( 'src', ui_img_toggle_enabled );
                }

                if ( this.log )
                {
                    $('img#btn_'+this.cid+'_log').attr ( 'src', ui_img_button_enabled );
                    $('img#btn_'+this.cid+'_log').attr ( 'alt', 'off' );
                }
                else
                {
                    $('img#btn_'+this.cid+'_log').attr ( 'src', ui_img_button_disabled );
                    $('img#btn_'+this.cid+'_log').attr ( 'alt', 'on' );
                }
            };

            /* removeControls */
            var super_remove_controls = this.removeControls;
            this.removeControls = function ( )
            {
                $('a#'+this.cid+'_bars').off ( );
                $('a#'+this.cid+'_lines').off ( );
                $('a#'+this.cid+'_log').off ( );
                super_remove_controls.call ( this );
            };

            this.addControls ( );
        };

        inherit ( cls, Chart );
        cls.getName = function ( ) { return 'volcurr'; };
        cls.getTitle = function ( ) { return 'Volume (USD)'; };
        return cls;
    } ) ( );


    /*
     * Chart of Relative Volume
     */
    var ChartVolumeRelative = ( function ( )
    {
        var cls = function ( cid )
        {
            this.constructor['super'].call ( this, cid, 'cv', false );

            this.dataset = [ ];

            this.chart_options = {
                canvas: true,
                tooltip: true,
                tooltipOpts: { content: '%y.2 %<br/> %x', xDateFormat: '%d-%b-%Y %H:%M:%S' },
                series: { stack:true },
                legend: { position:'nw', margin:0, backgroundOpacity:0.5, backgroundColor:color_chart_legend_bg },
                grid: { hoverable:true, borderWidth:'0' },
                bars: { show:true, align:'left' },
                lines: { show:true },
                xaxis: { mode: 'time', timezone:'browser', timeformat:'%H:%M:%S', font:{color:color_chart_axis_text},
                         color:color_chart_axis, autoscaleMargin:automargin, ticks:null },
                yaxis: { font:{color:color_chart_axis_text}, labelWidth:lbl_width, min:0, max:100.1, tickDecimals:1,
                         yaxis:yaxis_position, tickFormatter:formatTickUnsignedPercent, color:color_chart_axis }
            };

            /* style */
            this.bars = false;

            this.setStyle = function ( style )
            {
                if ( style == 'bars' )
                    this.bars = true;
                else
                    this.bars = false;

                this.updateControls ( );
                this.update ( true );
                saveConfig ( );
            };

            /* configuration */
            var super_set_config = this.setConfig;
            this.setConfig = function ( conf )
            {
                if ( conf.hasOwnProperty('bars') )
                    this.bars = conf.bars;

                super_set_config.call ( this, conf ); /* called last to update controls */
            };

            var super_get_config = this.getConfig;
            this.getConfig = function ( )
            {
                var conf = super_get_config.call ( this );
                conf['bars'] = this.bars;
                return conf;
            };

            /* update chart */
            var super_update = this.update;
            this.update = function ( replot )
            {
                this.dataset = [ ];
                this.chart_options.xaxis.timeformat = this.getTimeFormat ( );

                var nb_exchanges = this.exchanges.length;
                this.chart_options.legend.noColumns = nb_exchanges;

                if ( this.bars )
                    this.chart_options.bars.barWidth = (this.nbmsecs / this.nbpoints) * 0.25;

                this.chart_options.bars.show = this.bars;
                this.chart_options.lines.show = !this.bars;

                if ( this.getMode() != 's' )
                {
                    if ( this.bars )
                    {
                        for ( var i=0; i<nb_exchanges; ++i )
                        {
                            var e = this.exchanges[i];
                            this.dataset.push ( { data:e.volumerel, label:e.name, color:colors_chart_volume[e.id],
                                                  tooltipFormat:(e.name+'<br />%y.2 %<br/> %x') } );
                        }
                    }
                    else
                    {
                        var e = this.exchanges[0];
                        this.dataset.push ( { data:e.volumerel, label:e.name, color:colors_chart_volume[e.id], id:'0', fillBelowTo:'zero',
                                              tooltipFormat:(e.name+' %y.2 %<br/> %x'), lines:{lineWidth:1} } );
                        for ( var i=1; i<nb_exchanges; ++i )
                        {
                            var e = this.exchanges[i];
                            this.dataset.push ( { data:e.volumerel, label:e.name, color:colors_chart_volume[e.id], id:i.toString(), fillBelowTo:(i-1).toString(),
                                                  tooltipFormat:(e.name+' %y.2 %<br/> %x'), lines:{lineWidth:1} } );
                        }
                    }
                }

                super_update.call ( this, replot );
            };

            /* plot multiple exchanges */
            this.plot_multiple = function ( )
            {
                $.plot ( this.cdiv, this.dataset, this.chart_options );
            };

            this.plot_single = function ( ) { /* disabled */ };

            /* addControls */
            var super_add_controls = this.addControls;
            this.addControls = function ( )
            {
                super_add_controls.call ( this );

                var ins = '';
                ins += '<span id="'+this.cid+'_style"> | &nbsp;';
                ins += 'lines <a id="'+this.cid+'_lines" href="#"><img class="btn" id="btn_'+this.cid+'_lines" src="'+ui_img_toggle_enabled+'"></a> ' +
                       'bars <a id="'+this.cid+'_bars" href="#"><img class="btn" id="btn_'+this.cid+'_bars" src="'+ui_img_toggle_disabled+'" /></a>';
                ins += '</span>';
                $(this.tspan).append ( ins );

                var self = this;
                $('a#'+this.cid+'_lines').on ( 'click', function(e) { e.preventDefault(); self.setStyle('lines'); } );
                $('a#'+this.cid+'_bars').on ( 'click', function(e) { e.preventDefault(); self.setStyle('bars'); } );

                this.updateControls ( );
            };

            /* updateControls */
            var super_update_controls = this.updateControls;
            this.updateControls = function ( )
            {
                super_update_controls.call ( this );

                if ( this.bars )
                {
                    $('img#btn_'+this.cid+'_bars').attr ( 'src', ui_img_toggle_enabled );
                    $('img#btn_'+this.cid+'_lines').attr ( 'src', ui_img_toggle_disabled );
                }
                else
                {
                    $('img#btn_'+this.cid+'_bars').attr ( 'src', ui_img_toggle_disabled );
                    $('img#btn_'+this.cid+'_lines').attr ( 'src', ui_img_toggle_enabled );
                }
            };

            /* removeControls */
            var super_remove_controls = this.removeControls;
            this.removeControls = function ( )
            {
                $('a#'+this.cid+'_bars').off ( );
                $('a#'+this.cid+'_lines').off ( );
                super_remove_controls.call ( this );
            };

            this.addControls ( );
        };

        inherit ( cls, Chart );
        cls.getName = function ( ) { return 'volumerel'; };
        cls.getTitle = function ( ) { return 'Volume (relative)'; };
        return cls;
    } ) ( );


    /*
     * Chart of Nb of Trades
     */
    var ChartNbTrades = ( function ( )
    {
        var cls = function ( cid )
        {
            this.constructor['super'].call ( this, cid, 'sc', true );

            this.dataset = [ ];

            this.chart_options = {
                canvas: true,
                tooltip: true,
                tooltipOpts: { content: '%y.2 trades<br/> %x', xDateFormat: '%d-%b-%Y %H:%M:%S' },
                series: { stack:true },
                legend: { position:'nw', margin:0, backgroundOpacity:0.5, backgroundColor:color_chart_legend_bg },
                grid: { hoverable:true, borderWidth:'0' },
                bars: { show:true, align:'left' },
                lines: { show:true },
                xaxis: { mode: 'time', timezone:'browser', timeformat:'%H:%M:%S', font:{color:color_chart_axis_text},
                         color:color_chart_axis, autoscaleMargin:automargin, ticks:null },
                yaxis: { font:{color:color_chart_axis_text}, labelWidth:lbl_width, min:0, tickFormatter:formatTickUnit, yaxis:yaxis_position, color:color_chart_axis }
            };

            /* style */
            this.bars = false;

            this.setStyle = function ( style )
            {
                if ( style == 'bars' )
                    this.bars = true;
                else
                    this.bars = false;

                this.updateControls ( );
                this.update ( true );
                saveConfig ( );
            };

            /* logarithmic display */
            this.log = false;

            this.toggleLog = function ( )
            {
                this.log = !this.log;
                this.updateControls ( );
                this.update ( true );
                saveConfig ( );
            };

            /* configuration */
            var super_set_config = this.setConfig;
            this.setConfig = function ( conf )
            {
                if ( conf.hasOwnProperty('bars') )
                    this.bars = conf.bars;

                if ( conf.hasOwnProperty('log') )
                    this.log = conf.log;

                super_set_config.call ( this, conf ); /* called last to update controls */
            };

            var super_get_config = this.getConfig;
            this.getConfig = function ( )
            {
                var conf = super_get_config.call ( this );
                conf['bars'] = this.bars;
                conf['log'] = this.log;
                return conf;
            };

            /* update chart */
            var super_update = this.update;
            this.update = function ( replot )
            {
                this.dataset = [ ];
                this.chart_options.xaxis.timeformat = this.getTimeFormat ( );

                if ( this.bars )
                    this.chart_options.bars.barWidth = (this.nbmsecs / this.nbpoints) * 0.3;

                this.chart_options.bars.show = this.bars;
                this.chart_options.lines.show = !this.bars;

                if ( this.log )
                {
                    this.chart_options.yaxis.transform = function (v) { if(v<1)return 0; return Math.log(v) / Math.LN10; };
                    this.chart_options.yaxis.inverseTransform = function (v) { if(v==0)return 0; return Math.exp(v*Math.LN10); };
                }
                else
                {
                    this.chart_options.yaxis.transform = null;
                    this.chart_options.yaxis.inverseTransform = null;
                    this.chart_options.yaxis.ticks = null;
                    this.chart_options.yaxis.min = 0;
                }

                var nb_exchanges = this.exchanges.length;
                this.chart_options.legend.noColumns = nb_exchanges;

                if ( this.getMode() != 's' )
                {
                    if ( this.bars )
                    {
                        if ( this.merged )
                            this.dataset.push ( { data:exchanges_merged.nb_trades, label:'merged nb. trades', color:color_chart_volume,
                                                  tooltipFormat:'%y trades<br/> %x' } );
                        else
                        {
                            for ( var i=0; i<nb_exchanges; ++i )
                            {
                                var e = this.exchanges[i];
                                this.dataset.push ( { data:e.nb_trades_synced, label:e.name, color:colors_chart_volume[e.id],
                                                      tooltipFormat:(e.name+'<br />%y trades<br/> %x') } );
                            }
                        }
                    }
                    else
                    {
                        if ( this.merged )
                            this.dataset.push ( { data:exchanges_merged.nb_trades, label:'merged nb. trades', color:color_chart_volume, id:'0',
                                                  fillBelowTo:'zero', tooltipFormat:'%y trades<br/> %x', lines:{lineWidth:1} } );
                        else
                        {
                            var e = this.exchanges[0];
                            this.dataset.push ( { data:e.nb_trades_synced, label:e.name, color:colors_chart_volume[e.id], id:'0',
                                                  fillBelowTo:'zero', tooltipFormat:(e.name+'<br />%y trades<br/> %x'), lines:{lineWidth:1} } );

                            for ( var i=1; i<nb_exchanges; ++i )
                            {
                                e = this.exchanges[i];
                                this.dataset.push ( { data:e.nb_trades_synced, label:e.name, color:colors_chart_volume[e.id], id:i.toString(),
                                                      fillBelowTo:(i-1).toString(), tooltipFormat:(e.name+'<br />%y trades<br/> %x'), lines:{lineWidth:1} } );
                            }
                        }
                    }
                }

                super_update.call ( this, replot );
            };

            /* plot a single exchange */
            this.plot_single = function ( )
            {
                var e = this.exchanges[0];
                var plots = [ ];

                if ( this.bars )
                    plots.push ( { data:e.nb_trades, label:'nb. trades', color:color_chart_volume } );
                else
                    plots.push ( { data:e.nb_trades, label:'nb. trades', color:color_chart_volume, id:'0', fillBelowTo:'zero' } );

                if ( this.log )
                {
                    this.chart_options.yaxis.ticks = this.computeLogTicks ( plots, false );
                    this.chart_options.yaxis.min = this.chart_options.yaxis.ticks[0];
                }

                $.plot ( this.cdiv, plots, this.chart_options );
            };

            /* plot multiple exchanges */
            this.plot_multiple = function ( )
            {
                if ( this.log )
                {
                    this.chart_options.yaxis.ticks = this.computeLogTicks ( this.dataset, true );
                    this.chart_options.yaxis.min = this.chart_options.yaxis.ticks[0];
                }

                $.plot ( this.cdiv, this.dataset, this.chart_options );
            };

            /* addControls */
            var super_add_controls = this.addControls;
            this.addControls = function ( )
            {
                super_add_controls.call ( this );

                var ins = '';
                ins += '<span id="'+this.cid+'_style"> | &nbsp;';
                ins += 'lines <a id="'+this.cid+'_lines" href="#"><img class="btn" id="btn_'+this.cid+'_lines" src="'+ui_img_toggle_enabled+'"></a> ' +
                       'bars <a id="'+this.cid+'_bars" href="#"><img class="btn" id="btn_'+this.cid+'_bars" src="'+ui_img_toggle_disabled+'" /></a>';
                ins += '</span>';
                ins +=  ' | &nbsp;';
                ins += 'log <a id="'+this.cid+'_log" href="#"><img class="btn" id="btn_'+this.cid+'_log" src="'+ui_img_button_enabled+'" alt="off"/></a> ';
                $(this.tspan).append ( ins );

                var self = this;
                $('a#'+this.cid+'_lines').on ( 'click', function(e) { e.preventDefault(); self.setStyle('lines'); } );
                $('a#'+this.cid+'_bars').on ( 'click', function(e) { e.preventDefault(); self.setStyle('bars'); } );
                $('a#'+this.cid+'_log').on ( 'click', function(e) { e.preventDefault(); self.toggleLog(); } );

                this.updateControls ( );
            };

            /* updateControls */
            var super_update_controls = this.updateControls;
            this.updateControls = function ( )
            {
                super_update_controls.call ( this );

                if ( this.bars )
                {
                    $('img#btn_'+this.cid+'_bars').attr ( 'src', ui_img_toggle_enabled );
                    $('img#btn_'+this.cid+'_lines').attr ( 'src', ui_img_toggle_disabled );
                }
                else
                {
                    $('img#btn_'+this.cid+'_bars').attr ( 'src', ui_img_toggle_disabled );
                    $('img#btn_'+this.cid+'_lines').attr ( 'src', ui_img_toggle_enabled );
                }

                if ( this.log )
                {
                    $('img#btn_'+this.cid+'_log').attr ( 'src', ui_img_button_enabled );
                    $('img#btn_'+this.cid+'_log').attr ( 'alt', 'off' );
                }
                else
                {
                    $('img#btn_'+this.cid+'_log').attr ( 'src', ui_img_button_disabled );
                    $('img#btn_'+this.cid+'_log').attr ( 'alt', 'on' );
                }
            };

            /* removeControls */
            var super_remove_controls = this.removeControls;
            this.removeControls = function ( )
            {
                $('a#'+this.cid+'_bars').off ( );
                $('a#'+this.cid+'_lines').off ( );
                $('a#'+this.cid+'_log').off ( );
                super_remove_controls.call ( this );
            };

            this.addControls ( );
        };

        inherit ( cls, Chart );
        cls.getName = function ( ) { return 'nbtrades'; };
        cls.getTitle = function ( ) { return 'Nb. of Trades'; };
        return cls;
    } ) ( );


    /*
     * Chart of Average Trade Size
     */
    var ChartAvgTradeSize = ( function ( )
    {
        var cls = function ( cid )
        {
            this.constructor['super'].call ( this, cid, 'sc', true );

            this.chart_options = { };
            this.dataset = [ ];

            /* update chart */
            var super_update = this.update;
            this.update = function ( replot )
            {
                this.chart_options = jQuery.extend ( true, {}, common_lines_options );
                this.chart_options.xaxis.timeformat = this.getTimeFormat ( );
                this.chart_options.yaxis.tickFormatter = null;
                this.chart_options.tooltipOpts.content = '%y.2 BTC<br/> %x';

                this.dataset = [ ];

                if ( this.getMode() == 'c' )
                {
                    for ( var i=0; i<this.exchanges.length; ++i )
                    {
                        var e = this.exchanges[i];
                        this.dataset.push ( { data:e.avg_trade_size,label:e.name, color:colors_chart_volume[e.id], /* todo: put specific color */
                                              tooltipFormat:(e.name+'<br />%y.2 BTC<br/> %x'), lines:{lineWidth:1} } );
                    }
                }

                super_update.call ( this, replot );
            };

            /* plot a single exchange */
            this.plot_single = function ( )
            {
                var e = this.exchanges[0];
                this.chart_options.legend.noColumns = 2;
                $.plot ( this.cdiv, [ {data:e.avg_trade_size,label:'average trade size', color:color_chart_volume, lines:{lineWidth:1.2}} ], this.chart_options );
            };

            /* plot multiple exchanges */
            this.plot_multiple = function ( )
            {
                if ( this.merged )
                {
                    this.plot_merged ( );
                    return;
                }

                this.chart_options.legend.noColumns = this.exchanges.length;
                $.plot ( this.cdiv, this.dataset, this.chart_options );
            };

            /* plot multiple exchanges merged */
            this.plot_merged = function ( )
            {
                this.chart_options.legend.noColumns = 1;
                var e = exchanges_merged;
                $.plot ( this.cdiv, [ {data:e.avg_trade_size,label:'average trade size', color:color_chart_volume, lines:{lineWidth:1.2}} ], this.chart_options );
            };

            this.addControls ( );
        };

        inherit ( cls, Chart );
        cls.getName = function ( ) { return 'avgtrade'; };
        cls.getTitle = function ( ) { return 'Average Trade Size'; };
        return cls;
    } ) ( );


    /*
     * Chart of the Order Book
     */
    var ChartBook = ( function ( )
    {
        var cls = function ( cid )
        {
            this.constructor['super'].call ( this, cid, 'sc', true );

            this.dataset = [ ];

            this.chart_options = {
                canvas: true,
                tooltip: true,
                tooltipOpts: { content: '%y.2 BTC booked at %x USD', xDateFormat: '%d-%b-%Y %H:%M:%S' },
                legend: { position:'nw', margin:0, noColumns:5, backgroundOpacity:0.5, backgroundColor:color_chart_legend_bg },
                grid: { hoverable:true, borderWidth:'0' },
                bars: { show:true, align:'center', barWidth:0.5 },
                lines: { show:false },
                xaxis: { font:{color:color_chart_axis_text}, color:color_chart_axis },
                yaxes: [ { font:{color:color_chart_axis_text}, labelWidth:lbl_width, tickDecimals:1,
                           alignTicksWithAxis:1, color:color_chart_axis, position:'left', tickFormatter:formatTickUnit },
                         { font:{color:color_chart_axis_text}, labelWidth:lbl_width, tickDecimals:1,
                           alignTicksWithAxis:1, position:'right', color:color_chart_axis } ]
            };

            /* zooming */
            this.zoom_factor = 1.1;
            this.zoom_icon_in = '/coinorama/static/btn-zoom.png';
            this.zoom_icon_out = '/coinorama/static/btn-unzoom.png';
            this.zoom_icon_reset = '/coinorama/static/btn-zoom-reset.png';

            this.zoomBook = function ( factor )
            {
                this.zoom_factor *= factor;
                this.update ( true );
                saveConfig ( );
            };

            this.zoomBookReset = function ( )
            {
                this.zoom_factor = 1.1;
                this.update ( true );
                saveConfig ( );
            };

            /* accumulation */
            this.accumulated = true;
            this.accum_icon_off = '/coinorama/static/btn-book-bars.png';
            this.accum_icon_on = '/coinorama/static/btn-book-cumul.png';

            this.toggleAccumulation = function ( )
            {
                this.accumulated = !this.accumulated;
                this.updateControls ( );
                this.update ( true );
                saveConfig ( );
            };

            /* configuration */
            var super_set_config = this.setConfig;
            this.setConfig = function ( conf )
            {
                if ( conf.hasOwnProperty('zoom') )
                {
                    this.zoom_factor = conf.zoom;
                    if ( ( this.zoom_factor == Number.NaN ) || ( this.zoom_factor < 0 ) )
                        this.zoom_factor = 1.1;
                }

                if ( conf.hasOwnProperty('accum') )
                    this.accumulated = conf.accum;

                super_set_config.call ( this, conf ); /* called last to update controls */
            };

            var super_get_config = this.getConfig;
            this.getConfig = function ( )
            {
                var conf = super_get_config.call ( this );
                conf['zoom'] = this.zoom_factor;
                conf['accum'] = this.accumulated;
                return conf;
            };

            /* update chart */
            var super_update = this.update;
            this.update = function ( replot )
            {
                this.dataset = [ ];

                if ( this.exchanges.length == 0 )
                    return;

                /* center order book (done first, because we need xaxis min and max) */
                var book_center_price = 0;

                for ( var i=0; i<this.exchanges.length; ++i )
                {
                    var e = this.exchanges[i];
                    book_center_price += e.prices[e.prices.length-1][1];
                }

                book_center_price /= this.exchanges.length;

                var xmin = Math.min ( book_center_price-2, Math.max ( 20, book_center_price / this.zoom_factor ) );
                this.chart_options.xaxis.min = xmin; /* center x-axis */
                this.chart_options.xaxis.max = book_center_price + (book_center_price - xmin);

                /* compute price line to be added to chart when accum==false */
                if ( this.getMode() == 's' )
                {
                    var e = this.exchanges[0];
                    var book_prices_precision = 60000;
                    e.book_prices_time = (e.prices[e.prices.length-1][0]-e.prices[0][0]) / book_prices_precision;
                    if ( e.book_prices_time >= 100 )
                    {
                        if ( e.book_prices_time < 1500 )
                            book_prices_precision = 60*60*1000;
                        else
                            book_prices_precision = 60*60*24*1000;
                    }

                    e.book_accum_prices = [ ];
                    for ( var i=0; i<e.prices.length; ++i )
                        e.book_accum_prices[i] = [ e.prices[i][1], (e.prices[e.prices.length-1][0]-e.prices[i][0])/book_prices_precision ];

                    this.chart_options.yaxes[0].position = 'left';
                }
                else
                    this.chart_options.yaxes[0].position = yaxis_position;

                /* prepare data series */
                var maxbookY = 0;

                for ( var i=0; i<this.exchanges.length; ++i )
                {
                    var e = this.exchanges[i];

                    /* perform accumulation and compute max */
                    e.book_bids_accum = [ ];
                    e.book_asks_accum = [ ];
                    var accum_vol = 0;
                    var accum_maxbookY = 0;

                    for ( var j=0; j<e.book_bids.length; ++j )
                    {
                        accum_vol += e.book_bids[j][1];

                        if ( e.book_bids[j][0] > this.chart_options.xaxis.min )
                            maxbookY = Math.max ( maxbookY, e.book_bids[j][1] );
                        else
                        {
                            accum_maxbookY = Math.max ( accum_maxbookY, accum_vol );
                            break;
                        }

                        e.book_bids_accum.push ( [ e.book_bids[j][0], accum_vol ] );
                    }
                    accum_vol = 0;
                    for ( var j=0; j<e.book_asks.length; ++j )
                    {
                        accum_vol += e.book_asks[j][1];

                        if ( e.book_asks[j][0] < this.chart_options.xaxis.max )
                            maxbookY = Math.max ( maxbookY, e.book_asks[j][1] );
                        else
                        {
                            accum_maxbookY = Math.max ( accum_maxbookY, accum_vol );
                            break;
                        }

                        e.book_asks_accum.push ( [ e.book_asks[j][0], accum_vol ] );
                    }

                    if ( ( this.getMode() != 's' ) || this.accumulated )
                        maxbookY = Math.max ( maxbookY, accum_maxbookY );

                    /* first pass of data pushing */
                    if ( this.getMode() != 's' )
                        this.dataset.push ( { data:e.book_bids_accum,label:(e.name+' bids'),color:colors_chart_book[e.id][0],yaxis:1,
                                              tooltipFormat:(e.name+' bids<br />%y.2 BTC<br />booked above %x.1 '+shown_currency), lines:{lineWidth:1} } );
                }

                this.chart_options.yaxes[0].max = maxbookY * 1.04;

                /* add book asks */
                for ( var i=0; i<this.exchanges.length; ++i )
                {
                    var e = this.exchanges[i];

                    /* second pass adding asks to preserve legend ordering */
                    if ( this.getMode() != 's' )
                        this.dataset.push ( { data:e.book_asks_accum,label:(e.name+' asks'),color:colors_chart_book[e.id][1],yaxis:1,
                                              tooltipFormat:(e.name+' asks<br />%y.2 BTC<br />booked below %x.1 '+shown_currency), lines:{lineWidth:1} } );
                }

                if ( this.merged && ( this.getMode() != 's' ) )
                {
                    var book_asks_group = this.exchanges[0].book_asks_accum.slice ( );
                    var book_bids_group = this.exchanges[0].book_bids_accum.slice ( );

                    this.dataset = [ ];
                    // var warn = 0;
                    var mergeIntoAccumBook = function ( accum, book, revert, limit )
                    {
                        var j = 0;
                        var k = 0;
                        var prev_accum = 0;
                        var book_accum = 0;
                        var book_grouped = [ ];

                        while ( ( j < accum.length ) && ( k < book.length ) )
                        {
                            if ( revert )
                            {
                                if ( book[k][0] < limit )
                                {
                                    k = book.length;
                                    break;
                                }
                            }
                            else if ( book[k][0] > limit )
                            {
                                k = book.length;
                                break;
                            }

                            if ( accum[j][0] == book[k][0] )
                            {
                                book_accum += book[k][1];
                                prev_accum = accum[j][1]+book_accum;
                                book_grouped.push ( [ accum[j][0], prev_accum ] );
                                ++j; ++k;
                            }
                            else
                            {
                                var cond = ( accum[j][0] < book[k][0] );
                                if ( revert )
                                    cond = !cond; /* we already tested equality, thus we can negate cond */

                                if ( cond )
                                {
                                    prev_accum = accum[j][1]+book_accum;
                                    book_grouped.push ( [ accum[j][0], prev_accum ] );
                                    ++j;
                                }
                                else
                                {
                                    book_accum += book[k][1];
                                    prev_accum += book[k][1];
                                    book_grouped.push ( [ book[k][0], prev_accum ] );
                                    ++k;
                                }
                            }
                        }

                        while ( j < accum.length )
                        {
                            book_grouped.push ( [ accum[j][0], accum[j][1]+book_accum ] );
                            ++j;
                        }

                        while ( k < book.length )
                        {
                            if ( revert )
                            {
                                if ( book[k][0] < limit )
                                    break;
                            }
                            else if ( book[k][0] > limit )
                                break;

                            prev_accum += book[k][1];
                            book_grouped.push ( [ book[k][0], prev_accum ] );
                            ++k;
                        }

                        /*
                        if ( !warn )
                        {
                            for ( var i=1; i<book_grouped.length; ++i )
                            {
                                if ( (book_grouped[i-1][1] - book_grouped[i][1]) > 0.00001 )
                                {
                                    console.debug ( 'invalid accum with j=' + j + '/' + accum.length + ' k=' + k + '/' + book.length + ' i=' + i + '/' + book_grouped.length );
                                    ++warn;
                                    break;
                                }
                            }
                        }
                        */

                        return book_grouped;
                    };

                    exch_names = this.exchanges[0].name;
                    for ( var i=1; i<this.exchanges.length; ++i )
                    {
                        exch_names = exch_names+', ' +this.exchanges[i].name;
                        book_asks_group = mergeIntoAccumBook ( book_asks_group, this.exchanges[i].book_asks, false, this.chart_options.xaxis.max );
                        book_bids_group = mergeIntoAccumBook ( book_bids_group, this.exchanges[i].book_bids, true, this.chart_options.xaxis.min );
                    }

                    var bookMax = Math.max ( book_asks_group[book_asks_group.length-1][1], book_bids_group[book_bids_group.length-1][1] );
                    this.chart_options.yaxes[0].max = bookMax * 1.04;
                    this.dataset.push ( { data:book_bids_group,label:'bids of '+exch_names,color:color_chart_bids,yaxis:1,
                                          tooltipFormat:('cumulated bids<br />%y.2 BTC<br />booked above %x.1 '+shown_currency), lines:{lineWidth:1} } );
                    this.dataset.push ( { data:book_asks_group,label:'asks of '+exch_names,color:color_chart_asks,yaxis:1,
                                          tooltipFormat:('cumulated asks<br />%y.2 BTC<br />booked below %x.1 '+shown_currency), lines:{lineWidth:1} } );
                }

                super_update.call ( this, replot );
            };

            /* plot a single exchange */
            this.plot_single = function ( )
            {
                var e = this.exchanges[0];
                var curr = getExchangeCurrency(e.name);

                if ( this.accumulated )
                {
                    this.chart_options.bars.show = false;
                    this.chart_options.lines.show = true;
                    this.chart_options.legend.noColumns = 3;


                    if ( e.book_prices_time < 100 )
                        book_accum_tooltip = '%y.2 minutes ago<br />%x.2 '+curr+'/BTC';
                    else if ( e.book_prices_time < 1500 )
                        book_accum_tooltip = '%y.2 hours ago<br />%x.2 '+curr+'/BTC';
                    else
                        book_accum_tooltip = '%y.2 days ago<br />%x.2 '+curr+'/BTC';

                    this.chart_options.yaxes[1].max = e.book_accum_prices[0][1] * 1.02;

                    $.plot ( this.cdiv,
                             [ { data:e.book_bids_accum,label:'bids',color:color_chart_bids,yaxis:1,tooltipFormat:'%y.2 BTC<br />booked above %x '+curr},
                               { data:e.book_asks_accum,label:'asks',color:color_chart_asks,yaxis:1,tooltipFormat:'%y.2 BTC<br />booked below %x '+curr},
                               { data:e.book_accum_prices,label:'price ('+curr+')',color:color_chart_price,yaxis:2,
                                 tooltipFormat:book_accum_tooltip,lines:{lineWidth:1} } ],
                             this.chart_options );
                }
                else
                {
                    this.chart_options.bars.show = true;
                    this.chart_options.lines.show = false;
                    this.chart_options.legend.noColumns = 2;

                    $.plot ( this.cdiv,
                             [ { data:e.book_bids,label:'bids',color:color_chart_bids,yaxis:1,tooltipFormat:'%y.2 BTC at %x '+curr+' for buying' },
                               { data:e.book_asks,label:'asks',color:color_chart_asks,yaxis:1,tooltipFormat:'%y.2 BTC at %x '+curr+' for selling' } ],
                             this.chart_options );
                }
            };

            /* plot multiple exchanges */
            this.plot_multiple = function ( )
            {
                this.chart_options.bars.show = false;
                this.chart_options.lines.show = true;
                this.chart_options.legend.noColumns = Math.max ( 2, this.exchanges.length );

                if ( this.merged )
                    this.chart_options.legend.noColumns = 1;

                $.plot ( this.cdiv, this.dataset, this.chart_options );
            };

            /* addControls */
            var super_add_controls = this.addControls;
            this.addControls = function ( )
            {
                super_add_controls.call ( this );
                var ins = ' | &nbsp;';
                ins += '<a id="'+this.cid+'_accum" href="#"><img class="btn" id="btn_'+this.cid+'_accum" src="'+this.accum_icon_off+'" alt="cumulative view"/></a>';
                ins += '<a id="'+this.cid+'_zoom" href="#"><img class="btn" src="'+this.zoom_icon_in+'" alt="zoom in"/></a> ';
                ins += '<a id="'+this.cid+'_zoom_reset" href="#"><img class="btn" src="'+this.zoom_icon_reset+'" alt="zoom reset"/></a> ';
                ins += '<a id="'+this.cid+'_unzoom" href="#"><img class="btn" src="'+this.zoom_icon_out+'" alt="zoom out"/></a>';
                $(this.tspan).append ( ins );

                var self = this;
                $('a#'+this.cid+'_accum').on ( 'click', function(e) { e.preventDefault(); self.toggleAccumulation(); } );
                $('a#'+this.cid+'_unzoom').on ( 'click', function(e) { e.preventDefault(); self.zoomBook(1.01); } );
                $('a#'+this.cid+'_zoom').on ( 'click', function(e) { e.preventDefault(); self.zoomBook(0.99); } );
                $('a#'+this.cid+'_zoom_reset').on ( 'click', function(e) { e.preventDefault(); self.zoomBookReset(); } );

                this.updateControls ( );
            };

            /* updateControls */
            var super_update_controls = this.updateControls;
            this.updateControls = function ( )
            {
                super_update_controls.call ( this );

                if ( this.getMode() != 's' )
                    $('a#'+this.cid+'_accum').hide ( );
                else
                {
                    $('a#'+this.cid+'_accum').show ( );

                    if ( this.accumulated )
                    {
                        $('img#btn_'+this.cid+'_accum').attr ( 'src', this.accum_icon_off );
                        $('img#btn_'+this.cid+'_accum').attr ( 'alt', 'bars view' );
                    }
                    else
                    {
                        $('img#btn_'+this.cid+'_accum').attr ( 'src', this.accum_icon_on );
                        $('img#btn_'+this.cid+'_accum').attr ( 'alt', 'cumulative view' );
                    }
                }
            };

            /* removeControls */
            var super_remove_controls = this.removeControls;
            this.removeControls = function ( )
            {
                $('a#'+this.cid+'_accum').off ( );
                $('a#'+this.cid+'_unzoom').off ( );
                $('a#'+this.cid+'_zoom').off ( );
                $('a#'+this.cid+'_zoom_reset').off ( );
                super_remove_controls.call ( this );
            };

            this.addControls ( );
        };

        inherit ( cls, Chart );
        cls.getName = function ( ) { return 'book'; };
        cls.getTitle = function ( ) { return 'Order Book'; };
        return cls;
    } ) ( );


    /*
     * Chart of the spread (top bid and top ask)
     */
    var ChartSpread = ( function ( )
    {
        var cls = function ( cid )
        {
            this.constructor['super'].call ( this, cid, 'sc', false );

            this.dataset = [ ];
            this.chart_options = { };

            /* subtraction */
            this.subtract = false;

            this.toggleSubtract = function ( )
            {
                this.subtract = !this.subtract;
                this.updateControls ( );
                this.update ( true );
                saveConfig ( );
            };

            /* configuration */
            var super_set_config = this.setConfig;
            this.setConfig = function ( conf )
            {
                if ( conf.hasOwnProperty('subtract') )
                    this.subtract = conf.subtract;

                super_set_config.call ( this, conf ); /* called last to update controls */
            };

            var super_get_config = this.getConfig;
            this.getConfig = function ( )
            {
                var conf = super_get_config.call ( this );
                conf['subtract'] = this.subtract;
                return conf;
            };

            /* update chart */
            var super_update = this.update;
            this.update = function ( replot )
            {
                this.dataset = [ ];

                if ( this.exchanges.length == 0 )
                    return;

                this.chart_options = jQuery.extend ( true, {}, common_lines_options );
                this.chart_options.xaxis.timeformat = this.getTimeFormat ( );

                if ( this.subtract )
                {
                    if ( this.getMode() != 's' )
                    {
                        for ( var i=0; i<this.exchanges.length; ++i )
                        {
                            var e = this.exchanges[i];
                            var e_spread_sub = [ ];

                            for ( var j in e.top_bid )
                                e_spread_sub.push ( [e.top_bid[j][0], (e.top_ask[j][1]-e.top_bid[j][1])] );

                            this.dataset.push ( { data:e_spread_sub,label:e.name, color:colors_chart_book[e.id][1],
                                                  tooltipFormat:(e.name+'<br />ask - bid = %y.3 '+shown_currency+'<br/> %x'), lines:{lineWidth:1} } );
                        }
                    }
                    else
                    {
                        var e = this.exchanges[0];
                        for ( var j in e.top_bid )
                            this.dataset.push ( [e.top_bid[j][0], (e.top_ask[j][1]-e.top_bid[j][1])] );
                    }
                }
                else if ( this.getMode() != 's' )
                {
                    /* first pass : bids */
                    for ( var i=0; i<this.exchanges.length; ++i )
                    {
                        var e = this.exchanges[i];
                        this.dataset.push ( { data:e.top_bid, label:e.name+' bid',color:colors_chart_book[e.id][0],
                                              tooltipFormat:(e.name+' bid<br />%y.3 '+shown_currency+'<br/> %x'), lines:{lineWidth:1} } );
                    }

                    /* second pass : asks (in order to preserve legend ordering) */
                    for ( var i=0; i<this.exchanges.length; ++i )
                    {
                        var e = this.exchanges[i];
                        if ( this.getMode() != 's' )
                            this.dataset.push ( { data:e.top_ask, label:e.name+' ask',color:colors_chart_book[e.id][1],
                                                  tooltipFormat:(e.name+' ask<br />%y.3 '+shown_currency+'<br/> %x'), lines:{lineWidth:1} } );
                    }
                }

                super_update.call ( this, replot );
            };

            /* plot a single exchange */
            this.plot_single = function ( )
            {
                var e = this.exchanges[0];
                var curr = getExchangeCurrency(e.name);

                /* booktop plot */
                if ( this.subtract )
                {
                    this.chart_options.legend.noColumns = 1;
                    this.chart_options.tooltipOpts.content = 'ask - bid = %y.3 '+curr+'<br/> %x';
                    this.chart_options.yaxis.min = 0;
                    $.plot ( this.cdiv, [ { data:this.dataset, label:'ask - bid',color:color_chart_asks } ], this.chart_options );
                }
                else
                {
                    this.chart_options.legend.noColumns = 2;
                    this.chart_options.tooltipOpts.content = '%y.3 '+curr+'<br/> %x';
                    $.plot ( this.cdiv, [ { data:e.top_ask, label:'ask',color:color_chart_bids, lines:{lineWidth:1} },
                                          { data:e.top_bid, label:'bid',color:color_chart_asks, lines:{lineWidth:1} } ],
                             this.chart_options);
                }
            };

            /* plot multiple exchanges */
            this.plot_multiple = function ( )
            {
                this.chart_options.yaxis.tickFormatter = null;
                this.chart_options.legend.noColumns = Math.max ( 2, this.exchanges.length );
                if ( this.subtract )
                    this.chart_options.yaxis.min = 0;
                $.plot ( this.cdiv, this.dataset, this.chart_options );
            };

            /* addControls */
            var super_add_controls = this.addControls;
            this.addControls = function ( )
            {
                super_add_controls.call ( this );
                var ins = ' | &nbsp;';
                ins += 'subtract <a id="'+this.cid+'_sub" href="#"><img class="btn" id="btn_'+this.cid+'_sub" src="'+ui_img_button_enabled+'" alt="off"/></a> ';
                $(this.tspan).append ( ins );

                var self = this;
                $('a#'+this.cid+'_sub').on ( 'click', function(e) { e.preventDefault(); self.toggleSubtract(); } );

                this.updateControls ( );
            };

            /* updateControls */
            var super_update_controls = this.updateControls;
            this.updateControls = function ( )
            {
                super_update_controls.call ( this );

                if ( this.subtract )
                {
                    $('img#btn_'+this.cid+'_sub').attr ( 'src', ui_img_button_enabled );
                    $('img#btn_'+this.cid+'_sub').attr ( 'alt', 'off' );
                }
                else
                {
                    $('img#btn_'+this.cid+'_sub').attr ( 'src', ui_img_button_disabled );
                    $('img#btn_'+this.cid+'_sub').attr ( 'alt', 'on' );
                }
            };

            /* removeControls */
            var super_remove_controls = this.removeControls;
            this.removeControls = function ( )
            {
                $('a#'+this.cid+'_sub').off ( );
                super_remove_controls.call ( this );
            };

            this.addControls ( );
        };

        inherit ( cls, Chart );
        cls.getName = function ( ) { return 'spread'; };
        cls.getTitle = function ( ) { return 'Spread'; };
        return cls;
    } ) ( );


    /*
     * Chart of Lag
     */
    var ChartLag = ( function ( )
    {
        var cls = function ( cid )
        {
            this.constructor['super'].call ( this, cid, 'sc', true );

            this.chart_options = { };
            this.dataset = [ ];

            /* update chart */
            var super_update = this.update;
            this.update = function ( replot )
            {
                this.chart_options = jQuery.extend ( true, {}, common_lines_options );
                this.chart_options.xaxis.timeformat = this.getTimeFormat ( );

                this.dataset = [ ];

                if ( this.getMode() == 'c' )
                {
                    for ( var i=0; i<this.exchanges.length; ++i )
                    {
                        var e = this.exchanges[i];
                        this.dataset.push ( { data:e.lag,label:e.name, color:colors_chart_lag[e.id],
                                              tooltipFormat:(e.name+'<br />%y.2 seconds<br/> %x'), lines:{lineWidth:1} } );
                    }
                }

                super_update.call ( this, replot );
            };

            /* plot a single exchange */
            this.plot_single = function ( )
            {
                var e = this.exchanges[0];
                this.chart_options.legend.noColumns = 2;
                this.chart_options.yaxis.tickFormatter = null;
                this.chart_options.tooltipOpts.content = '%y.2 seconds<br/> %x';
                $.plot ( this.cdiv, [ {data:e.lag,label:'lag (s)', color:color_chart_lag, lines:{lineWidth:1.2}} ], this.chart_options );
            };

            /* plot multiple exchanges */
            this.plot_multiple = function ( )
            {
                if ( this.merged )
                {
                    this.plot_merged ( );
                    return;
                }

                this.chart_options.legend.noColumns = this.exchanges.length;
                this.chart_options.yaxis.tickFormatter = null;
                this.chart_options.tooltipOpts.content = '%y.2 seconds<br/> %x';
                $.plot ( this.cdiv, this.dataset, this.chart_options );
            };

            /* plot multiple exchanges merged */
            this.plot_merged = function ( )
            {
                this.chart_options.legend.noColumns = 1;
                var e = exchanges_merged;
                this.chart_options.yaxis.tickFormatter = null;
                this.chart_options.tooltipOpts.content = '%y.2 seconds<br/> %x';
                $.plot ( this.cdiv, [ {data:e.lag,label:'merged lag (s)', color:color_chart_lag, lines:{lineWidth:1.2}} ], this.chart_options );
            };

            this.addControls ( );
        };

        inherit ( cls, Chart );
        cls.getName = function ( ) { return 'lag'; };
        cls.getTitle = function ( ) { return 'Lag (seconds)'; };
        return cls;
    } ) ( );


    function plotData ( exchanges )
    {
        /* compute time period and nb data points */
        var nbpoints = 0;
        var nbmsecs = 0;

        for ( var i=0; i<exchanges.length; ++i )
        {
            e = exchanges[i];

            nbmsecs = Math.max ( nbmsecs, e.prices[e.prices.length-1][0] - e.prices[0][0] );
            nbpoints = Math.max ( nbpoints, e.prices.length );
        }

        for ( cid in charts )
            charts[cid].prepare ( exchanges, nbmsecs, nbpoints );

        for ( cid in charts )
            charts[cid].plot ( );
    }


    /*
     * updateDisplay
     */
    function updateDisplay ( )
    {
        synchronizeData ( exchangesData );
        plotData ( exchangesData );
    }

    function onFetchSuccess ( data )
    {
        nb_fetch_errors = 0;
        timeout_id = setTimeout ( fetchData, 10000 );

        if ( fetchFull )
        {
            /* full dataset requested but it's not it, bail out */
            if ( data.f != 1 )
                return;

            /* the full dataset was fetched, overwrite exchanges data with it */
            exchangesData = readData ( data.data );
            fetchFull = false;
        }
        else if ( data.f == 0 )
        {
            /* only the two most recent lines were fetched, use them to update exchangesData */
            var new_data = data.data;
            for ( var i=0; i<new_data.length; ++i )
                exchangeUpdateData ( exchangesData[i], new_data[i].stats, new_data[i].book );
        }

        for ( var i=0; i<exchangesData.length; ++i )
            exchangesData[i].volume_1d = data.ticks[exchangesData[i].name].volume;

        /* ticks update is done first because the ticker's content affects the markets page width */
        coinorama_ticks_updateMarkets ( data.ticks, config.mode, config.exch, shown_exchanges );
        updateDisplay ( );
    }

    function onFetchError ( qid, text, error )
    {
        nb_fetch_errors += 1;

        if ( nb_fetch_errors > 3 )
        {
            $('span#winmsg_title').text ( 'Error' );
            $('div#winmsg_ctnt').html ( 'Sorry, latest markets data could not be fetched.<br/>The service is being upgraded/rebooted,' +
                                        ' or it crashed.<br/>Please reload the page in a couple of minutes.<br/><br/>' );
            windowShow ( 'message' );
        }

        timeout_id = setTimeout ( fetchData, 10000 );
    }

    function fetchData ( )
    {
        var params = [ ];
        var data_url = '/coinorama/data.cf';
        var now = (new Date ()).getTime();

        if ( config.mode != 's' )
        {
            /* autoswitch to single mode */
            if ( nb_shown_exchanges == 1 )
                params.push ( 'e=' + getShownExchangesUIDs() );
            else
            {
                params.push ( 'm=' + config.mode );
                params.push ( 'E=' + getShownExchangesUIDs() );
            }
        }
        else /* single mode only, exchange parameter */
            params.push ( 'e=' + exchanges_uid[config.exch] );

        params.push ( 'v=' + config.view );

        if ( fetchBook ) /* fetch the book this time, but not next time */
        {
            params.push ( 'b=1' );
            fetchBook = false;
            book_timestamp = now;
        }
        else
        {
            if ( (now-book_timestamp) > 30000 )
                fetchBook = true; /* next time, fetch the book */
        }

        /* fetch full history if required */
        if ( fetchFull )
            params.push ( 'f=1' );

        /* no tick-only */
        params.push ( 'k=0' );

        if ( params.length > 0 )
            data_url = data_url + '?' + params.join('&');

        $.ajax ( { url:data_url, type:'GET', dataType:'json', success:onFetchSuccess, error:onFetchError } );
    }


    /* user configuration callbacks */

    function updateCurrencyDisplay ( cur )
    {
        if ( config.curr[cur] )
        {
            $('a#cur_'+cur+'_display').html ( '[-]' );

            for ( var j in exchanges_by_currency[cur] )
                $('td#exch_'+exchanges_by_currency[cur][j].name).show ( );
        }
        else
        {
            $('a#cur_'+cur+'_display').html ( '[+]' );

            for ( var j in exchanges_by_currency[cur] )
            {
                var einfo = exchanges_by_currency[cur][j];
                if ( !shown_exchanges[einfo.name] && ( config.exch != einfo.name ) )
                    $('td#exch_'+einfo.name).hide ( );
                else
                    $('td#exch_'+einfo.name).show ( );
            }
        }
    }

    function toggleCurrencyDisplay ( cur )
    {
        config.curr[cur] = !config.curr[cur];
        updateCurrencyDisplay ( cur );
        saveConfig ( );
    }

    function toggleChartLocation ( cid, val )
    {
        if ( timeout_id != -1 )
            clearTimeout ( timeout_id );

        var expanded = charts[cid].expanded;
        var shown = charts[cid].shown;

        charts[cid].destroy ( );
        charts[cid] = new charts_types[val] ( cid );
        charts[cid].setConfig ( { show:shown, expand:expanded } );

        updateDisplay ( );
        timeout_id = setTimeout ( fetchData, 2000 );
        saveConfig ( );
    }

    function selectMode ( v )
    {
        if ( timeout_id != -1 )
            clearTimeout ( timeout_id );

        config.mode = v;

        if ( config.mode == 's' ) /* single */
        {
            $('a#mode_multi').css ( 'color', color_item_disabled );
            $('a#mode_single').css ( 'color', color_item_enabled );

            for ( e in exchanges_uid )
            {
                var elem = $('a#exch_'+e);
                elem.css ( 'color', color_item_disabled );
            }

            var elem = $('a#exch_'+config.exch);
            elem.css ( 'color', color_item_enabled );

            shown_currency = getExchangeCurrency ( config.exch );
        }
        else
        {
            shown_currency = detectShownCurrency ( shown_exchanges );

            if ( config.mode == 'c' ) /* multi */
            {
                $('a#mode_single').css ( 'color', color_item_disabled );
                $('a#mode_multi').css ( 'color', color_item_enabled );
            }

            for ( e in exchanges_uid )
            {
                var elem = $('a#exch_'+e);
                if ( shown_exchanges[e] )
                    elem.css ( 'color', color_item_enabled );
                else
                    elem.css ( 'color', color_item_disabled );
            }
        }

        $('option#chart_type_price').text ( 'Price (' + shown_currency + ')' );
        $('option#chart_type_volcurr').text ( 'Volume (' + shown_currency + ')' );

        for ( cid in charts )
            charts[cid].modeChanged ( );

        fetchFull = true;
        fetchBook = true;
        fetchData ( );
        saveConfig ( );
     }

    function selectCurrency ( currname )
    {
        if ( timeout_id != -1 )
            clearTimeout ( timeout_id );

        if ( config.mode == 's' )
        {
            for ( var e in exchanges_uid )
            {
                if ( getExchangeCurrency(e) == currname )
                {
                    selectExchange ( e );
                    break;
                }
            }
        }
        else
        {
            nb_shown_exchanges = 0;
            config.exch_multi = 0;

            for ( var e in exchanges_uid )
            {
                shown_exchanges[e] = false;
                $('a#exch_'+e).css ( 'color', color_item_disabled );
            }

            for ( var e in exchanges_uid )
            {
                if ( getExchangeCurrency(e) == currname )
                {
                    shown_exchanges[e] = true;
                    config.exch_multi += exchanges_uid[e];
                    $('a#exch_'+e).css ( 'color', color_item_enabled );
                    ++nb_shown_exchanges;
                }

                if ( nb_shown_exchanges > 4 )
                    break;
            }
        }

        if ( !config.curr[currname] )
            toggleCurrencyDisplay ( currname );

        shown_currency = currname;
        $('option#chart_type_price').text ( 'Price (' + shown_currency + ')' );
        $('option#chart_type_volcurr').text ( 'Volume (' + shown_currency + ')' );
        previous_price = 0;

        fetchFull = true;
        fetchBook = true;
        fetchData ( );
        saveConfig ( );
    }

    function selectExchange ( exchname )
    {
        if ( timeout_id != -1 )
            clearTimeout ( timeout_id );

        if ( config.mode == 's' )
        {
            for ( e in exchanges_uid )
            {
                var elem_off = $('a#exch_'+e);
                elem_off.css ( 'color', color_item_disabled );
            }

            config.exch = exchname;
            shown_currency = getExchangeCurrency ( config.exch );

            var elem = $('a#exch_'+exchname);
            elem.css ( 'color', color_item_enabled );
        }
        else
        {
            if ( ( nb_shown_exchanges > 4 ) && ( !shown_exchanges[exchname] ) )
            {
                $('span#winmsg_title').text ( 'Information' );
                $('div#winmsg_ctnt').html ( 'Currently, only five exchanges can be used at the same time.<br/>Please, disable an exchange to activate another.<br/><br/>' );
                windowShow ( 'message' );
                timeout_id = setTimeout ( fetchData, 2000 );
                return;
            }

            if ( shown_exchanges[exchname] )
            {
                shown_exchanges[exchname] = false;
                --nb_shown_exchanges;
            }
            else
            {
                shown_exchanges[exchname] = true;
                ++nb_shown_exchanges;
            }

            var uids_64 = Long.fromNumber ( config.exch_multi );
            var uid_exch = Long.fromNumber ( exchanges_uid[exchname] );
            config.exch_multi = uids_64.xor(uid_exch).toNumber();

            var elem = $('a#exch_'+exchname);
            if ( shown_exchanges[exchname] )
                elem.css ( 'color', color_item_enabled );
            else
                elem.css ( 'color', color_item_disabled );

            shown_currency = detectShownCurrency ( shown_exchanges );
        }

        previous_price = 0;
        $('option#chart_type_price').text ( 'Price (' + shown_currency + ')' );
        $('option#chart_type_volcurr').text ( 'Volume (' + shown_currency + ')' );

        for ( var cid in charts )
            charts[cid].exchangeChanged ( );

        fetchFull = true;
        fetchBook = true;
        fetchData ( );
        saveConfig ( );
    }

    function selectView ( v )
    {
        if ( timeout_id != -1 )
            clearTimeout ( timeout_id );

        $('a#view_'+config.view).css ( 'color', color_item_disabled );
        $('a#view_'+v).css ( 'color', color_item_enabled );
        config.view = v;

        for ( cid in charts )
            charts[cid].viewlengthChanged ( );

        fetchFull = true;
        fetchData ( );
        saveConfig ( );
    }

    function applyColorTheme ( )
    {
        if ( config.theme == 'classic' )
        {
            $('img#btn_theme_classic').attr ( 'src', ui_img_toggle_enabled );
            $('img#btn_theme_perchart').attr ( 'src', ui_img_toggle_disabled );

            color_chart_price = color_chart_theme_classic_price;
            color_chart_price_mavg = color_chart_theme_classic_price_mavg;
            color_chart_baratio = color_chart_theme_classic_baratio;
            color_chart_baratio_mavg = color_chart_theme_classic_baratio_mavg;
            color_chart_volume = color_chart_theme_classic_volume;
            color_chart_lag = color_chart_theme_classic_lag;

            colors_chart_price = colors_chart_theme_classic;
            colors_chart_baratio = colors_chart_theme_classic;
            colors_chart_volume = colors_chart_theme_classic;
            colors_chart_lag = colors_chart_theme_classic;
            colors_chart_book = colors_chart_theme_classic_book;
        }
        else
        {
            $('img#btn_theme_classic').attr ( 'src', ui_img_toggle_disabled );
            $('img#btn_theme_perchart').attr ( 'src', ui_img_toggle_enabled );

            color_chart_price = color_chart_theme_perchart_price;
            color_chart_price_mavg = color_chart_theme_perchart_price_mavg;
            color_chart_baratio = color_chart_theme_perchart_baratio;
            color_chart_baratio_mavg = color_chart_theme_perchart_baratio_mavg;
            color_chart_volume = color_chart_theme_perchart_volume;
            color_chart_lag = color_chart_theme_perchart_lag;

            colors_chart_price = colors_chart_theme_perchart_price;
            colors_chart_baratio = colors_chart_theme_perchart_baratio;
            colors_chart_volume = colors_chart_theme_perchart_volume;
            colors_chart_lag = colors_chart_theme_perchart_lag;
            colors_chart_book = colors_chart_theme_perchart_book;
        }
    }

    function toggleColorTheme ( tname )
    {
        if ( timeout_id != -1 )
            clearTimeout ( timeout_id );

        config.theme = tname;
        applyColorTheme ( );

        for ( var cdiv in charts )
            charts[cdiv].update ( true );

        saveConfig ( );
        timeout_id = setTimeout ( fetchData, 2000 );
    }

    function applyYaxisPosition ( )
    {
        if ( config.yaxis == 'left' )
        {
            yaxis_position = 'left';
            $('img#btn_yaxis_left').attr ( 'src', ui_img_toggle_enabled );
            $('img#btn_yaxis_right').attr ( 'src', ui_img_toggle_disabled );
        }
        else
        {
            yaxis_position = 'right';
            $('img#btn_yaxis_right').attr ( 'src', ui_img_toggle_enabled );
            $('img#btn_yaxis_left').attr ( 'src', ui_img_toggle_disabled );
        }
    }

    function toggleYaxisPosition ( pos )
    {
        if ( timeout_id != -1 )
            clearTimeout ( timeout_id );

        config.yaxis = pos;
        applyYaxisPosition ( );

        for ( var cdiv in charts )
            charts[cdiv].update ( true );

        saveConfig ( );
        timeout_id = setTimeout ( fetchData, 2000 );
    }

    function applyHideRightPane ( )
    {
        if ( config.rpanel )
        {
            $('img#btn_right_pane').attr ( 'alt', 'disable' );
            $('img#btn_right_pane').attr ( 'src', ui_img_button_enabled );

            if ( charts['mr1'].expanded || charts['mr2'].expanded || charts['mr3'].expanded )
                $('div#markets_lpanel').css ( 'width', ui_lpanel_width_with_large_rpanel );
            else
                $('div#markets_lpanel').css ( 'width', ui_lpanel_width );
            $('div#markets_rpanel').show ( );
        }
        else
        {
            $('img#btn_right_pane').attr ( 'alt', 'enable' );
            $('img#btn_right_pane').attr ( 'src', ui_img_button_disabled );

            $('div#markets_rpanel').hide ( );
            $('div#markets_lpanel').css ( 'width', ui_lpanel_width_alone );
        }
    }

    function toggleHideRightPane ( )
    {
        if ( timeout_id != -1 )
            clearTimeout ( timeout_id );

        config.rpanel = !config.rpanel;
        applyHideRightPane ( );

        for ( var cdiv in charts )
            if ( ( cdiv[1] == 'l' ) || config.rpanel )
                charts[cdiv].update ( true );

        saveConfig ( );
        timeout_id = setTimeout ( fetchData, 2000 );
    }

    function toggleChart ( cid )
    {
        charts[cid].toggleVisibility ( );
        saveConfig ( );
    }

    /*
     * resizeCharts
     * this is called at startup and everytime the height of the charts must be updated
     */
    function resizeCharts ( replot )
    {
        /* todo: take charts legend height into account */

        var h = Math.max ( 400, $(window).height()-(134+94+(2*62)) ); /* top + bottom + charts spacing */

        if ( charts['ml1'].expanded )
        {
            $('div#ml2_chart').css ( 'height', (h*(1/5)).toFixed(0)+'px' );
            $('div#ml3_chart').css ( 'height', (h*(1/5)).toFixed(0)+'px' );

            if ( charts['ml2'].shown )
            {
                if  ( charts['ml3'].shown )
                    $('div#ml1_chart').css ( 'height', (h*(3/5)).toFixed(0)+'px' );
                else
                    $('div#ml1_chart').css ( 'height', (h*(4/5)).toFixed(0)+'px' );
            }
            else if ( charts['ml3'].shown )
                $('div#ml1_chart').css ( 'height', (h*(4/5)).toFixed(0)+'px' );
            else
                $('div#ml1_chart').css ( 'height', (h).toFixed(0)+'px' );
        }
        else if (charts['ml2'].expanded )
        {
            $('div#ml1_chart').css ( 'height', (h*(1/5)).toFixed(0)+'px' );
            $('div#ml3_chart').css ( 'height', (h*(1/5)).toFixed(0)+'px' );

            if ( charts['ml1'].shown )
            {
                if ( charts['ml3'].shown )
                    $('div#ml2_chart').css ( 'height', (h*(3/5)).toFixed(0)+'px' );
                else
                    $('div#ml2_chart').css ( 'height', (h*(4/5)).toFixed(0)+'px' );
            }
            else if ( charts['ml3'].shown )
                $('div#ml2_chart').css ( 'height', (h*(4/5)).toFixed(0)+'px' );
            else
                $('div#ml2_chart').css ( 'height', (h).toFixed(0)+'px' );
        }
        else if (charts['ml3'].expanded )
        {
            $('div#ml1_chart').css ( 'height', (h*(1/3)).toFixed(0)+'px' );
            $('div#ml2_chart').css ( 'height', (h*(1/3)).toFixed(0)+'px' );

            if ( charts['ml1'].shown )
            {
                if ( charts['ml2'].shown )
                    $('div#ml3_chart').css ( 'height', (h*(1/3)).toFixed(0)+'px' );
                else
                    $('div#ml3_chart').css ( 'height', (h*(2/3)).toFixed(0)+'px' );
            }
            else if ( charts['ml2'].shown )
                $('div#ml3_chart').css ( 'height', (h*(2/3)).toFixed(0)+'px' );
            else
                $('div#ml3_chart').css ( 'height', (h).toFixed(0)+'px' );
        }
        else
        {
            $('div#ml1_chart').css ( 'height', (h*(2/5)).toFixed(0)+'px' );
            $('div#ml2_chart').css ( 'height', (h*(2/5)).toFixed(0)+'px' );
            $('div#ml3_chart').css ( 'height', (h*(1/5)).toFixed(0)+'px' );
        }

        var sr = (9/44);
        if ( charts['mr1'].expanded )
            $('div#mr1_chart').css ( 'height', (h*(2/5)).toFixed(0)+'px' );
        else
            $('div#mr1_chart').css ( 'height', (h*sr).toFixed(0)+'px' );

        if ( charts['mr2'].expanded )
            $('div#mr2_chart').css ( 'height', (h*(60/80)).toFixed(0)+'px' );
        else
            $('div#mr2_chart').css ( 'height', (h*sr*2).toFixed(0)+'px' );

        if ( charts['mr3'].expanded )
            $('div#mr3_chart').css ( 'height', (h*(2/5)).toFixed(0)+'px' );
        else
            $('div#mr3_chart').css ( 'height', (h*sr).toFixed(0)+'px' );

        if ( replot > 1 )
            updateDisplay ( ); /* urgent replot requested */
        else if ( replot )
        {
            clearTimeout ( markets_resize_timeout_id );
            markets_resize_timeout_id = setTimeout ( updateDisplay, 200 );
        }
    }

    /*
     * expandChart
     * this is called at startup and by updateChartsLayout
     * it assumes that there is no other chart expanded in the same panel
     */
    function expandChart ( cid )
    {
        charts[cid].expanded = true;
        charts[cid].updateControls ( );

        if ( cid[1] == 'r' )
        {
            $('div#'+cid).css ( 'margin-right', '0' );
            $('div#'+cid).css ( 'margin-left', '1em' );
            $('div#markets_lpanel').css ( 'width', ui_lpanel_width_with_large_rpanel );
            $('div#markets_rpanel').css ( 'width', ui_rpanel_width_large );
        }

        switch ( cid )
        {
          case 'mr1':
            {
                $('div#mr2').css ( 'width', '45%' );
                $('div#mr3').css ( 'width', '45%' );
                $('div#mr2').css ( 'margin-left', '1em' );
                break;
            }

          case 'mr2':
            {
                $('div#mr2').insertBefore($('div#mr1'));
                $('div#mr1').css ( 'width', '45%' );
                $('div#mr3').css ( 'width', '45%' );
                $('div#mr1').css ( 'margin-left', '1em' );
                $('div#mr1').css ( 'margin-right', '0' );
                $('div#mr3').css ( 'margin-left', '1em' );
                break;
            }

          case 'mr3':
            {
                $('div#mr3').insertBefore($('div#mr1'));
                $('div#mr2').insertBefore($('div#mr1'));
                $('div#mr2').css ( 'width', '45%' );
                $('div#mr1').css ( 'width', '45%' );
                $('div#mr2').css ( 'margin-left', '1em' );
                break;
            }

          default:
            break;
        }
    }

    /*
     * reduceChart
     * this is called by updateChartsLayout and at initilization
     */
    function reduceChart ( cid )
    {
        charts[cid].expanded = false;
        charts[cid].updateControls ( );

        if ( cid[1] == 'r' )
        {
            $('div#'+cid).css ( 'margin-right', '1em' );
            $('div#'+cid).css ( 'margin-left', '0' );
            $('div#markets_rpanel').css ( 'width', ui_rpanel_width );
            $('div#markets_lpanel').css ( 'width', ui_lpanel_width );
        }

        switch ( cid )
        {
          case 'mr1':
            {
                $('div#mr2').css ( 'width', '93%' );
                $('div#mr3').css ( 'width', '93%' );
                $('div#mr2').css ( 'margin-left', '0' );
                break;
            }

          case 'mr2':
            {
                $('div#mr1').css ( 'width', '93%' );
                $('div#mr3').css ( 'width', '93%' );
                $('div#mr1').css ( 'margin-left', '0' );
                $('div#mr3').css ( 'margin-left', '0' );
                $('div#mr2').insertAfter($('div#mr1'));
                break;
            }

          case 'mr3':
            {
                $('div#mr2').css ( 'width', '93%' );
                $('div#mr1').css ( 'width', '93%' );
                $('div#mr2').css ( 'margin-left', '0' );
                $('div#mr2').insertAfter($('div#mr1'));
                $('div#mr3').insertAfter($('div#mr2'));
                break;
            }

          default:
            break;
        }
    }

    /*
     * udpateChartsLayout
     * this is called by a chart when it requests to be resized
     * the callee has the responsibility to:
     *  1. save its configuration
     */
    function updateChartsLayout ( cid )
    {
        var panel_content;

        if ( cid[1] == 'l' )
            panel_content = { 'ml1':1, 'ml2':2, 'ml3':3 }; /* left panel */
        else
            panel_content = { 'mr1':1, 'mr2':2, 'mr3':3 }; /* right panel */

        if ( charts[cid].expanded )
        {
            for ( var prev_cid in panel_content )
                if ( charts[prev_cid].expanded )
                    reduceChart ( prev_cid );
            expandChart ( cid );
        }
        else
            reduceChart ( cid );

        resizeCharts ( 2 );
    }



    /*******************************
     ** Markets UI Initialization **
     *******************************/

    /* this is where coinorama_markets_load() actually starts */

    if ( coinorama_getCurrentSection() != 'M' )
        return;

    for ( var e in exchanges_uid )
        rawbooks_cache[e] = null;


    /* set up charts types */
    var charts_categories = [ { name:'Price', charts:[ChartPrice, ChartPriceRelative, ChartPriceMAM] },
                              { name:'Indicators', charts:[ChartMACD, ChartADX, ChartRSI, ChartTSI, ChartStdDev, ChartATR] },
                              { name:'Volume', charts:[ChartVolume, ChartVolumeCurrency, ChartVolumeRelative, ChartNbTrades, ChartAvgTradeSize] },
                              { name:'Order Book', charts:[ChartBidsAsksRatio, ChartBidsAsksSums, ChartBook, ChartSpread] },
                              { name:'Others', charts:[ChartLag] } ];


    /* set up charts box with toggle+selector+controls+legend+chart */
    function makeChartBox ( cid )
    {
        var ins = '';

        ins += '<div style="float:left;"><a id="toggle_' + cid + '" href="#">' +
               '<img class="btn" id="btn_' + cid + '_view" src="'+ui_img_button_enabled+'" alt="disable"/>' +
               '</a>&nbsp;';

        ins += '<select class="cbox" id="cb_' + cid + '">';

        for ( var i in charts_categories )
        {
            var ct = charts_categories[i];

            ins += '<option value="null" disabled> -- ' + ct.name + ' -- </option>';

            for ( var j in ct.charts )
            {
                var c = ct.charts[j];
                charts_types[c.getName()] = c;

                ins += '<option value="' + c.getName() + '" ' +
                    ' id="chart_type_' + c.getName() + '">' +
                    c.getTitle() + '</option>';
            }
        }

        ins += '</select>&nbsp;';

        ins += '<span id="' + cid + '_ctrl"></span>&nbsp;';
        ins += '</span>| &nbsp;</div>';

        ins += '<div id="' + cid + '_legend" style="display:inline-block; overflow:hidden; font-size:x-small; margin:0px 0;"></div>';
        ins += '<br style="clear:both" />';
        ins += '<div id="' + cid + '_chart" class="markets_chart"></div>';

        $('div#'+cid).prepend ( ins );
        $('select#cb_'+cid).on ( 'change', function() { toggleChartLocation(cid,this.value); } );
    }

    makeChartBox ( 'ml1' );
    makeChartBox ( 'ml2' );
    makeChartBox ( 'ml3' );
    makeChartBox ( 'mr1' );
    makeChartBox ( 'mr2' );
    makeChartBox ( 'mr3' );


    /* set up period selection table */
    function makeViewPeriodsList ( )
    {
        var ins = '';
        var prev_base = 'n';
        var extra = '';

        ins += '<table class="ctrl_table" style="color:#555;">';
        ins += '<tr style="color:#bbb; background:#333; font-size:xx-small;"><td colspan="'+views.length+'">';
        ins += '<a id="view_mode_length" href="#">TIMESPAN</a> &nbsp;&nbsp; ';
        ins += '<a id="view_mode_interval" href="#">INTERVAL</a>';
        ins += '</td></tr>';
        ins += '<tr>';

        for ( var i in views )
        {
            extra = (prev_base == views[i].name[views[i].name.length-1]) ? '' : '| &nbsp;';
            ins += '<td>' + extra + '<a id="view_' + views[i].code + '" href="#">' + views[i].name + '</a></td>';
            prev_base = views[i].name[views[i].name.length-1];
        }

        ins += '</tr>';
        ins += '</table>';

        $('div#markets_periods').append ( ins );
    }

    makeViewPeriodsList ( );

    $.each ( views_table, function(v) {
        $('a#view_'+v).on ( 'click', function(e) { e.preventDefault(); selectView(v); } );
        $('a#view_'+v).css ( 'color', color_item_disabled );
        $('a#view_'+v).css ( 'text-decoration', 'none' );
    } );


    function selectViewMode ( vm )
    {
        $('a#view_mode_'+config.viewmode).css ( 'color', color_item_disabled );
        $('a#view_mode_'+vm).css ( 'color', color_item_enabled );
        config.viewmode = vm;

        for ( var i in views )
        {
            if ( vm == 'interval' )
                $('a#view_'+views[i].code).html ( views[i].precname );
            else
                $('a#view_'+views[i].code).html ( views[i].name );
        }

        saveConfig ( );
    }

    $('a#view_mode_length').on ( 'click', function(e) { e.preventDefault(); selectViewMode('length'); } );
    $('a#view_mode_length').css ( 'color', color_item_disabled );
    $('a#view_mode_length').css ( 'text-decoration', 'none' );

    $('a#view_mode_interval').on ( 'click', function(e) { e.preventDefault(); selectViewMode('interval'); } );
    $('a#view_mode_interval').css ( 'color', color_item_disabled );
    $('a#view_mode_interval').css ( 'text-decoration', 'none' );


    /* set up exchanges selection table */
    function makeExchangesList ( )
    {
        var ins = '';

        for ( var i in currency_list )
        {
            var cur = currency_list[i];
            var mleft = '0.6em';
            if ( i == 0 )
                mleft = '0.4em';
            ins += '<div class="ctrl_item">';
            ins += '<table class="ctrl_table" style="margin-left:'+mleft+'; margin-right:0;">';
            ins += '<tr style="color:#bbb;">';
            ins += '<td colspan="' + exchanges_by_currency[cur].length + '" style="background:#333; font-size:xx-small;">';

            if ( exchanges_by_currency[cur].length > 1 )
                ins += '<a id="cur_'+cur+'_display" href="#" style="text-decoration:none">[-]</a>&nbsp; ';

            ins += '<a id="cur_'+cur+'" href="#">'+cur+' ('+currency_symbol[cur]+')</a></td>';
            ins += '</tr>';
            ins += '<tr>';

            for ( var j in exchanges_by_currency[cur] )
            {
                var einfo = exchanges_by_currency[cur][j];
                ins += '<td id="exch_'+einfo.name+'"><a id="exch_'+einfo.name+'" href="#">'+einfo.desc+'</a></td>';
            }

            ins += '</tr></table></div>';
        }

        ins += '<br style="clear:both" />';

        $('div#markets_bar').append ( ins );
    }

    makeExchangesList ( );


    /********************************************
     ** User Configuration Callbacks and Style **
     ********************************************/

    $('a#mode_single').on ( 'click', function(e) { e.preventDefault(); selectMode('s'); } );
    $('a#mode_single').css ( 'text-decoration', 'none' );
    $('a#mode_multi').on ( 'click', function(e) { e.preventDefault(); selectMode('c'); } );
    $('a#mode_multi').css ( 'text-decoration', 'none' );

    $.each ( currency_symbol, function(cur) {
        $('a#cur_'+cur).on ( 'click', function(e) { e.preventDefault(); selectCurrency(cur); } );
        $('a#cur_'+cur+'_display').on ( 'click', function(e) { e.preventDefault(); toggleCurrencyDisplay(cur); } );
        $('a#cur_'+cur).css ( 'color', color_currency );
        $('a#cur_'+cur).css ( 'text-decoration', 'none' );
        config.curr[cur] = false;
    } );

    $.each ( exchanges_uid, function(e) {
        $('a#exch_'+e).on ( 'click', function(ev) { ev.preventDefault(); selectExchange(e); } );
        $('a#exch_'+e).css ( 'text-decoration', 'none' );
        shown_exchanges[e] = false;
    } );

    $('a#toggle_right_pane').on ( 'click', function(e) { e.preventDefault(); toggleHideRightPane(); } );

    $('a#toggle_theme_classic').on ( 'click', function(e) { e.preventDefault(); toggleColorTheme('classic'); } );
    $('a#toggle_theme_perchart').on ( 'click', function(e) { e.preventDefault(); toggleColorTheme('thematic'); } );

    $('a#toggle_yaxis_left').on ( 'click', function(e) { e.preventDefault(); toggleYaxisPosition('left'); } );
    $('a#toggle_yaxis_right').on ( 'click', function(e) { e.preventDefault(); toggleYaxisPosition('right'); } );


    /************************************
     ** Previous Configuration Loading **
     ************************************/

    readConfig ( );

    applyYaxisPosition ( );

    var uids_64 = Long.fromNumber ( config.exch_multi );

    for ( var e in exchanges_uid )
    {
        var uid_exch = Long.fromNumber ( exchanges_uid[e] );

        if ( ! uids_64.and(uid_exch).isZero() )
        {
            shown_exchanges[e] = true;
            ++nb_shown_exchanges;
        }

        if ( nb_shown_exchanges > 4 )
            break;
    }

    for ( var i in currency_list )
        if ( exchanges_by_currency[currency_list[i]].length > 1 )
            updateCurrencyDisplay ( currency_list[i] );

    $.each ( charts, function(cid) {
        charts[cid] = new charts_types[config[cid].name] ( cid );
        charts[cid].setConfig ( config[cid] );
        $('select#cb_'+cid+' option[value="'+config[cid].name+'"]').prop ( 'selected', true );
        $('a#toggle_'+cid).on ( 'click', function(e) { e.preventDefault(); toggleChart(cid); } );

        if ( charts[cid].expanded )
            expandChart ( cid );
    } );

    $('a#view_'+config.view).css ( 'color', color_item_enabled );
    selectViewMode ( config.viewmode );

    $('option#chart_type_price').text ( 'Price (' + shown_currency + ')' );

    /* small views (right panel) */
    applyHideRightPane ( );

    $(window).resize ( function() { resizeCharts(1); });
    resizeCharts ( 0 );

    applyColorTheme ( );

    /* select config mode (implicitly enters timeout/fetch/display loop) */
    selectMode ( config.mode );
}


/*
 * main module
 */
$( function() {

    function waitMarketsConfiguration ( )
    {
        if ( exchanges_info.length == 0 )
            timeout_markets_config_id = setTimeout ( waitMarketsConfiguration, 200 );
        else
            coinorama_markets_load ( );
    }

    waitMarketsConfiguration ( );
});
