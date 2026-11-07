// 「認錯了」的修正：只存影像向量（512 個數字），不存照片；存在手機的 IndexedDB，不上傳。
// 每個品項最多留 MAX_PER_ITEM 個，最新的優先。
import { get, set } from 'idb-keyval'
import type { Protos } from './clip'

const KEY = 'recycle-li/protos/v1'
const MAX_PER_ITEM = 6
let cache: Protos | null = null

export async function loadLocalProtos(): Promise<Protos> {
  if (cache) return cache
  try { cache = ((await get(KEY)) as Protos) ?? {} } catch { cache = {} }
  return cache
}

export async function addLocalProto(itemId: string, vec: number[]) {
  const p = await loadLocalProtos()
  p[itemId] = [vec.map((x) => +x.toFixed(4)), ...(p[itemId] ?? [])].slice(0, MAX_PER_ITEM)
  try { await set(KEY, p) } catch { /* 無法儲存就只在這次有效 */ }
}

export async function clearLocalProtos() {
  cache = {}
  try { await set(KEY, {}) } catch { /* ignore */ }
}
