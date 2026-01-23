const fs = require('fs');
const path = require('path');

// Read timeline.json
const timelinePath = path.join(__dirname, '../../public/timeline.json');
const timeline = JSON.parse(fs.readFileSync(timelinePath, 'utf-8'));

// Extract census data
const censusData = timeline
  .filter(e => e.eventType && e.eventType.toLowerCase().includes('census'))
  .map(e => {
    // Extract Black population
    const blackMatch = e.text.match(/Total African-American Population: ([\d,]+)/);
    // Extract Asian population (used as proxy for Chinese during this period)
    const asianMatch = e.text.match(/Total Asian Population: ([\d,]+)/);
    
    return {
      year: parseInt(e.year),
      blackPopulation: blackMatch ? parseInt(blackMatch[1].replace(/,/g, '')) : null,
      asianPopulation: asianMatch ? parseInt(asianMatch[1].replace(/,/g, '')) : null
    };
  })
  .filter(e => e.blackPopulation !== null && e.asianPopulation !== null)
  .sort((a, b) => a.year - b.year);

// Interpolate for all years 1850-1920
const populationByYear = [];
for (let y = 1850; y <= 1920; y++) {
  // Find surrounding census years
  let before = null;
  let after = null;
  
  for (let i = 0; i < censusData.length; i++) {
    if (censusData[i].year <= y) {
      before = censusData[i];
    }
    if (censusData[i].year >= y && !after) {
      after = censusData[i];
      break;
    }
  }
  
  let blackPop = null;
  let asianPop = null;
  
  if (before && after && before.year !== after.year) {
    // Linear interpolation
    const t = (y - before.year) / (after.year - before.year);
    blackPop = Math.round(before.blackPopulation + t * (after.blackPopulation - before.blackPopulation));
    asianPop = Math.round(before.asianPopulation + t * (after.asianPopulation - before.asianPopulation));
  } else if (before && before.year === y) {
    blackPop = before.blackPopulation;
    asianPop = before.asianPopulation;
  } else if (after && after.year === y) {
    blackPop = after.blackPopulation;
    asianPop = after.asianPopulation;
  }
  
  if (blackPop !== null && asianPop !== null) {
    populationByYear.push({
      year: y,
      blackPopulation: blackPop,
      asianPopulation: asianPop
    });
  }
}

// Save to JSON
const outputPath = path.join(__dirname, '../../src/data/us-census-population.json');
fs.writeFileSync(outputPath, JSON.stringify(populationByYear, null, 2));
console.log(`Saved census data for ${populationByYear.length} years to ${outputPath}`);
console.log('Sample data:', populationByYear.slice(0, 5));
