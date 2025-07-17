const fs = require('fs');
const path = require('path');

// Read the articles data
const articlesPath = path.join(__dirname, '../data/articles.json');
const articles = JSON.parse(fs.readFileSync(articlesPath, 'utf8'));

// Read the sources page
const sourcesPath = path.join(__dirname, '../pages/sources.astro');
let sourcesContent = fs.readFileSync(sourcesPath, 'utf8');

// Helper function to normalize text for comparison
function normalizeText(text) {
  return text.toLowerCase()
    .replace(/[^\w\s]/g, '') // Remove punctuation
    .replace(/\s+/g, ' ') // Normalize whitespace
    .trim();
}

// Helper function to find best match
function findBestMatch(title, newspaper, articles) {
  const normalizedTitle = normalizeText(title);
  const normalizedNewspaper = normalizeText(newspaper);
  
  let bestMatch = null;
  let bestScore = 0;
  
  for (const article of articles) {
    const articleTitle = normalizeText(article['article-title'] || '');
    const articleNewspaper = normalizeText(article.newspaper || '');
    
    // Calculate similarity scores
    const titleScore = calculateSimilarity(normalizedTitle, articleTitle);
    const newspaperScore = calculateSimilarity(normalizedNewspaper, articleNewspaper);
    
    // Combined score (weight title more heavily)
    const combinedScore = (titleScore * 0.7) + (newspaperScore * 0.3);
    
    if (combinedScore > bestScore && combinedScore > 0.8) { // Threshold for good match
      bestScore = combinedScore;
      bestMatch = article;
    }
  }
  
  return bestMatch;
}

// Simple similarity calculation (can be improved)
function calculateSimilarity(str1, str2) {
  if (str1 === str2) return 1.0;
  if (str1.includes(str2) || str2.includes(str1)) return 0.9;
  
  const words1 = str1.split(' ');
  const words2 = str2.split(' ');
  const commonWords = words1.filter(word => words2.includes(word));
  
  if (commonWords.length === 0) return 0;
  
  return commonWords.length / Math.max(words1.length, words2.length);
}

// Extract citations from the Primary Sources section
const primarySourcesMatch = sourcesContent.match(/<h2 class="text-2xl font-semibold mb-4 mt-8">Primary Sources<\/h2>\s*<div class="space-y-3 mb-8">([\s\S]*?)<\/div>/);

if (primarySourcesMatch) {
  const primarySourcesSection = primarySourcesMatch[1];
  
  // Process each citation line
  const updatedSection = primarySourcesSection.replace(
    /<p>(.*?)<\/p>/g,
    (match, citationText) => {
      // First, remove any existing (view full article) or [view full article] links
      citationText = citationText.replace(/<a href="\/articles\/[^"]*" class="[^"]*">(?:\[view full article\]|\(view full article\))<\/a>/g, '');
      
      // Extract the article title and newspaper from the citation
      const titleMatch = citationText.match(/"([^"]+)"/);
      const newspaperMatch = citationText.match(/<em>([^<]+)<\/em>/);
      
      if (titleMatch && newspaperMatch) {
        const title = titleMatch[1];
        const newspaper = newspaperMatch[1];
        
        // Find matching article using fuzzy matching
        const matchingArticle = findBestMatch(title, newspaper, articles);
        
        if (matchingArticle) {
          // Add the (view full article) link and period after "here"
          const updatedCitation = citationText.replace(
            /(here)<\/a>/,
            'here.</a>'
          );
          return `<p>${updatedCitation} <a href="/articles/${matchingArticle['article-id']}" class="underline text-gray-500">(view full article)</a></p>`;
        }
      }
      
      // If no match found, just add the period after "here" and return without any link
      return `<p>${citationText.replace(/(here)<\/a>/, 'here.</a>')}</p>`;
    }
  );
  
  // Replace the section in the original content
  sourcesContent = sourcesContent.replace(primarySourcesMatch[0], 
    `<h2 class="text-2xl font-semibold mb-4 mt-8">Primary Sources</h2>\n  <div class="space-y-3 mb-8">${updatedSection}</div>`
  );
  
  // Write the updated content back
  fs.writeFileSync(sourcesPath, sourcesContent);
  console.log('Sources page updated with article links!');
} else {
  console.log('Could not find Primary Sources section');
}

// Log some statistics
console.log(`Total articles: ${articles.length}`); 