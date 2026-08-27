const fs = require('fs');
const path = require('path');

function walk(dir) {
  let results = [];
  const list = fs.readdirSync(dir);
  list.forEach(file => {
    file = path.join(dir, file);
    const stat = fs.statSync(file);
    if (stat && stat.isDirectory()) {
      results = results.concat(walk(file));
    } else if (file.endsWith('.tsx') || file.endsWith('.ts')) {
      results.push(file);
    }
  });
  return results;
}

const dir = path.join(__dirname, 'artifacts/readwell');
const files = walk(dir);

files.forEach(file => {
  let content = fs.readFileSync(file, 'utf8');
  let changed = false;
  
  // Replace Inter_700Bold with Newsreader_700Bold for large headings/titles
  if (content.includes('Inter_700Bold')) {
    content = content.replace(/Inter_700Bold/g, 'Newsreader_700Bold');
    changed = true;
  }
  
  if (changed) {
    fs.writeFileSync(file, content, 'utf8');
    console.log('Updated:', file);
  }
});
