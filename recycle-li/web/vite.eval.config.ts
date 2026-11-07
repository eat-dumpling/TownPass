// 完整流程驗證用的建置（不會出現在正式版）：多建一個 eval.html，並把驗證照片（../testdata/hand，不進 git）複製到 dist-eval/_eval。
// 用法：npx vite build -c vite.eval.config.ts && npx vite preview -c vite.eval.config.ts → 開 http://localhost:4174/eval.html
// 用 preview（沒有熱更新）跑，避免其他人改檔案時頁面重新載入。
import { cpSync, existsSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { mergeConfig, type Plugin } from 'vite'
import base from './vite.config'

const copyEvalPhotos = (): Plugin => ({
  name: 'copy-eval-photos',
  closeBundle() {
    const src = '../testdata/hand'
    if (!existsSync(`${src}/manifest.json`)) return console.warn('沒有 ../testdata/hand：先跑 node scripts/fetch-commons.mjs --set hand')
    rmSync('dist-eval/_eval', { recursive: true, force: true }) // 搜錯被刪掉的照片不要留在舊的副本裡
    cpSync(src, 'dist-eval/_eval', { recursive: true })
    const m = JSON.parse(readFileSync(`${src}/manifest.json`, 'utf8')) as { file: string; item: string; title: string }[]
    writeFileSync('dist-eval/_eval/manifest.json', JSON.stringify(m.map(({ file, item, title }) => ({ file, item, title }))))
  },
})

export default mergeConfig(base, {
  plugins: [copyEvalPhotos()],
  build: { outDir: 'dist-eval', rollupOptions: { input: { eval: 'eval.html', review: 'review.html', speed: 'speed.html' } } }, // 不建 App 本身：別人改到一半的畫面不影響驗證
  // COOP/COEP：讓頁面 crossOriginIsolated，WASM 才能開多執行緒（speed.html 測）
  preview: { port: 4174, strictPort: true, headers: { 'Cross-Origin-Opener-Policy': 'same-origin', 'Cross-Origin-Embedder-Policy': 'require-corp' } },
})
