import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
import electron from 'vite-plugin-electron';
import renderer from 'vite-plugin-electron-renderer';
import { readFileSync } from 'fs';

const isElectron = process.env.ELECTRON === 'true';
const { version } = JSON.parse(readFileSync('./package.json', 'utf-8'));

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
