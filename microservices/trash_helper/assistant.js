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
    leftovers: ["剩菜", "剩飯", "廚餘", "食物", "leftovers", "food waste", "food scraps"],
    paper: ["紙箱", "報紙", "紙類", "cardboard", "newspaper", "paper box"],
    oil: ["廢油", "食用油", "炸油", "cooking oil", "used oil"],
    tissue: ["衛生紙", "尿布", "面紙", "tissue", "diaper", "toilet paper"],
    brokenglass: ["碎玻璃", "破玻璃", "broken glass"],
    ceramic: ["破碗", "碗盤", "陶瓷", "broken plate", "ceramic"],
    spray: ["噴霧罐", "瓦斯罐", "卡式瓦斯", "spray can", "aerosol", "gas can"],
    phone: ["手機", "舊手機", "小家電", "吹風機", "phone", "mobile phone", "hair dryer"],
  };
  const INTENTS = {
    where: ["哪裡", "哪邊", "在哪", "去哪", "附近", "最近", "where", "nearest", "near me", "nearby", "closest"],
    map: ["地圖", "map", "show me"],
    where_clothes: ["舊衣回收箱", "舊衣箱", "回收箱", "clothes bin", "donation bin", "clothing bin"],
    where_battery: ["電池回收", "回收電池", "battery drop", "battery recycling"],
    where_pills: ["廢藥回收", "藥品回收", "回收藥", "medicine take back", "return medicine"],
    convenience_store: ["便利商店", "超商", "7-11", "711", "小七", "seven", "全家", "萊爾富", "ok超商", "全聯", "超市", "convenience store", "7-eleven", "familymart", "family mart", "hi-life", "supermarket"],
    pharmacy: ["藥局", "藥房", "醫院", "pharmacy", "drugstore", "drug store", "hospital", "chemist"],
    truck_time: ["幾點", "什麼時候", "何時", "時間", "幾時", "what time", "when"],
    truck: ["垃圾車", "回收車", "garbage truck", "trash truck", "truck"],
    where_dropoff: ["錯過", "沒趕上", "來不及", "收受點", "missed", "drop-off", "drop off point"],
    bulky: ["大型垃圾", "大型廢棄物", "大件", "bulky", "big item", "large item"],
    buy_bags: ["專用垃圾袋", "垃圾袋", "專用袋", "買袋", "garbage bag", "trash bag", "official bag", "buy bags"],
  };
  const LAYER_OF = { battery: "battery", clothes: "clothes", pills: "pills" };
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
      const m = new RegExp(`(^|[^\\p{L}\\p{N}])${esc}(?=$|[^\\p{L}\\p{N}])`, "u").exec(text);
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
      const words = new Set();
      const add = w => { const n = norm(w); if (n && n.length >= 1) words.add(n); };
      const addName = s => { if (!s) return; add(s); String(s).split(/[、，,／/（）()]/).forEach(p => { if (p.trim().length >= 2) add(p); }); };
      addName(it.name.en); addName(it.name.zh);
      for (const code of Object.keys(content)) addName((content[code] || {})[it.name.en]);
      (it.keywords || []).forEach(add);
      (EXTRA[it.id] || []).forEach(add);
      for (const code of Object.keys(voice)) ((voice[code].items || {})[it.id] || []).forEach(add);
      items.push({ id: it.id, words: [...words].filter(w => !STOP.has(w)) });
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
    // Items: longest matches first, no overlaps ("紙杯" beats "紙").
    const hits = [];
    for (const it of index.items) for (const w of it.words) {
      const at = found(text, w);
      if (at >= 0) hits.push({ id: it.id, at, len: w.length });
    }
    hits.sort((a, b) => b.len - a.len);
    const taken = [], items = [];
    for (const x of hits) {
      if (taken.some(([s, e]) => x.at < e && x.at + x.len > s)) continue;
      taken.push([x.at, x.at + x.len]);
      if (!items.includes(x.id)) items.push(x.id);
    }
    // Intents: whatever appears outside the item words.
    let rest = text;
    taken.forEach(([s, e]) => { rest = rest.slice(0, s) + " ".repeat(e - s) + rest.slice(e); });
    const has = {};
    // Only words outside the item names count, so "我想丟電池" is about batteries, not a battery drop-off.
    for (const [k, list] of Object.entries(index.intents)) has[k] = list.some(w => found(rest, w) >= 0);
    // "Where do I buy garbage bags?" names a bag but asks about the official bags.
    if (index.intents.buy_bags.some(w => found(text, w) >= 0) && items.every(id => id === "bag")) { items.length = 0; has.buy_bags = true; }
    return { items, has };
  }

  function decide(q) {
    const { items, has } = q;
    const placeQ = has.where || has.map || has.convenience_store || has.pharmacy;
    const fromItem = items.map(id => LAYER_OF[id]).find(Boolean);
    let layer = has.where_clothes ? "clothes" : has.where_battery ? "battery" : has.where_pills ? "pills" : null;
    if (!layer && fromItem && placeQ) layer = fromItem;
    if (!layer && !items.length && has.convenience_store) layer = "battery";
    if (!layer && !items.length && has.pharmacy) layer = "pills";
    if (layer) return { kind: "map", layer, items };
    if (!items.length && has.where_dropoff) return { kind: "dropoff" };
    if (!items.length && (has.truck || has.truck_time) && !has.buy_bags) return { kind: "truck" };
    if (!items.length && has.buy_bags) return { kind: "bags" };
    if (!items.length && has.bulky) return { kind: "plan", items: ["furniture"] };
    if (items.length) return { kind: "plan", items: items.slice(0, 4) };
    if (has.map || has.where) return { kind: "map", layer: null, items };
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
    const bubble = (who, text) => { log.append(h("div", { class: "va-msg " + who }, h("span", { text }))); log.scrollTop = log.scrollHeight; };
    async function ask(text) {
      text = (text || "").trim(); if (!text) return;
      bubble("me", text);
      status.textContent = t("vaThinking");
      await TH.whenRulesReady();
      const plan = decide(understand(text));
      const reply = await act(plan, true);
      bubble("bot", reply);
      say(reply);
      status.textContent = canListen() ? t("vaTap") : t("vaNoMic");
      if (plan.kind !== "unknown") setTimeout(() => { closePanel(); act(plan, false); }, 650);
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
        h("div", { class: "va-head" }, h("span", { class: "va-badge" }, icon("sparkles", 18)), h("h2", { text: t("vaTitle") }), speakToggle,
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
  async function act(plan, dryRun) {
    if (plan.kind === "unknown") return t("vaUnknown");
    if (plan.kind === "plan") {
      if (dryRun) return t("vaPlanReply", { items: joinNames(plan.items) });
      try { localStorage.setItem("th.picks", JSON.stringify(plan.items)); localStorage.setItem("th.lastPicks", JSON.stringify(plan.items)); } catch (_) { /* ignore */ }
      go("plan");
      const stops = [];
      for (const id of plan.items) {
        const it = itemById(id); if (!it) continue;
        stops.push({ sel: `[data-check="prep-${id}"]`, title: `${t("vaPrep")}・${L(it.name)}`, it, kind: "prep" });
        stops.push({ sel: `[data-check="sp-${id}"]`, title: `${t("vaWhere")}・${L(it.name)}`, it, kind: "special" });
      }
      const ready = await waitFor("[data-check]");
      if (!ready) return "";
      const found = stops.filter(s => document.querySelector(s.sel));
      // Items with nothing to prepare and nothing special: frame their row in "take it out".
      for (const id of plan.items) {
        const it = itemById(id); if (!it || found.some(s => s.it === it)) continue;
        const cat = TH.catOf(it);
        const row = [...document.querySelectorAll('[data-check^="drop-"]')].find(r => r.querySelector(`.art-${cat}`)) || document.querySelector(`[data-check="bag-${cat === "special" ? "hazard" : cat}"]`);
        if (row) found.push({ el: row, title: `${t("vaWhere")}・${L(it.name)}`, it, kind: "drop" });
      }
      tour(found.map(s => ({ el: s.el || document.querySelector(s.sel), title: s.title, body: calloutBody(s) })));
      return "";
    }
    if (plan.kind === "map") {
      const layer = plan.layer;
      if (dryRun) {
        if (!layer) return t("vaMapNoPos", { place: t("mapTitle") });
        return t("vaMapReply", { place: layerLabel(layer) });
      }
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
      body.push(h("p", { text: t({ clothes: "placeClothesNote", battery: "placeBatteryNote", pills: "placePillsNote" }[layer]) }));
      if (pin) steps.push({ el: pin, title: layerLabel(layer), body: body.slice(0, 2).length ? body.slice(0, 2) : body, round: true });
      steps.push({ el: card, title: layerLabel(layer), body, action: navBtn });
      tour(pin ? [steps[0], steps[1]] : steps);
      return "";
    }
    if (plan.kind === "truck") {
      if (dryRun) return t("vaTruckReply");
      go("");
      const el = await waitFor(".truck-status");
      if (el) tour([{ el, title: t("vaTruckReply"), body: [] }]);
      return "";
    }
    if (plan.kind === "bags") {
      if (dryRun) return t("vaBagsReply");
      TH.views.bagSheet();
      return "";
    }
    if (plan.kind === "dropoff") {
      if (dryRun) return t("vaDropReply");
      TH.mapState.cat = "general";
      go("map/general");
      return "";
    }
    return "";
  }

  function calloutBody(s) {
    const it = s.it, out = [];
    if (s.kind === "prep") {
      const titles = (it.steps || []).map(x => L(x.title)).filter(Boolean).slice(0, 4);
      if (titles.length) out.push(h("ol", { class: "va-co-steps" }, titles.map(x => h("li", { text: x }))));
    } else {
      if (it.handover) out.push(h("p", { text: L(it.handover) }));
      const layer = LAYER_OF[it.id];
      if (layer) out.push(h("button", { class: "btn btn-secondary small", type: "button", onclick: () => { endTour(); act({ kind: "map", layer, items: [it.id] }, false); } }, icon("map", 16), t("vaSeeMap")));
    }
    if (it.warn && s.kind !== "special") out.push(h("p", { class: "va-co-warn" }, icon("alert-triangle", 16), h("span", { text: L(it.warn) })));
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
  function endTour() {
    if (!spot) return;
    const s = spot; spot = null;
    window.removeEventListener("scroll", s.place, true); window.removeEventListener("resize", s.place);
    s.root.classList.remove("open"); setTimeout(() => s.root.remove(), 180);
  }
  function tour(steps) {
    steps = steps.filter(s => s && s.el);
    if (!steps.length) return;
    endTour();
    let i = 0;
    const hole = h("div", { class: "va-hole", "aria-hidden": "true" });
    const card = h("div", { class: "va-callout", role: "dialog", "aria-live": "polite" });
    const root = h("div", { class: "va-spot" }, h("div", { class: "va-spot-catch", onclick: endTour }), hole, card);
    document.body.append(root);
    const place = () => {
      const st = steps[i]; if (!st || !st.el.isConnected) return;
      const r = st.el.getBoundingClientRect(), pad = st.round ? 10 : 6;
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
      const st = steps[i];
      // A ticked-off step in the list folds away; open it so the framed row is visible.
      const folded = st.el.closest(".plan-step.folded");
      if (folded) { const head = folded.querySelector(".ps-head"); if (head) head.click(); await sleep(60); }
      const r = st.el.getBoundingClientRect();
      if (r.top < 70 || r.bottom > window.innerHeight - 220) { st.el.scrollIntoView({ block: "center", behavior: "smooth" }); await sleep(380); }
      const last = i === steps.length - 1;
      fill(card,
        h("div", { class: "va-co-head" }, h("span", { class: "va-co-icon" }, icon("sparkles", 16)), h("strong", { text: st.title }),
          steps.length > 1 ? h("span", { class: "va-co-count", text: `${i + 1}/${steps.length}` }) : null),
        h("div", { class: "va-co-body" }, st.body || []),
        h("div", { class: "va-co-actions" }, st.action || null,
          h("button", { class: "btn " + (st.action ? "btn-secondary" : "btn-primary"), type: "button", onclick: () => { if (last) endTour(); else { i++; show(); } } }, last ? t("vaGotIt") : t("vaNext"))));
      place();
      buzz();
      root.classList.add("open");
      hole.classList.remove("pulse"); void hole.offsetWidth; hole.classList.add("pulse");
    };
    spot = { root, place };
    window.addEventListener("scroll", place, true); window.addEventListener("resize", place);
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
