const fs = require('fs');
const path = require('path');

function walk(dir) {
  let results = [];
  const list = fs.readdirSync(dir);
  list.forEach(function(file) {
    file = dir + '/' + file;
    const stat = fs.statSync(file);
    if (stat && stat.isDirectory()) {
      results = results.concat(walk(file));
    } else {
      if (file.endsWith('.js') || file.endsWith('.jsx')) results.push(file);
    }
  });
  return results;
}

const frontendSrc = path.join('..', 'uniswap-frontend', 'src');
const files = walk(frontendSrc);

files.forEach(file => {
  let content = fs.readFileSync(file, 'utf8');
  let changed = false;

  if (content.includes("'http://localhost:3000")) {
    content = content.replace(/'http:\/\/localhost:3000/g, "(import.meta.env.VITE_API_URL || 'http://localhost:3000') + '");
    changed = true;
  }
  
  if (content.includes("`http://localhost:3000")) {
    content = content.replace(/`http:\/\/localhost:3000/g, "`${import.meta.env.VITE_API_URL || 'http://localhost:3000'}");
    changed = true;
  }

  if (changed) {
    fs.writeFileSync(file, content);
    console.log('Updated ' + file);
  }
});
