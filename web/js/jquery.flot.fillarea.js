/*
Flot plugin for drawing filled areas around a central line.

Released under the MIT license.

 Copyright (C) 2012 Ciengis, SA


This plugin makes it esay to draw a central line surrounded by several areas.
Each area corresponds to level around the line that can be configured using the
fillArea property of each series. The configuration of the levels can be done
as follows:

{   data: ...,
    fillArea : [
                { // 1st level
                 color: the area color; the default is the same color as the line
                 opacity: 0-1; the default is:
                         (n - i) / (n + 1)
                         where n is the number of levels and i the level index
                 representation: either "symmetric" or "asymmetric"; when 
                                "symmetric" is defined the level requires a single
                                value that represents an offset around the line,
                                when "asymmetric" is used the level will require
                                2 absolute values, the minimum and maximum.
                },{ // 2nd level
                 color: ...
                 opacity: ...
                 representation: ...
                }, 
                ...,
                {}
            ]
}

The size of the data points will be related with the number of levels and the 
values defined in representation.

Example:
    var areaconf= [{color:"green", representation:"symmetric",opacity:0.5},
                    {color:"blue", representation:"asymmetric"}];
    
    var mydata = [];
    for(var i = 0; i< 100; i++) {
         var x = i*2;
         var y = i+0.5;
             
         var stddev = 5.5;// use representation:"symmetric"
         var min = y- 10.0; // use representation:"asymmetric"
         var max = y+ 10.0;// use representation:"asymmetric"
   
         mydata[i] = [x,y,stddev, min, max];
     }
    
    var dataset = [            
                    {data:mydata,
                     fillArea:areaconf,
                     lines: { show: true, lineWidth: 2, fill: false, steps: true},
                     color:"brown",
                     opacity:1}
                 ];
    $.plot($("#placeholder"), dataset);             
 */


(function ($) {
   
    var options = {
        series: {
            fillArea: null           
        } 
    };
   
    function init(plot) {
        
        /* This function checks if the point are valid and put them in order to 
         * draw, in the points array.
         */
        function processFillAreaData(plot, series, data, datapoints) 
        {
            // copied from "jquery.flot.js"
            function updateAxis(axis, min, max) {
                if (min < axis.datamin && min != -fakeInfinity)
                    axis.datamin = min;
                if (max > axis.datamax && max != fakeInfinity)
                    axis.datamax = max;
            }

            // this plugin is applied to series with the fillArea property
            if(series.fillArea !== null && series.fillArea !== undefined)
            {
                // number of levels around the central line
                var nlevels = series.fillArea.length;
                // total number of values associated with one point
                var ps = nlevels * 2 +2 ;
                var format = formatNumbers(ps);
                datapoints.format = format;
                var steps = series.lines.steps;
                var size = ps * data.length;
                size = steps? size * 2 - 1: size;
                var points = new Array(size);
                
                datapoints.pointsize = ps;
                datapoints.points = points;
                
                var k = 0;
                
                // copy x and y from data to points
                for(var i = 0; i < data.length; i++)
                {
                    var point = data[i];
                    // if the point is not defined/null then all values are null
                    if (point === null || point === undefined) {
                        for(var j = 0; j < ps;j++) {
                            points[k+j] = null; 
                        }
                    } else {
                        points[k] = point[0]; // x
                        points[k+1] = point[1]; // y
                    }
                    if(steps) {
                        k += ps;
                    } 
                    k += ps;
                }
                
                // determine the upper and lower values for each level and save
                // then in points
                var pos = 2;
                for(var l = 0; l < nlevels; l++) {
                    k = 2 + l*2;
                    if(series.fillArea[l].representation == "symmetric") {
                        for(i=0; i<data.length; i++) {
                            point = data[i];
                            if(point !== null) {
                                points[k] = point[1] - point[pos]; // lower value
                                points[k+1] = point[1] + point[pos]; // upper value
                            }
                            
                            if(steps) {
                                k += ps; // leave some space for the extra point
                            } 
                            k += ps;
                        }
                        pos++; // one value from raw data used
                    } else {
                        for(i=0;i<data.length;i++) {
                            point = data[i];
                            if(point !== null) {
                                points[k] = point[pos]; // lower value
                                points[k + 1] = point[pos + 1]; // upper value
                            }
                            if(steps) {
                                k += ps;// leave some space for the extra point
                            } 
                            k += ps;
                        }
                        pos+=2;// 2 values from raw data used
                    }
                }
                    
                // show grid
                series.xaxis.used = series.yaxis.used = true;
                
                var fakeInfinity = Number.MAX_VALUE;
                var m, val,f;        
                var ps2 = steps? ps*2 : ps;
                
                // adapted from "jquery.flot.js"
                for (k = 0; k < points.length; k += ps2) {

                    var nullify = points[k] === null;
                    if (!nullify) {
                        for (m = 0; m < ps; ++m) {
                            val = points[k + m];
                            f = format[m];

                            if (f) {
                                if (f.number && val != null) {
                                    val = +val; // convert to number
                                    if (isNaN(val))
                                        val = null;
                                    else if (val == Infinity)
                                        val = fakeInfinity;
                                    else if (val == -Infinity)
                                        val = -fakeInfinity;
                                }

                                if (val === null) {
                                    if (f.required)
                                        nullify = true;
                                    
                                    if (f.defaultValue != null)
                                        val = f.defaultValue;
                                }
                            }
                            
                            points[k + m] = val;
                        }
                    }
                    
                    if (nullify) {
                        for (m = 0; m < ps; ++m) {
                            val = points[k + m];
                            if (val != null) {
                                f = format[m];
                                // extract min/max info
                                if (f.x)
                                    updateAxis(series.xaxis, val, val);
                                if (f.y)
                                    updateAxis(series.yaxis, val, val);
                            }
                            points[k + m] = null;
                        }
                    }
               
                }
             
                /*
                * fill in the missing points to create the steps
                */
                if(steps == true) {
                    var lastk = points.length - ps; // last point excluded
                    for(k = 0; k < lastk; k+=ps2) {
                        if(points[k] === null || points[k+ps2] === null) {
                            // next point is empty
                            for(m = 0; m < ps; m++) {
                                points[k+ps+m] = null;
                            }
                        } else {
                            points[k+ps] = points[k+ps2]; // x value
                            for(m = 1; m < ps; m++) {
                                points[k+ps+m] = points[k+m]; // y values
                            }
                        }
                    }                        
                }
            }
       
        }
       
       
        // return the format of the numbers 
        function formatNumbers(dataSize)
        {
            var format = [{
                x: true, 
                number: true, 
                required: true
            },{
                y: true, 
                number: true, 
                required: true
            }];

            for(var i = 2; i < dataSize; i++)
            {
                format.push({
                    y: true, 
                    number: true, 
                    required: true
                });
            }
            
            return format;
        }
        
      
        // adapted from "jquery.flot" 
        function plotLineArea(points, axisx, axisy, ctx, ps, yLow, yUp, color, opacity) {
            var i = 0, areaOpen = false,
            ypos = yUp, segmentStart = 0, segmentEnd = 0;
            
            ctx.fillStyle = color;
            
            ctx.globalAlpha=opacity; 
            
            // we process each segment in two turns, first forward
            // direction to sketch out top, then once we hit the
            // end we go backwards to sketch the bottom

            while (true) {
                if (ps > 0 && i > points.length + ps)
                    break;

                i += ps; // ps is negative if going backwards

                var x1 = points[i - ps],
                y1 = points[i - ps + ypos],
                x2 = points[i], y2 = points[i + ypos];

                if (areaOpen) {
                    if (ps > 0 && x1 != null && x2 == null) {
                        // at turning point
                        segmentEnd = i;
                        ps = -ps;
                        ypos = yLow;
                        continue;
                    }

                    if (ps < 0 && i == segmentStart + ps) {
                        // done with the reverse sweep
                        ctx.fill();
                        areaOpen = false;
                        ps = -ps;
                        ypos = yUp;
                        i = segmentStart = segmentEnd + ps;
                        continue;
                    }
                }

                if (x1 == null || x2 == null)
                    continue;

                // clip x values
                    
                // clip with xmin
                if (x1 <= x2 && x1 < axisx.min) {
                    if (x2 < axisx.min)
                        continue;
                    y1 = (axisx.min - x1) / (x2 - x1) * (y2 - y1) + y1;
                    x1 = axisx.min;
                }
                else if (x2 <= x1 && x2 < axisx.min) {
                    if (x1 < axisx.min)
                        continue;
                    y2 = (axisx.min - x1) / (x2 - x1) * (y2 - y1) + y1;
                    x2 = axisx.min;
                }

                // clip with xmax
                if (x1 >= x2 && x1 > axisx.max) {
                    if (x2 > axisx.max)
                        continue;
                    y1 = (axisx.max - x1) / (x2 - x1) * (y2 - y1) + y1;
                    x1 = axisx.max;
                }
                else if (x2 >= x1 && x2 > axisx.max) {
                    if (x1 > axisx.max)
                        continue;
                    y2 = (axisx.max - x1) / (x2 - x1) * (y2 - y1) + y1;
                    x2 = axisx.max;
                }

                if (!areaOpen) {
                    // open area
                    ctx.beginPath();
                    ctx.moveTo(axisx.p2c(x1), axisy.p2c(y1));
                    areaOpen = true;
                }
                    
                // now first check the case where both is outside
                if (y1 >= axisy.max && y2 >= axisy.max) {
                    ctx.lineTo(axisx.p2c(x1), axisy.p2c(axisy.max));
                    ctx.lineTo(axisx.p2c(x2), axisy.p2c(axisy.max));
                    continue;
                }
                else if (y1 <= axisy.min && y2 <= axisy.min) {
                    ctx.lineTo(axisx.p2c(x1), axisy.p2c(axisy.min));
                    ctx.lineTo(axisx.p2c(x2), axisy.p2c(axisy.min));
                    continue;
                }
                    
                // else it's a bit more complicated, there might
                // be a flat maxed out rectangle first, then a
                // triangular cutout or reverse; to find these
                // keep track of the current x values
                var x1old = x1, x2old = x2;

                // clip the y values, without shortcutting, we
                // go through all cases in turn
                    
                // clip with ymin
                if (y1 <= y2 && y1 < axisy.min && y2 >= axisy.min) {
                    x1 = (axisy.min - y1) / (y2 - y1) * (x2 - x1) + x1;
                    y1 = axisy.min;
                }
                else if (y2 <= y1 && y2 < axisy.min && y1 >= axisy.min) {
                    x2 = (axisy.min - y1) / (y2 - y1) * (x2 - x1) + x1;
                    y2 = axisy.min;
                }

                // clip with ymax
                if (y1 >= y2 && y1 > axisy.max && y2 <= axisy.max) {
                    x1 = (axisy.max - y1) / (y2 - y1) * (x2 - x1) + x1;
                    y1 = axisy.max;
                }
                else if (y2 >= y1 && y2 > axisy.max && y1 <= axisy.max) {
                    x2 = (axisy.max - y1) / (y2 - y1) * (x2 - x1) + x1;
                    y2 = axisy.max;
                }

                // if the x value was changed we got a rectangle
                // to fill
                if (x1 != x1old) {
                    ctx.lineTo(axisx.p2c(x1old), axisy.p2c(y1));
                // it goes to (x1, y1), but we fill that below
                }
                    
                // fill triangular section, this sometimes result
                // in redundant points if (x1, y1) hasn't changed
                // from previous line to, but we just ignore that
                ctx.lineTo(axisx.p2c(x1), axisy.p2c(y1));
                ctx.lineTo(axisx.p2c(x2), axisy.p2c(y2));

                // fill the other rectangle if it's there
                if (x2 != x2old) {
                    ctx.lineTo(axisx.p2c(x2), axisy.p2c(y2));
                    ctx.lineTo(axisx.p2c(x2old), axisy.p2c(y2));
                }
                   
            }
        }
        
        function levelOpacity(series, l) {
            var nlevels  = series.fillArea.length;
                            
            var opacity = series.fillArea[l].opacity;
            
            // if the opacity is not defined use the formula below
            if(opacity === null || opacity === undefined)
                opacity = (nlevels-l)/(nlevels+1);
            
            return opacity;
        }
        
        function levelColor(series, l) {
            var color = series.fillArea[l].color;
            
            // if the color is not defined use the color of the line
            if(color === null || color === undefined)
                color =  series.color;
            
            return color;
        }
        

        /* Draws an area around the line.
         * It starts by drawing the areas farther from line so that the areas
         * closer to the line are always visible.
         */
        function drawArea(plot, ctx, series) 
        {
            if(series.fillArea !== null && series.fillArea !== undefined)
            { 
                var plotOffset = plot.getPlotOffset();
               
                ctx.save();
                ctx.translate(plotOffset.left, plotOffset.top);
                var points = series.datapoints.points;
                var ps = series.datapoints.pointsize; //number of x and y's
                var xaxis = series.xaxis;
                var yaxis = series.yaxis;
              
                var nlevels  = series.fillArea.length;
                var color, opacity;
                
                // areas on top of the line
                var yUp = ps-1;
                var yLow = yUp - 2;
                for(var l = nlevels-1; l > 0; l--) {
                    color = levelColor(series, l);                  
                    opacity = levelOpacity(series, l);
                 
                    plotLineArea(points, xaxis, yaxis, ctx, ps, yLow, yUp, color, opacity);
                    yUp -= 2;
                    yLow -= 2;
                }
                
                // areas on bottom of the line
                yUp = ps-2;
                yLow = yUp - 2;
                for(l = nlevels-1; l > 0; l--) {                   
                    color = levelColor(series, l);                  
                    opacity = levelOpacity(series, l);
                   
                    plotLineArea(points, xaxis, yaxis, ctx, ps, yLow, yUp, color, opacity);
                    yUp -= 2;
                    yLow -= 2;
                }
                
                // area around the line
                if(nlevels > 0) {
                    color = levelColor(series, 0);                  
                    opacity = levelOpacity(series, 0);

                    plotLineArea(points, xaxis, yaxis, ctx, ps, 2, 3, color, opacity);
                }
                
                ctx.restore();

            }
            
        }
        
        plot.hooks.processRawData.push(processFillAreaData);
        plot.hooks.drawSeries.push(drawArea);
        
    }
   
    $.plot.plugins.push({
        init: init,
        options: options,
        name: 'fillarea',
        version: '1.0'
    });
})(jQuery);
