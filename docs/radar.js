// The MIT License (MIT)

// Copyright (c) 2017 Zalando SE

// Permission is hereby granted, free of charge, to any person obtaining a copy
// of this software and associated documentation files (the "Software"), to deal
// in the Software without restriction, including without limitation the rights
// to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
// copies of the Software, and to permit persons to whom the Software is
// furnished to do so, subject to the following conditions:

// The above copyright notice and this permission notice shall be included in
// all copies or substantial portions of the Software.

// THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
// IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
// FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
// AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
// LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
// OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN
// THE SOFTWARE.


function radar_visualization(config) {

  config.legend = config.legend || {};
  config.legend.label_limit = config.legend.label_limit || 20;
  config.legend.no_middle = config.legend.no_middle || false;
  config.legend.split_mode = config.legend.split_mode || 'fixed';

  const legendSegmentSplitAt = (segment, segment_idx, segment_name) => { //legendNextColumn(segment, ring) {
//console.log('legendSegmentSplitAt - segment: ', segment, segment_idx, segment_name);
    const ringOffset = 3; //equivalent number of entries for height of ring title
    const total = segment.reduce((acc,v) => acc + (v.length || 1), 0) + ringOffset * segment.length;
//console.log('total: ', total);
    let res = null;

    switch (config.legend.split_mode) {
      case 'ring': //wrap whole rings to balance columns
        let acc_ring = 0;
        for (let r = 0; r < segment.length; r++) {
          const delta = ringOffset + (segment[r].length || 1);
          const new_acc_ring = acc_ring + delta;
//console.log('r, acc_ring, delta', r, acc_ring, delta);
          if (new_acc_ring > total / 2) {
            const height_split_before = Math.max(new_acc_ring, total - new_acc_ring);
            const height_split_after = Math.max(acc_ring, total - acc_ring);
            res = {
              ring: height_split_before >= height_split_after ? r : r+1,
              entry: 0
            };
            break;
          }
          acc_ring = new_acc_ring;
        }
        break;
      case 'entry': //allow for ring entries to be partially in next column
        let acc_entry = 0;
        for (let r = 0; r < segment.length; r++) {
          const delta = ringOffset + (segment[r].length || 1);
//console.log('r, acc_entry, delta', r, acc_entry, delta);
          if (acc_entry + delta > total / 2) {
            res = {ring: r, entry: Math.max(Math.floor(total / 2 - acc_entry - ringOffset), 0)};
            break;
          }
					acc_entry += delta;
        }
        break;
      case 'fixed': //always equal number of rings in column
      default:
        res = {ring: Math.ceil(segment.length / 2), entry: 0};
    }
    if (!res) res = {ring: segment.length-1, entry: 0};
//console.log('legendSegmentSplitAt - res: ', res);
    return res;
  };

  if (config.quadrants.length < 2) throw new Error('Number of segments/quadrants to low');

  // custom random number generator, to make random sequence reproducible
  // source: https://stackoverflow.com/questions/521295
  let seed = 42;
  function random() {
    const x = Math.sin(seed++) * 10000;
    return x - Math.floor(x);
  }

  function random_between(min, max) {
    return min + random() * (max - min);
  }

  function normal_between(min, max) {
    return min + (random() + random()) * 0.5 * (max - min);
  }

  const rings = [
    { radius: 130 },
    { radius: 220 },
    { radius: 310 },
    { radius: 400 }
  ];

  // radial_min / radial_max are multiples of PI
  const quadrants = config.quadrants;
  //start at vertical up line and go to the left
  const radial_delta = 2 / quadrants.length;
  let radial_max = 1.5;
  for (let q = 0; q < quadrants.length; q++) {
    quadrants[q].radial_max = radial_max;
    quadrants[q].radial_min = radial_max - radial_delta;
    radial_max -= radial_delta;
  }
  
  const blip_margin = 15;

  function polar(cartesian) {
    const x = cartesian.x;
    const y = cartesian.y;
    return {
      t: Math.atan2(y, x), // -Pi < t <= Pi
      r: Math.sqrt(x * x + y * y)
    }
  }

  function cartesian(polar) {
    return {
      x: polar.r * Math.cos(polar.t),
      y: polar.r * Math.sin(polar.t)
    }
  }

  function bounded_interval(value, min, max) {
    const low = Math.min(min, max);
    const high = Math.max(min, max);
    return Math.min(Math.max(value, low), high);
  }

  function normalize_t(t) {
    // -Pi < t <= Pi
    return (t + Math.PI) % (2 * Math.PI) - Math.PI;
  }

  function bounded_polar(polar, polar_min, polar_max, margin) {
    const r = bounded_interval(polar.r, polar_min.r + margin, polar_max.r - margin);
    const margin_t = margin * 2.2 / (Math.PI * r);

    const min_t = polar_min.t + margin_t;
    const max_t = polar_max.t - margin_t;
    const min_t_norm = normalize_t(min_t);
    const max_t_norm = normalize_t(max_t);

    let t;
    if ((max_t_norm < min_t_norm) && (min_t < max_t)) {
      const t_lower = bounded_interval(polar.t, -Math.PI, min_t_norm);
      const t_upper = bounded_interval(polar.t, max_t_norm, Math.PI);
			t = (t_upper < Math.PI) ? t_upper : t_lower;
    } else {
      t = bounded_interval(polar.t, min_t_norm, max_t_norm);
    }

    return {t: t, r: r};
  }

  function segment(quadrant, ring) {
    const polar_min = {
      t: quadrants[quadrant].radial_min * Math.PI,
      r: ring == 0 ? 30 : rings[ring - 1].radius
    };
    const polar_max = {
      t: quadrants[quadrant].radial_max * Math.PI,
      r: rings[ring].radius
    };
    return {
      clip: function(point) {
        const p = polar(point);
        const bounded = bounded_polar(p, polar_min, polar_max, blip_margin);
        const c = cartesian(bounded);
        point.x = c.x; // adjust data too!
        point.y = c.y; // adjust data too!
      },
      random: function() {
        const p = {
          t: random_between(polar_min.t, polar_max.t),
          r: normal_between(polar_min.r, polar_max.r)
        };
        const pxy = cartesian(p);
        return pxy;
      }
    }
  }

  // filter entries with invalid quadrant
  for (let i = config.entries.length - 1; i >= 0; i--) {
    const entry = config.entries[i];
    if (entry.quadrant >= quadrants.length) {
      console.log('ignored entry - incorrect quadrant index in entry[' + i + ']', entry);
      config.entries.splice(i, 1);
    }
  }

  // position each entry randomly in its segment
  for (let i = 0; i < config.entries.length; i++) {
    const entry = config.entries[i];
    entry.segment = segment(entry.quadrant, entry.ring);
    const point = entry.segment.random();
    entry.x = point.x;
    entry.y = point.y;
    entry.color = entry.active || config.print_layout ?
      config.rings[entry.ring].color : config.colors.inactive;
  }

  // partition entries according to segments
  const segmented = new Array(quadrants.length);
  for (let quadrant = 0; quadrant < quadrants.length; quadrant++) {
    segmented[quadrant] = new Array(rings.length);
    for (let ring = 0; ring < rings.length; ring++) {
      segmented[quadrant][ring] = [];
    }
  }
  for (let i = 0; i < config.entries.length; i++) {
    const entry = config.entries[i];
    segmented[entry.quadrant][entry.ring].push(entry);
  }

  // assign unique sequential id to each entry
  let id = 1;
  for (let quadrant = 0; quadrant < quadrants.length; quadrant++) {
    for (let ring = 0; ring < 4; ring++) {
      const entries = segmented[quadrant][ring];
      entries.sort(function(a,b) { return a.label.localeCompare(b.label); })
      for (let i = 0; i < entries.length; i++) {
        entries[i].id = "" + id++;
      }
    }
  }

  function translate(x, y) {
    return "translate(" + x + "," + y + ")";
  }

  function viewbox(quadrant) {
    return [
      Math.max(0, quadrants[quadrant].factor_x * 400) - 420,
      Math.max(0, quadrants[quadrant].factor_y * 400) - 420,
      440,
      440
    ].join(" ");
  }

  config.radar_height = config.height;
  if (!config.legend.no_middle && (Math.floor(quadrants.length / 2) * 2 < quadrants.length)) {
    //make space for middle segment legend on the bottom
    config.height += 18 //segment title
                  +  2 * (5+14+10) //ring headers
                  -  60; //initial bottom margin reduction
    const middle_entries = segmented[Math.floor(quadrants.length / 2)];
    let max_column_entries = 0;
    let column_entries = 0;
    for (let r = 0; r < middle_entries.length; r++) {
      if (r % 2 === 0) {
        if (column_entries > max_column_entries) max_column_entries = column_entries;
        column_entries = 0;
      }
      column_entries += middle_entries[r].length;
    }
    if (column_entries > max_column_entries) max_column_entries = column_entries;
    config.height += max_column_entries * 12;
  }
  const svg = d3.select("svg#" + config.svg_id)
    .style("background-color", config.colors.background)
    .attr("width",config.width)
    .attr("height",config.height);
  const wrapper = svg.select(function() {return this.parentNode}).insert("div")
    .style("display","relative")
    .attr("class","radar-wrapper");
  svg.each(function() {const el = this; wrapper.append(function () {return el})});
  const overlay = wrapper.append("div")
    .style("position","absolute")
    .style("left","0px")
    .style("top","0px")
    .style("width",config.width + "px")
    .style("height",config.height + "px")
    .style("pointer-events","none")
    .style("display","flex")
    .style("flex-direction","column")
    .attr("class","radar-overlay");

  const radar = svg.append("g");
  if ("zoomed_quadrant" in config) {
    return alert('zooming not supported');
    svg.attr("viewBox", viewbox(config.zoomed_quadrant));
  } else {
    radar.attr("transform", translate(config.width / 2, config.radar_height / 2));
  }

  const grid = radar.append("g");

  // draw grid lines and segment labels
  for (let quadrant = 0; quadrant < quadrants.length; quadrant++) {
    const polar_min = {
      t: quadrants[quadrant].radial_min * Math.PI,
      r: rings[rings.length - 1].radius
    };
    const cartesian_min = cartesian(polar_min);
    const polar_max = {
      t: quadrants[quadrant].radial_max * Math.PI,
      r: rings[rings.length - 1].radius
    };
    const cartesian_max = cartesian(polar_max);
    //drawing separate line for each segment min/max to support separated segment splits
    grid.append("line")
      .attr("x1", 0).attr("y1", 0)
      .attr("x2", cartesian_min.x).attr("y2", cartesian_min.y)
      .style("stroke", config.colors.grid)
      .style("stroke-width", 1);
    grid.append("line")
      .attr("x1", 0).attr("y1", 0)
      .attr("x2", cartesian_max.x).attr("y2", cartesian_max.y)
      .style("stroke", config.colors.grid)
      .style("stroke-width", 1);
    if (config.print_layout && quadrants[quadrant].symbol) {
      const polar_label = {
        t: (polar_min.t + polar_max.t) / 2,
        r: (rings[rings.length - 1].radius + rings[rings.length - 2].radius) / 2
      };
      const cartesian_label = cartesian(polar_label);
      grid.append("text")
        .text(quadrants[quadrant].symbol)
        .attr("x", cartesian_label.x)
        .attr("y", cartesian_label.y)
        .attr("text-anchor", "middle")
        .attr("alignment-baseline", "middle")
        .style("fill", "#e5e5e5")
        .style("font-family", "Arial, Helvetica")
        .style("font-size", 30)
        .style("font-weight", "bold")
        .style("pointer-events", "none")
        .style("user-select", "none");
    }
  }

  // background color. Usage `.attr("filter", "url(#solid)")`
  // SOURCE: https://stackoverflow.com/a/31013492/2609980
  const defs = grid.append("defs");
  const filter = defs.append("filter")
    .attr("x", 0)
    .attr("y", 0)
    .attr("width", 1)
    .attr("height", 1)
    .attr("id", "solid");
  filter.append("feFlood")
    .attr("flood-color", "rgb(0, 0, 0, 0.8)");
  filter.append("feComposite")
    .attr("in", "SourceGraphic");

  // draw rings
  for (let i = 0; i < rings.length; i++) {
    grid.append("circle")
      .attr("cx", 0)
      .attr("cy", 0)
      .attr("r", rings[i].radius)
      .style("fill", "none")
      .style("stroke", config.colors.grid)
      .style("stroke-width", 1);
    if (config.print_layout) {
      grid.append("text")
        .text(config.rings[i].name)
        .attr("y", -rings[i].radius + 62)
        .attr("text-anchor", "middle")
        .attr("x", -4)
        .style("fill", "#e5e5e5")
        .style("font-family", "Arial, Helvetica")
        .style("font-size", 42)
        .style("font-weight", "bold")
        .style("pointer-events", "none")
        .style("user-select", "none");
    }
  }

  // draw title and legend (only in print layout)
  if (config.print_layout) {

    // title
    overlay.append("div")
      .text(config.title)
      .style("font-family", "Arial, Helvetica")
      .style("font-size", "34px")
      .style("margin-left", "50px")
      .style("margin-top", "20px")
      .style("flex-shrink", "1")
      .attr("class", "radar-title");

    // legend
    const legend = overlay.append("div")
      .style("display","flex")
      .style("flex-wrap","nowrap")
      .style("justify-content","space-between")
      .style("flex-direction","row")
      .style("flex-grow", "1")
      .style("margin-left", "50px")
      .style("margin-top", "20px")
			.attr("class", "radar-legend");
    const left = legend.append("div")
      .style("display","flex")
      .style("flex-wrap","nowrap")
      .style("flex-direction","column");
    const middle = legend.append("div")
      .style("display","flex")
      .style("flex-wrap","nowrap")
      .style("align-self","flex-end")
      .style("flex-direction","column");
    const right = legend.append("div")
      .style("display","flex")
      .style("flex-wrap","nowrap")
      .style("flex-direction","column-reverse");
    for (let quadrant = 0; quadrant < quadrants.length; quadrant++) {
      const q = quadrants[quadrant];
      const half = Math.floor(quadrants.length / 2);
      const legend_column = config.legend.no_middle ? (quadrant <= half ? left : right) : ((quadrant < half) ? left : (quadrant >= quadrants.length - half ? right : middle));
      const legend_quadrant = legend_column.append("div")
        .style("flex","1")
        .style("justify-content","space-between")
        .style("margin-top","0px")
        .text((q.symbol ? q.symbol + '. ' : '') + q.name)
        .style("font-family","Arial, Helvetica")
        .style("font-size","18")
      .append("div")
        .style("pointer-events","auto")
        .style("display","flex")
        .style("flex-direction","row")
        .style("justify-content","flex-start");

      const createLegendQuadrantColumn = (legend_quadrant) => legend_quadrant.append("div")
            .style("margin-right","10px")
            .style("margin-top","0px")
            .style("display","flex")
            .style("flex-wrap","wrap")
            .style("flex-direction","column")
            .style("justify-content","flex-start");

      let legend_quadrant_column = createLegendQuadrantColumn(legend_quadrant);
      const split_at = legendSegmentSplitAt(segmented[quadrant], quadrant, q.name);
      for (let ring = 0; ring < rings.length; ring++) {
        if ((split_at.ring === ring) && (split_at.entry === 0)) {
          legend_quadrant_column = createLegendQuadrantColumn(legend_quadrant);
        }

        const renderLegendRingWrapper = () => legend_quadrant_column.append("div")
          .style("display","flex")
          .style("margin-top","10px")
          .style("flex-grow","0")
          .style("flex-shrink","1")
          .style("flex-direction","column");

				let legend_ring_wrapper = renderLegendRingWrapper();
        legend_ring_wrapper.append("div")
          .text(config.rings[ring].name)
          .style("margin-bottom","5px")
          .style("font-family","Arial, Helvetica")
          .style("font-size","12px")
          .style("font-weight","bold");

        if (segmented[quadrant][ring].length === 0) {
          legend_ring_wrapper.append("div")
            .attr("class", "legend" + quadrant + ring)
            .text("-")
            .style("font-family","Arial, Helvetica")
            .style("font-size","11");
          continue;
        }

        const renderLegendRing = (data) => legend_ring_wrapper.selectAll(".legend" + quadrant + ring)
          .data(data)
          .enter()
            .append("div")
              .attr("class","legend" + quadrant + ring)
              .attr("id", function(d, i) { return "legendItem" + d.id; })
              .text(function(d, i) {
                let label = d.label || "";
                if ((config.legend.label_limit > 0) && (label.length > config.legend.label_limit + 3))
                  label = label.substr(0,20) + '...'; 
                return d.id + ". " + label;
              })
              .style("font-family","Arial, Helvetica")
              .style("font-size","11")
              .on("mouseover", function(d) { showBubble(d); highlightLegendItem(d); })
              .on("mouseout", function(d) { hideBubble(d); unhighlightLegendItem(d); });
        if ((split_at.ring !== ring) || (split_at.entry === 0)) {
          renderLegendRing(segmented[quadrant][ring]);
        } else {
          renderLegendRing(segmented[quadrant][ring].slice(0, split_at.entry));
          legend_quadrant_column = createLegendQuadrantColumn(legend_quadrant);
          legend_ring_wrapper = renderLegendRingWrapper();
          renderLegendRing(segmented[quadrant][ring].slice(split_at.entry));
        }
      }
    }

    // footer
    overlay.append("div")
      .text("▲ moved up     ▼ moved down")
      .style("margin-left", "50px")
      .style("white-space", "pre")
      .style("font-family", "Arial, Helvetica")
      .style("font-size", "10");
  }

  // layer for entries
  const rink = radar.append("g")
    .attr("id", "rink");

  // rollover bubble (on top of everything else)
  const bubble = radar.append("g")
    .attr("id", "bubble")
    .attr("x", 0)
    .attr("y", 0)
    .style("opacity", 0)
    .style("pointer-events", "none")
    .style("user-select", "none");
  bubble.append("rect")
    .attr("rx", 4)
    .attr("ry", 4)
    .style("fill", "#333");
  bubble.append("text")
    .style("font-family", "sans-serif")
    .style("font-size", "10px")
    .style("fill", "#fff");
  bubble.append("path")
    .attr("d", "M 0,0 10,0 5,8 z")
    .style("fill", "#333");

  function showBubble(d) {
    if (d.active || config.print_layout) {
      const tooltip = d3.select("#bubble text")
        .text(d.label);
      const bbox = tooltip.node().getBBox();
      d3.select("#bubble")
        .attr("transform", translate(d.x - bbox.width / 2, d.y - 16))
        .style("opacity", 0.8);
      d3.select("#bubble rect")
        .attr("x", -5)
        .attr("y", -bbox.height)
        .attr("width", bbox.width + 10)
        .attr("height", bbox.height + 4);
      d3.select("#bubble path")
        .attr("transform", translate(bbox.width / 2 - 5, 3));
    }
  }

  function hideBubble(d) {
    const bubble = d3.select("#bubble")
      .attr("transform", translate(0,0))
      .style("opacity", 0);
  }

  function highlightLegendItem(d) {
    const legendItem = document.getElementById("legendItem" + d.id);
    if (!legendItem) return;
    legendItem.style.filter = "url(#solid)";
    legendItem.style.color = "white";
  }

  function unhighlightLegendItem(d) {
    const legendItem = document.getElementById("legendItem" + d.id);
    if (!legendItem) return;
    legendItem.style.filter = "";
    legendItem.style.color = "";
  }

  // draw blips on radar
  const blips = rink.selectAll(".blip")
    .data(config.entries)
    .enter()
      .append("g")
        .attr("class", "blip")
        .on("mouseover", function(d) { showBubble(d); highlightLegendItem(d); })
        .on("mouseout", function(d) { hideBubble(d); unhighlightLegendItem(d); });

  // configure each blip
  blips.each(function(d) {
    const blip = d3.select(this);

    // blip link
    if (!config.print_layout && d.active && d.hasOwnProperty("link")) {
      blip = blip.append("a")
        .attr("xlink:href", d.link);
    }

    // blip shape
    if (d.moved > 0) {
      blip.append("path")
        .attr("d", "M -11,5 11,5 0,-13 z") // triangle pointing up
        .style("fill", d.color);
    } else if (d.moved < 0) {
      blip.append("path")
        .attr("d", "M -11,-5 11,-5 0,13 z") // triangle pointing down
        .style("fill", d.color);
    } else {
      blip.append("circle")
        .attr("r", 9)
        .attr("fill", d.color);
    }

    // blip text
    if (d.active || config.print_layout) {
      const blip_text = config.print_layout ? d.id : d.label.match(/[a-z]/i);
      blip.append("text")
        .text(blip_text)
        .attr("y", 3)
        .attr("text-anchor", "middle")
        .style("fill", "#fff")
        .style("font-family", "Arial, Helvetica")
        .style("font-size", function(d) { return blip_text.length > 2 ? "8" : "9"; })
        .style("pointer-events", "none")
        .style("user-select", "none");
    }

  });

  // make sure that blips stay inside their segment
  function ticked() {
    blips.attr("transform", function(d) {
    d.segment.clip(d);
      return translate(d.x, d.y);
    })
  }

  // distribute blips, while avoiding collisions
  d3.forceSimulation()
    .nodes(config.entries)
    .velocityDecay(0.19) // magic number (found by experimentation)
    .force("collision", d3.forceCollide().radius(12).strength(0.85))
    .on("tick", ticked);
}
