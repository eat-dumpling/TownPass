// 掃描用到的 Tabler 圖示（本 App 的 src ＋ 共用的分類資料），產生 src/components/icons.gen.ts。
import { readFileSync, readdirSync, statSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import * as tabler from '@tabler/icons-vue'

const files = []
const walk = (d) => { for (const f of readdirSync(d)) { const p = join(d, f); if (statSync(p).isDirectory()) walk(p); else if (/\.(ts|vue|json)$/.test(f) && !f.endsWith('.gen.ts')) files.push(p) } }
walk('src')
const S = '../../recycle-li/web/src'
files.push(`${S}/domain/catalog.ts`, `${S}/data/items.json`, `${S}/data/groups.json`, `${S}/data/questions.json`)
const names = new Set()
for (const f of files) {
  const s = readFileSync(f, 'utf8')
  for (const m of s.matchAll(/icon["']?\s*:\s*["']([A-Z][A-Za-z0-9]+)["']/g)) names.add(m[1])
  for (const m of s.matchAll(/<AppIcon[^>]*?\sname="([A-Z][A-Za-z0-9]+)"/g)) names.add(m[1])
}
// 本 App 自己的程式：任何引號內、而且是真的 Tabler 圖示名稱的字串都收（涵蓋 :name="cond ? 'A' : 'B'" 這種寫法）
for (const f of files.filter((x) => x.startsWith('src'))) {
  for (const m of readFileSync(f, 'utf8').matchAll(/'([A-Z][A-Za-z0-9]+)'/g)) if (tabler['Icon' + m[1]]) names.add(m[1])
}
names.add('QuestionMark')
const list = [...names].sort()
const missing = list.filter((n) => !tabler['Icon' + n])
if (missing.length) { console.error('找不到這些 Tabler 圖示：', missing.join(', ')); process.exit(1) }
writeFileSync('src/components/icons.gen.ts',
  `// 由 scripts/gen-icons.mjs 產生，請勿手動修改。Tabler Icons（MIT）\nimport { ${list.map((n) => 'Icon' + n).join(', ')} } from '@tabler/icons-vue'\n\nexport const icons = { ${list.map((n) => `${n}: Icon${n}`).join(', ')} } as const\n`)
console.log(`icons.gen.ts：${list.length} 個圖示`)
