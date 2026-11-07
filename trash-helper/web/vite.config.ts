import { fileURLToPath, URL } from 'node:url'
import { defineConfig } from 'vitest/config'
import vue from '@vitejs/plugin-vue'

// 共用程式：分類規則、辨識模組都直接用 recycle-li/web/src 的版本（唯讀），
// 所以 '@' 指向那裡（共用檔案內部也用 '@/...'），本 App 自己的程式用 '~'。
const shared = fileURLToPath(new URL('../../recycle-li/web/src', import.meta.url))

export default defineConfig({
  base: './',
  plugins: [vue()],
  resolve: { alias: { '@': shared, '~': fileURLToPath(new URL('./src', import.meta.url)) } },
  server: { host: true, port: 5174, fs: { allow: ['..', '../../recycle-li/web'] } },
  worker: { format: 'es' },
  build: { target: 'es2022', chunkSizeWarningLimit: 1500 },
  test: { environment: 'node', include: ['src/**/*.test.ts'] },
})
