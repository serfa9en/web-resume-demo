import { fileURLToPath, URL } from 'node:url'
import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import vueDevTools from 'vite-plugin-vue-devtools'
import { resumeHistoryPlugin } from './server/resume-history'

export default defineConfig({
  plugins: [vue(), vueDevTools(), resumeHistoryPlugin()],
  server: {
    host: '127.0.0.1',
    port: 5173,
    watch: { ignored: ['**/resume-data/**', '**/src/data/versions/**', '**/src/data/resumes/**'] },
    fs: {
      deny: ['.env', '.env.*', '*.{crt,pem}', '**/.git/**', '**/resume-data/**', '**/src/data/versions/**', '**/src/data/resumes/**'],
    },
  },
  preview: { host: '127.0.0.1' },
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
    },
  },
})
