const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const SRC = path.join(ROOT, 'src');

const file = path.join(SRC, 'App.tsx');
const content = fs.readFileSync(file, 'utf8');
console.log('--- File head ---');
console.log(content.split('\n').slice(0,40).join('\n'));

const importRe = /(from\s+['"])(@\/[^"]+)(['"])/g;
let m;
let found = false;
while ((m = importRe.exec(content))) {
  found = true;
  const imp = m[2];
  const rel = imp.slice(2);
  const candidateBase = path.join(SRC, rel);
  console.log('MATCH:', imp);
  console.log(' candidateBase:', candidateBase);
  // try extensions
  const exts = ['.ts', '.tsx', '.js', '.jsx', '.json'];
  let resolved = null;
  for (const e of exts) {
    const f = candidateBase + e;
    if (fs.existsSync(f)) { resolved = f; break; }
  }
  if (!resolved) {
    for (const e of exts) {
      const f = path.join(candidateBase, 'index' + e);
      if (fs.existsSync(f)) { resolved = f; break; }
    }
  }
  if (!resolved && fs.existsSync(candidateBase)) resolved = candidateBase;
  console.log(' resolved:', resolved);
}
if (!found) console.log('No matches found by regex in App.tsx');
