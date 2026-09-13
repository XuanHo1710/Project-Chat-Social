import { readFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const scriptDir = dirname(fileURLToPath(import.meta.url));
const localesDir = join(scriptDir, "..", "src", "locales");

const load = (file) =>
  JSON.parse(readFileSync(join(localesDir, file), "utf8").replace(/^\uFEFF/, ""));

// Flatten nested objects to "dot.path" -> leaf value (arrays are leaves)
function flatten(obj, prefix = "", out = new Map()) {
  for (const [key, value] of Object.entries(obj)) {
    const path = prefix ? `${prefix}.${key}` : key;
    if (value !== null && typeof value === "object") {
      flatten(value, path, out);
    } else {
      out.set(path, value);
    }
  }
  return out;
}

// Multiset of {{placeholder}} tokens in a string
function placeholders(value) {
  if (typeof value !== "string") return [];
  return value.match(/\{\{[^{}]+\}\}/g) ?? [];
}

function diffMultiset(a, b) {
  const counts = new Map();
  for (const token of a) counts.set(token, (counts.get(token) ?? 0) + 1);
  for (const token of b) {
    const remaining = counts.get(token) ?? 0;
    if (remaining <= 1) counts.delete(token);
    else counts.set(token, remaining - 1);
  }
  return [...counts.keys()];
}

function comparePair(baseName, otherName) {
  const base = flatten(load(baseName));
  const other = flatten(load(otherName));
  const problems = [];

  for (const [key] of base) {
    if (!other.has(key)) problems.push(`${key}: missing in ${otherName}`);
  }
  for (const [key] of other) {
    if (!base.has(key)) problems.push(`${key}: missing in ${baseName}`);
  }

  for (const [key, baseValue] of base) {
    if (!other.has(key)) continue;
    const extraTokens = diffMultiset(placeholders(baseValue), placeholders(other.get(key)));
    const missingTokens = diffMultiset(placeholders(other.get(key)), placeholders(baseValue));
    for (const token of extraTokens) {
      problems.push(`${key}: placeholder ${token} present in ${baseName} but not in ${otherName}`);
    }
    for (const token of missingTokens) {
      problems.push(`${key}: placeholder ${token} present in ${otherName} but not in ${baseName}`);
    }
  }

  return { problems, keyCount: base.size };
}

let failed = false;

for (const [baseName, otherName] of [
  ["en.json", "vi.json"],
  ["games.en.json", "games.vi.json"],
]) {
  const { problems, keyCount } = comparePair(baseName, otherName);
  if (problems.length > 0) {
    failed = true;
    console.error(`✗ ${baseName} <-> ${otherName} (${problems.length} problem${problems.length === 1 ? "" : "s"}):`);
    for (const problem of problems.sort()) console.error(`  - ${problem}`);
  } else {
    console.log(`✓ ${baseName} <-> ${otherName}: ${keyCount} leaf keys, placeholders in sync`);
  }
}

if (failed) process.exit(1);

console.log("OK: all locale files are in parity");
