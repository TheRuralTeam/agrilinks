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

function resolveImport(fromFile, imp) {
  if (imp.startsWith('@/')) {
    const rel = imp.slice(2);
    const candidate = path.join(SRC, rel);
    return resolveCandidate(candidate);
  }
  if (imp.startsWith('.')) {
    const candidate = path.resolve(path.dirname(fromFile), imp);
    return resolveCandidate(candidate);
  }
  // package import, assume exists
  return { exists: true, resolved: imp };
}

function resolveCandidate(base) {
  // try file with extensions
  for (const e of exts) {
    const f = base + e;
    if (fs.existsSync(f)) return { exists: true, resolved: f };
  }
  // try index files
  for (const e of exts) {
    const f = path.join(base, 'index' + e);
    if (fs.existsSync(f)) return { exists: true, resolved: f };
  }
  // try directory as-is
  if (fs.existsSync(base)) return { exists: true, resolved: base };
  return { exists: false, resolved: base };
}

const files = walk(SRC);
const importRe = /from\s+['"]([^'"]+)['"]/g;

const missing = [];

for (const file of files) {
  const content = fs.readFileSync(file, 'utf8');
  let m;
  while ((m = importRe.exec(content))) {
    const imp = m[1];
    const res = resolveImport(file, imp);
    if (!res.exists) {
      missing.push({ file: path.relative(ROOT, file), import: imp, resolved: path.relative(ROOT, res.resolved) });
    }
  }
}

if (missing.length === 0) {
  console.log('No missing imports found.');
  process.exit(0);
}

console.log('Missing imports:');
for (const m of missing) {
  console.log(`- ${m.file} -> '${m.import}' (tried: ${m.resolved})`);
}
process.exit(2);
