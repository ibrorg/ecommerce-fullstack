import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  // relative base so the built files work behind any reverse proxy path
  base: './',
  server: {
    proxy: {
      '/api': {
        target: 'http://localhost:5000',
        changeOrigin: true,
        secure: false
      }
    }
  },
  build: {
    // split vendor code into stable chunks so the app code churns less
    // between deploys and the main entry stays small.
    rollupOptions: {
      output: {
        manualChunks: {
          // react + react-dom + scheduler — the core runtime
          'react-vendor': ['react', 'react-dom'],
          // router + redux + middleware — state + navigation
          'app-vendor': ['react-router-dom', '@reduxjs/toolkit', 'react-redux', 'axios'],
          // icon set is large; isolate it so it caches independently
          'icons': ['react-icons/fi'],
        }
      }
    },
    // increase the inline limit slightly so tiny chunks don't proliferate
    chunkSizeWarningLimit: 600,
  }
})
