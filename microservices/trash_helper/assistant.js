// SPDX-License-Identifier: AGPL-3.0-or-later
// Voice assistant: a round voice button at the bottom left. The user asks, in any of the
// app's languages, how or where to throw something away; the assistant opens the page we
// already have (the step list, the map, the truck card) and frames the part that answers the
// question with a highlight and a short callout — the pages themselves are not changed.
//
// Understanding is on the phone: keyword matching against every item name and keyword in all
// languages (rules.json + i18n/<code>.js voice keywords). Speech-to-text uses the phone's own
// recogniser through the app (trash_listen), or the browser's Web Speech API when there is no app.
"use strict";

(function () {
  const TH = window.TH;
  const { h, t, L, go, fill } = TH;
  const icon = (...a) => TH.icon(...a);

  Object.assign(window.TH_STRINGS.zh, {
    vaOpen: "語音助理", vaTitle: "問我怎麼丟", vaTap: "點麥克風，說出你的問題", vaListening: "正在聽…", vaThinking: "找找看…",
    vaStop: "說完了", vaTypeHint: "或打字問", vaSend: "送出", vaYou: "你", vaNoMic: "這裡不能用語音，請打字問。",
    vaDenied: "沒有麥克風或語音辨識權限。請到手機設定開啟，或改用打字。", vaNoSpeech: "沒聽清楚，再說一次？",
    vaEx1: "我想丟電池", vaEx2: "舊衣回收箱在哪？", vaEx3: "便利商店可以回收什麼？", vaEx4: "垃圾車幾點來？",
    vaPlanReply: "這是丟{items}的步驟，重點幫你框起來了。", vaMapReply: "幫你找到最近的{place}。", vaMapNoPos: "幫你打開{place}地圖。",
    vaTruckReply: "這是你的垃圾車時間和地點。", vaBagsReply: "專用垃圾袋要在代售點買，這是購買方式。", vaDropReply: "錯過垃圾車可以到限時收受點，這是地圖。",
    vaUnknown: "我還聽不懂這個問題。可以說要丟的東西，例如「電池」「舊衣服」「沙發」。",
    vaPrep: "先處理", vaWhere: "怎麼交出去", vaNext: "下一個", vaGotIt: "知道了", vaSeeMap: "看地圖", vaNav: "Google 地圖導航",
    vaNearest: "離你最近", vaReadAloud: "朗讀回覆", vaPrivacy: "語音由手機的語音辨識轉成文字，App 不保存。",
    vaFramed: "重點幫你框起來了。", vaAddReply: "加進清單了：{items}。", vaWhich: "你是說哪一個？", vaMaybe: "是不是這個？",
    vaNearestAt: "最近的{place}：{name}，{d}。", vaTruckNext: "下一班垃圾車：{when}，{place}。", vaEdit: "點一下可以修改",
  });
  Object.assign(window.TH_STRINGS.en, {
    vaOpen: "Voice assistant", vaTitle: "Ask me how to throw it out", vaTap: "Tap the mic and ask your question", vaListening: "Listening…", vaThinking: "Looking it up…",
    vaStop: "Done", vaTypeHint: "Or type your question", vaSend: "Send", vaYou: "You", vaNoMic: "Voice is not available here. Please type.",
    vaDenied: "No microphone or speech permission. Turn it on in your phone settings, or type instead.", vaNoSpeech: "I didn't catch that. Try again?",
    vaEx1: "I want to throw away batteries", vaEx2: "Where is an old-clothes bin?", vaEx3: "What can convenience stores take?", vaEx4: "When does the garbage truck come?",
    vaPlanReply: "Here are the steps for {items}. I've framed the key parts.", vaMapReply: "Here is the nearest {place}.", vaMapNoPos: "Here is the {place} map.",
    vaTruckReply: "Here is when and where your garbage truck stops.", vaBagsReply: "Official bags are sold at registered shops. Here is how to buy them.", vaDropReply: "If you missed the truck, use a drop-off point. Here is the map.",
    vaUnknown: "I don't understand that yet. Try naming the thing, like \"battery\", \"old clothes\" or \"sofa\".",
    vaPrep: "Prepare it", vaWhere: "Hand it over", vaNext: "Next", vaGotIt: "Got it", vaSeeMap: "See map", vaNav: "Navigate in Google Maps",
    vaNearest: "Nearest", vaReadAloud: "Read replies aloud", vaPrivacy: "Your phone's speech service turns your voice into text. The app does not keep it.",
    vaFramed: "I've framed the key parts.", vaAddReply: "Added to your list: {items}.", vaWhich: "Which one do you mean?", vaMaybe: "Did you mean one of these?",
    vaNearestAt: "Nearest {place}: {name}, {d}.", vaTruckNext: "Next garbage truck: {when}, {place}.", vaEdit: "Tap to edit",
  });

  // ------------------------------------------------------------ understanding
  // Extra everyday words (zh/en) on top of rules.json names and keywords.
  const EXTRA = {
    battery: ["電池", "乾電池", "行動電源", "充電寶", "鋰電池", "鈕扣電池", "battery", "batteries", "power bank", "powerbank"],
    bulb: ["燈泡", "燈管", "日光燈", "light bulb", "bulb", "lamp", "fluorescent"],
    clothes: ["舊衣", "舊衣服", "衣服", "衣物", "二手衣", "clothes", "clothing", "old clothes", "t-shirt"],
    pills: ["過期藥", "藥品", "藥丸", "廢藥", "剩藥", "藥", "medicine", "medicines", "pills", "drugs", "tablets"],
    medicine: ["溫度計", "水銀", "農藥", "殺蟲劑", "thermometer", "pesticide"],
    furniture: ["沙發", "床墊", "家具", "傢俱", "桌子", "椅子", "衣櫃", "腳踏車", "自行車", "sofa", "couch", "mattress", "furniture", "bicycle", "bike", "table", "chair"],
    appliance: ["冰箱", "電視", "洗衣機", "冷氣", "抽油煙機", "大型家電", "fridge", "refrigerator", "tv", "television", "washing machine", "air conditioner"],
    cup: ["手搖杯", "手搖飲", "飲料杯", "珍奶", "奶茶杯", "bubble tea", "boba", "drink cup"],
    lunchbox: ["便當盒", "餐盒", "外帶盒", "lunch box", "takeout box"],
    pet: ["寶特瓶", "塑膠瓶", "水瓶", "plastic bottle", "water bottle"],
    leftovers: ["剩菜", "剩飯", "廚餘", "食物", "吃剩", "吃不完", "剩湯", "leftovers", "food waste", "food scraps"],
    paper: ["紙箱", "報紙", "紙類", "cardboard", "newspaper", "paper box"],
    oil: ["廢油", "食用油", "炸油", "炸過的油", "cooking oil", "used oil"],
    tissue: ["衛生紙", "尿布", "面紙", "tissue", "diaper", "toilet paper"],
    brokenglass: ["碎玻璃", "破玻璃", "玻璃碎片", "broken glass"],
    ceramic: ["破碗", "碗盤", "陶瓷", "broken plate", "ceramic"],
    spray: ["噴霧罐", "瓦斯罐", "卡式瓦斯", "spray can", "aerosol", "gas can"],
    phone: ["手機", "舊手機", "小家電", "吹風機", "phone", "mobile phone", "hair dryer"],
    can: ["鋁罐", "鐵罐", "飲料罐", "易開罐", "汽水罐", "啤酒罐", "罐頭", "aluminum can", "aluminium can", "soda can", "beer can", "tin can", "drink can"],
    snackbag: ["零食袋", "零食包裝", "洋芋片", "餅乾袋", "糖果紙", "chip bag", "crisp packet", "snack wrapper"],
    dirtybag: ["髒塑膠袋", "髒的塑膠袋", "油膩的塑膠袋", "dirty plastic bag"],
    shoes: ["鞋", "舊鞋", "球鞋", "拖鞋", "涼鞋", "皮鞋", "shoe", "sneakers", "slippers"],
    toy: ["娃娃", "玩偶", "絨毛玩具", "絨毛娃娃", "球", "籃球", "足球", "stuffed toy", "plush", "teddy bear", "ball"],
  };
  // A broken thing is not the whole thing: "破掉的玻璃杯" is broken glass, "打破的碗" a broken dish.
  const BROKEN = ["破", "碎", "裂", "broken", "cracked", "shattered"];
  const BROKEN_TO = [[["玻璃", "glass"], "brokenglass"], [["碗", "盤", "盤子", "杯", "bowl", "plate", "dish", "mug"], "ceramic"]];
  // Parts of item names that are only a material ("手搖飲杯（塑膠）", "Plastic / paper lunch box"):
  // on their own they would pull every plastic or paper question to that one item.
  const GENERIC = new Set(["塑膠", "紙", "玻璃", "金屬", "plastic", "paper", "glass", "metal", "nhựa", "giấy", "plastik", "kertas",
    "papel", "พลาสติก", "กระดาษ", "플라스틱", "종이", "プラスチック", "紙製"]);
  // Very common characters: sharing one of them says nothing about which item was meant.
  const COMMON_CHARS = new Set([..."我你他她它的是有在要想會能可以嗎呢吧啊了什麼怎哪裡邊這那個些今天明後年月日點時候好多少幾來去說看用買垃圾回收丟倒處理請問一下就都也還很不沒和跟與或把被讓給到上下中大小新舊氣謝意思名字早安晚嗨哈"]);
  // Asking whether it goes in a category ("可以丟一般垃圾嗎？"): answer yes or no first.
  const CAT_WORDS = {
    general: ["一般垃圾", "垃圾桶", "general trash", "regular trash", "normal trash", "rác thông thường", "rác thường", "sampah umum", "sampah biasa",
      "ordinaryong basura", "basura", "ขยะทั่วไป", "일반 쓰레기", "일반쓰레기", "一般ごみ", "燃えるごみ"],
    recycle: ["資源回收", "回收物", "回收嗎", "能回收", "可以回收", "可回收", "recycling", "recyclable", "recycle", "tái chế", "daur ulang",
      "i-recycle", "รีไซเคิล", "재활용", "資源ごみ", "リサイクル"],
    food: ["廚餘", "food waste", "compost", "rác thức ăn", "sisa makanan", "tirang pagkain", "เศษอาหาร", "음식물 쓰레기", "음식물", "生ごみ"],
  };
  const GARBAGE = ["垃圾", "回收", "丟", "倒", "廚餘", "trash", "garbage", "rubbish", "recycling"];
  const KANA = /[\p{Script=Hiragana}\p{Script=Katakana}]/u;
  const HAN_ONLY = /^[\p{Script=Han}]+$/u;
  const YESNO = ["嗎", "可以", "可不可以", "能不能", "能否", "是不是", "算不算", "屬於", "算是", "can i", "can you", "can", "is", "are", "should i", "does it", "do i",
    "không", "được không", "có phải", "apakah", "bisa", "boleh", "puwede", "pwede", "ba", "ไหม", "ได้ไหม", "หรือเปล่า", "돼요", "되나요", "인가요", "나요",
    "ですか", "ますか", "いいですか", "か"];
  const INTENTS = {
    where: ["哪裡", "哪邊", "在哪", "去哪", "附近", "最近", "where", "nearest", "near me", "nearby", "closest"],
    map: ["地圖", "map", "show me"],
    where_clothes: ["舊衣回收箱", "舊衣箱", "回收箱", "clothes bin", "donation bin", "clothing bin"],
    where_battery: ["電池回收", "回收電池", "battery drop", "battery recycling"],
    where_pills: ["廢藥回收", "藥品回收", "回收藥", "medicine take back", "return medicine"],
    convenience_store: ["便利商店", "超商", "7-11", "711", "小七", "seven", "全家", "萊爾富", "ok超商", "全聯", "超市", "convenience store", "7-eleven", "familymart", "family mart", "hi-life", "supermarket"],
    pharmacy: ["藥局", "藥房", "醫院", "pharmacy", "drugstore", "drug store", "hospital", "chemist"],
    // On its own a time word is about the truck only next to a garbage word (see GARBAGE in decide):
    // "我沒時間" is not a question about the truck.
    truck_time: ["幾點", "什麼時候", "何時", "時間", "幾時", "星期幾", "禮拜幾", "週幾", "哪一天", "哪幾天", "今天", "今晚", "明天", "晚上", "早上",
      "what time", "when", "what day", "which day", "today", "tonight", "tomorrow"],
    truck: ["垃圾車", "回收車", "收垃圾", "倒垃圾", "清運", "garbage truck", "trash truck", "truck", "garbage collection", "trash pickup"],
    where_dropoff: ["錯過", "沒趕上", "來不及", "趕不上", "追不上", "沒倒到", "沒丟到", "車走了", "車開走", "收受點", "missed", "too late", "drop-off", "drop off point"],
    bulky: ["大型垃圾", "大型廢棄物", "大件", "bulky", "big item", "large item"],
    buy_bags: ["專用垃圾袋", "垃圾袋", "專用袋", "買袋", "什麼袋", "哪種袋", "用袋子", "要袋子", "garbage bag", "trash bag", "official bag", "buy bags", "what bag", "which bag"],
    buy: ["買", "購買", "賣", "buy", "purchase", "sell"],
    how: ["怎麼丟", "怎麼處理", "怎麼", "如何", "要丟哪", "丟哪", "how", "which bin", "how do i"],
    throw: ["想丟", "要丟", "丟掉", "丟", "回收", "throw", "throw away", "dispose", "get rid of", "recycle"],
    // "How do I say it?" opens the talk card (talkcard.js), in all eight languages.
    talk: ["怎麼說", "中文怎麼說", "跟隊員說", "跟清潔隊說", "跟店員說", "溝通卡", "翻譯", "how do i say", "how to say", "talk card",
      "tell the crew", "in chinese", "translate", "nói thế nào", "nói sao", "dịch", "cara bilang", "bagaimana bilang", "terjemah",
      "paano sabihin", "isalin", "พูดยังไง", "พูดว่าอะไร", "แปล", "어떻게 말해", "말하는 법", "번역", "どう言う", "何て言う", "翻訳"],
    // Pointing back at what was just asked about ("那它呢？"), in all eight languages.
    ref: ["它", "這個", "那個", "這些", "那些", "it", "that", "this", "them", "those", "nó", "cái này", "cái đó", "itu", "ini", "nya",
      "iyan", "ito", "yan", "yun", "มัน", "อันนี้", "อันนั้น", "그거", "이거", "그것", "이것", "それ", "これ", "あれ"],
    // "Also / add": put the new things into the current list instead of replacing it.
    add: ["還要", "也要", "還有", "再加", "加上", "另外", "順便", "also", "too", "as well", "add", "plus", "thêm", "cũng", "nữa",
      "juga", "tambah", "sekalian", "pati", "din", "rin", "dagdag", "ด้วย", "เพิ่ม", "추가", "그리고", "같이", "追加", "あと", "それと"],
  };
  // Words that could mean several items: ask which one instead of guessing.
  const AMBIG = [
    [["瓶子", "瓶", "bottle", "bottles"], ["pet", "glass"]],
    [["罐子", "罐", "can", "cans"], ["can", "spray"]],
    [["袋子", "袋", "bag", "bags"], ["bag", "snackbag", "dirtybag"]],
    [["紙", "paper"], ["paper", "papercup", "receipt", "tissue"]],
    [["盒子", "盒", "box", "boxes"], ["lunchbox", "carton", "paper"]],
    [["杯子", "杯", "cup", "cups"], ["cup", "papercup"]],
    [["玻璃", "glass"], ["glass", "brokenglass"]],
    [["電器", "家電", "appliance", "electronics"], ["phone", "appliance"]],
  ];
  const LAYER_OF = { battery: "battery", clothes: "clothes", pills: "pills" };
  // A word that fits several items never stands for one of them on its own (Japanese 瓶 is a glass
  // bottle, but Chinese 瓶子 is any bottle), so it leads to the "which one?" question instead.
  const AMBIG_WORDS = new Set(AMBIG.flatMap(([words]) => words.map(w => String(w).normalize("NFC").toLowerCase())));
  // Everyday words that are also item keywords ("where can I…" is not about cans).
  const STOP = new Set(["can", "bag", "bags", "box", "cup", "paper"]);

  const strip = s => s.normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/đ/g, "d").normalize("NFC");
  const norm = s => String(s || "").normalize("NFC").toLowerCase().replace(/[.,!?;:"'()（）「」，。！？、：；~～]/g, " ").replace(/\s+/g, " ").trim();
  // Latin-script words (English, Vietnamese, Indonesian, Filipino) must match whole words;
  // Chinese, Japanese, Thai and Korean are matched inside the sentence.
  const LATIN = /^[\p{Script=Latin}\p{N}\s\-'’]+$/u;
  const THAI = /[\u0E00-\u0E7F]/;
  let bare = false;   // the question was typed without tone marks: compare without them too
  function found(text, kw) {
    if (!kw) return -1;
    if (bare) kw = strip(kw);
    // Thai is written without spaces: a 1–2 letter word (ยา) hides inside others (อยาก).
    if (THAI.test(kw) && kw.length < 3) return -1;
    if (LATIN.test(kw)) {
      const esc = kw.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
      // Whole words, allowing an English plural ("garbage bags" matches "garbage bag").
      const m = new RegExp(`(^|[^\\p{L}\\p{N}])${esc}(?:e?s)?(?=$|[^\\p{L}\\p{N}])`, "u").exec(text);
      return m ? m.index + m[1].length : -1;
    }
    return text.indexOf(kw);
  }
  let index = null;
  function buildIndex() {
    const rules = TH.rules(); if (!rules) return null;
    const content = window.TH_CONTENT || {}, voice = window.TH_VOICE || {};
    const items = [];
    for (const it of rules.items) {
      // Japanese words written only in kanji (紙箱, 瓶, 肉) read differently in Chinese, so they
      // are kept apart and used only for Japanese questions.
      const words = new Set(), jaHan = new Set();
      const add = (w, code) => {
        const n = norm(w); if (!n || GENERIC.has(n)) return;
        (code === "ja" && HAN_ONLY.test(n) ? jaHan : words).add(n);
      };
      // The whole name, the name without its "(plastic)" note, and each part of "電池、行動電源".
      const addName = (s, code) => {
        if (!s) return;
        add(s, code);
        const core = String(s).replace(/[（(][^）)]*[）)]/g, " ").trim();
        if (core !== s) add(core, code);
        core.split(/[、，,／/]/).forEach(p => { if (p.trim().length >= 2) add(p, code); });
      };
      addName(it.name.en); addName(it.name.zh);
      for (const code of Object.keys(content)) addName((content[code] || {})[it.name.en], code);
      (it.keywords || []).forEach(w => add(w));
      (EXTRA[it.id] || []).forEach(w => add(w));
      for (const code of Object.keys(voice)) ((voice[code].items || {})[it.id] || []).forEach(w => add(w, code));
      const keep = w => !STOP.has(w) && !AMBIG_WORDS.has(w);
      items.push({ id: it.id, words: [...words].filter(keep), jaHan: [...jaHan].filter(w => keep(w) && !words.has(w)) });
    }
    const intents = {};
    for (const [k, list] of Object.entries(INTENTS)) intents[k] = new Set(list.map(norm));
    for (const code of Object.keys(voice)) for (const [k, list] of Object.entries(voice[code].intents || {})) {
      if (!intents[k]) intents[k] = new Set();
      list.forEach(w => intents[k].add(norm(w)));
    }
    return { items, intents: Object.fromEntries(Object.entries(intents).map(([k, s]) => [k, [...s].filter(Boolean)])) };
  }

  function understand(raw) {
    index = index || buildIndex();
    const plain = norm(raw);
    bare = strip(plain) === plain;
    const text = ` ${bare ? strip(plain) : plain} `;
    const japanese = KANA.test(plain) || voiceLang() === "ja" || TH.lang() === "ja";
    // Items: longest matches first, no overlaps ("紙杯" beats "紙").
    const hits = [];
    for (const it of index.items) for (const w of japanese ? [...it.words, ...it.jaHan] : it.words) {
      const at = found(text, w);
      if (at >= 0) hits.push({ id: it.id, at, len: w.length, w });
    }
    hits.sort((a, b) => b.len - a.len);
    const taken = [], items = [], byWord = {};
    for (const x of hits) {
      if (taken.some(([s, e]) => x.at < e && x.at + x.len > s)) continue;
      taken.push([x.at, x.at + x.len]);
      if (!items.includes(x.id)) items.push(x.id);
      (byWord[x.id] = byWord[x.id] || []).push(x.w);
    }
    // Intents: whatever appears outside the item words.
    let rest = text;
    taken.forEach(([s, e]) => { rest = rest.slice(0, s) + " ".repeat(e - s) + rest.slice(e); });
    const has = {};
    // Only words outside the item names count, so "我想丟電池" is about batteries, not a battery drop-off.
    for (const [k, list] of Object.entries(index.intents)) has[k] = list.some(w => found(rest, w) >= 0);
    // A shop is a place even when its name holds an item ("藥局" holds 藥): "藥局呢？" asks for the map.
    for (const k of ["pharmacy", "convenience_store"]) has[k] = has[k] || index.intents[k].some(w => found(text, w) >= 0);
    // "Where do I buy garbage bags?" names a bag but asks about the official bags.
    if (index.intents.buy_bags.some(w => found(text, w) >= 0) && items.every(id => id === "bag")) { items.length = 0; has.buy_bags = true; }
    // Broken glass or a broken dish is its own item, whatever whole thing it was.
    if (BROKEN.some(w => found(text, w) >= 0)) {
      const to = BROKEN_TO.find(([words]) => words.some(w => found(text, w) >= 0));
      if (to) {
        const drop = new Set(["glass", "cup", "papercup", "ceramic", "brokenglass"]);
        const keep = items.filter(id => !drop.has(id));
        items.length = 0; items.push(to[1], ...keep);
      }
    }
    has.garbage = GARBAGE.some(w => found(text, w) >= 0);
    // "電池可以丟一般垃圾嗎？" asks yes or no about a category.
    has.yesno = YESNO.some(w => found(text, w) >= 0);
    let askCat = Object.keys(CAT_WORDS).find(c => CAT_WORDS[c].some(w => found(text, w) >= 0));
    // The thing must be named by more than the category itself: in "蛋殼是廚餘嗎" 廚餘 is the
    // category asked about, not the leftovers item, so there is no yes or no to give.
    const catWord = new Set(Object.values(CAT_WORDS).flat().map(norm));
    const named = items.length === 1 && byWord[items[0]];
    if (askCat && named && named.every(w => catWord.has(w))) askCat = null;
    // Nothing named exactly: a word that fits several items ("瓶子"), else the closest-sounding items.
    let amb = [], near = [];
    if (!items.length && !has.buy_bags) {
      const hit = AMBIG.find(([words]) => words.some(w => found(text, norm(w)) >= 0));
      if (hit) amb = hit[1].filter(id => TH.itemById(id));
      else near = closest(plain, japanese);
    }
    return { items, has, amb, near, askCat: has.yesno ? askCat : null, short: plain.replace(/\s/g, "").length <= 4 };
  }

  // Closest items for a sentence that matched nothing, so a misheard word ("店池") still offers
  // 電池. Chinese/Japanese/Korean: shared characters; Latin scripts: words one or two letters off.
  const CJK = /[\p{Script=Han}\p{Script=Hiragana}\p{Script=Katakana}\p{Script=Hangul}]/u;
  function editDistance(a, b) {
    const d = Array.from({ length: b.length + 1 }, (_, j) => j);
    for (let i = 1; i <= a.length; i++) {
      let prev = d[0]; d[0] = i;
      for (let j = 1; j <= b.length; j++) { const tmp = d[j]; d[j] = Math.min(d[j] + 1, d[j - 1] + 1, prev + (a[i - 1] === b[j - 1] ? 0 : 1)); prev = tmp; }
    }
    return d[b.length];
  }
  function closest(plain, japanese) {
    // Only the telling characters count: "今天天氣好嗎" shares 天 with nothing useful, and one
    // shared character out of two ("店池" → 電池) is a guess only when little else was said.
    const chars = new Set([...plain].filter(c => CJK.test(c) && !COMMON_CHARS.has(c)));
    const words = strip(plain).split(" ").filter(w => w.length >= 4);
    const scored = [];
    for (const it of index.items) {
      let best = 0;
      for (const w of japanese ? [...it.words, ...it.jaHan] : it.words) {
        if (CJK.test(w) && chars.size && w.length >= 2) {
          const ws = [...w].filter(c => CJK.test(c));
          const shared = ws.filter(c => chars.has(c)).length;
          if (shared === 1 && (ws.length > 2 || chars.size > 3)) continue;
          if (shared) best = Math.max(best, shared / ws.length);
        } else if (LATIN.test(w) && w.length >= 4) {
          const sw = strip(w);
          for (const x of words) {
            if (Math.abs(x.length - sw.length) > 2) continue;
            const dist = editDistance(x, sw);
            if (dist <= (sw.length >= 7 ? 2 : 1)) best = Math.max(best, 1 - dist / sw.length);
          }
        }
      }
      if (best >= 0.5) scored.push([it.id, best]);
    }
    return scored.sort((a, b) => b[1] - a[1]).slice(0, 3).map(x => x[0]);
  }

  // What the conversation was about, so "最近的在哪？" or "那它幾點丟？" can follow up.
  const ctx = { items: [], at: 0 };
  const remember = items => { if (items && items.length) { ctx.items = items.slice(); ctx.at = Date.now(); } };

  function decide(q) {
    let { items, has } = q;
    const fresh = ctx.items.length && Date.now() - ctx.at < 15 * 60 * 1000;
    // A question with a subject of its own (bags, the truck, a missed truck, bulky waste, a word
    // like 瓶子) is not a follow-up, even soon after: "哪裡買垃圾袋？" is not about the last item.
    const ownTopic = has.buy_bags || has.truck || has.where_dropoff || has.bulky || has.talk || (q.amb && q.amb.length) || (q.near && q.near.length);
    // It follows up when it points back ("它", "這個") or asks where/how; a time word only with a
    // garbage word or as a short question ("幾點？"), so "今天天氣好嗎" is not one; a shop only
    // when the last thing has drop-off places (batteries, medicine, clothes).
    const ctxLayer = ctx.items.some(id => LAYER_OF[id]);
    const follow = !items.length && fresh && !ownTopic && (has.ref || has.where || has.map || has.how
      || (has.truck_time && (has.garbage || q.short)) || ((has.convenience_store || has.pharmacy) && ctxLayer));
    if (follow) {
      items = ctx.items.slice();
      if (has.truck_time) return { kind: "truck" };
    }
    // Buying something that is not a garbage bag is not a question for this app ("我想買手機").
    if (has.buy && !has.buy_bags && !has.throw && !has.how && !follow && !items.includes("bag")) return { kind: "unknown" };
    if (has.talk && TH.talk) {
      const bulky = items.some(id => { const it = TH.itemById(id); return it && TH.catOf(it) === "bulky"; });
      return { kind: "talk", scene: has.convenience_store || items.includes("battery") ? "store" : bulky || has.bulky ? "phone" : has.where_dropoff ? "drop" : "truck" };
    }
    if (!items.length && q.amb && q.amb.length) return { kind: "choose", options: q.amb, has, ask: "vaWhich" };
    const placeQ = has.where || has.map || has.convenience_store || has.pharmacy;
    const fromItem = items.map(id => LAYER_OF[id]).find(Boolean);
    let layer = has.where_clothes ? "clothes" : has.where_battery ? "battery" : has.where_pills ? "pills" : null;
    if (!layer && fromItem && placeQ) layer = fromItem;
    if (!layer && !items.length && has.convenience_store) layer = "battery";
    if (!layer && !items.length && has.pharmacy) layer = "pills";
    if (layer) return { kind: "map", layer, items };
    if (!items.length && has.where_dropoff) return { kind: "dropoff" };
    if (!items.length && (has.truck || (has.truck_time && has.garbage)) && !has.buy_bags) return { kind: "truck" };
    if (!items.length && has.buy_bags) return { kind: "bags" };
    if (!items.length && has.bulky) return { kind: "plan", items: ["furniture"] };
    if (items.length) return { kind: "plan", items: items.slice(0, 4), add: !!has.add && !follow, check: items.length === 1 ? q.askCat || null : null };
    if (has.map || has.where) return { kind: "map", layer: null, items };
    if (q.near && q.near.length) return { kind: "choose", options: q.near, has, ask: "vaMaybe" };
    return { kind: "unknown" };
  }

  // ------------------------------------------------------------ voice out
  const LS = { get: (k, d) => { try { const v = localStorage.getItem(k); return v == null ? d : JSON.parse(v); } catch (_) { return d; } }, set: (k, v) => { try { localStorage.setItem(k, JSON.stringify(v)); } catch (_) { /* ignore */ } } };
  const speechLocale = () => (window.TH_LANGS.find(l => l.code === TH.lang()) || {}).speech || "en-US";
  // The phone's recogniser hears one language at a time (no auto-detect), so the user can pick the
  // language they will speak, independent of the screen language. Remembered on this phone.
  const voiceLang = () => { const v = LS.get("th.vaLang", null); return window.TH_LANGS.some(l => l.code === v && l.ready) ? v : TH.lang(); };
  const listenLocale = () => (window.TH_LANGS.find(l => l.code === voiceLang()) || {}).speech || speechLocale();
  function say(text) {
    if (!LS.get("th.vaSpeak", true) || !window.speechSynthesis || !text) return;
    try {
      window.speechSynthesis.cancel();
      const u = new SpeechSynthesisUtterance(text);
      u.lang = speechLocale();
      const voices = window.speechSynthesis.getVoices() || [];
      const want = u.lang.toLowerCase(), base = want.split("-")[0];
      u.voice = voices.find(v => v.lang.toLowerCase().replace("_", "-") === want) || voices.find(v => v.lang.toLowerCase().startsWith(base)) || null;
      u.rate = 1;
      window.speechSynthesis.speak(u);
    } catch (_) { /* no voice output here */ }
  }
  const buzz = () => { try { navigator.vibrate && navigator.vibrate(18); } catch (_) { /* ignore */ } };

  // ------------------------------------------------------------ voice in
  let webRec = null;
  const WebRec = window.SpeechRecognition || window.webkitSpeechRecognition;
  const canListen = () => !!(TH.bridge() || WebRec);
  function listen(onPartial) {
    if (TH.bridge()) {
      return TH.askApp("trash_listen", { op: "listen", locale: listenLocale() }, 30000, d => onPartial(d.text || ""))
        .then(d => {
          if (d && d.ok) return d.text || "";
          throw new Error(d && d.error === "denied" ? "denied" : d && d.error === "no-speech" ? "no-speech" : "unavailable");
        });
    }
    if (!WebRec) return Promise.reject(new Error("unavailable"));
    return new Promise((resolve, reject) => {
      const r = new WebRec();
      webRec = r;
      r.lang = listenLocale(); r.interimResults = true; r.maxAlternatives = 1; r.continuous = false;
      let last = "";
      r.onresult = e => { last = [...e.results].map(x => x[0].transcript).join(""); onPartial(last); };
      r.onerror = e => { webRec = null; reject(new Error(e.error === "not-allowed" ? "denied" : e.error === "no-speech" ? "no-speech" : "unavailable")); };
      r.onend = () => { webRec = null; resolve(last); };
      r.start();
    });
  }
  function stopListening() {
    if (TH.bridge()) TH.askApp("trash_listen", { op: "stop" }, 5000).catch(() => {});
    else if (webRec) webRec.stop();
  }

  // ------------------------------------------------------------ panel
  let panel = null;
  function openPanel() {
    if (panel) return;
    buzz();
    const log = h("div", { class: "va-log", "aria-live": "polite" });
    const status = h("p", { class: "va-status", text: canListen() ? t("vaTap") : t("vaNoMic") });
    const live = h("p", { class: "va-live" });
    const mic = h("button", { class: "va-mic", type: "button", "aria-label": t("vaOpen") }, h("span", { class: "va-rings", "aria-hidden": "true" }), icon("microphone", 30));
    const input = h("input", { class: "va-input", type: "text", enterkeyhint: "send", placeholder: t("vaTypeHint"), "aria-label": t("vaTypeHint") });
    const speakToggle = h("button", { class: "va-speak" + (LS.get("th.vaSpeak", true) ? " on" : ""), type: "button", "aria-pressed": String(LS.get("th.vaSpeak", true)), "aria-label": t("vaReadAloud") }, icon("volume", 18));
    speakToggle.addEventListener("click", () => {
      const on = !LS.get("th.vaSpeak", true); LS.set("th.vaSpeak", on);
      speakToggle.classList.toggle("on", on); speakToggle.setAttribute("aria-pressed", String(on));
      if (!on && window.speechSynthesis) window.speechSynthesis.cancel();
    });
    let busy = false, listening = false, retried = false;
    // The user's words can be tapped to correct them (speech recognition gets names wrong).
    const bubble = (who, text, extra, pair) => {
      const inner = who === "me"
        ? h("button", { class: "va-edit", type: "button", "aria-label": `${text}, ${t("vaEdit")}`, onclick: () => { input.value = text; input.focus(); } }, text, icon("pencil", 14))
        : h("span", { text, "data-pair": pair || undefined });
      log.append(h("div", { class: "va-msg " + who }, inner, extra || null)); log.scrollTop = log.scrollHeight;
    };
    async function ask(text) {
      text = (text || "").trim(); if (!text) return;
      bubble("me", text);
      status.textContent = t("vaThinking");
      await TH.whenRulesReady();
      await respond(decide(understand(text)));
    }
    // Answer in one line first (shown and read aloud), then open the page and frame the details.
    async function respond(plan) {
      const { main: reply, pair } = await replyFor(plan);
      let extra = null;
      if (plan.kind === "choose") {
        extra = h("div", { class: "va-options" }, plan.options.map(id => {
          const it = itemById(id);
          return h("button", { class: "va-option", type: "button", onclick: () => { buzz(); respond(decide({ items: [id], has: plan.has || {} })); } }, TH.art(it, 28), h("span", { text: nameOf(id) }));
        }));
      }
      bubble("bot", reply, extra, pair);
      say(reply);
      status.textContent = canListen() ? t("vaTap") : t("vaNoMic");
      if (plan.kind !== "unknown" && plan.kind !== "choose") setTimeout(() => { closePanel(); act(plan, false); }, 1300);
    }
    mic.addEventListener("click", async () => {
      if (!canListen()) { input.focus(); return; }
      if (listening) { stopListening(); return; }
      if (busy) return;
      busy = listening = true; buzz();
      if (window.speechSynthesis) window.speechSynthesis.cancel();
      wrap.classList.add("listening"); status.textContent = t("vaListening"); live.textContent = "";
      try {
        let text;
        try { text = await listen(p => { live.textContent = p; }); }
        catch (e) {
          // The very first time, the phone shows its permission prompts while we wait; try once more.
          if (e.message !== "unavailable" || retried) throw e;
          retried = true; await sleep(500);
          text = await listen(p => { live.textContent = p; });
        }
        live.textContent = "";
        if (text) await ask(text); else status.textContent = t("vaNoSpeech");
      } catch (e) {
        live.textContent = "";
        status.textContent = e.message === "denied" ? t("vaDenied") : e.message === "no-speech" ? t("vaNoSpeech") : t("vaNoMic");
      } finally { busy = listening = false; wrap.classList.remove("listening"); }
    });
    const send = () => { const v = input.value; input.value = ""; ask(v); };
    input.addEventListener("keydown", e => { if (e.key === "Enter") { e.preventDefault(); send(); } });
    // Example questions in the language the user will speak.
    const exText = k => (window.TH_STRINGS[voiceLang()] || {})[k] || t(k);
    const examples = h("div", { class: "va-examples" });
    const drawExamples = () => fill(examples, ["vaEx1", "vaEx2", "vaEx3", "vaEx4"].map(k => h("button", { class: "chip", type: "button", lang: voiceLang(), onclick: () => ask(exText(k)) }, exText(k))));
    const langs = h("div", { class: "va-langs", role: "radiogroup", "aria-label": t("langTitle") });
    const drawLangs = () => fill(langs, h("span", { class: "va-langs-icon", "aria-hidden": "true" }, icon("language", 18)),
      window.TH_LANGS.filter(l => l.ready).map(l => h("button", {
        class: "va-lang" + (l.code === voiceLang() ? " on" : ""), type: "button", role: "radio", lang: l.code,
        "aria-checked": String(l.code === voiceLang()),
        onclick: () => { LS.set("th.vaLang", l.code); drawLangs(); drawExamples(); },
      }, l.label)));
    drawLangs(); drawExamples();
    const wrap = h("div", { class: "va-wrap", role: "dialog", "aria-modal": "true", "aria-label": t("vaOpen") },
      h("div", { class: "va-backdrop", onclick: closePanel }),
      h("section", { class: "va-panel" },
        h("div", { class: "va-head" }, h("span", { class: "va-badge" }, icon("sparkles", 18)), h("h2", { text: t("vaTitle"), "data-pair": TH.pairT("vaTitle") }), speakToggle,
          h("button", { class: "icon-round", type: "button", "aria-label": t("close"), onclick: closePanel }, icon("x", 18))),
        log,
        h("div", { class: "va-center" }, canListen() ? mic : null, status, live),
        canListen() ? langs : null,
        examples,
        h("div", { class: "va-type" }, input, h("button", { class: "va-send", type: "button", "aria-label": t("vaSend"), onclick: send }, icon("send", 20))),
        h("p", { class: "caption va-privacy", text: t("vaPrivacy") })));
    panel = wrap;
    document.body.append(wrap);
    requestAnimationFrame(() => wrap.classList.add("open"));
    if (!canListen()) setTimeout(() => input.focus(), 250);
  }
  function closePanel() {
    if (!panel) return;
    const p = panel; panel = null;
    stopListening();
    p.classList.remove("open"); setTimeout(() => p.remove(), 200);
  }

  // ------------------------------------------------------------ acting on a question
  const itemById = id => TH.itemById(id);
  const nameOf = id => { const it = itemById(id); return it ? L(it.name) : id; };
  const joinNames = ids => ids.map(nameOf).join(TH.lang() === "zh" || TH.lang() === "ja" ? "、" : ", ");
  const layerLabel = layer => t({ clothes: "layerClothes", battery: "layerBattery", pills: "layerPills" }[layer] || "mapTitle");

  // With dryRun the reply text is returned and nothing moves yet (so the panel can show it first).
  const cjkLang = () => TH.lang() === "zh" || TH.lang() === "ja";
  const endMark = () => cjkLang() ? "。" : ". ";
  // "電池：確實包裝、電極貼膠帶。" — the steps of one item in a line.
  function itemLine(it) {
    const steps = (it.steps || []).map(x => L(x.title)).filter(Boolean).slice(0, 3);
    const what = steps.length ? steps.join(cjkLang() ? "、" : ", ") : (L(it.handover) || "").split(/[。.]/)[0];
    return `${L(it.name)}${t("colon")}${what}${endMark()}`;
  }
  // "電池可以丟一般垃圾嗎？" → "不行，電池、行動電源是特殊回收物，不是一般垃圾。" before the steps.
  // Kept here in all eight languages: the generated i18n files are built from translator files.
  const VERDICT = {
    zh: ["對，{name}是{cat}。", "不對，{name}是{cat}，不是{asked}。", "{name}是{cat}，要另外回收。"],
    en: ["Yes, {name} is {cat}. ", "No, {name} is {cat}, not {asked}. ", "{name} is {cat}: it is collected separately. "],
    vi: ["Có, {name} là {cat}. ", "Không, {name} là {cat}, không phải {asked}. ", "{name} là {cat}, thu gom riêng. "],
    id: ["Ya, {name} termasuk {cat}. ", "Tidak, {name} termasuk {cat}, bukan {asked}. ", "{name} termasuk {cat}, dikumpulkan terpisah. "],
    fil: ["Oo, ang {name} ay {cat}. ", "Hindi, ang {name} ay {cat}, hindi {asked}. ", "Ang {name} ay {cat}, hiwalay itong kinokolekta. "],
    th: ["ได้ {name} เป็น{cat} ", "ไม่ได้ {name} เป็น{cat} ไม่ใช่{asked} ", "{name} เป็น{cat} ต้องแยกทิ้ง "],
    ko: ["네, {name}은(는) {cat}입니다. ", "아니요, {name}은(는) {asked}이(가) 아니라 {cat}입니다. ", "{name}은(는) {cat}이라 따로 배출해요. "],
    ja: ["はい、{name}は{cat}です。", "いいえ、{name}は{asked}ではなく{cat}です。", "{name}は{cat}なので、別に出します。"],
  };
  function verdict(it, asked) {
    const cat = TH.catOf(it);
    const which = cat === asked ? 0 : asked === "recycle" && cat === "special" ? 2 : 1;
    const s = (VERDICT[TH.lang()] || VERDICT.en)[which];
    // Names and categories are title-cased on their own; mid-sentence they start small ("is special recycling").
    const mid = w => /^(en|vi|id|fil)$/.test(TH.lang()) && /^\p{Lu}\p{Ll}/u.test(w) ? w[0].toLowerCase() + w.slice(1) : w;
    return s.replace("{name}", mid(L(it.name))).replace("{cat}", mid(t("cat_" + cat))).replace("{asked}", mid(t("cat_" + asked)));
  }
  const currentPicks = () => { try { return JSON.parse(localStorage.getItem("th.picks") || "[]"); } catch (_) { return []; } };
  async function nearestFor(layer) {
    await TH.loadPlaces();
    const a = TH.placeAnchor();
    const best = a ? TH.nearestPlaces(layer, a.pos, 1)[0] : null;
    return best ? { a, best } : null;
  }
  async function nextTruck() {
    const id = TH.profile && TH.profile.get().stopId; if (!id) return null;
    await TH.loadStops();
    const s = TH.stopsData() && TH.stopsData().byId.get(id); if (!s) return null;
    const v = TH.visitsOf(s)[0]; if (!v) return null;
    return { v, place: s.address.replace(/^臺北市/, "").replace(s.district, "").replace(/[（(].*?[)）]/g, "") };
  }
  // A string in the side-by-side language, built by the same code (undefined when that is off).
  const inPair = fn => { const p = TH.pairLang(); if (!p) return undefined; const s = TH.inLang(p, fn); return s && s !== fn() ? s : undefined; };

  // The one-line answer, in the screen language and (when on) the side-by-side language.
  // Data that needs loading is fetched first; the wording itself is synchronous so it can be
  // rendered in either language.
  async function replyFor(plan) {
    const near = plan.kind === "map" && plan.layer ? await nearestFor(plan.layer).catch(() => null) : null;
    const truck = plan.kind === "truck" ? await nextTruck().catch(() => null) : null;
    const phrase = () => {
      switch (plan.kind) {
        case "unknown": return t("vaUnknown");
        case "choose": return t(plan.ask || "vaWhich");
        case "talk": return t("tcTitle");
        case "plan":
          if (plan.add) return t("vaAddReply", { items: joinNames(plan.items) });
          if (plan.items.length === 1) { const it = itemById(plan.items[0]); if (it) return `${plan.check ? verdict(it, plan.check) : ""}${itemLine(it)}${t("vaFramed")}`; }
          return t("vaPlanReply", { items: joinNames(plan.items) });
        case "map":
          if (!plan.layer) return t("vaMapNoPos", { place: t("mapTitle") });
          if (near) return t("vaNearestAt", { place: layerLabel(plan.layer), name: near.best.name, d: TH.placeAway(near.a, near.best) });
          return t("vaMapReply", { place: layerLabel(plan.layer) });
        case "truck": return truck ? t("vaTruckNext", { when: TH.fmtWhen(truck.v.arriveMs), place: truck.place }) : t("vaTruckReply");
        case "bags": return t("vaBagsReply");
        case "dropoff": return t("vaDropReply");
        default: return "";
      }
    };
    return { main: phrase(), pair: inPair(phrase) };
  }

  async function act(plan, dryRun) {
    if (dryRun) return (await replyFor(plan)).main;
    if (plan.kind === "unknown" || plan.kind === "choose") return "";
    if (plan.kind === "talk") { TH.talk.open(plan.scene); return ""; }
    if (plan.kind === "plan") {
      remember(plan.items);
      // "還要丟…" keeps what is already on the list and frames only the new things.
      const picks = plan.add ? [...new Set([...currentPicks(), ...plan.items])] : plan.items;
      try { localStorage.setItem("th.picks", JSON.stringify(picks)); localStorage.setItem("th.lastPicks", JSON.stringify(picks)); } catch (_) { /* ignore */ }
      go("plan");
      const stops = [];
      for (const id of plan.items) {
        const it = itemById(id); if (!it) continue;
        stops.push({ sel: `[data-check="prep-${id}"]`, title: `${t("vaPrep")}・${L(it.name)}`, pair: inPair(() => `${t("vaPrep")}・${L(it.name)}`), it, kind: "prep" });
        stops.push({ sel: `[data-check="sp-${id}"]`, title: `${t("vaWhere")}・${L(it.name)}`, pair: inPair(() => `${t("vaWhere")}・${L(it.name)}`), it, kind: "special" });
      }
      const ready = await waitFor("[data-check]");
      if (!ready) return "";
      const found = stops.filter(s => document.querySelector(s.sel));
      // Items with nothing to prepare and nothing special: frame their row in "take it out".
      for (const id of plan.items) {
        const it = itemById(id); if (!it || found.some(s => s.it === it)) continue;
        const cat = TH.catOf(it);
        const row = [...document.querySelectorAll('[data-check^="drop-"]')].find(r => r.querySelector(`.art-${cat}`)) || document.querySelector(`[data-check="bag-${cat === "special" ? "hazard" : cat}"]`);
        if (row) found.push({ el: row, title: `${t("vaWhere")}・${L(it.name)}`, pair: inPair(() => `${t("vaWhere")}・${L(it.name)}`), it, kind: "drop" });
      }
      tour(found.map(s => ({ el: s.el || document.querySelector(s.sel), sel: s.sel, title: s.title, pair: s.pair, body: calloutBody(s) })));
      return "";
    }
    if (plan.kind === "map") {
      const layer = plan.layer;
      remember(plan.items);
      if (!layer) { go("map"); return ""; }
      await TH.loadPlaces();
      let a = TH.placeAnchor();
      if (!a) { try { TH.setLastPosition(await TH.getLocation()); a = TH.placeAnchor(); } catch (_) { /* no position */ } }
      const best = a ? TH.nearestPlaces(layer, a.pos, 1)[0] : null;
      const ms = TH.mapState;
      ms.cat = layer;
      if (best) { ms.center = { lat: best.lat, lng: best.lng }; ms.zoom = 16; ms.selected = best.id; }
      go("map/" + layer);
      const card = await waitFor(".map-bottom .near-card");
      if (!card) return "";
      await sleep(450);
      const steps = [];
      const pin = document.querySelector(".place-pin.sel");
      const navBtn = best ? h("button", { class: "btn btn-primary", type: "button", onclick: () => TH.openMap(best) }, icon("direction-sign", 18), t("vaNav")) : null;
      const body = [];
      if (best) {
        body.push(h("p", { class: "va-co-strong", text: best.name }));
        body.push(h("p", { class: "caption dark", text: [t("vaNearest"), a ? TH.placeAway(a, best) : null].filter(Boolean).join("・") }));
      }
      const noteKey = { clothes: "placeClothesNote", battery: "placeBatteryNote", pills: "placePillsNote" }[layer];
      body.push(h("p", { text: t(noteKey), "data-pair": TH.pairT(noteKey) }));
      const titlePair = inPair(() => layerLabel(layer));
      if (pin) steps.push({ el: pin, title: layerLabel(layer), pair: titlePair, body: body.slice(0, 2).length ? body.slice(0, 2) : body, round: true });
      steps.push({ el: card, title: layerLabel(layer), pair: titlePair, body, action: navBtn });
      tour(pin ? [steps[0], steps[1]] : steps);
      return "";
    }
    if (plan.kind === "truck") {
      go("");
      const el = await waitFor(".truck-status");
      if (el) tour([{ el, title: t("vaTruckReply"), pair: TH.pairT("vaTruckReply"), body: [] }]);
      return "";
    }
    if (plan.kind === "bags") {
      TH.views.bagSheet();
      return "";
    }
    if (plan.kind === "dropoff") {
      TH.mapState.cat = "general";
      go("map/general");
      return "";
    }
    return "";
  }

  function calloutBody(s) {
    const it = s.it, out = [];
    if (s.kind === "prep") {
      // The same step icons as the list, lit one after another so the order reads at a glance.
      const steps = (it.steps || []).filter(x => L(x.title)).slice(0, 4);
      if (steps.length) out.push(h("ol", { class: "va-co-strip", style: `--n:${steps.length}` }, steps.map((x, k) => h("li", { style: `--k:${k}` },
        h("span", { class: "va-cs-n", text: String(k + 1) }),
        h("span", { class: "va-cs-art" }, icon(x.icon || "circle-check", 24)),
        h("span", { class: "va-cs-t", text: L(x.title), "data-pair": TH.pairOf(x.title) })))));
    } else {
      if (it.handover) out.push(h("p", { text: L(it.handover), "data-pair": TH.pairOf(it.handover) }));
      const layer = LAYER_OF[it.id];
      if (layer) out.push(h("button", { class: "btn btn-secondary small", type: "button", onclick: () => { endTour(); act({ kind: "map", layer, items: [it.id] }, false); } }, icon("map", 16), t("vaSeeMap")));
    }
    if (it.warn && s.kind !== "special") out.push(h("p", { class: "va-co-warn" }, icon("alert-triangle", 16), h("span", { text: L(it.warn), "data-pair": TH.pairOf(it.warn) })));
    return out;
  }

  const sleep = ms => new Promise(r => setTimeout(r, ms));
  async function waitFor(sel, ms = 4000) {
    const end = Date.now() + ms;
    while (Date.now() < end) { const el = document.querySelector(sel); if (el) return el; await sleep(60); }
    return null;
  }

  // ------------------------------------------------------------ spotlight tour
  let spot = null;
  // A frame, or 50 ms when frames are paused (a background tab), so waiting never hangs.
  const nextFrame = () => new Promise(r => { const t = setTimeout(r, 50); requestAnimationFrame(() => { clearTimeout(t); r(); }); });
  const REDUCED_MOTION = () => window.matchMedia && matchMedia("(prefers-reduced-motion: reduce)").matches;
  // Wait until an element stops moving (a step unfolding, a smooth scroll), up to `max` ms.
  async function settle(el, max) {
    const end = Date.now() + max; let prev = "", same = 0;
    while (Date.now() < end) {
      await nextFrame();
      if (!el.isConnected) return;
      const r = el.getBoundingClientRect(), k = `${Math.round(r.left)},${Math.round(r.top)},${Math.round(r.width)},${Math.round(r.height)}`;
      if (k === prev) { if (++same >= 4) return; } else { same = 0; prev = k; }
    }
  }
  function endTour() {
    if (!spot) return;
    const s = spot; spot = null;
    s.stop();
    s.root.classList.remove("open"); setTimeout(() => s.root.remove(), 180);
  }
  function tour(steps) {
    steps = steps.filter(s => s && s.el);
    if (!steps.length) return;
    endTour();
    let i = 0, raf = 0, lastKey = "", turn = 0;
    const hole = h("div", { class: "va-hole", "aria-hidden": "true" });
    const card = h("div", { class: "va-callout", role: "dialog", "aria-live": "polite" });
    const root = h("div", { class: "va-spot glide" }, h("div", { class: "va-spot-catch", onclick: endTour }), hole, card);
    document.body.append(root);
    // The page can re-render the framed row; find it again by its selector.
    const target = st => {
      if (!st.el.isConnected && st.sel) { const el = document.querySelector(st.sel); if (el) st.el = el; }
      return st.el.isConnected ? st.el : null;
    };
    const place = () => {
      const st = steps[i]; if (!st) return;
      const el = target(st); if (!el) return;
      const r = el.getBoundingClientRect(), pad = st.round ? 10 : 6;
      const key = [r.left, r.top, r.width, r.height, window.innerWidth, window.innerHeight, card.offsetHeight].map(Math.round).join();
      if (key === lastKey) return;
      lastKey = key;
      Object.assign(hole.style, { left: `${r.left - pad}px`, top: `${r.top - pad}px`, width: `${r.width + pad * 2}px`, height: `${r.height + pad * 2}px`, borderRadius: st.round ? "50%" : "16px" });
      const vh = window.innerHeight, cw = Math.min(window.innerWidth - 24, 360);
      card.style.width = `${cw}px`;
      card.style.left = `${Math.max(12, Math.min(window.innerWidth - cw - 12, r.left + r.width / 2 - cw / 2))}px`;
      const ch = card.offsetHeight;
      const below = r.bottom + pad + 14, above = r.top - pad - 14 - ch;
      const putBelow = below + ch <= vh - 12 || above < 12;
      card.style.top = `${putBelow ? Math.min(below, vh - ch - 12) : above}px`;
      card.classList.toggle("up", !putBelow);
      const ax = Math.max(18, Math.min(cw - 18, r.left + r.width / 2 - parseFloat(card.style.left)));
      card.style.setProperty("--ax", `${ax}px`);
    };
    const show = async () => {
      const my = ++turn, st = steps[i];
      const alive = () => my === turn && spot === me && target(st);
      // While moving to the next part the frame glides there and the callout steps aside.
      root.classList.add("glide"); card.classList.add("busy");
      // A ticked-off step in the list folds away; open it and wait for the unfold to finish.
      // The page may re-render meanwhile (opening the list it is already on), so check again
      // on the fresh row.
      for (let tries = 0; tries < 3; tries++) {
        const el = target(st); if (!el) return;
        const folded = el.closest(".plan-step.folded");
        if (folded) { const head = folded.querySelector(".ps-head"); if (head) head.click(); }
        await settle(el, 900);
        if (my !== turn || spot !== me) return;
        const now = target(st);
        if (now === el && !now.closest(".plan-step.folded")) break;
      }
      if (!alive()) return;
      const r = st.el.getBoundingClientRect();
      const off = q => q.top < 70 || q.bottom > window.innerHeight - 220;
      if (off(r)) {
        st.el.scrollIntoView({ block: "center", behavior: REDUCED_MOTION() ? "auto" : "smooth" });
        await settle(st.el, 1400);
        if (!alive()) return;
        // Some web views ignore smooth scrolling; jump there instead.
        if (Math.abs(st.el.getBoundingClientRect().top - r.top) < 2 && off(r)) st.el.scrollIntoView({ block: "center" });
      }
      const last = i === steps.length - 1;
      fill(card,
        h("div", { class: "va-co-head" }, h("span", { class: "va-co-icon" }, icon("sparkles", 16)), h("strong", { text: st.title, "data-pair": st.pair }),
          steps.length > 1 ? h("span", { class: "va-co-count", text: `${i + 1}/${steps.length}` }) : null),
        h("div", { class: "va-co-body" }, st.body || []),
        h("div", { class: "va-co-actions" }, st.action || null,
          h("button", { class: "btn " + (st.action ? "btn-secondary" : "btn-primary"), type: "button", onclick: () => { if (last) endTour(); else { i++; show(); } } }, last ? t("vaGotIt") : t("vaNext"))));
      lastKey = ""; place();
      buzz();
      root.classList.add("open"); card.classList.remove("busy");
      hole.classList.remove("pulse"); void hole.offsetWidth; hole.classList.add("pulse");
      // The target has stopped moving: once the glide lands, follow it exactly.
      setTimeout(() => { if (my === turn) root.classList.remove("glide"); }, 280);
    };
    // Follow the framed part every frame: it can move with no scroll event at all
    // (a step folding above it, a panel opening, the map panning, the keyboard closing).
    const follow = () => { place(); raf = requestAnimationFrame(follow); };
    // Scroll and resize events as well, for when frames are throttled.
    const vv = window.visualViewport;
    const me = { root, place, stop: () => {
      cancelAnimationFrame(raf);
      window.removeEventListener("scroll", place, true); window.removeEventListener("resize", place);
      if (vv) vv.removeEventListener("resize", place);
    } };
    spot = me;
    raf = requestAnimationFrame(follow);
    window.addEventListener("scroll", place, true); window.addEventListener("resize", place);
    if (vv) vv.addEventListener("resize", place);
    TH.onNavigate(endTour);
    show();
  }

  // ------------------------------------------------------------ the button
  const fab = h("button", { class: "va-fab", type: "button", "aria-label": t("vaOpen"), onclick: openPanel }, icon("microphone", 26));
  function syncFab() {
    const view = (location.hash.replace(/^#\/?/, "").split("/")[0]) || "";
    const hide = view === "welcome" || view === "scan" || view === "learn" || !TH.rules();
    fab.hidden = hide;
    fab.setAttribute("aria-label", t("vaOpen"));
    fab.dataset.view = view || "home";
  }
  function mount() {
    if (!fab.isConnected) document.body.append(fab);
    syncFab();
    new MutationObserver(syncFab).observe(document.getElementById("app"), { childList: true });
  }
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", mount); else mount();

  TH.assistant = { open: openPanel, understand, decide, ask: text => act(decide(understand(text)), false) };
})();
