// 下載臺北市垃圾車點位路線資訊（data.taipei，政府資料開放授權條款第 1 版），輸出精簡版 public/data/stops.json。
// 欄位：行政區、里別、路線、車次、抵達時間、離開時間、地點、經度、緯度（共 4,012 筆，2026-11-02 匯入版）。
// 注意：資料沒有「星期幾」欄位；臺北市週三、週日停收，其他日子依表定時間。這是排定時間，不是垃圾車即時位置。
import { writeFileSync } from 'node:fs'

const RID = 'a6e90031-7ec4-4089-afb5-361a4efe7202'
const UA = 'taipei-trash-helper/0.1 (Taipei CodeFest hackathon)'
const rows = []
for (let offset = 0; ; offset += 1000) {
  const url = `https://data.taipei/api/v1/dataset/${RID}?scope=resourceAquire&limit=1000&offset=${offset}`
  const r = await fetch(url, { headers: { 'User-Agent': UA } })
  if (!r.ok) throw new Error(`${r.status} ${url}`)
  const { result } = await r.json()
  rows.push(...result.results)
  console.log(rows.length, '/', result.count)
  if (rows.length >= result.count || !result.results.length) break
}
const toMin = (s) => { const t = String(s).replace(':', '').padStart(4, '0'); return +t.slice(0, 2) * 60 + +t.slice(2, 4) }
const imported = rows[0]?._importdate?.date?.slice(0, 10)
// 精簡：[行政區, 里別, 路線, 車次, 抵達分鐘, 離開分鐘, 地點, 緯度, 經度]
const stops = rows
  .filter((r) => r['緯度'] && r['經度'])
  .map((r) => [r['行政區'], r['里別'], r['路線'], r['車次'], toMin(r['抵達時間']), toMin(r['離開時間']), r['地點'].replace(/^臺北市/, ''), +(+r['緯度']).toFixed(5), +(+r['經度']).toFixed(5)])
writeFileSync('public/data/stops.json', JSON.stringify({
  source: '臺北市垃圾車點位路線資訊（data.taipei，資源 id ' + RID + '）', license: '政府資料開放授權條款第 1 版', imported,
  fields: ['district', 'li', 'route', 'trip', 'arrive', 'leave', 'address', 'lat', 'lng'], stops,
}))
console.log(`wrote public/data/stops.json：${stops.length} 筆（匯入日 ${imported}）`)
