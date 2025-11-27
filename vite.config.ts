import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  build: {
    rollupOptions: {
      output: {
        manualChunks: {
          // Separate vendor chunks
          'react-vendor': ['react', 'react-dom'],
          'react-window': ['react-window'],
        },
      },
    },
    // Optimize chunk size
    chunkSizeWarningLimit: 200,
  },
})
