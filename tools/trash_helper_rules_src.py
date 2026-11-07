#!/usr/bin/env python3
"""Source of truth for microservices/trash_helper/data/rules.json.
Category membership and collection days follow the official dataset
臺北市資源回收分類方式 (data.taipei 74643872-ee76-4727-bd02-d73b536eaad7), bundled as
microservices/trash_helper/data/source/taipei_recycling_categories.csv.
Run: python3 tools/trash_helper_rules_src.py
SPDX-License-Identifier: AGPL-3.0-or-later
"""
import json
from pathlib import Path

OUT = Path(__file__).resolve().parents[1] / 'microservices/trash_helper/data/rules.json'
MTWFS = [1, 2, 4, 5, 6]

def T(en, zh): return {'en': en, 'zh': zh}
def S(emoji, title, text=None, tip=None, warn=None):
    d = {'emoji': emoji, 'title': title}
    if text: d['text'] = text
    if tip: d['tip'] = tip
    if warn: d['warn'] = warn
    return d

RINSE = S('🚿', T('Empty and rinse', '倒空、沖洗'), T('Pour out what is left and give it a quick rinse.', '倒掉剩餘內容物，簡單沖一下。'))
DRY = S('💨', T('Let it dry', '晾乾'), T('Wet recyclables can make other items dirty.', '濕的回收物會弄髒其他回收物。'))
FLAT = S('🫓', T('Flatten it', '壓扁'), T('Squash it to save space.', '壓扁可以節省空間。'))
CAP = S('🔩', T('Take off caps and labels if you can', '可以的話拆下瓶蓋'), T('Caps can go to recycling too.', '瓶蓋也可以回收。'))
RIGID_HAND = T('Hand it to the crew on the recycling truck that follows the garbage truck (Tue / Thu / Sat). Free — no special bag needed.',
               '交給跟著垃圾車的資源回收車人員（二、四、六）。免費，不需專用垃圾袋。')
FLAT_HAND = T('Hand it to the crew on the recycling truck that follows the garbage truck (Mon / Fri). Free — no special bag needed.',
              '交給跟著垃圾車的資源回收車人員（一、五）。免費，不需專用垃圾袋。')
GEN_HAND = T('Put it in a Taipei official garbage bag, tie it, and throw it into the garbage truck yourself.',
             '裝進臺北市專用垃圾袋、綁好，自己丟進垃圾車。')
FOOD_HAND = T('Since 2026 all food waste is one category. Pour it into the food-waste bucket at the back of the garbage truck. The empty plastic bag goes in your general trash.',
              '2026 年起廚餘不分生熟，一律倒進垃圾車後方的廚餘桶。倒完的塑膠袋當一般垃圾。')
HAZ_HAND = T('Pack it separately and hand it to the recycling crew. Never put it in the garbage bag.',
             '分開包好交給回收車人員，絕對不要放進垃圾袋。')

rules = {
    'version': '2026-11-07',
    'sources': [
        {'id': 'recycle', 'core': True, 'name': '臺北市資源回收分類方式（臺北市政府環境保護局）',
         'url': 'https://data.taipei/dataset/detail?id=74643872-ee76-4727-bd02-d73b536eaad7'},
        {'id': 'truck', 'core': True, 'name': '臺北市垃圾車點位路線資訊（臺北市政府環境保護局）',
         'url': 'https://data.taipei/dataset/detail?id=6bb3304b-4f46-4bb0-8cd1-60c66dcd1cae'},
        {'id': 'dep', 'core': True, 'name': '臺北市政府環境保護局（專用垃圾袋、廚餘、收運 FAQ）',
         'url': 'https://www.dep.gov.taipei/'},
    ],
    'categories': {
        'general': {'emoji': '🗑️', 'where': T('Garbage truck, in an official bag', '垃圾車，須用專用垃圾袋')},
        'recycle': {'emoji': '♻️', 'where': T('Recycling truck on the same route, free', '同路線的資源回收車，免費')},
        'food': {'emoji': '🍌', 'where': T('Food-waste bucket on the truck', '垃圾車上的廚餘桶')},
        'special': {'emoji': '🔋', 'where': T('Recycling truck, packed separately', '資源回收車，分開包裝')},
        'bulky': {'emoji': '🛋️', 'where': T('Book a pickup with the cleaning squad', '預約清潔隊收運')},
    },
    # Collection days, 0 = Sunday. From the official dataset's 回收時間 column.
    'groups': {
        'general': {'cat': 'general', 'days': MTWFS},
        'rigid': {'cat': 'recycle', 'days': [2, 4, 6], 'label': T('Bottles, cans, plastics, styrofoam, small electronics', '立體類：瓶罐、容器、塑膠、保麗龍、小家電')},
        'flat': {'cat': 'recycle', 'days': [1, 5], 'label': T('Paper, clean clothes, clean plastic bags, books', '平面類：紙類、乾淨舊衣、乾淨塑膠袋、舊書')},
        'food': {'cat': 'food', 'days': MTWFS},
        'hazard': {'cat': 'special', 'days': MTWFS, 'label': T('Batteries, bulbs, cooking oil', '電池、燈管、廢油')},
        'bulky': {'cat': 'bulky', 'days': MTWFS, 'booking': True,
                  'note': T('Free pickup for households. Book at least 1 day ahead with your district cleaning squad, or through 1999. Pickup runs Mon–Sat.',
                            '家戶免費收運。至少前一天向各區清潔隊預約，或透過 1999 預約，週一至週六收運。')},
    },
    'items': [
        # ---- rigid recyclables (Tue/Thu/Sat)
        {'id': 'pet', 'emoji': '🧴', 'group': 'rigid', 'name': T('Plastic bottle', '寶特瓶'), 'keywords': ['pet', 'water bottle', '塑膠瓶', '水瓶'], 'steps': [RINSE, CAP, FLAT], 'handover': RIGID_HAND},
        {'id': 'can', 'emoji': '🥫', 'group': 'rigid', 'name': T('Can (aluminum / tin)', '鐵鋁罐'), 'keywords': ['soda', 'beer', 'tin', '易開罐', '罐頭'], 'steps': [RINSE, FLAT], 'handover': RIGID_HAND},
        {'id': 'glass', 'emoji': '🍾', 'group': 'rigid', 'name': T('Glass bottle', '玻璃瓶'), 'keywords': ['wine', 'jar', '酒瓶', '玻璃罐'], 'steps': [RINSE, S('🧤', T('Do not break it', '不要打破'), T('Hand it over whole so the crew stays safe.', '完整交出，避免割傷清潔人員。'))], 'handover': RIGID_HAND},
        {'id': 'carton', 'emoji': '🧃', 'group': 'rigid', 'name': T('Drink carton / juice box', '鋁箔包、紙容器'), 'keywords': ['milk', 'tetra', '牛奶盒', '利樂包', '紙盒'], 'steps': [S('🥤', T('Take out the straw', '抽出吸管'), T('The straw goes in general trash.', '吸管丟一般垃圾。')), RINSE, FLAT], 'handover': RIGID_HAND},
        {'id': 'cup', 'emoji': '🧋', 'group': 'rigid', 'name': T('Bubble tea / takeaway cup', '手搖飲杯'), 'keywords': ['boba', 'drink cup', 'coffee cup', '飲料杯', '咖啡杯'], 'steps': [
            S('🧋', T('Empty it', '倒空'), T('Pour the drink and pearls out. Pearls and ice go to food waste or the sink.', '倒掉飲料。珍珠等料可當廚餘。')),
            S('✂️', T('Separate the parts', '拆開'), T('Remove the sealing film and straw — they are general trash. The cup and lid go to recycling.', '撕下封膜、拿出吸管丟一般垃圾；杯子、杯蓋回收。')),
            RINSE, S('📚', T('Stack the cups', '疊起來'), T('Stack cups to save space.', '杯子疊好節省空間。'))], 'handover': RIGID_HAND},
        {'id': 'lunchbox', 'emoji': '🍱', 'group': 'rigid', 'name': T('Plastic / paper lunch box', '餐盒'), 'keywords': ['bento', 'takeout box', 'food container', '便當盒', '外帶盒'], 'steps': [
            S('🍚', T('Scrape out the food', '倒出剩菜'), T('Leftover food goes to food waste.', '剩菜當廚餘。')), RINSE, DRY],
            'warn': T('Wooden lunch boxes are NOT recyclable — general trash.', '木片餐盒不可回收，當一般垃圾。'), 'handover': RIGID_HAND},
        {'id': 'styrofoam', 'emoji': '📦', 'group': 'rigid', 'name': T('Styrofoam', '保麗龍'), 'keywords': ['foam', 'packing', 'polystyrene', '緩衝材', '保麗龍碗'], 'steps': [
            S('🧽', T('Keep it clean', '保持乾淨'), T('Only clean styrofoam is recycled. Wipe or rinse food containers.', '只收乾淨的保麗龍，餐具要先擦乾淨。'))],
            'warn': T('Sponge / foam filling (泡棉) is not recyclable.', '泡棉、海綿不可回收。'), 'handover': RIGID_HAND},
        {'id': 'fruitnet', 'emoji': '🍐', 'group': 'rigid', 'name': T('Fruit foam net', '水果網套'), 'keywords': ['fruit net', 'mesh', '網套'], 'steps': [], 'handover': RIGID_HAND},
        {'id': 'phone', 'emoji': '📱', 'group': 'rigid', 'name': T('Old phone / small electronics', '手機、小家電'), 'keywords': ['mobile', 'hair dryer', 'mouse', 'keyboard', 'charger', '吹風機', '滑鼠', '鍵盤', '電腦'], 'steps': [
            S('🔐', T('Delete your data', '刪除個人資料'), T('Factory-reset phones and computers first.', '手機、電腦先回復原廠設定。')),
            S('🔋', T('Remove batteries if you can', '可以的話拆出電池'), T('Batteries are recycled separately.', '電池要另外回收。'))], 'handover': RIGID_HAND},
        {'id': 'plastic', 'emoji': '🪣', 'group': 'rigid', 'name': T('Other hard plastic / metal', '廢塑膠、廢金屬'), 'keywords': ['bucket', 'pot', 'pan', 'hanger', '臉盆', '鍋子', '衣架'], 'steps': [RINSE], 'handover': RIGID_HAND},
        # ---- flat recyclables (Mon/Fri)
        {'id': 'paper', 'emoji': '📰', 'group': 'flat', 'name': T('Paper, newspaper, boxes', '廢紙、紙箱'), 'keywords': ['cardboard', 'magazine', 'box', 'carton box', '報紙', '雜誌', '紙箱', '紙袋'], 'steps': [
            S('📦', T('Flatten boxes', '紙箱攤平'), T('Remove tape and flatten.', '撕掉膠帶，攤平。')),
            S('🪢', T('Bundle and tie', '綁成一疊'), T('Tie paper into a bundle so it does not fly away.', '綁好避免飛散。'))],
            'warn': T('Greasy paper, tissues, glossy laminated paper and photo paper are general trash.', '沾油的紙、衛生紙、上膜光面紙、照片紙都是一般垃圾。'), 'handover': FLAT_HAND},
        {'id': 'clothes', 'emoji': '👕', 'group': 'flat', 'name': T('Clean old clothes', '乾淨舊衣'), 'keywords': ['shirt', 'jeans', 'clothing', '衣服', '褲子'], 'steps': [
            S('🧺', T('Wash and dry', '洗淨晾乾'), T('Only clean, dry clothes are accepted.', '只收乾淨、乾燥的衣物。')),
            S('🛍️', T('Bag them', '裝袋'), T('Put them in any bag.', '用任何袋子裝好。'))],
            'warn': T('Towels, socks, underpants, bedding, curtains and torn or smelly clothes are general trash.', '毛巾、襪子、內褲、棉被、窗簾，以及破舊發臭的衣物都是一般垃圾。'), 'handover': FLAT_HAND},
        {'id': 'bag', 'emoji': '🛍️', 'group': 'flat', 'name': T('Clean plastic bag', '乾淨塑膠袋'), 'keywords': ['shopping bag', '購物袋'], 'steps': [
            S('🧽', T('Must be clean', '要乾淨'), T('No oil, soup or blood.', '不能有油漬、湯汁、血水。')),
            S('🗂️', T('Stuff bags into one bag', '集中裝成一袋'))],
            'warn': T('Snack and chip bags (shiny, mixed material) are general trash.', '零食、餅乾包裝袋（複合材質）是一般垃圾。'), 'handover': FLAT_HAND},
        {'id': 'books', 'emoji': '📚', 'group': 'flat', 'name': T('Old books', '舊書'), 'keywords': ['book', 'textbook', '書'], 'steps': [
            S('🪢', T('Tie them separately', '和其他紙類分開綁'))], 'handover': FLAT_HAND},
        # ---- food waste
        {'id': 'peel', 'emoji': '🍌', 'group': 'food', 'name': T('Fruit & vegetable scraps', '果皮、菜葉'), 'keywords': ['banana', 'peel', 'vegetable', 'fruit', '香蕉皮', '菜渣'], 'steps': [
            S('💧', T('Drain the water', '瀝乾水分'), T('Less water means less smell.', '瀝乾比較不臭。')),
            S('🧊', T('Store it cold', '冷藏保存'), T('Keep it in a sealed box in the fridge until truck day.', '用密封盒放冰箱，等收運日再拿出。'))], 'handover': FOOD_HAND},
        {'id': 'leftovers', 'emoji': '🍲', 'group': 'food', 'name': T('Leftover food, meat, bones', '剩菜、肉類'), 'keywords': ['rice', 'noodle', 'meat', 'chicken', '剩飯', '骨頭'], 'steps': [
            S('💧', T('Drain the soup', '瀝乾湯汁')), S('🧊', T('Store it cold', '冷藏保存'))], 'handover': FOOD_HAND},
        {'id': 'tea', 'emoji': '☕', 'group': 'food', 'name': T('Tea leaves / coffee grounds', '茶渣、咖啡渣'), 'keywords': ['coffee', 'tea', '茶葉'], 'steps': [
            S('🫖', T('Remove the tea bag / filter', '拿掉茶包袋、濾紙'), T('The bag or filter paper is general trash.', '茶包袋、濾紙是一般垃圾。'))], 'handover': FOOD_HAND},
        {'id': 'coconut', 'emoji': '🥥', 'group': 'rigid', 'name': T('Coconut / durian shell', '椰子殼、榴槤殼'), 'keywords': ['coconut', 'durian'], 'steps': [
            S('🚫', T('Not food waste', '不是廚餘'), T('These shells are too hard for food waste. Collect them separately.', '殼太硬，不能混在廚餘裡，請另外收集。'))],
            'handover': T('Hand them to the recycling truck crew, separate from food waste.', '另外收集後交給資源回收車。')},
        # ---- hazardous
        {'id': 'battery', 'emoji': '🔋', 'group': 'hazard', 'name': T('Batteries / power bank', '電池、行動電源'), 'keywords': ['aa', 'aaa', 'power bank', '乾電池'], 'steps': [
            S('🩹', T('Tape the ends', '電極貼膠帶'), T('Cover the metal ends with tape to prevent fire.', '用膠帶貼住兩端，避免短路起火。')),
            S('🛍️', T('Bag them separately', '另外裝袋'))],
            'warn': T('Never put batteries in the garbage bag — they can start fires in the truck.', '電池絕對不能丟垃圾袋，可能讓垃圾車起火。'), 'handover': HAZ_HAND},
        {'id': 'bulb', 'emoji': '💡', 'group': 'hazard', 'name': T('Light bulb / fluorescent tube', '燈泡、燈管'), 'keywords': ['lamp', 'led', 'tube', '日光燈'], 'steps': [
            S('🧤', T('Keep it whole', '保持完整'), T('Do not break it — tubes contain mercury.', '不要打破，燈管含汞。')),
            S('📦', T('Wrap it', '包好'), T('Put it back in its box or wrap with paper.', '放回原包裝或用紙包好。'))], 'handover': HAZ_HAND},
        {'id': 'oil', 'emoji': '🫗', 'group': 'hazard', 'name': T('Used cooking oil', '廢食用油'), 'keywords': ['frying oil', '油'], 'steps': [
            S('🍶', T('Pour into a bottle and cap it', '倒進瓶子並蓋緊'), T('Let it cool first.', '先放涼。'))],
            'warn': T('Do not pour oil down the sink.', '不要倒進水槽。'), 'handover': HAZ_HAND},
        {'id': 'medicine', 'emoji': '🧪', 'group': 'hazard', 'name': T('Thermometer / bug spray can', '水銀體溫計、殺蟲劑罐'), 'keywords': ['mercury', 'insecticide', '殺蟲劑'], 'steps': [
            S('🛍️', T('Bag it separately', '另外裝袋'))], 'handover': HAZ_HAND},
        # ---- general trash
        {'id': 'tissue', 'emoji': '🧻', 'group': 'general', 'name': T('Tissues, diapers', '衛生紙、尿布'), 'keywords': ['toilet paper', 'napkin', 'diaper', 'wet wipe', '紙尿布', '濕紙巾'], 'steps': [], 'handover': GEN_HAND},
        {'id': 'snackbag', 'emoji': '🍟', 'group': 'general', 'name': T('Snack / chip bag', '零食包裝袋'), 'keywords': ['chips', 'cookie wrapper', '餅乾袋'], 'steps': [], 'handover': GEN_HAND},
        {'id': 'dirtybag', 'emoji': '🛍️', 'group': 'general', 'name': T('Dirty / oily plastic bag', '髒污塑膠袋'), 'keywords': ['greasy bag', '油膩'], 'steps': [], 'handover': GEN_HAND},
        {'id': 'straw', 'emoji': '🥤', 'group': 'general', 'name': T('Straws, cup sealing film', '吸管、封膜'), 'keywords': ['straw', 'film', '杯膜'], 'steps': [], 'handover': GEN_HAND},
        {'id': 'woodbox', 'emoji': '🥡', 'group': 'general', 'name': T('Wooden lunch box', '木片餐盒'), 'keywords': ['wood', '木盒'], 'steps': [], 'handover': GEN_HAND},
        {'id': 'shoes', 'emoji': '👟', 'group': 'general', 'name': T('Shoes', '鞋子'), 'keywords': ['sneakers', 'slippers', '拖鞋'], 'steps': [], 'handover': GEN_HAND},
        {'id': 'toy', 'emoji': '🧸', 'group': 'general', 'name': T('Stuffed toy, balls', '布偶、球類'), 'keywords': ['plush', 'teddy', 'ball', '絨毛玩具'], 'steps': [], 'handover': GEN_HAND},
        {'id': 'towel', 'emoji': '🧣', 'group': 'general', 'name': T('Towels, socks, bedding', '毛巾、襪子、棉被'), 'keywords': ['pillow', 'blanket', 'sheet', 'curtain', '枕頭', '床單'], 'steps': [], 'handover': GEN_HAND},
        {'id': 'receipt', 'emoji': '🧾', 'group': 'general', 'name': T('Receipts, stickers backing, photos', '發票感熱紙、貼紙底紙、照片'), 'keywords': ['receipt', 'sticker', 'photo', '收據'], 'steps': [], 'handover': GEN_HAND},
        {'id': 'butt', 'emoji': '🚬', 'group': 'general', 'name': T('Cigarette butts, dust', '菸蒂、灰塵'), 'keywords': ['cigarette', 'ash', '掃地'], 'steps': [
            S('💧', T('Make sure it is out', '確認熄滅'))], 'handover': GEN_HAND},
        # ---- bulky
        {'id': 'furniture', 'emoji': '🛋️', 'group': 'bulky', 'name': T('Sofa, mattress, furniture', '沙發、床墊、家具'), 'keywords': ['bed', 'table', 'chair', 'cabinet', 'bike', '桌椅', '櫃子', '腳踏車'], 'steps': [
            S('☎️', T('Call 1999 to book', '撥 1999 預約'), T('Book at least 1 day ahead. Tell them your address and the item; they set a time and place.', '至少前一天預約，說明地址與物品，清潔隊會約定時間地點。')),
            S('🏠', T('Put it out on the agreed day', '在約定日放到指定地點'))],
            'warn': T('Do not leave furniture on the street without booking.', '未預約不可擅自丟在路邊。')},
        {'id': 'appliance', 'emoji': '📺', 'group': 'bulky', 'name': T('TV, fridge, washer, A/C', '電視、冰箱、洗衣機、冷氣'), 'keywords': ['television', 'refrigerator', 'washing machine', 'air conditioner', 'fan', '電風扇'], 'steps': [
            S('☎️', T('Call 1999 to book', '撥 1999 預約'), T('Tell them your address and the item. They give you a pickup date.', '說明地址與物品，清潔隊會約時間。'))]},
    ],
    'guide': [],  # filled below
}

rules['guide'] = [
    S('🛍️', T('Buy official garbage bags', '買專用垃圾袋'),
      T('General trash must go in a Taipei City official garbage bag. Buy them at convenience stores and supermarkets. Sizes 3 L–120 L, e.g. 14 L: NT$100 for 20 bags, or NT$5 for one retail bag.',
        '一般垃圾必須裝在臺北市專用垃圾袋。便利商店、超市都買得到。容量 3–120 公升，例如 14 公升一包 20 個 100 元，零售單個 5 元。'),
      tip=T('Recycling, food waste and bulky-waste pickup are free — no special bag needed.', '資源回收、廚餘與大型廢棄物預約收運都免費，不需專用袋。'),
      warn=T('Not using an official bag can be fined from NT$1,200 (Waste Disposal Act).', '未使用專用垃圾袋，依廢棄物清理法可處 1,200 元起罰鍰。')),
    S('🧺', T('Sort at home into 3', '在家分成三類'),
      T('1. General trash (official bag)  2. Recycling (any bag)  3. Food waste (a box or bag).',
        '1. 一般垃圾（專用袋）2. 資源回收（任何袋子）3. 廚餘（盒子或袋子）。'),
      tip=T('Not sure? Use "What is this item?" on the home page.', '不確定？用首頁的「這是什麼垃圾？」查詢。')),
    S('📅', T('Check the day', '確認今天收不收'),
      T('No collection on Wednesday and Sunday. Paper & clothes: Mon / Fri. Bottles, cans & plastics: Tue / Thu / Sat.',
        '每週三、日停收。紙類、舊衣：一、五。瓶罐、塑膠：二、四、六。'),
      tip=T('Lunar New Year has a special schedule announced by the Department of Environmental Protection.', '農曆春節收運時間依環保局公告調整。')),
    S('🕒', T('Find your stop and time', '找到停靠點和時間'),
      T('The truck stops at fixed places at fixed times, usually only a few minutes. Arrive 5 minutes early.',
        '垃圾車在固定地點、固定時間停靠，通常只停幾分鐘，請提早 5 分鐘到。'),
      tip=T('Missed it? The city runs limited-time drop-off points in every district.', '錯過了？各區有環保局的限時收受點。')),
    S('🎵', T('Listen for the music', '聽到音樂就出門'),
      T('Trucks play music as they come (often "Für Elise"). A recycling truck runs on the same route.',
        '垃圾車來時會播放音樂（常見為〈給愛麗絲〉），同路線也有資源回收車。')),
    S('🙌', T('Hand it over yourself', '自己交給清潔車'),
      T('Throw the official bag into the garbage truck. Give recyclables to the recycling crew. Pour food waste into the bucket at the back of the truck.',
        '專用袋丟進垃圾車；回收物交給回收車人員；廚餘倒進車後方的廚餘桶。'),
      warn=T('Never leave trash on the street or by a pole — Taipei has no curbside bins. You can be fined.',
             '不可把垃圾放在路邊或電線桿旁（垃圾不落地），會被開罰。')),
]

OUT.write_text(json.dumps(rules, ensure_ascii=False, indent=1), encoding='utf-8')
print(f"Wrote {len(rules['items'])} items, {len(rules['guide'])} guide steps -> {OUT}")
