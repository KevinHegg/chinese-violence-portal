const fs = require('fs');
const path = require('path');

// Read the sources page
const sourcesPath = path.join(__dirname, '../pages/sources.astro');
let sourcesContent = fs.readFileSync(sourcesPath, 'utf8');

// Add the missing links one by one with precise targeting
const replacements = [
  {
    find: /(<p>"Chinese Bandit Lynched\." <em>St\.Joseph News-Press<\/em> \(St\. Joseph, MO\), October 13 1932, 1\. Accessed <a href="[^"]*" class="[^"]*">here\.<\/a>)(<\/p>)/,
    replace: '$1 <a href="/articles/0035" class="underline text-gray-500">(view full article)</a>$2'
  },
  {
    find: /(<p>"U\.S\." <em>Army Protects Chinese Miners Amid Tensions in Wyoming\.<\/em> <em>Ness County News<\/em> \(Ness City, KS\), September 19 1885, 6\. Accessed <a href="[^"]*" class="[^"]*">here\.<\/a>)(<\/p>)/,
    replace: '$1 <a href="/articles/0057" class="underline text-gray-500">(view full article)</a>$2'
  },
  {
    find: /(<p>"Untitled\." <em>Detroit Free Press<\/em> \(Detroit, MI\), Nov 13, 1958, 1\. Accessed <a href="[^"]*" class="[^"]*">here\.<\/a>)(<\/p>)/,
    replace: '$1 <a href="/articles/0172" class="underline text-gray-500">(view full article)</a>$2'
  },
  {
    find: /(<p>"A Chinaman Was Recently Hung for Theft\."  <em>The Sacramento Bee<\/em> \(Sacramento, CA\), Oct 17, 1865, 3\. Accessed <a href="[^"]*" class="[^"]*">here\.<\/a>)(<\/p>)/,
    replace: '$1 <a href="/articles/0176" class="underline text-gray-500">(view full article)</a>$2'
  },
  {
    find: /(<p>"The Chinaman Was Hung in Henderson Gulch\."  <em>The Bozeman Courier<\/em> \(Bozeman, MT\), Nov 9, 1871, 2\. Accessed <a href="[^"]*" class="[^"]*">here\.<\/a>)(<\/p>)/,
    replace: '$1 <a href="/articles/0177" class="underline text-gray-500">(view full article)</a>$2'
  },
  {
    find: /(<p>"Unceremonious… Chinese Murderer Lynched in California\."  <em>Wichita Eagle<\/em> \(Wichita, KS\), Jul 12 1887, 1\. Accessed <a href="[^"]*" class="[^"]*">here\.<\/a>)(<\/p>)/,
    replace: '$1 <a href="/articles/0155" class="underline text-gray-500">(view full article)</a>$2'
  }
];

// Apply each replacement
replacements.forEach(({ find, replace }, index) => {
  const beforeCount = (sourcesContent.match(find) || []).length;
  sourcesContent = sourcesContent.replace(find, replace);
  const afterCount = (sourcesContent.match(find) || []).length;
  console.log(`Replacement ${index + 1}: ${beforeCount} -> ${afterCount} matches`);
});

// Write the updated content back
fs.writeFileSync(sourcesPath, sourcesContent);
console.log('Updated sources page with missing links!'); 