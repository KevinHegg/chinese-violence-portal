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
  padding: 10,          // px padding around each chart
  paddingTop: 10,
  paddingLeft: 5,
  paddingRight: 5,
  paddingBottom: 5,
};

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { parse } from 'csv-parse/sync';
import puppeteer from 'puppeteer';
import { buildTableBarHtml } from './table-bar-html.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, '..');
const extrasDir = path.join(root, 'extras');

const PATHS = {
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

function buildChartData(lynchings) {
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
  const killingMethodCounts = {};
  lynchings.forEach((r) => {
    const cat = r['violence-category-grouped'] || r['category-of-violence'] || r['event-type'] || 'Unknown';
    if (cat && cat !== 'Unknown') categoryCounts[cat] = (categoryCounts[cat] || 0) + 1;
    // Pretext Grouped column only (exact): single value per record, include all
    const pretext = ((r['pretext-grouped'] || '') + '').trim() || 'Unknown';
    pretextCounts[pretext] = (pretextCounts[pretext] || 0) + 1;
    const km = ((r['killing-method-grouped'] || r['Killing Method Grouped'] || '') + '').trim() || 'Unknown';
    killingMethodCounts[km] = (killingMethodCounts[km] || 0) + 1;
  });
  const categoryData = Object.entries(categoryCounts)
    .map(([name, value]) => ({ name, value }))
    .sort((a, b) => b.value - a.value);
  // Include all pretext values (no grouping); Pretext Grouped has Other, Unknown as distinct values
  const pretextData = Object.entries(pretextCounts)
    .map(([name, value]) => ({ name, value }))
    .sort((a, b) => b.value - a.value);
  const killingMethodData = Object.entries(killingMethodCounts)
    .map(([name, value]) => ({ name, value }))
    .sort((a, b) => b.value - a.value);

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
    killingMethodData,
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
  const Pt = PRINT.paddingTop;
  const Pl = PRINT.paddingLeft;
  const Pr = PRINT.paddingRight;
  const Pb = PRINT.paddingBottom;
  const F = { axisLabel: 20, axisName: 18, legend: 18, barLabelBig: 20, barLabelSmall: 16, pieLabel: 20 };
  const base = () => ({
    backgroundColor: T.bg,
    textStyle: { fontFamily: T.font, fontSize: F.axisLabel, color: T.text },
    animation: false,
  });
  const axis = () => ({
    axisLabel: { color: T.text, fontFamily: T.font, fontSize: F.axisLabel, align: 'center' },
    axisTick: { alignWithLabel: true },
    axisLine: { lineStyle: { color: T.axis } },
    splitLine: { lineStyle: { color: T.grid, opacity: 0.6 } },
  });
  const axisYLeft = () => ({
    axisLabel: { color: T.text, fontFamily: T.font, fontSize: F.axisLabel, rotate: 0 },
    axisLine: { lineStyle: { color: T.axis } },
    splitLine: { lineStyle: { color: T.grid, opacity: 0.6 } },
    nameLocation: 'center',
    nameGap: 105,
    nameRotate: 90,
  });
  const axisYRight = () => ({
    axisLabel: { color: T.text, fontFamily: T.font, fontSize: F.axisLabel, rotate: 0 },
    axisLine: { lineStyle: { color: T.axis } },
    splitLine: { show: false },
    nameLocation: 'center',
    nameGap: 50,
    nameRotate: -90,
  });

  const configs = [];

  // 1. Incidents over time
  const incYears = data.years1850_1920.map(String);
  const incCounts = data.years1850_1920.map((y) => data.incidentCounts[y] || 0);
  const incFont = 'Times New Roman';
  const incFontSize = 20;
  configs.push({
    name: '1 incidents of anti-chinese violence over time',
    width: PRINT.width,
    height: PRINT.heightStandard,
    pixelRatio: PRINT.pixelRatio,
    option: {
      ...base(),
      backgroundColor: '#ffffff',
      textStyle: { fontFamily: incFont, fontSize: incFontSize, color: T.text },
      xAxis: {
        type: 'category',
        data: incYears,
        boundaryGap: true,
        axisTick: { alignWithLabel: true },
        axisLabel: { color: T.text, fontFamily: incFont, fontSize: incFontSize, interval: 7 },
        axisLine: { lineStyle: { color: T.axis } },
        splitLine: { lineStyle: { color: T.grid, opacity: 0.6 } },
      },
      yAxis: {
        type: 'value',
        name: 'Number of Incidents',
        nameTextStyle: { color: T.text, fontFamily: incFont, fontSize: incFontSize, fontWeight: 'bold' },
        axisLabel: { color: T.text, fontFamily: incFont, fontSize: incFontSize, rotate: 0 },
        axisLine: { lineStyle: { color: T.axis } },
        splitLine: { lineStyle: { color: T.grid, opacity: 0.6 } },
        ...axisYLeft(),
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
      grid: { left: 75 + Pl, right: 40 + Pr, top: 20 + Pt, bottom: 50 + Pb },
    },
  });

  // 2. Victims over time
  const years = data.years1850_1920.map(String);
  const vicCounts = data.years1850_1920.map((y) => data.victimCounts[y] || 0);
  configs.push({
    name: '2 number of victims of anti-chinese violence over time',
    width: PRINT.width,
    height: PRINT.heightStandard,
    pixelRatio: PRINT.pixelRatio,
    option: {
      ...base(),
      xAxis: { type: 'category', data: years, ...axis() },
      yAxis: { type: 'value', name: 'Number of Victims', nameTextStyle: { color: T.text, fontFamily: T.font, fontSize: F.axisName }, ...axisYLeft() },
      series: [{ type: 'line', data: vicCounts, smooth: false, lineStyle: { color: '#1a1a1a', width: 2.5 }, areaStyle: { color: '#e8e8e8' }, itemStyle: { color: '#1a1a1a' }, symbol: 'circle', symbolSize: 5 }],
      grid: { left: 75 + Pl, right: 40 + Pr, top: 20 + Pt, bottom: 55 + Pb },
    },
  });

  const totalsByDecadeEvents = data.decades.map((dec) =>
    data.stackOrder.reduce((sum, state) => {
      const v = state === 'Other' ? data.statesSorted.slice(6).reduce((s, st) => s + ((data.eventsByDecadeByState[dec] || {})[st] || 0), 0) : ((data.eventsByDecadeByState[dec] || {})[state] || 0);
      return sum + v;
    }, 0)
  );
  const seriesEvents = data.stackOrder.map((state, idx) => {
    const isLast = idx === data.stackOrder.length - 1;
    const barData = data.decades.map((dec) => {
      if (state === 'Other') return data.statesSorted.slice(6).reduce((s, st) => s + ((data.eventsByDecadeByState[dec] || {})[st] || 0), 0);
      return (data.eventsByDecadeByState[dec] || {})[state] || 0;
    });
    return {
      name: state,
      type: 'bar',
      stack: 'events',
      data: barData,
      itemStyle: { color: T.series[idx % T.series.length] },
      label: {
        show: true,
        position: isLast ? 'top' : 'inside',
        formatter: isLast ? (params) => totalsByDecadeEvents[params.dataIndex] || '' : (params) => params.value >= 2 ? params.value : '',
        color: isLast ? '#000' : '#fff',
        fontWeight: isLast ? 'bold' : 'normal',
        fontSize: isLast ? F.barLabelBig : F.barLabelSmall,
      },
    };
  });
  configs.push({
    name: '3a number of lethal events by state over time',
    width: PRINT.width,
    height: PRINT.heightStandard,
    pixelRatio: PRINT.pixelRatio,
    option: {
      ...base(),
      legend: { bottom: 8 + Pb, textStyle: { color: T.text, fontFamily: T.font, fontSize: F.legend } },
      xAxis: { type: 'category', data: data.decades, ...axis() },
      yAxis: { type: 'value', name: 'Number of lethal events', nameTextStyle: { color: T.text, fontFamily: T.font, fontSize: F.axisName }, ...axisYLeft() },
      series: seriesEvents,
      grid: { left: 70 + Pl, right: 40 + Pr, top: 20 + Pt, bottom: 55 + Pb },
    },
  });

  const totalsByDecadeVictims = data.decades.map((dec) =>
    data.stackOrder.reduce((sum, state) => {
      const v = state === 'Other' ? data.statesSorted.slice(6).reduce((s, st) => s + ((data.victimsByDecadeByState[dec] || {})[st] || 0), 0) : ((data.victimsByDecadeByState[dec] || {})[state] || 0);
      return sum + v;
    }, 0)
  );
  const seriesVictims = data.stackOrder.map((state, idx) => {
    const isLast = idx === data.stackOrder.length - 1;
    const barData = data.decades.map((dec) => {
      if (state === 'Other') return data.statesSorted.slice(6).reduce((s, st) => s + ((data.victimsByDecadeByState[dec] || {})[st] || 0), 0);
      return (data.victimsByDecadeByState[dec] || {})[state] || 0;
    });
    return {
      name: state,
      type: 'bar',
      stack: 'victims',
      data: barData,
      itemStyle: { color: T.series[idx % T.series.length] },
      label: {
        show: true,
        position: isLast ? 'top' : 'inside',
        formatter: isLast ? (params) => totalsByDecadeVictims[params.dataIndex] || '' : (params) => (params.value >= 5 ? params.value : ''),
        color: isLast ? '#000000' : '#fff',
        fontWeight: isLast ? 'bold' : 'normal',
        fontSize: isLast ? F.barLabelBig : F.barLabelSmall,
      },
    };
  });
  configs.push({
    name: '3b number of victims by state over time',
    width: PRINT.width,
    height: PRINT.heightStandard,
    pixelRatio: PRINT.pixelRatio,
    option: {
      ...base(),
      legend: { bottom: 8 + Pb, textStyle: { color: T.text, fontFamily: T.font, fontSize: F.legend } },
      xAxis: { type: 'category', data: data.decades, ...axis() },
      yAxis: { type: 'value', name: 'Number of victims', nameTextStyle: { color: T.text, fontFamily: T.font, fontSize: F.axisName }, ...axisYLeft() },
      series: seriesVictims,
      grid: { left: 70 + Pl, right: 40 + Pr, top: 20 + Pt, bottom: 55 + Pb },
    },
  });

  const stateNames = data.statesSorted;
  const incByState = stateNames.map((s) => data.stateTotals[s] || 0);
  data.incidentCountByStateRows = stateNames.map((s) => ({ name: s, value: data.stateTotals[s] || 0 }));
  data.victimCountByStateRows = stateNames.map((s) => ({ name: s, value: data.stateVictimTotals[s] || 0 }));
  const totalIncidents = Object.values(data.stateTotals).reduce((a, b) => a + b, 0);
  const totalVictims = Object.values(data.stateVictimTotals).reduce((a, b) => a + b, 0);

  configs.push({
    name: `3c incident count by state (N=${totalIncidents})`,
    width: PRINT.width,
    height: PRINT.heightSmall,
    pixelRatio: PRINT.pixelRatio,
    option: {
      ...base(),
      grid: { left: 100 + Pl, right: 40 + Pr, top: 20 + Pt, bottom: 30 + Pb },
      xAxis: {
        type: 'value',
        min: 0,
        max: 40,
        interval: 10,
        axisLabel: { show: true, color: T.text, fontFamily: T.font, fontSize: F.axisLabel },
        axisLine: { show: true, lineStyle: { color: T.axis } },
        axisTick: { show: true, lineStyle: { color: T.axis } },
        splitLine: { lineStyle: { color: T.grid, opacity: 0.6 } },
      },
      yAxis: { type: 'category', data: stateNames, inverse: true, axisLabel: { color: T.text, fontFamily: T.font, fontSize: F.axisLabel }, axisLine: { lineStyle: { color: T.axis } } },
      series: [{ type: 'bar', data: incByState, itemStyle: { color: '#2563eb' }, barWidth: '60%', label: { show: true, position: 'right', color: T.text, fontFamily: T.font, fontSize: F.barLabelBig } }],
    },
  });

  const vicByState = stateNames.map((s) => data.stateVictimTotals[s] || 0);
  configs.push({
    name: `3d victim count by state (N=${totalVictims})`,
    width: PRINT.width,
    height: PRINT.heightSmall,
    pixelRatio: PRINT.pixelRatio,
    option: {
      ...base(),
      grid: { left: 100 + Pl, right: 40 + Pr, top: 20 + Pt, bottom: 30 + Pb },
      xAxis: {
        type: 'value',
        min: 0,
        max: 100,
        interval: 20,
        axisLabel: { show: true, color: T.text, fontFamily: T.font, fontSize: F.axisLabel },
        axisLine: { show: true, lineStyle: { color: T.axis } },
        axisTick: { show: true, lineStyle: { color: T.axis } },
        splitLine: { lineStyle: { color: T.grid, opacity: 0.6 } },
      },
      yAxis: { type: 'category', data: stateNames, inverse: true, axisLabel: { color: T.text, fontFamily: T.font, fontSize: F.axisLabel }, axisLine: { lineStyle: { color: T.axis } } },
      series: [{ type: 'bar', data: vicByState, itemStyle: { color: '#dc2626' }, barWidth: '60%', label: { show: true, position: 'right', color: T.text, fontFamily: T.font, fontSize: F.barLabelBig } }],
    },
  });

  const typeNames = Object.keys(data.typeCounts).map((t) => (t === 'Possible Lynching' ? 'Possible Lynching' : t));
  const typeVals = typeNames.map((t) => data.typeCounts[t]);
  const typeColors = typeNames.map((_, i) => T.series[i % T.series.length]);
  const typeBarData = typeVals.map((v, i) => ({ value: v, itemStyle: { color: typeColors[i] } }));
  configs.push({
    name: '4 types of anti-chinese violence',
    width: PRINT.width,
    height: PRINT.heightStandard,
    pixelRatio: PRINT.pixelRatio,
    option: {
      ...base(),
      xAxis: {
        type: 'category',
        data: typeNames,
        axisLabel: { color: T.text, fontFamily: T.font, fontSize: F.axisLabel, align: 'center', rotate: 0, interval: 0 },
        axisTick: { alignWithLabel: true },
        axisLine: { lineStyle: { color: T.axis } },
      },
      yAxis: { type: 'value', name: 'Number of Victims', nameTextStyle: { color: T.text, fontFamily: T.font, fontSize: F.axisName }, ...axisYLeft() },
      series: [{ type: 'bar', data: typeBarData, barWidth: '60%', label: { show: true, position: 'top', color: T.text, fontFamily: T.font, fontSize: F.barLabelBig, rotate: 0 } }],
      grid: { left: 70 + Pl, right: 40 + Pr, top: 20 + Pt, bottom: 80 + Pb },
    },
  });

  const categoryDataPub = data.categoryDataPublication || data.categoryData;
  const catColors = categoryDataPub.map((_, i) => T.series[i % T.series.length]);
  configs.push({
    name: '5a categories of violence',
    width: Math.floor(PRINT.width / 2) - 5,
    height: PRINT.heightSmall,
    pixelRatio: PRINT.pixelRatio,
    option: {
      ...base(),
      color: catColors,
      series: [{ type: 'pie', radius: ['25%', '70%'], center: ['50%', '55%'], data: categoryDataPub, label: { color: T.text, fontFamily: T.font, fontSize: F.pieLabel, formatter: '{b}: {c}' }, labelLine: { lineStyle: { color: T.axis } } }],
    },
  });

  let pretextDataPub = [...(data.pretextDataPublication || data.pretextData)];
  const antiChineseIdx = pretextDataPub.findIndex((d) => (d.name || '').toLowerCase().includes('anti-chinese'));
  if (antiChineseIdx >= 0) {
    const item = pretextDataPub.splice(antiChineseIdx, 1)[0];
    pretextDataPub.unshift(item);
  }
  const pretextChartData = pretextDataPub.map((item) => {
    const isSexualAssault = (item.name || '').toLowerCase().replace(/\s+/g, ' ').trim() === 'sexual assault';
    return {
      name: isSexualAssault ? 'Sexual\nassault' : item.name,
      value: item.value,
    };
  });
  const preColors = pretextDataPub.map((_, i) => T.series[i % T.series.length]);
  configs.push({
    name: '5b pretexts for violence',
    width: Math.floor(PRINT.width / 2) - 5,
    height: PRINT.heightSmall,
    pixelRatio: PRINT.pixelRatio,
    option: {
      ...base(),
      backgroundColor: '#ffffff',
      color: preColors,
      series: [{
        type: 'pie',
        radius: ['20%', '55%'],
        center: ['50%', '50%'],
        startAngle: 180,
        data: pretextChartData,
        label: {
          color: T.text,
          fontFamily: T.font,
          fontSize: F.pieLabel,
          formatter: '{b}: {c}',
          overflow: 'break',
          width: 140,
        },
        labelLine: { lineStyle: { color: T.axis } },
      }],
    },
  });

  const killingMethodDataPub = data.killingMethodDataPublication || data.killingMethodData;
  const kmColors = killingMethodDataPub.map((_, i) => T.series[i % T.series.length]);
  configs.push({
    name: '6 distribution of killing method',
    width: PRINT.width,
    height: PRINT.heightSmall,
    pixelRatio: PRINT.pixelRatio,
    option: {
      ...base(),
      title: { show: false },
      color: kmColors,
      series: [{ type: 'pie', radius: ['25%', '70%'], center: ['50%', '55%'], data: killingMethodDataPub, label: { color: T.text, fontFamily: T.font, fontSize: F.pieLabel, formatter: '{b}: {c}' }, labelLine: { lineStyle: { color: T.axis } } }],
    },
  });

  const victimsSeries = data.comboYears.map((y) => data.victimsByYearCombo[y] || 0);
  const popSeries = data.comboYears.map((y) => data.popByYearCombo[y] ?? null);
  const maxV = Math.max(...victimsSeries, 1);
  const labelTop = maxV + Math.max(3, Math.round(maxV * 0.15));
  configs.push({
    name: '7 victims and chinese population 1850-1915',
    width: PRINT.width,
    height: PRINT.heightTall,
    pixelRatio: PRINT.pixelRatio,
    option: {
      ...base(),
      title: { show: false },
      legend: { data: ['Victims', 'Chinese Population'], bottom: 8 + Pb, textStyle: { color: T.text, fontFamily: T.font, fontSize: F.legend } },
      xAxis: { type: 'category', data: data.comboYears, ...axis() },
      yAxis: [
        { type: 'value', name: 'Number of Victims', nameTextStyle: { color: T.text, fontFamily: T.font, fontSize: F.axisName }, position: 'left', max: labelTop + 2, ...axisYLeft() },
        { type: 'value', name: 'Chinese Population', nameTextStyle: { color: T.text, fontFamily: T.font, fontSize: F.axisName }, position: 'right', axisLabel: { color: T.text, fontFamily: T.font, fontSize: F.axisLabel, rotate: 0 }, ...axisYRight() },
      ],
      series: [
        { name: 'Victims', type: 'bar', data: victimsSeries, yAxisIndex: 0, itemStyle: { color: T.series[0] }, barWidth: '60%', markLine: { silent: true, symbol: ['none', 'none'], lineStyle: { color: T.axis, type: 'dashed', width: 1 }, data: data.policyEvents.map((e) => ({ xAxis: e.year })) } },
        { name: 'Chinese Population', type: 'line', data: popSeries, yAxisIndex: 1, lineStyle: { color: T.series[1], width: 2 }, symbol: 'circle', symbolSize: 4, itemStyle: { color: T.series[1] } },
      ],
      grid: { left: 195 + Pl, right: 75 + Pr, top: 35 + Pt, bottom: 65 + Pb },
    },
  });

  const blackData = data.years1850_1920.map((y) => data.blackByYear[y] || 0);
  const chineseData = data.years1850_1920.map((y) => data.chineseByYear[y] || 0);
  configs.push({
    name: 'lynchings black vs chinese over time',
    width: PRINT.width,
    height: PRINT.heightTall,
    pixelRatio: PRINT.pixelRatio,
    option: {
      ...base(),
      legend: { data: ['Black Lynching Victims', 'Chinese Violence Victims'], bottom: 10 + Pb, textStyle: { color: T.text, fontFamily: T.font, fontSize: F.legend } },
      xAxis: { type: 'category', data: data.years1850_1920, ...axis() },
      yAxis: [
        { type: 'value', name: 'Black Victims', position: 'left', nameTextStyle: { color: T.text, fontFamily: T.font, fontSize: F.axisName }, ...axisYLeft() },
        { type: 'value', name: 'Chinese Victims', position: 'right', nameTextStyle: { color: T.text, fontFamily: T.font, fontSize: F.axisName }, ...axisYRight() },
      ],
      series: [
        { name: 'Black Lynching Victims', type: 'line', data: blackData, yAxisIndex: 0, lineStyle: { color: T.series[0], width: 2 }, symbol: 'circle', symbolSize: 4, itemStyle: { color: T.series[0] } },
        { name: 'Chinese Violence Victims', type: 'line', data: chineseData, yAxisIndex: 1, lineStyle: { color: T.series[1], width: 2 }, symbol: 'circle', symbolSize: 4, itemStyle: { color: T.series[1] } },
      ],
      grid: { left: 195 + Pl, right: 70 + Pr, top: 35 + Pt, bottom: 80 + Pb },
    },
  });

  configs.push({
    name: 'per capita lynchings black vs chinese 1875-1915',
    width: PRINT.width,
    height: PRINT.heightTall,
    pixelRatio: PRINT.pixelRatio,
    option: {
      ...base(),
      legend: { data: ['Black Lynching Victims', 'Chinese Violence Victims'], bottom: 10 + Pb, textStyle: { color: T.text, fontFamily: T.font, fontSize: F.legend } },
      xAxis: { type: 'category', data: data.years1875_1915, ...axis() },
      yAxis: [
        { type: 'value', name: 'Black per 100,000', position: 'left', nameTextStyle: { color: T.text, fontFamily: T.font, fontSize: F.axisName }, min: 0, max: 42, ...axisYLeft() },
        { type: 'value', name: 'Chinese per 100,000', position: 'right', nameTextStyle: { color: T.text, fontFamily: T.font, fontSize: F.axisName }, min: 0, max: 42, ...axisYRight() },
      ],
      series: [
        { name: 'Black Lynching Victims', type: 'line', data: data.blackPerCapita, yAxisIndex: 0, lineStyle: { color: T.series[0], width: 2 }, symbol: 'circle', symbolSize: 4, itemStyle: { color: T.series[0] } },
        { name: 'Chinese Violence Victims', type: 'line', data: data.chinesePerCapita, yAxisIndex: 1, lineStyle: { color: T.series[1], width: 2 }, symbol: 'circle', symbolSize: 4, itemStyle: { color: T.series[1] } },
      ],
      grid: { left: 195 + Pl, right: 70 + Pr, top: 35 + Pt, bottom: 80 + Pb },
    },
  });

  configs.push({
    name: 'population trends black americans',
    width: PRINT.width,
    height: PRINT.heightSmall,
    pixelRatio: PRINT.pixelRatio,
    option: {
      ...base(),
      legend: { data: ['Black Population', 'Black Lynchings'], bottom: 10 + Pb, textStyle: { color: T.text, fontFamily: T.font, fontSize: F.legend } },
      xAxis: { type: 'category', data: data.populationYears, ...axis() },
      yAxis: [
        { type: 'value', name: 'Black Population', position: 'left', nameTextStyle: { color: T.text, fontFamily: T.font, fontSize: F.axisName }, ...axisYLeft() },
        { type: 'value', name: 'Black Lynchings', position: 'right', nameTextStyle: { color: T.text, fontFamily: T.font, fontSize: F.axisName }, ...axisYRight() },
      ],
      series: [
        { name: 'Black Population', type: 'line', data: data.blackPop, yAxisIndex: 0, lineStyle: { color: T.series[0], width: 2 }, symbol: 'circle', symbolSize: 4, itemStyle: { color: T.series[0] } },
        { name: 'Black Lynchings', type: 'bar', data: data.blackLynchChart, yAxisIndex: 1, itemStyle: { color: T.series[1] } },
      ],
      grid: { left: 200 + Pl, right: 70 + Pr, top: 35 + Pt, bottom: 85 + Pb },
    },
  });

  configs.push({
    name: 'population trends asian americans',
    width: PRINT.width,
    height: PRINT.heightSmall,
    pixelRatio: PRINT.pixelRatio,
    option: {
      ...base(),
      legend: { data: ['Asian Population', 'Chinese Violence'], bottom: 10 + Pb, textStyle: { color: T.text, fontFamily: T.font, fontSize: F.legend } },
      xAxis: { type: 'category', data: data.populationYears, ...axis() },
      yAxis: [
        { type: 'value', name: 'Asian Population', position: 'left', nameTextStyle: { color: T.text, fontFamily: T.font, fontSize: F.axisName }, ...axisYLeft() },
        { type: 'value', name: 'Chinese Violence', position: 'right', nameTextStyle: { color: T.text, fontFamily: T.font, fontSize: F.axisName }, ...axisYRight() },
      ],
      series: [
        { name: 'Asian Population', type: 'line', data: data.asianPop, yAxisIndex: 0, lineStyle: { color: T.series[0], width: 2 }, symbol: 'circle', symbolSize: 4, itemStyle: { color: T.series[0] } },
        { name: 'Chinese Violence', type: 'bar', data: data.chineseLynchChart, yAxisIndex: 1, itemStyle: { color: T.series[1] } },
      ],
      grid: { left: 200 + Pl, right: 70 + Pr, top: 35 + Pt, bottom: 85 + Pb },
    },
  });

  return configs;
}

const MAIN_TAB_GID = '760826284';
const SHEET_ID = '18Bo9acVyuQTsdQ1baxSntSUZur50Yla8NcZKe2nZWyQ';

const getCol = (row, names) => {
  for (const n of names) {
    const v = row[n] ?? row[n?.replace(/ /g, '-')] ?? row[n?.replace(/ /g, '_')];
    if (v != null && String(v).trim()) return String(v).trim();
  }
  return '';
};

/** Fetch full lynching records from Main tab (live Google Sheet) */
async function loadLynchingsFromMainTab() {
  const url = `https://docs.google.com/spreadsheets/d/${SHEET_ID}/export?format=csv&gid=${MAIN_TAB_GID}`;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Failed to fetch Main tab: ${res.status}`);
  const csv = await res.text();
  const rows = parse(csv, { columns: true, skip_empty_lines: true, relax_column_count: true });
  return rows
    .filter((r) => getCol(r, ['Identifier', 'identifier', 'Lynching ID', 'lynching-id', 'Record ID']))
    .map((r) => {
      const yearVal = getCol(r, ['Year', 'year']);
      const y = yearVal ? parseInt(yearVal, 10) : null;
      const date = getCol(r, ['Date', 'date']);
      const state = getCol(r, ['State', 'state']) || 'Unknown';
      const v = parseInt(getCol(r, ['Number of Victims', 'number-of-victims']), 10) || 1;
      const eventType = getCol(r, ['Category of Violence', 'event-type', 'category-of-violence']);
      const catGrouped = getCol(r, ['Violence Category Grouped', 'violence-category-grouped']);
      let pretextGrouped = '';
      for (const k of Object.keys(r)) {
        if (k.trim().toLowerCase() === 'pretext grouped' && !k.toLowerCase().includes('pretexts')) {
          pretextGrouped = (r[k] || '').trim();
          break;
        }
      }
      return {
        year: y,
        date: date || '',
        state,
        'number-of-victims': v,
        'event-type': eventType || 'Unknown',
        'violence-category-grouped': catGrouped || '',
        'category-of-violence': eventType || 'Unknown',
        'pretext-grouped': pretextGrouped || 'Unknown',
      };
    });
}

/** Fetch Main tab Violence Category Grouped from Google Sheets for publication chart */
async function loadCategoryDataFromMainTab() {
  const url = `https://docs.google.com/spreadsheets/d/${SHEET_ID}/export?format=csv&gid=${MAIN_TAB_GID}`;
  const res = await fetch(url);
  if (!res.ok) return null;
  const csv = await res.text();
  const rows = parse(csv, { columns: true, skip_empty_lines: true, relax_column_count: true });
  const categoryCounts = {};
  const getCol = (row, names) => {
    for (const n of names) {
      const v = row[n] ?? row[n.replace(/ /g, '-')] ?? row[n.replace(/ /g, '_')];
      if (v && String(v).trim()) return String(v).trim();
    }
    return '';
  };
  rows.forEach((r) => {
    const cat = getCol(r, ['Violence Category Grouped', 'violence-category-grouped']);
    if (cat && cat.toLowerCase() !== 'unknown') categoryCounts[cat] = (categoryCounts[cat] || 0) + 1;
  });
  return Object.entries(categoryCounts)
    .map(([name, value]) => ({ name, value }))
    .sort((a, b) => b.value - a.value);
}

/** Fetch Main tab pretext data from Google Sheets for publication chart */
async function loadPretextDataFromMainTab() {
  const url = `https://docs.google.com/spreadsheets/d/${SHEET_ID}/export?format=csv&gid=${MAIN_TAB_GID}`;
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
  // Find "Pretext Grouped" column (singular) - exclude "Pretexts Grouped"
  const header = Object.keys(rows[0] || {}).find((k) => k.trim().toLowerCase() === "pretext grouped");
  rows.forEach((r) => {
    const pretext = (header ? (r[header] || "").trim() : "") || "Unknown";
    pretextCounts[pretext] = (pretextCounts[pretext] || 0) + 1;
  });
  return Object.entries(pretextCounts)
    .map(([name, value]) => ({ name, value }))
    .sort((a, b) => b.value - a.value);
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
        return { name: c.name, png };
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

  const lynchings = await loadLynchingsFromMainTab();
  const data = buildChartData(lynchings);
  data.categoryDataPublication = await loadCategoryDataFromMainTab().catch((e) => {
    console.warn('Could not fetch Main tab for Violence Category Grouped, using fallback:', e.message);
    return data.categoryData;
  });
  data.pretextDataPublication = await loadPretextDataFromMainTab().catch((e) => {
    console.warn('Could not fetch Main tab for pretexts, using fallback:', e.message);
    return data.pretextData;
  });
  data.killingMethodDataPublication = data.killingMethodData;
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
    const { name, png } = result;
    const pngBuf = stripDataUrl(png);
    if (pngBuf) fs.writeFileSync(path.join(extrasDir, `${name}.png`), pngBuf);
    console.log(`Wrote ${name}.png`);
  }

  const totalIncidents = (data.incidentCountByStateRows || []).reduce((s, r) => s + r.value, 0);
  const totalVictims = (data.victimCountByStateRows || []).reduce((s, r) => s + r.value, 0);
  const incRows = data.incidentCountByStateRows || [];
  if (incRows.length > 0) {
    const tableBarHtml = buildTableBarHtml(incRows, {
      barColor: '#2563eb',
      labelHeader: 'State',
      valueHeader: 'Incidents',
      width: PRINT.width,
      font: theme.font,
    });
    await page.setContent(tableBarHtml, { waitUntil: 'load', timeout: 10000 });
    await new Promise((r) => setTimeout(r, 100));
    const el = await page.$('#table-bar');
    if (el) {
      const buf = await el.screenshot({ type: 'png', omitBackground: false });
      if (buf) {
        const name = `3c.1 incident count by state (N=${totalIncidents}).png`;
        fs.writeFileSync(path.join(extrasDir, name), buf);
        console.log('Wrote', name);
      }
    }
  }

  const vicRows = data.victimCountByStateRows || [];
  if (vicRows.length > 0) {
    const tableBarHtml = buildTableBarHtml(vicRows, {
      barColor: '#dc2626',
      labelHeader: 'State',
      valueHeader: 'Victims',
      width: PRINT.width,
      font: theme.font,
    });
    await page.setContent(tableBarHtml, { waitUntil: 'load', timeout: 10000 });
    await new Promise((r) => setTimeout(r, 100));
    const el = await page.$('#table-bar');
    if (el) {
      const buf = await el.screenshot({ type: 'png', omitBackground: false });
      if (buf) {
        const name = `3d.1 victim count by state (N=${totalVictims}).png`;
        fs.writeFileSync(path.join(extrasDir, name), buf);
        console.log('Wrote', name);
      }
    }
  }

  await browser.close();
  console.log(`Done. Output in ${extrasDir}`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
