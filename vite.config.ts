import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// GitHub Pages project sites are served from /<repository>/.
// Set VITE_BASE in the deployment workflow; local development stays at /.
const base = process.env.VITE_BASE || '/';

export default defineConfig(({ command }) => ({
  base,
  plugins: [
    react(),
    {
      name: 'production-csp',
      transformIndexHtml(html) {
        if (command !== 'build') return html;
        const csp = [
          "default-src 'self'",
          "script-src 'self'",
          "style-src 'self' 'unsafe-inline'",
          "img-src 'self' data:",
          "font-src 'self' data:",
          "connect-src 'self'",
          "object-src 'none'",
          "base-uri 'self'",
          "form-action 'none'",
        ].join('; ');
        return html.replace(
          '<head>',
          `<head>\n    <meta http-equiv="Content-Security-Policy" content="${csp}" />`,
        );
      },
    },
  ],
  build: {
    sourcemap: false,
    chunkSizeWarningLimit: 900,
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (id.includes('node_modules/echarts') || id.includes('node_modules/zrender')) {
            return 'charts';
          }
          if (
            id.includes('node_modules/react') ||
            id.includes('node_modules/scheduler') ||
            id.includes('node_modules/react-router')
          ) {
            return 'react-vendor';
          }
          return undefined;
        },
      },
    },
  },
}));
