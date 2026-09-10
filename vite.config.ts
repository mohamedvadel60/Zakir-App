import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import {defineConfig} from 'vite';

export default defineConfig(() => {
  const pubKey = (
    (process.env.VITE_STRIPE_PUBLISHABLE_KEY?.trim().startsWith('pk_') ? process.env.VITE_STRIPE_PUBLISHABLE_KEY.trim() : null) ||
    (process.env.VITE_STRIPE_PUBLIC_KEY?.trim().startsWith('pk_') ? process.env.VITE_STRIPE_PUBLIC_KEY.trim() : null) ||
    ''
  );

  return {
    base: './',
    define: {
      'import.meta.env.VITE_STRIPE_PUBLISHABLE_KEY': JSON.stringify(pubKey),
      'import.meta.env.VITE_STRIPE_PUBLIC_KEY': JSON.stringify(pubKey),
    },
    plugins: [react(), tailwindcss()],
    resolve: {
      alias: {
        '@': path.resolve(__dirname, '.'),
      },
    },
    server: {
      hmr: process.env.DISABLE_HMR === 'true' ? false : {
        clientPort: 443,
      },
      watch: {},
    },
    build: {
      chunkSizeWarningLimit: 1500,
      outDir: 'dist',
      rollupOptions: {
        output: {
          manualChunks(id) {
            if (id.includes('node_modules')) {
              if (id.includes('react/') || id.includes('react-dom/')) {
                return 'vendor-react';
              }
              if (id.includes('motion')) {
                return 'vendor-motion';
              }
              if (id.includes('recharts') || id.includes('d3-')) {
                return 'vendor-charts';
              }
              if (id.includes('firebase')) {
                return 'vendor-firebase';
              }
              if (id.includes('lucide-react')) {
                return 'vendor-icons';
              }
              if (id.includes('react-markdown')) {
                return 'vendor-markdown';
              }
            }
          }
        }
      }
    },
  };
});
