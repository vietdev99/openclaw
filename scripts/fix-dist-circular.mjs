#!/usr/bin/env node
/**
 * Post-build fix for tsdown/rolldown circular chunk dependency.
 *
 * tsdown generates chunks that define a helper called `__exportAll`.
 * Other chunks import that helper, but the defining chunk also imports
 * *from* those other chunks — creating a circular ESM import.
 * At runtime the `__exportAll` binding is still `undefined` when the
 * dependent chunks evaluate (ESM live bindings + evaluation order).
 *
 * This script inlines the helper directly into every affected file so
 * that no circular import is needed.
 *
 * Affected locations:
 *  - dist/*.js         (imports __exportAll from loader-*.js)
 *  - dist/plugin-sdk/* (imports __exportAll as t from ./index.js)
 */

import fs from "node:fs";
import path from "node:path";

const distDir = path.resolve(process.cwd(), "dist");

// The actual __exportAll helper that tsdown/rolldown generates.
const INLINE_HELPER = [
  "var __defProp = Object.defineProperty;",
  "var __exportAll = (all, no_symbols) => {",
  "  let target = {};",
  "  for (var name in all) __defProp(target, name, { get: all[name], enumerable: true });",
  "  return target;",
  "};",
].join("\n");

// Match any import line that pulls `__exportAll` from another chunk.
// Covers both:
//   import { zr as __exportAll } from "./loader-XXXX.js";
//   import { t as __exportAll } from "./index.js";
const IMPORT_RE = /^import \{ \w+ as __exportAll \} from "[^"]+";$/m;

function patchDir(dir) {
  let patched = 0;
  let entries;
  try {
    entries = fs.readdirSync(dir, { withFileTypes: true });
  } catch {
    return 0;
  }
  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      patched += patchDir(fullPath);
      continue;
    }
    if (!entry.name.endsWith(".js")) continue;
    // Skip the files that DEFINE __exportAll (they are the source, not the consumer).
    if (entry.name.startsWith("loader-")) continue;

    const content = fs.readFileSync(fullPath, "utf8");
    if (IMPORT_RE.test(content)) {
      const fixed = content.replace(IMPORT_RE, INLINE_HELPER);
      fs.writeFileSync(fullPath, fixed, "utf8");
      patched++;
    }
  }
  return patched;
}

const patched = patchDir(distDir);
if (patched > 0) {
  process.stderr.write(`[fix-dist-circular] Patched ${patched} file(s)\n`);
}
