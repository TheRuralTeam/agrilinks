#!/usr/bin/env node
/**
 * Read-only audit of local Supabase migration filenames.
 * This script never applies, renames, or edits migrations.
 */
import { readdir, readFile, stat } from "node:fs/promises";
import path from "node:path";
import process from "node:process";

const root = process.cwd();
const migrationsDir = path.join(root, "supabase", "migrations");
const files = [];

async function walk(dir) {
  let entries;
  try {
    entries = await readdir(dir, { withFileTypes: true });
  } catch (error) {
    if (error?.code === "ENOENT") {
      throw new Error(`Migration directory not found: ${path.relative(root, dir)}`);
    }
    throw error;
  }

  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) await walk(fullPath);
    else if (entry.isFile() && entry.name.endsWith(".sql")) files.push(fullPath);
  }
}

function relative(file) {
  return path.relative(root, file).split(path.sep).join("/");
}

await walk(migrationsDir);
files.sort();

const byVersion = new Map();
const invalidNames = [];
const emptyFiles = [];

for (const file of files) {
  const name = path.basename(file);
  const match = name.match(/^(\d{14})_(.+)\.sql$/);
  if (!match) invalidNames.push(relative(file));
  else {
    const version = match[1];
    const group = byVersion.get(version) ?? [];
    group.push(relative(file));
    byVersion.set(version, group);
  }

  const [contents, fileStat] = await Promise.all([
    readFile(file, "utf8"),
    stat(file),
  ]);
  if (fileStat.size === 0 || contents.trim().length === 0) emptyFiles.push(relative(file));
}

const duplicates = [...byVersion.entries()]
  .filter(([, group]) => group.length > 1)
  .sort(([a], [b]) => a.localeCompare(b));

console.log("AgriLink — auditoria local, somente leitura");
console.log(`Ficheiros SQL encontrados: ${files.length}`);
console.log(`Versões duplicadas: ${duplicates.length}`);
for (const [version, group] of duplicates) {
  console.log(`\nDUPLICADA ${version}`);
  for (const file of group) console.log(`  - ${file}`);
}

console.log(`\nNomes fora do padrão YYYYMMDDHHMMSS_nome.sql: ${invalidNames.length}`);
for (const file of invalidNames) console.log(`  - ${file}`);
console.log(`\nFicheiros vazios: ${emptyFiles.length}`);
for (const file of emptyFiles) console.log(`  - ${file}`);

console.log("\nNota: este relatório analisa apenas nomes/conteúdo local; não compara o ledger remoto nem prova se uma migration já foi aplicada.");
if (process.argv.includes("--check") && (duplicates.length || invalidNames.length || emptyFiles.length)) {
  process.exitCode = 1;
}
