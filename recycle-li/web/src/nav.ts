// 頁面跳轉規則：讓台北通的返回鍵、手機的返回手勢和畫面上的返回鍵走同一條路。
// - 「回到某頁」：上一頁就是它就真的回上一頁；不是就「取代」這一頁，不在歷史紀錄上越疊越長。
// - 底部選單是分頁：從家打開別的分頁會記一筆（回上一頁就回到家），分頁之間互切用取代。
// - 掃一掃、用選的只是過渡頁：認出東西後用取代進到「怎麼丟」，返回就直接回家。
import type { Router } from 'vue-router'

/** vue-router 在 history.state.back 記著上一頁的路徑 */
export function previousPath(): string | null {
  try {
    const back = (window.history.state as { back?: unknown } | null)?.back
    return typeof back === 'string' ? back : null
  } catch {
    return null
  }
}

/** 回到 target：上一頁就是它就 back()，否則取代目前這頁 */
export function goBackTo(router: Router, target: string): void {
  if (router.currentRoute.value.path === target) return
  if (previousPath() === target) router.back()
  else void router.replace(target)
}

/** 底部選單的分頁切換 */
export function switchTab(router: Router, target: string): void {
  const here = router.currentRoute.value.path
  if (here === target) return
  if (previousPath() === target) router.back()
  else if (here === '/') void router.push(target)
  else void router.replace(target)
}
