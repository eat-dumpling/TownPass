// 里的插圖（2.5D 精靈圖）：src/assets/li/<id>.webp，大小記在 sizes.json（由 scripts/key-sprites 產生）。
// 有插圖就用插圖，沒有的用 models.ts 的向量模型。插圖是開發時用影像生成做的（見 README「插圖來源」），
// App 執行時不呼叫任何生成式 AI。
import sizes from '@/assets/li/sizes.json'

const urls = import.meta.glob('@/assets/li/*.webp', { eager: true, import: 'default' }) as Record<string, string>
const byId: Record<string, string> = {}
for (const [path, url] of Object.entries(urls)) byId[path.split('/').pop()!.replace('.webp', '')] = url

const ALIAS: Record<string, string> = { tree_s: 'tree', tree_y: 'tree' }

export function spriteOf(name: string): { url: string; w: number; h: number } | null {
  const id = ALIAS[name] ?? name
  const url = byId[id]
  const s = (sizes as Record<string, number[]>)[id]
  return url && s ? { url, w: s[0], h: s[1] } : null
}

/** 插圖在一格裡的寬度（1 = 一格寬） */
export const SPRITE_SCALE: Record<string, number> = {
  bench: 0.78, tree: 1.0, garden: 0.92, library: 1.0, bike_rack: 0.9, playground: 1.0, water_station: 0.78,
  windmill: 0.82, recycle_station: 1.0, treehouse: 1.1, lighthouse: 0.78,
  pine: 0.62, bush: 0.6, lamp: 0.3, house_red: 1.0, house_blue: 1.0, tree_s: 0.8, rock: 0.6, flowers_p: 0.5,
}
