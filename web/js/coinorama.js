/*
 * coinorama.js
 * Coinorama main JS file
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


/* todo: create exchange object that holds info & data */
var exchanges_info = [ ];
var exchanges_info_by_name = { };
var exchanges_uid = { };
var exchanges_views = [ ];

/*
 * currencies
 */
var currency_symbol = { 'USD':'$', 'EUR':'€', 'CNY':'¥',
                        'HKD':'HK$', 'BRL':'R$', 'PLN':'zł',
                        'CAD':'C$', 'ILS':'₪', 'KRW':'₩',
                        'GBP':'£', 'ARS':'ARS$', 'RUB':'ք',
                        'JPY':'¥', 'TRY':'₺', 'ZAR':'R',
                        'MXN':'M$', 'AUD':'A$', 'ETH':'Ξ',
                        'LTC':'Ł' };

var currency_name = { 'USD':'US Dollar', 'EUR':'Euro', 'CNY':'Chinese Yuan', 'HKD':'HK Dollar',
                      'PLN':'Polish Złoty', 'BRL':'Brazilian Real', 'CAD':'Canadian Dollar', 'ILS':'Israeli new Shekel',
                      'KRW':'South Korean Won', 'GBP':'Pound Sterling', 'ARS':'Argentine Peso', 'MXN':'Mexican Peso',
                      'RUB':'Russian Ruble', 'JPY':'Japanese Yen', 'TRY':'Turkish Lira', 'ZAR':'South African Rand',
                      'AUD':'Australian Dollar', 'LTC':'Litecoin', 'ETH':'Ether', 'BTC':'Bitcoin' };

function formatTickUSD ( val, axis ) { return formatTickCurrency ( val, '$' ); }
function formatTickEUR ( val, axis ) { return formatTickCurrency ( val, '€' ); }
function formatTickCNY ( val, axis ) { return formatTickCurrency ( val, '¥' ); }
function formatTickHKD ( val, axis ) { return formatTickCurrency ( val, 'HK$' ); }
function formatTickBRL ( val, axis ) { return formatTickCurrency ( val, 'R$' ); }
function formatTickPLN ( val, axis ) { return formatTickCurrency ( val, 'zł' ); }
function formatTickCAD ( val, axis ) { return formatTickCurrency ( val, 'C$' ); }
function formatTickILS ( val, axis ) { return formatTickCurrency ( val, '₪' ); }
function formatTickKRW ( val, axis ) { return formatTickCurrency ( val, '₩' ); }
function formatTickGBP ( val, axis ) { return formatTickCurrency ( val, '£' ); }
function formatTickRUB ( val, axis ) { return formatTickCurrency ( val, 'ք' ); }
function formatTickJPY ( val, axis ) { return formatTickCurrency ( val, '¥' ); }
function formatTickTRY ( val, axis ) { return formatTickCurrency ( val, '₺' ); }
function formatTickZAR ( val, axis ) { return formatTickCurrency ( val, 'R' ); }
function formatTickARS ( val, axis ) { return formatTickCurrency ( val, 'ARS$' ); }
function formatTickMXN ( val, axis ) { return formatTickCurrency ( val, 'M$' ); }
function formatTickAUD ( val, axis ) { return formatTickCurrency ( val, 'A$' ); }
function formatTickLTC ( val, axis ) { return formatTickCurrency ( val, 'Ł' ); }
function formatTickETH ( val, axis ) { return formatTickCurrency ( val, 'Ξ' ); }
function formatTickBTC ( val, axis ) { return formatTickUnit ( val, null ); } /* 'Ƀ' */

var currency_formatter = { 'USD':formatTickUSD, 'EUR':formatTickEUR, 'CNY':formatTickCNY, 'HKD':formatTickHKD,
                           'PLN':formatTickPLN, 'BRL':formatTickBRL, 'CAD':formatTickCAD, 'ILS':formatTickILS,
                           'KRW':formatTickKRW, 'GBP':formatTickGBP, 'ARS':formatTickARS, 'RUB':formatTickRUB,
                           'JPY':formatTickJPY, 'TRY':formatTickTRY, 'ZAR':formatTickZAR, 'MXN':formatTickMXN,
                           'AUD':formatTickAUD, 'LTC':formatTickLTC, 'ETH':formatTickETH, 'BTC':formatTickBTC };

function getExchangeCurrency ( name )
{
    return name.slice(-3,name.length);
}


var currency_list = [ ];
var exchanges_by_currency = { };


/*
 * formatters
 */

/* values */
function formatTickByte ( val, axis )
{
    if ( val >= 1024*1024*1024*1024 )
        return ''+(val/(1024*1024*1024*1024)).toFixed(1)+' T';
    if ( val >= 1024*1024*1024 )
        return ''+(val/(1024*1024*1024)).toFixed(1)+' G';
    if ( val >= 1024*1024 )
        return ''+(val/(1024*1024)).toFixed(1)+' M';
    if ( val >= 1024 )
        return ''+(val/1024).toFixed(1)+' K';
    return val.toFixed(1)+' ';
}

function formatTickUnit ( val, axis )
{
    if ( val >= 1000000000000 )
        return ''+(val/1000000000000).toFixed(1)+' T';
    if ( val >= 1000000000 )
        return ''+(val/1000000000).toFixed(1)+' G';
    if ( val >= 1000000 )
        return ''+(val/1000000).toFixed(1)+' M';
    if ( val >= 1000 )
        return ''+(val/1000).toFixed(1)+' K';
    return val.toFixed(1) +' ';
}

function SubUnitFormat ( val )
{
    if ( (val-Math.floor(val)) < 0.01 )
        return Math.floor(val).toPrecision(3);
    return val.toFixed(2);
}

function formatTickSubUnit ( val, axis )
{
    if ( val == 0 )
        return '0';
    if ( val >= 1 )
        return val.toFixed(1);
    if ( val < 1e-3 )
        return ''+SubUnitFormat(val*1e6)+' µ';
 
    return ''+SubUnitFormat(val*1e3)+' m';
}

function formatTickCurrency ( val, sym )
{
    if ( val >= 1000000000 )
        return ''+(val/1000000000).toFixed(1)+' G' + sym;
    if ( val >= 1000000 )
        return ''+(val/1000000).toFixed(1)+' M' + sym;
    if ( val >= 1000 )
        return ''+(val/1000).toFixed(1)+' K' + sym;
    return val.toFixed(1) + ' ' + sym;
}

function formatTickInt ( val, axis )
{
    return val.toFixed(0);
}

function formatTickPercent ( val, axis )
{
    if ( val > 0 )
        return '+'+val.toFixed(1)+'%';
    else
        return val.toFixed(1)+'%';
}

function formatTickSubPercent ( val, axis )
{
    if ( val > 0.01 )
        return '+'+val.toFixed(2)+' %';
    else
        return val.toFixed(3)+' %';
}

function formatTickUnsignedPercent ( val, axis )
{
    return val.toFixed(0)+'%';
}

/* duration */
function formatTickDuration ( val )
{
    if ( val < 60 )
        return val.toFixed(0)+' seconds';
    else if ( val < 120 )
        return '1 minute ' + (val%60).toFixed(0) + ' seconds';
    else if ( val < 3600 )
        return Math.floor(val/60).toFixed(0)+' minutes ' + (val%60).toFixed(0) + ' seconds';
    else if ( val < (3600*2) )
        return '1 hour ' + ((val%3600)/60).toFixed(0) + ' minutes';
    else if ( val < 86400 )
        return Math.floor(val/3600).toFixed(0)+' hours ' + ((val%3600)/60).toFixed(0) + ' minutes';
    else if ( val < (86400*2) )
        return '1 day ' + ((val%86400)/3600).toFixed(0) + ' hours';
    else
        return Math.floor(val/86400).toFixed(0)+' days ' + ((val%86400)/3600).toFixed(0) + ' hours';
}

function formatTickDurationRounded ( val )
{
    if ( val < 60 )
        return val.toFixed(0)+' seconds';
    else if ( val < 150 )
        return '1 minute';
    else if ( val < 3600 )
        return Math.round(val/60).toFixed(0)+' minutes';
    else if ( val < (3600+1800) )
        return '1 hour';
    else if ( val < (3600*48) )
        return Math.round(val/3600).toFixed(0)+' hours';
    else
        return Math.round(val/86400).toFixed(0)+' days';
}

/* hashrate */
function formatTickHashrate ( val )
{
    if ( val < 1000 )
        return val.toFixed(2)+' Mhash/s';
    else if ( val < 1000000 )
        return (val/1000).toFixed(2)+' Ghash/s';
    else if ( val < 1000000000 )
        return (val/1000000).toFixed(2)+' Thash/s';
    else if ( val < 1000000000000 )
        return (val/1000000000).toFixed(2)+' Phash/s';
    else
        return (val/1000000000000).toFixed(2)+' Ehash/s';
}

function formatTitleHashrate ( val )
{
    if ( val < 1000 )
        return val.toFixed(2)+' Mh/s';
    else if ( val < 1000000 )
        return (val/1000).toFixed(2)+' Gh/s';
    else if ( val < 1000000000 )
        return (val/1000000).toFixed(2)+' Th/s';
    else if ( val < 1000000000000 )
        return (val/1000000000).toFixed(2)+' Ph/s';
    else
        return (val/1000000000000).toFixed(2)+' Eh/s';
}



/*
 * helper to detect current section
*/
function coinorama_getCurrentSection ( )
{
    var path_args = document.location.pathname.split ( '/' );
    var i = 1;

    if ( path_args.length > 2 )
        i = 2;

    if ( path_args.length > 1 )
    {
        if ( path_args[i] == 'markets' )
            return 'M';
        else if ( path_args[i] == 'network' )
            return 'N';
        else if ( path_args[i] == 'blocks' )
            return 'B';
        else if ( path_args[i] == 'webapp.html' )
            return 'T';
        else if ( path_args[i] == 'api' )
            return 'A';
    }

    return 'M';
}



/*
 * 64-bit unsigned long integer
 * inspired by goog.math.Long
 */
Long = function(low, high) {
  this.low_ = low | 0;  // force into 32 signed bits.
  this.high_ = high | 0;  // force into 32 signed bits.
};

Long.fromBits = function(lowBits, highBits) {
    return new Long(lowBits, highBits);
};

Long.fromNumber = function(value) {
    if ( isNaN(value) || !isFinite(value) ) {
        return Long.ZERO;
    } else if (value <= -Long.TWO_PWR_63_DBL_) {
        return Long.MIN_VALUE;
    } else if (value + 1 >= Long.TWO_PWR_63_DBL_) {
        return Long.MAX_VALUE;
    } else {
        return new Long(
            (value % Long.TWO_PWR_32_DBL_) | 0,
            (value / Long.TWO_PWR_32_DBL_) | 0);
    }
};

Long.TWO_PWR_16_DBL_ = 1 << 16;
Long.TWO_PWR_32_DBL_ = Long.TWO_PWR_16_DBL_ * Long.TWO_PWR_16_DBL_;
Long.TWO_PWR_64_DBL_ = Long.TWO_PWR_32_DBL_ * Long.TWO_PWR_32_DBL_;
Long.TWO_PWR_63_DBL_ = Long.TWO_PWR_64_DBL_ / 2;
Long.ZERO = Long.fromNumber(0);

Long.prototype.getLowBitsUnsigned = function() {
    return (this.low_ >= 0) ? this.low_ : Long.TWO_PWR_32_DBL_ + this.low_;
};

Long.prototype.toNumber = function() {
    return this.high_ * Long.TWO_PWR_32_DBL_ + this.getLowBitsUnsigned();
};

Long.prototype.isZero = function() {
    return this.high_ == 0 && this.low_ == 0;
};

Long.prototype.and = function(other) {
    return Long.fromBits(this.low_ & other.low_,this.high_ & other.high_);
};

Long.prototype.xor = function(other) {
    return Long.fromBits(this.low_ ^ other.low_,this.high_ ^ other.high_);
};


/*
 * TICKERS
 */

var ticker_config = { };
for ( var cur in currency_symbol )
    ticker_config[cur] = true;


function loadTickerConfig ( )
{
    var c_value = document.cookie;
    var c_start = c_value.indexOf ( 'ticker=' );
    if ( c_start == -1 )
        return;
    c_start = c_value.indexOf ( '=', c_start ) + 1;
    var c_end = c_value.indexOf ( ';', c_start );
    if ( c_end != -1 )
        c_value = unescape ( c_value.substring(c_start,c_end) );
    else
        c_value = unescape ( c_value.substring(c_start) );

    var newconf;
    try { newconf = JSON.parse ( c_value ); }
    catch (e) { return; }

    for ( cur in ticker_config )
        if ( newconf.hasOwnProperty(cur) )
            ticker_config[cur] = newconf[cur];
}

function saveTickerConfig ( )
{
    var exdate = new Date();
    exdate.setDate ( exdate.getDate() + 366 );
    document.cookie = 'ticker=' + JSON.stringify(ticker_config) + '; expires=' + exdate.toUTCString();
}

var previous_markets_title_price = 0;
var previous_markets_tick_direction = { };
var previous_markets_tick_price = { };
var previous_network_block_number = 0;

for ( var e in exchanges_uid )
{
    /* todo: replace with exchanges_info */
    previous_markets_tick_direction[e] =  -1;
    previous_markets_tick_price[e] = 0;
}


/* timestamp */
function coinorama_getTimestamp ( )
{
    var today = new Date();
    return today.toDateString() + ', ' + today.toLocaleTimeString() ;
}

/* ticker maker */
function makeTicker ( )
{
    var section = coinorama_getCurrentSection ( );

    var ins = '<div id="info_live"><br/>' +
              '<div class="info_live_sub" style="text-align:center;">' +
              '<div id="timestamp"></div>' +
              '</div>' +
              '<hr style="background:#777; height:1px; border-width:0; margin-top:1em; margin-bottom:1em;" />' +
              '<div class="info_live_sub" style="text-align:center;">' +
              '<div id="summary"></div>' +
              '</div>' +
              '<hr style="background:#777; height:1px; border-width:0; margin-top:1em; margin-bottom:1em;" />';

    /* markets */
    var curr = '';

    for ( var ecurr in exchanges_by_currency ) /* for each currency */
    {
        for ( var i in exchanges_by_currency[ecurr] ) /* for each exchange in that currency */
        {
            var einfo = exchanges_by_currency[ecurr][i];

            if ( ecurr != curr )
            {
                if ( curr.length > 0 )
                {
                    /* close the div of previous currency */
                    ins += '</table></div>';
                    ins += '<div style="clear:both"></div>';
                    ins += '</div><br/>';
                }

                curr = ecurr;

                /* open a new currency div */
                ins += '<div class="info_live_sub">';
                ins += '<div style="float:right; clear:both; font-weight:bold;"> ' +
                    '<a id="ticker_'+ecurr+'_display" href="#" style="text-decoration:none; color:#ddd;">' +
                    currency_name[ecurr] + ' ' + currency_symbol[ecurr] + ' &nbsp;[-]' +
                    '</a>&nbsp;</div>' +
                    '<div style="float:right; clear:both;">' +
                    '<table id="ticker_'+ecurr+'" style="float:right">';
            }

            ins += '<tr><td><span id="live_ename_'+einfo.name+'">' + einfo.desc + '</span></td>';
            ins += '<td><span class="info_direction" id="live_direction_'+einfo.name+'" /></td>';
            ins += '<td><span id="live_price_'+einfo.name+'" /></td>';
            ins += '</tr>';
        }
    }

    ins += '</table></div>';
    ins += '<div style="clear:both"></div>';
    ins += '</div>';

    ins += '<hr style="background:#777; height:1px; border-width:0; margin-top:1em; margin-bottom:1em;"/>';

    /* network */
    ins += '<div class="info_live_sub" style="line-height:' + ((section=='T')?'1.5':'1.34') + '">';

    if ( section != 'T' )
    {
        ins += '<span class="info_ticker">Block: <span id="live_block_number"></span></span><br/>';
        ins += '<span class="info_ticker"><span id="live_block_age"></span></span><br/><br/>';
        ins += '<span class="info_ticker">Difficulty: <span id="live_block_diff"></span></span><br/>';
        ins += '<span class="info_ticker">Target: <span id="live_block_drate"></span></span><br/>';
        ins += '<span class="info_ticker">Current: <span id="live_block_rate"></span></span><br/><br/>';
    }
    else
    {
        ins += '<span class="info_ticker">Block: <span id="live_block_number"></span>&nbsp; (<span id="live_block_age"></span>)</span><br/>';
        ins += '<span class="info_ticker">Difficulty: <span id="live_block_diff"></span></span>&nbsp;;&nbsp;' +
               'Retarget in <span id="live_block_next"></span>&nbsp;(~ <span id="live_block_next_delay"></span>)</span><br/>';
        ins += '<span class="info_ticker">Target Hashrate: <span id="live_block_drate"></span>&nbsp;;&nbsp;' +
               'Current: ~<span id="live_block_rate"></span></span><br/><br/>';
    }

    /* MINING POOLS
     * display disabled
    ins += '<span class="info_ticker">- Top 3 mining pools -</span><br/>';
    ins += '<span class="info_ticker"><span id="live_pool_1"></span></span><br/>';
    ins += '<span class="info_ticker"><span id="live_pool_2"></span></span><br/>';
    ins += '<span class="info_ticker"><span id="live_pool_3"></span></span><br/><br/>';
    */

    if ( section != 'T' )
        ins += '<span class="info_ticker">Retarget in <span id="live_block_next"></span> (~<span id="live_block_next_delay"></span>)</span><br/>';

    ins += '</div>';
    ins += '<br/>';

    /* close ticker div */
    ins += '</div>';

    $('div#livebar').html ( ins );

    $.each ( currency_symbol, function(cur) {
        $('a#ticker_'+cur+'_display').on ( 'click', function(e) { e.preventDefault(); toggleTickerCurrency(cur); } );
    } );
}


/* ticker display customization */
function updateTickerDisplay ( cur )
{
    if ( ticker_config[cur] )
    {
        $('a#ticker_'+cur+'_display').html ( currency_name[cur] + ' ' + currency_symbol[cur] + ' &nbsp; <span style="color:#aaa; font-weight:normal;">[-]</span>' );
        $('table#ticker_'+cur).show ( );
    }
    else
    {
        $('a#ticker_'+cur+'_display').html ( currency_name[cur] + ' ' + currency_symbol[cur] + ' &nbsp; <span style="color:#aaa; font-weight:normal;">[+]</span>' );
        $('table#ticker_'+cur).hide ( );
    }
}

function toggleTickerCurrency ( cur )
{
    ticker_config[cur] = !ticker_config[cur];
    updateTickerDisplay ( cur );
    saveTickerConfig ( );
}


/* network mining pools *
   disabled
function coinorama_ticks_updateNetworkPools ( pools )
{
    /* pools is a dictionnary: {'pool name':nb.blocks} *
    var total = 0;
    var top3 = [ ];
    top3.push ( ['unknown',0] );
    top3.push ( ['unknown',0] );
    top3.push ( ['unknown',0] );

    for ( p in pools )
    {
        total += pools[p];

        if ( pools[p] > top3[0][1] )
        {
            top3[2] = top3[1];
            top3[1] = top3[0];
            top3[0] = [p,pools[p]];
        }
        else if ( pools[p] > top3[1][1] )
        {
            top3[2] = top3[1];
            top3[1] = [p,pools[p]];
        }
        else if ( pools[p] > top3[2][1] )
            top3[2] = [p,pools[p]];
    }

    $('#live_pool_1').text ( top3[0][0] + ' [' + (top3[0][1]/total*100).toFixed(1) + '%]' );
    $('#live_pool_2').text ( top3[1][0] + ' [' + (top3[1][1]/total*100).toFixed(1) + '%]' );
    $('#live_pool_3').text ( top3[2][0] + ' [' + (top3[2][1]/total*100).toFixed(1) + '%]' );
}

*/

/* network */
function coinorama_ticks_updateNetwork ( ticks )
{
    /* a tick is an object: { last:block num, time:timestamp, diff:difficulty, hrate:hashrate, pools:[pools] } */
    var t = ticks[0].tick;
    if ( previous_network_block_number != t.last )
    {
        previous_network_block_number = t.last;
        $('#live_block_number').css ( 'opacity', 0 );
        $('#live_block_number').text ( t.last );
        $('#live_block_number').animate ( {opacity:1} , 500, 'linear' );
    }

    var now = (new Date ()).getTime() / 1000;
    $('#live_block_age').text ( formatTickDuration(now-t.time) + ' ago' );

    var hashrate = t.diff * 7.158278826666667;
    $('#live_block_diff').text ( t.diff.toExponential(2) );
    $('#live_block_drate').text ( formatTickHashrate(hashrate) );

    $('#live_block_rate').text ( formatTickHashrate(t.hrate) );

    var next_retarget = (2016 * (1+Math.floor(t.last/2016))) - 1;
    var remaining = next_retarget - t.last;
    $('#live_block_next').text ( remaining.toString() + ' block' + (remaining>1?'s':'') );
    $('#live_block_next_delay').text ( formatTickDurationRounded(remaining*(600*(hashrate/t.hrate))) );

    if ( coinorama_getCurrentSection() == 'N' )
        $(document).attr ( 'title', '~' + formatTitleHashrate(t.hrate) + ' - Coinorama' );

    /* disabled: coinorama_ticks_updateNetworkPools ( ticks[0].pools ); */

    $('div#timestamp').text ( coinorama_getTimestamp() );
}

/* markets */
function detectShownCurrency ( shown_exchanges )
{
    var c = 'USD';
    var shown_currencies = { };

    for ( var e in shown_exchanges )
        if ( shown_exchanges[e] )
            shown_currencies[getExchangeCurrency(e)] = 1;

    shown_currencies = Object.keys ( shown_currencies );
    if ( shown_currencies.length == 1 )
        c = shown_currencies[0];

    return c;
}

var alerts = { };
var nb_alerts = 0;

function markets_getDirection ( prev, last )
{
    if ( prev == 0 )
        return 1;

    if ( Math.abs(prev-last) <= 0.01 )
        return 1;
    else if ( prev > last )
        return 0;

    return 2;
}

function coinorama_ticks_updateMarkets ( ticks, selected_mode, selected_exch, shown_exchanges )
{
    var shown_currency = 'USD';
    var sum_price = { };
    var sum_open = { };
    var avg_price = { };
    var sum_volume = { };
    var variation = { };
    var total_volume = 0;
    var dirchars = [ '\u2193', '\u2192', '\u2191' ]; /* down, stable, up */

    for ( var cur in currency_symbol )
    {
        sum_price[cur] = 0;
        sum_open[cur] = 0;
        sum_volume[cur] = 0;
    }
    /* a tick is a triple: [ price, volume, direction, conv_rate ] */

    for ( var e in ticks )
    {
        var t = ticks[e];
        var cur = getExchangeCurrency ( e );
        total_volume += t.volume;
        sum_volume[cur] += t.volume;
        sum_price[cur] += t.last * t.volume;
        sum_open[cur] += t.open * t.volume;
    }

    for ( var cur in currency_symbol )
    {
        variation[cur] = ((sum_price[cur] - sum_open[cur]) / sum_open[cur] ) * 100;
        avg_price[cur] = sum_price[cur] / sum_volume[cur];
    }

    shown_currency = detectShownCurrency ( shown_exchanges );

    /* set page title */
    if ( coinorama_getCurrentSection() == 'M' )
    {
        var title_price = 0;
        var direction;

        if ( selected_mode != 's' )
        {
            var part_volume = 0;
            for ( var e in ticks )
            {
                var t = ticks[e];

                if ( shown_exchanges[e] )
                {
                    if ( shown_currency == 'USD' )
                        title_price += (t.last*t.rusd) * t.volume;
                    else
                        title_price += t.last * t.volume;
                    part_volume += t.volume;
                }
            }

            if ( part_volume != 0 )
            {
                title_price /= part_volume;
                direction = markets_getDirection ( previous_markets_title_price, title_price );
                previous_markets_title_price = title_price;
                title_price = title_price.toFixed(2);
            }
            else
            {
                title_price = 'n/a';
                direction = 1;
            }

            $(document).attr ( 'title', '' + dirchars[direction] + ' ' + title_price + ' ' +
                                             shown_currency + '/BTC - Coinorama' );
        }
        else
        {
            if ( ticks.hasOwnProperty(selected_exch) )
            {
                var t = ticks[selected_exch];
                title_price = t.last.toFixed(2);
                direction = markets_getDirection ( t.avg, t.last );
            }

            $(document).attr ( 'title', '' + dirchars[direction] + ' ' + title_price + ' ' +
                                             getExchangeCurrency(selected_exch) + '/BTC - Coinorama' );
        }
    }

    /* set ticker */
    for ( var e in ticks )
    {
        var t = ticks[e];
        var field_ename = $('#live_ename_'+e);
        var field_dir = $('#live_direction_'+e);
        var field_price = $('#live_price_'+e);
        var curr = getExchangeCurrency(e);

        var direction = markets_getDirection ( t.avg, t.last );

        switch ( direction )
        {
          case 0:
            field_dir.attr ( 'style', 'color:#aa0000;' );
            break;
          case 2:
            field_dir.attr ( 'style', 'color:#00aa00;' );
            break;
         case 1:
         default:
            field_dir.attr ( 'style', 'color:#aaaaaa;' );
            break;
        }

        if ( previous_markets_tick_direction[e] != direction )
        {
            previous_markets_tick_direction[e] = direction;
            field_dir.css ( 'opacity', 0 );
            field_dir.text ( dirchars[direction] );
            field_dir.animate ( {opacity:1} , 500, 'linear' );
        }

        if ( previous_markets_tick_price[e] != t.last )
        {
            field_price.css ( 'opacity', 0 );

            if ( previous_markets_tick_price[e] != 0 )
            {
                if ( previous_markets_tick_price[e] < t.last )
                    field_ename.css ( 'background', '#008000' );
                else
                    field_ename.css ( 'background', '#800000' );
            }

            field_price.html ( ''+t.last.toFixed(2) + ' ' + currency_symbol[curr] +
                               ' &nbsp;[' + ((100*t.volume)/total_volume).toFixed(1)+'%]' );
            /*
            field_price.html ( ''+t.last.toFixed(2) + ' ' + currency_symbol[curr] +
                               '&nbsp;/&nbsp;' + t.volume.toFixed(1) + ' BTC' );
            */

            field_ename.animate ( {backgroundColor:'#1f1f1f'}, 2500, 'linear' );
            field_price.animate ( {opacity:1} , 1000, 'linear' );
            previous_markets_tick_price[e] = t.last;
        }
    }

    $('div#timestamp').text ( coinorama_getTimestamp() );

    var ins = '';
    ins += '<table style="text-align:left; margin-left:auto; margin-right:auto; ">';
    for ( cur in {'USD':0, 'EUR':1, 'CNY':2} )
    {
        ins += '<tr>';
        ins += '<td style="text-align:right;">~ ' + avg_price[cur].toFixed(2) + ' </td>';
        ins += '<td>'+cur+'</td>';
        if ( Math.abs(variation[cur]) < 0.01 )
            ins += '<td style="color:#aaaaaa">'+dirchars[1]+'</td>';
        else if ( variation[cur] < 0 )
            ins += '<td style="color:#aa0000">'+dirchars[0]+'</td>';
        else
            ins += '<td style="color:#00aa00">'+dirchars[2]+'</td>';
        ins += '<td>' + variation[cur].toFixed(2) + '%</td>';
        ins += '</tr>';
    }
    ins += '</table>';
    ins += '<br style="line-height:0.3em"/>';
    ins += '24h:&nbsp;' + formatTickCurrency(total_volume,' BTC');
    $('div#summary').html ( ins );

    /* update alerts */
    for ( var i in alerts )
        alerts[i].tick ( ticks );
}


/*
 * main coinorama loading function
 */
function coinorama_load ( data )
{
    exchanges_info = data["config"]["markets"];
    exchanges_views = data["config"]["views"];

    if ( ( exchanges_info.length < 1 ) || ( exchanges_views.length < 1 ) )
    {
        $('span#winmsg_title').text ( 'Error' );
        $('div#winmsg_ctnt').html ( 'Sorry, markets configuration data is empty.<br/>The service is being upgraded/rebooted,' +
                                    ' or it crashed.<br/>Please reload the page in a couple of minutes.<br/><br/>' );
        windowShow ( 'message' );
        return;
    }

    /* prepare exchanges data structures */
    for ( var i in exchanges_info )
        exchanges_info_by_name[exchanges_info[i].name] = exchanges_info[i];

    for ( var i in exchanges_info )
        exchanges_uid[exchanges_info[i].name] = exchanges_info[i].uid;

    for ( var i in exchanges_info ) /* aggregate info in a way that will respect the order */
    {
        var einfo = exchanges_info[i];
        var cur = getExchangeCurrency ( einfo.name );

        if ( !exchanges_by_currency.hasOwnProperty(cur) )
        {
            currency_list.push ( cur );
            exchanges_by_currency[cur] = [ ];
        }

        exchanges_by_currency[cur].push ( einfo );
    }

    /* data refresh timeout handler */
    markets_ticks_timeout_id = -1;
    network_tick_timeout_id = -1;


    /*******************
     ** Markets Ticks **
     *******************/

    function onMarketsTicksFetchSuccess ( data )
    {
        coinorama_ticks_updateMarkets ( data.ticks, null, null, null );
    }

    function onMarketsTicksFetchError ( qid, text, error )
    {
        return;
    }

    function fetchMarketsTicks ( )
    {
        var data_url = '/coinorama/data.cft';
        $.ajax ( { url:data_url, type:'GET', dataType:'json',
                   success:onMarketsTicksFetchSuccess, error:onMarketsTicksFetchError } );
        markets_ticks_timeout_id = setTimeout ( fetchMarketsTicks, 10000 );
    }


    /******************
     ** Network Tick **
     ******************/

    function onNetworkTickFetchSuccess ( data )
    {
        coinorama_ticks_updateNetwork ( data.ticks );
    }

    function onNetworkTickFetchError ( qid, text, error )
    {
        return;
    }

    function fetchNetworkTick ( )
    {
        var data_url = '/coinorama/data.bft';
        $.ajax ( { url:data_url, type:'GET', dataType:'json',
                   success:onNetworkTickFetchSuccess, error:onNetworkTickFetchError } );
        network_tick_timeout_id = setTimeout ( fetchNetworkTick, 30000 );
    }


    /***********************
     ** UI Initialization **
     ***********************/
    makeTicker ( );

    loadTickerConfig();
    for ( var cur in currency_symbol )
        updateTickerDisplay ( cur );


    /*************
     ** Section **
     *************/
    var section = coinorama_getCurrentSection ( );

    switch ( section )
    {
      case 'N':
        $('div#markets_bar').hide ( );
        $('div#markets_page').hide ( );
        $('div#blocks_bar').hide ( );
        $('div#blocks_page').hide ( );
        $('div#api_page').hide ( );
        $('div#network_bar').show ( );
        $('div#network_page').show ( );
        $('span#network_ct').css ( 'background', '#c6881d' );
        $(document).attr ( 'title', 'Coinorama - Network' );
        break;

      case 'B':
        $('div#markets_bar').hide ( );
        $('div#markets_page').hide ( );
        $('div#network_bar').hide ( );
        $('div#network_page').hide ( );
        $('div#api_page').hide ( );
        $('div#blocks_bar').show ( );
        $('div#blocks_page').show ( );
        $('span#blocks_ct').css ( 'background', '#c6881d' );
        $(document).attr ( 'title', 'Coinorama - Blocks' );
        break;

      case 'A':
        $('div#markets_bar').hide ( );
        $('div#markets_page').hide ( );
        $('div#network_bar').hide ( );
        $('div#network_page').hide ( );
        $('div#blocks_bar').hide ( );
        $('div#blocks_page').hide ( );
        $('div#api_page').show ( );
        $('span#api_ct').css ( 'background', '#c6881d' );
        $(document).attr ( 'title', 'Coinorama - API' );
        break;

      case 'T': /* web app */
        break;

      case 'M':
      default:
        $('div#network_bar').hide ( );
        $('div#network_page').hide ( );
        $('div#blocks_bar').hide ( );
        $('div#blocks_page').hide ( );
        $('div#api_page').hide ( );
        $('div#markets_bar').show ( );
        $('div#markets_page').show ( );
        $('span#markets_ct').css ( 'background', '#c6881d' );
        $(document).attr ( 'title', 'Coinorama - Markets' );
        break;
    }

    /* ticker height adaptation when charts are also displayed */
    if ( section != 'T' )
    {
        var win_height = $(window).height ( );
        if ( win_height < 800 )
            $('div#livebar').css ( 'font-size', '50%' );
        else if ( win_height < 900 )
            $('div#livebar').css ( 'font-size', '53%' );
        else if ( win_height < 1000 )
            $('div#livebar').css ( 'font-size', '56%' );
        else
            $('div#livebar').css ( 'font-size', '62%' );
    }

    /* when necessary, ignit ticker update */
    if ( section != 'M' )
        fetchMarketsTicks ( );

    if ( ( section != 'N' ) && ( section != 'B' ) )
        fetchNetworkTick ( );
}


function onMarketsConfigFetchError ( qid, text, error )
{
    $('span#winmsg_title').text ( 'Error' );
    $('div#winmsg_ctnt').html ( 'Sorry, markets configuration data could not be fetched.<br/>The service is being upgraded/rebooted,' +
                                        ' or it crashed.<br/>Please reload the page in a couple of minutes.<br/><br/>'+error+'<br/>' );
    windowShow ( 'message' );
    return;
}


/*
 * main module
 */
$( function() {

    var data_url = '/coinorama/data.cf?l=1';
    $.ajax ( { url:data_url, type:'GET', dataType:'json',
               success:coinorama_load, error:onMarketsConfigFetchError } );
});
