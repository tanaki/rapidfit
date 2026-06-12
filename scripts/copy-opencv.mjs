import { copyFileSync, existsSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const src  = resolve(__dirname, '../node_modules/@techstark/opencv-js/dist/opencv.js');
const dest = resolve(__dirname, '../public/opencv.js');

if (!existsSync(src)) {
  console.error('opencv.js introuvable dans node_modules — lancez npm install');
  process.exit(1);
}
copyFileSync(src, dest);
console.log('opencv.js copié dans public/');
