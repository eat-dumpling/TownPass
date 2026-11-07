// 介面文字：英文、中文；越南文、印尼文預留（還沒翻譯的字會退回英文）。
// 英文為開發階段 AI 起草、需人工審核。分類規則本身來自臺北市環保局資料（共用的 items.json / categories.json）。
import { createI18n } from 'vue-i18n'

export const LANGS = [
  { id: 'en', label: 'English', ready: true },
  { id: 'zh', label: '中文', ready: true },
  { id: 'vi', label: 'Tiếng Việt', ready: false },
  { id: 'id', label: 'Bahasa Indonesia', ready: false },
] as const
export type LangId = (typeof LANGS)[number]['id']

const en = {
  app: 'Taipei Trash Helper',
  back: 'Back', next: 'Next', done: 'Done', home: 'Home', start: 'Start', yes: 'Yes', notThis: 'Not this', retry: 'Try again',
  prototype: 'Prototype · rules from Taipei City Department of Environmental Protection, being verified',
  home_q: 'What do you need?',
  home_sort: 'How do I throw this away?', home_sort_sub: 'Photo or pick from a list',
  home_today: 'Can I throw it out today?', home_today_sub: 'Today\'s collection',
  home_first: 'First time? How it works', home_first_sub: 'Bags, trucks, what to do',
  id_title: 'What do you want to throw away?', id_camera: 'Point the camera', id_photo: 'Upload a photo', id_browse: 'Pick from a list',
  search: 'Search (e.g. bottle, 便當)', no_match: 'No match — try a category',
  scan_title: 'Point at the item', scan_loading: 'Loading…', scan_looking: 'Looking…', scan_tap: 'Tap the item below', scan_none: 'Hold the item in front of the camera',
  scan_nocam: 'Camera not available', scan_seen: 'Found {n}',
  groups: { drink: 'Drinks', food: 'Food', paper: 'Paper', bag: 'Bags & boxes', home: 'Household', device: 'Electronics', big: 'Furniture & appliances', danger: 'Batteries & hazardous' },
  kinds: {
    paper: 'Paper', plastic: 'Plastic', glass: 'Glass', can: 'Cans', tetra: 'Cartons & paper cups', metal: 'Metal', other: 'Other recycling',
    general: 'General trash', food: 'Food waste', hazard: 'Batteries · lamps · oil', bulky: 'Large items', special: 'Special handling', unknown: 'Ask first',
  },
  cats: {
    recycle_3d: 'Recycling (containers & items)', recycle_flat: 'Recycling (flat: paper, bags, clothes)', other: 'Others (batteries, lamps, oil)',
    food: 'Food waste', general: 'General trash (not recyclable)', bulky: 'Large furniture & appliances', special: 'Special handling', unknown: 'Rules unclear',
  },
  subs: {
    r3d_general: 'General recyclables', r3d_foam: 'Clean styrofoam', rflat_clothes: 'Clean old clothes', rflat_paper: 'Paper', rflat_bag: 'Clean plastic bags',
    rflat_book: 'Old books', other_hazard: 'Lamps, batteries, oil', food: 'Food waste', bulky: 'Large furniture & appliances', non_recyclable: 'Not recyclable',
  },
  prep: {
    empty: 'Empty it', rinse: 'Rinse it', flatten: 'Flatten it', remove_film: 'Remove the film or cover', wrap: 'Wrap it',
    tape_terminals: 'Tape the battery ends', label: 'Label it', drain: 'Drain the water', vent_gas: 'Release the gas outdoors', remove_tape: 'Pull out the tape',
  },
  where: {
    garbage_truck: 'Garbage truck', food_bin: 'Food-waste bin on the truck', recycle_truck: 'Recycling truck', retailer: 'Shops that take it back',
    appointment: 'Book a pickup', clinic: 'Hospital or pharmacy',
  },
  bag: {
    general: 'Put it in an official Taipei trash bag', food: 'Your own container — no bag', recycle: 'Clean and empty, in any plain bag — no official bag needed',
    hazard: 'Pack it separately and label it', bulky: 'Too big for the truck — book a free pickup', special: 'Not in any trash bag', unknown: 'Ask first',
  },
  safety: { help: 'Handle with care', adult: 'Handle with care — adults only', no_touch: 'Do not touch' },
  steps: { what: 'This is', prep: 'Step {n}: prepare', bag: 'Which bag?', when: 'When?', where: 'Where does it go?', done: 'You\'re all set' },
  call1999: 'Call 1999', not_sure: 'Not sure? Ask the cleaning team or call 1999.',
  today_title: 'Can I throw it out today?', today_is: 'Today is {day}', today_yes: 'Yes, today', today_no: 'Not today', today_next: 'Next: {day}',
  today_off: 'No collection on Wednesday and Sunday', today_evening: 'Trucks come in the evening at your stop\'s scheduled time.',
  today_book: 'Book a pickup any time', today_ask: 'Ask first', today_clinic: 'Take to a hospital or pharmacy',
  today_cats: 'What can go out today',
  days: ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'],
  days_short: ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'],
  g_title: 'Your first time', g_step: 'Step {n} of {m}',
  g1_t: 'Buy official trash bags', g1_a: 'General trash must go in a Taipei City official bag.', g1_b: 'Sold at convenience stores and supermarkets.', g1_c: 'Sizes 3 L to 120 L. A 14 L bag is about NT$5.', g1_d: 'Recycling and food waste do not need official bags.',
  g2_t: 'Sort at home into 3', g2_a: 'General trash → official bag', g2_b: 'Food waste → your own container', g2_c: 'Recycling → clean, empty, any plain bag',
  g3_t: 'Find your truck stop', g3_a: 'No collection on Wednesday and Sunday.',
  g4_t: 'Wait at the stop', g4_a: 'Be there before the scheduled time.', g4_b: 'The truck plays music (Für Elise or A Maiden\'s Prayer).', g4_c: 'Never leave bags on the street — fine NT$1,200–6,000.',
  g5_t: 'Hand it over yourself', g5_a: 'Official bag → into the garbage truck', g5_b: 'Food waste → pour into the bin on the truck', g5_c: 'Recycling → the recycling truck right behind',
  stops_loc: 'Use my location', stops_near: 'Nearby stops', stops_walk: '{m} min walk', stops_sched: 'Scheduled {t}', stops_live: 'Scheduled times, not live truck location.',
  stops_none: 'No stops within 600 m', stops_noloc: 'Location not available — choose your district', stops_district: 'District', stops_li: 'Neighborhood (里)',
  stops_src: 'Data: Taipei garbage truck stops (data.taipei)',
  lang: 'Language', soon: 'coming soon',
}

type Msg = typeof en
const zh: Msg = {
  app: '台北垃圾生活助手',
  back: '返回', next: '下一步', done: '完成', home: '首頁', start: '開始', yes: '是', notThis: '不是這個', retry: '再試一次',
  prototype: '原型・規則來自臺北市環保局，核對中',
  home_q: '你需要什麼？',
  home_sort: '這個要怎麼丟？', home_sort_sub: '拍照或從清單選',
  home_today: '今天能不能丟？', home_today_sub: '今天的收運',
  home_first: '第一次倒垃圾', home_first_sub: '垃圾袋、垃圾車、現場怎麼做',
  id_title: '你要丟什麼？', id_camera: '用相機對準', id_photo: '上傳照片', id_browse: '從清單選',
  search: '搜尋（例：寶特瓶、bottle）', no_match: '找不到，試試分類',
  scan_title: '對準要丟的東西', scan_loading: '準備中…', scan_looking: '辨識中…', scan_tap: '點下面的品項', scan_none: '把東西放在鏡頭前',
  scan_nocam: '相機無法使用', scan_seen: '找到 {n} 個',
  groups: { drink: '飲料', food: '食物', paper: '紙類', bag: '袋子盒子', home: '家用品', device: '電器 3C', big: '大型家具家電', danger: '電池與危險物' },
  kinds: {
    paper: '紙類', plastic: '塑膠類', glass: '玻璃類', can: '鐵鋁罐', tetra: '鋁箔包・紙容器', metal: '金屬類', other: '其他回收',
    general: '一般垃圾', food: '廚餘', hazard: '電池・燈管・廢油', bulky: '大型家具家電', special: '特殊處理', unknown: '請先詢問',
  },
  cats: {
    recycle_3d: '立體類', recycle_flat: '平面類', other: '其他類', food: '廚餘', general: '一般垃圾（不可回收）', bulky: '大型家具、家電', special: '特殊處理', unknown: '規則不明',
  },
  subs: {
    r3d_general: '一般類資源物', r3d_foam: '乾淨保麗龍類', rflat_clothes: '乾淨舊衣類', rflat_paper: '廢紙類', rflat_bag: '塑膠袋類', rflat_book: '舊書',
    other_hazard: '照明燈管、電池、廢油類', food: '廚餘類', bulky: '大型家具、家電暨四機類', non_recyclable: '不可回收',
  },
  prep: {
    empty: '倒空', rinse: '沖一下', flatten: '壓扁', remove_film: '撕掉膜或書套', wrap: '包好', tape_terminals: '電池兩端貼膠帶', label: '寫上標示',
    drain: '瀝乾水分', vent_gas: '到戶外排空氣體', remove_tape: '抽出磁帶',
  },
  where: {
    garbage_truck: '垃圾車', food_bin: '垃圾車上的廚餘桶', recycle_truck: '資源回收車', retailer: '商店回收', appointment: '預約清運', clinic: '醫院或藥局',
  },
  bag: {
    general: '裝進臺北市專用垃圾袋', food: '用自己的容器裝，不用袋子', recycle: '洗乾淨倒空，一般袋子即可，不用專用袋',
    hazard: '單獨包好並標示', bulky: '太大，垃圾車不收，要預約免費清運', special: '不要丟進任何垃圾袋', unknown: '請先詢問',
  },
  safety: { help: '小心處理', adult: '小心處理（請大人處理）', no_touch: '不要碰' },
  steps: { what: '這是', prep: '第 {n} 步：處理', bag: '用什麼裝？', when: '什麼時候丟？', where: '交給誰？', done: '完成了' },
  call1999: '撥打 1999', not_sure: '不確定？請洽清潔隊或撥 1999。',
  today_title: '今天能不能丟？', today_is: '今天是{day}', today_yes: '今天可以', today_no: '今天不行', today_next: '下次：{day}',
  today_off: '週三、週日停收', today_evening: '垃圾車傍晚到晚上依停靠點的表定時間抵達。',
  today_book: '隨時可預約', today_ask: '請先詢問', today_clinic: '交給醫院或藥局',
  today_cats: '今天可以丟',
  days: ['星期日', '星期一', '星期二', '星期三', '星期四', '星期五', '星期六'],
  days_short: ['日', '一', '二', '三', '四', '五', '六'],
  g_title: '第一次倒垃圾', g_step: '第 {n} / {m} 步',
  g1_t: '買專用垃圾袋', g1_a: '一般垃圾一定要裝在臺北市專用垃圾袋。', g1_b: '便利商店、超市都有賣。', g1_c: '3 到 120 公升；14 公升一個約 5 元。', g1_d: '資源回收和廚餘不用專用袋。',
  g2_t: '在家先分三類', g2_a: '一般垃圾 → 專用垃圾袋', g2_b: '廚餘 → 自己的容器', g2_c: '資源回收 → 洗乾淨倒空，一般袋子',
  g3_t: '找到你的垃圾車停靠點', g3_a: '週三、週日停收。',
  g4_t: '到停靠點等車', g4_a: '在表定時間前到。', g4_b: '垃圾車會播音樂（給愛麗絲、少女的祈禱）。', g4_c: '不可以把垃圾放在路邊——罰 1,200–6,000 元。',
  g5_t: '自己交給垃圾車', g5_a: '專用垃圾袋 → 丟進垃圾車', g5_b: '廚餘 → 倒進車上的廚餘桶', g5_c: '資源回收 → 後面的資源回收車',
  stops_loc: '用我的位置', stops_near: '附近的停靠點', stops_walk: '走路 {m} 分鐘', stops_sched: '表定 {t}', stops_live: '這是表定時間，不是垃圾車即時位置。',
  stops_none: '600 公尺內沒有停靠點', stops_noloc: '無法取得位置，請選行政區', stops_district: '行政區', stops_li: '里',
  stops_src: '資料：臺北市垃圾車點位路線資訊（data.taipei）',
  lang: '語言', soon: '即將推出',
}

export const i18n = createI18n({ legacy: false, locale: 'en', fallbackLocale: 'en', messages: { en, zh, vi: {}, id: {} } })
