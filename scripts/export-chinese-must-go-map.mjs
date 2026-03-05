#!/usr/bin/env node
/**
 * Export print/pub choropleth for Chinese Must Go distribution-by-state spreadsheet.
 * Clean spreadsheet: state two-letter abbreviation in column 3 (index 2). Each row = one record;
 * we aggregate count by state. Output filename matches the spreadsheet name (.xlsx → .png).
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

const EXCEL_PATH = '/Users/kevinhegg/Desktop/chinese-must-go-distribution-loc-1878-1925-n-is-2875-clean.xlsx';
const OUTPUT_FILENAME = 'chinese-must-go-distribution-loc-1878-1925-n-is-2875.png';

/** Load state counts: column 3 = state abbrev, count rows per state (or sum col 2 if numeric). */
function loadStateCounts() {
  if (!fs.existsSync(EXCEL_PATH)) {
    throw new Error(`Excel file not found at ${EXCEL_PATH}`);
  }

  const wb = XLSX.readFile(EXCEL_PATH);
  const data = XLSX.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]], { header: 1 });
  const counts = {};
  let total = 0;
  data.forEach((row) => {
    const stateAbbr = row[2] != null ? String(row[2]).trim().toUpperCase() : '';
    if (!stateAbbr || stateAbbr.length !== 2) return;
    if (/^(STATE|ST|ABBR)$/.test(stateAbbr)) return; // skip header row
    const full = ABBR_TO_FULL[stateAbbr] || stateAbbr;
    const contribution = typeof row[1] === 'number' ? row[1] : (parseInt(row[1], 10) || 1);
    counts[full] = (counts[full] || 0) + contribution;
    total += contribution;
  });

  console.log('Total N:', total, '| State count entries:', Object.keys(counts).length);
  return counts;
}

async function main() {
  if (!fs.existsSync(extrasDir)) fs.mkdirSync(extrasDir, { recursive: true });

  const stateCounts = loadStateCounts();

  const html = buildChoroplethHtml(stateCounts);

  const chromePath =
    process.platform === 'darwin'
      ? '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'
      : process.platform === 'win32'
        ? 'C:\\\\Program Files\\\\Google Chrome\\\\Application\\\\chrome.exe'
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

