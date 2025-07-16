const fs = require('fs');
const path = require('path');

const filePath = path.join(__dirname, '../data/articles.json');

function padId(id) {
  return id.toString().padStart(4, '0');
}

function main() {
  const data = JSON.parse(fs.readFileSync(filePath, 'utf8'));
  data.forEach(article => {
    if (article['article-id']) {
      article['article-id'] = padId(article['article-id']);
    }
  });
  fs.writeFileSync(filePath, JSON.stringify(data, null, 2));
  console.log('All article-id values have been padded to four digits.');
}

main(); 