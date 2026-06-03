/**
 * Génère les icônes Electron à partir de public/logo.svg
 * - build/icon.png (1024×1024) pour macOS + Linux
 * - build/icons/ (tailles multiples) pour electron-builder
 * Usage: node scripts/build-icons.mjs
 */

import { Resvg } from '@resvg/resvg-js';
import { readFileSync, writeFileSync, mkdirSync } from 'fs';
import { fileURLToPath } from 'url';
import path from 'path';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, '..');
const svgPath = path.join(root, 'public', 'logo.svg');
const svgData = readFileSync(svgPath, 'utf-8');

mkdirSync(path.join(root, 'build'), { recursive: true });

const sizes = [16, 32, 48, 64, 128, 256, 512, 1024];

for (const size of sizes) {
  const resvg = new Resvg(svgData, {
    fitTo: { mode: 'width', value: size },
  });
  const png = resvg.render().asPng();
  const outPath = path.join(root, 'build', `icon-${size}.png`);
  writeFileSync(outPath, png);
  console.log(`✓ ${outPath}`);
}

// Copie 1024px comme icon.png principal (electron-builder)
const resvg1024 = new Resvg(svgData, { fitTo: { mode: 'width', value: 1024 } });
writeFileSync(path.join(root, 'build', 'icon.png'), resvg1024.render().asPng());
console.log('✓ build/icon.png (1024px — utilisé par electron-builder)');
