#!/usr/bin/env node
/**
 * Postinstall script: Sync scanic UMD build from node_modules to public/
 * This allows script-tag loading while keeping npm as the version source of truth.
 */
import { copyFileSync, existsSync, mkdirSync } from 'fs';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, '..');

const source = join(root, 'node_modules', 'scanic', 'dist', 'scanic.umd.cjs');
const destDir = join(root, 'public', 'scanic');
const dest = join(destDir, 'scanic.umd.cjs');

if (!existsSync(source)) {
  console.error('[sync-scanic] Error: scanic not found in node_modules. Run npm install first.');
  process.exit(1);
}

if (!existsSync(destDir)) {
  mkdirSync(destDir, { recursive: true });
}

copyFileSync(source, dest);
console.log(`[sync-scanic] Copied scanic.umd.cjs → public/scanic/ (${new Date().toISOString()})`);
