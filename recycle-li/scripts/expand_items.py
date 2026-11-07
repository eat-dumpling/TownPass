#!/usr/bin/env python3
"""把臺北市環保局「資源回收分類方式」CSV 說明欄列出的每一種東西，都變成 items.json 的品項。

每一筆：官方子類（sub）、臺北大類（category）、孩子的桶（kind）、步驟、交給誰、安全、圖示、給 CLIP 的英文描述。
已存在的 id 不會覆蓋（保留人工調整過的資料）。執行後要重跑 `npm run build:embeds`。

用法：python3 scripts/expand_items.py
"""
import json, os

HERE = os.path.dirname(__file__)
ITEMS = os.path.join(HERE, '..', 'web', 'src', 'data', 'items.json')
SRC = '臺北市環保局資源回收分類方式'

# (id, 中文, English, [CLIP 描述], group, kind, category, sub, steps, where, icon, safety, notes, attrs)
R3D = ('recycle_3d', 'r3d_general')
FOAM = ('recycle_3d', 'r3d_foam')
GEN = ('general', 'non_recyclable')
FLAT_PAPER = ('recycle_flat', 'rflat_paper')
HAZ = ('other', 'other_hazard')
FOOD = ('food', 'food')
BULKY = ('bulky', 'bulky')
RT, GT, FB, AP = ['recycle_truck'], ['garbage_truck'], ['food_bin'], ['appointment']
DEV_NOTE = '有電池的要先取出，或請大人處理；手機、平板先刪除個人資料'
BULKY_NOTE = '先打電話給各區清潔隊約時間，免費清運；先拆解縮小體積'

NEW = [
  # ── 立體類・一般類資源物：電器與 3C ───────────────────────────
  ('phone', '手機', 'Mobile phone', ['a used smartphone', 'an old mobile phone with a cracked screen', 'a cell phone lying on a table'], 'device', 'other', *R3D, [], RT, 'DeviceMobile', 'help', DEV_NOTE, {'battery': True}),
  ('tablet', '平板電腦', 'Tablet computer', ['an old tablet computer', 'an ipad style tablet with a black screen'], 'device', 'other', *R3D, [], RT, 'DeviceTablet', 'help', DEV_NOTE, {'battery': True}),
  ('hair_dryer', '吹風機', 'Hair dryer', ['a handheld hair dryer', 'a hair blow dryer with a cord'], 'device', 'other', *R3D, [], RT, 'Wind', 'none', '', {'battery': False}),
  ('desk_lamp', '檯燈', 'Desk lamp', ['a desk lamp', 'a small reading lamp'], 'device', 'other', *R3D, [], RT, 'Lamp', 'none', '燈泡或燈管要拆下來另外回收', {}),
  ('telephone', '電話、傳真機', 'Telephone, fax machine', ['a landline telephone', 'an old fax machine', 'a cordless home phone'], 'device', 'other', *R3D, [], RT, 'Phone', 'none', '', {}),
  ('video_player', '錄放影機', 'VCR, DVD player', ['an old VCR video player', 'a DVD player box'], 'device', 'other', *R3D, [], RT, 'DeviceTvOld', 'none', '', {}),
  ('usb_drive', '隨身碟、外接硬碟', 'USB drive, external hard drive', ['a usb flash drive', 'an external hard drive', 'a memory stick'], 'device', 'other', *R3D, [], RT, 'DeviceUsb', 'none', '先刪除個人資料', {}),
  ('vacuum', '吸塵器', 'Vacuum cleaner', ['a vacuum cleaner', 'a handheld cordless vacuum cleaner'], 'device', 'other', *R3D, [], RT, 'VacuumCleaner', 'none', '充電式的要先取出電池', {'battery': True}),
  ('radio', '收錄音機', 'Radio, cassette player', ['a portable radio cassette player', 'a small radio'], 'device', 'other', *R3D, [], RT, 'Radio', 'none', '乾電池要先取出', {'battery': True}),
  ('mosquito_lamp', '捕蚊燈、電蚊拍', 'Mosquito lamp, electric swatter', ['an electric mosquito swatter racket', 'a UV mosquito killer lamp'], 'device', 'other', *R3D, ['tape_terminals'], RT, 'Bolt', 'help', '電蚊拍的電池要先取出', {'battery': True}),
  ('game_console', '電子遊樂器', 'Game console', ['a video game console', 'a handheld game console', 'a game controller'], 'device', 'other', *R3D, [], RT, 'DeviceGamepad2', 'help', DEV_NOTE, {'battery': True}),
  ('plastic_lamp', '塑膠外殼燈具', 'Plastic light fixture', ['a plastic ceiling light fixture', 'a plastic lamp shade'], 'device', 'other', *R3D, [], RT, 'Lamp2', 'none', '燈泡或燈管要拆下來另外回收', {}),
  ('computer', '電腦主機、螢幕', 'Computer, monitor', ['a desktop computer tower', 'a computer monitor', 'an old LCD screen'], 'device', 'other', *R3D, [], RT, 'DeviceDesktop', 'help', '先刪除個人資料；很重，請大人搬', {}),
  ('mouse_keyboard', '滑鼠、鍵盤', 'Mouse, keyboard', ['a computer mouse', 'a computer keyboard', 'a wireless mouse'], 'device', 'other', *R3D, [], RT, 'Mouse', 'none', '無線的要先取出電池', {'battery': True}),
  ('printer', '印表機、掃描機', 'Printer, scanner', ['an inkjet printer', 'a flatbed scanner', 'a home office printer'], 'device', 'other', *R3D, [], RT, 'Printer', 'none', '墨水匣另外交給販賣業者回收', {}),
  # ── 立體類・一般類資源物：其他材質 ───────────────────────────
  ('plastic_misc', '其他塑膠製品', 'Other plastic items', ['a plastic storage box', 'a plastic toy', 'a plastic basket'], 'home', 'plastic', *R3D, [], RT, 'Box', 'none', '塑膠容器要倒空沖乾淨', {}),
  ('acrylic', '壓克力', 'Acrylic sheet', ['a clear acrylic sheet', 'an acrylic display stand'], 'home', 'plastic', *R3D, [], RT, 'Square', 'none', '', {'clean': True}),
  ('plastic_hose', '塑膠軟管', 'Plastic hose', ['a plastic garden hose', 'a flexible plastic tube'], 'home', 'plastic', *R3D, [], RT, 'Ripple', 'none', '', {'soft': True}),
  ('toilet_seat', '馬桶蓋', 'Toilet seat', ['a plastic toilet seat lid', 'a toilet seat cover'], 'home', 'plastic', *R3D, ['rinse'], RT, 'Bath', 'none', '', {}),
  ('tire', '廢輪胎', 'Tire', ['a used car tire', 'a bicycle tire', 'an old rubber tire'], 'big', 'other', *R3D, [], RT, 'Wheel', 'adult', '很重，請大人處理；輪胎內胎是一般垃圾', {}),
  ('cassette_tape', '錄音帶、錄影帶', 'Cassette, video tape', ['an audio cassette tape', 'a VHS video tape'], 'device', 'other', *R3D, ['remove_tape'], RT, 'DeviceAudioTape', 'none', '請抽除磁帶（磁帶是一般垃圾）', {}),
  # ── 立體類・乾淨保麗龍類 ───────────────────────────────
  ('foam_tableware', '保麗龍餐具', 'Styrofoam tableware', ['a white styrofoam bowl', 'a foam takeout box', 'a styrofoam cup'], 'food', 'plastic', *FOAM, ['empty', 'rinse'], RT, 'Bowl', 'none', '要乾淨沒有油垢，髒的請洽清潔隊', {'styrofoam': True, 'clean': True}),
  ('fruit_net', '水果網套', 'Fruit foam net', ['a white foam mesh net for fruit', 'a protective foam net sleeve for apples'], 'food', 'plastic', *FOAM, [], RT, 'GridDots', 'none', '', {'styrofoam': True, 'soft': True, 'clean': True}),
  # ── 立體類・不可回收 → 一般垃圾 ──────────────────────────
  ('plush_toy', '布偶、絨毛玩具', 'Plush toy', ['a stuffed teddy bear', 'a plush toy', 'a fluffy stuffed animal'], 'home', 'general', *GEN, [], GT, 'HorseToy', 'none', '', {'soft': True}),
  ('doormat', '腳踏墊、地毯', 'Doormat, carpet', ['a doormat', 'a rolled up carpet rug', 'a bath mat'], 'home', 'general', *GEN, [], GT, 'LayoutBottombar', 'none', '大塊的要剪小再裝袋', {'soft': True}),
  ('sponge', '泡棉、海綿', 'Sponge, foam padding', ['a kitchen sponge', 'a piece of foam padding', 'a yellow cleaning sponge'], 'home', 'general', *GEN, [], GT, 'Wash', 'none', '', {'soft': True}),
  ('whiteboard', '白板', 'Whiteboard', ['a small whiteboard', 'a dry erase board'], 'home', 'general', *GEN, [], GT, 'Presentation', 'none', '', {}),
  ('ball', '球類', 'Ball', ['a basketball', 'a soccer ball', 'a rubber ball'], 'home', 'general', *GEN, [], GT, 'BallBasketball', 'none', '', {}),
  ('wooden_lunchbox', '木片便當盒', 'Wooden lunch box', ['a thin wooden bento lunch box', 'a wood veneer food box'], 'food', 'general', *GEN, ['empty'], GT, 'Box', 'none', '剩菜倒進廚餘，木片盒是一般垃圾', {'has_food': True}),
  ('inner_tube', '輪胎內胎', 'Inner tube', ['a rubber bicycle inner tube', 'a deflated inner tube'], 'big', 'general', *GEN, [], GT, 'Circle', 'none', '', {'soft': True}),
  ('scooter_parts', '機車車殼、座墊', 'Scooter body panel, seat', ['a plastic scooter body panel', 'a motorcycle seat cushion'], 'big', 'general', *GEN, [], GT, 'Motorbike', 'adult', '很重，請大人處理', {}),
  # ── 平面類・廢紙類 ───────────────────────────────────
  ('copy_paper', '影印紙、紙張', 'Copy paper', ['a stack of white printer paper', 'used A4 paper sheets'], 'paper', 'paper', *FLAT_PAPER, ['flatten'], RT, 'FileText', 'none', '', {'paper': True, 'soft': True, 'clean': True}),
  ('magazine', '雜誌', 'Magazine', ['a glossy magazine', 'a stack of old magazines'], 'paper', 'paper', *FLAT_PAPER, ['flatten'], RT, 'Book', 'none', '', {'paper': True, 'clean': True}),
  ('paper_bag', '紙袋', 'Paper bag', ['a brown paper shopping bag', 'a paper gift bag'], 'paper', 'paper', *FLAT_PAPER, ['flatten'], RT, 'PaperBag', 'none', '拿掉塑膠提把', {'paper': True, 'bag': True, 'clean': True}),
  # ── 平面類・不可回收 → 一般垃圾 ──────────────────────────
  ('towel', '毛巾、浴巾', 'Towel', ['a used bath towel', 'a folded face towel'], 'home', 'general', *GEN, [], GT, 'Wash', 'none', '', {'soft': True, 'clothes': True}),
  ('hat_socks', '帽子、襪子、內褲', 'Hat, socks, underwear', ['an old baseball cap', 'a pair of socks', 'old underwear'], 'home', 'general', *GEN, [], GT, 'Sock', 'none', '這些不是舊衣回收', {'soft': True, 'clothes': True}),
  ('bedding', '棉被、枕頭、床單', 'Bedding', ['a folded blanket', 'a pillow', 'a bed sheet'], 'home', 'general', *GEN, [], GT, 'Bed', 'none', '大的要剪小再裝袋', {'soft': True}),
  ('fabric', '布料、窗簾、桌布、圍裙', 'Fabric scraps, curtains', ['fabric scraps', 'an old curtain', 'a tablecloth', 'a kitchen apron'], 'home', 'general', *GEN, [], GT, 'Shirt', 'none', '', {'soft': True, 'clothes': True}),
  ('dirty_clothes', '髒、破、發臭的舊衣', 'Dirty or torn clothes', ['a torn dirty t-shirt', 'wet moldy old clothes'], 'home', 'general', *GEN, [], GT, 'Shirt', 'none', '乾淨完整的才能舊衣回收', {'soft': True, 'clothes': True}),
  ('glossy_paper', '光面紙、複寫紙、貼紙底紙', 'Coated paper, carbon paper, sticker backing', ['glossy plastic coated paper', 'carbon copy paper', 'sticker backing paper'], 'paper', 'general', *GEN, [], GT, 'Sticker', 'none', '有一層塑膠膜的紙不能回收', {'paper': True, 'has_film': True}),
  ('photo_paper', '照片紙', 'Photo paper', ['a printed photograph', 'old photo prints'], 'paper', 'general', *GEN, [], GT, 'Photo', 'none', '', {'paper': True, 'has_film': True}),
  # ── 其他類・照明燈管、電池、廢油類 ──────────────────────────
  ('pesticide_container', '殺蟲劑等環境用藥空罐', 'Empty insecticide container', ['an empty insecticide spray can', 'an empty bug killer bottle'], 'danger', 'hazard', *HAZ, ['label'], RT, 'Bug', 'adult', '確定用完，包好分開拿給回收車', {'can': True}),
  ('lubricant', '潤滑油', 'Lubricant oil', ['a bottle of motor oil', 'a can of lubricating oil'], 'danger', 'hazard', *HAZ, ['label'], RT, 'Droplet', 'adult', '用容器裝好蓋緊', {'bottle': True}),
  # ── 其他類・廚餘類 ───────────────────────────────────
  ('food_shells', '蝦殼、蟹殼、花生殼', 'Shrimp shells, peanut shells', ['shrimp shells on a plate', 'crab shells', 'peanut shells'], 'food', 'food', *FOOD, ['drain'], FB, 'Fish', 'none', '官方分類表：食材外殼是廚餘', {'has_food': True, 'shell': True}),
  ('flowers_leaves', '花、樹葉', 'Flowers, leaves', ['wilted cut flowers', 'a pile of fallen leaves'], 'food', 'food', *FOOD, [], FB, 'Flower', 'none', '', {'has_food': True, 'soft': True}),
  ('meat', '肉、內臟', 'Meat scraps', ['leftover meat scraps', 'raw chicken skin', 'fish leftovers'], 'food', 'food', *FOOD, ['drain'], FB, 'Meat', 'none', '大骨頭是一般垃圾', {'has_food': True, 'soft': True}),
  ('vegetables', '蔬菜、水果', 'Vegetables, fruit', ['vegetable scraps', 'rotten fruit', 'cabbage leaves'], 'food', 'food', *FOOD, ['drain'], FB, 'Carrot', 'none', '', {'has_food': True, 'soft': True}),
  ('frozen_food', '過期冷凍食品、調味料', 'Expired frozen food, seasoning', ['expired frozen dumplings', 'old seasoning sauce', 'expired spices'], 'food', 'food', *FOOD, ['empty'], FB, 'Snowflake', 'none', '倒出來放廚餘，包裝另外分類', {'has_food': True}),
  # ── 大型家具、家電暨四機類 ──────────────────────────────
  ('range_hood', '抽油煙機', 'Range hood', ['a kitchen range hood'], 'big', 'bulky', *BULKY, [], AP, 'Wind', 'adult', BULKY_NOTE, {}),
  ('mattress', '彈簧床墊', 'Spring mattress', ['an old spring mattress', 'a mattress leaning on a wall'], 'big', 'bulky', *BULKY, [], AP, 'Bed', 'adult', BULKY_NOTE, {'soft': True}),
  ('bed_frame', '床組', 'Bed frame', ['a wooden bed frame', 'a metal bed frame'], 'big', 'bulky', *BULKY, [], AP, 'Bed', 'adult', BULKY_NOTE, {}),
  ('cart', '手推車', 'Hand cart', ['a folding hand cart', 'a shopping trolley cart'], 'big', 'bulky', *BULKY, [], AP, 'ShoppingCart', 'adult', BULKY_NOTE, {}),
  ('bicycle', '腳踏車', 'Bicycle', ['an old bicycle', 'a rusty bike'], 'big', 'bulky', *BULKY, [], AP, 'Bike', 'adult', BULKY_NOTE, {}),
  ('electric_fan', '電風扇', 'Electric fan', ['an electric standing fan', 'a desk fan'], 'big', 'bulky', *BULKY, [], AP, 'CarFan', 'adult', BULKY_NOTE, {}),
  ('gas_stove', '瓦斯爐', 'Gas stove', ['a gas stove', 'a portable gas cooker'], 'big', 'bulky', *BULKY, [], AP, 'Flame', 'adult', BULKY_NOTE + '；卡式瓦斯罐要先拿出來', {}),
  ('water_dispenser', '大型飲水機', 'Water dispenser', ['a water dispenser', 'a drinking water cooler'], 'big', 'bulky', *BULKY, [], AP, 'Droplets', 'adult', BULKY_NOTE, {}),
  ('table_chair', '桌椅', 'Table, chair', ['an old wooden table', 'a broken office chair', 'a dining chair'], 'big', 'bulky', *BULKY, [], AP, 'Armchair', 'adult', BULKY_NOTE, {}),
  ('cabinet', '櫥櫃', 'Cabinet', ['a wooden cabinet', 'a wardrobe', 'a bookshelf'], 'big', 'bulky', *BULKY, [], AP, 'Building', 'adult', BULKY_NOTE, {}),
  ('tv', '電視機', 'Television', ['an old television set', 'a flat screen TV'], 'big', 'bulky', *BULKY, [], AP, 'DeviceTv', 'adult', BULKY_NOTE + '；也可以交給販賣業者回收', {}),
  ('fridge', '電冰箱', 'Refrigerator', ['a refrigerator', 'an old fridge'], 'big', 'bulky', *BULKY, [], AP, 'Fridge', 'adult', BULKY_NOTE + '；也可以交給販賣業者回收', {}),
  ('washing_machine', '洗衣機', 'Washing machine', ['a washing machine', 'a front loading washer'], 'big', 'bulky', *BULKY, [], AP, 'WashMachine', 'adult', BULKY_NOTE + '；也可以交給販賣業者回收', {}),
  ('air_conditioner', '冷氣機', 'Air conditioner', ['a window air conditioner', 'an air conditioning unit'], 'big', 'bulky', *BULKY, [], AP, 'AirConditioning', 'adult', BULKY_NOTE + '；也可以交給販賣業者回收', {}),  # ── 回收一點通（data/回收一點通_1031筆.tsv）列出、但上面的分類方式 CSV 沒有對應品項的東西（web/scripts/map-taipei-list.mjs 找出來的）──
  ('misc_trash', '原子筆、梳子等小東西', 'Pens, combs and small items', ['a ballpoint pen', 'a plastic hair comb', 'a waterproof shower cap', 'a pair of rubber gloves', 'a box of crayons', 'silicone earplugs'], 'home', 'general', *GEN, [], GT, 'Ballpen', 'none', '原子筆、筆芯、眉筆、蠟筆、梳子、耳塞、浴帽、手套都是一般垃圾；只剩外殼筆桿的原子筆是塑膠回收', {}),
  ('luggage', '行李箱', 'Suitcase', ['an old suitcase', 'a rolling luggage case', 'a hard shell travel suitcase'], 'big', 'bulky', *BULKY, [], RT + AP, 'Luggage', 'help', '2 個以下交給資源回收車（星期一、二、四、五、六）；3 個以上打電話和清潔隊約時間', {}),
]

MATERIAL = {'plastic': 'plastic', 'paper': 'paper', 'glass': 'glass', 'can': 'metal', 'metal': 'metal', 'tetra': 'paper', 'food': 'compost'}
HAZARD = {'phone': 'fire', 'tablet': 'fire', 'game_console': 'fire', 'mosquito_lamp': 'fire', 'pesticide_container': 'medical', 'lubricant': 'fire', 'gas_stove': 'fire'}

items = json.load(open(ITEMS, encoding='utf-8'))
have = {i['id'] for i in items}
added = 0
for (iid, zh, en, prompts, group, kind, cat, sub, steps, where, icon, safety, notes, attrs) in NEW:
    if iid in have:
        continue
    items.append({
        'id': iid, 'name': {'zh': zh, 'en': en, 'vi': en, 'id': en}, 'prompts': prompts, 'group': group, 'attrs': attrs,
        'category': cat, 'sub': sub, 'kind': kind, 'where': where, 'steps': steps,
        'material': MATERIAL.get(kind, 'none'), 'rarity': 2, 'freq': 1, 'hazard': HAZARD.get(iid, 'none'),
        'adult_only': safety == 'adult', 'safety': safety, **({'notes': notes} if notes else {}),
        'source': f'{SRC}（{sub}）', 'status': 'unknown', 'icon': icon,
    })
    added += 1

# 既有品項依官方 CSV 補充說明
for i in items:
    if i['id'] == 'old_book': i.setdefault('notes', '和其他廢紙分開綁；200 本以上請和清潔隊約時間')
    if i['id'] == 'light_tube': i['notes'] = '用紙套包好；含冷陰極燈、感應式螢光燈、HID 燈；LED 崁燈、燈條、手電筒是一般垃圾'
    if i['id'] == 'old_clothes': i['notes'] = '洗乾淨、不要弄濕、打包（含乾淨且彈性完整的女性內衣）；破舊、髒污、發臭的是一般垃圾'
    if i['id'] == 'furniture': i['name'] = {'zh': '沙發', 'en': 'Sofa', 'vi': 'Ghế sofa', 'id': 'Sofa'}; i['group'] = 'big'
    if i['id'] == 'small_appliance': i['group'] = 'device'
    # 回收一點通的品項：出處寫回收一點通的條目
    if i['id'] == 'misc_trash': i['source'] = '臺北市環保局「回收一點通」（原子筆、原子筆筆芯、眉筆、蠟筆、按摩梳、矽膠耳塞、防水浴帽、手套：一般垃圾）'
    if i['id'] == 'luggage': i['source'] = '臺北市環保局「回收一點通」（臺北市允收項目：廢行李箱 2 只以下交回收車、3 只以上約定時間）'
json.dump(items, open(ITEMS, 'w', encoding='utf-8'), ensure_ascii=False, indent=1)
print(f'added {added}, total {len(items)}')
