// 預先載入辨識模型：App 一打開、首頁畫好之後就在背景載（影像模型在 Web Worker 裡，不卡畫面），
// 孩子按「掃描」時多半已經載好，不用等。loadClip／loadDetector 都會記住同一個載入中的 Promise，掃描頁直接接手。
//
// - 省流量模式（navigator.connection.saveData）不預先載，等進掃描頁再載。
// - 網路斷掉載失敗會再試兩次（2 秒、4 秒後）；還是失敗就留給掃描頁（它會顯示錯誤，可以重新進來再試）。
// - 請瀏覽器把快取當成「要保留的資料」（navigator.storage.persist），手機空間不夠時比較不會先清掉模型（約 130 MB）。
import { loadClip } from './clip'
import { loadDetector } from './detector'

let started = false

async function retry<T>(fn: () => Promise<T>, times: number): Promise<T> {
  for (let i = 0; ; i++) {
    try { return await fn() } catch (e) {
      if (i >= times) throw e
      await new Promise((ok) => setTimeout(ok, 2000 * (i + 1)))
    }
  }
}

export function preloadVision() {
  if (started || typeof window === 'undefined') return
  started = true
  const conn = (navigator as Navigator & { connection?: { saveData?: boolean } }).connection
  if (conn?.saveData) return
  navigator.storage?.persist?.().catch(() => {})
  const start = () => {
    // 偵測器小（約 15 MB 含 wasm）先載；影像模型（約 115 MB 含 wasm）在 Worker 裡載
    retry(() => loadDetector('efficientdet_lite0'), 2).catch((e) => console.warn('[preload] detector', e))
    retry(() => loadClip(), 2).catch((e) => console.warn('[preload] model', e))
  }
  const ric = (window as Window & { requestIdleCallback?: (cb: () => void, o?: { timeout: number }) => void }).requestIdleCallback
  if (ric) ric(start, { timeout: 3000 })
  else setTimeout(start, 1500)
}
