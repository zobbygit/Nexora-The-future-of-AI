import react from '@vitejs/plugin-react';
import path from 'path';
import { defineConfig, loadEnv } from 'vite';

export default defineConfig(({ mode }) => {
  // On Vercel, API calls go straight to the Render API. If VITE_API_URL is missing, every /api request would hit the
  // SPA fallback and the app would look "broken" — fail the build loudly instead.
  const env = loadEnv(mode, process.cwd(), '');
  const apiUrl = process.env.VITE_API_URL ?? env.VITE_API_URL ?? '';
  if (mode === 'production' && process.env.VERCEL && !/^https:\/\/[^/]+/.test(apiUrl)) {
    throw new Error('VITE_API_URL is missing or not an https URL. In Vercel → Settings → Environment Variables set VITE_API_URL=https://<your-render-service>.onrender.com (no trailing slash) and redeploy.');
  }
  return {
  plugins: [react()],
  resolve: { alias: { '@': path.resolve(__dirname, 'src') } },
  server: {
    port: 5173,
    proxy: { '/api': { target: 'http://localhost:5000', changeOrigin: true }, '/socket.io': { target: 'http://localhost:5000', ws: true } },
  },
  build: {
    sourcemap: false,
    rollupOptions: {
      output: { manualChunks: { react: ['react', 'react-dom', 'react-router-dom'], motion: ['framer-motion'], charts: ['recharts'], md: ['react-markdown', 'remark-gfm'] } },
    },
  },
  };
});