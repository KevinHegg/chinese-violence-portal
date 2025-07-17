const fs = require('fs');
const path = require('path');

// Read the sources page
const sourcesPath = path.join(__dirname, '../pages/sources.astro');
let sourcesContent = fs.readFileSync(sourcesPath, 'utf8');

// Mapping of citations to article-ids
const missingLinks = [
  { citation: '"Chinese Bandit Lynched." St.Joseph News-Press', articleId: '0035' },
  { citation: '"U.S." Army Protects Chinese Miners Amid Tensions in Wyoming.', articleId: '0057' },
  { citation: '"Untitled." Detroit Free Press', articleId: '0172' },
  { citation: "'Chinese Must Go.' Kiowa News-Review and Kiowa Record", articleId: '0046' },
  { citation: "'Chinese Must Go.' Santa Fe Monitor", articleId: '0045' },
  { citation: "'I Hung One Chinaman.' The Anaconda Standard", articleId: '0043' },
  { citation: '"A Chinaman Was Recently Hung for Theft."', articleId: '0176' },
  { citation: '"The Chinaman Was Hung in Henderson Gulch."', articleId: '0177' },
  { citation: '"Unceremonious… Chinese Murderer Lynched in California."', articleId: '0155' }
];

// Process each missing link
missingLinks.forEach(({ citation, articleId }) => {
  // Create a regex pattern to find the citation and add the link
  const pattern = new RegExp(`(<p>.*?"${citation.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}.*?here\\.</a>)(</p>)`, 'g');
  
  sourcesContent = sourcesContent.replace(pattern, 
    `$1 <a href="/articles/${articleId}" class="underline text-gray-500">(view full article)</a>$2`
  );
});

// Write the updated content back
fs.writeFileSync(sourcesPath, sourcesContent);
console.log('Added missing (view full article) links to all 9 citations!'); 