const fs = require('fs');
const path = require('path');
const csv = require('csv-parse/sync');

const csvPath = path.join(__dirname, '../data/timeline.csv');
const jsonPath = path.join(__dirname, '../data/timeline.json');

const csvContent = fs.readFileSync(csvPath, 'utf8');
const records = csv.parse(csvContent, {
  columns: true,
  skip_empty_lines: true
});

const json = records.map(row => ({
  year: row['Year'] || '',
  month: row['Month'] || '',
  day: row['Day'] || '',
  displayDate: row['Display Date'] || '',
  headline: row['Headline'] || '',
  text: row['Text'] || '',
  eventType: row['Event Type'] || '',
  link: row['Link'] || ''
}));

fs.writeFileSync(jsonPath, JSON.stringify(json, null, 2));
console.log(`Converted ${records.length} rows to timeline.json`); 