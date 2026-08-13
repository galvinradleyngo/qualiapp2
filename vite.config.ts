import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { viteSingleFile } from 'vite-plugin-singlefile';

// Production builds are bundled into one self-contained dist/index.html —
// no server, no install, just open the file in a browser.
export default defineConfig(({ mode }) => ({
  plugins: [react(), ...(mode === 'production' ? [viteSingleFile()] : [])],
  build: {
    assetsInlineLimit: 100_000_000,
    cssCodeSplit: false,
    chunkSizeWarningLimit: 100_000_000,
  },
}));
