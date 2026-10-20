import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// GitHub Pages project sites are served from /<repository>/.
// Set VITE_BASE in the deployment workflow; local development stays at /.
const base = process.env.VITE_BASE || '/';

export default defineConfig({
  base,
  plugins: [react()],
  build: {
    sourcemap: false,
    chunkSizeWarningLimit: 900,
  },
});
