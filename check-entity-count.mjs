import { fetchArticlesData } from './src/utils/googleSheets.ts';

async function countEntities() {
  const articles = await fetchArticlesData();
  
  const entityCounts = {}; // Key: lowercase entity name, Value: count
  const entityFormCounts = {}; // Track different casings
  
  articles.forEach((article) => {
    if (article['named-entities']) {
      const entities = article['named-entities'].split('@');
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
  });
  
  // Filter entities that appear 3 or more times
  const entitiesWithThreshold = Object.entries(entityCounts)
    .filter(([lowerKey, count]) => count >= 3)
    .sort((a, b) => b[1] - a[1]); // Sort by count descending
  
  console.log(`Total entities with 3+ occurrences: ${entitiesWithThreshold.length}`);
  console.log(`\nTop 20 entities by count:`);
  entitiesWithThreshold.slice(0, 20).forEach(([lowerKey, count], index) => {
    const forms = Object.keys(entityFormCounts[lowerKey]);
    const canonicalForm = forms.reduce((a, b) => 
      entityFormCounts[lowerKey][a] > entityFormCounts[lowerKey][b] ? a : b
    );
    console.log(`${index + 1}. ${canonicalForm}: ${count} occurrences`);
  });
}

countEntities().catch(console.error);
