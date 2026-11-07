// 從 Wikimedia Commons 搜尋每個品項的真實照片（只收 CC0／公有領域／CC BY／CC BY-SA），給 CLIP 調參與範例向量用。
// 照片不進 git（testdata/web/ 在 .gitignore），App 只發布由照片算出的向量；出處寫在 testdata/web/attribution.csv。
//
// 用法：node scripts/fetch-commons.mjs [--per 10]
// 輸出：../testdata/web/<item_id>/<n>.jpg（500px 標準縮圖）＋ ../testdata/web/attribution.csv ＋ manifest.json
import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { join, resolve } from 'node:path'

const SET = process.argv.includes('--set') ? process.argv[process.argv.indexOf('--set') + 1] : 'web'
const ROOT = resolve(SET === 'hand' ? '../testdata/hand' : '../testdata/web')
const UA = 'recycle-li-tuning/0.1 (https://codefest.taipei/2026-fall; hackathon research)'
const API = 'https://commons.wikimedia.org/w/api.php'
const args = process.argv.slice(2)
const PER = Number(args[args.indexOf('--per') + 1]) || 10

// 搜尋詞（英文，Commons 的檔名與描述多半是英文）。沒列的用 items.json 的英文名稱。
const Q = {
  bubble_tea_cup: ['bubble tea cup', 'boba tea plastic cup'],
  pet_bottle: ['PET bottle', 'plastic water bottle'],
  aluminum_can: ['aluminium can', 'drink can'],
  tetra_pak: ['juice box', 'milk carton', 'Tetra Pak'],
  glass_bottle: ['glass bottle', 'empty glass jar'],
  paper_cup: ['paper cup', 'disposable coffee cup'],
  coconut_shell: ['coconut shell', 'durian husk'],
  leftovers: ['leftover food', 'food scraps'],
  fruit_peel: ['banana peel', 'orange peel', 'apple peel', 'pineapple top'],
  tea_leaves: ['used tea leaves', 'coffee grounds'],
  big_bone: ['pork bone', 'chicken bones'],
  paper_lunchbox: ['paper lunch box', 'bento box paper'],
  chopsticks: ['disposable chopsticks', 'drinking straws'],
  eggshell: ['eggshells'],
  seashell: ['clam shells', 'oyster shells'],
  newspaper: ['newspapers stack', 'cardboard box'],
  old_book: ['old books', 'notebook school'],
  tissue: ['used tissue', 'paper napkin'],
  plastic_bag_clean: ['plastic bag', 'plastic shopping bag'],
  plastic_bag_dirty: ['dirty plastic bag'],
  snack_bag: ['potato chip bag', 'snack wrapper'],
  pudding_cup: ['pudding cup', 'plastic food container'],
  styrofoam_clean: ['styrofoam packaging', 'polystyrene foam block'],
  styrofoam_dirty: ['styrofoam food container'],
  old_clothes: ['folded clothes', 'old t-shirt'],
  old_shoes: ['old shoes', 'worn sneakers'],
  mask: ['used face mask', 'disposable diaper'],
  toothbrush: ['toothbrush'],
  small_appliance: ['electric kettle', 'rice cooker'],
  furniture: ['old sofa', 'couch'],
  battery: ['AA batteries', 'used batteries'],
  power_bank: ['power bank', 'lithium ion battery pack'],
  light_tube: ['fluorescent tube', 'light bulb'],
  broken_glass: ['broken glass shards'],
  broken_ceramic: ['broken plate ceramic', 'broken porcelain'],
  spray_can: ['aerosol can', 'spray can'],
  lighter: ['disposable lighter', 'cigarette lighter'],
  cooking_oil: ['cooking oil bottle', 'used cooking oil'],
  medicine: ['blister pack pills', 'medicine tablets'],
  needle: ['syringe', 'insulin pen'],
  metal_utensils: ['metal spoons', 'scissors', 'wire hanger'],
  cd_disc: ['compact disc', 'DVD disc'],
  thermometer: ['mercury thermometer', 'clinical thermometer glass'],
  phone: ['old mobile phone', 'smartphone'],
  tablet: ['tablet computer'],
  hair_dryer: ['hair dryer'],
  desk_lamp: ['desk lamp'],
  telephone: ['telephone handset', 'fax machine'],
  video_player: ['VCR', 'DVD player'],
  usb_drive: ['USB flash drive', 'external hard drive'],
  vacuum: ['vacuum cleaner'],
  radio: ['portable radio', 'cassette player'],
  mosquito_lamp: ['electric fly swatter', 'bug zapper'],
  game_console: ['video game console', 'game controller'],
  plastic_lamp: ['ceiling light fixture', 'lamp shade plastic'],
  computer: ['desktop computer tower', 'computer monitor'],
  mouse_keyboard: ['computer mouse', 'computer keyboard'],
  printer: ['inkjet printer', 'image scanner'],
  plastic_misc: ['plastic storage box', 'plastic basket'],
  acrylic: ['acrylic sheet', 'acrylic glass'],
  plastic_hose: ['garden hose'],
  toilet_seat: ['toilet seat'],
  tire: ['used tires', 'old tyre'],
  cassette_tape: ['audio cassette', 'VHS tape'],
  foam_tableware: ['styrofoam cup', 'foam food container'],
  fruit_net: ['fruit foam net', 'foam net apple'],
  plush_toy: ['plush toy', 'teddy bear'],
  doormat: ['doormat', 'rug carpet'],
  sponge: ['kitchen sponge', 'foam rubber'],
  whiteboard: ['whiteboard'],
  ball: ['basketball', 'football ball'],
  wooden_lunchbox: ['wooden bento box', 'ekiben box'],
  inner_tube: ['inner tube bicycle'],
  scooter_parts: ['scooter seat', 'motor scooter'],
  copy_paper: ['printer paper stack', 'A4 paper'],
  magazine: ['magazines'],
  paper_bag: ['paper shopping bag', 'paper bag'],
  towel: ['bath towel', 'towels'],
  hat_socks: ['socks', 'baseball cap'],
  bedding: ['pillow', 'blanket bed'],
  fabric: ['fabric scraps', 'curtain'],
  dirty_clothes: ['torn clothes', 'dirty clothes'],
  glossy_paper: ['carbon paper', 'sticker sheet'],
  photo_paper: ['photographic print', 'old photographs'],
  pesticide_container: ['insecticide spray', 'bug spray can'],
  lubricant: ['motor oil bottle', 'lubricant oil can'],
  food_shells: ['shrimp shells', 'peanut shells'],
  flowers_leaves: ['fallen leaves', 'wilted flowers'],
  meat: ['raw meat', 'chicken skin'],
  vegetables: ['vegetable scraps', 'rotten fruit'],
  frozen_food: ['frozen dumplings', 'frozen food'],
  range_hood: ['range hood', 'kitchen hood'],
  mattress: ['old mattress', 'spring mattress'],
  bed_frame: ['bed frame'],
  cart: ['hand truck', 'shopping trolley'],
  bicycle: ['old bicycle', 'bicycle'],
  electric_fan: ['electric fan'],
  gas_stove: ['gas stove', 'portable gas stove'],
  water_dispenser: ['water dispenser', 'water cooler'],
  table_chair: ['wooden chair', 'table chair'],
  cabinet: ['wooden cabinet', 'wardrobe'],
  tv: ['television set', 'old television'],
  fridge: ['refrigerator'],
  washing_machine: ['washing machine'],
  air_conditioner: ['air conditioner', 'window air conditioner'],
}
// 驗證組（--set hand）：手拿著東西的照片，最接近孩子實際掃描的樣子
// 手拿／生活情境照片（驗證用）。Commons 的一般搜尋是全文比對說明文字，會搜到古希臘陶瓶（plastic aryballos）、
// 炮兵連（battery）、生物組織（tissue）這類完全無關的照片，所以這裡用 intitle:／incategory:，標題還要符合 must、不能符合 not。
// 下載後再用眼睛看過一次，搜錯的寫進 data/commons_hand_reject.txt（重跑時會跳過並補新的）。
const HAND = {
  pet_bottle: { q: ['intitle:"plastic bottle" hand', 'intitle:"water bottle" holding', 'incategory:"PET bottles"', 'intitle:"plastic bottle"', 'intitle:"PET bottle"'], must: /bottle/i, not: /aryballos|glass|wine|beer|vase|perfume/i },
  paper_cup: { q: ['intitle:"paper cup"', 'intitle:"coffee cup" takeaway', 'intitle:"to-go" coffee', 'incategory:"Paper cups"', 'intitle:"cardboard cup"'], must: /cup|coffee/i, not: /mug|porcelain|ceramic|cream|teacup|saucer|trophy|world cup/i },
  bubble_tea_cup: { q: ['intitle:"bubble tea"', 'intitle:boba', 'incategory:"Bubble tea"', 'intitle:"pearl milk tea"', 'intitle:"tapioca" tea'], must: /bubble|boba|pearl|tapioca|milk tea/i, not: /letter|mahjong/i },
  aluminum_can: { q: ['intitle:"beer can"', 'intitle:"soda can"', 'intitle:"drink can"', 'intitle:"aluminum can"', 'intitle:"cola can"'], must: /\bcans?\b/i, not: /glass|bottle|trash can|garbage can|watering/i },
  tetra_pak: { q: ['intitle:"juice box"', 'intitle:"milk carton"', 'intitle:"tetra pak"', 'intitle:"drink carton"'], must: /juice box|carton|tetra/i, not: /factory|machine|logo/i },
  glass_bottle: { q: ['intitle:"glass bottle"', 'intitle:"beer bottle"', 'intitle:"wine bottle" hand', 'intitle:"soda bottle" glass'], must: /bottle/i, not: /roman|ancient|vial|vaccine|excavat|plastic|museum|antique/i },
  paper_lunchbox: { q: ['intitle:便當', 'intitle:"bento" Taiwan', 'intitle:"lunch box" Taiwan', 'intitle:"paper lunch box"', 'intitle:biandang', 'intitle:"takeout box"'], must: /便當|bento|biandang|lunch ?box|take-?out|food box|paper box/i, not: /corrugated|wheelchair|platform|station|shop|store|kiosk|closed|onigiri|adobo|ramen|no\.\d/i },
  plastic_bag_clean: { q: ['intitle:"plastic bag"', 'intitle:"plastic bags"', 'intitle:"shopping bag" plastic', 'intitle:"carrier bag"'], must: /plastic bag|carrier bag|shopping bag|plastic bags/i, not: /granule|pollution|ocean|beach|tree/i },
  snack_bag: { q: ['intitle:"chip bag"', 'intitle:"crisp packet"', 'intitle:"chips packet"', 'intitle:"bag of crisps"', 'intitle:"potato chips" bag', 'intitle:"snack packaging"', 'intitle:"crisps" packet'], must: /bag|packet|package|packaging|wrapper/i, not: /chocolate chip|poker|wood|micro|silicon|stone|cpu|computer|factory/i },
  battery: { q: ['intitle:"AA battery"', 'intitle:"AA batteries"', 'intitle:"alkaline battery"', 'intitle:"AAA battery"', 'intitle:"batteries" hand'], must: /batter(y|ies)/i, not: /park|gun|artillery|battalion|fort|action|coastal|car battery|anti-?aircraft|battery street/i },
  phone: { q: ['intitle:"hand holding smartphone"', 'intitle:"holding mobile phone"', 'intitle:smartphone hand'], must: /phone/i, not: /logo/i },
  newspaper: { q: ['intitle:"holding newspaper"', 'intitle:"reading newspaper"', 'intitle:"reading a newspaper"'], must: /newspaper/i, not: /clipping|article/i },
  fruit_peel: { q: ['intitle:"banana peel"', 'intitle:"orange peel"', 'intitle:"peeled banana"', 'intitle:"fruit peel"', 'intitle:"peeling" orange'], must: /peel/i, not: /fiber|fibre|cosmetic|skin peel/i },
  light_tube: { q: ['intitle:"fluorescent tube"', 'intitle:"fluorescent lamp"', 'intitle:"compact fluorescent"', 'intitle:"light bulb" hand', 'intitle:"LED bulb"'], must: /fluorescent|tube|bulb|CFL|lamp/i, not: /russula|mushroom|sketch|shadow|plant|flower|tulip|nature/i },
  tissue: { q: ['intitle:"facial tissue"', 'intitle:"tissue box"', 'intitle:"paper napkin"', 'intitle:kleenex', 'intitle:"tissue paper" hand', 'intitle:"pocket tissue"'], must: /tissue|napkin|kleenex/i, not: /fish|hellbender|cell|biolog|culture|sample|histolog|wrapping|art|callus/i },
  // 水壺、茶壺（回收一點通：其他金屬）放前面，確定驗證組裡有
  metal_utensils: { q: ['intitle:"stainless steel kettle"', 'intitle:"whistling kettle"', 'intitle:"thermos flask"', 'intitle:"stainless steel teapot"', 'intitle:"metal spoon"', 'intitle:scissors'], must: /kettle|thermos|flask|teapot|spoon|scissors|fork|hanger/i, not: /logo|diagram|drawing|museum|electric|kettlebell|kettle drum|timpani|kettle lake|mountain|ceramic|porcelain/i }, // 電熱水壺是小家電，不放這裡
  plastic_misc: { q: ['intitle:"sports water bottle"', 'intitle:"reusable water bottle"', 'intitle:"plastic container"', 'intitle:"plastic basket"'], must: /bottle|container|basket/i, not: /logo|diagram|PET|glass|wine|beer|disposable/i },
  misc_trash: { q: ['intitle:"ballpoint pen"', 'intitle:comb hair', 'intitle:"shower cap"', 'intitle:crayons', 'intitle:"rubber gloves"', 'intitle:earplugs'], must: /pen|comb|cap|crayon|glove|earplug/i, not: /logo|diagram|drawing|museum|penguin|pencil sketch|honeycomb|capital|baseball cap|boxing|goalkeeper/i },
  luggage: { q: ['intitle:suitcase', 'intitle:luggage', 'intitle:"rolling suitcase"'], must: /suitcase|luggage/i, not: /logo|diagram|drawing|carousel|conveyor|airport|claim|nuclear/i },
  // 大型家具家電與電腦周邊（偵測器的 chair、couch、refrigerator、tv、laptop… 類別）
  table_chair: { q: ['intitle:"discarded chair"', 'intitle:"old chair"', 'intitle:"wooden chair"', 'intitle:"office chair"', 'intitle:"plastic chair"', 'intitle:"dining table"'], must: /chair|table|desk/i, not: /wheelchair|chairman|chairlift|table mountain|periodic|timetable|tennis|billiard/i },
  furniture: { q: ['intitle:"old sofa"', 'intitle:"discarded sofa"', 'intitle:"abandoned couch"', 'intitle:sofa living room', 'intitle:couch'], must: /sofa|couch/i, not: /kangaroo|surfing|potato/i },
  fridge: { q: ['intitle:refrigerator kitchen', 'intitle:fridge', 'intitle:"old refrigerator"', 'intitle:"discarded refrigerator"'], must: /fridge|refrigerator/i, not: /magnet|truck|car|ship|railway|wagon/i },
  tv: { q: ['intitle:"old television"', 'intitle:"CRT television"', 'intitle:"television set"', 'intitle:"flat screen" TV', 'intitle:"discarded TV"'], must: /tv|television/i, not: /station|tower|studio|show|presenter|logo|channel|camera/i },
  computer: { q: ['intitle:"desktop computer"', 'intitle:"computer monitor"', 'intitle:"old computer"', 'intitle:"discarded computer"', 'intitle:"computer tower"'], must: /computer|monitor|PC/i, not: /chip|circuit|screenshot|room|lab|center|museum/i },
  mouse_keyboard: { q: ['intitle:"computer mouse"', 'intitle:"computer keyboard"', 'intitle:"keyboard and mouse"', 'intitle:"wireless mouse"'], must: /mouse|keyboard/i, not: /animal|rodent|musical|piano|synth|field mouse|house mouse/i },
  washing_machine: { q: ['intitle:"washing machine"', 'intitle:"washing machines"', 'intitle:"front loader"'], must: /washing machine|washer|front loader/i, not: /museum|antique|factory|logo/i },
  electric_fan: { q: ['intitle:"electric fan"', 'intitle:"desk fan"', 'intitle:"standing fan"', 'intitle:"pedestal fan"'], must: /fan/i, not: /fanta|fans|fanfare|football|ceiling|anime|club/i },
  bicycle: { q: ['intitle:"old bicycle"', 'intitle:"abandoned bicycle"', 'intitle:"parked bicycle"', 'intitle:"rusty bicycle"'], must: /bicycle|bike/i, not: /race|tour|cyclist|motor|logo/i },
  mattress: { q: ['intitle:"discarded mattress"', 'intitle:"old mattress"', 'intitle:mattress', 'intitle:"spring mattress"'], must: /mattress/i, not: /factory|logo|diagram/i },
}

// 回收一點通（data/回收一點通_1031筆.tsv）裡同一個品項的各種樣子，人工從 scripts/map-taipei-list.mjs 的對應挑出來（只留看起來是同一類東西的）。
// 訓練照片和驗證照片的搜尋都會用到，讓模型看過「木椅、辦公椅」都是桌椅、「冷凍櫃」也是電冰箱。
const VAR = {
  misc_trash: ['ballpoint pen', 'hair comb', 'shower cap', 'crayons', 'rubber gloves', 'earplugs'], luggage: ['suitcase', 'rolling luggage', 'old suitcase'],
  air_conditioner: ['window air conditioner', 'split air conditioner'], aluminum_can: ['tin can', 'food can'],
  ball: ['basketball', 'soccer ball', 'tennis ball'], battery: ['button cell', 'lithium battery', 'dry cell battery'],
  bed_frame: ['metal bed frame', 'wooden bed frame'], bedding: ['pillow', 'duvet', 'bed sheet'], bicycle: ["children's bicycle"],
  broken_glass: ['broken glass', 'shattered glass'], cabinet: ['wardrobe', 'bookcase', 'kitchen cabinet'],
  cart: ['baby stroller', 'shopping cart', 'hand truck'], cassette_tape: ['audio cassette', 'VHS tape'], cd_disc: ['DVD disc', 'compact disc'],
  chopsticks: ['disposable chopsticks', 'bamboo skewers', 'drinking straw'], computer: ['laptop', 'computer monitor', 'desktop computer'],
  cooking_oil: ['cooking oil bottle', 'peanut oil'], copy_paper: ['shredded paper', 'printer paper'], desk_lamp: ['LED desk lamp', 'flashlight'],
  doormat: ['floor mat', 'yoga mat', 'carpet'], electric_fan: ['electric fan'], fabric: ['curtain', 'tablecloth', 'apron'],
  foam_tableware: ['styrofoam bowl', 'instant noodle cup'], food_shells: ['shrimp shells', 'peanut shells', 'crab shell'],
  fridge: ['refrigerator', 'freezer'], frozen_food: ['frozen food', 'tofu'], fruit_peel: ['banana peel', 'orange peel'],
  game_console: ['game console', 'game controller'], gas_stove: ['gas stove', 'gas cooker'], glass_bottle: ['beer bottle', 'glass jar'],
  glossy_paper: ['sticker sheet', 'carbon paper'], hat_socks: ['socks', 'baseball cap'], light_tube: ['fluorescent tube', 'light bulb', 'compact fluorescent lamp'],
  lubricant: ['motor oil bottle'], magazine: ['calendar', 'flyer'], mask: ['face mask', 'disposable diaper'], mattress: ['spring mattress'],
  meat: ['raw meat', 'cooked meat'], medicine: ['blister pack', 'medicine bottle'], metal_utensils: ['fork', 'metal spoon', 'scissors', 'clothes hanger', 'whistling kettle', 'stainless steel kettle', 'stainless steel teapot', 'thermos flask'],
  mosquito_lamp: ['electric mosquito swatter', 'bug zapper'], mouse_keyboard: ['computer mouse', 'computer keyboard'], needle: ['syringe', 'hypodermic needle'],
  newspaper: ['cardboard box', 'newspaper'], old_book: ['old books', 'notebook', 'telephone directory'], old_clothes: ['clothes', 'coat', 'baby clothes', 'trousers'],
  old_shoes: ['flip-flops', 'sneakers', 'shoes'], paper_bag: ['paper bag', 'paper shopping bag'], paper_lunchbox: ['french fry box', 'hamburger box', 'paper food box'],
  pesticide_container: ['insecticide spray', 'pesticide bottle'], pet_bottle: ['plastic bottle', 'water bottle'], phone: ['mobile phone', 'smartphone'],
  photo_paper: ['photograph print', 'film negative'], plastic_bag_clean: ['plastic bag', 'zip lock bag', 'plastic wrap'], plastic_hose: ['PVC pipe', 'garden hose'],
  plastic_misc: ['plastic container', 'plastic toy', 'plastic basket', 'sports water bottle', 'reusable water bottle', 'coffee capsule', 'dry box'], // 「plastic water bottle」搜到的多半是寶特瓶，不放 plush_toy: ['stuffed toy', 'teddy bear'], printer: ['printer', 'scanner', 'paper shredder'],
  pudding_cup: ['plastic cup lid', 'plastic food container'], radio: ['boombox', 'portable radio'], range_hood: ['range hood', 'kitchen hood'],
  scooter_parts: ['scooter seat', 'motorcycle fairing'], small_appliance: ['rice cooker', 'electric kettle', 'electric water boiler', 'toaster', 'hair straightener'], // 電熱水壺、熱水瓶：小家電
  snack_bag: ['potato chip bag', 'candy wrapper'], spray_can: ['spray paint can', 'aerosol can'], styrofoam_clean: ['packaging styrofoam', 'polystyrene foam'],
  table_chair: ['wooden chair', 'office chair', 'table'], tea_leaves: ['used tea leaves', 'coffee grounds', 'herbal medicine dregs'], telephone: ['fax machine', 'landline telephone'],
  thermometer: ['mercury thermometer'], tire: ['car tire', 'bicycle tire'], tissue: ['used tissue', 'facial tissue'], toilet_seat: ['toilet seat', 'bidet seat'],
  toothbrush: ['toothbrush'], towel: ['bath towel', 'towel'], tv: ['television', 'flat screen tv'], usb_drive: ['USB flash drive', 'external hard drive'],
  vacuum: ['vacuum cleaner', 'robot vacuum'], vegetables: ['leafy vegetables', 'vegetables', 'fruit'], video_player: ['VCR', 'DVD player', 'MP3 player'],
  washing_machine: ['washing machine', 'clothes dryer'], water_dispenser: ['water dispenser', 'water cooler'],
}
// 沒有寫在 HAND 裡的品項：驗證照片也用 VAR／Q 的詞做標題搜尋，標題要含這些詞的其中一個字
const STOP = new Set(['a', 'an', 'the', 'of', 'and', 'or', 'for', 'used', 'old', 'clean', 'dirty', 'small', 'large', 'other', 'waste', 'empty'])
function autoSpec(it) {
  const terms = [...new Set([...(VAR[it.id] ?? []), ...(Q[it.id] ?? [it.name.en.split(',')[0]])])]
  const words = [...new Set(terms.flatMap((t) => t.toLowerCase().split(/[^a-z-]+/)).filter((w) => w.length > 2 && !STOP.has(w)))]
  return { q: terms.map((t) => `intitle:"${t}"`), must: new RegExp(words.map((w) => w.replace(/[-]/g, '.')).join('|'), 'i'), not: /logo|diagram|drawing|museum|factory|patent|map|icon|advert|poster|illustration/i }
}
const NOT = args.includes('--not') ? new RegExp(args[args.indexOf('--not') + 1], 'i') : null
const REJECT_FILE = resolve('../data/commons_hand_reject.txt')
const REJECT = new Set(existsSync(REJECT_FILE) ? readFileSync(REJECT_FILE, 'utf8').split('\n').map((l) => l.split('\t')[0].trim()).filter(Boolean) : [])
const OK_LICENSE = /^(cc0|public domain|pd|cc by(-sa)? ?\d|cc-by(-sa)?-?\d|attribution)/i
const BAD_TITLE = /(logo|diagram|map|icon|chart|drawing|illustration|svg|graph|scheme|flag|coat of arms|poster|advert|screenshot)/i
const strip = (h) => String(h ?? '').replace(/<[^>]+>/g, '').replace(/\s+/g, ' ').trim()

async function api(params) {
  const url = `${API}?${new URLSearchParams({ format: 'json', origin: '*', ...params })}`
  for (let k = 0; k < 6; k++) {
    try {
      const r = await fetch(url, { headers: { 'User-Agent': UA } })
      if (r.ok) return await r.json()
      if (r.status === 429) {
        // 被限速：照 Retry-After 等，沒有就逐步拉長
        const wait = (Number(r.headers.get('retry-after')) || 5 * (k + 1)) * 1000
        await new Promise((ok) => setTimeout(ok, wait))
        continue
      }
    } catch { /* retry */ }
    await new Promise((ok) => setTimeout(ok, 1000 * (k + 1)))
  }
  console.warn('api gave up', params.gsrsearch)
  return null
}
async function download(url) {
  for (let k = 0; k < 3; k++) {
    try {
      const r = await fetch(url, { headers: { 'User-Agent': UA } })
      if (r.ok) return Buffer.from(await r.arrayBuffer())
      if (r.status === 429) await new Promise((ok) => setTimeout(ok, 5000 * (k + 1)))
    } catch { /* retry */ }
    await new Promise((ok) => setTimeout(ok, 1000 * (k + 1)))
  }
  return null
}

const items = JSON.parse(readFileSync('src/data/items.json', 'utf8'))
const manifestFile = join(ROOT, 'manifest.json')
const manifest = existsSync(manifestFile) ? JSON.parse(readFileSync(manifestFile, 'utf8')) : []
// 看過後判定搜錯的照片：從清單和資料夾移除，之後補新的
for (let i = manifest.length - 1; SET === 'hand' && i >= 0; i--) {
  const sp = HAND[manifest[i].item]
  const bad = REJECT.has(manifest[i].title) || (sp && (!sp.must.test(manifest[i].title) || sp.not.test(manifest[i].title)))
  if (!bad) continue
  REJECT.add(manifest[i].title)
  rmSync(join(ROOT, manifest[i].file), { force: true })
  manifest.splice(i, 1)
}
const have = new Set([...manifest.map((m) => m.title), ...REJECT])
// 驗證組不能和訓練用的照片重複
// 反過來也一樣：訓練照片不能是驗證組的照片
if (SET === 'web' && existsSync(resolve('../testdata/hand/manifest.json'))) for (const m of JSON.parse(readFileSync(resolve('../testdata/hand/manifest.json'), 'utf8'))) have.add(m.title)
if (SET === 'hand' && existsSync(resolve('../testdata/web/manifest.json'))) for (const m of JSON.parse(readFileSync(resolve('../testdata/web/manifest.json'), 'utf8'))) have.add(m.title)
mkdirSync(ROOT, { recursive: true })

async function fetchItem(it) {
  const spec = SET === 'hand' ? HAND[it.id] ?? autoSpec(it) : null
  // 訓練組：先用標題比對（intitle:，比較準），再用全文搜尋補；加上回收一點通裡同一個品項的各種樣子（VAR）
  const base = [...new Set([...(Q[it.id] ?? [it.name.en.split(',')[0]]), ...(VAR[it.id] ?? [])])]
  // --terms a,b,c：只用這些詞（補某一種樣子，例：水壺）；--not 正規式：標題符合就不要（例：electric）
  const terms = args.includes('--terms') ? args[args.indexOf('--terms') + 1].split(',') : null
  const queries = terms ? [...terms.map((q) => `intitle:"${q}"`), ...terms] : spec ? spec.q : [...base.map((q) => `intitle:"${q}"`), ...base]
  const already = manifest.filter((m) => m.item === it.id).length
  if (already >= PER) return
  const cands = []
  for (const q of queries) {
    const j = await api({
      action: 'query', generator: 'search', gsrnamespace: '6', gsrsearch: `${q} filetype:bitmap`, gsrlimit: '25',
      prop: 'imageinfo', iiprop: 'url|mime|extmetadata', iiurlwidth: '500', // 用 Wikimedia 的標準縮圖尺寸（非標準尺寸會被限速）
    })
    const pages = Object.values(j?.query?.pages ?? {}).sort((a, b) => (a.index ?? 0) - (b.index ?? 0))
    for (const p of pages) {
      const ii = p.imageinfo?.[0]
      if (!ii || !/^image\/(jpeg|png|webp)$/.test(ii.mime)) continue
      if (BAD_TITLE.test(p.title)) continue
      if (spec && (!spec.must.test(p.title) || spec.not.test(p.title) || REJECT.has(p.title))) continue
      if (NOT && NOT.test(p.title)) continue
      const md = ii.extmetadata ?? {}
      const lic = strip(md.LicenseShortName?.value)
      if (!OK_LICENSE.test(lic) || /nc|nd/i.test(lic.replace(/public domain/i, ''))) continue
      cands.push({ q: q.replace(/^intitle:/, '').replace(/"/g, '').toLowerCase(), title: p.title, thumb: ii.thumburl ?? ii.url, page: ii.descriptionurl, license: lic, author: strip(md.Artist?.value).slice(0, 120) })
    }
    await new Promise((ok) => setTimeout(ok, 1500)) // 對 API 保持禮貌
    // 候選夠多就不用再搜（每次搜尋要 1.5 秒以上）
    const titleDone = !q.startsWith('intitle:') || queries.indexOf(q) >= queries.filter((x) => x.startsWith('intitle:')).length - 1 // 標題搜尋（含各種樣子）都要跑完
    if (titleDone && new Set(cands.map((c) => c.title).filter((t) => !have.has(t))).size >= (PER - already) * 2) break
  }
  // 多個搜尋詞真的輪流取（每個詞各取一張再換下一個），不然第一個詞就把名額用完，各種樣子（VAR）都輪不到
  const seen = new Set()
  const byQ = new Map()
  for (const c of cands) {
    if (seen.has(c.title) || have.has(c.title)) continue
    seen.add(c.title)
    if (!byQ.has(c.q)) byQ.set(c.q, [])
    byQ.get(c.q).push(c)
  }
  const pick = []
  for (let more = true; more;) {
    more = false
    for (const list of byQ.values()) if (list.length) { pick.push(list.shift()); more = true }
  }
  let n = already
  const dir = join(ROOT, it.id)
  mkdirSync(dir, { recursive: true })
  for (const c of pick) {
    if (n >= PER) break
    const buf = await download(c.thumb)
    if (!buf || buf.length < 5000) continue
    let k = 0 // 用第一個還沒用過的編號（刪掉搜錯的照片後重跑，不會蓋掉留下來的）
    while (existsSync(join(dir, `${String(k).padStart(2, '0')}.jpg`))) k++
    const file = join(dir, `${String(k).padStart(2, '0')}.jpg`)
    writeFileSync(file, buf)
    manifest.push({ item: it.id, file: file.slice(ROOT.length + 1), ...c })
    have.add(c.title)
    n++
    await new Promise((ok) => setTimeout(ok, 150))
  }
  console.log(`${it.id}: ${n}`)
  writeFileSync(manifestFile, JSON.stringify(manifest, null, 0))
}
// 一次一個品項：搜尋 API 對並行請求會回 429
const ONLY = args.includes('--items') ? new Set(args[args.indexOf('--items') + 1].split(',')) : null // 只補這些品項
for (const it of items) if (!ONLY || ONLY.has(it.id)) await fetchItem(it)


const esc = (s) => `"${String(s).replace(/"/g, '""')}"`
writeFileSync(join(ROOT, 'attribution.csv'), ['file,title,author,license,url', ...manifest.map((m) => [m.file, m.title, m.author, m.license, m.page].map(esc).join(','))].join('\n') + '\n')
writeFileSync(resolve(SET === 'hand' ? '../data/commons_hand_attribution.csv' : '../data/commons_attribution.csv'), readFileSync(join(ROOT, 'attribution.csv')))
console.log(`done: ${manifest.length} 張，出處 → testdata/web/attribution.csv（另存一份進 git：data/commons_attribution.csv）`)
