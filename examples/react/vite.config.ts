import { defineConfig } from 'vite';
import { fileURLToPath } from 'node:url';
import react from '@vitejs/plugin-react';
export default defineConfig({ root: fileURLToPath(new URL('./', import.meta.url)), plugins: [react()], build: { outDir: 'dist', emptyOutDir: true } });
