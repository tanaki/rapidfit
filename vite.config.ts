import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
import electron from 'vite-plugin-electron';
import renderer from 'vite-plugin-electron-renderer';
import { readFileSync, existsSync } from 'fs';

const isElectron = process.env.ELECTRON === 'true';
const { version } = JSON.parse(readFileSync('./package.json', 'utf-8'));

// Charge .env.local pour les builds locaux (le CI injecte via secrets)
if (existsSync('.env.local')) {
  for (const line of readFileSync('.env.local', 'utf-8').split('\n')) {
    const m = line.match(/^\s*([A-Z_][A-Z0-9_]*)=(.*)$/);
    if (m && !process.env[m[1]]) process.env[m[1]] = m[2].trim();
  }
}

export default defineConfig({
  plugins: [
    react(),
    ...(isElectron
      ? [
          electron([
            {
              entry: 'electron/main.ts',
              vite: {
                build: {
                  outDir: 'dist-electron',
                  sourcemap: false,
                },
                define: {
                  // Injected at build time by CI (GH_UPDATE_TOKEN secret).
                  // Read-only fine-grained PAT so the packaged app can fetch
                  // latest-mac.yml and update assets from the private repo.
                  __GH_UPDATE_TOKEN__: JSON.stringify(process.env.GH_UPDATE_TOKEN ?? ''),
                },
              },
            },
            {
              entry: 'electron/preload.ts',
              onstart(options) {
                options.reload();
              },
              vite: {
                build: {
                  outDir: 'dist-electron',
                  sourcemap: false,
                  lib: {
                    entry: 'electron/preload.ts',
                    formats: ['cjs'],
                    fileName: () => 'preload.js',
                  },
                },
              },
            },
          ]),
          renderer(),
        ]
      : []),
  ],
  // './' en mode Electron : les assets sont chargés en chemin relatif à index.html
  // via file://, donc '/' pointerait vers la racine du filesystem. '/rapidfit/'
  // pour le déploiement web GitHub Pages.
  define: {
    __APP_VERSION__: JSON.stringify(version),
  },
  base: isElectron ? './' : '/rapidfit/',
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: ['./src/test/setup.ts'],
    typecheck: { tsconfig: './tsconfig.test.json' },
  },
});
