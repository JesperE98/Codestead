import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';

// base './' gör att den byggda sidan fungerar både på en webbserver
// och när Electron laddar den direkt från disk (file://).
export default defineConfig({
  base: './',
  plugins: [react()],
  test: {
    environment: 'node',
    exclude: ['**/node_modules/**', '**/dist/**', '.claude/**'],
  },
});
