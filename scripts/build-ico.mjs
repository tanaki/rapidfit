import pngToIco from 'png-to-ico';
import { writeFileSync } from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const root = path.dirname(path.dirname(fileURLToPath(import.meta.url)));

const buf = await pngToIco([
  path.join(root, 'build', 'icon-16.png'),
  path.join(root, 'build', 'icon-32.png'),
  path.join(root, 'build', 'icon-48.png'),
  path.join(root, 'build', 'icon-64.png'),
  path.join(root, 'build', 'icon-128.png'),
  path.join(root, 'build', 'icon-256.png'),
]);

writeFileSync(path.join(root, 'build', 'icon.ico'), buf);
console.log('✓ build/icon.ico');
