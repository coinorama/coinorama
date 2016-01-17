/*
 * The MIT License

Copyright (c) 2010, 2011, 2012, 2013 by Juergen Marsch

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in
all copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN
THE SOFTWARE.
*/

(function ($) { 
    "use strict";
    var pluginName = "candlestick", pluginVersion = "0.3";
    var options = {
        series: { 
            candlestick: {
                active: false,
                show: false,
                rangeWidth: 2,
                rangeColor: "rgb(128,128,128)",
                upColor: "#30af0c",
                downColor: "#ed2400",
                neutralColor: "rgb(200,200,200)",
                lineWidth: "8px",
                highlight: { opacity: 0.5 },
                nearBy: { findItem: null },
                drawCandlestick: drawCandlestickDefault
            }
        }
    };

    var replaceOptions = {
        // legend:{show:false},
        series:{ lines: { show:false } }
    };

    function between ( v, limit1, limit2 )
    {
        if(limit2>limit1)
            return v>=limit1&&v<=limit2;
        else return v>=limit2&&v<=limit1;
    }

    function drawCandlestickDefault ( ctx, serie, data, hover )
    {
        if ( hover === true )
        {
            var c = "rgba(255,255,255," + serie.candlestick.highlight.opacity + ")";
            drawHover(ctx,serie,data,c);
        }
        else
        {
            drawRange(ctx,serie,data);
            drawBody(ctx,serie,data);
        }

        function drawRange ( ctx, serie, data )
        {
            var x,y1,y2;
            x = serie.xaxis.p2c(data[0]);
            y1 = serie.yaxis.p2c(data[3]);
            y2 = serie.yaxis.p2c(data[4]);
            ctx.lineWidth = serie.candlestick.rangeWidth;
            ctx.beginPath();
            ctx.strokeStyle = serie.candlestick.rangeColor;
            ctx.moveTo(x,y1);
            ctx.lineTo(x,y2);
            ctx.stroke();
        }

        function drawBody ( ctx, serie, data )
        {
            var x,y1,y2,c;
            x = serie.xaxis.p2c(data[0] - serie.candlestick.barWidth / 2);
            y1 = serie.yaxis.p2c(data[1]);
            y2 = serie.yaxis.p2c(data[2]);
            if(data[1] > data[2]){ c = serie.candlestick.downColor;} else{ c = serie.candlestick.upColor;}
            if(data[1] == data[2]){
                c = serie.candlestick.neutralColor;
                y2 = y1 + 2;
            }
            ctx.beginPath();
            ctx.strokeStyle = c;
            ctx.lineWidth = serie.candlestick.barWidth;
            ctx.moveTo(x,y1);
            ctx.lineTo(x,y2);
            ctx.stroke();     
        }

        function drawHover ( ctx, serie, data, c )
        {
            var x,y1,y2;
            x = serie.xaxis.p2c(data[0] - serie.candlestick.barWidth / 2);
            y1 = serie.yaxis.p2c(data[3]);
            y2 = serie.yaxis.p2c(data[4]);
            ctx.beginPath();
            ctx.strokeStyle = c;
            ctx.lineWidth = serie.candlestick.barWidth;
            ctx.moveTo(x,y1);
            ctx.lineTo(x,y2);
            ctx.stroke();     
        }
    }

    function init(plot)
    {
        var offset = null, opt = null, series = null;
        plot.hooks.processOptions.push(processOptions);
        function processOptions(plot,options){
            if (options.series.candlestick.active){
                $.extend(true,options,replaceOptions);
                opt = options;
                plot.hooks.processRawData.push(processRawData);
                plot.hooks.drawSeries.push(drawSeries);
            }
        }

        function findNearbyItemCandlestick ( mouseX, mouseY, i, serie )
        {
            var item = null;
            if ( serie.candlestick.show===true )
                item = findNearbyItem ( mouseX, mouseY, i, serie );

            return item;

            function findNearbyItem ( mouseX, mouseY, i, serie )
            {
                var item = null;
                for ( var j = 0; j < serie.data.length; j++ )
                {
                    var x,y1,y2,dataitem;
                    dataitem = serie.data[j];
                    x = serie.xaxis.p2c(dataitem[0]) - serie.candlestick.barWidth / 2;
                    y1 = serie.yaxis.p2c(dataitem[3]);
                    y2 = serie.yaxis.p2c(dataitem[4]);
                    if(between(mouseX,x,(x + serie.candlestick.barWidth))){
                        if(between(mouseY,y1,y2)){ item = [i,j]; }
                    }
                }
                return item;
            }
        }

        function processRawData ( plot, s, data, datapoints)
        {
            if ( s.candlestick.show === true )
            {
                s.nearBy = { findItem: findNearbyItemCandlestick };
                s.nearBy.drawHover = drawHoverCandlestick;
            }
        }

        function drawSeries ( plot, ctx, serie )
        {
            if(serie.candlestick.show === true){        
                if(typeof(serie.candlestick.lineWidth) === 'string'){
                    serie.candlestick.barWidth = parseInt(serie.candlestick.lineWidth,0);
                    serie.nearBy.width = serie.candlestick.barWidth;
                }
                else { 
                    var dp = serie.xaxis.p2c(serie.xaxis.min + serie.candlestick.lineWidth) - serie.xaxis.p2c(serie.xaxis.min);
                    serie.candlestick.barWidth = dp;
                    serie.nearBy.width = serie.candlestick.lineWidth;
                }
                offset = plot.getPlotOffset();   
                ctx.save();
                ctx.translate(offset.left,offset.top);
                for(var i = 0; i < serie.data.length; i++){serie.candlestick.drawCandlestick(ctx,serie,serie.data[i],false);}
                ctx.restore();
            }
        }

        function drawHoverCandlestick(octx,serie,dataIndex){
            var data;
            octx.save();
            if(dataIndex.length){ data = serie.data[dataIndex[0]];} else{ data = serie.data[dataIndex];}
            serie.candlestick.drawCandlestick(octx,serie,data,true);
            octx.restore();      
        }
    }

    $.plot.candlestick = {};
    $.plot.plugins.push({
        init: init,
        options: options,
        name: pluginName,
        version: pluginVersion
    });
})(jQuery);
