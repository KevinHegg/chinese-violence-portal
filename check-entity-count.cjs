// Simple script to count entities with 3+ occurrences
// Run with: node check-entity-count.cjs

const https = require('https');

// Fetch articles from the Google Sheets API
const SHEET_ID = '1ZRNb-M7aO0-j58avDV9JyMsHMllKNmewWm7dmZy7JPw';
const url = `https://docs.google.com/spreadsheets/d/${SHEET_ID}/export?format=csv`;

https.get(url, (res) => {
  let data = '';
  
  res.on('data', (chunk) => {
    data += chunk;
  });
  
  res.on('end', () => {
    // Parse CSV
    const lines = data.split('\n').filter(line => line.trim());
    if (lines.length < 2) {
      console.log('No data found');
      return;
    }
    
    // Parse header
    const headers = parseCSVLine(lines[0]);
    const namedEntitiesIndex = headers.findIndex(h => 
      h.toLowerCase().includes('named') && h.toLowerCase().includes('entities')
    );
    
    if (namedEntitiesIndex === -1) {
      console.log('Could not find named-entities column');
      return;
    }
    
    // Process entities
    const entityCounts = {}; // Key: lowercase entity name, Value: count
    const entityFormCounts = {}; // Track different casings
    
    for (let i = 1; i < lines.length; i++) {
      const values = parseCSVLine(lines[i]);
      const namedEntities = values[namedEntitiesIndex] || '';
      
      if (namedEntities) {
        const entities = namedEntities.split('@');
        entities.forEach((entity) => {
          const trimmedEntity = entity.trim();
          // Filter out empty strings and 'nan' values
          if (trimmedEntity && trimmedEntity.toLowerCase() !== 'nan') {
            const lowerKey = trimmedEntity.toLowerCase();
            
            // Count occurrences (case-insensitive)
            entityCounts[lowerKey] = (entityCounts[lowerKey] || 0) + 1;
            
            // Track different casings
            if (!entityFormCounts[lowerKey]) {
              entityFormCounts[lowerKey] = {};
            }
            entityFormCounts[lowerKey][trimmedEntity] = (entityFormCounts[lowerKey][trimmedEntity] || 0) + 1;
          }
        });
      }
    }
    
    // Filter entities that appear 3 or more times
    const entitiesWithThreshold = Object.entries(entityCounts)
      .filter(([lowerKey, count]) => count >= 3)
      .sort((a, b) => b[1] - a[1]); // Sort by count descending
    
    console.log(`\nTotal entities with 3+ occurrences: ${entitiesWithThreshold.length}\n`);
    console.log(`Top 20 entities by count:`);
    entitiesWithThreshold.slice(0, 20).forEach(([lowerKey, count], index) => {
      const forms = Object.keys(entityFormCounts[lowerKey]);
      const canonicalForm = forms.reduce((a, b) => 
        entityFormCounts[lowerKey][a] > entityFormCounts[lowerKey][b] ? a : b
      );
      console.log(`${index + 1}. ${canonicalForm}: ${count} occurrences`);
    });
  });
}).on('error', (err) => {
  console.error('Error fetching data:', err.message);
});

function parseCSVLine(line) {
  const values = [];
  let current = '';
  let inQuotes = false;
  
  for (let i = 0; i < line.length; i++) {
    const char = line[i];
    const nextChar = line[i + 1];
    
    if (char === '"') {
      if (inQuotes && nextChar === '"') {
        // Escaped quote
        current += '"';
        i++; // Skip next quote
      } else {
        // Toggle quote state
        inQuotes = !inQuotes;
      }
    } else if (char === ',' && !inQuotes) {
      // Field separator
      values.push(current.trim());
      current = '';
    } else {
      current += char;
    }
  }
  
  // Add last field
  values.push(current.trim());
  
  return values;
}
