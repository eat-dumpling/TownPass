import { existsSync, readFileSync } from 'node:fs'
import { fileURLToPath, URL } from 'node:url'
import { defineConfig } from 'vitest/config'
import vue from '@vitejs/plugin-vue'

// 實機測試（iPhone、iPad）：相機只在 https 能用，用 `npm run dev:https` 開自簽憑證的開發伺服器。
// 憑證放 .cert/（不進 git），台北通的除錯版只信任區網位址的自簽憑證（lib/util/tp_web_view.dart）。
const https = process.env.VITE_HTTPS === '1' && existsSync('.cert/dev-key.pem')
  ? { key: readFileSync('.cert/dev-key.pem'), cert: readFileSync('.cert/dev-cert.pem') }
  : undefined

// base './'：讓 build 後的檔案可以放在 Firebase Hosting 根目錄或任何子路徑。
export default defineConfig({
  base: './',
  plugins: [vue()],
  resolve: { alias: { '@': fileURLToPath(new URL('./src', import.meta.url)) } },
  server: { host: true, port: https ? 5443 : 5173, https },
  worker: { format: 'es' },
  build: { target: 'es2022', chunkSizeWarningLimit: 1500 },
  test: {
    environment: 'node',
    include: ['src/**/*.test.ts'],
  },
})
