#!/usr/bin/env node
/**
 * Export print/pub choropleth: Hong Di articles by state.
 * Blue gradient, labels "ABBR (count)" centered on states; callouts for DE and RI.
 * Output: extras/hon di articles by state.png
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import puppeteer from 'puppeteer';
import XLSX from 'xlsx';
import { buildChoroplethHtml, ABBR_TO_FULL } from './choropleth-map-html.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, '..');
const extrasDir = path.join(root, 'extras');
const OUTPUT_FILENAME = 'hon di articles by state.png';
const EXCEL_PATH = '/Users/kevinhegg/Desktop/Hong Di articles by State.xlsx';

function loadStateCounts() {
  const wb = XLSX.readFile(EXCEL_PATH);
  const data = XLSX.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]], { header: 1 });
  const counts = {};
  data.forEach((row) => {
    const name = row[0];
    const value = row[1];
    if (name != null && String(name).trim() && name !== 'undefined') {
      const key = String(name).trim();
      const full = ABBR_TO_FULL[key] || key;
      const val = typeof value === 'number' ? value : parseInt(value, 10) || 0;
      counts[key] = val;
      if (full !== key) counts[full] = val;
    }
  });
  return counts;
}

async function main() {
  if (!fs.existsSync(extrasDir)) fs.mkdirSync(extrasDir, { recursive: true });
  if (!fs.existsSync(EXCEL_PATH)) {
    console.error('Excel file not found:', EXCEL_PATH);
    process.exit(1);
  }

  const stateCounts = loadStateCounts();
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
