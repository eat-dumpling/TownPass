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
CHECKED = '2026-11-07'


def S(emoji, title, text=None, tip=None, warn=None, src=None, kind='rule'):
    """One preparation step. kind='rule' is an official requirement (src names the source);
    kind='tip' is a convenience suggestion and is labelled as such in the app."""
    d = {'emoji': emoji, 'title': title, 'kind': kind}
    if text: d['text'] = text
    if tip: d['tip'] = tip
    if warn: d['warn'] = warn
    if src: d['src'] = src
    return d


def C(name, group, note=None, item=None, verify=None, src=None):
    """A part of a multi-material item, with its own category and destination."""
    d = {'name': name, 'group': group}
    if note: d['note'] = note
    if item: d['item'] = item
    if verify: d['verify'] = verify
    if src: d['src'] = src
    return d

RINSE = S('🚿', T('Empty and rinse', '倒空、沖洗'), T('Pour out what is left and give it a quick rinse.', '倒掉剩餘內容物，簡單沖一下。'), src='bottlefaq')
RINSE_TIP = S('🚿', T('Empty and rinse', '倒空、沖洗'), T('Pour out what is left and give it a quick rinse.', '倒掉剩餘內容物，簡單沖一下。'), kind='tip')
DRY = S('💨', T('Let it dry', '晾乾'), T('Wet recyclables can make other items dirty.', '濕的回收物會弄髒其他回收物。'), kind='tip')
FLAT = S('🫓', T('Flatten it', '壓扁'), T('Squash it to save space.', '壓扁可以節省空間。'), src='bottlefaq')
FLAT_TIP = S('🫓', T('Flatten it', '壓扁'), T('Squash it to save space.', '壓扁可以節省空間。'), kind='tip')
CAP = S('🔩', T('Take off the cap if you can', '拆下瓶蓋'), T('Caps can go to recycling too.', '瓶蓋也能回收。'), kind='tip')
RIGID_HAND = T('Hand it to the crew on the recycling truck that follows the garbage truck (Tue / Thu / Sat). Free — no special bag needed.',
               '交給跟著垃圾車的資源回收車人員（二、四、六）。免費，不需專用垃圾袋。')
FLAT_HAND = T('Hand it to the crew on the recycling truck that follows the garbage truck (Mon / Fri). Free — no special bag needed.',
              '交給跟著垃圾車的資源回收車人員（一、五）。免費，不需專用垃圾袋。')
GEN_HAND = T('Put it in a Taipei official garbage bag, tie it, and throw it into the garbage truck yourself.',
             '裝進臺北市專用垃圾袋、綁好，自己丟進垃圾車。')
FOOD_HAND = T('Since 1 Jan 2026 household food waste is no longer split. Pour it all into the blue food-waste bucket at the back of the garbage truck. The empty bag it came in goes in your general trash.',
              '2026 年 1 月 1 日起家戶廚餘不再分養豬、堆肥兩桶，一律倒進垃圾車後方的藍色廚餘桶。裝廚餘的空袋子當一般垃圾。')
HAZ_HAND = T('Pack it well, keep it apart from other recyclables, and hand it to the recycling crew (Mon, Tue, Thu, Fri, Sat). Never put it in the garbage bag.',
             '確實包裝，與其他回收物分開，交給資源回收車人員（一、二、四、五、六）。絕對不要放進垃圾袋。')
VERIFY_HAND = T('We could not find an official rule for this item. Call your district cleaning squad or 1999 before throwing it out.',
                '目前查不到這項物品的官方規定。丟之前請先致電各區清潔隊或 1999 確認。')

# Official pages (checked on CHECKED). 'updated' is the page's own 資料更新 date.
SOURCES = [
    {'id': 'recycle', 'core': True, 'name': '臺北市資源回收分類方式（環保局，data.taipei）', 'url': 'https://data.taipei/dataset/detail?id=74643872-ee76-4727-bd02-d73b536eaad7'},
    {'id': 'truck', 'core': True, 'name': '臺北市垃圾車點位路線資訊（環保局，data.taipei）', 'url': 'https://data.taipei/dataset/detail?id=6bb3304b-4f46-4bb0-8cd1-60c66dcd1cae'},
    {'id': 'vendors', 'name': '臺北市專用垃圾袋代售點名冊（環保局，data.taipei）', 'url': 'https://data.taipei/dataset/detail?id=cd95ab7d-dd94-4825-a6c5-b2ea0329ff0f'},
    {'id': 'dropoffs', 'name': '臺北市垃圾資源回收、廚餘回收限時收受點（環保局，data.taipei）', 'url': 'https://data.taipei/dataset/detail?id=1acf38f3-1509-4cb1-898a-9b1d4f31a3af'},
    {'id': 'bagfee', 'name': '環保局 FAQ：隨袋徵收（資源、廚餘免用專用袋）', 'updated': '2025-01-23', 'url': 'https://www.dep.gov.taipei/News_Content.aspx?n=ACEFA960B5A4ACD7&s=63FEA0A6E11ECA67'},
    {'id': 'bagspec', 'name': '環保局：專用垃圾袋規格、重量與售價', 'updated': '2025-02-24', 'url': 'https://www.dep.gov.taipei/News_Content.aspx?n=9D5081C3BFCC977A&s=C7D8C02586900F63'},
    {'id': 'bagntpc', 'name': '環保局 FAQ：雙北專用垃圾袋互收', 'updated': '2026-10-25', 'url': 'https://www.dep.gov.taipei/News_Content.aspx?n=ACEFA960B5A4ACD7&s=9F2F954D1162CC97'},
    {'id': 'dualbag', 'name': '環保局：臺北市推動兩袋合一（環保兩用袋規格）', 'updated': '2018-01-03', 'url': 'https://epib.dep.gov.taipei/ct.asp?CtNode=87287&mp=110021&xItem=378550277'},
    {'id': 'dualbagfaq', 'name': '環保局 FAQ：環保兩用袋如何使用及購買', 'updated': '2026-10-25', 'url': 'https://www.dep.gov.taipei/News_Content.aspx?n=ACEFA960B5A4ACD7&s=92F8FF91993B40DA'},
    {'id': 'paperfaq', 'name': '環保局 FAQ：紙餐盒、牛奶盒、鋁箔包如何回收', 'updated': '2026-10-16', 'url': 'https://www.dep.gov.taipei/News_Content.aspx?n=ACEFA960B5A4ACD7&s=252B16B10D3CA3F9'},
    {'id': 'bottlefaq', 'name': '環保局 FAQ：瓶罐回收時之液體或氣體處理方式', 'updated': '2026-10-16', 'url': 'https://www.dep.gov.taipei/News_Content.aspx?n=ACEFA960B5A4ACD7&s=6054691617332AA6'},
    {'id': 'food2026', 'name': '環保局：115 年 1 月 1 日起廚餘收運新制', 'updated': '2026-02-03', 'url': 'https://epib.dep.gov.taipei/News_Content.aspx?n=408C712E96A4EDF5&s=8A1761680F0D50F3'},
    {'id': 'bulky', 'name': '環保局 FAQ：家戶大型廢棄物如何收運', 'updated': '2026-10-20', 'url': 'https://www.dep.gov.taipei/News_Content.aspx?n=ACEFA960B5A4ACD7&s=402ACF2A9AD6B8EB'},
    {'id': 'contact', 'name': '環保局聯絡資訊（1999、各區清潔隊電話）', 'updated': '2025-08-07', 'url': 'https://www.dep.gov.taipei/cp.aspx?n=F1AE8510EEF140EF'},
    {'id': 'collect', 'name': '環保局 FAQ：市民如何排出垃圾及回收物（週三、週日停收）', 'updated': '2026-10-20', 'url': 'https://www.dep.gov.taipei/News_Content.aspx?n=ACEFA960B5A4ACD7&s=A00A0483EDD01410'},
    {'id': 'flexible', 'name': '環保局 FAQ：非當天分類的回收物也不得拒收', 'updated': '2026-10-20', 'url': 'https://www.dep.gov.taipei/News_Content.aspx?n=ACEFA960B5A4ACD7&s=8FD4DD93A294185E'},
    {'id': 'dropoffpage', 'name': '環保局：垃圾、資源（廚餘）回收限時收受點', 'updated': '2026-04-24', 'url': 'https://www.dep.gov.taipei/News_Content.aspx?n=00CB5204D6AA86C0&s=558A0802F34F8F11'},
    {'id': 'law', 'name': '廢棄物清理法（全國法規資料庫）', 'url': 'https://law.moj.gov.tw/LawClass/LawAll.aspx?pcode=O0050001'},
    # Borrowed from the team's kids-recycle-village research (2026-11); pages not re-checked here.
    {'id': 'epa', 'name': '環境部資源回收網「回收一點通」', 'url': 'https://recycle.moenv.gov.tw/'},
    {'id': 'tfda', 'name': '衛福部食藥署：廢棄藥品處理方式', 'url': 'https://www.fda.gov.tw/'},
]

BAGS = {
    'src': ['bagspec', 'bagfee', 'bagntpc', 'dualbag', 'dualbagfaq', 'vendors'],
    'checked': CHECKED,
    # 環保局「專用垃圾袋介紹」表格（資料更新 114-02-24）
    'sizes': [
        {'liters': 3, 'perPack': 20, 'packPrice': 21, 'maxKg': 0.6, 'type': 'handle'},
        {'liters': 5, 'perPack': 20, 'packPrice': 36, 'maxKg': 1.0, 'type': 'handle'},
        {'liters': 14, 'perPack': 20, 'packPrice': 100, 'maxKg': 2.9, 'type': 'handle'},
        {'liters': 25, 'perPack': 20, 'packPrice': 180, 'maxKg': 5.1, 'type': 'handle'},
        {'liters': 33, 'perPack': 20, 'packPrice': 237, 'maxKg': 6.9, 'type': 'flat'},
        {'liters': 76, 'perPack': 10, 'packPrice': 273, 'maxKg': 15.9, 'type': 'flat'},
        {'liters': 120, 'perPack': 5, 'packPrice': 216, 'maxKg': 25.1, 'type': 'flat'},
    ],
    'retail': [{'liters': 3, 'price': 1}, {'liters': 14, 'price': 5}],
    'dual': [{'size': T('Small', '小'), 'liters': 3, 'price': 1}, {'size': T('Medium', '中'), 'liters': 6, 'price': 2},
             {'size': T('Large', '大'), 'liters': 14, 'price': 5}],
    'rules': [
        {'text': T('General household trash must go in an official bag (Taipei per-bag fee).', '一般家戶垃圾必須裝在專用垃圾袋（臺北市垃圾費隨袋徵收）。'), 'src': 'bagfee'},
        {'text': T('Recyclables and food waste, sorted as required, are collected free — no official bag needed.', '依規定分好的資源回收物和廚餘免費回收，不用專用袋。'), 'src': 'bagfee'},
        {'text': T('Fill only up to the line printed on the bag. About 30% above the line is left for tying. Tie it with the handles, rope or tape. Do not squeeze it so hard that it tears or leaks.',
                   '裝到袋上的容量上限線為止，線上約 30% 留作綁口。用提耳、繩子或膠帶綁好。不要過度擠壓，以免破裂、滴漏。'), 'src': 'bagspec'},
        {'text': T('New Taipei official bags (including their dual-use and all-purpose bags) are also accepted in Taipei.', '新北市專用垃圾袋（含環保兩用袋、萬用袋）在臺北市也可以使用。'), 'src': 'bagntpc'},
        {'text': T('Bags 33 L and up are flat-top; 25 L and under have handles. Real bags carry an anti-counterfeit label.', '33 公升以上為平口式，25 公升以下為提耳式。真品有防偽標籤。'), 'src': 'bagspec'},
        {'text': T('Not using an official bag can be fined from NT$1,200.', '未使用專用垃圾袋，可處 1,200 元起罰鍰。'), 'src': 'law'},
    ],
    'dualNote': T('Dual-use bags are the shopping bags sold at supermarkets and chain convenience stores. You can only get them with a purchase (no packs, no buying them alone). After shopping, use them as official garbage bags.',
                  '環保兩用袋是量販店、超市、連鎖便利商店結帳時的購物袋，只能購物時依需求購買（不整包賣、未購物不可單獨買）。購物後可當專用垃圾袋使用。'),
    'advice': T('Suggestion, not a rule: pick the smallest bag that fits what you actually throw out, by volume and weight, with room left to tie it. Small amounts thrown out often: start with 3 L or 5 L. A few days of household trash: compare 14 L and 25 L. More than that: 33 L and up. A photo of one item cannot tell how big your whole bag needs to be.',
                '產品建議（非規定）：依實際要丟的體積和重量，挑能裝得下又能綁口的最小規格。少量且常倒：從 3 或 5 公升開始；累積幾天的家戶垃圾：比較 14 和 25 公升；更多再考慮 33 公升以上。拍一件物品無法推算整袋需要多大。'),
}

# District cleaning squads (環保局聯絡資訊, 資料更新 114-08-07).
CONTACTS = {
    'src': 'contact', 'hotline': '1999', 'dep': '02-2720-8889', 'bulkyInfo': '02-2728-7267',
    'online': 'https://1999.gov.taipei/Front/main',
    'squads': {'萬華區': '02-2302-2988', '大同區': '02-2594-9904', '中山區': '02-2503-3447', '信義區': '02-2723-4982',
               '大安區': '02-2737-1303', '松山區': '02-2514-7712', '中正區': '02-2332-0725', '內湖區': '02-2791-7730',
               '文山區': '02-2936-3050', '南港區': '02-2783-4725', '士林區': '02-2883-0962', '北投區': '02-2821-8867'},
}

rules = {
    'version': CHECKED,
    'checked': CHECKED,
    'sources': SOURCES,
    'categories': {
        'general': {'emoji': '🗑️', 'where': T('Garbage truck, in an official bag', '垃圾車，須用專用垃圾袋')},
        'recycle': {'emoji': '♻️', 'where': T('Recycling truck on the same route, free', '同路線的資源回收車，免費')},
        'food': {'emoji': '🍌', 'where': T('Blue food-waste bucket at the back of the garbage truck', '垃圾車後方的藍色廚餘桶')},
        'special': {'emoji': '🔋', 'where': T('Recycling truck, packed separately', '資源回收車，分開包裝')},
        'bulky': {'emoji': '🛋️', 'where': T('Book a pickup with the cleaning squad', '預約清潔隊收運')},
        'verify': {'emoji': '❓', 'where': T('Ask the cleaning squad first', '先洽清潔隊確認')},
    },
    # Collection days, 0 = Sunday. bag: required | exempt | booking | unknown.
    # flexible: the days are the suggested days; crews may not refuse sorted recyclables on
    # other collection days (環保局 FAQ 非當天分類的回收物).
    'groups': {
        'general': {'cat': 'general', 'days': MTWFS, 'bag': 'required', 'src': ['collect', 'bagfee']},
        'rigid': {'cat': 'recycle', 'days': [2, 4, 6], 'flexible': True, 'bag': 'exempt', 'src': ['recycle', 'flexible'],
                  'label': T('Bottles, cans, containers, plastics, styrofoam, small electronics', '立體類：瓶罐、容器、塑膠、保麗龍、小家電')},
        'flat': {'cat': 'recycle', 'days': [1, 5], 'flexible': True, 'bag': 'exempt', 'src': ['recycle', 'flexible'],
                 'label': T('Paper, clean clothes, clean plastic bags, books', '平面類：紙類、乾淨舊衣、乾淨塑膠袋、舊書')},
        'food': {'cat': 'food', 'days': MTWFS, 'bag': 'exempt', 'src': ['recycle', 'food2026']},
        'hazard': {'cat': 'special', 'days': MTWFS, 'bag': 'exempt', 'src': ['recycle'],
                   'label': T('Batteries, bulbs and tubes, cooking oil, pesticide containers', '電池、燈管燈泡、廢油、環境用藥容器')},
        'bulky': {'cat': 'bulky', 'days': [1, 2, 3, 4, 5, 6], 'booking': True, 'bag': 'booking', 'src': ['bulky', 'contact'],
                  'note': T('Free for households. Call your district cleaning squad (or 1999) at least one day before. Pickup Mon–Sat, none on Sunday. Many squads ask you to put it out after 9 pm.',
                            '家戶免費。至少前一天打給轄區清潔隊（或 1999）預約時間地點。週一至週六收運，週日不收。多數清潔隊請你晚上 9 點後再拿出來。')},
        'verify': {'cat': 'verify', 'days': [], 'bag': 'unknown', 'src': ['contact'], 'ask': True,
                   'note': T('No official rule found yet — ask before throwing it out.', '尚未查到官方規定，丟之前請先詢問。')},
    },
    'contacts': CONTACTS,
    'bags': BAGS,
    'items': [
        # ---- rigid recyclables (suggested Tue/Thu/Sat)
        {'id': 'pet', 'emoji': '🧴', 'group': 'rigid', 'name': T('Plastic bottle (PET)', '寶特瓶'), 'keywords': ['pet', 'water bottle', 'plastic bottle', '塑膠瓶', '水瓶'],
         'src': ['recycle', 'bottlefaq'], 'steps': [RINSE, FLAT, CAP], 'handover': RIGID_HAND},
        {'id': 'can', 'emoji': '🥫', 'group': 'rigid', 'name': T('Drink / food can (aluminum, tin)', '鐵鋁罐'), 'keywords': ['soda', 'beer', 'tin', 'aluminum', '易開罐', '罐頭'],
         'src': ['recycle', 'bottlefaq'], 'steps': [RINSE, FLAT], 'handover': RIGID_HAND,
         'warn': T('Spray or pressure cans are different — see "Spray can".', '噴霧罐另外處理，請看「噴霧罐」。')},
        {'id': 'glass', 'emoji': '🍾', 'group': 'rigid', 'name': T('Glass bottle / jar', '玻璃瓶罐'), 'keywords': ['wine', 'jar', 'beer bottle', '酒瓶', '玻璃罐'],
         'src': ['recycle', 'bottlefaq'], 'steps': [
             S('🚿', T('Empty and rinse — do not flatten', '倒空、沖洗'), T('Glass only needs rinsing.', '玻璃容器清洗即可。'), src='bottlefaq'),
             S('🧤', T('Keep it whole', '保持完整'), T('Hand it over unbroken so nobody gets cut.', '完整交出，避免割傷清潔人員。'), kind='tip')],
         'handover': RIGID_HAND, 'warn': T('Broken glass is handled differently — see "Broken glass".', '破玻璃另外處理，請看「破玻璃」。')},
        {'id': 'carton', 'emoji': '🧃', 'group': 'rigid', 'name': T('Drink carton / juice box', '紙盒包、鋁箔包'), 'keywords': ['milk', 'tetra', 'juice box', '牛奶盒', '利樂包', '紙盒'],
         'src': ['paperfaq', 'recycle'],
         'components': [
             C(T('Carton', '紙盒／鋁箔包本體'), 'rigid', T('3-D recyclable (Tue/Thu/Sat suggested).', '立體類資源回收物（建議二、四、六）。'), src='paperfaq'),
             C(T('Straw and its wrapper', '吸管與吸管包裝'), 'general', item='straw',
               verify=T('The current official FAQ does not say where straws go. Older city leaflets say general trash; please confirm with your cleaning squad.', '現行官方 FAQ 沒有寫吸管的去向；較舊的宣導資料列為一般垃圾，請向清潔隊確認。'))],
         'steps': [
             S('🥤', T('Take out the straw', '抽出吸管'), T('Check what is left inside first.', '先確認裡面還有沒有剩。'), kind='tip'),
             RINSE_TIP, FLAT_TIP],
         'handover': RIGID_HAND},
        {'id': 'cup', 'emoji': '🧋', 'group': 'rigid', 'name': T('Plastic drink cup (bubble tea)', '手搖飲杯（塑膠）'), 'keywords': ['boba', 'bubble tea', 'drink cup', '飲料杯'],
         'src': ['recycle'],
         'components': [
             C(T('Drink, ice and pearls', '飲料、冰塊、珍珠'), 'food', T('Pour the drink away. Pearls and other toppings are food.', '飲料倒掉；珍珠等配料屬食材。'), item='leftovers',
               verify=T('Not listed item by item by the city. Do as shown here; if unsure, call 1999.', '官方清單沒有逐項列出；照這裡做，不確定可撥 1999 問清潔隊。')),
             C(T('Plastic cup', '塑膠杯身'), 'rigid', T('A container: 3-D recyclable.', '屬容器，立體類回收。'), src='recycle'),
             C(T('Sealing film and straw', '封膜、吸管'), 'general', item='straw',
               verify=T('The current official FAQ does not say where these go. Older leaflets say general trash; please confirm.', '現行官方 FAQ 未列出去向；較舊的宣導資料列為一般垃圾，請確認。'))],
         'steps': [
             S('🧋', T('Empty it', '倒掉飲料'), T('Pour out the drink and toppings.', '倒掉飲料與配料。'), kind='tip'),
             S('✂️', T('Separate the parts', '撕膜、抽吸管'), T('Peel off the film and take out the straw.', '撕下封膜、抽出吸管。'), kind='tip'),
             RINSE_TIP],
         'handover': RIGID_HAND},
        {'id': 'papercup', 'emoji': '☕', 'group': 'rigid', 'name': T('Paper cup', '紙杯'), 'keywords': ['coffee cup', 'paper cup', '咖啡杯'],
         'src': ['paperfaq', 'recycle'], 'basis': 'inferred',
         'verify': T('The city FAQ lists paper meal boxes and drink cartons as 3-D recyclables but does not name paper cups. We show the paper-container rule; please confirm with your cleaning squad.',
                     '環保局 FAQ 把紙餐盒、紙盒包列為立體類，但沒有寫到紙杯。這裡比照紙容器顯示，請向清潔隊確認。'),
         'components': [
             C(T('Paper cup', '紙杯本體'), 'rigid', T('Paper container: 3-D recyclable, not flat paper.', '紙容器屬立體類，不是平面紙類。')),
             C(T('Plastic lid', '塑膠杯蓋'), 'rigid', T('Plastic: 3-D recyclable.', '塑膠，立體類回收。'))],
         'steps': [RINSE_TIP], 'handover': RIGID_HAND},
        {'id': 'lunchbox', 'emoji': '🍱', 'group': 'rigid', 'name': T('Plastic / paper lunch box', '餐盒'), 'keywords': ['bento', 'takeout box', 'food container', '便當盒', '外帶盒', '紙餐盒'],
         'src': ['paperfaq', 'recycle'],
         'components': [
             C(T('Leftover food', '剩菜'), 'food', item='leftovers', src='recycle'),
             C(T('Box', '餐盒本體'), 'rigid', T('Paper or plastic meal box: 3-D recyclable.', '紙或塑膠餐盒：立體類回收。'), src='paperfaq')],
         'steps': [S('🍚', T('Scrape out the food', '倒出剩菜'), T('Leftover food goes to food waste.', '剩菜當廚餘。'), kind='tip'), RINSE_TIP, DRY],
         'warn': T('Wooden lunch boxes are NOT recyclable — general trash.', '木片餐盒是一般垃圾。'), 'handover': RIGID_HAND},
        {'id': 'styrofoam', 'emoji': '📦', 'group': 'rigid', 'name': T('Styrofoam', '保麗龍'), 'keywords': ['foam', 'packing', 'polystyrene', '緩衝材', '保麗龍碗'],
         'src': ['recycle'], 'steps': [
            S('🧽', T('Keep it clean', '保持乾淨'), T('Only clean styrofoam is recycled.', '只收乾淨的保麗龍。'), src='recycle')],
            'warn': T('Sponge / foam filling (泡棉) is not recyclable.', '泡棉、海綿不可回收。'), 'handover': RIGID_HAND},
        {'id': 'fruitnet', 'emoji': '🍐', 'group': 'rigid', 'name': T('Fruit foam net', '水果網套'), 'keywords': ['fruit net', 'mesh', '網套'], 'src': ['recycle'], 'steps': [], 'handover': RIGID_HAND},
        {'id': 'phone', 'emoji': '📱', 'group': 'rigid', 'name': T('Old phone / small electronics', '手機、小家電'), 'keywords': ['mobile', 'hair dryer', 'mouse', 'keyboard', 'charger', '吹風機', '滑鼠', '鍵盤', '電腦'],
         'src': ['recycle'], 'steps': [
            S('🔐', T('Delete your data', '刪除個人資料'), T('Factory-reset phones and computers first.', '手機、電腦先回復原廠設定。'), kind='tip'),
            S('🔋', T('Take out batteries you can remove', '拆出可拆的電池'), T('Batteries are recycled separately.', '電池要另外回收。'), kind='tip')], 'handover': RIGID_HAND},
        {'id': 'plastic', 'emoji': '🪣', 'group': 'rigid', 'name': T('Other hard plastic / metal', '廢塑膠、廢金屬'), 'keywords': ['bucket', 'pot', 'pan', 'hanger', '臉盆', '鍋子', '衣架'],
         'src': ['recycle'], 'steps': [RINSE_TIP], 'handover': RIGID_HAND},
        {'id': 'coconut', 'emoji': '🥥', 'group': 'rigid', 'name': T('Coconut / durian shell', '椰子殼、榴槤殼'), 'keywords': ['coconut', 'durian'], 'src': ['recycle'], 'steps': [
            S('🚫', T('Not food waste', '不是廚餘'), T('Do not mix them into food waste. Collect them separately.', '不要混在廚餘裡，另外收集。'), src='recycle')],
            'handover': T('Hand them to the recycling truck crew, separate from food waste.', '另外收集後交給資源回收車。')},
        # ---- flat recyclables (suggested Mon/Fri)
        {'id': 'paper', 'emoji': '📰', 'group': 'flat', 'name': T('Paper, newspaper, boxes', '紙張、報紙、紙箱'), 'keywords': ['cardboard', 'magazine', 'box', 'sheet', 'a4', '報紙', '雜誌', '紙箱', '紙袋', '影印紙'],
         'src': ['paperfaq', 'recycle'], 'steps': [
            S('☔', T('Keep it dry', '保持乾燥'), T('Only paper that can be laid flat and is clean and dry.', '可攤平、乾淨乾燥的紙類。'), src='recycle'),
            S('📦', T('Flatten boxes', '紙箱攤平'), T('Remove tape and flatten.', '撕掉膠帶，攤平。'), kind='tip'),
            S('🪢', T('Bundle and tie', '綁成一疊'), T('Tie paper into a bundle so it does not fly away.', '綁好避免飛散。'), kind='tip')],
            'warn': T('Paper cups, meal boxes and drink cartons are containers (3-D), not flat paper. Greasy paper, tissues, laminated glossy paper and photo paper are general trash.',
                      '紙杯、紙餐盒、牛奶盒不算紙類，算立體類。油紙、衛生紙、亮面紙、照片是一般垃圾。'), 'handover': FLAT_HAND},
        {'id': 'clothes', 'emoji': '👕', 'group': 'flat', 'name': T('Clean old clothes', '乾淨舊衣'), 'keywords': ['shirt', 'jeans', 'clothing', '衣服', '褲子'], 'src': ['recycle'], 'steps': [
            S('🧺', T('Wash and dry', '洗淨晾乾'), T('Only clean, dry clothes are accepted.', '只收乾淨、乾燥的衣物。'), src='recycle'),
            S('🛍️', T('Bag them', '裝袋'), T('Put them in any bag.', '用任何袋子裝好。'), kind='tip')],
            'warn': T('Towels, socks, underpants, bedding, curtains and torn or smelly clothes are general trash.', '毛巾、襪子、內褲、棉被、窗簾、破舊衣物是一般垃圾。'), 'handover': FLAT_HAND},
        {'id': 'bag', 'emoji': '🛍️', 'group': 'flat', 'name': T('Clean plastic bag', '乾淨塑膠袋'), 'keywords': ['shopping bag', '購物袋'], 'src': ['recycle'], 'steps': [
            S('🧽', T('Must be clean', '要乾淨'), T('No oil, soup or blood.', '不能有油漬、湯汁、血水。'), src='recycle'),
            S('🗂️', T('Stuff bags into one bag', '集中裝成一袋'), kind='tip')],
            'warn': T('Snack and chip bags (shiny, mixed material) are general trash.', '零食包裝袋是一般垃圾。'), 'handover': FLAT_HAND},
        {'id': 'books', 'emoji': '📚', 'group': 'flat', 'name': T('Old books', '舊書'), 'keywords': ['book', 'textbook', '書'], 'src': ['recycle'], 'steps': [
            S('🪢', T('Tie them apart from other paper', '和其他紙類分開綁'), T('200 books or more: arrange a time with the cleaning squad.', '200 本以上請與各區清潔隊約定時間。'), src='recycle')], 'handover': FLAT_HAND},
        # ---- food waste
        {'id': 'peel', 'emoji': '🍌', 'group': 'food', 'name': T('Fruit & vegetable scraps', '果皮、菜葉'), 'keywords': ['banana', 'peel', 'vegetable', 'fruit', '香蕉皮', '菜渣'],
         'src': ['recycle', 'food2026'], 'steps': [
            S('💧', T('Drain it', '瀝乾'), T('Drain the water before you take it out.', '廚餘瀝乾再拿出去。'), src='food2026'),
            S('🧊', T('Store it cold', '冷藏保存'), T('A sealed box in the fridge keeps the smell down until truck day.', '用密封盒放冰箱，等收運日再拿出。'), kind='tip')], 'handover': FOOD_HAND},
        {'id': 'leftovers', 'emoji': '🍲', 'group': 'food', 'name': T('Leftover food, meat, bones', '剩飯剩菜、肉類'), 'keywords': ['rice', 'noodle', 'meat', 'chicken', 'leftover', '剩飯', '骨頭', '廚餘'],
         'src': ['recycle', 'food2026'], 'steps': [
            S('💧', T('Drain the soup', '瀝乾湯汁'), T('Drain it before you take it out.', '瀝乾再拿出去。'), src='food2026'),
            S('🧻', T('Take off wrappers and bags', '拆掉包材'), T('Only the food goes in the bucket; wrappers and bags are general trash.', '只有食物倒進桶裡，包材、袋子當一般垃圾。'), kind='tip'),
            S('🪣', T('Pour into the blue bucket', '倒進藍色廚餘桶'), T('At the back of the garbage truck. Follow the crew on the spot.', '在垃圾車後方，依現場人員指示。'), src='food2026')], 'handover': FOOD_HAND},
        {'id': 'tea', 'emoji': '🍵', 'group': 'food', 'name': T('Tea leaves / coffee grounds', '茶渣、咖啡渣'), 'keywords': ['coffee', 'tea', '茶葉'], 'src': ['recycle'], 'steps': [
            S('🫖', T('Remove the tea bag / filter', '拿掉茶包袋、濾紙'), T('The bag or filter paper goes in general trash.', '茶包袋、濾紙當一般垃圾。'), kind='tip')], 'handover': FOOD_HAND},
        # ---- hazardous / special (no generic flatten or take-apart steps)
        {'id': 'battery', 'emoji': '🔋', 'group': 'hazard', 'name': T('Batteries / power bank', '電池、行動電源'), 'keywords': ['aa', 'aaa', 'power bank', '乾電池'],
         'src': ['recycle', 'epa'], 'takeback': True, 'steps': [
            S('🛍️', T('Pack them separately', '包好，另外裝'), src='recycle'),
            S('🩹', T('Tape the ends', '電極貼膠帶'), T('Cover the metal ends to prevent short circuits.', '貼住兩端避免短路。'), kind='tip')],
            'warn': T('Never put batteries in the garbage bag, and never crush or take them apart.', '不能丟垃圾袋，不要壓扁或拆開。'), 'handover': HAZ_HAND},
        {'id': 'bulb', 'emoji': '💡', 'group': 'hazard', 'name': T('Light bulb / fluorescent tube', '燈泡、燈管'), 'keywords': ['lamp', 'led', 'tube', '日光燈'], 'src': ['recycle', 'epa'], 'takeback': True, 'steps': [
            S('📦', T('Pack it separately', '包好，另外裝'), T('Put it back in its box or wrap it in paper.', '放回原包裝或用紙包好。'), src='recycle'),
            S('🧤', T('Keep it whole', '保持完整'), T('Tubes contain mercury.', '燈管含汞。'), kind='tip')], 'handover': HAZ_HAND},
        {'id': 'oil', 'emoji': '🫗', 'group': 'hazard', 'name': T('Used cooking oil', '廢食用油'), 'keywords': ['frying oil', '油'], 'src': ['recycle'], 'steps': [
            S('🍶', T('Pour into a bottle and cap it', '倒進瓶子並蓋緊'), T('Let it cool first.', '先放涼。'), kind='tip')],
            'warn': T('Do not pour oil down the sink.', '不要倒進水槽。'), 'handover': HAZ_HAND},
        {'id': 'spray', 'emoji': '🧯', 'group': 'hazard', 'name': T('Spray / pressure can', '噴霧罐、壓力罐'), 'keywords': ['aerosol', 'hairspray', 'spray', 'gas can', '髮膠', '芳香劑', '瓦斯罐', '殺蟲劑'],
         'src': ['bottlefaq'], 'steps': [
            S('🌬️', T('Empty it outdoors', '到戶外排空'), T('Release what is left in an open area, or into something absorbent.', '回收前到空曠處把內容物排出，或排到可吸附的材質上。'), src='bottlefaq')],
         'warn': T('Do not puncture, crush or burn a pressure can. Gas cylinders (瓦斯桶) go back to the shop that sold them.', '不要刺穿、壓扁或燒。瓦斯桶交回買的店。'),
         'handover': T('After emptying it, hand it to the recycling truck crew.', '排空後交給資源回收車。')},
        {'id': 'medicine', 'emoji': '🧪', 'group': 'hazard', 'name': T('Mercury thermometer / pesticide container', '水銀體溫計、環境用藥空容器'), 'keywords': ['mercury', 'insecticide', 'pesticide', '殺蟲劑', '農藥'],
         'src': ['recycle', 'bottlefaq'], 'steps': [
            S('🚿', T('Pesticide containers: rinse 3 times', '用清水沖三次'), src='bottlefaq'),
            S('🛍️', T('Bag it apart from other recyclables', '另外裝一袋'), src='bottlefaq')], 'handover': HAZ_HAND},
        # ---- general trash
        {'id': 'tissue', 'emoji': '🧻', 'group': 'general', 'name': T('Used tissues, diapers', '用過的衛生紙、尿布'), 'keywords': ['toilet paper', 'napkin', 'diaper', 'wet wipe', 'tissue', '衛生紙', '紙尿布', '濕紙巾'],
         'src': ['recycle', 'bagspec'], 'steps': [
            S('🛍️', T('Put it in an official bag', '裝進專用垃圾袋'), T('Up to the fill line, then tie it.', '裝到容量上限線，綁好。'), src='bagspec')], 'handover': GEN_HAND},
        {'id': 'snackbag', 'emoji': '🍟', 'group': 'general', 'name': T('Snack / chip bag', '零食包裝袋'), 'keywords': ['chips', 'cookie wrapper', '餅乾袋'], 'src': ['recycle'], 'steps': [], 'handover': GEN_HAND},
        {'id': 'dirtybag', 'emoji': '🛍️', 'group': 'general', 'name': T('Dirty / oily plastic bag', '髒污塑膠袋'), 'keywords': ['greasy bag', '油膩'], 'src': ['recycle'], 'steps': [], 'handover': GEN_HAND},
        {'id': 'straw', 'emoji': '🥤', 'group': 'general', 'name': T('Straws, cup sealing film', '吸管、封膜'), 'keywords': ['straw', 'film', '杯膜'], 'basis': 'legacy',
         'verify': T('Not listed item by item by the city. Put it in an official bag as general trash; if unsure, call 1999.', '官方清單沒有逐項列出；先當一般垃圾裝專用袋，不確定可撥 1999 問清潔隊。'), 'steps': [], 'handover': GEN_HAND},
        {'id': 'woodbox', 'emoji': '🥡', 'group': 'general', 'name': T('Wooden lunch box', '木片餐盒'), 'keywords': ['wood', '木盒'], 'src': ['recycle'], 'steps': [], 'handover': GEN_HAND},
        {'id': 'shoes', 'emoji': '👟', 'group': 'general', 'name': T('Shoes', '鞋子'), 'keywords': ['sneakers', 'slippers', '拖鞋'], 'src': ['recycle'], 'steps': [], 'handover': GEN_HAND},
        {'id': 'toy', 'emoji': '🧸', 'group': 'general', 'name': T('Stuffed toy, balls', '布偶、球類'), 'keywords': ['plush', 'teddy', 'ball', '絨毛玩具'], 'src': ['recycle'], 'steps': [], 'handover': GEN_HAND},
        {'id': 'towel', 'emoji': '🧣', 'group': 'general', 'name': T('Towels, socks, bedding', '毛巾、襪子、棉被'), 'keywords': ['pillow', 'blanket', 'sheet', 'curtain', '枕頭', '床單'], 'src': ['recycle'], 'steps': [], 'handover': GEN_HAND},
        {'id': 'receipt', 'emoji': '🧾', 'group': 'general', 'name': T('Sticker backing, photo paper, glossy paper', '貼紙底紙、照片紙、上膜光面紙'), 'keywords': ['receipt', 'sticker', 'photo', '收據'], 'src': ['recycle'], 'steps': [], 'handover': GEN_HAND},
        {'id': 'butt', 'emoji': '🚬', 'group': 'general', 'name': T('Cigarette butts, dust', '菸蒂、灰塵'), 'keywords': ['cigarette', 'ash', '掃地'], 'basis': 'inferred',
         'verify': T('Not listed item by item by the city. Put it in an official bag as general trash; if unsure, call 1999.', '官方清單沒有逐項列出；先當一般垃圾裝專用袋，不確定可撥 1999 問清潔隊。'), 'steps': [
            S('💧', T('Make sure it is out', '確認熄滅'), kind='tip')], 'handover': GEN_HAND},
        {'id': 'pills', 'emoji': '💊', 'group': 'general', 'name': T('Expired medicine (pills)', '過期藥品'), 'keywords': ['medicine', 'pills', 'drug', '藥', '藥丸', '過期藥'],
         'src': ['tfda'], 'steps': [
            S('🫙', T('Out of the blister, into a zip bag', '藥丸倒進夾鏈袋'), src='tfda'),
            S('☕', T('Mix with used tea leaves or coffee grounds', '混入茶渣或咖啡渣'), T('So nobody can pick them out.', '避免被誤食或撿用。'), src='tfda'),
            S('🔒', T('Seal it and put it in general trash', '封好，丟一般垃圾'), src='tfda')],
         'warn': T('Do not pour medicine down the sink or toilet. Special medicines (e.g. anti-cancer drugs) go back to a hospital or pharmacy.', '不要倒進水槽或馬桶。抗癌藥交回醫院或藥局。'),
         'handover': GEN_HAND},
        {'id': 'ceramic', 'emoji': '🍽️', 'group': 'hazard', 'name': T('Broken bowls, plates, ceramics', '破碗盤、陶瓷'), 'keywords': ['bowl', 'plate', 'ceramic', 'mug', '碗', '盤子', '陶瓷'],
         'src': ['epa'], 'steps': [
            S('📰', T('Wrap it in newspaper', '用報紙包好'), T('So the crew does not get cut.', '避免割傷清潔人員。'), src='epa'),
            S('🏷️', T('Write "broken" on it', '寫上「碎片」'), kind='tip')],
         'warn': T('Ceramics are not recyclable but cannot be burned, so they go to the recycling truck, wrapped.', '陶瓷不能回收，包好交給回收車。'),
         'handover': T('Hand it to the recycling truck crew, wrapped.', '包好交給資源回收車。')},
        # ---- needs checking
        {'id': 'brokenglass', 'emoji': '🪟', 'group': 'verify', 'name': T('Broken glass', '破玻璃'), 'keywords': ['shards', 'broken', '碎玻璃', '玻璃碎片'],
         'verify': T('We could not find a current official rule for broken glass.', '目前查不到碎玻璃的現行官方規定。'),
         'steps': [S('🧤', T('Wrap it safely', '安全包好'), T('Wrap it in thick paper and write "broken glass" on it, so nobody gets cut.', '用厚紙包好並寫上「碎玻璃」，避免有人割傷。'), kind='tip')],
         'handover': VERIFY_HAND},
        # ---- bulky
        {'id': 'furniture', 'emoji': '🛋️', 'group': 'bulky', 'name': T('Sofa, mattress, furniture, bicycle', '沙發、床墊、家具、腳踏車'), 'keywords': ['sofa', 'couch', 'bed', 'table', 'chair', 'cabinet', 'bike', 'suitcase', '桌椅', '櫃子', '腳踏車', '行李箱'],
         'src': ['bulky', 'contact'], 'steps': [
            S('☎️', T('Book first', '先預約'), T('Call your district cleaning squad or 1999 at least one day before. Tell them your address and the items; they set the day, time and place.', '至少前一天打給轄區清潔隊或 1999，說明地址和物品，清潔隊會約定日期、時間與地點。'), src='bulky'),
            S('🏠', T('Put it out as agreed', '依約定交付'), T('Usually after 9 pm on the agreed day. Do not add items you did not book.', '多半是約定日晚上 9 點後。不要夾帶未預約的物品。'), src='bulky')],
            'warn': T('Do not leave furniture on the street without booking. Households only — shops and companies arrange their own.', '沒預約不能丟路邊。只收家戶的。')},
        {'id': 'appliance', 'emoji': '📺', 'group': 'bulky', 'name': T('TV, fridge, washer, A/C, range hood', '電視、冰箱、洗衣機、冷氣、抽油煙機'), 'keywords': ['television', 'refrigerator', 'washing machine', 'air conditioner', 'fan', '電風扇', '瓦斯爐'],
         'src': ['bulky', 'contact'], 'steps': [
            S('☎️', T('Book first', '先預約'), T('Call your district cleaning squad or 1999 at least one day before.', '至少前一天打給轄區清潔隊或 1999 預約。'), src='bulky')]},
    ],
    'guide': [],  # filled below
}

# Every item gets an explicit bag answer derived from its group.
for it in rules['items']:
    it['bag'] = rules['groups'][it['group']]['bag']
    it.setdefault('basis', 'official' if it.get('src') else 'inferred')
ids = [i['id'] for i in rules['items']]
assert len(ids) == len(set(ids))
srcids = {s['id'] for s in SOURCES}
for it in rules['items']:
    for ref in it.get('src', []) + [st.get('src') for st in it['steps'] if st.get('src')] + [c.get('src') for c in it.get('components', []) if c.get('src')]:
        assert ref in srcids, (it['id'], ref)
    for c in it.get('components', []):
        assert c['group'] in rules['groups'], (it['id'], c)
    for st in it['steps']:
        assert st['kind'] == 'tip' or st.get('src'), (it['id'], st['title'])
# Hazard items must not reuse the generic flatten / take-apart steps.
for it in rules['items']:
    if it['group'] == 'hazard':
        assert not any(st is FLAT or st is FLAT_TIP for st in it['steps']), it['id']

rules['guide'] = [
    S('🛍️', T('Buy official garbage bags', '買專用垃圾袋'),
      T('General trash must go in a Taipei City official garbage bag (New Taipei bags are accepted too). Sizes 3 L–120 L, e.g. 14 L: NT$100 for 20 bags, or NT$5 for one retail bag. See "Official garbage bags" for sizes and where to buy.',
        '一般垃圾必須裝在臺北市專用垃圾袋（新北市專用袋也可以）。容量 3–120 公升，例如 14 公升一包 20 個 100 元，零售單個 5 元。容量與代售點請看「專用垃圾袋」。'),
      tip=T('Recycling, food waste and bulky-waste pickup are free — no special bag needed.', '資源回收、廚餘與大型廢棄物預約收運都免費，不需專用袋。'),
      warn=T('Not using an official bag can be fined from NT$1,200 (Waste Disposal Act).', '未使用專用垃圾袋，依廢棄物清理法可處 1,200 元起罰鍰。')),
    S('🧺', T('Sort at home into 3', '在家分成三類'),
      T('1. General trash (official bag)  2. Recycling (any bag)  3. Food waste (a box or bag).',
        '1. 一般垃圾（專用袋）2. 資源回收（任何袋子）3. 廚餘（盒子或袋子）。'),
      tip=T('Not sure? Use "What is this item?" on the home page.', '不確定？用首頁的「這是什麼垃圾？」查詢。')),
    S('📅', T('Check the day', '確認今天收不收'),
      T('No collection on Wednesday and Sunday. Suggested days for recycling: paper & clothes Mon / Fri; bottles, cans & plastics Tue / Thu / Sat. Sorted recyclables are still accepted on the other collection days.',
        '每週三、日停收。回收建議日：紙類、舊衣一、五；瓶罐、塑膠二、四、六。分類好的回收物在其他收運日也會收。'),
      tip=T('Lunar New Year has a special schedule announced by the Department of Environmental Protection.', '農曆春節收運時間依環保局公告調整。')),
    S('🕒', T('Find your stop and time', '找到停靠點和時間'),
      T('The truck stops at fixed places at fixed times, usually only a few minutes. Arrive 5 minutes early.',
        '垃圾車在固定地點、固定時間停靠，通常只停幾分鐘，請提早 5 分鐘到。'),
      tip=T('Missed it? The city runs limited-time drop-off points in every district.', '錯過了？各區有環保局的限時收受點。')),
    S('🎵', T('Listen for the music', '聽到音樂就出門'),
      T('Trucks play music as they come (often "Für Elise"). A recycling truck runs on the same route.',
        '垃圾車來時會播放音樂（常見為〈給愛麗絲〉），同路線也有資源回收車。')),
    S('🙌', T('Hand it over yourself', '自己交給清潔車'),
      T('Throw the official bag into the garbage truck. Give recyclables to the recycling crew. Pour food waste into the blue bucket at the back of the truck.',
        '專用袋丟進垃圾車；回收物交給回收車人員；廚餘倒進車後方的藍色廚餘桶。'),
      warn=T('Never leave trash on the street or by a pole — Taipei has no curbside bins. You can be fined.',
             '不可把垃圾放在路邊或電線桿旁（垃圾不落地），會被開罰。')),
]

for st in rules['guide']:
    st.setdefault('kind', 'tip')


# Emoji in the source above are only shorthand; the app shows Tabler line icons (no emoji).
EMOJI_ICON = {
    '🧴': 'bottle', '🥫': 'cylinder', '🍾': 'bottle', '🧃': 'milk', '🧋': 'cup', '☕': 'coffee', '🍱': 'bowl-chopsticks',
    '📦': 'box', '🍐': 'apple', '📱': 'device-mobile', '🪣': 'bucket', '🥥': 'egg', '📰': 'file-text', '👕': 'shirt',
    '🛍️': 'shopping-bag', '📚': 'book', '🍌': 'leaf', '🍲': 'soup', '🍵': 'coffee', '🔋': 'battery-2', '💡': 'bulb',
    '🫗': 'droplet', '🧯': 'spray', '🧪': 'flask', '🧻': 'toilet-paper', '🍟': 'cookie', '🥤': 'cup', '🥡': 'box',
    '👟': 'shoe', '🧸': 'mood-smile', '🧣': 'hanger', '🧾': 'receipt', '🚬': 'smoking', '🪟': 'glass-off', '🛋️': 'sofa',
    '📺': 'device-tv', '💊': 'pill', '🍽️': 'bowl', '🚿': 'droplets', '🫓': 'arrows-minimize', '🔩': 'hand-grab',
    '🧤': 'hand-stop', '🍚': 'bowl', '💨': 'wind', '🔐': 'lock', '✂️': 'scissors', '🧽': 'droplet', '🚫': 'circle-x',
    '☔': 'sun', '🪢': 'package', '🧺': 'wash-machine', '🗂️': 'paper-bag', '💧': 'droplet-half-2', '🧊': 'fridge',
    '🫖': 'coffee', '🩹': 'bandage', '🏷️': 'tag', '🫙': 'package', '🔒': 'lock', '🌬️': 'wind', '🍶': 'bottle',
    '☎️': 'phone', '🏠': 'home', '📅': 'calendar', '🕒': 'clock', '🎵': 'music', '🙌': 'hand-grab',
}


def to_icon(d):
    e = d.pop('emoji')
    d['icon'] = EMOJI_ICON[e]


for it in rules['items']:
    to_icon(it)
    for st in it['steps']:
        if 'icon' not in st:
            to_icon(st)
for st in rules['guide']:
    if 'icon' not in st:
        to_icon(st)
CAT_ICON = {'general': 'trash', 'recycle': 'recycle', 'food': 'leaf', 'special': 'battery-2', 'bulky': 'sofa', 'verify': 'help-circle'}
for k, c in rules['categories'].items():
    c.pop('emoji', None)
    c['icon'] = CAT_ICON[k]

OUT.write_text(json.dumps(rules, ensure_ascii=False, indent=1), encoding='utf-8')
print(f"Wrote {len(rules['items'])} items, {len(rules['guide'])} guide steps -> {OUT}")
