// 從丟丟（大人版）切到兒童模式時，網址會帶 ?from=<丟丟的網址>；記下來，頂部狀態列就多一顆「回到丟丟」。
// 只接受本機、區網和丟丟的正式網址，避免被帶去別的網站。
const KEY = 'rl.back'

function allowed(u: URL): boolean {
  if (u.protocol !== 'http:' && u.protocol !== 'https:') return false
  const h = u.hostname
  return h === '127.0.0.1' || h === 'localhost' || h === 'taipei-trash-helper.web.app' ||
    h.startsWith('192.168.') || h.startsWith('10.') || /^172\.(1[6-9]|2\d|3[01])\./.test(h)
}

export function rememberBack(search = typeof location === 'undefined' ? '' : location.search): void {
  try {
    const from = new URLSearchParams(search).get('from')
    if (!from) return
    const u = new URL(from)
    if (allowed(u)) sessionStorage.setItem(KEY, u.href)
  } catch { /* 沒有 sessionStorage 或網址壞掉：就不顯示返回鈕 */ }
}

export function backToDiudiu(): string | null {
  try { return sessionStorage.getItem(KEY) } catch { return null }
}
