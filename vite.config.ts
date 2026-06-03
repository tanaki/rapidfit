import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import electron from 'vite-plugin-electron';
import renderer from 'vite-plugin-electron-renderer';
/// <reference types="vitest" />

const isElectron = process.env.ELECTRON === 'true';

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
                  sourcemap: true,
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
                  sourcemap: true,
                },
              },
            },
          ]),
          renderer(),
        ]
      : []),
  ],
  // Base '/' en mode Electron (fichiers locaux), '/rapidfit/' pour le déploiement web
  base: isElectron ? '/' : '/rapidfit/',
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: ['./src/test/setup.ts'],
  },
});
