// 偵測器類別 → 臺北品項的先驗（把偵測器「看出來的形狀」當成 CLIP 的提示）。
// 例：偵測器說是 bottle，CLIP 在寶特瓶、玻璃瓶、廢食用油之間比較就好，其他品項打折（不是禁止，CLIP 很有把握時仍可勝出）。
// 融合：logit_i += log(prior_i)。對應到的品項 prior=1，其他 OTHER_PRIOR。偵測器沒框到（中央瞄準框）時不加先驗。
// 手拿照片驗證：偵測器類別常常不準（手拿的瓶子、杯子常被叫成 vase、cell phone），0.2 太硬會把答案推錯；用 0.5（README「手拿照片的完整流程驗證」）
export const OTHER_PRIOR = 0.5
/** 偵測分數低於這個值時類別常常不準，不加先驗 */
export const PRIOR_MIN_SCORE = 0.3

export const COCO_TO_ITEMS: Record<string, string[]> = {
  bottle: ['pet_bottle', 'glass_bottle', 'cooking_oil', 'spray_can', 'tetra_pak', 'lubricant', 'pesticide_container'],
  'wine glass': ['glass_bottle', 'broken_glass'],
  cup: ['bubble_tea_cup', 'paper_cup', 'pudding_cup', 'aluminum_can', 'tetra_pak', 'foam_tableware'],
  bowl: ['leftovers', 'paper_lunchbox', 'broken_ceramic', 'styrofoam_clean', 'styrofoam_dirty', 'pudding_cup', 'foam_tableware', 'wooden_lunchbox'],
  fork: ['metal_utensils', 'chopsticks', 'plastic_misc'],
  knife: ['metal_utensils'],
  spoon: ['metal_utensils', 'chopsticks', 'plastic_misc'],
  scissors: ['metal_utensils'],
  banana: ['fruit_peel', 'vegetables'],
  apple: ['fruit_peel', 'vegetables'],
  orange: ['fruit_peel', 'vegetables'],
  broccoli: ['vegetables', 'leftovers'],
  carrot: ['vegetables', 'leftovers'],
  sandwich: ['leftovers', 'paper_lunchbox', 'snack_bag'],
  'hot dog': ['leftovers', 'meat'],
  pizza: ['leftovers', 'paper_lunchbox'],
  donut: ['leftovers', 'snack_bag'],
  cake: ['leftovers', 'paper_lunchbox'],
  book: ['old_book', 'newspaper', 'magazine', 'copy_paper'],
  toothbrush: ['toothbrush'],
  'cell phone': ['phone', 'tablet', 'power_bank', 'battery', 'small_appliance'],
  remote: ['mouse_keyboard', 'game_console', 'small_appliance', 'battery', 'power_bank'],
  'hair drier': ['hair_dryer', 'small_appliance'],
  mouse: ['mouse_keyboard'],
  keyboard: ['mouse_keyboard'],
  clock: ['small_appliance', 'battery'],
  handbag: ['plastic_bag_clean', 'plastic_bag_dirty', 'snack_bag', 'paper_bag'],
  vase: ['glass_bottle', 'broken_ceramic'],
  'teddy bear': ['plush_toy'],
  'sports ball': ['ball'],
  // 大型家具家電（pipeline.ts 的 BIG_CLASSES）
  chair: ['table_chair', 'furniture', 'cabinet'],
  bench: ['table_chair', 'furniture'],
  couch: ['furniture', 'table_chair', 'mattress', 'bedding'],
  bed: ['bed_frame', 'mattress', 'bedding'],
  'dining table': ['table_chair', 'cabinet', 'whiteboard'],
  tv: ['tv', 'computer', 'tablet', 'whiteboard'],
  laptop: ['computer', 'tablet', 'mouse_keyboard'],
  refrigerator: ['fridge', 'water_dispenser', 'cabinet', 'washing_machine', 'air_conditioner'],
  oven: ['gas_stove', 'small_appliance', 'range_hood', 'washing_machine'],
  microwave: ['small_appliance', 'gas_stove', 'printer', 'video_player'],
  toaster: ['small_appliance'],
  toilet: ['toilet_seat'],
  bicycle: ['bicycle', 'cart'],
  frisbee: ['plastic_misc'],
}

/** 回傳每個品項的 log 先驗；沒有對應時回傳 null（不加先驗） */
export function logPrior(coco: string | null | undefined, other = OTHER_PRIOR): ((itemId: string) => number) | null {
  const ids = coco ? COCO_TO_ITEMS[coco] : undefined
  if (!ids || other >= 1) return null
  const set = new Set(ids)
  const low = Math.log(other)
  return (id) => (set.has(id) ? 0 : low)
}
