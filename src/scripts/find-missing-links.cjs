const fs = require('fs');
const path = require('path');

// Read the sources page
const sourcesPath = path.join(__dirname, '../pages/sources.astro');
const sourcesContent = fs.readFileSync(sourcesPath, 'utf8');

// Extract citations from the Primary Sources section
const primarySourcesMatch = sourcesContent.match(/<h2 class="text-2xl font-semibold mb-4 mt-8">Primary Sources<\/h2>\s*<div class="space-y-3 mb-8">([\s\S]*?)<\/div>/);

if (primarySourcesMatch) {
  const primarySourcesSection = primarySourcesMatch[1];
  
  // Find all citation paragraphs
  const citationMatches = primarySourcesSection.match(/<p>(.*?)<\/p>/g);
  
  let count = 0;
  const missingLinks = [];
  
  citationMatches.forEach((match, index) => {
    // Check if this citation has a (view full article) link
    if (!match.includes('(view full article)')) {
      count++;
      
      // Extract the citation text (remove HTML tags for cleaner output)
      const citationText = match
        .replace(/<p>(.*?)<\/p>/, '$1')
        .replace(/<em>(.*?)<\/em>/g, '$1')
        .replace(/<a href="[^"]*" class="[^"]*">[^<]*<\/a>/g, '')
        .trim();
      
      missingLinks.push(citationText);
    }
  });
  
  // Write to file
  const outputPath = path.join(__dirname, '../missing-links.txt');
  let output = 'Citations WITHOUT (view full article) links:\n\n';
  
  missingLinks.forEach((citation, index) => {
    output += `${index + 1}. ${citation}\n`;
  });
  
  output += `\nTotal citations without links: ${count}`;
  
  fs.writeFileSync(outputPath, output);
  console.log(`Found ${count} citations without links. See missing-links.txt for the full list.`);
  
} else {
  console.log('Could not find Primary Sources section');
} 