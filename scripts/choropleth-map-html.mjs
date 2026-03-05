/**
 * Shared builder for state choropleth HTML: blue gradient, labels "ABBR (count)", callouts for DE/RI/DC (no lines).
 * Used by export-hong-di-map.mjs and export-lynchings-by-state-map.mjs.
 */

export const STATE_ABBR = {
  'Alabama': 'AL', 'Alaska': 'AK', 'Arizona': 'AZ', 'Arkansas': 'AR', 'California': 'CA',
  'Colorado': 'CO', 'Connecticut': 'CT', 'Delaware': 'DE', 'Florida': 'FL', 'Georgia': 'GA',
  'Hawaii': 'HI', 'Idaho': 'ID', 'Illinois': 'IL', 'Indiana': 'IN', 'Iowa': 'IA',
  'Kansas': 'KS', 'Kentucky': 'KY', 'Louisiana': 'LA', 'Maine': 'ME', 'Maryland': 'MD',
  'Massachusetts': 'MA', 'Michigan': 'MI', 'Minnesota': 'MN', 'Mississippi': 'MS', 'Missouri': 'MO',
  'Montana': 'MT', 'Nebraska': 'NE', 'Nevada': 'NV', 'New Hampshire': 'NH', 'New Jersey': 'NJ',
  'New Mexico': 'NM', 'New York': 'NY', 'North Carolina': 'NC', 'North Dakota': 'ND',
  'Ohio': 'OH', 'Oklahoma': 'OK', 'Oregon': 'OR', 'Pennsylvania': 'PA', 'Rhode Island': 'RI',
  'South Carolina': 'SC', 'South Dakota': 'SD', 'Tennessee': 'TN', 'Texas': 'TX', 'Utah': 'UT',
  'Vermont': 'VT', 'Virginia': 'VA', 'Washington': 'WA', 'West Virginia': 'WV', 'Wisconsin': 'WI',
  'Wyoming': 'WY', 'District of Columbia': 'DC'
};

export const ABBR_TO_FULL = Object.fromEntries(Object.entries(STATE_ABBR).map(([k, v]) => [v, k]));

/** stateCounts: object keyed by full state name (or abbrev), values are numbers */
export function buildChoroplethHtml(stateCounts) {
  const countsJson = JSON.stringify(stateCounts)
    .replace(/</g, '\\u003c')
    .replace(/>/g, '\\u003e')
    .replace(/\u2028/g, '\\u2028')
    .replace(/\u2029/g, '\\u2029');
  const stateAbbrJson = JSON.stringify(STATE_ABBR)
    .replace(/</g, '\\u003c')
    .replace(/>/g, '\\u003e');
  return `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body { background: #e5e5e5; font-family: system-ui, sans-serif; }
    svg { display: block; }
  </style>
</head>
<body>
  <div id="map"></div>
  <script src="https://cdn.jsdelivr.net/npm/d3@7"></script>
  <script src="https://cdn.jsdelivr.net/npm/topojson-client@3"></script>
  <script>
    (function() {
      const stateCounts = ${countsJson};
      const STATE_ABBR = ${stateAbbrJson};
      const width = 1600;
      const height = 1000;
      const projection = d3.geoAlbersUsa().fitSize([width, height], { type: 'Sphere' });
      const path = d3.geoPath().projection(projection);
      const values = Object.values(stateCounts).filter(function(v) { return v >= 0; });
      const maxVal = d3.max(values) || 1;
      const color = d3.scaleSequential([0, maxVal], d3.interpolateBlues).clamp(true);
      const CALLOUT_STATES = { 'Delaware': [90, -52], 'Rhode Island': [62, 15], 'District of Columbia': [68, -20], 'New Jersey': [72, 8], 'Vermont': [0, -6], 'New Hampshire': [0, 6] };

      const svg = d3.select('#map').append('svg').attr('width', width).attr('height', height).attr('viewBox', [0, 0, width, height]);

      d3.json('https://unpkg.com/us-atlas@3.0.0/states-10m.json').then(function(us) {
        const states = topojson.feature(us, us.objects.states);
        svg.append('g').attr('class', 'states')
          .selectAll('path')
          .data(states.features)
          .join('path')
          .attr('fill', function(d) {
            const name = d.properties.name;
            const v = stateCounts[name] != null ? stateCounts[name] : 0;
            return v <= 0 ? '#fff' : color(v);
          })
          .attr('stroke', '#bbb')
          .attr('stroke-width', 0.8)
          .attr('d', path);

        var labels = svg.append('g').attr('class', 'labels');
        states.features.forEach(function(d) {
          const name = d.properties.name;
          const abbr = STATE_ABBR[name] || name.slice(0,2);
          const count = stateCounts[name] != null ? stateCounts[name] : 0;
          const text = abbr + ' (' + count + ')';
          const centroid = path.centroid(d);
          if (centroid[0] !== Infinity && centroid[1] !== Infinity) {
            const isCallout = CALLOUT_STATES[name];
            var x = centroid[0], y = centroid[1];
            if (isCallout) {
              x += isCallout[0];
              y += isCallout[1];
            }
            var textFill = '#1a1a1a';
            var g = labels.append('g').attr('transform', 'translate(' + x + ',' + y + ')');
            var t = g.append('text')
              .attr('text-anchor', 'middle').attr('dominant-baseline', 'middle')
              .attr('font-family', 'Times New Roman').attr('font-weight', 'bold')
              .attr('font-size', 18).attr('fill', textFill)
              .text(text);
            var box = t.node().getBBox();
            g.insert('rect', ':first-child')
              .attr('x', box.x - 2).attr('y', box.y - 2)
              .attr('width', box.width + 4).attr('height', box.height + 4)
              .attr('fill', 'rgba(229, 229, 229, 0.5)');
          }
        });
        window.mapReady = true;
      }).catch(function(e) { console.error(e); window.mapReady = true; });
    })();
  </script>
</body>
</html>`;
}
