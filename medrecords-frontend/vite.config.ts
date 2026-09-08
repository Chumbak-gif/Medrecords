import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@/shared': path.resolve(__dirname, './src/shared'),
      '@/core': path.resolve(__dirname, './src/core'),
      '@/features': path.resolve(__dirname, './src/features'),
      '@/app': path.resolve(__dirname, './src/app'),
    },
  },
  server: {
    // public/config.js sets apiUrl to the same-origin path "/api/v1" (mirrors
    // the production nginx proxy). Proxy it here too so dev behaves the same
    // way without needing a separate dev-only config.
    proxy: {
      '/api': {
        target: 'http://localhost:8000',
        changeOrigin: true,
      },
    },
  },
  build: {
    // Enable minification for production bundles
    minify: 'esbuild',
    // Tree-shaking is enabled by default with Rollup
    rollupOptions: {
      output: {
        // Content-hash filenames for cache busting (Requirement 10.6)
        entryFileNames: 'assets/[name]-[hash].js',
        chunkFileNames: 'assets/[name]-[hash].js',
        assetFileNames: 'assets/[name]-[hash].[ext]',
        // Manual chunk splitting (Requirement 10.1, 10.4, 10.6)
        manualChunks: {
          vendor: ['react', 'react-dom', 'react-router-dom'],
          ui: ['dompurify'],
          state: ['@reduxjs/toolkit', 'react-redux', '@tanstack/react-query'],
        },
      },
    },
    // Generate source maps for debugging
    sourcemap: true,
    // Target modern browsers for smaller bundles
    target: 'es2020',
    // Report compressed sizes
    reportCompressedSize: true,
  },
});
