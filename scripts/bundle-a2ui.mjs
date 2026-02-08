#!/usr/bin/env node
import { execSync } from "node:child_process";
/**
 * Cross-platform replacement for bundle-a2ui.sh
 * Bundles A2UI renderer + app if sources are present.
 */
import { createHash } from "node:crypto";
import { promises as fs } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const ROOT_DIR = path.resolve(path.dirname(__filename), "..");

const HASH_FILE = path.join(ROOT_DIR, "src/canvas-host/a2ui/.bundle.hash");
const OUTPUT_FILE = path.join(ROOT_DIR, "src/canvas-host/a2ui/a2ui.bundle.js");
const A2UI_RENDERER_DIR = path.join(ROOT_DIR, "vendor/a2ui/renderers/lit");
const A2UI_APP_DIR = path.join(ROOT_DIR, "apps/shared/OpenClawKit/Tools/CanvasA2UI");

// Docker builds exclude vendor/apps via .dockerignore.
// In that environment we must keep the prebuilt bundle.
async function dirExists(p) {
  try {
    return (await fs.stat(p)).isDirectory();
  } catch {
    return false;
  }
}

if (!(await dirExists(A2UI_RENDERER_DIR)) || !(await dirExists(A2UI_APP_DIR))) {
  console.log("A2UI sources missing; keeping prebuilt bundle.");
  process.exit(0);
}

// Compute hash of inputs
const INPUT_PATHS = [
  path.join(ROOT_DIR, "package.json"),
  path.join(ROOT_DIR, "pnpm-lock.yaml"),
  A2UI_RENDERER_DIR,
  A2UI_APP_DIR,
];

async function walk(entryPath) {
  const st = await fs.stat(entryPath);
  if (st.isDirectory()) {
    const entries = await fs.readdir(entryPath);
    const results = [];
    for (const entry of entries) {
      results.push(...(await walk(path.join(entryPath, entry))));
    }
    return results;
  }
  return [entryPath];
}

const files = [];
for (const input of INPUT_PATHS) {
  files.push(...(await walk(input)));
}

function normalize(p) {
  return p.split(path.sep).join("/");
}

files.sort((a, b) => normalize(a).localeCompare(normalize(b)));

const hash = createHash("sha256");
for (const filePath of files) {
  const rel = normalize(path.relative(ROOT_DIR, filePath));
  hash.update(rel);
  hash.update("\0");
  hash.update(await fs.readFile(filePath));
  hash.update("\0");
}

const currentHash = hash.digest("hex");

// Check if bundle is up to date
try {
  const previousHash = (await fs.readFile(HASH_FILE, "utf-8")).trim();
  const outputExists = await fs
    .stat(OUTPUT_FILE)
    .then(() => true)
    .catch(() => false);
  if (previousHash === currentHash && outputExists) {
    console.log("A2UI bundle up to date; skipping.");
    process.exit(0);
  }
} catch {
  // No previous hash file, need to rebuild
}

// Build
console.log("Building A2UI bundle...");
execSync(`pnpm -s exec tsc -p "${path.join(A2UI_RENDERER_DIR, "tsconfig.json")}"`, {
  stdio: "inherit",
  cwd: ROOT_DIR,
});
execSync(`rolldown -c "${path.join(A2UI_APP_DIR, "rolldown.config.mjs")}"`, {
  stdio: "inherit",
  cwd: ROOT_DIR,
});

await fs.writeFile(HASH_FILE, currentHash);
console.log("A2UI bundle complete.");
