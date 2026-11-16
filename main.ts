/**
 * KOMETA: Starfall Courier — entry builder.
 *
 * Minimal build step: copies the self-contained game in `game/` into
 * `out/`, ready to be handed to the bounty harness. Uses only Node.js
 * built-ins (node:fs / node:path), Node 22.
 *
 * Run with a TypeScript runner or after compiling, e.g.:
 *   node --experimental-strip-types main.ts      (Node 22.6+)
 *   npx tsx main.ts
 *
 * Note: this file is intentionally simple — it will be reconciled with
 * the official bounty kit later. The game itself needs no build at all:
 * open game/index.html in a browser and it runs.
 */

import * as fs from "node:fs";
import * as path from "node:path";
import { fileURLToPath } from "node:url";

const root: string = path.dirname(fileURLToPath(import.meta.url));
const srcDir: string = path.join(root, "game");
const outDir: string = path.join(root, "out");

function main(): void {
  if (!fs.existsSync(srcDir)) {
    console.error(`error: source folder not found: ${srcDir}`);
    process.exit(1);
  }

  // Start from a clean output folder so stale files never leak in.
  fs.rmSync(outDir, { recursive: true, force: true });
  fs.mkdirSync(outDir, { recursive: true });

  // Copy the whole game/ tree (index.html, style.css, game.js).
  fs.cpSync(srcDir, outDir, { recursive: true });

  // Report what landed in out/.
  const files: string[] = [];
  const walk = (dir: string): void => {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) walk(full);
      else files.push(path.relative(outDir, full));
    }
  };
  walk(outDir);

  console.log(`KOMETA: copied ${files.length} file(s) from game/ to out/:`);
  for (const f of files) console.log(`  - ${f}`);
  console.log("Done. Open out/index.html in a desktop browser to play.");
}

main();
