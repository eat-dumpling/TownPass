// SPDX-License-Identifier: AGPL-3.0-or-later
// After a photo: 回收小里長's scan result (recycle-li/web/src/views/CatchView.vue on develop), for adults and new residents.
// Same guide card — what kind it is (recycling-logo colour) → 臺北分類 → 什麼時候 → 交給 → 先這樣做 (StepStrip) → note —
// with this app's fonts, no 注音, and without the part below the card (drag into a bin, stars, rewards, mascot).
// Data is 回收小里長's own: its item list (rv_items.json) and the city's 資源回收分類方式 (rv_categories.json).
// Route: #/learn/<回收小里長 item id>.
"use strict";

(function () {
  const TH = window.TH;
  const { h, t, go, fill } = TH;
  const icon = (...a) => TH.icon(...a);

  Object.assign(window.TH_STRINGS.zh, {
    lnTitle: "怎麼丟", lnTaipei: "臺北分類", lnWhen: "什麼時候", lnTo: "交給", lnPrep: "先這樣做",
    lnAgain: "再掃一個", lnHome: "回首頁", lnToss: "我要丟棄", lnAsk: "官方說法不一致，丟之前請先問清潔隊。", lnCall: "撥打 1999",
    lnNotThis: "不是這個？",
    lnSafe_help: "需要拆解或搬動，可找人幫忙", lnSafe_adult: "較重或有危險，小心處理", lnSafe_no_touch: "不要直接用手拿",
    lnBag: "袋子", lnNote: "注意", lnHow: "怎麼處理",
    lnBag_required: "要裝臺北市專用垃圾袋，沒有專用袋不收", lnBag_exempt: "不用專用垃圾袋，用一般袋子裝好就可以", lnBag_food: "不用專用袋，先瀝乾，用有蓋的容器裝",
    lnBag_special: "不用專用袋，和其他回收物分開包好", lnBag_booking: "不用裝袋，先打電話預約清潔隊", lnBag_unknown: "先問清潔隊（1999）怎麼處理",
  });
  Object.assign(window.TH_STRINGS.en, {
    lnTitle: "How to toss it", lnTaipei: "Taipei category", lnWhen: "When", lnTo: "Hand it to", lnPrep: "Do this first",
    lnAgain: "Scan another", lnHome: "Home", lnToss: "Throw it out", lnAsk: "Official sources disagree. Ask the cleaning squad before you throw it out.", lnCall: "Call 1999",
    lnNotThis: "Not this?",
    lnSafe_help: "May need taking apart or carrying — ask for help", lnSafe_adult: "Heavy or hazardous — handle with care", lnSafe_no_touch: "Don't pick it up with bare hands",
    lnBag: "Bag", lnNote: "Note", lnHow: "How",
    lnBag_required: "Taipei official garbage bag (not collected without one)", lnBag_exempt: "No official bag needed — any bag is fine", lnBag_food: "No official bag — drain it, use a lidded container",
    lnBag_special: "No official bag — pack it apart from other recycling", lnBag_booking: "No bag — phone the cleaning squad to book first", lnBag_unknown: "Ask the cleaning squad (1999) first",
  });

  // Labels of the 回收小里長 tables below, as UI strings so every language gets them.
  Object.assign(window.TH_STRINGS.zh, { rvK_general: "一般垃圾", rvK_food: "廚餘", rvK_paper: "紙類", rvK_plastic: "塑膠類", rvK_glass: "玻璃類", rvK_can: "鐵鋁罐", rvK_tetra: "鋁箔包・紙容器", rvK_metal: "金屬類", rvK_other: "其他回收", rvK_hazard: "電池・燈管・廢油", rvK_bulky: "大型家具家電", rvK_special: "特殊處理", rvK_unknown: "請洽清潔隊", rvC_recycle_3d: "立體類", rvC_recycle_flat: "平面類", rvC_other: "其他類", rvC_food: "廚餘", rvC_general: "一般垃圾", rvC_bulky: "大型家具家電", rvC_special: "特殊處理", rvC_unknown: "請洽清潔隊", rvW_garbage_truck: "垃圾車", rvW_food_bin: "廚餘桶", rvW_recycle_truck: "資源回收車", rvW_retailer: "商店回收", rvW_appointment: "預約清潔隊", rvW_clinic: "醫院或藥局", rvP_empty: "倒空", rvPx_empty: "倒掉裡面剩下的飲料、食物或內容物。", rvP_rinse: "沖一下", rvPx_rinse: "用清水簡單沖一下，不用洗到全乾淨。", rvP_flatten: "壓扁", rvPx_flatten: "壓扁可以節省空間。", rvP_remove_film: "撕膜", rvPx_remove_film: "撕下封膜、抽出吸管；封膜和吸管丟一般垃圾。", rvP_wrap: "包好", rvPx_wrap: "用報紙或厚紙包好，避免割傷或漏出來。", rvP_tape_terminals: "貼膠帶", rvPx_tape_terminals: "電池兩端（電極）貼上膠帶，避免短路起火。", rvP_label: "寫標示", rvPx_label: "外面寫上內容物，例如「碎玻璃」「針頭」，提醒收的人。", rvP_drain: "瀝乾", rvPx_drain: "先把水分瀝乾再倒。", rvP_vent_gas: "排空氣", rvPx_vent_gas: "到戶外通風處按壓噴頭，把剩下的氣體排空，遠離火源。", rvP_remove_tape: "抽出磁帶", rvPx_remove_tape: "把磁帶抽出來；磁帶丟一般垃圾，外殼回收。", rvGenLabel: "一般垃圾（不可回收）", rvGenWhen: "交垃圾車（週三、週日停收）", rvUnkLabel: "官方說法不一致", rvUnkWhen: "請問清潔隊" });
  Object.assign(window.TH_STRINGS.en, { rvK_general: "Other trash", rvK_food: "Food waste", rvK_paper: "Paper", rvK_plastic: "Plastic", rvK_glass: "Glass", rvK_can: "Cans", rvK_tetra: "Cartons", rvK_metal: "Metal", rvK_other: "Other recycling", rvK_hazard: "Hazardous", rvK_bulky: "Bulky", rvK_special: "Special", rvK_unknown: "Ask first", rvC_recycle_3d: "Recycling, 3-D", rvC_recycle_flat: "Recycling, flat", rvC_other: "Recycling, other", rvC_food: "Food waste", rvC_general: "General trash", rvC_bulky: "Bulky items", rvC_special: "Special handling", rvC_unknown: "Ask the cleaning squad", rvW_garbage_truck: "Garbage truck", rvW_food_bin: "Food bucket", rvW_recycle_truck: "Recycling truck", rvW_retailer: "Shop take-back", rvW_appointment: "Book the squad", rvW_clinic: "Hospital or pharmacy", rvP_empty: "Empty", rvPx_empty: "Pour out whatever is left inside.", rvP_rinse: "Rinse", rvPx_rinse: "A quick rinse with water is enough.", rvP_flatten: "Flatten", rvPx_flatten: "Squash it to save space.", rvP_remove_film: "Peel film", rvPx_remove_film: "Peel off the film and take out the straw; those go in general trash.", rvP_wrap: "Wrap", rvPx_wrap: "Wrap it in newspaper or thick paper so no one gets cut and nothing leaks.", rvP_tape_terminals: "Tape ends", rvPx_tape_terminals: "Tape over the battery ends so they can't short and catch fire.", rvP_label: "Label", rvPx_label: "Write what is inside on the outside, e.g. \"broken glass\", so the collector knows.", rvP_drain: "Drain", rvPx_drain: "Drain off the liquid first.", rvP_vent_gas: "Vent gas", rvPx_vent_gas: "Outdoors, away from flames, press the nozzle until it is empty.", rvP_remove_tape: "Pull tape", rvPx_remove_tape: "Pull the tape out; the tape is general trash, the case is recycled.", rvGenLabel: "General trash (not recyclable)", rvGenWhen: "Garbage truck (no pickup Wed, Sun)", rvUnkLabel: "Official sources disagree", rvUnkWhen: "Ask the cleaning squad" });
  // ---- 回收小里長 domain/catalog.ts (labels in Chinese and English)
  const KIND = {
    general: ["一般垃圾", "Other trash", "#D2552A", "trash"], food: ["廚餘", "Food waste", "#6E8B3D", "leaf"],
    paper: ["紙類", "Paper", "#1B2A6B", "file-text"], plastic: ["塑膠類", "Plastic", "#B5161E", "bottle"],
    glass: ["玻璃類", "Glass", "#2E9D45", "bottle"], can: ["鐵鋁罐", "Cans", "#6B2D26", "cylinder"],
    tetra: ["鋁箔包・紙容器", "Cartons", "#D6157A", "milk"], metal: ["金屬類", "Metal", "#C99A26", "scissors"],
    other: ["其他回收", "Other recycling", "#2F6F86", "recycle"], hazard: ["電池・燈管・廢油", "Hazardous", "#5B3E99", "battery-2"],
    bulky: ["大型家具家電", "Bulky", "#475259", "sofa"], special: ["特殊處理", "Special", "#E6692C", "alert-triangle"],
    unknown: ["請洽清潔隊", "Ask first", "#AD7B2B", "phone"],
  };
  const CATEGORY = { // id: [zh, en, official sub-category for its days]
    recycle_3d: ["立體類", "Recycling, 3-D", "r3d_general"], recycle_flat: ["平面類", "Recycling, flat", "rflat_paper"],
    other: ["其他類", "Recycling, other", "other_hazard"], food: ["廚餘", "Food waste", "food"],
    general: ["一般垃圾", "General trash", null], bulky: ["大型家具家電", "Bulky items", "bulky"],
    special: ["特殊處理", "Special handling", null], unknown: ["請洽清潔隊", "Ask the cleaning squad", null],
  };
  const PREP = { // [zh, en, icon, explanation zh, explanation en]
    empty: ["倒空", "Empty", "glass-off", "倒掉裡面剩下的飲料、食物或內容物。", "Pour out whatever is left inside."],
    rinse: ["沖一下", "Rinse", "droplets", "用清水簡單沖一下，不用洗到全乾淨。", "A quick rinse with water is enough."],
    flatten: ["壓扁", "Flatten", "arrows-minimize", "壓扁可以節省空間。", "Squash it to save space."],
    remove_film: ["撕膜", "Peel film", "scissors", "撕下封膜、抽出吸管；封膜和吸管丟一般垃圾。", "Peel off the film and take out the straw; those go in general trash."],
    wrap: ["包好", "Wrap", "package", "用報紙或厚紙包好，避免割傷或漏出來。", "Wrap it in newspaper or thick paper so no one gets cut and nothing leaks."],
    tape_terminals: ["貼膠帶", "Tape ends", "bandage", "電池兩端（電極）貼上膠帶，避免短路起火。", "Tape over the battery ends so they can't short and catch fire."],
    label: ["寫標示", "Label", "tag", "外面寫上內容物，例如「碎玻璃」「針頭」，提醒收的人。", "Write what is inside on the outside, e.g. \"broken glass\", so the collector knows."],
    drain: ["瀝乾", "Drain", "droplet-half-2", "先把水分瀝乾再倒。", "Drain off the liquid first."],
    vent_gas: ["排空氣", "Vent gas", "wind", "到戶外通風處按壓噴頭，把剩下的氣體排空，遠離火源。", "Outdoors, away from flames, press the nozzle until it is empty."],
    remove_tape: ["抽出磁帶", "Pull tape", "scissors", "把磁帶抽出來；磁帶丟一般垃圾，外殼回收。", "Pull the tape out; the tape is general trash, the case is recycled."],
  };
  const WHERE = {
    garbage_truck: ["垃圾車", "Garbage truck", "truck"], food_bin: ["廚餘桶", "Food bucket", "bucket"], recycle_truck: ["資源回收車", "Recycling truck", "recycle"],
    retailer: ["商店回收", "Shop take-back", "building-store"], appointment: ["預約清潔隊", "Book the squad", "phone"], clinic: ["醫院或藥局", "Hospital or pharmacy", "building-hospital"],
  };
  const BAG_ICON = { required: "shopping-bag", exempt: "paper-bag", food: "bucket", special: "package", booking: "phone", unknown: "help-circle" };
  const kebab = s => String(s || "").replace(/([a-z0-9])([A-Z0-9])/g, "$1-$2").toLowerCase();

  let data = null;
  const load = () => data ? Promise.resolve(data) : Promise.all([
    fetch("vendor/recycle-vision/data/rv_items.json").then(r => r.json()),
    fetch("vendor/recycle-vision/data/rv_categories.json").then(r => r.json()),
    fetch("data/rv_map.json").then(r => r.json()),
  ]).then(([items, cats, map]) => (data = { items: new Map(items.map(i => [i.id, i])), cats, map }));

  // 「我要丟棄」: put it in the home picker's selection (flow.js keeps it in localStorage "th.picks") and go home.
  // Things without their own Trash Helper entry go in as their category's home tile.
  const GROUP_TILE = { general: "tissue", rigid: "plastic", flat: "paper", food: "leftovers", hazard: "battery", bulky: "furniture" };
  function homeItemOf(rvId) {
    const id = data.map.map[rvId];
    if (id) return id;
    const fb = data.map.fallback[rvId];
    return fb ? GROUP_TILE[fb.group] || null : null;
  }
  function toss(id) {
    try {
      const sel = JSON.parse(localStorage.getItem("th.picks") || "[]");
      if (!sel.includes(id)) sel.push(id);
      localStorage.setItem("th.picks", JSON.stringify(sel));
    } catch (_) { /* ignore */ }
    TH.onScanPick = null;
    go("", { replace: true });
  }

  // Each table row gets the key of its translated label (the zh/en columns stay as documentation).
  for (const [tbl, pre] of [[KIND, "rvK_"], [CATEGORY, "rvC_"], [WHERE, "rvW_"], [PREP, "rvP_"]]) for (const [id, row] of Object.entries(tbl)) { row.key = pre + id; row.textKey = "rvPx_" + id; }
  const zh = () => TH.lang() === "zh";
  const pick = row => t(row.key);
  // Item names and notes in the user's language: rv_items.json has zh/en/vi/id names and zh notes;
  // the rest come from i18n/<code>.js (TH_RVTXT).
  const rvTxt = () => (window.TH_RVTXT || {})[TH.lang()] || {};
  const nameOf = it => it.name[TH.lang()] || (rvTxt().names || {})[it.id] || it.name.en || it.name.zh;
  const noteOf = it => zh() ? it.notes || "" : (rvTxt().notes || {})[it.id] || "";
  TH.rvNameOf = nameOf;
  // For the camera page: recognised names and kinds in the user's language.
  TH.rvLocalize = () => load().then(() => (id, name, kindLabel) => {
    const it = data.items.get(id); if (!it) return { name, kindLabel };
    const k = KIND[it.kind];
    return { name: nameOf(it), kindLabel: k ? pick(k) : kindLabel };
  });
  const days = list => zh() ? "星期" + list.map(d => "日一二三四五六"[d]).join("、") : list.map(d => t("days")[d]).join(", ");

  // collectionOf(): 臺北分類 + 什麼時候, from the official list.
  function collection(it) {
    const off = data.cats.find(c => c.id === it.sub);
    if (off && off.id !== "non_recyclable") return zh() ? { label: `${off.major}・${off.sub}`, when: off.when } : { label: pick(CATEGORY[it.category] || CATEGORY.unknown), when: days(off.days) };
    if (it.category === "general") return { label: t("rvGenLabel"), when: t("rvGenWhen") };
    if (it.category === "special") return { label: pick(CATEGORY.special), when: noteOf(it) };
    if (it.category === "unknown") return { label: t("rvUnkLabel"), when: t("rvUnkWhen") };
    const c = CATEGORY[it.category];
    const off2 = c && c[2] ? data.cats.find(x => x.id === c[2]) : null;
    return { label: pick(c || CATEGORY.unknown), when: off2 ? days(off2.days) : "" };
  }

  // ItemArt: kind-coloured rounded square with the item's icon.
  const art = (it, k, size) => h("span", { class: "rv-art", style: `width:${size}px;height:${size}px;border-radius:${Math.round(size * 0.24)}px;background:${k[2]}` },
    icon(kebab(it.icon), Math.round(size * 0.6)));

  // Clear version for adults and new residents: every row says exactly what to do.
  function card(it) {
    const rules = TH.rules();
    const k = KIND[it.kind] || KIND.unknown;
    const coll = collection(it);
    const ours = data.map.map[it.id] ? TH.itemById(data.map.map[it.id]) : null;
    const fb = data.map.fallback[it.id];
    // A fallback mapped only to "verify" says nothing useful; 回收小里長's own where/notes are clearer then.
    const vague = !ours && fb && fb.group === "verify" && it.category !== "unknown";
    const group = ours ? rules.groups[ours.group] : fb && !vague ? rules.groups[fb.group] : null;
    const cat = group ? group.cat : { general: "general", food: "food", bulky: "bulky", unknown: "verify", special: "special" }[it.category] || "recycle";
    const bag = ours ? ours.bag : group ? group.bag : { general: "required", bulky: "booking", verify: "unknown" }[cat] || "exempt";
    const bagKey = ["required", "booking", "unknown"].includes(bag) ? bag : cat === "food" ? "food" : cat === "special" ? "special" : "exempt";
    // Special items: their days come from Trash Helper's group (the official list has no day for them).
    const when = it.category === "special" ? (group && group.days.length && !group.ask ? days(group.days) : "") : coll.when;
    const handover = ours && ours.handover ? TH.L(ours.handover) : group && group.note ? TH.L(group.note) : vague ? noteOf(it) : "";
    const steps = ours && (ours.steps || []).length
      ? ours.steps.map(s => ({ icon: s.icon || "check", title: TH.L(s.title), pair: TH.pairOf(s.title), text: s.text ? TH.L(s.text) : "", warn: s.warn ? TH.L(s.warn) : "" }))
      : (it.steps || []).filter(s => PREP[s]).map(s => ({ icon: PREP[s][2], title: pick(PREP[s]), pair: TH.pairT(PREP[s].key), text: t(PREP[s].textKey), warn: "" }));
    // Side-by-side language: the item's name in the second language (Chinese is already under it in other languages).
    const pl = TH.pairLang();
    const namePair = pl && pl !== "zh" ? (it.name[pl] || ((window.TH_RVTXT || {})[pl] || { names: {} }).names[it.id]) : undefined;
    const row = (ic, label, ...body) => h("div", {}, h("dt", {}, icon(ic, 18), label), h("dd", {}, body));
    return h("section", { class: "guide" + (it.safety !== "none" ? " danger" : ""), style: `--k:${k[2]}`, "aria-label": t("lnTitle") },
      h("div", { class: "guide-head" },
        art(it, k, 72),
        h("div", { class: "guide-name" },
          h("h2", { text: nameOf(it), "data-pair": namePair }),
          !zh() ? h("small", { text: it.name.zh }) : null,
          h("span", { class: "guide-kind", style: `background:${k[2]}` }, icon(k[3], 20), h("span", { text: pick(k), "data-pair": TH.pairT(k.key) })))),
      it.safety && it.safety !== "none" ? h("p", { class: "guide-safety" }, icon(it.safety === "no_touch" ? "hand-stop" : "alert-triangle", 18), t("lnSafe_" + it.safety)) : null,
      h("dl", { class: "guide-facts" },
        row("category", t("lnTaipei"), coll.label),
        when ? row("calendar", t("lnWhen"), when) : null,
        vague ? null : row(BAG_ICON[bagKey], t("lnBag"), h("span", { text: t("lnBag_" + bagKey), "data-pair": TH.pairT("lnBag_" + bagKey) })),
        (it.where || []).length || handover ? row("map-pin", t("lnTo"),
          (it.where || []).length ? h("span", { class: "guide-where" }, it.where.filter(w => WHERE[w]).map(w => h("span", {}, icon(WHERE[w][2], 18), h("span", { text: pick(WHERE[w]), "data-pair": TH.pairT(WHERE[w].key) })))) : null,
          handover ? h("small", { class: "guide-detail", text: handover }) : null) : null),
      steps.length ? [h("h3", { text: t("lnPrep"), "data-pair": TH.pairT("lnPrep") }),
        h("ol", { class: "guide-steps", "aria-label": t("lnPrep") }, steps.map((s, i) => h("li", {},
          h("span", { class: "guide-step-ic" }, icon(s.icon, 26), h("span", { class: "num", text: String(i + 1) })),
          h("span", { class: "guide-step-text" }, h("b", { text: s.title, "data-pair": s.pair }), s.text ? h("small", { text: s.text }) : null, s.warn ? h("small", { class: "warn", text: s.warn }) : null))))] : null,
      noteOf(it) && noteOf(it) !== when && noteOf(it) !== handover ? h("p", { class: "guide-note" }, icon("bulb", 18), h("span", { text: noteOf(it) })) : null);
  }

  function viewLearn(rvId) {
    TH.setHeader(t("lnTitle"));
    const out = h("div", { class: "learn" });
    load().then(() => {
      const it = data.items.get(rvId);
      if (!it) { go("pick", { replace: true }); return; }
      const flow = it.status === "conflict" || it.category === "unknown" ? "ask" : it.safety === "no_touch" ? "notouch" : "normal";
      const homeId = flow === "ask" ? null : homeItemOf(rvId);
      fill(out,
        card(it),
        flow === "ask" ? [h("p", { class: "guide-ask", text: t("lnAsk") }),
          h("button", { class: "btn btn-secondary wide", type: "button", onclick: () => TH.dial(TH.rules().contacts.hotline) }, icon("phone", 20), t("lnCall"))] : null,
        homeId ? h("button", { class: "btn btn-primary guide-toss", type: "button", onclick: () => toss(homeId) }, icon("trash", 22), t("lnToss")) : null,
        h("div", { class: "guide-links" },
          h("button", { class: "link-btn", type: "button", onclick: () => go("scan", { replace: true }) }, icon("camera", 18), t("lnAgain")),
          h("button", { class: "link-btn", type: "button", onclick: () => go("pick") }, icon("layout-grid", 18), t("lnNotThis")),
          homeId ? null : h("button", { class: "link-btn", type: "button", onclick: () => go("", { replace: true }) }, icon("home", 18), t("lnHome"))));
    }).catch(e => { console.warn("[learn]", e); go("pick", { replace: true }); });
    return out;
  }

  TH.routes = Object.assign(TH.routes || {}, { learn: a => viewLearn(decodeURIComponent(a || "")) });
})();
