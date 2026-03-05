#!/usr/bin/env node
/**
 * Export publication-quality PNG for distribution of newspaper articles by state.
 * Table with inline bars (label | count | bar).
 * Output: extras/Distribution of Published Newspaper Articles by State.png
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import puppeteer from 'puppeteer';
import { buildTableBarHtml } from './table-bar-html.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, '..');
const extrasDir = path.join(root, 'extras');
const articlesPath = path.join(root, 'src/data/articles.json');

const PRINT = {
  width: 975,
  heightStandard: 340,
  heightPerBar: 28,
  pixelRatio: 2,
  paddingTop: 10,
  paddingLeft: 5,
  paddingRight: 5,
  paddingBottom: 5,
};

const theme = {
  bg: '#ffffff',
  text: '#1a1a1a',
  axis: '#333333',
  grid: '#e0e0e0',
  font: 'Times New Roman, Georgia, serif',
  series: ['#2563eb', '#dc2626', '#059669', '#7c3aed', '#d97706'],
};

function extractState(loc) {
  const s = (loc || '').trim();
  if (!s) return 'Unknown';
  const parts = s.split(',').map((p) => p.trim());
  if (parts.length > 1) {
    const last = parts[parts.length - 1];
    if (last) return last;
  }
  const stripped = s.replace(/\s*\([^)]*\)\s*$/, '').trim();
  return stripped || 'Unknown';
}

function loadAndCount() {
  const articles = JSON.parse(fs.readFileSync(articlesPath, 'utf-8'));
  const counts = {};
  articles.forEach((a) => {
    const state = (a.state && a.state.trim()) || extractState(a['newspaper-location']);
    const key = state || 'Unknown';
    counts[key] = (counts[key] || 0) + 1;
  });
  const sorted = Object.entries(counts)
    .sort((a, b) => b[1] - a[1])
    .map(([name, value]) => ({ name, value }));
  return sorted;
}

async function main() {
  if (!fs.existsSync(extrasDir)) fs.mkdirSync(extrasDir, { recursive: true });

  const data = loadAndCount();
  const chromePath =
    process.platform === 'darwin'
      ? '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'
      : process.platform === 'win32'
        ? 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe'
        : '/usr/bin/google-chrome';
  const launchOpts = { headless: 'new' };
  if (fs.existsSync(chromePath)) launchOpts.executablePath = chromePath;

  const browser = await puppeteer.launch(launchOpts);
  const page = await browser.newPage();
  await page.setViewport({ width: PRINT.width, height: 900 });

  const tableBarHtml = buildTableBarHtml(data, {
    barColor: '#2563eb',
    labelHeader: 'State',
    valueHeader: 'Articles',
    width: PRINT.width,
    font: theme.font,
  });
  await page.setContent(tableBarHtml, { waitUntil: 'load', timeout: 10000 });
  await new Promise((r) => setTimeout(r, 100));
  const el = await page.$('#table-bar');
  if (el) {
    const buf = await el.screenshot({ type: 'png', omitBackground: false });
    if (buf) {
      const outPath = path.join(extrasDir, 'Distribution of Published Newspaper Articles by State.png');
      fs.writeFileSync(outPath, buf);
      console.log('Wrote Distribution of Published Newspaper Articles by State.png');
    }
  }

  await browser.close();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
