// 掃描 src 裡用到的 Tabler 圖示名稱，產生 src/components/icons.gen.ts（只打包用到的圖示）。
// 寫法：JSON／TS 的 icon: 'Name'，或 Vue 範本的 <AppIcon name="Name" />。名稱不存在會直接失敗。
import { readFileSync, readdirSync, statSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import * as tabler from '@tabler/icons-vue'

const files = []
const walk = (d) => { for (const f of readdirSync(d)) { const p = join(d, f); if (statSync(p).isDirectory()) { if (f !== 'paused') walk(p) } else if (/\.(ts|vue|json)$/.test(f) && !f.endsWith('.gen.ts')) files.push(p) } }
walk('src')
const names = new Set()
for (const f of files) {
  const s = readFileSync(f, 'utf8')
  for (const m of s.matchAll(/icon["']?\s*:\s*["']([A-Z][A-Za-z0-9]+)["']/g)) names.add(m[1])
  for (const m of s.matchAll(/<AppIcon[^>]*?\sname="([A-Z][A-Za-z0-9]+)"/g)) names.add(m[1])
  for (const m of s.matchAll(/ICON\(['"]([A-Z][A-Za-z0-9]+)['"]\)/g)) names.add(m[1])
}
const list = [...names].sort()
const missing = list.filter((n) => !tabler['Icon' + n])
if (missing.length) { console.error('找不到這些 Tabler 圖示：', missing.join(', ')); process.exit(1) }
writeFileSync('src/components/icons.gen.ts',
  `// 由 scripts/gen-icons.mjs 產生，請勿手動修改。Tabler Icons（MIT）\nimport { ${list.map((n) => 'Icon' + n).join(', ')} } from '@tabler/icons-vue'\n\nexport const icons = { ${list.map((n) => `${n}: Icon${n}`).join(', ')} } as const\n`)
console.log(`icons.gen.ts：${list.length} 個圖示`)
