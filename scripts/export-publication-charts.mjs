#!/usr/bin/env node
/**
 * Export publication-quality PNG and SVG for all charts on /visualize/charts and /visualize/compare.
 * Output: extras/<chart-name>.png, extras/<chart-name>.svg
 * Format: 8.5" x 11" page with 1" left/right margins → content width 6.5" = 975px @ 150 DPI.
 * Theme: White background, black/dark gray text (Times New Roman–friendly), judicious color.
 */
const PRINT = {
  width: 975,           // 6.5" @ 150 DPI (full content width)
  heightStandard: 380,  // ~2.5" – 2–3 charts per page
  heightTall: 420,      // combo/compare charts
  heightSmall: 340,     // pie charts, population trends
  pixelRatio: 2,        // crisp print output
};

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { parse } from 'csv-parse/sync';
import puppeteer from 'puppeteer';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, '..');
const extrasDir = path.join(root, 'extras');

const PATHS = {
  lynchings: path.join(root, 'src/data/lynchings.json'),
  timeline: path.join(root, 'public/timeline.json'),
  census: path.join(root, 'public/us-census-population.json'),
  beckTolnay: path.join(root, 'src/data/beck-tolnay-black-lynchings.csv'),
};

const theme = {
  bg: '#ffffff',
  text: '#1a1a1a',
  axis: '#333333',
  grid: '#e0e0e0',
  font: 'Times New Roman, Georgia, serif',
  border: 'none',
  series: ['#2563eb', '#dc2626', '#059669', '#7c3aed', '#d97706', '#0891b2', '#4f46e5', '#b91c1c', '#0d9488', '#c2410c'],
};

function loadData() {
  const lynchings = JSON.parse(fs.readFileSync(PATHS.lynchings, 'utf-8'));
  const timeline = JSON.parse(fs.readFileSync(PATHS.timeline, 'utf-8'));
  const census = JSON.parse(fs.readFileSync(PATHS.census, 'utf-8'));
  const csv = fs.readFileSync(PATHS.beckTolnay, 'utf-8');
  const beckRows = parse(csv, { columns: true, skip_empty_lines: true });
  const blackByYear = {};
  beckRows.forEach((r) => {
    const y = parseInt(r.YEAR, 10);
    if (!isNaN(y) && y >= 1850 && y <= 1940) blackByYear[y] = (blackByYear[y] || 0) + 1;
  });

  const popByYear = {};
  census.forEach((e) => {
    popByYear[e.year] = { black: e.blackPopulation, asian: e.asianPopulation };
  });

  const year = (r) => {
    let y = r.year;
    if (!y || y === 0) {
      const m = (r.date || '').match(/^(\d{4})/);
      y = m ? parseInt(m[1], 10) : null;
    } else y = parseInt(y, 10);
    return y && !isNaN(y) ? y : null;
  };

  const years1850_1920 = [];
  for (let y = 1850; y <= 1920; y++) years1850_1920.push(y);

  const years1853_1915 = [];
  for (let y = 1853; y <= 1915; y++) years1853_1915.push(y);

  const incidentCounts = {};
  const victimCounts = {};
  const chineseByYear = {};
  lynchings.forEach((r) => {
    const y = year(r);
    const v = Number(r['number-of-victims']) || 1;
    if (y && y >= 1850 && y <= 1920) {
      incidentCounts[y] = (incidentCounts[y] || 0) + 1;
      victimCounts[y] = (victimCounts[y] || 0) + v;
      chineseByYear[y] = (chineseByYear[y] || 0) + v;
    }
  });

  const decades = ['1850s', '1860s', '1870s', '1880s', '1890s', '1900s', '1910s'];
  const TOP_N = 6;
  const eventsByDecadeByState = {};
  const victimsByDecadeByState = {};
  const stateTotals = {};
  const stateVictimTotals = {};

  lynchings.forEach((r) => {
    const y = year(r);
    const state = (r.state || 'Unknown').trim() || 'Unknown';
    const v = Number(r['number-of-victims']) || 1;
    if (y && y >= 1850 && y <= 1920) {
      const dec = Math.floor(y / 10) * 10 + 's';
      if (!eventsByDecadeByState[dec]) eventsByDecadeByState[dec] = {};
      eventsByDecadeByState[dec][state] = (eventsByDecadeByState[dec][state] || 0) + 1;
      if (!victimsByDecadeByState[dec]) victimsByDecadeByState[dec] = {};
      victimsByDecadeByState[dec][state] = (victimsByDecadeByState[dec][state] || 0) + v;
      stateTotals[state] = (stateTotals[state] || 0) + 1;
      stateVictimTotals[state] = (stateVictimTotals[state] || 0) + v;
    }
  });

  const statesSorted = Object.keys(stateTotals).sort((a, b) => (stateTotals[b] || 0) - (stateTotals[a] || 0));
  const topStates = statesSorted.slice(0, TOP_N);
  const stackOrder = [...topStates, 'Other'];

  const typeCounts = {};
  lynchings.forEach((r) => {
    const t = r['event-type'] || 'Unknown';
    typeCounts[t] = (typeCounts[t] || 0) + (Number(r['number-of-victims']) || 1);
  });

  const categoryCounts = {};
  const pretextCounts = {};
  lynchings.forEach((r) => {
    const cat = r['category-of-violence'] || r['event-type'] || 'Unknown';
    if (cat && cat !== 'Unknown') categoryCounts[cat] = (categoryCounts[cat] || 0) + 1;
    const raw = (r['pretext-grouped'] || r.accusation || '').toString();
    const parts = raw.split(/[;,]|\s+and\s+/).map((s) => s.trim()).filter(Boolean);
    parts.forEach((p) => {
      if (p && p.toLowerCase() !== 'unknown') pretextCounts[p] = (pretextCounts[p] || 0) + 1;
    });
  });
  const categoryData = Object.entries(categoryCounts)
    .map(([name, value]) => ({ name, value }))
    .sort((a, b) => b.value - a.value);
  const PRETEXT_OTHER_THRESHOLD = 2;
  let otherPretext = 0;
  const pretextList = [];
  Object.entries(pretextCounts).forEach(([k, v]) => {
    if (v <= PRETEXT_OTHER_THRESHOLD) otherPretext += v;
    else pretextList.push({ name: k, value: v });
  });
  if (otherPretext > 0) pretextList.push({ name: 'Other', value: otherPretext });
  const pretextData = pretextList.sort((a, b) => b.value - a.value);

  const censusEntries = timeline.filter((e) => (e.eventType || '').toLowerCase().includes('census'));
  const popPoints = censusEntries
    .map((e) => {
      const m = (e.text || '').match(/Total Asian Population: ([\d,]+)/);
      return { year: Number(e.year), population: m ? Number(m[1].replace(/,/g, '')) : null };
    })
    .filter((e) => e.population != null);
  const popByYearCombo = {};
  for (let i = 0; i < popPoints.length - 1; i++) {
    const s = popPoints[i];
    const e = popPoints[i + 1];
    const span = e.year - s.year;
    for (let y = s.year; y < e.year; y++) {
      const t = (y - s.year) / span;
      popByYearCombo[y] = Math.round(s.population + t * (e.population - s.population));
    }
  }
  if (popPoints.length) popByYearCombo[popPoints[popPoints.length - 1].year] = popPoints[popPoints.length - 1].population;

  const victimsByYearCombo = {};
  lynchings.forEach((r) => {
    const y = year(r);
    const n = Number(r['number-of-victims']) || 0;
    if (y && n > 0) victimsByYearCombo[y] = (victimsByYearCombo[y] || 0) + n;
  });
  const comboYears = [];
  for (let y = 1850; y <= 1915; y++) comboYears.push(y);
  const policyEvents = [
    { year: 1852, label: "Foreign Miners' Tax" },
    { year: 1882, label: 'Exclusion Act' },
    { year: 1888, label: 'Scott Act' },
    { year: 1892, label: 'Geary Act' },
    { year: 1913, label: 'CA Alien Land Law' },
  ];

  const years1875_1915 = [];
  for (let y = 1875; y <= 1915; y++) years1875_1915.push(y);
  const blackPerCapita = years1875_1915.map((y) => {
    const v = blackByYear[y] || 0;
    const p = popByYear[y]?.black;
    return p && p > 0 ? (v / p) * 100000 : 0;
  });
  const chinesePerCapita = years1875_1915.map((y) => {
    const v = chineseByYear[y] || 0;
    const p = popByYear[y]?.asian;
    return p && p > 0 ? (v / p) * 100000 : 0;
  });

  const populationYears = [];
  for (let y = 1850; y <= 1950; y++) populationYears.push(y);
  const censusFiltered = census.filter((e) => e.year >= 1850 && e.year <= 1950);
  const blackPop = populationYears.map((y) => {
    const e = censusFiltered.find((x) => x.year === y);
    return e ? e.blackPopulation : null;
  });
  const asianPop = populationYears.map((y) => {
    const e = censusFiltered.find((x) => x.year === y);
    return e ? e.asianPopulation : null;
  });
  const blackLynchChart = populationYears.map((y) => blackByYear[y] || 0);
  const chineseLynchChart = populationYears.map((y) => chineseByYear[y] || 0);

  return {
    theme,
    years1850_1920,
    years1853_1915,
    incidentCounts,
    victimCounts,
    decades,
    stackOrder,
    statesSorted,
    stateTotals,
    stateVictimTotals,
    eventsByDecadeByState,
    victimsByDecadeByState,
    typeCounts,
    categoryData,
    pretextData,
    popByYearCombo,
    victimsByYearCombo,
    comboYears,
    policyEvents,
    blackByYear,
    chineseByYear,
    years1875_1915,
    blackPerCapita,
    chinesePerCapita,
    popByYear,
    populationYears,
    blackPop,
    asianPop,
    blackLynchChart,
    chineseLynchChart,
  };
}

function buildChartConfigs(data) {
  const T = data.theme;
  const base = () => ({
    backgroundColor: T.bg,
    textStyle: { fontFamily: T.font, color: T.text },
    animation: false,
  });
  const axis = () => ({
    axisLabel: { color: T.text, fontFamily: T.font },
    axisLine: { lineStyle: { color: T.axis } },
    splitLine: { lineStyle: { color: T.grid, opacity: 0.6 } },
  });
  const axisY = () => ({
    axisLabel: { color: T.text, fontFamily: T.font, rotate: -90 },
    axisLine: { lineStyle: { color: T.axis } },
    splitLine: { lineStyle: { color: T.grid, opacity: 0.6 } },
  });

  const configs = [];

  // Incidents over time (1853–1915): sized for Google Docs full page width (6.5" content = 975px @ 150 DPI)
  const incYears = data.years1853_1915.map(String);
  const incCounts = data.years1853_1915.map((y) => data.incidentCounts[y] || 0);
  const incFont = 'Times New Roman';
  const incFontSize = 24; // 12pt equivalent at 6.5" display width
  configs.push({
    name: 'incidents-over-time',
    width: PRINT.width,
    height: PRINT.heightStandard,
    pixelRatio: PRINT.pixelRatio,
    option: {
      ...base(),
      backgroundColor: '#ffffff',
      textStyle: { fontFamily: incFont, fontSize: incFontSize, color: T.text },
      title: {
        text: 'Incidents of Anti-Chinese Violence Over Time: 1853-1915',
        left: 'center',
        top: 0,
        textStyle: { color: T.text, fontFamily: incFont, fontSize: incFontSize },
      },
      xAxis: {
        type: 'category',
        data: incYears,
        boundaryGap: true,
        axisTick: { alignWithLabel: true },
        axisLabel: { color: T.text, fontFamily: incFont, fontSize: incFontSize, interval: 4 },
        axisLine: { lineStyle: { color: T.axis } },
        splitLine: { lineStyle: { color: T.grid, opacity: 0.6 } },
      },
      yAxis: {
        type: 'value',
        name: 'Number of Incidents',
        nameLocation: 'center',
        nameGap: 40,
        nameRotate: 90,
        nameTextStyle: { color: T.text, fontFamily: incFont, fontSize: incFontSize, fontWeight: 'bold' },
        axisLabel: { color: T.text, fontFamily: incFont, fontSize: incFontSize, rotate: 0 },
        axisLine: { lineStyle: { color: T.axis } },
        splitLine: { lineStyle: { color: T.grid, opacity: 0.6 } },
      },
      series: [{
        type: 'line',
        data: incCounts,
        smooth: false,
        lineStyle: { color: '#000000', width: 3 },
        areaStyle: { color: '#d3d3d3' },
        itemStyle: { color: '#000000' },
        symbol: 'circle',
        symbolSize: 6,
      }],
      grid: { left: 75, right: 40, top: 55, bottom: 50 },
    },
  });

  const years = data.years1850_1920.map(String);
  const vicCounts = data.years1850_1920.map((y) => data.victimCounts[y] || 0);
  configs.push({
    name: 'victims-over-time',
    width: PRINT.width,
    height: PRINT.heightStandard,
    pixelRatio: PRINT.pixelRatio,
    option: {
      ...base(),
      xAxis: { type: 'category', data: years, ...axis() },
      yAxis: { type: 'value', name: 'Number of Victims', nameTextStyle: { color: T.text, fontFamily: T.font }, ...axis() },
      series: [{ type: 'line', data: vicCounts, smooth: true, lineStyle: { color: '#1a1a1a', width: 2.5 }, areaStyle: { color: '#e8e8e8' }, itemStyle: { color: '#1a1a1a' }, symbol: 'circle', symbolSize: 5 }],
      grid: { left: 75, right: 40, top: 40, bottom: 55 },
    },
  });

  const seriesEvents = data.stackOrder.map((state, idx) => ({
    name: state,
    type: 'bar',
    stack: 'events',
    data: data.decades.map((dec) => {
      if (state === 'Other') return data.statesSorted.slice(6).reduce((s, st) => s + ((data.eventsByDecadeByState[dec] || {})[st] || 0), 0);
      return (data.eventsByDecadeByState[dec] || {})[state] || 0;
    }),
    itemStyle: { color: T.series[idx % T.series.length] },
  }));
  configs.push({
    name: 'lethal-events-by-state',
    width: PRINT.width,
    height: PRINT.heightStandard,
    pixelRatio: PRINT.pixelRatio,
    option: {
      ...base(),
      legend: { bottom: 8, textStyle: { color: T.text, fontFamily: T.font } },
      xAxis: { type: 'category', data: data.decades, ...axis() },
      yAxis: { type: 'value', name: 'Number of lethal events', nameTextStyle: { color: T.text, fontFamily: T.font }, ...axisY() },
      series: seriesEvents,
      grid: { left: 70, right: 40, top: 40, bottom: 55 },
    },
  });

  const seriesVictims = data.stackOrder.map((state, idx) => ({
    name: state,
    type: 'bar',
    stack: 'victims',
    data: data.decades.map((dec) => {
      if (state === 'Other') return data.statesSorted.slice(6).reduce((s, st) => s + ((data.victimsByDecadeByState[dec] || {})[st] || 0), 0);
      return (data.victimsByDecadeByState[dec] || {})[state] || 0;
    }),
    itemStyle: { color: T.series[idx % T.series.length] },
  }));
  configs.push({
    name: 'victims-by-state',
    width: PRINT.width,
    height: PRINT.heightStandard,
    pixelRatio: PRINT.pixelRatio,
    option: {
      ...base(),
      legend: { bottom: 8, textStyle: { color: T.text, fontFamily: T.font } },
      xAxis: { type: 'category', data: data.decades, ...axis() },
      yAxis: { type: 'value', name: 'Number of victims', nameTextStyle: { color: T.text, fontFamily: T.font }, ...axisY() },
      series: seriesVictims,
      grid: { left: 70, right: 40, top: 40, bottom: 55 },
    },
  });

  const stateNames = data.statesSorted;
  const incByState = stateNames.map((s) => data.stateTotals[s] || 0);
  configs.push({
    name: 'incident-count-by-state',
    width: PRINT.width,
    height: PRINT.heightSmall,
    pixelRatio: PRINT.pixelRatio,
    option: {
      ...base(),
      grid: { left: 100, right: 40, top: 20, bottom: 30 },
      xAxis: { type: 'value', axisLabel: { show: false }, axisLine: { show: false }, axisTick: { show: false }, splitLine: { lineStyle: { color: T.grid, opacity: 0.6 } } },
      yAxis: { type: 'category', data: stateNames, inverse: true, axisLabel: { color: T.text, fontFamily: T.font }, axisLine: { lineStyle: { color: T.axis } } },
      series: [{ type: 'bar', data: incByState, itemStyle: { color: '#2563eb' }, barWidth: '60%', label: { show: true, position: 'right', color: T.text, fontFamily: T.font } }],
    },
  });

  const vicByState = stateNames.map((s) => data.stateVictimTotals[s] || 0);
  configs.push({
    name: 'victim-count-by-state',
    width: PRINT.width,
    height: PRINT.heightSmall,
    pixelRatio: PRINT.pixelRatio,
    option: {
      ...base(),
      grid: { left: 100, right: 40, top: 20, bottom: 30 },
      xAxis: { type: 'value', axisLabel: { show: false }, axisLine: { show: false }, axisTick: { show: false }, splitLine: { lineStyle: { color: T.grid, opacity: 0.6 } } },
      yAxis: { type: 'category', data: stateNames, inverse: true, axisLabel: { color: T.text, fontFamily: T.font }, axisLine: { lineStyle: { color: T.axis } } },
      series: [{ type: 'bar', data: vicByState, itemStyle: { color: '#dc2626' }, barWidth: '60%', label: { show: true, position: 'right', color: T.text, fontFamily: T.font } }],
    },
  });

  const typeNames = Object.keys(data.typeCounts).map((t) => (t === 'Possible Lynching' ? 'Possible Lynching' : t));
  const typeVals = typeNames.map((t) => data.typeCounts[t]);
  const typeColors = typeNames.map((_, i) => T.series[i % T.series.length]);
  const typeBarData = typeVals.map((v, i) => ({ value: v, itemStyle: { color: typeColors[i] } }));
  configs.push({
    name: 'types-of-violence',
    width: PRINT.width,
    height: PRINT.heightStandard,
    pixelRatio: PRINT.pixelRatio,
    option: {
      ...base(),
      xAxis: { type: 'category', data: typeNames, axisLabel: { ...axis().axisLabel, rotate: 25 }, axisLine: { lineStyle: { color: T.axis } } },
      yAxis: { type: 'value', name: 'Number of Victims', nameTextStyle: { color: T.text, fontFamily: T.font }, ...axisY() },
      series: [{ type: 'bar', data: typeBarData, barWidth: '60%', label: { show: true, position: 'top', color: T.text, fontFamily: T.font } }],
      grid: { left: 70, right: 40, top: 50, bottom: 80 },
    },
  });

  const catColors = data.categoryData.map((_, i) => T.series[i % T.series.length]);
  configs.push({
    name: 'categories-of-violence',
    width: Math.floor(PRINT.width / 2) - 10,
    height: PRINT.heightSmall,
    pixelRatio: PRINT.pixelRatio,
    option: {
      ...base(),
      color: catColors,
      series: [{ type: 'pie', radius: ['25%', '70%'], data: data.categoryData, label: { color: T.text, fontFamily: T.font, formatter: '{b}: {c}' }, labelLine: { lineStyle: { color: T.axis } } }],
    },
  });

  let pretextDataPub = [...(data.pretextDataPublication || data.pretextData)];
  const antiChineseIdx = pretextDataPub.findIndex((d) => (d.name || '').toLowerCase().includes('anti-chinese'));
  if (antiChineseIdx >= 0) {
    const item = pretextDataPub.splice(antiChineseIdx, 1)[0];
    pretextDataPub.unshift(item);
  }
  const preColors = pretextDataPub.map((_, i) => T.series[i % T.series.length]);
  const preFontSize = 24; // 12pt like incidents-over-time
  configs.push({
    name: 'pretexts-for-violence',
    width: Math.floor(PRINT.width / 2) - 10,
    height: PRINT.heightSmall,
    pixelRatio: PRINT.pixelRatio,
    option: {
      ...base(),
      backgroundColor: '#ffffff',
      textStyle: { fontFamily: T.font, fontSize: preFontSize, color: T.text },
      color: preColors,
      series: [{
        type: 'pie',
        radius: ['20%', '55%'],
        center: ['50%', '50%'],
        startAngle: 180,
        data: pretextDataPub,
        label: {
          color: T.text,
          fontFamily: T.font,
          fontSize: preFontSize,
          formatter: '{b}: {c}',
          overflow: 'break',
          width: 140,
        },
        labelLine: { lineStyle: { color: T.axis } },
      }],
    },
  });

  const victimsSeries = data.comboYears.map((y) => data.victimsByYearCombo[y] || 0);
  const popSeries = data.comboYears.map((y) => data.popByYearCombo[y] ?? null);
  const maxV = Math.max(...victimsSeries, 1);
  const labelTop = maxV + Math.max(3, Math.round(maxV * 0.15));
  configs.push({
    name: 'violence-and-population',
    width: PRINT.width,
    height: PRINT.heightTall,
    pixelRatio: PRINT.pixelRatio,
    option: {
      ...base(),
      legend: { data: ['Victims', 'Chinese Population'], bottom: 8, textStyle: { color: T.text, fontFamily: T.font } },
      xAxis: { type: 'category', data: data.comboYears, ...axis() },
      yAxis: [
        { type: 'value', name: 'Number of Victims', nameTextStyle: { color: T.text, fontFamily: T.font }, position: 'left', max: labelTop + 2, ...axisY() },
        { type: 'value', name: 'Chinese Population', nameTextStyle: { color: T.text, fontFamily: T.font }, position: 'right', axisLabel: { color: T.text, fontFamily: T.font, rotate: -90 }, axisLine: { lineStyle: { color: T.axis } }, splitLine: { show: false } },
      ],
      series: [
        { name: 'Victims', type: 'bar', data: victimsSeries, yAxisIndex: 0, itemStyle: { color: T.series[0] }, barWidth: '60%', markLine: { silent: true, symbol: ['none', 'none'], lineStyle: { color: T.axis, type: 'dashed', width: 1 }, data: data.policyEvents.map((e) => ({ xAxis: e.year })) } },
        { name: 'Chinese Population', type: 'line', data: popSeries, yAxisIndex: 1, lineStyle: { color: T.series[1], width: 2 }, symbol: 'circle', symbolSize: 4, itemStyle: { color: T.series[1] } },
      ],
      grid: { left: 70, right: 75, top: 50, bottom: 55 },
    },
  });

  const blackData = data.years1850_1920.map((y) => data.blackByYear[y] || 0);
  const chineseData = data.years1850_1920.map((y) => data.chineseByYear[y] || 0);
  configs.push({
    name: 'lynchings-black-vs-chinese',
    width: PRINT.width,
    height: PRINT.heightTall,
    pixelRatio: PRINT.pixelRatio,
    option: {
      ...base(),
      legend: { data: ['Black Lynching Victims', 'Chinese Violence Victims'], bottom: 10, textStyle: { color: T.text, fontFamily: T.font } },
      xAxis: { type: 'category', data: data.years1850_1920, ...axis() },
      yAxis: [
        { type: 'value', name: 'Black Victims', position: 'left', nameTextStyle: { color: T.text, fontFamily: T.font }, ...axisY() },
        { type: 'value', name: 'Chinese Victims', position: 'right', nameTextStyle: { color: T.text, fontFamily: T.font }, ...axisY(), splitLine: { show: false } },
      ],
      series: [
        { name: 'Black Lynching Victims', type: 'line', data: blackData, yAxisIndex: 0, lineStyle: { color: T.series[0], width: 2 }, symbol: 'circle', symbolSize: 4, itemStyle: { color: T.series[0] } },
        { name: 'Chinese Violence Victims', type: 'line', data: chineseData, yAxisIndex: 1, lineStyle: { color: T.series[1], width: 2 }, symbol: 'circle', symbolSize: 4, itemStyle: { color: T.series[1] } },
      ],
      grid: { left: 70, right: 70, top: 50, bottom: 60 },
    },
  });

  configs.push({
    name: 'per-capita-black-vs-chinese',
    width: PRINT.width,
    height: PRINT.heightTall,
    pixelRatio: PRINT.pixelRatio,
    option: {
      ...base(),
      legend: { data: ['Black Lynching Victims', 'Chinese Violence Victims'], bottom: 10, textStyle: { color: T.text, fontFamily: T.font } },
      xAxis: { type: 'category', data: data.years1875_1915, ...axis() },
      yAxis: [
        { type: 'value', name: 'Black per 100,000', position: 'left', nameTextStyle: { color: T.text, fontFamily: T.font }, min: 0, max: 42, ...axisY() },
        { type: 'value', name: 'Chinese per 100,000', position: 'right', nameTextStyle: { color: T.text, fontFamily: T.font }, min: 0, max: 42, ...axisY(), splitLine: { show: false } },
      ],
      series: [
        { name: 'Black Lynching Victims', type: 'line', data: data.blackPerCapita, yAxisIndex: 0, lineStyle: { color: T.series[0], width: 2 }, symbol: 'circle', symbolSize: 4, itemStyle: { color: T.series[0] } },
        { name: 'Chinese Violence Victims', type: 'line', data: data.chinesePerCapita, yAxisIndex: 1, lineStyle: { color: T.series[1], width: 2 }, symbol: 'circle', symbolSize: 4, itemStyle: { color: T.series[1] } },
      ],
      grid: { left: 70, right: 70, top: 30, bottom: 60 },
    },
  });

  configs.push({
    name: 'population-trends-black',
    width: PRINT.width,
    height: PRINT.heightSmall,
    pixelRatio: PRINT.pixelRatio,
    option: {
      ...base(),
      legend: { data: ['Black Population', 'Black Lynchings'], bottom: 10, textStyle: { color: T.text, fontFamily: T.font } },
      xAxis: { type: 'category', data: data.populationYears, ...axis() },
      yAxis: [
        { type: 'value', name: 'Black Population', position: 'left', nameTextStyle: { color: T.text, fontFamily: T.font }, ...axisY() },
        { type: 'value', name: 'Black Lynchings', position: 'right', nameTextStyle: { color: T.text, fontFamily: T.font }, ...axisY(), splitLine: { show: false } },
      ],
      series: [
        { name: 'Black Population', type: 'line', data: data.blackPop, yAxisIndex: 0, lineStyle: { color: T.series[0], width: 2 }, symbol: 'circle', symbolSize: 4, itemStyle: { color: T.series[0] } },
        { name: 'Black Lynchings', type: 'bar', data: data.blackLynchChart, yAxisIndex: 1, itemStyle: { color: T.series[1] } },
      ],
      grid: { left: 80, right: 70, top: 30, bottom: 70 },
    },
  });

  configs.push({
    name: 'population-trends-asian',
    width: PRINT.width,
    height: PRINT.heightSmall,
    pixelRatio: PRINT.pixelRatio,
    option: {
      ...base(),
      legend: { data: ['Asian Population', 'Chinese Violence'], bottom: 10, textStyle: { color: T.text, fontFamily: T.font } },
      xAxis: { type: 'category', data: data.populationYears, ...axis() },
      yAxis: [
        { type: 'value', name: 'Asian Population', position: 'left', nameTextStyle: { color: T.text, fontFamily: T.font }, ...axisY() },
        { type: 'value', name: 'Chinese Violence', position: 'right', nameTextStyle: { color: T.text, fontFamily: T.font }, ...axisY(), splitLine: { show: false } },
      ],
      series: [
        { name: 'Asian Population', type: 'line', data: data.asianPop, yAxisIndex: 0, lineStyle: { color: T.series[0], width: 2 }, symbol: 'circle', symbolSize: 4, itemStyle: { color: T.series[0] } },
        { name: 'Chinese Violence', type: 'bar', data: data.chineseLynchChart, yAxisIndex: 1, itemStyle: { color: T.series[1] } },
      ],
      grid: { left: 80, right: 70, top: 30, bottom: 70 },
    },
  });

  return configs;
}

/** Fetch Main tab pretext data from Google Sheets for publication chart */
async function loadPretextDataFromMainTab() {
  const sheetId = '18Bo9acVyuQTsdQ1baxSntSUZur50Yla8NcZKe2nZWyQ';
  const mainGid = '760826284';
  const url = `https://docs.google.com/spreadsheets/d/${sheetId}/export?format=csv&gid=${mainGid}`;
  const res = await fetch(url);
  if (!res.ok) return null;
  const csv = await res.text();
  const rows = parse(csv, { columns: true, skip_empty_lines: true, relax_column_count: true });
  const pretextCounts = {};
  const getCol = (row, names) => {
    for (const n of names) {
      const v = row[n] ?? row[n.replace(/ /g, '-')] ?? row[n.replace(/ /g, '_')];
      if (v && String(v).trim()) return String(v).trim();
    }
    return '';
  };
  rows.forEach((r) => {
    const raw = getCol(r, ['Pretexts Grouped', 'Pretext Grouped', 'pretext-grouped']);
    const parts = raw.split(';').map((s) => s.trim()).filter(Boolean);
    parts.forEach((p) => {
      if (p && p.toLowerCase() !== 'unknown') pretextCounts[p] = (pretextCounts[p] || 0) + 1;
    });
  });
  const PRETEXT_OTHER_THRESHOLD = 2;
  let otherCount = 0;
  const list = [];
  Object.entries(pretextCounts).forEach(([k, v]) => {
    if (v <= PRETEXT_OTHER_THRESHOLD) otherCount += v;
    else list.push({ name: k, value: v });
  });
  if (otherCount > 0) list.push({ name: 'Other', value: otherCount });
  return list.sort((a, b) => b.value - a.value);
}

function buildHtml(configs) {
  const border = theme.border;
  const cfgJson = JSON.stringify(configs)
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
  <div id="chart-root" style="width:960px;height:500px;background:${theme.bg};border:${border};box-sizing:border-box;"></div>
  <script>
    window.exportReady = false;
    window.exportError = null;
    try {
      const configs = JSON.parse('${cfgJson}');
      let chart = null;
      window.exportChart = function(i) {
        const c = configs[i];
        if (!c) return null;
        const el = document.getElementById('chart-root');
        el.style.width = c.width + 'px';
        el.style.height = c.height + 'px';
        if (chart) chart.dispose();
        chart = echarts.init(el, null, { renderer: 'canvas' });
        chart.setOption(c.option);
        const png = chart.getDataURL({ type: 'png', pixelRatio: c.pixelRatio ?? 2 });
        chart.dispose();
        chart = echarts.init(el, null, { renderer: 'svg' });
        chart.setOption(c.option);
        const svgEl = el.querySelector('svg');
        const svgRaw = svgEl ? new XMLSerializer().serializeToString(svgEl) : null;
        return { name: c.name, png, svgRaw };
      };
      window.getChartCount = function() { return configs.length; };
      window.exportReady = true;
    } catch (e) {
      window.exportError = e.message || String(e);
      window.exportReady = true;
    }
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

  const data = loadData();
  data.pretextDataPublication = await loadPretextDataFromMainTab().catch((e) => {
    console.warn('Could not fetch Main tab for pretexts, using fallback:', e.message);
    return data.pretextData;
  });
  const configs = buildChartConfigs(data);
  const html = buildHtml(configs);

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
  await page.waitForFunction('window.exportReady === true', { timeout: 15000 });
  const err = await page.evaluate('window.exportError');
  if (err) throw new Error('Export script error: ' + err);

  const n = await page.evaluate('window.getChartCount()');
  for (let i = 0; i < n; i++) {
    const result = await page.evaluate(`window.exportChart(${i})`);
    if (!result) continue;
    const { name, png, svgRaw } = result;
    const pngBuf = stripDataUrl(png);
    if (pngBuf) fs.writeFileSync(path.join(extrasDir, `${name}.png`), pngBuf);
    if (svgRaw && typeof svgRaw === 'string') {
      const svgOut = svgRaw.startsWith('<?xml') ? svgRaw : '<?xml version="1.0" encoding="UTF-8"?>\n' + svgRaw;
      fs.writeFileSync(path.join(extrasDir, `${name}.svg`), svgOut, 'utf-8');
    }
    console.log(`Wrote ${name}.png, ${name}.svg`);
  }

  await browser.close();
  console.log(`Done. Output in ${extrasDir}`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
