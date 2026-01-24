const fs = require('fs');
const path = require('path');

// Only timeline.json needs to be synced to public/
// Lynching and article data now comes from Google Sheets API
const files = ['timeline.json'];
const srcDir = path.join(__dirname, '../data');
const publicDir = path.join(__dirname, '../../public');

files.forEach(file => {
  const src = path.join(srcDir, file);
  const dest = path.join(publicDir, file);
  if (fs.existsSync(src)) {
    fs.copyFileSync(src, dest);
    console.log(`Synced ${file} to public/`);
  } else {
    console.warn(`Warning: ${file} not found in ${srcDir}`);
  }
}); 