import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  root: 'example',
  publicDir: 'example/public',
  build: {
    outDir: 'dist',
    sourcemap: true
  }
}); 