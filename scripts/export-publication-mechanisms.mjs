#!/usr/bin/env node
/**
 * Export publication-quality PNG chart for mechanism_category distribution.
 * Input: /Users/kevinhegg/Desktop/apwire/article_mechanisms.csv
 * Output: extras/publication mechanisms.png
 * No title. Print-ready style.
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { parse } from 'csv-parse/sync';
import puppeteer from 'puppeteer';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, '..');
const extrasDir = path.join(root, 'extras');
const csvPath = '/Users/kevinhegg/Desktop/apwire/article_mechanisms.csv';

const PRINT = {
  width: 975,
  height: 340,
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

const F = { axisLabel: 20, axisName: 20, barLabel: 18 };

function loadAndCount() {
  const csv = fs.readFileSync(csvPath, 'utf-8');
  const rows = parse(csv, { columns: true, skip_empty_lines: true });
  const counts = {};
  rows.forEach((r) => {
    const cat = (r.mechanism_category || r['mechanism_category'] || 'Unknown').trim() || 'Unknown';
    counts[cat] = (counts[cat] || 0) + 1;
  });
  const toTitleCase = (s) =>
    (s || '')
      .split(/([\s/]+)/)
      .map((part) => (/\s|\//.test(part) ? part : part.charAt(0).toUpperCase() + part.slice(1).toLowerCase()))
      .join('');
  const sorted = Object.entries(counts)
    .sort((a, b) => b[1] - a[1])
    .map(([name, value]) => ({ name: toTitleCase(name), value }));
  return sorted;
}

function buildOption(data) {
  const T = theme;
  const Pl = PRINT.paddingLeft;
  const Pr = PRINT.paddingRight;
  const Pt = PRINT.paddingTop;
  const Pb = PRINT.paddingBottom;
  const labels = data.map((d) => d.name);
  const values = data.map((d) => d.value);
  const colors = data.map((_, i) => T.series[i % T.series.length]);
  const barData = values.map((v, i) => ({
    value: v,
    itemStyle: { color: colors[i] },
  }));

  return {
    backgroundColor: T.bg,
    textStyle: { fontFamily: T.font, fontSize: F.axisLabel, color: T.text },
    animation: false,
    grid: { left: 280 + Pl, right: 80 + Pr, top: 20 + Pt, bottom: 40 + Pb },
    xAxis: {
      type: 'value',
      min: 0,
      axisLabel: { color: T.text, fontFamily: T.font, fontSize: F.axisLabel },
      axisLine: { lineStyle: { color: T.axis } },
      splitLine: { lineStyle: { color: T.grid, opacity: 0.6 } },
    },
    yAxis: {
      type: 'category',
      data: labels,
      inverse: true,
      axisLabel: { color: T.text, fontFamily: T.font, fontSize: F.axisLabel },
      axisLine: { lineStyle: { color: T.axis } },
    },
    series: [
      {
        type: 'bar',
        data: barData,
        barWidth: '60%',
        label: {
          show: true,
          position: 'right',
          color: T.text,
          fontFamily: T.font,
          fontSize: F.barLabel,
          formatter: '{c}',
        },
      },
    ],
  };
}

function buildHtml(option) {
  const cfgJson = JSON.stringify(option)
    .replace(/\\/g, '\\\\')
    .replace(/</g, '\\u003c')
    .replace(/>/g, '\\u003e')
    .replace(/'/g, "\\'");
  return `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <script src="https://cdn.jsdelivr.net/npm/echarts@5.4.3/dist/echarts.min.js"></script>
</head>
<body>
  <div id="chart-root" style="width:${PRINT.width}px;height:${PRINT.height}px;background:${theme.bg};box-sizing:border-box;"></div>
  <script>
    const option = JSON.parse('${cfgJson}');
    const chart = echarts.init(document.getElementById('chart-root'), null, { renderer: 'canvas' });
    chart.setOption(option);
    window.png = chart.getDataURL({ type: 'png', pixelRatio: ${PRINT.pixelRatio} });
    window.ready = true;
  </script>
</body>
</html>`;
}

function stripDataUrl(dataUrl) {
  const m = /^data:[^;]+;base64,(.+)$/.exec(dataUrl);
  return m ? Buffer.from(m[1], 'base64') : null;
}

async function main() {
  if (!fs.existsSync(extrasDir)) fs.mkdirSync(extrasDir, { recursive: true });

  const data = loadAndCount();
  const option = buildOption(data);
  const html = buildHtml(option);

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
  await page.setViewport({ width: 1920, height: 900 });
  await page.setContent(html, { waitUntil: 'load', timeout: 60000 });
  await page.waitForFunction('window.ready === true', { timeout: 15000 });

  const png = await page.evaluate('window.png');
  await browser.close();

  const outPath = path.join(extrasDir, 'publication mechanisms.png');
  const buf = stripDataUrl(png);
  if (buf) fs.writeFileSync(outPath, buf);
  console.log(`Wrote ${outPath}`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
