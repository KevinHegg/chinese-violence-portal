const fs = require('fs');
const path = require('path');

const files = ['lynchings.json', 'timeline.json'];
const srcDir = path.join(__dirname, '../data');
const publicDir = path.join(__dirname, '../../public');

files.forEach(file => {
  const src = path.join(srcDir, file);
  const dest = path.join(publicDir, file);
  if (fs.existsSync(src)) {
    fs.copyFileSync(src, dest);
    console.log(`Synced ${file} to public/`);
  }
}); 