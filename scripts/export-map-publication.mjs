#!/usr/bin/env node
/**
 * Export a print/publication static map of Chinese lynchings by place and number of victims.
 * No timeline, no mouseovers/popups. Zoom to continental United States.
 * Output: extras/map of chinese lynchings by place and number of victims.png
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { parse } from 'csv-parse/sync';
import puppeteer from 'puppeteer';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, '..');
const extrasDir = path.join(root, 'extras');
const OUTPUT_FILENAME = 'map of chinese lynchings by place and number of victims.png';

const SHEET_ID = '18Bo9acVyuQTsdQ1baxSntSUZur50Yla8NcZKe2nZWyQ';
const MAIN_TAB_GID = '760826284';

const MAPBOX_TOKEN = process.env.MAPBOX_ACCESS_TOKEN;
if (!MAPBOX_TOKEN) throw new Error("Missing MAPBOX_ACCESS_TOKEN");
const MAPBOX_STYLE = 'kevinhegg/cmd4pgf7p01ud01s4awo3b3yd';

function getCol(row, names) {
  for (const n of names) {
    const v = row[n] ?? row[n.replace(/ /g, '-')] ?? row[n.replace(/ /g, '_')];
    if (v != null && String(v).trim()) return String(v).trim();
  }
  return '';
}

async function loadLynchingsWithCoords() {
  const url = `https://docs.google.com/spreadsheets/d/${SHEET_ID}/export?format=csv&gid=${MAIN_TAB_GID}`;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Failed to fetch Main tab: ${res.status}`);
  const csv = await res.text();
  const rows = parse(csv, { columns: true, skip_empty_lines: true, relax_column_count: true });
  const out = [];
  for (const r of rows) {
    const lat = parseFloat(getCol(r, ['Latitude', 'latitude']));
    const lon = parseFloat(getCol(r, ['Longitude', 'longitude']));
    if (!Number.isFinite(lat) || !Number.isFinite(lon)) continue;
    const numVictims = parseInt(getCol(r, ['Number of Victims', 'number-of-victims']), 10) || 1;
    out.push({ lat, lon, numVictims });
  }
  return out;
}

function buildMapHtml(points) {
  const pointsJson = JSON.stringify(points)
    .replace(/</g, '\\u003c')
    .replace(/>/g, '\\u003e')
    .replace(/\u2028/g, '\\u2028')
    .replace(/\u2029/g, '\\u2029');
  return `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/leaflet@1.6.0/dist/leaflet.css">
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    html, body { width: 100%; height: 100%; overflow: hidden; }
    #map { width: 100%; height: 100%; }
  </style>
</head>
<body>
  <div id="map"></div>
  <script src="https://cdn.jsdelivr.net/npm/leaflet@1.6.0/dist/leaflet.js"></script>
  <script>
    (function() {
      const MAPBOX_TOKEN = ${JSON.stringify(MAPBOX_TOKEN)};
      const MAPBOX_STYLE = ${JSON.stringify(MAPBOX_STYLE)};
      const points = ${pointsJson};

      const map = L.map('map', { zoomControl: true });
      L.tileLayer('https://api.mapbox.com/styles/v1/' + MAPBOX_STYLE + '/tiles/{z}/{x}/{y}?access_token=' + MAPBOX_TOKEN, {
        tileSize: 512,
        zoomOffset: -1,
        attribution: '© Mapbox © OpenStreetMap'
      }).addTo(map);

      const victimValues = points.map(function(p) { return p.numVictims; });
      const minV = Math.min.apply(null, victimValues);
      const maxV = Math.max.apply(null, victimValues);
      const range = maxV - minV || 1;
      function scaleRadius(v) { return 5 + (v - minV) / range * 15; }

      const layer = L.layerGroup();
      points.forEach(function(p) {
        const r = scaleRadius(p.numVictims);
        L.circleMarker([p.lat, p.lon], {
          radius: r,
          color: 'red',
          fillColor: 'red',
          fillOpacity: 0.6,
          weight: 2
        }).addTo(layer);
      });
      layer.addTo(map);

      var continentalUS = L.latLngBounds([ [24.5, -125], [49.5, -66] ]);
      map.fitBounds(continentalUS, { padding: [20, 20], maxZoom: 5 });

      window.mapReady = true;
    })();
  </script>
</body>
</html>`;
}

async function main() {
  if (!fs.existsSync(extrasDir)) fs.mkdirSync(extrasDir, { recursive: true });

  console.log('Fetching lynchings data...');
  const points = await loadLynchingsWithCoords();
  console.log('Points with coordinates:', points.length);

  const html = buildMapHtml(points);

  const chromePath =
    process.platform === 'darwin'
      ? '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'
      : process.platform === 'win32'
        ? 'C:\\Program Files\\Google Chrome\\Application\\chrome.exe'
        : '/usr/bin/google-chrome';
  const launchOpts = { headless: 'new' };
  if (fs.existsSync(chromePath)) launchOpts.executablePath = chromePath;

  const browser = await puppeteer.launch(launchOpts);
  const page = await browser.newPage();
  await page.setViewport({ width: 1200, height: 800 });
  await page.setContent(html, { waitUntil: 'networkidle0', timeout: 30000 });

  await page.waitForFunction('window.mapReady === true', { timeout: 10000 });
  await new Promise((r) => setTimeout(r, 1500));

  const mapEl = await page.$('#map');
  if (!mapEl) throw new Error('Map element not found');
  const pngPath = path.join(extrasDir, OUTPUT_FILENAME);
  await mapEl.screenshot({ path: pngPath, type: 'png' });
  await browser.close();

  console.log('Wrote', pngPath);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
