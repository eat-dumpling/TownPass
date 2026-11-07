// 下載 TACO（Trash Annotations in Context，CC BY 4.0）的 640px 縮圖，裁出每個標註框，給 CLIP 調參與範例向量用。
// TACO：http://tacodataset.org ，Proença & Simões (2020) arXiv:2003.06975 ，授權 CC BY 4.0。
// 照片不進 git（testdata/taco/ 在 .gitignore），App 只發布由照片算出的向量，README 註明出處。
//
// 輸出：../testdata/taco/crops/<類別>/<image>_<ann>.jpg ＋ crops.json（每張裁切對應可接受的品項）
// 用法：node scripts/fetch-taco.mjs   （先下載 annotations.json，見 testdata/README）
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { join, resolve } from 'node:path'
import sharp from 'sharp'

const ROOT = resolve('../testdata/taco')
const UA = 'recycle-li-tuning/0.1 (https://codefest.taipei/2026-fall; hackathon research)'
const MIN_SIDE = 56 // 在 640px 縮圖上，框的短邊至少這麼大才用

// TACO 類別 → 可接受的品項 id。模糊或太小的類別不用（瓶蓋、拉環、菸蒂、未標示、塑膠膜、垃圾袋、鋁箔…）
export const MAP = {
  'Battery': ['battery'],
  'Carded blister pack': ['pudding_cup', 'plastic_misc'],
  'Other plastic bottle': ['plastic_misc', 'pet_bottle'],
  'Clear plastic bottle': ['pet_bottle'],
  'Glass bottle': ['glass_bottle'],
  'Broken glass': ['broken_glass'],
  'Food Can': ['aluminum_can'],
  'Aerosol': ['spray_can', 'pesticide_container'],
  'Drink can': ['aluminum_can'],
  'Toilet tube': ['newspaper', 'copy_paper'],
  'Other carton': ['newspaper', 'tetra_pak'],
  'Egg carton': ['newspaper'],
  'Drink carton': ['tetra_pak'],
  'Corrugated carton': ['newspaper'],
  'Meal carton': ['paper_lunchbox'],
  'Pizza box': ['newspaper', 'paper_lunchbox'],
  'Paper cup': ['paper_cup'],
  'Disposable plastic cup': ['bubble_tea_cup', 'pudding_cup'],
  'Foam cup': ['foam_tableware'],
  'Glass cup': ['glass_bottle'],
  'Other plastic cup': ['bubble_tea_cup', 'pudding_cup', 'plastic_misc'],
  'Food waste': ['leftovers', 'fruit_peel', 'vegetables', 'meat', 'food_shells'],
  'Glass jar': ['glass_bottle'],
  'Plastic lid': ['plastic_misc', 'pudding_cup'],
  'Metal lid': ['metal_utensils', 'aluminum_can'],
  'Magazine paper': ['magazine', 'newspaper'],
  'Tissues': ['tissue'],
  'Normal paper': ['copy_paper', 'newspaper'],
  'Paper bag': ['paper_bag'],
  'Six pack rings': ['plastic_misc'],
  'Other plastic wrapper': ['snack_bag'],
  'Single-use carrier bag': ['plastic_bag_clean', 'plastic_bag_dirty'],
  'Polypropylene bag': ['plastic_bag_clean'],
  'Crisp packet': ['snack_bag'],
  'Spread tub': ['pudding_cup', 'plastic_misc'],
  'Tupperware': ['plastic_misc', 'pudding_cup'],
  'Disposable food container': ['pudding_cup', 'plastic_misc', 'foam_tableware'],
  'Foam food container': ['foam_tableware', 'styrofoam_clean', 'styrofoam_dirty'],
  'Other plastic container': ['plastic_misc', 'pudding_cup'],
  'Plastic utensils': ['plastic_misc'],
  'Scrap metal': ['metal_utensils'],
  'Shoe': ['old_shoes'],
  'Squeezable tube': ['plastic_misc'],
  'Plastic straw': ['chopsticks'],
  'Styrofoam piece': ['styrofoam_clean', 'styrofoam_dirty'],
}

if (process.argv[1]?.endsWith('fetch-taco.mjs')) {
  const ann = JSON.parse(readFileSync(join(ROOT, 'annotations.json'), 'utf8'))
  const cats = Object.fromEntries(ann.categories.map((c) => [c.id, c.name]))
  const imgs = Object.fromEntries(ann.images.map((i) => [i.id, i]))
  const byImg = new Map()
  for (const a of ann.annotations) {
    const name = cats[a.category_id]
    if (!MAP[name]) continue
    const im = imgs[a.image_id]
    const s = 640 / Math.max(im.width, im.height)
    const [x, y, w, h] = a.bbox.map((v) => v * s)
    if (Math.min(w, h) < MIN_SIDE) continue
    if (!byImg.has(im.id)) byImg.set(im.id, [])
    byImg.get(im.id).push({ id: a.id, name, x, y, w, h })
  }
  const todo = [...byImg.entries()]
  console.log(`${todo.length} 張圖有可用的框，共 ${todo.reduce((s, [, v]) => s + v.length, 0)} 個框`)
  const out = []
  const get = async (url) => {
    for (let k = 0; k < 3; k++) {
      try {
        const r = await fetch(url, { headers: { 'User-Agent': UA } })
        if (r.ok) return Buffer.from(await r.arrayBuffer())
      } catch { /* retry */ }
      await new Promise((ok) => setTimeout(ok, 1000 * (k + 1)))
    }
    return null
  }
  let done = 0
  const worker = async () => {
    while (todo.length) {
      const [iid, anns] = todo.shift()
      const im = imgs[iid]
      const cacheFile = join(ROOT, 'thumbs', `${iid}.jpg`)
      let buf = existsSync(cacheFile) ? readFileSync(cacheFile) : await get(im.flickr_640_url)
      if (!buf) continue
      if (!existsSync(cacheFile)) { mkdirSync(join(ROOT, 'thumbs'), { recursive: true }); writeFileSync(cacheFile, buf) }
      // EXIF 方向轉正，尺寸以實際縮圖為準
      const img = sharp(buf).rotate()
      const meta = await img.metadata()
      const W = meta.autoOrient?.width ?? meta.width, H = meta.autoOrient?.height ?? meta.height
      const rot = await img.toBuffer()
      const sx0 = W / (640 * im.width / Math.max(im.width, im.height))
      for (const a of anns) {
        const x = a.x * sx0, y = a.y * sx0, w = a.w * sx0, h = a.h * sx0
        // 和 App 一樣：框外擴 12% 成正方形
        const side = Math.floor(Math.min(Math.max(w, h) * 1.24, W, H))
        const cx = x + w / 2, cy = y + h / 2
        const left = Math.floor(Math.min(Math.max(0, cx - side / 2), W - side))
        const top = Math.floor(Math.min(Math.max(0, cy - side / 2), H - side))
        const folder = join(ROOT, 'crops', a.name.replace(/[^A-Za-z]+/g, '_'))
        mkdirSync(folder, { recursive: true })
        const file = join(folder, `${iid}_${a.id}.jpg`)
        try {
          await sharp(rot).extract({ left, top, width: side, height: side }).resize(224, 224).jpeg({ quality: 90 }).toFile(file)
          out.push({ file: file.slice(ROOT.length + 1), taco: a.name, accept: MAP[a.name], image: iid })
        } catch (e) { console.warn('crop fail', iid, a.id, e.message) }
      }
      if (++done % 100 === 0) console.log(done, out.length)
    }
  }
  await Promise.all(Array.from({ length: 8 }, worker))
  writeFileSync(join(ROOT, 'crops.json'), JSON.stringify(out))
  console.log(`wrote ${out.length} crops → ${join(ROOT, 'crops.json')}`)
}
