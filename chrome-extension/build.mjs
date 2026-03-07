/**
 * HomeLens Chrome Extension Build Script
 *
 * Builds 3 separate bundles:
 * 1. Popup (Vite — React app with HTML entry)
 * 2. Content script (esbuild — IIFE, no imports)
 * 3. Background service worker (esbuild — IIFE)
 *
 * Then copies static assets (manifest.json, icons) to dist/
 */

import { build as viteBuild } from 'vite';
import * as esbuild from 'esbuild';
import { cpSync, mkdirSync, existsSync, rmSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const distDir = resolve(__dirname, 'dist');
const isWatch = process.argv.includes('--watch');

async function buildAll() {
  console.log('🏗️  Building HomeLens Chrome Extension...\n');

  // Clean dist
  if (existsSync(distDir)) {
    rmSync(distDir, { recursive: true });
  }
  mkdirSync(distDir, { recursive: true });

  // 1. Build popup with Vite (React)
  console.log('📦 Building popup (Vite + React)...');
  await viteBuild({
    configFile: resolve(__dirname, 'vite.config.ts'),
    logLevel: 'warn',
  });

  // 2. Build content script with esbuild (IIFE)
  console.log('📦 Building content script (esbuild)...');
  await esbuild.build({
    entryPoints: [resolve(__dirname, 'content.ts')],
    bundle: true,
    format: 'iife',
    outfile: resolve(distDir, 'content.js'),
    target: 'chrome100',
    minify: !isWatch,
  });

  // 3. Build background service worker with esbuild (IIFE)
  console.log('📦 Building background worker (esbuild)...');
  await esbuild.build({
    entryPoints: [resolve(__dirname, 'background.ts')],
    bundle: true,
    format: 'iife',
    outfile: resolve(distDir, 'background.js'),
    target: 'chrome100',
    minify: !isWatch,
  });

  // 4. Copy static assets
  console.log('📁 Copying static assets...');
  cpSync(resolve(__dirname, 'manifest.json'), resolve(distDir, 'manifest.json'));

  if (existsSync(resolve(__dirname, 'icons'))) {
    cpSync(resolve(__dirname, 'icons'), resolve(distDir, 'icons'), { recursive: true });
  }

  console.log('\n✅ Build complete! Load chrome-extension/dist/ in chrome://extensions\n');
}

buildAll().catch((err) => {
  console.error('❌ Build failed:', err);
  process.exit(1);
});
