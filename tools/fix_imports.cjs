const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const SRC = path.join(ROOT, 'src');

const exts = ['.ts', '.tsx', '.js', '.jsx', '.json'];

function walk(dir) {
  const files = [];
  for (const name of fs.readdirSync(dir)) {
    const full = path.join(dir, name);
    const stat = fs.statSync(full);
    if (stat.isDirectory()) {
      if (name === 'node_modules' || name === '.git') continue;
      files.push(...walk(full));
    } else if (/\.(ts|tsx|js|jsx)$/.test(name)) {
      files.push(full);
    }
  }
  return files;
}

function resolveCandidate(base) {
  for (const e of exts) {
    const f = base + e;
    if (fs.existsSync(f)) return f;
  }
  for (const e of exts) {
    const f = path.join(base, 'index' + e);
    if (fs.existsSync(f)) return f;
  }
  if (fs.existsSync(base)) return base;
  return null;
}

function fixFile(file) {
  let content = fs.readFileSync(file, 'utf8');
  const importRe = /(from\s+['"])(@\/[^'"]+)(['"])/g;
  let changed = false;
  content = content.replace(importRe, (m, p1, imp, p3) => {
    const rel = imp.slice(2);
    const candidateBase = path.join(SRC, rel);
    const resolved = resolveCandidate(candidateBase);
    if (!resolved) return m; // leave as-is
    const relativePath = path.relative(path.dirname(file), resolved).replace(/\\/g, '/');
    let final = relativePath;
    if (!final.startsWith('.')) final = './' + final;
    // strip extension for ts/tsx/js files to keep imports clean
    final = final.replace(/(\.tsx?|\.jsx?|\.json)$/, '');
    changed = true;
    return p1 + final + p3;
  });
  if (changed) fs.writeFileSync(file, content, 'utf8');
  return changed;
}

const files = walk(SRC);
const modified = [];
for (const f of files) {
  try {
    if (fixFile(f)) modified.push(path.relative(ROOT, f));
  } catch (e) {
    console.error('error fixing', f, e.message);
  }
}

console.log('Modified files:', modified.length);
for (const m of modified) console.log('- ' + m);

if (modified.length === 0) process.exit(0);
process.exit(0);
