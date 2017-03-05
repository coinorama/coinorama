/*
 * coinorama.network.js
 * Coinorama Chainref module
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

    var lbl_width = 45;
    var yaxis_position = 'right';

    var views = [ { code:'d', name:'1d',  precname:'30m', length:24*3600,        precision:1800,      hrateema:24, shortformat:'%H:%M', format:'%H:%M' },
                  { code:'w', name:'1w',  precname:'1h',  length:7*24*3600,      precision:3600*1,    hrateema:24, shortformat:'%d/%m', format:'%a. %d' },
                  { code:'m', name:'1m',  precname:'2h',  length:31*24*3600,     precision:3600*2,    hrateema:24, shortformat:'%d/%m', format:'%a. %d' },
                  { code:'r', name:'3m',  precname:'6h',  length:92*24*3600,     precision:3600*6,    hrateema:24, shortformat:'%d/%m', format:'%d. %b' },
                  { code:'b', name:'6m',  precname:'12h', length:183*24*3600,    precision:3600*12,   hrateema:16, shortformat:'%m/%Y', format:'%b. %Y' },
                  { code:'y', name:'1y',  precname:'1d',  length:365*24*3600,    precision:3600*24,   hrateema:8,  shortformat:'%m/%Y', format:'%b. %Y' },
                  { code:'l', name:'2y',  precname:'2d',  length:2*365*24*3600,  precision:3600*24*2, hrateema:6,  shortformat:'%m/%Y', format:'%b. %Y' },
                  { code:'q', name:'4y',  precname:'4d',  length:4*365*24*3600,  precision:3600*24*4, hrateema:4,  shortformat:'%m/%Y', format:'%b. %Y' },
                  { code:'a', name:'all', precname:'1w',  length:20*365*24*3600, precision:3600*24*7, hrateema:2,  shortformat:'%Y',    format:'%Y' } ];

    var views_table = { };
    for ( var i in views )
    {
        views_table[views[i].code] = views[i];
        views[i].hrateema_K = 2 / (views[i].hrateema+1);
    }

    var config = { mode:'s',
                   view:'r',
                   viewmode:'length',
                   rpanel:true,
                   yaxis:'right',
                   nl1:{name:'hashrate',expand:true},
                   nl2:{name:'mempool'},
                   nl3:{name:'blocksize'},
                   nr1:{name:'txrate'},
                   nr2:{name:'volume',log:true},
                   nr3:{name:'revenue'}
                 };

    var EMA10_K = 2 / (10+1);
    var EMA26_K = 2 / (26+1);

    var charts_types = { }; /* chart classes */
    var charts = { 'nl1':null, 'nl2':null, 'nl3':null, 'nr1':null, 'nr2':null, 'nr3':null };

    var selected_pools_window = 672;

    var fetchFull = true;

    /* interface */
    var color_item_enabled = '#fff';
    var color_item_disabled = '#777';

    var ui_img_button_enabled = '/coinorama/static/btn-enabled.png';
    var ui_img_button_disabled = '/coinorama/static/btn-disabled.png';
    var ui_img_toggle_enabled = '/coinorama/static/btn-toggle-enabled.png';
    var ui_img_toggle_disabled = '/coinorama/static/btn-toggle-disabled.png';
    var ui_img_reduce = '/coinorama/static/btn-reduce.png';
    var ui_img_expand = '/coinorama/static/btn-expand.png';

    /* chart colors */
    var color_chart_axis = '#151515';
    var color_chart_axis_text = '#eee';
    var color_chart_legend_bg = '#000';

    var color_chart_diff = '#3d5066';
    var color_chart_hashrate = '#bdcd00';
    var color_chart_hashrate_ema = '#f28428';
    var color_chart_nbtx = '#cc0044';
    var color_chart_nbtx_ema = '#ee5599';
    var color_chart_volume = '#00cc44';
    var color_chart_volume_ema = '#55ee99';
    var color_chart_size = '#827a88';
    var color_chart_size_ema = '#a2aab8';
    var color_chart_nbblocks = '#4367af';
    var color_chart_nbblocks_ema = '#85aaff';
    var color_chart_target = '#ff3344';

    var colors_chart_pools = [ '#e5db49', '#e5973a', '#ba4c40', '#a34696', '#5377bf' ];

    var width_line_raw = 0.6;
    var width_line_ema = 1.5;
    var width_line_max = 0.5;

    var pools_enabled = false;

    /* data refresh timeout handler */
    var timeout_id = -1;
    var network_resize_timeout_id = -1;
    var nb_fetch_errors = 3; /* at startup, fetch errors must be reported */

    var blockchainData = null;

    /* chart defaults */
    var common_lines_options = {
        canvas: true,
        tooltip: true,
        tooltipOpts: { content: '%y.2<br/> %x', xDateFormat: '%d-%b-%Y %H:%M:%S' },
        series: { candlestick: { active:false }},
        legend: { position:'nw', margin:0, backgroundOpacity:0.5, noColumns:2, backgroundColor:color_chart_legend_bg },
        lines: { show:true, lineWidth:width_line_raw },
        grid: { hoverable:true, borderWidth:'0' },
        points: {show:false },
        xaxis: { mode: 'time', timezone:'browser', timeformat:'%H:%M:%S', font:{color:color_chart_axis_text}, color:color_chart_axis, autoscaleMargin:0.005, ticks:null },
        yaxis: { font:{color:color_chart_axis_text}, labelWidth:lbl_width, color:color_chart_axis, position:yaxis_position, tickFormatter:null }
    };


    /***********
     ** Utils **
     ***********/

    /* hash rate */
    function formatTickHashrateMHs ( val, axis )
    {
        if ( val < 1000 )
            return val.toFixed(1)+' M';
        else if ( val < 1e6 )
            return (val/1e3).toFixed(1)+' G';
        else if ( val < 1e9 )
            return (val/1e6).toFixed(1)+' T';
        else if ( val < 1e12 )
            return (val/1e9).toFixed(1)+' P';
        else
            return (val/1e12).toFixed(1)+' E';
    }

    function formatTickHashratePHs ( val, axis )
    {
        if ( val < 1000 )
            return val.toFixed(0)+' P';
        else
            return (val/1000).toFixed(1)+' E';
        
    }

    /* coinbase */
    function getCoinbase ( bid )
    {
        return (50 >> Math.floor ( bid / 210000 ));
    }

    /* scientific notation */
    function formatTickExponent ( val, axis )
    {
        return val.toExponential(1);
    }

    /* duration */
    function formatTickDuration ( val, axis )
    {
        if ( val < 60 )
            return val.toFixed(0)+' seconds';
        else if ( val < 3600 )
            return (val/60).toFixed(0)+' minutes';
        else if ( val < 86400 )
            return (val/3600).toFixed(0)+' hours';
        else
            return (val/86400).toFixed(0)+' days';
    }


    /*******************
     ** Configuration **
     *******************/

    function decodeConfig ( conf_str )
    {
        var newconf;

        try { newconf = JSON.parse ( conf_str ); }
        catch (e) { return; }

        if ( 's'.indexOf(newconf.mode) != -1 )
            config.mode = newconf.mode;

        if ( newconf.view in views_table )
            config.view = newconf.view;

        if ( newconf.yaxis in {'left':0, 'right':1} )
            config.yaxis = newconf.yaxis;

        if ( newconf.viewmode in {'length':0, 'interval':1} )
            config.viewmode = newconf.viewmode;

        if ( newconf.hasOwnProperty('rpanel') )
            config.rpanel = newconf.rpanel;

        for ( cid in charts )
            if ( newconf.hasOwnProperty(cid) )
                if ( newconf[cid].name in charts_types )
                    config[cid] = newconf[cid];
    }

    function readConfig ( )
    {
        var c_value = document.cookie;
        var c_start = c_value.indexOf ( 'network=' );
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

        document.cookie = 'network=' + JSON.stringify(config) + '; expires=' + exdate.toUTCString();
    }


    /**********************************
    ***********************************
                NETWORK
    ***********************************
    ***********************************/

    function diff2hrate ( diff )
    {
        var m_hrate = diff * 7.158278826666667;
        return m_hrate / 1e9;
    }

    function hrate2diff ( hrate )
    {
        var m_hrate = hrate * 1e9;
        return m_hrate / 7.158278826666667;
    }

    /*
     * blockchainAppendDataLine
     */
    function blockchainAppendDataLine ( bc, l )
    {
        var VIEW_COLUMN_FIRST_BLOCK_ID = 0;
        var VIEW_COLUMN_TIMESTAMP = 1;
        var VIEW_COLUMN_DIFFICULTY = 2;
        var VIEW_COLUMN_VERSION = 3;
        var VIEW_COLUMN_SIZE = 4;
        var VIEW_COLUMN_SIZE_MAX = 5;
        var VIEW_COLUMN_NB_TX = 6;
        var VIEW_COLUMN_VOLUME = 7;
        var VIEW_COLUMN_FEES = 8;
        var VIEW_COLUMN_MEMPOOL_SIZE = 9;
        var VIEW_COLUMN_MEMPOOL_MAX_SIZE = 10;
        var VIEW_COLUMN_NB_BLOCKS = 11;
        var VIEW_COLUMN_WORKTIME = 12;
        var VIEW_COLUMN_HASHRATE = 13;
        var VIEW_COLUMN_VERSION_EMA10 = 14;
        var VIEW_COLUMN_SIZE_EMA26 = 15;
        var VIEW_COLUMN_NB_TX_EMA26 = 16;
        var VIEW_COLUMN_NB_TX_TOTAL = 17;
        var VIEW_COLUMN_VOLUME_EMA26 = 18;
        var VIEW_COLUMN_FEES_EMA26 = 19;
        var VIEW_COLUMN_NB_BLOCKS_EMA26 = 20;
        var VIEW_COLUMN_WORKTIME_EMA26 = 21;
        var VIEW_COLUMN_HASHRATE_EMA = 22;

        var timestamp = l[VIEW_COLUMN_TIMESTAMP] * 1000;

        bc.block_id.push ( [timestamp,l[VIEW_COLUMN_FIRST_BLOCK_ID]] );
        bc.block_diff.push ( [timestamp,l[VIEW_COLUMN_DIFFICULTY]] );
        bc.version.push ( [timestamp,l[VIEW_COLUMN_VERSION]] );
        bc.size.push ( [timestamp,l[VIEW_COLUMN_SIZE]] );
        bc.size_max.push ( [timestamp,l[VIEW_COLUMN_SIZE_MAX]] );
        bc.nb_tx.push ( [timestamp,l[VIEW_COLUMN_NB_TX]] );
        bc.volume.push ( [timestamp,l[VIEW_COLUMN_VOLUME]] );
        bc.fees.push ( [timestamp,l[VIEW_COLUMN_FEES]] );
        bc.mempool_size.push ( [timestamp,l[VIEW_COLUMN_MEMPOOL_SIZE]] );
        bc.mempool_max_size.push ( [timestamp,l[VIEW_COLUMN_MEMPOOL_MAX_SIZE]] );
        bc.nb_blocks.push ( [timestamp,l[VIEW_COLUMN_NB_BLOCKS]] );
        bc.worktime.push ( [timestamp,l[VIEW_COLUMN_WORKTIME]] );
        bc.hashrate.push ( [timestamp,l[VIEW_COLUMN_HASHRATE]] );
        bc.hashrate_phs.push ( [timestamp,l[VIEW_COLUMN_HASHRATE]/1e9] ); /* convert MH/s to PH/s */

        if ( bc.size_ema26.length > 0 )
        {
            bc.version_ema10_seed = l[VIEW_COLUMN_VERSION]*EMA10_K + bc.version_ema10_seed*(1-EMA10_K);
            bc.size_ema26_seed = l[VIEW_COLUMN_SIZE]*EMA26_K + bc.size_ema26_seed*(1-EMA26_K);
            bc.nb_tx_ema26_seed = l[VIEW_COLUMN_NB_TX]*EMA26_K + bc.nb_tx_ema26_seed*(1-EMA26_K);
            bc.nb_tx_total_seed = l[VIEW_COLUMN_NB_TX] + bc.nb_tx_total_seed;
            bc.volume_ema26_seed = l[VIEW_COLUMN_VOLUME]*EMA26_K + bc.volume_ema26_seed*(1-EMA26_K);
            bc.fees_ema26_seed = l[VIEW_COLUMN_FEES]*EMA26_K + bc.fees_ema26_seed*(1-EMA26_K);

            bc.nb_blocks_ema26_seed = l[VIEW_COLUMN_NB_BLOCKS]*EMA26_K + bc.nb_blocks_ema26_seed*(1-EMA26_K);
            bc.worktime_ema26_seed = l[VIEW_COLUMN_WORKTIME]*EMA26_K + bc.worktime_ema26_seed*(1-EMA26_K);

            var emaK = views_table[config.view].hrateema_K;
            bc.hashrate_ema_seed = l[VIEW_COLUMN_HASHRATE]*emaK + bc.hashrate_ema_seed*(1-emaK); /* convert MH/s to PH/s */
        }
        else
        {
            bc.version_ema10_seed = l[VIEW_COLUMN_VERSION_EMA10];
            bc.size_ema26_seed = l[VIEW_COLUMN_SIZE_EMA26];
            bc.nb_tx_ema26_seed = l[VIEW_COLUMN_NB_TX_EMA26];
            bc.nb_tx_total_seed = l[VIEW_COLUMN_NB_TX_TOTAL];
            bc.volume_ema26_seed = l[VIEW_COLUMN_VOLUME_EMA26];
            bc.fees_ema26_seed = l[VIEW_COLUMN_FEES_EMA26];
            bc.nb_blocks_ema26_seed = l[VIEW_COLUMN_NB_BLOCKS_EMA26];
            bc.worktime_ema26_seed = l[VIEW_COLUMN_WORKTIME_EMA26];
            bc.hashrate_ema_seed = l[VIEW_COLUMN_HASHRATE_EMA];
        }

        bc.version_ema10.push ( [timestamp,bc.version_ema10_seed] );
        bc.size_ema26.push ( [timestamp,bc.size_ema26_seed] );
        bc.nb_tx_ema26.push ( [timestamp,bc.nb_tx_ema26_seed] );
        bc.nb_tx_total.push ( [timestamp,bc.nb_tx_total_seed] );
        bc.volume_ema26.push ( [timestamp,bc.volume_ema26_seed] );
        bc.fees_ema26.push ( [timestamp,bc.fees_ema26_seed] );
        bc.nb_blocks_ema26.push ( [timestamp,bc.nb_blocks_ema26_seed] );
        bc.worktime_ema26.push ( [timestamp,bc.worktime_ema26_seed] );
        bc.hashrate_ema.push ( [timestamp,bc.hashrate_ema_seed] );
        bc.hashrate_phs_ema.push ( [timestamp,bc.hashrate_ema_seed/1e9] );
    }

    /*
     * blockchainShiftDataLine
     */
    function blockchainShiftDataLine ( bc, l )
    {
        if ( bc.block_id.length == 0 )
            return;

        bc.block_id.shift ( );
        bc.block_diff.shift ( );
        bc.version.shift ( );
        bc.version_ema10.shift ( );
        bc.size.shift ( );
        bc.size_max.shift ( );
        bc.size_ema26.shift ( );
        bc.nb_tx.shift ( );
        bc.nb_tx_ema26.shift ( );
        bc.nb_tx_total.shift ( );
        bc.volume.shift ( );
        bc.volume_ema26.shift ( );
        bc.fees.shift ( );
        bc.fees_ema26.shift ( );
        bc.mempool_size.shift ( );
        bc.mempool_max_size.shift ( );
        bc.nb_blocks.shift ( );
        bc.nb_blocks_ema26.shift ( );
        bc.worktime.shift ( );
        bc.worktime_ema26.shift ( );
        bc.hashrate.shift ( );
        bc.hashrate_ema.shift ( );
        bc.hashrate_phs.shift ( );
        bc.hashrate_phs_ema.shift ( );
    }

    /*
     * blockchainPopDataLine
     */
    function blockchainPopDataLine ( bc, l )
    {
        if ( bc.block_id.length == 0 )
            return;

        bc.block_id.pop ( );
        bc.block_diff.pop ( );
        bc.version.pop ( );
        bc.version_ema10.pop ( );
        bc.size.pop ( );
        bc.size_max.pop ( );
        bc.size_ema26.pop ( );
        bc.nb_tx.pop ( );
        bc.nb_tx_ema26.pop ( );
        bc.nb_tx_total.pop ( );
        bc.volume.pop ( );
        bc.volume_ema26.pop ( );
        bc.fees.pop ( );
        bc.fees_ema26.pop ( );
        bc.mempool_size.pop ( );
        bc.mempool_max_size.pop ( );
        bc.nb_blocks.pop ( );
        bc.nb_blocks_ema26.pop ( );
        bc.worktime.pop ( );
        bc.worktime_ema26.pop ( );
        bc.hashrate.pop ( );
        bc.hashrate_ema.pop ( );
        bc.hashrate_phs.pop ( );
        bc.hashrate_phs_ema.pop ( );

        if ( bc.block_id.length > 0 )
        {
            bc.version_ema10_seed = bc.version_ema10[bc.version_ema10.length-1][1];
            bc.size_ema26_seed = bc.size_ema26[bc.size_ema26.length-1][1];
            bc.nb_tx_ema26_seed = bc.nb_tx_ema26[bc.nb_tx_ema26.length-1][1];
            bc.nb_tx_total_seed = bc.nb_tx_total[bc.nb_tx_total.length-1][1];
            bc.volume_ema26_seed = bc.volume_ema26[bc.volume_ema26.length-1][1];
            bc.fees_ema26_seed = bc.fees_ema26[bc.fees_ema26.length-1][1];
            bc.nb_blocks_ema26_seed = bc.nb_blocks_ema26[bc.nb_blocks_ema26.length-1][1];
            bc.worktime_ema26_seed = bc.worktime_ema26[bc.worktime_ema26.length-1][1];
            bc.hashrate_ema_seed = bc.hashrate_ema[bc.hashrate_ema.length-1][1];
        }
    }

    /*
     * updateNetworkData
     */
    function updateNetworkData ( bc, newstats )
    {
        var append_solid_line = true;

        /* for blockchain, we do not use the current floating line, update is a little more simple */

        if ( bc.block_id.length > 0 )
        {
            /* check most recent solid line */
            var last_stamp = bc.block_id[bc.block_id.length-1][0];
            var new_stamp = newstats[0][1] * 1000; /* exchange stamps are milliseconds */

            if ( last_stamp != new_stamp )
            {
                /* if oldest solid line is too old */
                if ( (new_stamp - bc.block_id[0][0]) > (views_table[config.view].length*1000) )
                    blockchainShiftDataLine ( bc ); /* remove oldest solid line */
            }
            else /* we already have the most recent solid line */
                append_solid_line = false;
        }

        if ( append_solid_line )
            blockchainAppendDataLine ( bc, newstats[0] );
    }

    /*
     * readNetworkDifficulty
     */
    function readNetworkDifficulty ( bc, rawdiff )
    {
        bc.difficulty = [ ];

        var diff_current = bc.block_diff[0][1];
        bc.difficulty.push ( [bc.block_diff[0][0],diff_current] );
        for ( var i=0; i<rawdiff.length; ++i )
        {
            /* we should never have a diff younger than younger block */
            if ( (rawdiff[i][0]*1000) < bc.block_diff[0][0] )
                continue;
            bc.difficulty.push ( [rawdiff[i][0]*1000,diff_current] );
            diff_current = rawdiff[i][1];
            bc.difficulty.push ( [rawdiff[i][0]*1000+1,diff_current] );
        }

        bc.difficulty.push ( [bc.block_diff[bc.block_diff.length-1][0],diff_current] );
    }

    /*
     * readNetworkPools
     */
    function readNetworkPools ( bc, rawpoolstats )
    {
        bc.pools = [ ];
        bc.pools_names = [ ];

        for ( var j=0; j<5; ++j )
            bc.pools.push ( [ ] );

        var top_pools = [ ];
        for ( var i=0; i<5; ++i )
            top_pools.push ( [0,0,''] );

        var last_line = rawpoolstats[rawpoolstats.length-1];
        for ( var j=1; j<last_line.length; ++j ) /* build top 5 */
        {
            var k;
            for ( k=0; k<5; ++k )
            {
                if ( top_pools[k][0] < last_line[j] )
                    break;
            }

            if ( k < 5 )
            {
                var l = 4;
                for ( var l=4; l>k; --l )
                    top_pools[l] = top_pools[l-1];
                top_pools[k] = [ last_line[j], j, rawpoolstats[0][j] ];
            }
        }

        for ( var i=1; i<rawpoolstats.length; ++i ) /* line 0 is pool names */
        {
            var total = 0;
            for ( var j=1; j<rawpoolstats[i].length; ++j )
                total += rawpoolstats[i][j];

            for ( var j=0; j<5; ++j )
                bc.pools[j].push ( [rawpoolstats[i][0]*1000,rawpoolstats[i][top_pools[j][1]]/total*100] );
        }

        for ( var j=0; j<5; ++j )
            bc.pools_names.push ( top_pools[j][2] );
    }

    /*
     * readNetworkData
     */
    function readNetworkData ( data )
    {
        /* explode stats data */
        if ( data == null )
            return null;

        var bc_name = data[0].name;
        var rawstats = data[0].stats;

        /* init blockchain object */
        var bc = { name:bc_name,
                   id:0,
                   block_id:[],
                   block_diff:[],
                   difficulty:[], difficulty_data:[],
                   version:[], version_ema10:[], version_ema10_seed:0,
                   size:[], size_max:[], size_ema26:[], size_ema26_seed:0,
                   nb_tx:[], nb_tx_ema26:[], nb_tx_ema26_seed:0, nb_tx_total:[], nb_tx_total_seed:0,
                   volume:[], volume_ema26:[], volume_ema26_seed:0,
                   fees:[], fees_ema26:[], fees_ema26_seed:0,
                   mempool_size:[], mempool_max_size:[],
                   nb_blocks:[], nb_blocks_ema26:[], nb_blocks_ema26_seed:0,
                   worktime:[], worktime_ema26:[], worktime_ema26_seed:0,
                   hashrate:[], hashrate_ema:[], hashrate_ema_seed:0,
                   hashrate_phs:[], hashrate_phs_ema:[],
                   pools:[], pools_names:[], pools_data:[] };

        /* read stats data */
        for ( var j=0; j<rawstats.length-1; j++ ) /* do not process the last line */
            blockchainAppendDataLine ( bc, rawstats[j] );

        return bc;
    }



    /*
     * Chart Abstract Class
     */
    var Chart = ( function ( )
    {
        var cls = function ( cid, supported_modes, has_log )
        {
            this.cid = cid; /* name of the div element holding the chart area, control, legend, etc. */
            this.cdiv = 'div#' + cid + '_chart';  /* selector of the div element holding the chart area */
            this.tspan = 'span#' + cid + '_ctrl';  /* selector of the span element holding the controls */
            this.ldiv = 'div#' + cid + '_legend'; /* selector of the div element holding the legend */

            this.supported_modes = supported_modes;
            this.shown = true;
            this.expanded = false;

            this.has_log = has_log;

            /* logarithmic display */
            if ( this.has_log )
            {
                this.log = false;

                this.toggleLog = function ( )
                {
                    this.log = !this.log;
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

                if ( this.has_log )
                    if ( conf.hasOwnProperty('log') )
                        this.log = conf.log;

                this.updateControls ( );
            };

            this.getConfig = function ( )
            {
                var conf = { };
                conf.name = this.constructor.getName();
                conf.show = this.shown;
                conf.expand = this.expanded;

                if ( this.has_log )
                    conf['log'] = this.log;

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
                return 's'; /* only one operating mode for network charts */
            };

            /* helper to generate array of log ticks */
            this.computeLogTicks = function ( plots, stacked )
            {
                var lmin=77777777777777777;
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
            this.prepare = function ( blockchain, nbmsecs, nbpoints )
            {
                this.blockchain = blockchain;
                this.nbmsecs = nbmsecs;   /* number of milliseconds in x-axis */
                this.nbpoints = nbpoints; /* number of points plotted */

                $(this.ldiv).empty ( );

                if ( blockchain != null )
                    this.update ( false );
            };

            /* update a chart for (re-)plotting */
            this.update = function ( replot )
            {
                if ( this.chart_options.hasOwnProperty('yaxis') )
                    this.chart_options.yaxis.position = yaxis_position;

                if ( this.has_log )
                {
                    var setLogAxis = function ( a ) {
                        a.transform = function (v) { if(v<1)return 0; return (Math.log(v) / Math.LN10); };
                        a.inverseTransform = function (v) { if(v==0)return 0; return Math.exp(v*Math.LN10); };
                    };

                    var restoreAxis = function ( a ) {
                        a.transform = null;
                        a.inverseTransform = null;
                        a.ticks = null;
                        a.min = 0;
                    };

                    var op = (this.log ? setLogAxis : restoreAxis);
                    if ( typeof this.chart_options.yaxis !== 'undefined' )
                        op ( this.chart_options.yaxis );
                    else if ( typeof this.chart_options.yaxes !== 'undefined' )
                        for ( var i=0; i<this.chart_options.yaxes.length; ++i )
                            op ( this.chart_options.yaxes[i] );
                }

                if ( replot )
                    this.plot ( );
            };

            /* finalize */
            this.finalize = function ( plots )
            {
                if ( this.has_log )
                {
                    if ( this.log )
                    {
                        if ( typeof this.chart_options.yaxis !== 'undefined' )
                        {
                            this.chart_options.yaxis.ticks = this.computeLogTicks ( plots, false );
                            this.chart_options.yaxis.min = this.chart_options.yaxis.ticks[0];
                        }
                        else
                        {
                            for ( var i=0; i<this.chart_options.yaxes.length; ++i )
                            {
                                this.chart_options.yaxes[i].ticks = this.computeLogTicks ( plots, false );
                                this.chart_options.yaxes[i].min = this.chart_options.yaxes[i].ticks[0];
                            }
                        }
                    }
                }
            };

            /* plot */
            this.plot = function ( )
            {
                if ( !this.shown )
                    return;

                if ( this.blockchain == null )
                {
                    $(this.cdiv).empty ( );
                    return;
                }

                this.chart_options.legend.container = $(this.ldiv);
                this.plot_single ( );
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

                if ( this.has_log )
                {
                    var ins = '';
                    ins += '<span id="'+this.cid+'_style"> | &nbsp;';
                    ins += 'log <a id="'+this.cid+'_log" href="#"><img class="btn" id="btn_'+this.cid+'_log" src="'+ui_img_button_enabled+'" alt="off"/></a> ';
                    $(this.tspan).append ( ins );

                    var self = this;
                    $('a#'+this.cid+'_log').on ( 'click', function(e) { e.preventDefault(); self.toggleLog(); } );
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

                    $(this.ldiv).css ( 'font-size', 'small' );
                    $(this.cdiv).css ( 'font-size', 'small' );
                }

                if ( this.has_log )
                {
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
                }

                // console.debug ( 'super: update controls ' + this.cid + this.constructor.getName()  );
            };

            /* removeControls */
            this.removeControls = function ( )
            {
                $(this.tspan).empty ( );
                $('a#'+this.cid+'_resize').off ( );

                if ( this.has_log )
                    $('a#'+this.cid+'_log').off ( );
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
     * Chart of Hashrate
     */
    var ChartHashrate = ( function ( )
    {
        var cls = function ( cid )
        {
            this.constructor['super'].call ( this, cid, 's', true );
            this.chart_options = { };

            /* tooltip formatting for log-scale mode */
            function formatHashrateTooltip ( label, x, y, item )
            {
                return '~' + formatTickHashrate(y) + '<br/> %x ';
            }

            /* update chart */
            var super_update = this.update;
            this.update = function ( replot )
            {
                /* should copy common_options first */
                this.chart_options = {
                    canvas: true,
                    tooltip: true,
                    tooltipOpts: { content: '%y.2<br/> %x', xDateFormat: '%d-%b-%Y %H:%M:%S' },
                    series: { candlestick: { active:false }},
                    legend: { position:'nw', margin:0, backgroundOpacity:0.5, backgroundColor:color_chart_legend_bg, noColumns:2 },
                    lines: { show:true, lineWidth:width_line_raw },
                    grid: { hoverable:true, borderWidth:'0' },
                    points: {show:false },
                    xaxis: { mode: 'time', timezone:'browser', timeformat:'%H:%M:%S', font:{color:color_chart_axis_text},
                             color:color_chart_axis, autoscaleMargin:0.005, ticks:null },
                    yaxes: [ { font:{color:color_chart_axis_text}, labelWidth:lbl_width, tickDecimals:1,
                               alignTicksWithAxis:1, position:yaxis_position, color:color_chart_axis, tickFormatter:formatTickHashratePHs },
                             { font:{color:color_chart_axis_text}, labelWidth:lbl_width, tickDecimals:1,
                               alignTicksWithAxis:1, position:'right', color:color_chart_axis, tickFormatter:formatTickExponent } ]
                };

                this.chart_options.xaxis.timeformat = this.getTimeFormat ( );
                this.chart_options.legend.noColumns = 3;
                super_update.call ( this, replot );
            };

            /* plot a single exchange */
            this.plot_single = function ( )
            {
                if ( ! this.log )
                {
                    this.chart_options.yaxes[0].tickFormatter = formatTickHashratePHs;
                    this.chart_options.yaxes[0].min = null;
                    this.chart_options.yaxes[0].max = null;
                    this.chart_options.yaxes[1].min = null;
                    this.chart_options.yaxes[1].max = null;
                    var p = $.plot ( this.cdiv, [ { data:this.blockchain.hashrate_phs, yaxis:1 },
                                                  { data:this.blockchain.difficulty, yaxis:2 },
                                                  { data:this.blockchain.hashrate_phs_ema, yaxis:1 } ],
                                                this.chart_options );

                    var axes = p.getAxes ( );
                    var min = Math.min  ( hrate2diff(axes.yaxis.min), axes.y2axis.min );
                    var max = Math.max  ( hrate2diff(axes.yaxis.max), axes.y2axis.max );
                    var plots = [ ];

                    plots.push ( { data:this.blockchain.difficulty, label:'difficulty', color:color_chart_diff, fillBelowTo:'zero', id:'0',
                                   yaxis:2, tooltipFormat:'difficulty<br/>%y.0 <br/> %x ', lines:{lineWidth:width_line_max*3} } );
                    plots.push ( { data:this.blockchain.hashrate_phs, label:'hashrate', id:'1',
                                   color:color_chart_hashrate, yaxis:1, lines:{lineWidth:width_line_raw*1.2}, tooltipFormat:'~%y.1 Ph/s<br/> %x ' } );
                    plots.push ( { data:this.blockchain.hashrate_phs_ema, label:'ema', color:color_chart_hashrate_ema, id:'2',
                                   yaxis:1, lines:{lineWidth:width_line_ema}, tooltipFormat:'~%y.1 Ph/s<br/> %x ' } );
                    this.chart_options.yaxes[0].min = diff2hrate ( min );
                    this.chart_options.yaxes[0].max = diff2hrate ( max );
                    this.chart_options.yaxes[1].min = min;
                    this.chart_options.yaxes[1].max = max;
                    this.chart_options.yaxes[1].position = (yaxis_position=='right') ? 'left' : 'right';
                    $.plot ( this.cdiv, plots, this.chart_options );
                }
                else
                {
                    this.chart_options.yaxes[0].tickFormatter = formatTickHashrateMHs;
                    var plots = [ ];
                    plots.push ( {data:this.blockchain.hashrate, label:'hashrate',color:color_chart_hashrate,yaxis:1,lines:{lineWidth:width_line_raw*2},tooltipFormat:formatHashrateTooltip} );
                    plots.push ( {data:this.blockchain.hashrate_ema, label:'ema',color:color_chart_hashrate_ema,yaxis:1,lines:{lineWidth:width_line_ema},tooltipFormat:formatHashrateTooltip} );
                    this.finalize ( plots );
                    $.plot ( this.cdiv, plots, this.chart_options );
                }
            };

            this.addControls ( );
        };

        inherit ( cls, Chart );
        cls.getName = function ( ) { return 'hashrate'; };
        cls.getTitle = function ( ) { return 'Hashrate (H/s)'; };
        return cls;
    } ) ( );


    /*
     * Chart of Nb. Blocks
     */
    var ChartNbBlocks = ( function ( )
    {
        var cls = function ( cid )
        {
            this.constructor['super'].call ( this, cid, 's', false );
            this.chart_options = { };
            this.target = [ ];

            /* update chart */
            var super_update = this.update;
            this.update = function ( replot )
            {
                this.chart_options = jQuery.extend ( true, {}, common_lines_options );
                this.chart_options.xaxis.timeformat = this.getTimeFormat ( );
                this.chart_options.legend.noColumns = 3;
                this.chart_options.tooltipOpts.content = '%y blocks<br/> %x';
                this.chart_options.yaxis.tickFormatter = null;

                var nb = views_table[config.view].precision / 600;
                this.target = [ ];
                this.target.push ( [ this.blockchain.nb_blocks[0][0], nb ] );
                this.target.push ( [ this.blockchain.nb_blocks[this.blockchain.nb_blocks.length-1][0], nb ] );

                super_update.call ( this, replot );
            };

            this.plot_single = function ( )
            {
                $.plot ( this.cdiv, [ {data:this.blockchain.nb_blocks, label:'nb. blocks', color:color_chart_nbblocks, lines:{lineWidth:width_line_raw}},
                                      {data:this.blockchain.nb_blocks_ema26, label:'ema', color:color_chart_nbblocks_ema, lines:{lineWidth:width_line_ema}},
                                      {data:this.target, label:'target', color:color_chart_target, lines:{lineWidth:width_line_max}} ],
                                    this.chart_options );
            };

            this.addControls ( );
        };

        inherit ( cls, Chart );
        cls.getName = function ( ) { return 'nbblocks'; };
        cls.getTitle = function ( ) { return 'Nb. Blocks'; };
        return cls;
    } ) ( );


    /*
     * Chart of Blocks Interval
     */
    var ChartBlocksInterval = ( function ( )
    {
        var cls = function ( cid )
        {
            this.constructor['super'].call ( this, cid, 's', false );
            this.chart_options = { };
            this.blockstime = [ ];
            this.blockstime_ema26 = [ ];
            this.target = [ ];

            /* update chart */
            var super_update = this.update;
            this.update = function ( replot )
            {
                this.chart_options = jQuery.extend ( true, {}, common_lines_options );
                this.chart_options.xaxis.timeformat = this.getTimeFormat ( );
                this.chart_options.legend.noColumns = 3;
                this.chart_options.tooltipOpts.content = '%y seconds<br/> %x';
                this.chart_options.yaxis.tickFormatter = null;

                this.blockstime = [ ];
                this.blockstime_ema26 = [ ];
                for ( var i=0; i<this.blockchain.nb_blocks.length; ++i )
                {
                    this.blockstime.push ( [ this.blockchain.worktime[i][0], this.blockchain.worktime[i][1]/this.blockchain.nb_blocks[i][1] ] );
                    this.blockstime_ema26.push ( [ this.blockchain.worktime_ema26[i][0], this.blockchain.worktime_ema26[i][1]/this.blockchain.nb_blocks_ema26[i][1] ] );
                }

                this.target = [ ];
                this.target.push ( [ this.blockchain.nb_blocks[0][0], 600 ] );
                this.target.push ( [ this.blockchain.nb_blocks[this.blockchain.nb_blocks.length-1][0], 600 ] );

                super_update.call ( this, replot );
            };

            this.plot_single = function ( )
            {
                $.plot ( this.cdiv, [ {data:this.blockstime, label:'blocks interval', color:color_chart_nbblocks, lines:{lineWidth:width_line_raw}},
                                      {data:this.blockstime_ema26, label:'ema', color:color_chart_nbblocks_ema, lines:{lineWidth:width_line_ema}},
                                      {data:this.target, label:'target', color:color_chart_target, lines:{lineWidth:width_line_max}} ],
                                    this.chart_options );
            };

            this.addControls ( );
        };

        inherit ( cls, Chart );
        cls.getName = function ( ) { return 'interval'; };
        cls.getTitle = function ( ) { return 'Blocks Interval (s)'; };
        return cls;
    } ) ( );


    /*
     * Chart of Nb. Coins
     * todo: fix computation ; current results are wrong
     */
    var ChartNbCoins = ( function ( )
    {
        var cls = function ( cid )
        {
            this.constructor['super'].call ( this, cid, 's', false );
            this.chart_options = { };
            this.nb_coins = [ ];
            this.target = [ ];
            this.halving = 210000;

            this.getNbCoins = function ( bid )
            {
                var reward = 50;
                var total = 0;
                while ( bid > 0 )
                {
                    var nb_blocks = 1 + Math.min ( this.halving, bid );
                    total += reward * nb_blocks;
                    bid -= nb_blocks;
                    reward = reward / 2.0;
                }
                return total;
            };

            this.getTargetBlockIdAt = function ( tstamp )
            {
                /* block 0 timestamp @1231006505 (below in millisecond) */
                return Math.floor ( (tstamp - 1231006505000) / 600000 );
            };

            /* update chart */
            var super_update = this.update;
            this.update = function ( replot )
            {
                this.chart_options = jQuery.extend ( true, {}, common_lines_options );
                this.chart_options.xaxis.timeformat = this.getTimeFormat ( );
                this.chart_options.legend.noColumns = 3;
                this.chart_options.tooltipOpts.content = '%y BTC<br/> %x';
                this.chart_options.yaxis.tickFormatter = formatTickUnit;

                this.nb_coins = [ ];
                this.target = [ ];

                if ( this.blockchain.block_id.length > 1 )
                {
                    var bid = this.blockchain.block_id[0][1];
                    var nbc = this.getNbCoins ( bid );
                    var reward = getCoinbase ( bid );
                    var target_bid = this.getTargetBlockIdAt ( this.blockchain.block_id[0][0] );
                    var target_nbc = this.getNbCoins ( target_bid );
                    var target_reward = getCoinbase ( target_bid );
                    for ( var i=0; i<this.blockchain.block_id.length; ++i )
                    {
                        this.nb_coins.push ( [ this.blockchain.block_id[i][0], nbc ] );
                        nbc += reward * this.blockchain.nb_blocks[i][1];
                        bid += this.blockchain.nb_blocks[i][1];
                        reward = getCoinbase ( bid );

                        this.target.push ( [ this.blockchain.block_id[i][0], target_nbc ] );
                        var new_target_bid = this.getTargetBlockIdAt ( this.blockchain.block_id[i][0] );
                        target_nbc += target_reward * (new_target_bid-target_bid);
                        target_bid = new_target_bid;
                        target_reward = getCoinbase ( target_bid );
                    }

                    /* target future (disabled)
                    var target_stamp = this.blockchain.block_id[this.blockchain.block_id.length-1][0];
                    for ( var i=0; i<24; ++i )
                    {
                        target_stamp += 15768000000;
                        var new_target_bid = this.getTargetBlockIdAt ( target_stamp );
                        target_nbc += target_reward * (new_target_bid-target_bid);
                        this.target.push ( [ target_stamp, target_nbc ] );
                        target_bid = new_target_bid;
                        target_reward = 50 / Math.pow ( 2, Math.floor(target_bid/this.halving) );
                    }
                    */
                }

                super_update.call ( this, replot );
            };

            this.plot_single = function ( )
            {
                $.plot ( this.cdiv, [ {data:this.nb_coins, label:'minted', color:color_chart_nbblocks_ema, lines:{lineWidth:width_line_raw}},
                                      {data:this.target, label:'target', color:color_chart_target, lines:{lineWidth:width_line_max}} ],
                                    this.chart_options );
            };

            this.addControls ( );
        };

        inherit ( cls, Chart );
        cls.getName = function ( ) { return 'nbcoins'; };
        cls.getTitle = function ( ) { return 'Nb. Coins Minted (BTC)'; };
        return cls;
    } ) ( );


    /*
     * Chart of Miners Revenue
     * todo: fix computation ; coinbase total does not take properly into account halving
     */
    var ChartMinersRevenue = ( function ( )
    {
        var cls = function ( cid )
        {
            this.constructor['super'].call ( this, cid, 's', true );
            this.chart_options = { };
            this.coinbase = [ ];
            this.revenue = [ ];
            this.log = true;

            /* update chart */
            var super_update = this.update;
            this.update = function ( replot )
            {
                this.chart_options = jQuery.extend ( true, {}, common_lines_options );
                this.chart_options.xaxis.timeformat = this.getTimeFormat ( );
                this.chart_options.tooltipOpts.content = '%y BTC<br/> %x';
                this.chart_options.yaxis.tickFormatter = formatTickUnit;
                this.chart_options.series = { stack:true };

                this.coinbase = [ ];
                this.revenue = [ ];

                for ( var i=0; i<this.blockchain.size.length; ++i )
                {
                    var coinbase = this.blockchain.nb_blocks[i][1] * getCoinbase(this.blockchain.block_id[i][1]);
                    this.coinbase.push ( [ this.blockchain.fees[i][0], coinbase ] );
                    this.revenue.push ( [ this.blockchain.fees[i][0], this.blockchain.fees[i][1]+coinbase ] );
                }

                super_update.call ( this, replot );
            };

            this.plot_single = function ( )
            {
                var plots = [ ];
                plots.push ( {data:this.blockchain.fees, label:'fees', color:color_chart_volume, lines:{lineWidth:width_line_raw}, fillBelowTo:'zero', id:'1'} );
                plots.push ( {data:this.coinbase, label:'coinbase', color:color_chart_nbblocks, lines:{lineWidth:width_line_raw}, fillBelowTo:'1', id:'0'} );
                this.finalize ( plots );
                $.plot ( this.cdiv, plots, this.chart_options );
            };

            this.addControls ( );
        };

        inherit ( cls, Chart );
        cls.getName = function ( ) { return 'revenue'; };
        cls.getTitle = function ( ) { return 'Revenue (BTC)'; };
        return cls;
    } ) ( );


    /*
     * Chart of Mining Pools
     */
    var ChartPools = ( function ( )
    {
        var cls = function ( cid )
        {
            this.constructor['super'].call ( this, cid, 's', false );
            this.chart_options = { };
            this.pools_series = [ ];

            /* blocks window */
            this.window = 672; /* default window is 672 */

            this.setWindow = function ( win )
            {
                this.window = win;
                selected_pools_window = this.window;

                this.updateControls ( );
                this.update ( true );
                togglePoolsWindow ( );
            };

            /* configuration */
            var super_set_config = this.setConfig;
            this.setConfig = function ( conf )
            {
                if ( conf.hasOwnProperty('window') )
                {
                    var w = conf.window;

                    if ( w == 224 )
                        this.window = 224;
                    else if ( w == 2016 )
                        this.window = 2016;
                }

                selected_pools_window = this.window;
                super_set_config.call ( this, conf ); /* called last to update controls */
            };

            var super_get_config = this.getConfig;
            this.getConfig = function ( )
            {
                var conf = super_get_config.call ( this );
                conf['window'] = this.window;
                return conf;
            };

            /* update chart */
            var super_update = this.update;
            this.update = function ( replot )
            {
                this.chart_options = jQuery.extend ( true, {}, common_lines_options );
                this.chart_options.xaxis.timeformat = this.getTimeFormat ( );
                this.chart_options.tooltipOpts.content = '%y of blocks<br/> %x';
                this.chart_options.yaxis.tickFormatter = formatTickUnsignedPercent;
                this.chart_options.legend.noColumns = this.blockchain.pools.length;

                this.pools_series = [ ];
                for ( var i=0; i<this.blockchain.pools.length; ++i )
                    this.pools_series.push ( { data:this.blockchain.pools[i], label:this.blockchain.pools_names[i],
                                               color:colors_chart_pools[i%colors_chart_pools.length],
                                               tooltipFormat:(this.blockchain.pools_names[i]+' %y.2 %<br/> %x') } );

                super_update.call ( this, replot );
            };

            this.plot_single = function ( )
            {
                $.plot ( this.cdiv, this.pools_series, this.chart_options );
            };

            /* addControls */
            var super_add_controls = this.addControls;
            this.addControls = function ( )
            {
                super_add_controls.call ( this );

                var ins = '';
                ins += '<span id="'+this.cid+'_window"> | &nbsp;';
                ins += '224<a id="'+this.cid+'_win_224" href="#"><img class="btn" id="btn_'+this.cid+'_win_224" src="'+ui_img_toggle_disabled+'"></a> ' +
                       '672<a id="'+this.cid+'_win_672" href="#"><img class="btn" id="btn_'+this.cid+'_win_672" src="'+ui_img_toggle_enabled+'" /></a> ' +
                       '2016<a id="'+this.cid+'_win_2016" href="#"><img class="btn" id="btn_'+this.cid+'_win_2016" src="'+ui_img_toggle_disabled+'" /></a>';
                ins += '</span>';
                ins +=  ' |&nbsp;';
                ins += 'courtesy of <a style="color:#bbb" href="http://mempool.info" target="_blank">mempool.info</a>';
                $(this.tspan).append ( ins );

                var self = this;
                $('a#'+this.cid+'_win_224').on ( 'click', function(e) { e.preventDefault(); self.setWindow(224); } );
                $('a#'+this.cid+'_win_672').on ( 'click', function(e) { e.preventDefault(); self.setWindow(672); } );
                $('a#'+this.cid+'_win_2016').on ( 'click', function(e) { e.preventDefault(); self.setWindow(2016); } );

                this.updateControls ( );
            };

            /* updateControls */
            var super_update_controls = this.updateControls;
            this.updateControls = function ( )
            {
                super_update_controls.call ( this );

                if ( this.window == 224 )
                {
                    $('img#btn_'+this.cid+'_win_224').attr ( 'src', ui_img_toggle_enabled );
                    $('img#btn_'+this.cid+'_win_672').attr ( 'src', ui_img_toggle_disabled );
                    $('img#btn_'+this.cid+'_win_2016').attr ( 'src', ui_img_toggle_disabled );
                }
                else if ( this.window == 2016 )
                {
                    $('img#btn_'+this.cid+'_win_224').attr ( 'src', ui_img_toggle_disabled );
                    $('img#btn_'+this.cid+'_win_672').attr ( 'src', ui_img_toggle_disabled );
                    $('img#btn_'+this.cid+'_win_2016').attr ( 'src', ui_img_toggle_enabled );
                }
                else
                {
                    $('img#btn_'+this.cid+'_win_224').attr ( 'src', ui_img_toggle_disabled );
                    $('img#btn_'+this.cid+'_win_672').attr ( 'src', ui_img_toggle_enabled );
                    $('img#btn_'+this.cid+'_win_2016').attr ( 'src', ui_img_toggle_disabled );
                }
            };

            /* removeControls */
            var super_remove_controls = this.removeControls;
            this.removeControls = function ( )
            {
                $('a#'+this.cid+'_win_224').off ( );
                $('a#'+this.cid+'_win_672').off ( );
                $('a#'+this.cid+'_win_2016').off ( );
                super_remove_controls.call ( this );
            };

            this.addControls ( );
        };

        inherit ( cls, Chart );
        cls.getName = function ( ) { return 'pools'; };
        cls.getTitle = function ( ) { return 'Mining Pools'; };
        return cls;
    } ) ( );

    /*
     * Chart of Mempool Size
     */
    var ChartMempool = ( function ( )
    {
        var cls = function ( cid )
        {
            this.constructor['super'].call ( this, cid, 's', true );
            this.chart_options = { };
            this.target = [ ];
            this.log = true;

            /* update chart */
            var super_update = this.update;
            this.update = function ( replot )
            {
                this.chart_options = jQuery.extend ( true, {}, common_lines_options );
                this.chart_options.xaxis.timeformat = this.getTimeFormat ( );
                this.chart_options.legend.noColumns = 3;
                this.chart_options.tooltipOpts.content = '%y transactions<br/> %x';
                this.chart_options.yaxis.tickFormatter = null;

                var nb = views_table[config.view].precision / 600;

                super_update.call ( this, replot );
            };

            this.plot_single = function ( )
            {
                var plots = [ ];
                plots.push ( {data:this.blockchain.mempool_size, label:'nb. txs', color:color_chart_nbblocks, lines:{lineWidth:width_line_raw*1.4}} );
                plots.push ( {data:this.blockchain.mempool_max_size, label:'max', color:color_chart_target, lines:{lineWidth:width_line_max*1.4}} );
                this.finalize ( plots );
                $.plot ( this.cdiv, plots, this.chart_options );
            };

            this.addControls ( );
        };

        inherit ( cls, Chart );
        cls.getName = function ( ) { return 'mempool'; };
        cls.getTitle = function ( ) { return 'Mempool Size'; };
        return cls;
    } ) ( );

    /*
     * Chart of NB. Transactions
     */
    var ChartNbTx = ( function ( )
    {
        var cls = function ( cid )
        {
            this.constructor['super'].call ( this, cid, 's', true );
            this.chart_options = { };

            /* update chart */
            var super_update = this.update;
            this.update = function ( replot )
            {
                this.chart_options = jQuery.extend ( true, {}, common_lines_options );
                this.chart_options.xaxis.timeformat = this.getTimeFormat ( );
                this.chart_options.tooltipOpts.content = '%y transactions<br/> %x';
                this.chart_options.yaxis.tickFormatter = formatTickUnit;
                super_update.call ( this, replot );
            };

            this.plot_single = function ( )
            {
                var plots = [ ];
                plots.push ( {data:this.blockchain.nb_tx, label:'nb. tx', color:color_chart_nbtx, lines:{lineWidth:width_line_raw}} );
                plots.push ( {data:this.blockchain.nb_tx_ema26, label:'ema', color:color_chart_nbtx_ema, lines:{lineWidth:width_line_ema}} );
                this.finalize ( plots );
                $.plot ( this.cdiv, plots, this.chart_options );
            };

            this.addControls ( );
        };

        inherit ( cls, Chart );
        cls.getName = function ( ) { return 'nbtx'; };
        cls.getTitle = function ( ) { return 'Nb. Transactions'; };
        return cls;
    } ) ( );


    /*
     * Chart of Total NB. Transactions
     */
    var ChartNbTxTotal = ( function ( )
    {
        var cls = function ( cid )
        {
            this.constructor['super'].call ( this, cid, 's', true );
            this.chart_options = { };

            /* update chart */
            var super_update = this.update;
            this.update = function ( replot )
            {
                this.chart_options = jQuery.extend ( true, {}, common_lines_options );
                this.chart_options.xaxis.timeformat = this.getTimeFormat ( );
                this.chart_options.tooltipOpts.content = '%y transactions<br/> %x';
                this.chart_options.yaxis.tickFormatter = formatTickUnit;
                super_update.call ( this, replot );
            };

            this.plot_single = function ( )
            {
                var plots = [ ];
                plots.push ( {data:this.blockchain.nb_tx_total, label:'total nb. tx', color:color_chart_nbtx, lines:{lineWidth:width_line_ema}} );
                this.finalize ( plots );
                $.plot ( this.cdiv, plots, this.chart_options );
            };

            this.addControls ( );
        };

        inherit ( cls, Chart );
        cls.getName = function ( ) { return 'nbtxtotal'; };
        cls.getTitle = function ( ) { return 'Nb. Transactions (Total)'; };
        return cls;
    } ) ( );


    /*
     * Chart of Transactions Rate
     */
    var ChartTxRate = ( function ( )
    {
        var cls = function ( cid )
        {
            this.constructor['super'].call ( this, cid, 's', true );
            this.chart_options = { };
            this.txrate = [ ];
            this.txrate_ema26 = [ ];

            /* update chart */
            var super_update = this.update;
            this.update = function ( replot )
            {
                this.chart_options = jQuery.extend ( true, {}, common_lines_options );
                this.chart_options.xaxis.timeformat = this.getTimeFormat ( );
                this.chart_options.tooltipOpts.content = '%y tx/s<br/> %x';
                this.chart_options.yaxis.tickFormatter = formatTickUnit;

                this.txrate = [ ];
                this.txrate_ema26 = [ ];

                for ( var i=0; i<this.blockchain.nb_tx.length; ++i )
                {
                    this.txrate.push ( [ this.blockchain.nb_tx[i][0], this.blockchain.nb_tx[i][1]/this.blockchain.worktime[i][1] ] );
                    this.txrate_ema26.push (  [ this.blockchain.nb_tx_ema26[i][0], this.blockchain.nb_tx_ema26[i][1]/this.blockchain.worktime_ema26[i][1] ] );
                }

                super_update.call ( this, replot );
            };

            this.plot_single = function ( )
            {
                var plots = [ ];
                plots.push ( {data:this.txrate, label:'rate', color:color_chart_nbtx, lines:{lineWidth:width_line_raw}} );
                plots.push ( {data:this.txrate_ema26, label:'ema', color:color_chart_nbtx_ema, lines:{lineWidth:width_line_ema}} );
                this.finalize ( plots );
                $.plot ( this.cdiv, plots, this.chart_options );
            };

            this.addControls ( );
        };

        inherit ( cls, Chart );
        cls.getName = function ( ) { return 'txrate'; };
        cls.getTitle = function ( ) { return 'Transactions rate (tx/s)'; };
        return cls;
    } ) ( );


    /*
     * Chart of BTC Volume
     */
    var ChartVolume = ( function ( )
    {
        var cls = function ( cid )
        {
            this.constructor['super'].call ( this, cid, 's', true );
            this.chart_options = { };

            /* update chart */
            var super_update = this.update;
            this.update = function ( replot )
            {
                this.chart_options = jQuery.extend ( true, {}, common_lines_options );
                this.chart_options.xaxis.timeformat = this.getTimeFormat ( );
                this.chart_options.tooltipOpts.content = '%y BTC<br/> %x';
                this.chart_options.yaxis.tickFormatter = formatTickUnit;
                super_update.call ( this, replot );
            };

            this.plot_single = function ( )
            {
                var plots = [ ];
                plots.push ( {data:this.blockchain.volume, label:'volume', color:color_chart_volume, lines:{lineWidth:width_line_raw}} );
                plots.push ( {data:this.blockchain.volume_ema26, label:'ema', color:color_chart_volume_ema, lines:{lineWidth:width_line_ema}} );
                this.finalize ( plots );
                $.plot ( this.cdiv, plots, this.chart_options );
            };

            this.addControls ( );
        };

        inherit ( cls, Chart );
        cls.getName = function ( ) { return 'volume'; };
        cls.getTitle = function ( ) { return 'Volume (BTC)'; };
        return cls;
    } ) ( );


    /*
     * Chart of BTC Volume Per Tx
     */
    var ChartVolumePerTx = ( function ( )
    {
        var cls = function ( cid )
        {
            this.constructor['super'].call ( this, cid, 's', true );
            this.chart_options = { };
            this.volume_per_tx = [ ];
            this.volume_per_tx_ema26 = [ ];

            /* update chart */
            var super_update = this.update;
            this.update = function ( replot )
            {
                this.chart_options = jQuery.extend ( true, {}, common_lines_options );
                this.chart_options.xaxis.timeformat = this.getTimeFormat ( );
                this.chart_options.tooltipOpts.content = '~%y BTC/tx<br/> %x';
                this.chart_options.yaxis.tickFormatter = formatTickUnit;

                this.volume_per_tx = [ ];
                this.volume_per_tx_ema26 = [ ];

                for ( var i=0; i<this.blockchain.nb_tx.length; ++i )
                {
                    this.volume_per_tx.push ( [ this.blockchain.nb_tx[i][0], this.blockchain.volume[i][1]/this.blockchain.nb_tx[i][1] ] );
                    this.volume_per_tx_ema26.push (  [ this.blockchain.nb_tx_ema26[i][0], this.blockchain.volume_ema26[i][1]/this.blockchain.nb_tx_ema26[i][1] ] );
                }

                super_update.call ( this, replot );
            };

            this.plot_single = function ( )
            {
                var plots = [ ];
                plots.push ( {data:this.volume_per_tx, label:'avg BTC/tx', color:color_chart_volume, lines:{lineWidth:width_line_raw}} );
                plots.push ( {data:this.volume_per_tx_ema26, label:'ema', color:color_chart_volume_ema, lines:{lineWidth:width_line_ema}} );
                this.finalize ( plots );
                $.plot ( this.cdiv, plots, this.chart_options );
            };

            this.addControls ( );
        };

        inherit ( cls, Chart );
        cls.getName = function ( ) { return 'volumepertx'; };
        cls.getTitle = function ( ) { return 'Volume per Tx (BTC/tx)'; };
        return cls;
    } ) ( );


    /*
     * Chart of Block Size
     */
    var ChartBlockSize = ( function ( )
    {
        var cls = function ( cid )
        {
            this.constructor['super'].call ( this, cid, 's', true );
            this.chart_options = { };

            /* update chart */
            var super_update = this.update;
            this.update = function ( replot )
            {
                this.chart_options = jQuery.extend ( true, {}, common_lines_options );
                this.chart_options.xaxis.timeformat = this.getTimeFormat ( );
                this.chart_options.tooltipOpts.content = '~%yb<br/> %x';
                this.chart_options.yaxis.tickFormatter = formatTickUnit;
                this.chart_options.legend.noColumns = 3;
                super_update.call ( this, replot );
            };

            this.plot_single = function ( )
            {
                var plots = [ ];
                plots.push ( {data:this.blockchain.size, label:'avg block size', color:color_chart_size, lines:{lineWidth:width_line_raw}} );
                plots.push ( {data:this.blockchain.size_ema26, label:'ema', color:color_chart_size_ema, lines:{lineWidth:width_line_ema}} );
                plots.push ( {data:this.blockchain.size_max, label:'max', color:color_chart_target, lines:{lineWidth:width_line_max}} );
                this.finalize ( plots );
                $.plot ( this.cdiv, plots, this.chart_options );
            };

            this.addControls ( );
        };

        inherit ( cls, Chart );
        cls.getName = function ( ) { return 'blocksize'; };
        cls.getTitle = function ( ) { return 'Block Size (bytes)'; };
        return cls;
    } ) ( );


    /*
     * Chart of Block Fees
     */
    var ChartBlockFees = ( function ( )
    {
        var cls = function ( cid )
        {
            this.constructor['super'].call ( this, cid, 's', true );
            this.chart_options = { };

            /* update chart */
            var super_update = this.update;
            this.update = function ( replot )
            {
                this.chart_options = jQuery.extend ( true, {}, common_lines_options );
                this.chart_options.xaxis.timeformat = this.getTimeFormat ( );
                this.chart_options.tooltipOpts.content = '%y BTC<br/> %x';
                this.chart_options.yaxis.tickFormatter = formatTickUnit;
                super_update.call ( this, replot );
            };

            this.plot_single = function ( )
            {
                var plots = [ ];
                plots.push ( {data:this.blockchain.fees, label:'fees', color:color_chart_volume, lines:{lineWidth:width_line_raw}} );
                plots.push ( {data:this.blockchain.fees_ema26, label:'ema', color:color_chart_volume_ema, lines:{lineWidth:width_line_ema}} );
                this.finalize ( plots );
                $.plot ( this.cdiv, plots, this.chart_options );
            };

            this.addControls ( );
        };

        inherit ( cls, Chart );
        cls.getName = function ( ) { return 'fees'; };
        cls.getTitle = function ( ) { return 'Fees (BTC)'; };
        return cls;
    } ) ( );


    /*
     * Chart of Fees per Block
     */
    var ChartFeesPerBlock = ( function ( )
    {
        var cls = function ( cid )
        {
            this.constructor['super'].call ( this, cid, 's', true );
            this.chart_options = { };
            this.feespb = [ ];
            this.feespb_ema26 = [ ];

            /* update chart */
            var super_update = this.update;
            this.update = function ( replot )
            {
                this.chart_options = jQuery.extend ( true, {}, common_lines_options );
                this.chart_options.xaxis.timeformat = this.getTimeFormat ( );
                this.chart_options.tooltipOpts.content = '~%y BTC per block<br/> %x';
                this.chart_options.yaxis.tickFormatter = formatTickSubUnit;

                this.feespb = [ ];
                this.feespb_ema26 = [ ];

                for ( var i=0; i<this.blockchain.size.length; ++i )
                {
                    this.feespb.push ( [ this.blockchain.fees[i][0], (this.blockchain.fees[i][1]/this.blockchain.nb_blocks[i][1]) ] );
                    this.feespb_ema26.push (  [ this.blockchain.fees_ema26[i][0],
                                                (this.blockchain.fees_ema26[i][1]/(this.blockchain.nb_blocks_ema26[i][1])) ] );
                }

                super_update.call ( this, replot );
            };

            this.plot_single = function ( )
            {
                var plots = [ ];
                plots.push ( {data:this.feespb, label:'avg per block', color:color_chart_volume, lines:{lineWidth:width_line_raw}} );
                plots.push ( {data:this.feespb_ema26, label:'ema', color:color_chart_volume_ema, lines:{lineWidth:width_line_ema}} );
                this.finalize ( plots );
                $.plot ( this.cdiv, plots, this.chart_options );
            };

            this.addControls ( );
        };

        inherit ( cls, Chart );
        cls.getName = function ( ) { return 'feespb'; };
        cls.getTitle = function ( ) { return 'Fees per Block (BTC/block)'; };
        return cls;
    } ) ( );


    /*
     * Chart of Fees per Tx
     */
    var ChartFeesPerTx = ( function ( )
    {
        var cls = function ( cid )
        {
            this.constructor['super'].call ( this, cid, 's', true );
            this.chart_options = { };
            this.feespt = [ ];
            this.feespt_ema26 = [ ];

            /* update chart */
            var super_update = this.update;
            this.update = function ( replot )
            {
                this.chart_options = jQuery.extend ( true, {}, common_lines_options );
                this.chart_options.xaxis.timeformat = this.getTimeFormat ( );
                this.chart_options.tooltipOpts.content = '~%y BTC per tx<br/> %x';
                this.chart_options.yaxis.tickFormatter = formatTickSubUnit;

                this.feespt = [ ];
                this.feespt_ema26 = [ ];

                for ( var i=0; i<this.blockchain.size.length; ++i )
                {
                    this.feespt.push ( [ this.blockchain.fees[i][0], (this.blockchain.fees[i][1]/this.blockchain.nb_tx[i][1]) ] );
                    this.feespt_ema26.push (  [ this.blockchain.fees_ema26[i][0],
                                                (this.blockchain.fees_ema26[i][1]/(this.blockchain.nb_tx_ema26[i][1])) ] );
                }

                super_update.call ( this, replot );
            };

            this.plot_single = function ( )
            {
                var plots = [ ];
                plots.push ( {data:this.feespt, label:'avg per tx', color:color_chart_volume, lines:{lineWidth:width_line_raw}} );
                plots.push ( {data:this.feespt_ema26, label:'ema', color:color_chart_volume_ema, lines:{lineWidth:width_line_ema}} );
                this.finalize ( plots );
                $.plot ( this.cdiv, plots, this.chart_options );
            };

            this.addControls ( );
        };

        inherit ( cls, Chart );
        cls.getName = function ( ) { return 'feespt'; };
        cls.getTitle = function ( ) { return 'Fees per Tx (BTC/tx)'; };
        return cls;
    } ) ( );


    /*
     * Chart of Fees relative to Tx Volume
     */
    var ChartFeesRelVolume = ( function ( )
    {
        var cls = function ( cid )
        {
            this.constructor['super'].call ( this, cid, 's', true );
            this.chart_options = { };
            this.feesrv = [ ];
            this.feesrv_ema26 = [ ];

            /* update chart */
            var super_update = this.update;
            this.update = function ( replot )
            {
                this.chart_options = jQuery.extend ( true, {}, common_lines_options );
                this.chart_options.xaxis.timeformat = this.getTimeFormat ( );
                this.chart_options.tooltipOpts.content = '~%y<br/> %x';
                this.chart_options.yaxis.tickFormatter = formatTickSubPercent;

                this.feesrv = [ ];
                this.feesrv_ema26 = [ ];

                for ( var i=0; i<this.blockchain.size.length; ++i )
                {
                    this.feesrv.push ( [ this.blockchain.fees[i][0], (this.blockchain.fees[i][1]/this.blockchain.volume[i][1])*100 ] );
                    this.feesrv_ema26.push (  [ this.blockchain.fees_ema26[i][0],
                                                (this.blockchain.fees_ema26[i][1]/(this.blockchain.volume_ema26[i][1]))*100 ] );
                }

                super_update.call ( this, replot );
            };

            this.plot_single = function ( )
            {
                var plots = [ ];
                plots.push ( {data:this.feesrv, label:'avg rate', color:color_chart_volume, lines:{lineWidth:width_line_raw}} );
                plots.push ( {data:this.feesrv_ema26, label:'ema', color:color_chart_volume_ema, lines:{lineWidth:width_line_ema}} );
                this.finalize ( plots );
                $.plot ( this.cdiv, plots, this.chart_options );
            };

            this.addControls ( );
        };

        inherit ( cls, Chart );
        cls.getName = function ( ) { return 'feesrv'; };
        cls.getTitle = function ( ) { return 'Fees rate (%)'; };
        return cls;
    } ) ( );


    /*
     * Chart of Block Version
     */
    var ChartBlockVersion = ( function ( )
    {
        var cls = function ( cid )
        {
            this.constructor['super'].call ( this, cid, 's', false );
            this.chart_options = { };

            /* update chart */
            var super_update = this.update;
            this.update = function ( replot )
            {
                this.chart_options = jQuery.extend ( true, {}, common_lines_options );
                this.chart_options.xaxis.timeformat = this.getTimeFormat ( );
                this.chart_options.tooltipOpts.content = 'version %y.0<br/> %x';
                this.chart_options.yaxis.tickFormatter = formatTickInt;
                this.chart_options.yaxis.ticks = [ 0, 1, 2, 3, 4 ];
                super_update.call ( this, replot );
            };

            this.plot_single = function ( )
            {
                var plots = [ ];
                plots.push ( {data:this.blockchain.version, label:'block version', color:color_chart_size, lines:{lineWidth:width_line_raw}} );
                plots.push ( {data:this.blockchain.version_ema10, label:'ema', color:color_chart_size_ema, lines:{lineWidth:width_line_ema}} );
                this.finalize ( plots );
                $.plot ( this.cdiv, plots, this.chart_options );
            };

            this.addControls ( );
        };

        inherit ( cls, Chart );
        cls.getName = function ( ) { return 'blockversion'; };
        cls.getTitle = function ( ) { return 'Block Version'; };
        return cls;
    } ) ( );


    /*
     * Chart of Transaction Size
     * This is not 100 % accurate
     */
    var ChartTransactionSize = ( function ( )
    {
        var cls = function ( cid )
        {
            this.constructor['super'].call ( this, cid, 's', true );
            this.chart_options = { };
            this.txsize = [ ];
            this.txsize_ema26 = [ ];

            /* update chart */
            var super_update = this.update;
            this.update = function ( replot )
            {
                this.chart_options = jQuery.extend ( true, {}, common_lines_options );
                this.chart_options.xaxis.timeformat = this.getTimeFormat ( );
                this.chart_options.tooltipOpts.content = '%ybytes<br/> %x';
                this.chart_options.yaxis.tickFormatter = formatTickUnit;

                this.txsize = [ ];
                this.txsize_ema26 = [ ];

                for ( var i=0; i<this.blockchain.size.length; ++i )
                {
                    /* considering 80 bytes block header */
                    this.txsize.push ( [ this.blockchain.size[i][0], (this.blockchain.size[i][1]-80)/(this.blockchain.nb_tx[i][1]/this.blockchain.nb_blocks[i][1]) ] );
                    this.txsize_ema26.push (  [ this.blockchain.size_ema26[i][0],
                                                (this.blockchain.size_ema26[i][1]-80)/(this.blockchain.nb_tx_ema26[i][1]/this.blockchain.nb_blocks_ema26[i][1]) ] );
                }

                super_update.call ( this, replot );
            };

            this.plot_single = function ( )
            {
                var plots = [ ];
                plots.push ( {data:this.txsize, label:'avg tx size', color:color_chart_size, lines:{lineWidth:width_line_raw}} );
                plots.push ( {data:this.txsize_ema26, label:'ema', color:color_chart_size_ema, lines:{lineWidth:width_line_ema}} );
                this.finalize ( plots );
                $.plot ( this.cdiv, plots, this.chart_options );
            };

            this.addControls ( );
        };

        inherit ( cls, Chart );
        cls.getName = function ( ) { return 'txsize'; };
        cls.getTitle = function ( ) { return 'Transaction Size (bytes)'; };
        return cls;
    } ) ( );


    /*
     * plotData
     */
    function plotData ( bc )
    {
        var nbmsecs = bc.block_id[bc.block_id.length-1][0] - bc.block_id[0][0];
        var nbpoints = bc.block_id.length;

        for ( cid in charts )
            charts[cid].prepare ( bc, nbmsecs, nbpoints );

        for ( cid in charts )
            charts[cid].plot ( );
    }


    /*
     * updateDisplay
     */
    function updateDisplay ( )
    {
        plotData ( blockchainData );
    }


    /****************************
     ** Network Stats Fetching **
     ****************************/

    function onFetchSuccess ( data )
    {
        nb_fetch_errors = 0;

        if ( fetchFull )
        {
            /* full dataset requested but it's not it, bail out */
            if ( data.f != 1 )
                return;

            /* the full dataset was fetched, overwrite previous_data with it */
            blockchainData = readNetworkData ( data.data );

            /* read difficulty data */
            readNetworkDifficulty ( blockchainData, data.data[0].diff );
            blockchainData.difficulty_data = data.data[0].diff;

            /* mining pools *
               DISABLED
            readNetworkPools ( blockchainData, data.data[0].poolstats );
            blockchainData.pools_data = data.data[0].poolstats;
             */

            fetchFull = false;
        }
        else if ( data.f == 0 )
        {
            new_data = data.data;
            updateNetworkData ( blockchainData, new_data[0].stats );

            /* difficulty data */
            var new_diff = new_data[0].diff;
            var prev_diff = blockchainData.difficulty_data;

            if ( prev_diff.length > 0 )
            {
                var l = prev_diff.pop ( );
                if ( l[1] != new_diff[0][1] )
                    prev_diff.push ( l );

                if ( prev_diff.length > 0 )
                    if ( (prev_diff[0][0]*1000) < blockchainData.block_id[0][0] ) /* if oldest line is too old */
                        prev_diff.shift ( );
            }
            prev_diff.push ( new_diff[0] );

            readNetworkDifficulty ( blockchainData, prev_diff );

            /* mining pools data */
            if ( pools_enabled )
            {
                /* DISABLED */
            var new_pools = new_data[0].poolstats;
            var prev_pools = blockchainData.pools_data;

            if ( prev_pools.length > 0 )
            {
                prev_pools.pop ( ); /* remove previous floating line */
                if ( prev_pools.length > 0 )
                {
                    var l = prev_pools.pop ( );    /* remove newest solid line */
                    if ( l[0] != new_pools[0][0] ) /* if newest solid line is different */
                        prev_pools.push ( l );     /* put previously newest solid line back */

                    if ( prev_pools.length > 0 )
                    {
                        /* if oldest solid line is too old */
                        if ( (l[0] - prev_pools[0][0]) > views_table[config.view].length )
                            prev_pools.shift ( ); /* skip oldest solid line */
                    }
                }
            }
            prev_pools.push ( new_pools[0] ); /* append new solid line */

            if ( new_pools.length > 1 )
                prev_pools.push ( new_pools[1] ); /* append new floating line */

                readNetworkPools ( blockchainData, prev_pools );
            }
        }

        coinorama_ticks_updateNetwork ( data.ticks );
        updateDisplay ( );
    }

    function onFetchError ( qid, text, error )
    {
        nb_fetch_errors += 1;

        if ( nb_fetch_errors > 3 )
        {
            $('span#winmsg_title').text ( 'Error' );
            $('div#winmsg_ctnt').html ( 'Sorry, latest network data could not be fetched.<br/>' +
                                        'The service is being upgraded/rebooted, or it crashed.<br/>' +
                                        'Please reload the page in a couple of minutes.<br/><br/>' );
            windowShow ( 'message' );
        }
    }

    function fetchData ( )
    {
        var params = [ ];
        var data_url = '/coinorama/data.bf';

        params.push ( 'v=' + config.view );

        /* no tick-only */
        params.push ( 'k=0' );

        /* fetch full history if required */
        if ( fetchFull )
            params.push ( 'f=1' );

        /* disabled
        if ( selected_pools_window != 672 )
            params.push ( 'p=' + selected_pools_window );
        */

        if ( params.length > 0 )
            data_url = data_url + '?' + params.join('&');

        $.ajax ( { url:data_url, type:'GET', dataType:'json', success:onFetchSuccess, error:onFetchError } );
        timeout_id = setTimeout ( fetchData, 30000 );
    }


    /****************************
     ** Network Stats Callback **
     ****************************/

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

    function selectNetworkViewLength ( v )
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

    function togglePoolsWindow ( )
    {
        if ( timeout_id != -1 )
            clearTimeout ( timeout_id );

        fetchFull = true;
        fetchData ( );
        saveConfig ( );
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

        /* one chart on the left : height h*0.98 */
        var h = Math.max ( 400, $(window).height()-(134+94+(2*43)) ); /* top + bottom */

        if ( charts['nl1'].expanded )
        {
            $('div#nl1_chart').css ( 'height', (h*(3/5)).toFixed(0)+'px' );
            $('div#nl2_chart').css ( 'height', (h*(1/5)).toFixed(0)+'px' );
            $('div#nl3_chart').css ( 'height', (h*(1/5)).toFixed(0)+'px' );
        }
        else if ( charts['nl2'].expanded )
        {
            $('div#nl1_chart').css ( 'height', (h*(1/5)).toFixed(0)+'px' );
            $('div#nl2_chart').css ( 'height', (h*(3/5)).toFixed(0)+'px' );
            $('div#nl3_chart').css ( 'height', (h*(1/5)).toFixed(0)+'px' );
        }
        else if ( charts['nl3'].expanded )
        {
            $('div#nl1_chart').css ( 'height', (h*(1/5)).toFixed(0)+'px' );
            $('div#nl2_chart').css ( 'height', (h*(1/5)).toFixed(0)+'px' );
            $('div#nl3_chart').css ( 'height', (h*(3/5)).toFixed(0)+'px' );
        }
        else
        {
            $('div#nl1_chart').css ( 'height', (h*(1/3)).toFixed(0)+'px' );
            $('div#nl2_chart').css ( 'height', (h*(1/3)).toFixed(0)+'px' );
            $('div#nl3_chart').css ( 'height', (h*(1/3)).toFixed(0)+'px' );
        }

        if ( charts['nr1'].expanded )
        {
            $('div#nr1_chart').css ( 'height', (h*(3/5)).toFixed(0)+'px' );
            $('div#nr2_chart').css ( 'height', (h*(1/5)).toFixed(0)+'px' );
            $('div#nr3_chart').css ( 'height', (h*(1/5)).toFixed(0)+'px' );
        }
        else if ( charts['nr2'].expanded )
        {
            $('div#nr1_chart').css ( 'height', (h*(1/5)).toFixed(0)+'px' );
            $('div#nr2_chart').css ( 'height', (h*(3/5)).toFixed(0)+'px' );
            $('div#nr3_chart').css ( 'height', (h*(1/5)).toFixed(0)+'px' );
        }
        else if ( charts['nr3'].expanded )
        {
            $('div#nr1_chart').css ( 'height', (h*(1/5)).toFixed(0)+'px' );
            $('div#nr2_chart').css ( 'height', (h*(1/5)).toFixed(0)+'px' );
            $('div#nr3_chart').css ( 'height', (h*(3/5)).toFixed(0)+'px' );
        }
        else
        {
            $('div#nr1_chart').css ( 'height', (h*(1/3)).toFixed(0)+'px' );
            $('div#nr2_chart').css ( 'height', (h*(1/3)).toFixed(0)+'px' );
            $('div#nr3_chart').css ( 'height', (h*(1/3)).toFixed(0)+'px' );
        }

        if ( replot > 1 )
            updateDisplay ( ); /* urgent replot requested */
        else if ( replot )
        {
            clearTimeout ( network_resize_timeout_id );
            network_resize_timeout_id = setTimeout ( updateDisplay, 200 );
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
    }

    /*
     * reduceChart
     * this is called by updateChartsLayout and at initilization
     */
    function reduceChart ( cid )
    {
        charts[cid].expanded = false;
        charts[cid].updateControls ( );
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
            panel_content = { 'nl1':1, 'nl2':2, 'nl3':3 }; /* left panel */
        else
            panel_content = { 'nr1':1, 'nr2':2, 'nr3':3 }; /* right panel */

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

    if ( coinorama_getCurrentSection() != 'N' )
        return;


    /***************************************
     ** User Configuration Initialization **
     ***************************************/

    /* set up charts types */
    var charts_categories = [ { name:'Mining', charts:[ChartHashrate, ChartNbBlocks, ChartBlocksInterval, ChartNbCoins, ChartMinersRevenue, ChartMempool /*, ChartPools */ ] },
                              { name:'Blocks', charts:[ChartBlockSize, ChartBlockVersion] },
                              { name:'Transactions', charts:[ChartNbTx, ChartNbTxTotal, ChartTxRate, ChartVolume, ChartVolumePerTx, ChartTransactionSize] },
                              { name:'Fees', charts:[ChartBlockFees, ChartFeesPerBlock, ChartFeesPerTx, ChartFeesRelVolume] }];

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
        ins += '<div id="' + cid + '_chart" class="network_chart"></div>';

        $('div#'+cid).prepend ( ins );
        $('select#cb_'+cid).on ( 'change', function() { toggleChartLocation(cid,this.value); } );
    }

    makeChartBox ( 'nl1' );
    makeChartBox ( 'nl2' );
    makeChartBox ( 'nl3' );
    makeChartBox ( 'nr1' );
    makeChartBox ( 'nr2' );
    makeChartBox ( 'nr3' );


    /* set up period selection table */
    function makeViewPeriodsList ( )
    {
        var ins = '';
        var prev_base = 'd';
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

        $('div#network_periods').append ( ins );
    }

    makeViewPeriodsList ( );

    $.each ( views_table, function(v) {
        $('a#view_'+v).on ( 'click', function(e) { e.preventDefault(); selectNetworkViewLength(v); } );
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

    $('a#toggle_yaxis_left').on ( 'click', function(e) { e.preventDefault(); toggleYaxisPosition('left'); } );
    $('a#toggle_yaxis_right').on ( 'click', function(e) { e.preventDefault(); toggleYaxisPosition('right'); } );


    /************************************
     ** Previous Configuration Loading **
     ************************************/

    readConfig ( );

    applyYaxisPosition ( );

    $.each ( charts, function(cid) {
        if ( config[cid].name == 'pools' )
            config[cid].name = 'mempool'; /* default, because pools is now disabled */
        charts[cid] = new charts_types[config[cid].name] ( cid );
        charts[cid].setConfig ( config[cid] );
        $('select#cb_'+cid+' option[value="'+config[cid].name+'"]').prop ( 'selected', true );
        $('a#toggle_'+cid).on ( 'click', function(e) { e.preventDefault(); toggleChart(cid); } );

        if ( charts[cid].expanded )
            expandChart ( cid );
    } );

    $('a#view_'+config.view).css ( 'color', color_item_enabled );

    $(window).resize ( function() { resizeCharts(1); });
    resizeCharts ( 0 );

    selectViewMode ( config.viewmode );
    selectNetworkViewLength ( config.view );
});
