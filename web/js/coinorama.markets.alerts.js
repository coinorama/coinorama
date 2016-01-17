/*
 * coinorama.markets.alerts.js
 * Markets alerts
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

    /* audio alert */
    var audio = null;


    /*
     * Alert Abstract Class
     */
    var Alert = ( function ( )
    {
        var cls = function ( aid )
        {
            this.aid = aid;
            this.audio_iter = 0;
            this.locked = false;

            /* configuration */
            this.setConfig = function ( conf )
            {
                if ( conf.hasOwnProperty('locked') )
                    this.locked = conf['locked'];
            };

            this.getConfig = function ( )
            {
                var conf = { };
                conf['type'] = this.constructor.getName();
                conf['locked'] = this.locked;
                return conf;
            };


            /* audio */
            this.startAudio = function ( )
            {
                if ( ( audio != null ) && ( this.audio_iter < 3 ) )
                {
                    if ( audio.paused )
                    {
                        this.audio_iter += 1;
                        audio.play ( );
                    }
                }
            };


            /* make UI */
            this.makeUI = function ( )
            {
                var self = this;
                var parent = $('td#row_alrt_'+this.aid);
                var ins = '';

                ins += '&nbsp; ';
                ins += '<button id="btn_alrt_edit_'+this.aid+'">on</button>&nbsp;';
                ins += '<button id="btn_alrt_'+this.aid+'">add</button>';

                parent.append ( ins );

                $('button#btn_alrt_'+this.aid).button ( );
                $('button#btn_alrt_'+this.aid).button ( 'option', 'icons', { primary: 'ui-icon-circle-plus' } );

                $('button#btn_alrt_'+this.aid).on ( 'click', function()
                                                    {
                                                        if ( self.lock() )
                                                        {
                                                            self.add ( );
                                                            alerts[self.aid] = self;
                                                            ++nb_alerts;
                                                            saveAlertsConfig ( );
                                                            addAlertRow ( nb_alerts, null );
                                                        }
                                                    } );

                $('button#btn_alrt_edit_'+this.aid).button ( {disabled:true} );
                $('button#btn_alrt_edit_'+this.aid).button ( 'option', 'icons', { primary: 'ui-icon-locked' } );
            };


            /* lock/unlock */
            this.lock = function ( )
            {
                var self = this;
                this.locked = true;
                this.audio_iter = 0;
                $('button#btn_alrt_edit_'+this.aid).button ( 'option', 'label', 'on' );
                $('button#btn_alrt_edit_'+this.aid).button ( 'option', 'icons', { primary: 'ui-icon-locked' } );
                $('button#btn_alrt_edit_'+this.aid).off ( );
                $('button#btn_alrt_edit_'+this.aid).on ( 'click', function() { self.unlock(); } );
                $('select#cb_alrt_type_'+this.aid).attr ( 'disabled', 'true' );
                saveAlertsConfig ( );
                return true;
            };

            this.unlock = function ( )
            {
                var self = this;
                this.locked = false;
                $('button#btn_alrt_edit_'+this.aid).button ( 'option', 'label', 'off' );
                $('button#btn_alrt_edit_'+this.aid).button ( 'option', 'icons', { primary: 'ui-icon-unlocked' } );
                $('button#btn_alrt_edit_'+this.aid).off ( );
                $('button#btn_alrt_edit_'+this.aid).on ( 'click', function() { self.lock(); } );
                $('select#cb_alrt_type_'+this.aid).removeAttr ( 'disabled' );
                saveAlertsConfig ( );
            };


            /* add */
            this.add = function ( )
            {
                var self = this;
                $('button#btn_alrt_'+this.aid).button ( 'option', 'label', 'delete' );
                $('button#btn_alrt_'+this.aid).button ( 'option', 'icons', { primary: 'ui-icon-circle-minus' } );
                $('button#btn_alrt_'+this.aid).off ( );
                $('button#btn_alrt_'+this.aid).on ( 'click', function() { self.remove() } );

                $('button#btn_alrt_edit_'+this.aid).button ( 'enable' );
            };

            /* remove */
            this.remove = function ( )
            {
                $('button#btn_alrt_'+this.aid).off ( );
                $('tr#alrt_'+this.aid).remove ( );
                delete alerts[this.aid];
                saveAlertsConfig ( );
            };

            /* destructor */
            this.destroy = function ( )
            {
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
     * Alert Price
     */
    var AlertPrice = ( function ( )
    {
        var cls = function ( aid )
        {
            this.constructor['super'].call ( this, aid );

            this.exchange = null;
            this.cond = null;
            this.price = 0;

            /* configuration */
            var super_set_config = this.setConfig;
            this.setConfig = function ( conf )
            {
                super_set_config.call ( this, conf );

                if ( conf.hasOwnProperty('exch') )
                    this.exchange = conf['exch'];
                if ( conf.hasOwnProperty('cond') )
                    this.cond = conf['cond'];
                if ( conf.hasOwnProperty('price') )
                    this.price = conf['price'];
            };

            var super_get_config = this.getConfig;
            this.getConfig = function ( )
            {
                var conf = super_get_config.call ( this );
                conf['exch'] = this.exchange;
                conf['cond'] = this.cond;
                conf['price'] = this.price;
                return conf;
            };

            /* make UI */
            var super_makeUI = this.makeUI;
            this.makeUI = function ( )
            {
                var self = this;
                var parent = $('td#row_alrt_'+this.aid);
                parent.empty ( );

                var ins = '';

                /* exchange */
                ins += '<select id="cb_alrt_exch_' + this.aid + '">';
                ins += '<option value="null" selected disabled>EXCHANGE</option>';
                for ( var i in exchanges_info )
                {
                    var e = exchanges_info[i];
                    ins += '<option value="' + e.name + '" id="alrt_exch_' + e.name + '">' + e.name + '</option>';
                }
                ins += '</select>';
                ins += '&nbsp; ';

                /* condition */
                ins += '<select id="cb_alrt_cond_' + this.aid + '">';
                ins += '<option value="null" selected disabled>CONDITION</option>';
                ins += '<option value="gt" id="alrt_cond_gt">above</option>';
                ins += '<option value="lt" id="alrt_cond_gt">below</option>';
                ins += '</select>';
                ins += '&nbsp; ';

                /* value */
                ins += '<input type="text" name="s" id="alrt_value_'+this.aid+'" value="'+this.price+'" maxlength="8" size="5"/> ';
                ins += '<span id="alrt_cur_'+this.aid+'">' + ((this.exchange!=null)?getExchangeCurrency(this.exchange):'USD') + '</span>';

                parent.append ( ins );

                if ( this.exchange != null )
                    $('select#cb_alrt_exch_'+this.aid+' option[value="'+this.exchange+'"]').prop ( 'selected', true );
                if ( this.cond != null )
                    $('select#cb_alrt_cond_'+this.aid+' option[value="'+this.cond+'"]').prop ( 'selected', true );

                $('select#cb_alrt_exch_'+this.aid).on ( 'change', function() { $('span#alrt_cur_'+self.aid).text(getExchangeCurrency(this.value)); } );
                super_makeUI.call ( this );
            };

            /* lock */
            var super_lock = this.lock;
            this.lock = function ( )
            {
                /* check input */
                var exch = $('select#cb_alrt_exch_'+this.aid).val();
                var cond = $('select#cb_alrt_cond_'+this.aid).val();
                var price = parseFloat ( $('input#alrt_value_'+this.aid).val() );

                if ( ( exch == null ) || ( cond == null ) )
                    return false;

                if ( ( price <= 0 ) || ( isNaN(price) ) )
                    return false;

                this.exchange = exch;
                this.cond = cond;
                this.price = price;

                /* lock fields */
                $('select#cb_alrt_exch_'+this.aid).attr ( 'disabled', 'true' );
                $('select#cb_alrt_cond_'+this.aid).attr ( 'disabled', 'true' );
                $('input#alrt_value_'+this.aid).attr ( 'disabled', 'true' );

                return super_lock.call ( this );
            };

            var super_unlock = this.unlock;
            this.unlock = function ( )
            {
                $('select#cb_alrt_exch_'+this.aid).removeAttr ( 'disabled' );
                $('select#cb_alrt_cond_'+this.aid).removeAttr ( 'disabled' );
                $('input#alrt_value_'+this.aid).removeAttr ( 'disabled' );
                super_unlock.call ( this );
            };

            /* alert trigger */
            this.trigger = function ( cprice )
            {
                makeWindow ( 'alrt_'+this.aid, true );

                var div = $('div#win_inctnt_alrt_'+this.aid);
                div.empty ( );

                var ins = '';
                var cur = getExchangeCurrency(this.exchange);

                ins += 'Exchange ' + this.exchange + ' is ' + ((this.cond=='lt')?'below':'above') + ' ' + this.price + ' ' + cur + '.<br/>';
                ins += 'Current Price : ' + cprice + ' ' + cur;
                div.append ( ins );

                this.startAudio ( );
            };

            /* tick */
            this.tick = function ( ticks )
            {
                if ( !this.locked )
                    return;

                if ( !ticks.hasOwnProperty(this.exchange) )
                    return;

                var trigger = false;

                var t  = ticks[this.exchange];

                if ( this.cond == 'gt' )
                {
                    if (  t.last > this.price )
                        trigger = true;
                }
                else if ( this.cond == 'lt' )
                {
                    if (  t.last < this.price )
                        trigger = true;
                }

                if ( trigger )
                    this.trigger ( t.last );
                else
                    this.audio_iter = 0;
            };

            /* remove */
            var super_remove = this.remove;
            this.remove = function ( )
            {
                $('select#cb_alrt_exch_'+this.aid).off ( );
                super_remove.call ( this );
            };
        };

        inherit ( cls, Alert );
        cls.getName = function ( ) { return 'price'; };
        cls.getTitle = function ( ) { return 'Price'; };
        return cls;
    } ) ( );



    /*
     * Alert Arbitrage
     */
    var AlertArbitrage = ( function ( )
    {
        var cls = function ( aid )
        {
            this.constructor['super'].call ( this, aid );

            this.exchange1 = null;
            this.exchange2 = null;
            this.fees1 = 0;
            this.fees2 = 0;
            this.cst2 = 0;

            /* configuration */
            var super_set_config = this.setConfig;
            this.setConfig = function ( conf )
            {
                super_set_config.call ( this, conf );

                if ( conf.hasOwnProperty('exch1') )
                    this.exchange1 = conf['exch1'];
                if ( conf.hasOwnProperty('fees1') )
                    this.fees1 = conf['fees1'];
                if ( conf.hasOwnProperty('exch2') )
                    this.exchange2 = conf['exch2'];
                if ( conf.hasOwnProperty('fees2') )
                    this.fees2 = conf['fees2'];
                if ( conf.hasOwnProperty('cst2') )
                    this.cst2 = conf['cst2'];
            };

            var super_get_config = this.getConfig;
            this.getConfig = function ( )
            {
                var conf = super_get_config.call ( this );
                conf['exch1'] = this.exchange1;
                conf['fees1'] = this.fees1;
                conf['exch2'] = this.exchange2;
                conf['fees2'] = this.fees2;
                conf['cst2'] = this.cst2;
                return conf;
            };

            /* make UI */
            var super_makeUI = this.makeUI;
            this.makeUI = function ( )
            {
                var self = this;
                var parent = $('td#row_alrt_'+this.aid);
                parent.empty ( );

                var ins = '';

                /* arbitrage : if (Exchange1 (Bid) x (1+fees1 )) > (Exchange2 (Ask) x (1+fees2 ) + Cst) */

                /* exchange 1 */
                ins += '<select id="cb_alrt_exch1_' + this.aid + '">';
                ins += '<option value="null" selected disabled>EXCHANGE</option>';
                for ( var i in exchanges_info )
                {
                    var e = exchanges_info[i];
                    ins += '<option value="' + e.name + '">' + e.name + '</option>';
                }
                ins += '</select>';

                /* fees 1 */
                ins += ' Bid + <input type="text" name="s" id="alrt_fees1_'+this.aid+'" value="' + this.fees1 + '" maxlength="6" size="3"/>%';

                /* condition */
                ins += ' &nbsp; <b>&gt;</b> ';
                ins += '&nbsp; ';

                /* exchange 2 */
                ins += '<select id="cb_alrt_exch2_' + this.aid + '">';
                ins += '<option value="null" selected disabled>EXCHANGE</option>';
                for ( var i in exchanges_info )
                {
                    var e = exchanges_info[i];
                    ins += '<option value="' + e.name + '">' + e.name + '</option>';
                }
                ins += '</select>';

                /* fees 2 */
                ins += ' Ask + <input type="text" name="s" id="alrt_fees2_'+this.aid+'" value="' + this.fees2 + '" maxlength="6" size="3"/>%';

                /* margin */
                ins += ' + <input type="text" name="s" id="alrt_cst2_'+this.aid+'" value="' + this.cst2 + '" maxlength="6" size="3"/> ';
                ins += '<span id="alrt_cur_'+this.aid+'">' + ((this.exchange2!=null)?getExchangeCurrency(this.exchange2):'USD') + '</span>';

                parent.append ( ins );

                if ( this.exchange1 != null )
                    $('select#cb_alrt_exch1_'+this.aid+' option[value="'+this.exchange1+'"]').prop ( 'selected', true );
                if ( this.exchange2 != null )
                    $('select#cb_alrt_exch2_'+this.aid+' option[value="'+this.exchange2+'"]').prop ( 'selected', true );

                $('select#cb_alrt_exch2_'+this.aid).on ( 'change', function() { $('span#alrt_cur_'+self.aid).text(getExchangeCurrency(this.value)); } );

                super_makeUI.call ( this );
            };


            /* add */
            var super_lock = this.lock;
            this.lock = function ( )
            {
                /* check input */
                var exch1 = $('select#cb_alrt_exch1_'+this.aid).val();
                var fees1 = parseFloat ( $('input#alrt_fees1_'+this.aid).val() );

                var exch2 = $('select#cb_alrt_exch2_'+this.aid).val();
                var fees2 = parseFloat ( $('input#alrt_fees2_'+this.aid).val() );
                var cst2 = parseFloat ( $('input#alrt_cst2_'+this.aid).val() );

                if ( ( exch1 == null ) || ( exch2 == null ) )
                    return false;

                if ( isNaN(fees1) || isNaN(fees2) || isNaN(cst2) )
                    return false;

                this.exchange1 = exch1;
                this.fees1 = fees1;

                this.exchange2 = exch2;
                this.fees2 = fees2;
                this.cst2 = cst2;

                /* lock fields */
                $('select#cb_alrt_exch1_'+this.aid).attr ( 'disabled', 'true' );
                $('input#alrt_fees1_'+this.aid).attr ( 'disabled', 'true' );
                $('select#cb_alrt_exch2_'+this.aid).attr ( 'disabled', 'true' );
                $('input#alrt_fees2_'+this.aid).attr ( 'disabled', 'true' );
                $('input#alrt_cst2_'+this.aid).attr ( 'disabled', 'true' );

                return super_lock.call ( this );
            };

            var super_unlock = this.unlock;
            this.unlock = function ( )
            {
                $('select#cb_alrt_exch1_'+this.aid).removeAttr ( 'disabled' );
                $('input#alrt_fees1_'+this.aid).removeAttr ( 'disabled' );
                $('select#cb_alrt_exch2_'+this.aid).removeAttr ( 'disabled' );
                $('input#alrt_fees2_'+this.aid).removeAttr ( 'disabled' );
                $('input#alrt_cst2_'+this.aid).removeAttr ( 'disabled' );
                super_unlock.call ( this );
            };


            /* alert trigger */
            this.trigger = function ( cprice1, cprice2 )
            {
                makeWindow ( 'alrt_'+this.aid, true );

                var div = $('div#win_inctnt_alrt_'+this.aid);
                div.empty ( );

                var ins = '';
                var cur1 = getExchangeCurrency(this.exchange1);
                var cur2 = getExchangeCurrency(this.exchange2);

                ins += this.exchange1 + ' bid is above ' + this.exchange2 + ' ask.<br/><br/>';
                ins += '&nbsp; (' + cprice1 + ' ' + cur1 + ' + ' + this.fees1 + '%) <b>&gt;</b> (';
                ins += cprice2 + ' ' + cur2 + ' + ' + this.fees2 + '%';

                if ( this.cst2 != 0 )
                    ins += ' + ' + this.cst2 + ' ' + cur2;
                ins += ')';

                div.append ( ins );

                this.startAudio ( );
            };

            /* tick */
            this.tick = function ( ticks )
            {
                if ( !this.locked )
                    return;

                var cprice1_usd = 0;
                var cprice2_usd = 0;
                var cst2_usd = 0;

                if ( !ticks.hasOwnProperty(this.exchange1) )
                    return;

                if ( !ticks.hasOwnProperty(this.exchange2) )
                    return;

                var t1 = ticks[this.exchange1];
                var t2 = ticks[this.exchange2];

                cprice1_usd = t1.bid * t1.rusd;
                cprice2_usd = t2.ask * t2.rusd;
                cst2_usd = this.cst2 * t2.rusd;

                var p1 = cprice1_usd * (1+(this.fees1/100));
                var p2 = cprice2_usd * (1+(this.fees2/100)) + cst2_usd;

                if ( p1 > p2 )
                    this.trigger ( t1.bid, t2.ask );
                else
                    this.audio_iter = 0;
            };

            /* remove */
            var super_remove = this.remove;
            this.remove = function ( )
            {
                super_remove.call ( this );
            };
        };

        inherit ( cls, Alert );
        cls.getName = function ( ) { return 'arbitrage'; };
        cls.getTitle = function ( ) { return 'Arbitrage'; };
        return cls;
    } ) ( );


    /* alerts types */
    var alerts_types = { };
    alerts_types[AlertPrice.getName()] = AlertPrice;
    alerts_types[AlertArbitrage.getName()] = AlertArbitrage;


    function alertTypeChanged ( aid, t )
    {
        var a = new alerts_types[t] ( aid );
        a.makeUI ( );
    }

    function addAlertRow ( aid, atype )
    {
        var parent = $('table#alrt_table');

        var ins = '';

        ins += '<tr id="alrt_'+aid+'">';
        ins += '<td>';
        ins += '<select id="cb_alrt_type_' + aid + '">';
        ins += '<option value="null" selected disabled>TYPE</option>';
        ins += '<option value="price">Price</option>';
        ins += '<option value="arbitrage">Arbitrage</option>';
        ins += '</select>';
        ins += '</td>';

        ins += '<td id="row_alrt_'+aid+'">select an alert type</td>';
        ins += '</tr>';
        parent.append ( ins );

        if ( atype != null )
            $('select#cb_alrt_type_'+aid+' option[value="'+atype+'"]').prop ( 'selected', true );

        $('select#cb_alrt_type_'+aid).on ( 'change', function() { alertTypeChanged(aid,this.value); } );
    }

    function makeWindow ( win_id, popup )
    {
        if ( windows[win_id] !== undefined )
        {
            windowShow ( win_id ); /* window exists and successfully loaded */
            return false;
        }

        var div = $('div#markets_page');

        var title = 'Alert';

        if ( win_id == 'alerts' )
            title = 'Markets - Alerts';

        div.append ( '<div class="winbc" id="win_' + win_id + '"> ' +
                     '<div class="winbar" id="winbar_' + win_id + '"> ' + '<span id="win_title_'+win_id+'" class="winbar_title">'+title+'</span>' +
                     '<span class="winbar_ctrl"><a id="ctred_'+win_id+'" class="winctrl" href="#">-</a> ' +
                     '<a id="ct_'+win_id+'" class="winctrl" href="#">x</a></span><br /></div><br/>' +
                     '<div class="winbc_ctnt" id="win_ctnt_'+win_id+'" style="font-size:85%;">' +
                     '<div class="winbc_inctnt" id="win_inctnt_'+win_id+'"></div><br/></div>' +
                     '<div class="winclosebtn" id="win_cl_'+win_id+'"><a id="ct_'+win_id+'" class="winctrl" href="#">&nbsp;Close&nbsp;</a></div>' +
                     '</div>' );

        var wdiv = $('div#win_'+win_id);
        wdiv.css ( 'transform', 'translate(320px,'+($('body').height()*0.2)+'px)' );
        windowUI ( wdiv, $('div#winbar_'+win_id) );

        if ( popup )
        {
            wdiv.slideToggle ( );
            windowRaise ( wdiv );
        }

        $('a#ct_'+win_id).click ( function(e) { e.preventDefault(); windowToggle(win_id); } );
        $('a#ctred_'+win_id).click ( function(e) { e.preventDefault(); windowReduce(win_id); } );
        windows[win_id] = wdiv;
        return true;
    }

    function toggleAlertsWindow ( )
    {
        windowToggle ( 'alerts' );

        if ( audio == null )
        {
            audio = new Audio ( );

            if ( audio.canPlayType('audio/ogg') )
                audio = new Audio ( '/coinorama/static/alert.ogg' );
            else if ( audio.canPlayType('audio/mp3') )
                audio = new Audio ( '/coinorama/static/alert.mp3' );

            audio.load ( );
        }
    }

    function loadAlertsConfig ( )
    {
        var c_value = document.cookie;
        var c_start = c_value.indexOf ( 'alerts=' );
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

        for ( aid in newconf )
        {
            var t = newconf[aid].type;
            if ( t in alerts_types )
            {
                addAlertRow ( aid, t );
                var a = new alerts_types[t] ( aid );
                a.setConfig ( newconf[aid] );
                a.makeUI ( );
                a.add ( );
                alerts[a.aid] = a;
                if ( a.locked )
                    a.lock ( );
                else
                    a.unlock ( );
                nb_alerts = Math.max ( nb_alerts, aid ) + 1;
            }
        }
    }

    function saveAlertsConfig ( )
    {
        var alerts_config = { };

        for ( a in alerts )
            alerts_config[a] = alerts[a].getConfig ( );

        var exdate = new Date();
        exdate.setDate ( exdate.getDate() + 366 );
        document.cookie = 'alerts=' + JSON.stringify(alerts_config) + '; expires=' + exdate.toUTCString();
    }


    /* UI init */
    makeWindow ( 'alerts', false );
    $('div#win_inctnt_alerts').empty ( );
    $('div#win_inctnt_alerts').append ( '<table id="alrt_table" class="chain_txs_table"></table><br/>' +
                                        'note: alerts are saved using cookies, data aren\'t sent to the server<br/>' );

    loadAlertsConfig ( );
    addAlertRow ( nb_alerts, null );

    $('a#ct_markets_alerts').on ( 'click', function(e) { e.preventDefault(); toggleAlertsWindow(); } );

});
