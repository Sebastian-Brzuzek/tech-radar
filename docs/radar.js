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

  const DEBUG = !!config.debug;
	
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

	const title_offset =
    { x: -675, y: -420 };

  const footer_offset =
    { x: -675, y: 420 };

  const rings = [
    { radius: 130 },
    { radius: 220 },
    { radius: 310 },
    { radius: 400 }
  ];
	
	const legend_limits = {
		x: 675,
		y: 320
	}

  // radial_min / radial_max are multiples of PI
  const quadrants = [];
  //start at vertical up line and go to the left
  const radial_delta = 2 / config.quadrants.length;
  let radial_max = 1.5;
  for (let q = 0; q < config.quadrants.length; q++) {
    quadrants.push({
      radial_max: radial_max,
      radial_min: radial_max - radial_delta
    });
    radial_max -= radial_delta;
  }
  console.log('quadrants', quadrants);

  //original
  //const legend_offset = [
	//original
    //{ x: 450, y: 90 },
    //{ x: -675, y: 90 },
    //{ x: -675, y: -310 },
    //{ x: 450, y: -310 },
	//5 parts
    // { x: -675, y: -310 },
    // { x: -80, y: -310 },
    // { x: 450, y: -310 },
    // { x: 450, y: 90 },
    // { x: -80, y: 340 },
    // { x: -675, y: 90 },
  // ];
  const legend_offset = [];
	const legend_rows = Math.floor(quadrants.length / 2);

	//left top
	legend_offset.push({
		x: -legend_limits.x,
		y: -legend_limits.y,
		h: 'left',
		v: 'top'
	});
	//left middle
  for (let q = 1; q < legend_rows - 1; q++) {
		const t = (quadrants[q].radial_max + quadrants[q].radial_min) * Math.PI / 2;
		legend_offset.push({
			x: -legend_limits.x,
			y: -legend_limits.x * Math.tan(t),
			h: 'left',
			v: 'middle'
		});
	}
	//left bottom
	if (legend_rows > 1) {
		legend_offset.push({
			x: -legend_limits.x,
			y: legend_limits.y,
			h: 'left',
			v: 'bottom'
		});
	}

	//middle (odd number of quadrants)
	if (legend_rows * 2 < quadrants.length) {
		legend_offset.push({
			x: 0,
			y: legend_limits.y,
			h: 'middle',
			v: 'bottom'
		});
	}

	//right bottom
	if (legend_rows > 1) {
		legend_offset.push({
			x: legend_limits.x,
			y: legend_limits.y,
			h: 'right',
			v: 'bottom'
		});
	}
	//right middle
  for (let q = quadrants.length - legend_rows + 1; q < quadrants.length - 1; q++) {
		const t = (quadrants[q].radial_max + quadrants[q].radial_min) * Math.PI / 2;
		legend_offset.push({
			x: legend_limits.x,
			y: legend_limits.x * Math.tan(t),
			h: 'right',
			v: 'middle'
		});
	}
	//right top
	legend_offset.push({
		x: legend_limits.x,
		y: -legend_limits.y,
		h: 'right',
		v: 'top'
	});
  console.log('legend_offset', legend_offset);
  
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
				if (DEBUG) point.polar = bounded;
      },
      random: function() {
				const p = {
          t: random_between(polar_min.t, polar_max.t),
          r: normal_between(polar_min.r, polar_max.r)
        };
				const pxy = cartesian(p);
				if (DEBUG) pxy.polar = p;
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
		if (DEBUG) {
			entry.polar_org = point.polar;
			entry.xy_org = {x: point.x, y: point.y};
		}
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
  //it should be possible to define segments as needed instead of hardcoded mixing order of them
  //for (var quadrant of [2,3,1,0]) {
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

  const svg = d3.select("svg#" + config.svg_id)
    .style("background-color", config.colors.background)
    .attr("width", config.width)
    .attr("height", config.height);

  const radar = svg.append("g");
  if ("zoomed_quadrant" in config) {
	return alert('zooming not supported');
    svg.attr("viewBox", viewbox(config.zoomed_quadrant));
  } else {
    radar.attr("transform", translate(config.width / 2, config.height / 2));
  }

  const grid = radar.append("g");

  // draw grid lines
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

  function legend_transform(quadrant, ring, index=null, relative=0) {
    const dx = ring < 2 ? 0 : 120;
    let dy = (index == null ? -16 : index * 12);
    if (ring % 2 == 1) {
      dy = dy + 36 + segmented[quadrant][ring-1].length * 12;
    }
		if (!relative)
			return translate(
				legend_offset[quadrant].x + dx,
				legend_offset[quadrant].y + dy
			);
		return translate(
			dx,
			dy
		);
  }

  // draw title and legend (only in print layout)
  if (config.print_layout) {

    // title
    radar.append("text")
      .attr("transform", translate(title_offset.x, title_offset.y))
      .text(config.title)
      .style("font-family", "Arial, Helvetica")
      .style("font-size", "34");

    // footer
    radar.append("text")
      .attr("transform", translate(footer_offset.x, footer_offset.y))
      .text("▲ moved up     ▼ moved down")
      .attr("xml:space", "preserve") //deprecated - to remove when white-space pre will be supported in all major browsers
			.style("white-space", "pre")
      .style("font-family", "Arial, Helvetica")
      .style("font-size", "10");

    // legend
    const legend = radar.append("g");
    for (let quadrant = 0; quadrant < quadrants.length; quadrant++) {
			const legend_quadrant = legend.append("g");
			legend_quadrant.attr("transform", translate(
          legend_offset[quadrant].x,
          legend_offset[quadrant].y - 45
        ));
      legend_quadrant.append("text")
        //.attr("transform", translate(
        //  legend_offset[quadrant].x,
        //  legend_offset[quadrant].y - 45
        //))
        .text(config.quadrants[quadrant].name)
        .style("font-family", "Arial, Helvetica")
        .style("font-size", "18");
      for (let ring = 0; ring < rings.length; ring++) {
        legend_quadrant.append("text")
          .attr("transform", legend_transform(quadrant, ring, null, 1))
          .text(config.rings[ring].name)
          .style("font-family", "Arial, Helvetica")
          .style("font-size", "12")
          .style("font-weight", "bold");
        legend_quadrant.selectAll(".legend" + quadrant + ring)
          .data(segmented[quadrant][ring])
          .enter()
            .append("text")
              .attr("transform", function(d, i) { return legend_transform(quadrant, ring, i, 1); })
              .attr("class", "legend" + quadrant + ring)
              .attr("id", function(d, i) { return "legendItem" + d.id; })
              .text(function(d, i) { return d.id + ". " + d.label; })
              .style("font-family", "Arial, Helvetica")
              .style("font-size", "11")
              .on("mouseover", function(d) { showBubble(d); highlightLegendItem(d); })
              .on("mouseout", function(d) { hideBubble(d); unhighlightLegendItem(d); });
      }
    }
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

  if (DEBUG) {
		const debug = radar.append("g")
      .attr("id", "debug")
			.attr("x", 0)
			.attr("y", 0)
      .style("opacity", 1)
      .style("pointer-events", "none")
      .style("user-select", "none");
		debug.append("rect")
			.attr("rx", 4)
			.attr("ry", 4)
			.style("fill", "#383");
		debug.append("text")
      .attr("text-anchor", "left")
      .attr("xml:space", "preserve") //deprecated - to remove when white-space pre will be supported in all major browsers
			.style("white-space", "pre")
      .style("font-family", "Arial, Helvetica")
      .style("font-size", "10px")
      .style("fill", "#000");
  }

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

      if (DEBUG) {
        const debug_txt = d3.select("#debug text")
          .text(JSON.stringify(d, null, 2));
		const debbbox = debug_txt.node().getBBox();
        d3.select("#debug")
          .attr("transform", translate(d.x - debbbox.width / 2, d.y + 16))
		  .style("opacity", 0.8);
        d3.select("#bubble rect")
		  .attr("x", d.x - debbbox.width / 2)
          //.attr("x", -5)
          //.attr("y", debbbox.height)
          .attr("width", debbbox.width + 10)
          .attr("height", debbbox.height + 4);
	  }

    }
  }

  function hideBubble(d) {
    const bubble = d3.select("#bubble")
      .attr("transform", translate(0,0))
      .style("opacity", 0);
    if (DEBUG) {
        d3.select("#debug")
          .attr("transform", translate(0,0))
		  .style("opacity", 0);
	}
  }

  function highlightLegendItem(d) {
    const legendItem = document.getElementById("legendItem" + d.id);
	if (!legendItem) return;
    legendItem.setAttribute("filter", "url(#solid)");
    legendItem.setAttribute("fill", "white");
  }

  function unhighlightLegendItem(d) {
    const legendItem = document.getElementById("legendItem" + d.id);
	if (!legendItem) return;
    legendItem.removeAttribute("filter");
    legendItem.removeAttribute("fill");
  }

  // draw blips on radar
  const blips = rink.selectAll(".blip")
    .data(config.entries)
    .enter()
      .append("g")
        .attr("class", "blip")
        .attr("transform", function(d, i) { return legend_transform(d.quadrant, d.ring, i); })
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
