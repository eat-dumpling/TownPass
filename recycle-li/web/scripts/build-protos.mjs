// 把開發組拍的訓練照片算成「範例向量」（每張照片 → 512 個數字），輸出 public/data/image_protos.json。
// 手機辨識時，和範例很像的畫面會加分（Tip-Adapter 式），比只靠文字描述準很多。只發布向量，不發布照片。
// 用法：node scripts/build-protos.mjs [照片資料夾，預設 ../testdata/train]
// 訓練照與測試照（../testdata/photos）要分開，否則 eval-photos.mjs 的準確率會虛高。
// 注意：這會覆蓋 scripts/tune.mjs 產生的 image_protos.json（TACO＋Commons）；要兩者都用，把自拍照放進 tune 的資料集。
import { readdirSync, readFileSync, writeFileSync, existsSync } from 'node:fs'
import { join, resolve } from 'node:path'
import { AutoImageProcessor, CLIPVisionModelWithProjection, RawImage, env } from '@huggingface/transformers'
import { encodeProto } from './proto-codec.mjs'

const dir = resolve(process.argv[2] ?? '../testdata/train')
const items = JSON.parse(readFileSync('src/data/items.json', 'utf8'))
const ids = items.map((i) => i.id).sort((a, b) => b.length - a.length)
const files = existsSync(dir) ? readdirSync(dir).filter((f) => /\.(jpe?g|png|webp)$/i.test(f)).sort() : []
if (!files.length) { console.error(`${dir} 裡沒有照片（檔名開頭寫品項 id）`); process.exit(1) }

env.allowRemoteModels = false
env.localModelPath = resolve('public/models') + '/'
const MODEL = 'Xenova/clip-vit-base-patch32'
const processor = await AutoImageProcessor.from_pretrained(MODEL)
const model = await CLIPVisionModelWithProjection.from_pretrained(MODEL, { dtype: 'q8' })
const norm = (v) => { let s = 0; for (const x of v) s += x * x; const n = Math.sqrt(s) || 1; return Array.from(v, (x) => x / n) }

const out = { version: 2, model: MODEL, dtype: 'q8', dim: 512, encoding: 'int8-base64', source: '開發組自拍照片', items: {} }
for (const f of files) {
  const id = ids.find((x) => f.toLowerCase().startsWith(x))
  if (!id) { console.warn('skip（檔名不是品項 id 開頭）', f); continue }
  const { image_embeds } = await model(await processor(await RawImage.read(join(dir, f))))
  ;(out.items[id] ??= []).push(encodeProto(norm(image_embeds.data)))
  console.log(id, f)
}
writeFileSync('public/data/image_protos.json', JSON.stringify(out))
console.log(`wrote public/data/image_protos.json（${Object.keys(out.items).length} 個品項）`)
