#!/usr/bin/env node
/**
 * Export print/pub choropleth: incidents of extra-legal violence (Chinese lynchings) by state.
 * Data from Chinese lynchings master spreadsheet Main tab, State column (one row = one incident).
 * Blue gradient, labels "ABBR (count)" centered on states; callouts for DE and RI.
 * Output: extras/incidents of extra legal violence by state.png
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { parse } from 'csv-parse/sync';
import puppeteer from 'puppeteer';
import { buildChoroplethHtml, ABBR_TO_FULL } from './choropleth-map-html.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, '..');
const extrasDir = path.join(root, 'extras');
const OUTPUT_FILENAME = 'incidents of extra legal violence by state.png';

const SHEET_ID = '18Bo9acVyuQTsdQ1baxSntSUZur50Yla8NcZKe2nZWyQ';
const MAIN_TAB_GID = '760826284';

function getCol(row, names) {
  for (const n of names) {
    const v = row[n] ?? row[n?.replace(/ /g, '-')] ?? row[n?.replace(/ /g, '_')];
    if (v != null && String(v).trim()) return String(v).trim();
  }
  return '';
}

/** Load Main tab CSV and count incidents per state (each row = one incident). */
async function loadStateCounts() {
  const url = `https://docs.google.com/spreadsheets/d/${SHEET_ID}/export?format=csv&gid=${MAIN_TAB_GID}`;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Failed to fetch Main tab: ${res.status}`);
  const csv = await res.text();
  const rows = parse(csv, { columns: true, skip_empty_lines: true, relax_column_count: true });
  const counts = {};
  for (const r of rows) {
    const id = getCol(r, ['Identifier', 'identifier', 'Lynching ID', 'lynching-id', 'Record ID']);
    if (!id) continue;
    let state = getCol(r, ['State', 'state', 'State/Terr.', 'State/Terr']) || 'Unknown';
    state = state.trim();
    const full = ABBR_TO_FULL[state] || state;
    counts[full] = (counts[full] || 0) + 1;
  }
  return counts;
}

async function main() {
  if (!fs.existsSync(extrasDir)) fs.mkdirSync(extrasDir, { recursive: true });

  const stateCounts = await loadStateCounts();
  console.log('State count entries:', Object.keys(stateCounts).length);

  const html = buildChoroplethHtml(stateCounts);

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
  await page.setViewport({ width: 1600, height: 1000, deviceScaleFactor: 2 });
  await page.setContent(html, { waitUntil: 'networkidle0', timeout: 30000 });

  await page.waitForFunction('window.mapReady === true', { timeout: 15000 });
  await new Promise((r) => setTimeout(r, 500));

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
