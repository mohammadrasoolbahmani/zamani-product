import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'

// هدف پروکسی از .env.local قابل تغییر است؛ پیش‌فرض 8000 می‌ماند.
// نمونه: VITE_PROXY_TARGET=http://127.0.0.1:8001
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '')
  const target = env.VITE_PROXY_TARGET || 'http://127.0.0.1:8000'
  const proxy = {
    '/api': { target, changeOrigin: true },
    '/media': { target, changeOrigin: true },
  }

  return {
    plugins: [react()],
    server: {
      host: '127.0.0.1',
      port: 5173,
      strictPort: true,
      proxy,
    },
    preview: {
      host: '127.0.0.1',
      port: 4173,
      strictPort: true,
      proxy,
    },
    build: {
      outDir: 'dist',
      sourcemap: false,
    },
  }
})
