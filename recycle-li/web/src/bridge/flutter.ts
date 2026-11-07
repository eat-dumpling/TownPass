// 與台北通 App 的雙向溝通（對應官方 Vue 範例的 useConnectionMessage / useHandleConnectionData）。
// 網頁 → App：window.flutterObject.postMessage(JSON.stringify({ name, data }))
// App → 網頁：flutterObject 的 'message' 事件，event.data 是 JSON 字串 { name, data }
// 一般瀏覽器沒有 flutterObject，改用 mockFlutter 回傳假資料（入門指引第 03 章建議）。

export interface FlutterObject {
  postMessage(msg: string): void
  addEventListener(type: 'message', cb: (e: MessageEvent<string>) => void): void
  removeEventListener(type: 'message', cb: (e: MessageEvent<string>) => void): void
}

declare global {
  interface Window { flutterObject?: FlutterObject }
}

export const inTownPass = () => typeof window !== 'undefined' && !!window.flutterObject

// ── 模擬的 flutterObject（只在一般瀏覽器使用） ─────────────────────────
// 預設位置：天母附近（模擬資料的停靠點所在處）
const MOCK_POSITION = { latitude: 25.1185, longitude: 121.5296, accuracy: 15 }

function mockReply(name: string, data: unknown): unknown {
  switch (name) {
    case 'location': return MOCK_POSITION
    case 'userinfo': return { username: 'demo', realName: '測試家長', citizen: true }
    case 'notify': console.info('[mockFlutter] notify', data); return true
    case 'schedule_notify': console.info('[mockFlutter] schedule_notify', data); return true
    case 'cancel_notify': console.info('[mockFlutter] cancel_notify', data); return true
    case 'open_link': window.open(String(data), '_blank', 'noopener'); return true
    default: return null
  }
}

/** 呼叫 App 能力並等待回覆；逾時回傳 null（例如舊版 App 沒有自訂 Handler） */
export function callApp<T = unknown>(name: string, data: unknown = null, timeoutMs = 8000): Promise<T | null> {
  if (!inTownPass()) return Promise.resolve(mockReply(name, data) as T)
  const fo = window.flutterObject!
  return new Promise((resolve) => {
    const timer = window.setTimeout(() => { fo.removeEventListener('message', onReply); resolve(null) }, timeoutMs)
    function onReply(e: MessageEvent<string>) {
      try {
        const msg = JSON.parse(e.data) as { name: string; data: T }
        if (msg.name !== name) return
        window.clearTimeout(timer)
        fo.removeEventListener('message', onReply) // 用完就移除，避免重複觸發
        resolve(msg.data)
      } catch { /* 不是給我們的訊息 */ }
    }
    fo.addEventListener('message', onReply)
    fo.postMessage(JSON.stringify({ name, data }))
  })
}

/** 只發送、不等回覆（notify 這類內建 Handler 不一定回覆） */
export function sendApp(name: string, data: unknown = null) {
  if (!inTownPass()) { mockReply(name, data); return }
  window.flutterObject!.postMessage(JSON.stringify({ name, data }))
}

// ── 封裝好的能力 ────────────────────────────────────────────────
export interface Position { latitude: number; longitude: number; accuracy?: number }

/** 定位一次；台北通沒有權限時回傳空陣列，這裡統一轉成 null */
export async function getLocation(): Promise<Position | null> {
  const r = await callApp<Position | unknown[]>('location')
  if (!r || Array.isArray(r)) return null
  return r as Position
}

export interface ScheduleNotify { id: number; title: string; content: string; at: string /* ISO-8601 含 +08:00 */ }

/** 自訂 Handler：今晚停靠前提醒。App 沒有這個 Handler（逾時）時退回立即通知。 */
export async function scheduleNotify(n: ScheduleNotify): Promise<boolean> {
  const ok = await callApp<boolean>('schedule_notify', n, 3000)
  if (ok === null) { sendApp('notify', { title: n.title, content: n.content }); return false }
  return ok
}
export const cancelNotify = (id: number) => callApp<boolean>('cancel_notify', { id }, 3000)
export const openLink = (url: string) => sendApp('open_link', url)
