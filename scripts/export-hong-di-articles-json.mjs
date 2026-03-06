#!/usr/bin/env node
/**
 * Export Hong Di articles-by-state data from Excel to JSON for the charts page.
 * Run: node scripts/export-hong-di-articles-json.mjs
 * Requires: Hong Di articles by State.xlsx on Desktop (or set EXCEL_PATH).
 * Output: public/hong-di-articles-by-state.json
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import XLSX from 'xlsx';
import { ABBR_TO_FULL } from './choropleth-map-html.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, '..');
const EXCEL_PATH = process.env.HONG_DI_EXCEL || path.join(process.env.HOME || '', 'Desktop', 'Hong Di articles by State.xlsx');
const OUTPUT_PATH = path.join(root, 'public', 'hong-di-articles-by-state.json');

function loadStateCounts() {
  if (!fs.existsSync(EXCEL_PATH)) {
    console.error('Excel file not found:', EXCEL_PATH);
    console.error('Set HONG_DI_EXCEL env var or place file at ~/Desktop/Hong Di articles by State.xlsx');
    process.exit(1);
  }
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
      counts[full] = val;
    }
  });
  return counts;
}

const counts = loadStateCounts();
fs.writeFileSync(OUTPUT_PATH, JSON.stringify(counts, null, 2));
console.log('Wrote', OUTPUT_PATH, '-', Object.keys(counts).length, 'states');
