import {defineConfig} from 'vitest/config';
import react from '@vitejs/plugin-react';
import {fileURLToPath} from 'node:url';
export default defineConfig({root:fileURLToPath(new URL('./apps/web',import.meta.url)),base:'/',plugins:[react()],build:{outDir:fileURLToPath(new URL('./dist',import.meta.url)),emptyOutDir:true},test:{root:fileURLToPath(new URL('./',import.meta.url)),include:['tests/**/*.test.ts'],environment:'node'}});
