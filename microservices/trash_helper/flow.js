// SPDX-License-Identifier: AGPL-3.0-or-later
// Trash Helper — "tonight I take out the trash" flow.
//   1. First run (#/welcome/0-3): use location once to work out the user's own facts —
//      their truck stop and times, the cleaning squad for bulky waste, the nearest drop-off
//      point, bag shops in their district — and ask whether a building collects for them.
//   2. Home: pick what you are throwing out.
//   3. Plan (#/plan): a checklist built from the picks — get bags → prepare each item →
//      take it out (or hand it to the building) → special items, with the nearest places.
// Location stays on the phone: only the district, village and chosen stop are kept.
"use strict";

(function () {
  const TH = window.TH;
  const { h, t, L, go, fill, btn, SCH } = TH;
  const icon = (...a) => TH.icon(...a);

  // ------------------------------------------------------------ strings
  Object.assign(window.TH_STRINGS.zh, {
    tonightWord: "今晚", commGeneral: "一般垃圾（專用袋）", commFood: "廚餘", commFlat: "平面回收", commRigid: "立體回收", commBattery: "電池另裝",
    wTitle: "第一次在臺北丟垃圾？",
    wLead: "設定一次，之後點「這些東西要怎麼丟」就好。",
    wP1: "你家的垃圾車幾點來", wP2: "大型垃圾、電池找誰", wP3: "勾選後自動排好步驟",
    wStart: "開始設定", wSkip: "先逛逛",
    wWhere: "你住哪裡附近？", wWhereLead: "位置只在手機上使用，不會上傳。",
    wLocate: "使用我的位置", wOrArea: "或選擇你的里", wAnalyzing: "正在分析你家附近…",
    wYourInfo: "你家附近", wYourTruck: "你的垃圾車", wPickTruck: "選一個方便的停靠點",
    wBulky: "大型垃圾", wBulkyText: "{district}清潔隊・免費預約",
    wMissed: "錯過垃圾車", wMissedText: "{name}・{dist}",
    wBags: "專用垃圾袋", wBagsText: "{district} {n} 家代售點",
    wNext: "下一步", wCommunity: "你住的地方有人代收垃圾嗎？", wCommunityLead: "例如大樓管理室或社區垃圾間。",
    wCommYes: "有，社區代收", wCommYesText: "照社區規定分類就好", wCommNo: "沒有，我自己追垃圾車", wCommNoText: "幫你算好時間地點",
    wDone: "設定好了！", wDoneLead: "之後打開，點「這些東西要怎麼丟」就好。", wRemind: "垃圾車來前 10 分鐘提醒我", wGo: "開始丟垃圾",
    todayAtStop: "今天 {time} 收", todayDone: "今天的車已經走了",
    wChange: "更改", hello0: "早安", hello1: "午安", hello2: "晚安",
    hQuestion: "今天要丟什麼？", hLead: "點選手上的東西，我們幫你排好步驟。",
    gDaily: "每天都會有的", gSometimes: "偶爾才有的", gBig: "大型的",
    hSearch: "搜尋要丟的東西", hScanAdd: "拍照", hLast: "上次丟的：", hAgain: "再一次",
    // Home row (opens the list) and the list's main button (opens the steps): said as what the
    // newcomer does next, "pick what you're throwing out" then "see how to throw them out".
    hSelected: "已選 {n} 樣", hPickRow: "這些東西要怎麼丟", hSeeHow: "看怎麼丟",
    truckToday: "{when} {time}", truckLeft: "還有 {h} 小時 {m} 分", truckLeftM: "還有 {m} 分鐘", truckNow: "車快到了！",
    truckNone: "還沒設定你的垃圾車", commBadge: "社區代收",
    pTitle: "我的丟垃圾清單", pEdit: "修改",
    s1: "準備袋子", s1General: "一般垃圾 → 專用垃圾袋", s1GeneralSize: "少量用 3–5 公升，幾天份用 14–25 公升",
    s1Recycle: "回收物 → 任何袋子，紙和瓶罐分開", s1Food: "廚餘 → 有蓋容器，先瀝乾",
    s1Hazard: "電池、燈管 → 另裝一袋", s1Buy: "去哪買", s1Sizes: "容量價格",
    s2: "先處理一下", s2Lead: "照著做，清潔隊員才收得走。",
    s3Truck: "出門丟", s3Comm: "交給社區", s3When: "{when} {time} 到", s3Remind: "提醒我", s3Map: "看地圖",
    s3General: "一般垃圾 → 丟進垃圾車", s3Food: "廚餘 → 車後藍色桶", s3Recycle: "回收物 → 後面的回收車",
    s3NotDay: "{day}也收{name}。",
    s3Missed: "錯過了？", s3MissedText: "{name}（{dist}）{day} {hours}",
    s3CommText: "分好類，交給社區", s3CommList: "一般垃圾（專用袋）、廚餘、回收、電池分開放",
    s3NoStop: "先選你的垃圾車。", s3PickStop: "選我的垃圾車",
    s4: "特別的東西",
    sBulky: "{name}：預約清潔隊免費載走", sBulkyCall: "打給{district}清潔隊", sBulkyPut: "通常晚上 9 點後放到約好的地方",
    sTakeback: "{name}：回收車或便利商店、超市", s4AllOnMap: "地圖上看全部",
    sClothes: "舊衣：週一、五交回收車，或投舊衣箱",
    sPills: "過期藥：拿到藥局或醫院回收", sSpray: "噴霧罐：先在戶外排空",
    sAsk: "{name}：先問清潔隊",
    clearPicks: "全部取消",
    stBags: "袋子", stPrep: "處理", stGo: "出門", stComm: "社區", stSpecial: "特別",
    bagGeneral: "專用垃圾袋", bagAny: "一般袋子", bagFood: "有蓋容器", bagApart: "另裝一袋",
    binRecycleTip: "紙、瓶分開", binFoodTip: "先瀝乾",
    slotTruck: "垃圾車", slotFood: "廚餘桶", slotRecycle: "回收車", s3SlotsHint: "車來了，交出去", s3Change: "換時間", s3MissedLink: "錯過了？{name}收受點 {hours} ›",
    s3CommHint: "分好類，交給社區：", s3MissedShort: "錯過了？{name}收受點 {dist}",
    spBulky: "預約清潔隊來載", spAsk: "先問清潔隊", spCall: "打電話", spTake: "便利商店、超市",
    spClothes: "舊衣回收箱", spPills: "藥局回收", spSpray: "戶外排空，再交回收車",
    stepDone: "做好了，下一步", allStepsDone: "全部完成", prevStep: "上一步",
    doneLead: "下次打開，點「這些東西要怎麼丟」就好。", seeAgain: "再看一次步驟",
    s3OtherDay: "換一天", s1For: "要裝：", s1BuyMap: "附近哪裡買", s1ShopList: "全部代售點", s1BagRule: "回收物、廚餘不用專用袋。新北市專用袋也能用。", moreSizes: "容量", moreDetails: "看詳情", fullGuide: "完整說明", moreParts: "拆成哪些", moreHow: "怎麼分", moreOptions: "其他方式",
  });
  Object.assign(window.TH_STRINGS.en, {
    tonightWord: "Tonight", commGeneral: "General (official bag)", commFood: "Food waste", commFlat: "Flat recycling", commRigid: "3-D recycling", commBattery: "Batteries apart",
    wTitle: "New to trash in Taipei?",
    wLead: "Set up once. After that, just tap “How do I throw these out?”",
    wP1: "When your truck comes", wP2: "Who takes bulky items and batteries", wP3: "Steps planned for you",
    wStart: "Set up", wSkip: "Just look around",
    wWhere: "Where do you live?", wWhereLead: "Your location is only used on this phone.",
    wLocate: "Use my location", wOrArea: "Or choose your neighbourhood", wAnalyzing: "Looking around your home…",
    wYourInfo: "Near your home", wYourTruck: "Your truck", wPickTruck: "Pick a stop that suits you",
    wBulky: "Bulky waste", wBulkyText: "{district} cleaning squad · free pickup",
    wMissed: "Missed the truck", wMissedText: "{name} · {dist}",
    wBags: "Official bags", wBagsText: "{n} shops in {district}",
    wNext: "Next", wCommunity: "Does someone collect trash where you live?", wCommunityLead: "For example a building manager or trash room.",
    wCommYes: "Yes, the building collects", wCommYesText: "Just sort it their way", wCommNo: "No, I take it to the truck", wCommNoText: "We work out time and place",
    wDone: "All set!", wDoneLead: "Next time, just tap “How do I throw these out?”", wRemind: "Remind me 10 min before my truck", wGo: "Start",
    todayAtStop: "Truck today at {time}", todayDone: "Today's truck has gone",
    wChange: "Change", hello0: "Good morning", hello1: "Good afternoon", hello2: "Good evening",
    hQuestion: "What are you throwing out?", hLead: "Tap what you have. We'll put the steps in order.",
    gDaily: "Everyday", gSometimes: "Now and then", gBig: "Big items",
    hSearch: "Search for an item", hScanAdd: "Photo", hLast: "Last time: ", hAgain: "Same again",
    hSelected: "{n} picked", hPickRow: "How do I throw these out?", hSeeHow: "Show me how",
    truckToday: "{when} {time}", truckLeft: "in {h} h {m} min", truckLeftM: "in {m} min", truckNow: "The truck is almost here!",
    truckNone: "No truck stop chosen yet", commBadge: "Building collects",
    pTitle: "My trash plan", pEdit: "Edit",
    s1: "Get your bags ready", s1General: "General trash → official bag", s1GeneralSize: "Small: 3–5 L · a few days: 14–25 L",
    s1Recycle: "Recycling → any bag, paper apart from bottles", s1Food: "Food waste → lidded box, drained",
    s1Hazard: "Batteries, bulbs → separate bag", s1Buy: "Where to buy", s1Sizes: "Sizes & prices",
    s2: "Prepare each item", s2Lead: "Do this so the crew can take it.",
    s3Truck: "Take it out", s3Comm: "Hand it to your building", s3When: "{when} {time} at", s3Remind: "Remind me", s3Map: "Map",
    s3General: "General trash → into the truck", s3Food: "Food waste → blue bucket at the back", s3Recycle: "Recycling → the truck behind",
    s3NotDay: "{day} isn't the suggested day for {name}; still taken.",
    s3Missed: "Missed it?", s3MissedText: "{name} ({dist}) {day} {hours}",
    s3CommText: "Sort it and hand it to the building", s3CommList: "General (official bag), food, flat recycling, 3-D recycling, batteries apart",
    s3NoStop: "Choose your truck stop first so we can work out the time.", s3PickStop: "Choose my truck",
    s4: "Special items",
    sBulky: "{name}: book a free squad pickup", sBulkyCall: "Call {district} cleaning squad", sBulkyPut: "Usually put out after 9 pm where agreed",
    sTakeback: "{name}: recycling truck, convenience store or supermarket", s4AllOnMap: "See all on the map",
    sClothes: "Clothes: recycling truck Mon / Fri, or a clothes bin",
    sPills: "Expired medicine: take it to a pharmacy or hospital", sSpray: "Spray cans: empty them outdoors first",
    sAsk: "{name}: ask the cleaning squad first",
    clearPicks: "Clear all",
    stBags: "Bags", stPrep: "Prep", stGo: "Go", stComm: "Building", stSpecial: "Special",
    bagGeneral: "Official bag", bagAny: "Any bag", bagFood: "Lidded box", bagApart: "Separate bag",
    binRecycleTip: "Paper apart", binFoodTip: "Drain it",
    slotTruck: "Garbage truck", slotFood: "Food bin", slotRecycle: "Recycling truck", s3SlotsHint: "Hand it to the trucks", s3Change: "Change time", s3MissedLink: "Missed it? {name} drop-off {hours} ›",
    s3CommHint: "Sort it and hand it over:", s3MissedShort: "Missed it? {name} drop-off {dist}",
    spBulky: "Book a free squad pickup", spAsk: "Ask the cleaning squad", spCall: "Call", spTake: "Convenience store, supermarket",
    spClothes: "Clothes bin", spPills: "Pharmacy take-back", spSpray: "Empty outdoors, then recycling",
    stepDone: "Done, next", allStepsDone: "All done", prevStep: "Back",
    doneLead: "Next time, just tap “How do I throw these out?”", seeAgain: "See the steps again",
    s3OtherDay: "Other days", s1For: "For: ", s1BuyMap: "Where to buy nearby", s1ShopList: "All shops", s1BagRule: "Recycling and food waste need no official bag. New Taipei bags are accepted too.", moreSizes: "Sizes", moreDetails: "Details", fullGuide: "Full guide", moreParts: "Parts", moreHow: "How to sort", moreOptions: "Other options",
  });

  // The home "today" card when it follows your truck stop.
  for (const [code, atStop, done] of [
    ["vi", "Hôm nay xe đến lúc {time}", "Xe hôm nay đã đi rồi"],
    ["id", "Truk datang hari ini pukul {time}", "Truk hari ini sudah lewat"],
    ["fil", "May trak ngayon nang {time}", "Nakaalis na ang trak ngayong araw"],
    ["th", "วันนี้รถมา {time}", "รถวันนี้ไปแล้ว"],
    ["ko", "오늘 {time}에 수거해요", "오늘 수거차는 이미 지나갔어요"],
    ["ja", "今日 {time} に収集", "今日の収集車はもう行きました"],
  ]) if (window.TH_STRINGS[code]) Object.assign(window.TH_STRINGS[code], { todayAtStop: atStop, todayDone: done });

  // The guiding labels in the other languages (the generated i18n/<code>.js files load first),
  // and the welcome / finish lines that point at the home row by its name.
  for (const [code, pickRow, seeHow, lead, doneLead] of [
    ["vi", "Những thứ này vứt thế nào?", "Xem cách vứt", "Cài đặt một lần. Sau đó chỉ cần chạm vào “Những thứ này vứt thế nào?”", "Lần sau mở ra, chỉ cần chạm vào “Những thứ này vứt thế nào?”"],
    ["id", "Bagaimana membuang barang-barang ini?", "Lihat cara buang", "Atur sekali saja. Setelah itu, cukup ketuk “Bagaimana membuang barang-barang ini?”", "Lain kali, cukup ketuk “Bagaimana membuang barang-barang ini?”"],
    ["fil", "Paano itapon ang mga ito?", "Ipakita kung paano", "Mag-set up nang isang beses. Pagkatapos, i-tap na lang ang “Paano itapon ang mga ito?”", "Sa susunod, i-tap na lang ang “Paano itapon ang mga ito?”"],
    ["th", "ของพวกนี้ทิ้งยังไง", "ดูวิธีทิ้ง", "ตั้งค่าครั้งเดียว หลังจากนั้นแค่แตะ “ของพวกนี้ทิ้งยังไง”", "ครั้งหน้าเปิดแอป แล้วแค่แตะ “ของพวกนี้ทิ้งยังไง”"],
    ["ko", "이 물건들은 어떻게 버리나요?", "버리는 방법 보기", "한 번만 설정하면, 다음부터는 ‘이 물건들은 어떻게 버리나요?’를 누르면 돼요.", "다음부터는 앱을 열고 ‘이 물건들은 어떻게 버리나요?’를 누르면 돼요."],
    ["ja", "これはどう捨てる？", "捨て方を見る", "一度設定すれば、あとは「これはどう捨てる？」を押すだけです。", "次からは、「これはどう捨てる？」を押すだけです。"],
  ]) if (window.TH_STRINGS[code]) Object.assign(window.TH_STRINGS[code], { hPickRow: pickRow, hSeeHow: seeHow, wLead: lead, wDoneLead: doneLead, doneLead });

  // ------------------------------------------------------------ local state
  const LS = {
    get(k, d) { try { const v = localStorage.getItem(k); return v ? JSON.parse(v) : d; } catch (_) { return d; } },
    set(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch (_) { /* ignore */ } },
  };
  // Only district, village and the chosen stop are kept — never coordinates.
  const profile = { get: () => LS.get("th.profile.v1", {}), set: p => LS.set("th.profile.v1", { ...profile.get(), ...p }) };
  const picks = { get: () => LS.get("th.picks", []), set: v => LS.set("th.picks", v) };
  TH.profile = profile;

  const pad2 = n => String(n).padStart(2, "0");
  const hhmm = ms => { const p = SCH.taipeiParts(ms); return `${pad2(Math.floor(p.minutes / 60))}:${pad2(p.minutes % 60)}`; };
  const shortAddr = s => s.address.replace(/^臺北市/, "").replace(s.district, "");
  // Under 50 m reads "< 50 m": rounding put places at your stop's own address at "0 m", and the
  // positions (truck stop, shops placed by house number) are not that precise anyway.
  const fmtDist = m => m < 50 ? "< 50 m" : m < 1000 ? `${Math.round(m / 10) * 10} m` : `${(m / 1000).toFixed(1)} km`;
  const whenWord = v => {
    const now = Date.now();
    if (SCH.comesToday(v, now)) return SCH.taipeiParts(v.arriveMs).minutes >= 17 * 60 ? t("tonightWord") : t("today");
    if (SCH.comesToday(v, now + 86400000)) return t("tomorrow");
    return t("dayShort", { d: t("days")[SCH.taipeiParts(v.arriveMs).day] });
  };
  const myStop = () => { const p = profile.get(); return p.stopId && TH.stopsData() ? TH.stopsData().byId.get(p.stopId) : null; };
  const catOf = it => TH.rules().groups[it.group].cat;

  // ------------------------------------------------------------ onboarding
  function analyze(pos) {
    const data = TH.stopsData();
    const near = data.stops.map(s => ({ s, d: TH.haversine(pos, s) })).sort((a, b) => a.d - b.d);
    const seen = new Set(), stops = [];
    for (const x of near) { const k = x.s.address; if (seen.has(k)) continue; seen.add(k); stops.push(x); if (stops.length >= 3) break; }
    const drops = TH.dropData() ? TH.dropData().points.map(d => ({ d, dist: TH.haversine(pos, d) })).sort((a, b) => a.dist - b.dist) : [];
    return { district: near[0].s.district, village: near[0].s.village, stops, drop: drops[0] || null };
  }
  function infoRows(district, drop) {
    const rules = TH.rules();
    const squad = rules.contacts.squads[district];
    const vendors = TH.vendorsData();
    const nVend = vendors ? vendors.vendors.filter(v => vendors.districts[v[0]] === district).length : 0;
    const row = (ic, title, text, action) => h("div", { class: "info-row" }, h("span", { class: "info-art", "aria-hidden": "true" }, icon(ic, 22)),
      h("div", { class: "grow" }, h("strong", { text: title }), h("div", { class: "caption dark", text })), action || null);
    return [
      squad ? row("sofa", t("wBulky"), t("wBulkyText", { district }), h("button", { class: "mini-btn", type: "button", onclick: () => TH.dial(squad) }, icon("phone", 14), squad)) : null,
      drop ? row("clock", t("wMissed"), t("wMissedText", { name: `${drop.d.district} ${drop.d.squad}`, dist: fmtDist(drop.dist) }), h("button", { class: "mini-btn", type: "button", onclick: () => go("drop/" + drop.d.id) }, t("details"))) : null,
      nVend ? row("shopping-bag", t("wBags"), t("wBagsText", { district, n: nVend }), h("button", { class: "mini-btn", type: "button", onclick: () => go("buy") }, t("s1Buy"))) : null,
    ];
  }
  function stopChoice(list, chosen, onPick) {
    return h("div", { class: "stop-choices", role: "radiogroup", "aria-label": t("wPickTruck") }, list.map(x => {
      const v = TH.visitsOf(x.s)[0];
      const on = x.s.id === chosen;
      return h("button", { class: "stop-choice" + (on ? " on" : ""), type: "button", role: "radio", "aria-checked": String(on), onclick: () => onPick(x.s.id) },
        h("span", { class: "radio", "aria-hidden": "true" }),
        h("div", { class: "grow" }, h("strong", { text: shortAddr(x.s) }),
          h("div", { class: "caption dark", text: [v ? `${whenWord(v)} ${hhmm(v.arriveMs)}` : TH.fmtTime(x.s.arrive), x.d != null ? fmtDist(x.d) : null].filter(Boolean).join(" · ") })));
    }));
  }
  function viewWelcome(stepStr) {
    TH.setHeader(null);
    const step = Number(stepStr) || 0;
    const p = profile.get();
    // Progress counts the three setup steps only (place, building, done); the intro (step 0) has none,
    // and none shows when someone comes back later just to change their stop.
    const dots = step === 0 || p.setupDone ? null
      : h("div", { class: "w-dots", "aria-hidden": "true" }, [1, 2, 3].map(i => h("span", { class: i <= step ? "on" : "" })));
    const wrap = (...kids) => h("div", { class: "welcome" }, dots, kids);
    if (step === 0) {
      return wrap(
        h("div", { class: "w-hero", "aria-hidden": "true" }, h("span", { class: "w-hero-main" }, icon("truck", 64)), h("span", { class: "w-badge b1" }, icon("shopping-bag", 22)), h("span", { class: "w-badge b2" }, icon("recycle", 22)), h("span", { class: "w-badge b3" }, icon("leaf", 22))),
        h("h1", { class: "w-title", text: t("wTitle"), "data-pair": TH.pairT("wTitle") }), h("p", { class: "lead", text: t("wLead"), "data-pair": TH.pairT("wLead") }),
        h("ul", { class: "w-promises" }, [["map-pin", "wP1"], ["phone", "wP2"], ["list", "wP3"]].map(([ic, k]) => h("li", {}, h("span", { class: "wp-icon" }, icon(ic, 20)), t(k)))),
        h("div", { class: "w-actions" },
          btn("btn-primary wide", t("wStart"), () => go("welcome/1")),
          h("div", { class: "w-row" },
            TH.views.langButton(),
            h("button", { class: "link-btn small", type: "button", onclick: () => { profile.set({ setupDone: true }); go(afterSetup(), { replace: true }); }, text: t("wSkip") }))));
    }
    if (step === 1) {
      const out = h("div", { "aria-live": "polite" });
      let chosen = p.stopId || null;
      const showResult = (district, village, stops, drop) => {
        chosen = chosen && stops.some(x => x.s.id === chosen) ? chosen : stops[0] && stops[0].s.id;
        const draw = () => fill(out,
          h("div", { class: "w-place" }, icon("map-pin", 16), `${district} ${village}`),
          h("h3", { class: "section-title", text: t("wYourTruck"), "data-pair": TH.pairT("wYourTruck") }), h("p", { class: "caption dark", text: t("wPickTruck"), "data-pair": TH.pairT("wPickTruck") }),
          stopChoice(stops, chosen, id => { chosen = id; draw(); }),
          h("h3", { class: "section-title", text: t("wYourInfo"), "data-pair": TH.pairT("wYourInfo") }),
          h("div", { class: "info-card" }, infoRows(district, drop)),
          btn("btn-primary wide sticky-cta", t("wNext"), () => {
            profile.set({ district, village, stopId: chosen });
            if (chosen) TH.favOp("save", { stopId: chosen }).catch(() => {});
            // Someone already set up who only changes their stop goes straight back; the building
            // and "all set" pages are for the first time (or for leaving building collection).
            if (p.setupDone && p.community === false) go(afterSetup(), { replace: true });
            else go("welcome/2");
          }));
        draw();
      };
      const locate = async () => {
        fill(out, h("div", { class: "analyzing" }, h("span", { class: "spinner" }), t("wAnalyzing")));
        try {
          const [pos] = await Promise.all([TH.getLocation(), TH.loadStops(), TH.loadDrops().catch(() => null), TH.loadVendors().catch(() => null)]);
          TH.setLastPosition(pos);
          const a = analyze(pos);
          showResult(a.district, a.village, a.stops, a.drop);
        } catch (_) { fill(out, TH.notice(t("locationFailed"), "notice-warn")); }
      };
      const dSel = h("select", { class: "select", "aria-label": t("district") });
      const vSel = h("select", { class: "select", "aria-label": t("village"), disabled: true, style: "margin-top:8px" });
      Promise.all([TH.loadStops(), TH.loadDrops().catch(() => null), TH.loadVendors().catch(() => null)]).then(([data]) => {
        fill(dSel, h("option", { value: "", text: `${t("district")}${t("colon")}${t("choose")}` }), data.districts.map(d => h("option", { value: d, text: d })));
      });
      dSel.addEventListener("change", () => {
        const data = TH.stopsData();
        const vs = [...new Set(data.stops.filter(s => s.district === dSel.value).map(s => s.village))].sort();
        fill(vSel, h("option", { value: "", text: `${t("village")}${t("colon")}${t("choose")}` }), vs.map(v => h("option", { value: v, text: v })));
        vSel.disabled = !dSel.value;
      });
      vSel.addEventListener("change", () => {
        if (!vSel.value) return;
        const data = TH.stopsData();
        const list = data.stops.filter(s => s.district === dSel.value && s.village === vSel.value).sort((a, b) => a.arrive - b.arrive).map(s => ({ s, d: null }));
        const c = list.reduce((acc, x) => ({ lat: acc.lat + x.s.lat / list.length, lng: acc.lng + x.s.lng / list.length }), { lat: 0, lng: 0 });
        const drop = TH.dropData() ? TH.dropData().points.map(d => ({ d, dist: TH.haversine(c, d) })).sort((a, b) => a.dist - b.dist)[0] : null;
        showResult(dSel.value, vSel.value, list, drop);
      });
      return wrap(
        h("h1", { class: "w-title", text: t("wWhere"), "data-pair": TH.pairT("wWhere") }), h("p", { class: "lead", text: t("wWhereLead"), "data-pair": TH.pairT("wWhereLead") }),
        h("button", { class: "btn btn-primary wide", type: "button", onclick: locate }, icon("current-location", 20), t("wLocate")),
        h("details", { class: "w-manual" }, h("summary", { text: t("wOrArea") }), dSel, vSel),
        out);
    }
    if (step === 2) {
      const choose = c => { profile.set({ community: c }); go("welcome/3"); };
      const card = (c, e, title, text) => h("button", { class: "comm-card" + (p.community === c ? " on" : ""), type: "button", onclick: () => choose(c) },
        h("span", { class: "comm-art", "aria-hidden": "true" }, icon(e, 30)), h("div", { class: "grow" }, h("strong", { text: title }), h("div", { class: "caption dark", text })), icon("chev", 18));
      return wrap(h("h1", { class: "w-title", text: t("wCommunity"), "data-pair": TH.pairT("wCommunity") }), h("p", { class: "lead", text: t("wCommunityLead"), "data-pair": TH.pairT("wCommunityLead") }),
        card(true, "building-community", t("wCommYes"), t("wCommYesText")), card(false, "truck", t("wCommNo"), t("wCommNoText")));
    }
    // step 3
    const remindBtn = TH.bridge() && p.stopId && p.community === false ? btn("btn-secondary wide", t("wRemind"), async () => {
      remindBtn.disabled = true;
      try { await TH.loadStops(); await TH.loadFavs(true); await TH.setQuickReminders(TH.stopsData().byId.get(p.stopId), true, 10); remindBtn.textContent = t("remindOn"); }
      catch (_) { remindBtn.disabled = false; }
    }) : null;
    return wrap(h("div", { class: "w-hero done", "aria-hidden": "true" }, h("span", { class: "w-hero-main" }, icon("circle-check", 64))),
      h("h1", { class: "w-title", text: t("wDone"), "data-pair": TH.pairT("wDone") }), h("p", { class: "lead", text: t("wDoneLead"), "data-pair": TH.pairT("wDoneLead") }),
      remindBtn,
      btn("btn-primary wide", t("wGo"), () => { profile.set({ setupDone: true }); go(afterSetup(), { replace: true }); }));
  }

  // ------------------------------------------------------------ home: pick what you're throwing out
  const GROUPS = [
    ["gDaily", ["tissue", "leftovers", "pet", "cup", "lunchbox", "can", "carton", "paper", "bag", "glass", "styrofoam", "papercup"]],
    ["gSometimes", ["clothes", "books", "battery", "bulb", "spray", "oil", "pills", "ceramic", "brokenglass", "phone"]],
    ["gBig", ["furniture", "appliance"]],
  ];
  // Short labels for the picker and the plan; the full name stays on the item page.
  const SHORT = {
    tissue: ["一般垃圾", "General trash"], leftovers: ["廚餘", "Food waste"], cup: ["手搖飲杯", "Drink cup"],
    carton: ["紙盒、鋁箔包", "Cartons"], paper: ["紙類", "Paper"], phone: ["手機、小家電", "Small electronics"],
    plastic: ["硬塑膠、金屬", "Hard plastic, metal"], coconut: ["椰子殼", "Coconut shell"], tea: ["茶渣、咖啡渣", "Tea, coffee grounds"],
    battery: ["電池", "Batteries"], spray: ["噴霧罐", "Spray cans"], medicine: ["溫度計、藥罐", "Thermometer, pesticide"],
    towel: ["舊毛巾、棉被", "Towels, bedding"], receipt: ["貼紙底紙、相紙", "Sticker backing, photo paper"],
    ceramic: ["破碗盤", "Broken dishes"], furniture: ["大型家具", "Furniture"], appliance: ["大型家電", "Big appliances"],
  };
  // Short names exist for zh/en; other languages use the translated item name
  // (tissue and leftovers read as their category, as in zh/en).
  const label = it => {
    const lg = TH.lang();
    if (SHORT[it.id] && (lg === "zh" || lg === "en")) return SHORT[it.id][lg === "zh" ? 0 : 1];
    if (it.id === "tissue") return t("cat_general");
    if (it.id === "leftovers") return t("cat_food");
    return L(it.name);
  };
  // The same short name in the side-by-side language (undefined when that is off).
  const labelIn = (code, it) => SHORT[it.id] && (code === "zh" || code === "en") ? SHORT[it.id][code === "zh" ? 0 : 1]
    : it.id === "tissue" ? TH.tIn(code, "cat_general") : it.id === "leftovers" ? TH.tIn(code, "cat_food") : TH.LIn(code, it.name);
  TH.labelIn = labelIn;
  const labelPair = it => {
    const p = TH.pairLang(); if (!p) return undefined;
    const s = labelIn(p, it);
    return s && s !== label(it) ? s : undefined;
  };
  // My truck stop (time + address). Tapping it changes the time: pick a day, then your stop or one
  // nearby; the sheet's 「換別區的收運點」 changes the stop itself. Without a stop it sets one up.
  function truckStatus() {
    const box = h("button", { class: "truck-status", type: "button", onclick: () => {
      const pp = profile.get();
      if (!pp.community && pp.stopId && TH.pickTimeSheet) TH.pickTimeSheet(() => go("", { replace: true }));
      else changeStop();
    } });
    const p = profile.get();
    const draw = () => {
      const s = myStop();
      if (p.community) { fill(box, h("span", { class: "ts-icon" }, icon("building-community", 20)), h("strong", { text: t("commBadge"), "data-pair": TH.pairT("commBadge") }), h("span", { class: "grow caption dark", text: `${p.district || ""} ${p.village || ""}` }), h("span", { class: "ts-change", text: t("wChange") })); return; }
      if (!s) { fill(box, h("span", { class: "grow", text: t("truckNone") }), h("span", { class: "ts-change", text: t("wChange") + " ›" })); return; }
      const v = TH.chosenVisit ? TH.chosenVisit(s) : TH.visitsOf(s)[0]; // the time picked on this card, else the next one
      const mins = v ? Math.round((v.arriveMs - Date.now()) / 60000) : null;
      const lp = TH.leave && v ? TH.leave.plan(s, v) : null;
      const left = lp && lp.state ? lp.text
        : mins == null ? "" : mins <= 5 ? t("truckNow") : mins < 60 ? t("truckLeftM", { m: mins }) : mins < 24 * 60 ? t("truckLeft", { h: Math.floor(mins / 60), m: mins % 60 }) : "";
      fill(box, h("span", { class: "ts-icon", "aria-hidden": "true" }, icon("truck", 20)),
        h("span", { class: "grow" }, h("strong", { text: v ? t("truckToday", { when: whenWord(v), time: hhmm(v.arriveMs) }) : "—" }), h("span", { class: "caption dark", text: " " + shortAddr(s) })),
        left ? h("span", { class: "ts-left" + ((lp && ["soon", "now", "due"].includes(lp.state)) || mins <= 30 ? " soon" : ""), text: left }) : null,
        h("span", { class: "ts-change", text: t("wChange") + " ›" }));
    };
    Promise.all([TH.loadStops()]).then(draw).catch(() => {});
    const timer = setInterval(() => { if (document.body.contains(box)) draw(); else clearInterval(timer); }, 30000);
    TH.onNavigate(() => clearInterval(timer));
    return box;
  }
  // What goes out today where you live. With a truck stop set, it follows that stop: its own days
  // (some stops only come Mon/Thu), holiday stops, and whether today's truck has already gone;
  // on a day off it shows the stop's next visit. Without a stop, the city-wide days.
  // Tapping opens the collection-days page; the time is changed from the truck row below.
  function todayCard(now) {
    const g = TH.rules().groups;
    const LABEL = { general: "chipGeneral", food: "chipFood", flat: "chipFlat", rigid: "chipRigid" };
    const takes = day => Object.keys(LABEL).filter(id => g[id].days.includes(day));
    const chips = ids => h("span", { class: "tc-chips" }, ids.map(id => h("span", { class: "tc-chip tc-" + id, text: t(LABEL[id]) })));
    const box = h("button", { class: "home-today", type: "button", onclick: () => go("when/general") });
    const fillVars = (s, vars) => s && vars ? s.replace(/\{(\w+)\}/g, (m, k) => (k in vars ? vars[k] : m)) : s;
    const show = (key, vars, todayIds, nextWord, nextIds) => {
      box.classList.toggle("off", !todayIds);
      fill(box, h("span", { class: "hs-icon", "aria-hidden": "true" }, icon("truck", 26)),
        h("span", { class: "grow" },
          h("strong", { text: t(key, vars), "data-pair": fillVars(TH.pairT(key), vars) }),
          todayIds ? chips(todayIds) : h("span", { class: "tc-next" }, nextWord ? h("span", { text: nextWord }) : null, nextIds ? chips(nextIds) : null)),
        icon("chev", 20));
    };
    const cityWide = () => {
      const today = takes(now.day);
      if (today.length) show("todayOn", null, today);
      else show("todayOff", null, null, t("tomorrowAt", { t: "" }).trim(), takes((now.day + 1) % 7));
    };
    const draw = () => {
      const p = profile.get();
      const s = !p.community && p.stopId ? myStop() : null;
      if (!s) { cityWide(); return; }
      const next = TH.visitsOf(s)[0];
      if (next && SCH.comesToday(next)) { show("todayAtStop", { time: hhmm(next.arriveMs) }, takes(next.day)); return; }
      // Was there a visit today that has already left? (look from the start of today)
      const fromMidnight = TH.visitsOf(s, { now: SCH.instant(SCH.taipeiParts(Date.now()), 0) })[0];
      const gone = fromMidnight && SCH.comesToday(fromMidnight) && fromMidnight.leaveMs < Date.now();
      const word = next ? whenWord(next) : null;
      show(gone ? "todayDone" : "todayOff", null, null, word && word[0].toUpperCase() + word.slice(1), next ? takes(next.day) : null);
    };
    cityWide();
    if (!profile.get().community && profile.get().stopId) TH.loadStops().then(draw).catch(() => {});
    return box;
  }

  // Where the truck setup returns: the page that sent people there (changeStop, or the pick list
  // for a first-timer), else the steps if things are picked, else home.
  let setupReturn = null;
  const afterSetup = () => { const to = setupReturn; setupReturn = null; return to != null ? to : (picks.get().some(id => TH.itemById(id)) ? "plan" : ""); };
  // "Change my stop" from anywhere (home truck row, the time sheet, the plan, the when page): pick
  // the place and stop, then straight back to that page.
  const changeStop = back => { setupReturn = back != null ? back : location.hash.replace(/^#\/?/, ""); go("welcome/1"); };
  TH.changeStop = changeStop;

  // Home, after the TownPass winners' pattern (2024 即時雨晴, 2024 ParkFlow, 2025 RideFlow): the
  // first screen is the tool itself — one big camera button and one line about today. Typing,
  // voice and everything else are one tap further; the truck time and reminder come with the answer.
  function viewHome() {
    const now = SCH.taipeiParts(Date.now());
    TH.setHeader(null);
    TH.onScanPick = null;
    return [
      h("header", { class: "focus-top" },
        h("div", { class: "head-actions" }, TH.views.kidsButton(), TH.views.langButton())),
      h("h1", { class: "focus-q", text: t("hQuestion"), "data-pair": TH.pairT("hQuestion") }),
      // The city's truck days mean nothing to people whose building collects the trash: they get
      // only the one-line "building collects" badge (tap to change), no truck timetable.
      profile.get().community ? null : todayCard(now),
      truckStatus(),
      h("button", { class: "focus-snap", type: "button", onclick: () => go("scan") },
        h("span", { class: "fs-ring", "aria-hidden": "true" }, icon("camera", 64)),
        h("strong", { text: t("taskScanTitle"), "data-pair": TH.pairT("taskScanTitle") }),
        h("span", { text: t("taskScanDesc") })),
      planRow(),
      h("div", { class: "focus-alt" },
        h("button", { class: "focus-link", type: "button", onclick: () => go("sort") }, icon("search", 20), h("span", { text: t("hSearch") })),
        h("button", { class: "focus-link", type: "button", onclick: () => TH.assistant && TH.assistant.open() }, icon("microphone", 20), h("span", { text: t("vaTitle") }))),
    ];
  }
  // The second main path: tick what you have, then see how to throw each out. It always opens the
  // list first, so what is picked can be checked and changed before the steps.
  function planRow() {
    const n = picks.get().filter(id => TH.itemById(id)).length;
    return h("button", { class: "focus-plan" + (n ? " has" : ""), type: "button", onclick: () => go("list") },
      h("span", { class: "hs-icon", "aria-hidden": "true" }, icon("list", 24)),
      h("span", { class: "grow" }, h("strong", { text: t("hPickRow"), "data-pair": TH.pairT("hPickRow") }),
        h("span", { class: "caption dark", text: n ? t("hSelected", { n }) : t("taskSortDesc") })),
      icon("chev", 20));
  }
  // No "More" menu: the map, garbage bags, talk card and reminders each show up at the step
  // that needs them (the answer card and the step plan), like the winners' cards that appear
  // one step at a time.

  // The checklist "what are you throwing out today" (pick several, get one plan): the old home.
  function viewList() {
    const p = profile.get();
    if (!p.setupDone) { setupReturn = "list"; setTimeout(() => go("welcome/0", { replace: true }), 0); return h("div"); }
    TH.setHeader(null);
    const rules = TH.rules();
    const now = SCH.taipeiParts(Date.now());
    const sel = new Set(picks.get().filter(id => TH.itemById(id)));
    const bar = h("div", { class: "pick-bar" });
    const heads = []; // collapsible group headers refresh their "n picked" when the selection changes
    // The bar only shows once something is picked.
    const drawBar = () => heads.forEach(f => f()) || (bar.hidden = !sel.size) || fill(bar,
      h("span", { class: "pick-count", text: t("hSelected", { n: sel.size }) }),
      sel.size ? h("button", { class: "clear-picks", type: "button", onclick: () => { sel.clear(); picks.set([]); document.querySelectorAll(".pick-chip.on").forEach(b => { b.classList.remove("on"); b.setAttribute("aria-pressed", "false"); }); drawBar(); } }, icon("x", 16), t("clearPicks")) : null,
      h("button", { class: "btn btn-primary", type: "button", disabled: !sel.size, onclick: () => { picks.set([...sel]); LS.set("th.lastPicks", [...sel]); go("plan"); } }, t("hSeeHow"), icon("chev", 18)));
    const chip = it => {
      const b = h("button", { class: "pick-chip" + (sel.has(it.id) ? " on" : ""), type: "button", "aria-pressed": String(sel.has(it.id)) },
        TH.art(it, 44), h("span", { class: "pc-name", text: label(it), "data-pair": labelPair(it) }), h("span", { class: "pc-check", "aria-hidden": "true" }, icon("check", 12)));
      b.addEventListener("click", () => {
        sel.has(it.id) ? sel.delete(it.id) : sel.add(it.id);
        b.classList.toggle("on", sel.has(it.id)); b.setAttribute("aria-pressed", String(sel.has(it.id)));
        picks.set([...sel]); drawBar();
      });
      return b;
    };
    const extra = h("div", { class: "pick-grid3" });
    const search = h("input", { type: "search", placeholder: t("hSearch"), "aria-label": t("hSearch"), enterkeyhint: "search" });
    const listed = new Set(GROUPS.flatMap(g => g[1]));
    search.addEventListener("input", () => {
      const q = search.value.trim();
      fill(extra, q ? rules.items.filter(i => TH.matches(i, q)).slice(0, 12).map(chip) : [...sel].filter(id => !listed.has(id)).map(TH.itemById).filter(Boolean).map(chip));
    });
    search.dispatchEvent(new Event("input"));
    TH.onScanPick = id => { sel.add(id); picks.set([...sel]); TH.onScanPick = null; go("list", { replace: true }); };
    const last = LS.get("th.lastPicks", []).filter(id => TH.itemById(id));
    drawBar();
    return [
      h("header", { class: "home-head" },
        h("div", {}, h("div", { class: "home-date", text: `${t("hello" + (now.minutes >= 5 * 60 && now.minutes < 11 * 60 ? 0 : now.minutes >= 11 * 60 && now.minutes < 17 * 60 ? 1 : 2))} · ${TH.lang() === "zh" ? `${now.m}月${now.d}日 週${t("days")[now.day]}` : `${t("days")[now.day]} ${now.m}/${now.d}`}` }),
          h("h1", { class: "home-day", text: t("hQuestion"), "data-pair": TH.pairT("hQuestion") })),
        h("div", { class: "head-actions" }, TH.views.kidsButton(), TH.views.langButton())),
      truckStatus(),
      last.length && !sel.size ? h("button", { class: "last-row", type: "button", onclick: () => { last.forEach(id => sel.add(id)); picks.set([...sel]); go("plan"); } },
        h("span", { class: "grow last-arts" }, h("span", { text: t("hLast") }), last.slice(0, 5).map(id => TH.art(TH.itemById(id), 24))), h("strong", { text: t("hAgain") + " ›" })) : null,
      // This page is the list itself: search and the groups are open, nothing to unfold first.
      h("section", { class: "pick-group" },
        // Snapping a photo is the big camera button in the tab bar; here only the search.
        h("div", { class: "search-row" }, h("label", { class: "search v3 grow" }, icon("search", 18), search)),
        extra),
      // Each group folds to one line (title, how many picked, their little pictures); remembered per group.
      GROUPS.map(([k, ids], gi) => {
        const items = ids.map(TH.itemById).filter(Boolean);
        const folds = LS.get("th.homeFold", {});
        let open = k in folds ? !folds[k] : gi === 0;
        const grid = h("div", { class: "pick-grid3", id: "pg-" + k, hidden: !open });
        const info = h("span", { class: "pg-info" });
        const head = h("button", { class: "pg-head", type: "button", "aria-expanded": String(open), "aria-controls": "pg-" + k },
          h("span", { class: "pg-title", text: t(k) }), info, h("span", { class: "pg-chev" }, icon("chevron-down", 20)));
        const drawInfo = () => {
          const on = items.filter(i => sel.has(i.id));
          fill(info, on.length ? [h("span", { class: "pg-count", text: t("hSelected", { n: on.length }) }), open ? null : h("span", { class: "pg-arts" }, on.slice(0, 4).map(i => TH.art(i, 22)))] : null);
        };
        head.addEventListener("click", () => {
          open = !open; grid.hidden = !open; head.setAttribute("aria-expanded", String(open));
          const f = LS.get("th.homeFold", {}); f[k] = !open; LS.set("th.homeFold", f); drawInfo();
        });
        heads.push(drawInfo); drawInfo();
        grid.append(...items.map(chip));
        return h("section", { class: "pick-group fold" }, head, grid);
      }),
      // The other tools (talk card, bags, saved stops) are in the home screen's "More" sheet.
      bar,
    ];
  }

  // ------------------------------------------------------------ plan: one page of steps
  // Steps are read, not ticked. Each row: [what to do] [round buttons on the right]. Round
  // buttons follow the TownPass kit: solid primary circle for the main action (call, Google
  // Maps), light circle for secondary ones, and a grey ▾ that pulls the details out under the
  // row. Tapping a step's title folds it to one line.
  function viewPlan() {
    TH.setHeader(t("pTitle"));
    const rules = TH.rules();
    const items = picks.get().map(TH.itemById).filter(Boolean);
    if (!items.length) { setTimeout(() => go("", { replace: true }), 0); return h("div"); }
    const p = profile.get();
    const cats = new Set(items.map(catOf));
    const has = c => cats.has(c);
    const isOut = i => ["bulky", "verify"].includes(catOf(i));
    const elsewhere = i => isOut(i) || i.takeback || ["clothes", "pills"].includes(i.id);
    const special = items.filter(i => elsewhere(i) || i.id === "spray");
    const truckItems = items.filter(i => !elsewhere(i));
    const squad = p.district && rules.contacts.squads[p.district];
    const REDUCED = () => window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    let stepCount = 0;

    // Round icon button. kind: "primary" (solid), "soft" (light), "fold" (grey ▾).
    const rbtn = (ic, labelText, fn, kind) => h("button", { class: "round-btn " + (kind || "soft"), type: "button", "aria-label": labelText, title: labelText,
      onclick: e => { e.preventDefault(); e.stopPropagation(); fn(e); } }, icon(ic, 20));
    // Labelled pill button (clear text + icon), the main way to act on a row.
    const lbtn = (ic, text, fn, primary) => h("button", { class: "mini-btn" + (primary ? " primary" : ""), type: "button",
      onclick: e => { e.preventDefault(); e.stopPropagation(); fn(e); } }, ic ? icon(ic, 14) : null, text);
    // ▾ button + the panel it pulls out (the panel spans the full row width).
    const fold = (...details) => {
      const panel = h("div", { class: "more-panel", hidden: true }, details);
      const b = rbtn("down", t("moreDetails"), () => { const open = panel.hidden; panel.hidden = !open; b.classList.toggle("open", open); b.setAttribute("aria-expanded", String(open)); }, "fold");
      b.setAttribute("aria-expanded", "false");
      return { b, panel };
    };
    // One row of a step. data-check names the row for the voice assistant's spotlight.
    const checkRow = (id, main, opts) => {
      const o = opts || {};
      const f = o.details ? fold(o.details) : null;
      const acts = (o.actions || []).filter(Boolean);
      const btns = (o.buttons || []).filter(Boolean);
      return h("div", { class: "check-row", "data-check": id },
        h("div", { class: "grow" }, main, o.sub || null, acts.length ? h("div", { class: "row-actions" }, acts) : null),
        btns.length || f ? h("div", { class: "row-btns" }, btns, f && f.b) : null,
        o.below ? h("div", { class: "row-below" }, o.below) : null,
        f && f.panel);
    };
    // A plain (not tickable) row with a ▾, e.g. "Missed it?".
    const foldRow = (ic, text, ...details) => {
      const f = fold(details);
      return h("div", { class: "fold-row" }, h("span", { class: "fr-icon" }, icon(ic, 18)), h("span", { class: "grow", text }), f.b, f.panel);
    };
    // A numbered step; its title folds and unfolds it (all open to start with).
    const step = (title, build, pairKey) => {
      const body = h("div", { class: "ps-body" }, build());
      const head = h("button", { class: "ps-head", type: "button", "aria-expanded": "true" }, h("span", { class: "ps-n", text: String(++stepCount) }), h("h2", { text: title, "data-pair": pairKey && TH.pairT(pairKey) }), h("span", { class: "ps-chev" }, icon("down", 18)));
      const sec = h("section", { class: "plan-step" }, head, body);
      let fin = 0;
      // Fold / unfold, sliding the body (skipped when the phone asks for less motion).
      head.addEventListener("click", () => {
        const folded = !sec.classList.contains("folded");
        sec.classList.toggle("folded", folded); head.setAttribute("aria-expanded", String(!folded));
        if (REDUCED() || !body.animate) { body.hidden = folded; return; }
        body.hidden = false;
        const frames = [{ height: body.scrollHeight + "px", opacity: 1 }, { height: "0px", opacity: 0 }];
        const a = body.animate(folded ? frames : frames.slice().reverse(), { duration: 280, easing: "cubic-bezier(.2,.8,.2,1)" });
        body.style.overflow = "hidden";
        // Finish on a timer too: animations stall while the page is not being drawn (app in background).
        const done = () => { clearTimeout(fin); a.cancel(); body.style.overflow = ""; body.hidden = sec.classList.contains("folded"); };
        a.onfinish = done; clearTimeout(fin); fin = setTimeout(done, 320);
      });
      return sec;
    };
    const dest = (artEl, text, strong, pair) => h("span", { class: "dest" }, artEl, h(strong ? "strong" : "span", { text, "data-pair": pair }));
    const out = [
      h("div", { class: "plan-items" }, items.map(i => h("span", { class: "plan-chip" }, TH.art(i, 24), label(i))),
        h("button", { class: "link-btn small", type: "button", onclick: () => go("list", { replace: true }), text: t("pEdit") })),
    ];

    // Nearest places of a layer (from me, or from my stop): the first under the row with 導航,
    // the next two plus a map link in the ▾ panel (`extra` is appended there).
    const placeLine = (pl, a) => h("div", { class: "np-row" },
      h("button", { class: "np-main", type: "button", onclick: e => { e.preventDefault(); TH.placeSheet(pl); } }, h("strong", { text: pl.name }), h("span", { class: "caption", text: TH.placeAway(a, pl) })),
      TH.needsNet(lbtn("direction-sign", t("seeOnMapNav"), () => TH.openMap(pl), true)));
    const fillNearest = (layer, below, more, ...extra) => {
      const mapBtn = () => lbtn("map", t("s4AllOnMap"), () => go("map/" + layer));
      Promise.all([TH.loadStops(), TH.loadPlaces()]).then(() => {
        const a = TH.placeAnchor(); const list = a ? TH.nearestPlaces(layer, a.pos, 3) : [];
        fill(below, list[0] ? placeLine(list[0], a) : h("div", { class: "row-actions" }, mapBtn()));
        fill(more, list.slice(1).map(pl => placeLine(pl, a)), h("div", { class: "row-actions" }, mapBtn()), extra);
      }).catch(() => fill(more, extra));
    };

    // 1. bags. Taipei charges for general trash by the bag: it must go in the official bag
    // (recycling and food waste go free). The nearest official bag shop is shown under the row.
    const bagBelow = h("div"), bagMore = h("div");
    const needsBag = items.filter(i => catOf(i) === "general" || (i.components || []).some(c => rules.groups[c.group].cat === "general"));
    if (has("general")) fillNearest("bags", bagBelow, bagMore,
      h("p", { class: "caption dark", text: t("s1GeneralSize"), "data-pair": TH.pairT("s1GeneralSize") }),
      h("p", { class: "caption dark", text: t("s1BagRule"), "data-pair": TH.pairT("s1BagRule") }),
      h("div", { class: "row-actions" }, lbtn("list", t("s1ShopList"), () => go("buy")), lbtn(null, t("s1Sizes"), () => go("bags"))));
    if (has("general") || has("recycle") || has("food") || has("special")) out.push(step(t("s1"), () => [
      has("general") ? checkRow("bag-general", dest(TH.catArt("general", 28), t("s1General"), true, TH.pairT("s1General")), {
        sub: needsBag.length ? h("div", { class: "row-sub bag-for" }, h("span", { text: t("s1For") }), needsBag.slice(0, 6).map(i => TH.art(i, 20))) : null,
        buttons: [rbtn("shopping-bag", t("s1BuyMap"), () => go("map/bags"))],
        below: bagBelow, details: bagMore }) : null,
      has("recycle") ? checkRow("bag-recycle", dest(TH.catArt("recycle", 28), t("s1Recycle"), false, TH.pairT("s1Recycle"))) : null,
      has("food") ? checkRow("bag-food", dest(TH.catArt("food", 28), t("s1Food"), false, TH.pairT("s1Food"))) : null,
      has("special") ? checkRow("bag-hazard", dest(TH.catArt("special", 28), t("s1Hazard"), false, TH.pairT("s1Hazard"))) : null,
    ], "s1"));

    // 2. prepare each item: one line per item; the steps, the warning, parts and the full page are under ▾
    const prep = items.filter(i => i.id !== "tissue" && !isOut(i) && ((i.steps || []).length || i.components));
    if (prep.length) out.push(step(t("s2"), () => prep.map(i => checkRow("prep-" + i.id,
      dest(TH.art(i, 28), label(i), true, labelPair(i)), {
        details: [(i.steps || []).length ? h("ol", { class: "strip" }, i.steps.map((st, k) => h("li", {}, h("span", { class: "strip-n", text: String(k + 1) }), h("span", { class: "strip-art" }, icon(st.icon, 24)), h("span", { text: L(st.title), "data-pair": TH.pairOf(st.title) })))) : null,
          i.warn ? h("div", { class: "warn-pill small" }, icon("alert", 14), h("span", { text: L(i.warn), "data-pair": TH.pairOf(i.warn) })) : null,
          i.components ? h("div", { class: "parts-chips" }, i.components.map(c => { const cc = rules.groups[c.group].cat; return h("span", { class: `part-chip pc-${cc}` }, icon((rules.categories[cc] || {}).icon || "help-circle", 14), L(c.name), h("span", { class: "pc-to", text: "→ " + t("cat_" + cc) })); })) : null,
          h("button", { class: "link-btn small", type: "button", onclick: e => { e.preventDefault(); go("item/" + i.id); }, text: t("fullGuide") + " ›" })] })), "s2"));

    // 3. take it out / hand it to the building
    if (truckItems.length) {
      if (p.community) {
        const COMM = [["general", "commGeneral"], ["food", "commFood"], ["recycle", "commFlat"], ["recycle", "commRigid"], ["special", "commBattery"]];
        out.push(step(t("s3Comm"), () => checkRow("drop-comm", dest(h("span", { class: "lr-icon" }, icon("building-community", 18)), t("s3CommText"), true, TH.pairT("s3CommText")), {
          details: h("div", { class: "parts-chips" }, COMM.map(([c, key]) => h("span", { class: `part-chip pc-${c}` }, icon((rules.categories[c] || {}).icon || "help-circle", 14), h("span", { text: t(key), "data-pair": TH.pairT(key) })))) }), "s3Comm"));
      } else out.push(step(t("s3Truck"), () => {
        const slot = h("div");
        const dests = [];
        if (truckItems.some(i => catOf(i) === "general")) dests.push(["general", t("s3General")]);
        if (truckItems.some(i => catOf(i) === "food" || (i.components || []).some(c => rules.groups[c.group].cat === "food"))) dests.push(["food", t("s3Food")]);
        if (truckItems.some(i => ["recycle", "special"].includes(catOf(i)))) dests.push(["recycle", t("s3Recycle")]);
        // One row: tick it once everything is handed over; the three places are small labelled tiles.
        const SLOT = { general: ["slotTruck", "truck"], food: ["slotFood", "bucket"], recycle: ["slotRecycle", "recycle"] };
        const rows = dests.length ? [checkRow("drop-0", h("span", { class: "dest" }, h("strong", { text: t("s3SlotsHint"), "data-pair": TH.pairT("s3SlotsHint") })), {
          below: h("div", { class: "go-slots" }, dests.map(([c]) => h("span", { class: `go-slot gs-${c}` }, TH.catArt(c, 32), h("span", { text: t(SLOT[c][0]), "data-pair": TH.pairT(SLOT[c][0]) })))) })] : [];
        const whenGroup = truckItems.some(i => catOf(i) === "general") ? "general" : truckItems.some(i => catOf(i) === "food") ? "food"
          : (truckItems.find(i => ["flat", "rigid"].includes(i.group)) || {}).group || "general";
        TH.loadStops().then(() => TH.loadDrops().catch(() => null)).then(() => {
          const s = myStop();
          if (!s) { fill(slot, h("p", { class: "caption dark", text: t("s3NoStop"), "data-pair": TH.pairT("s3NoStop") }), btn("btn-secondary wide", t("s3PickStop"), () => changeStop("plan"))); return; }
          const v = TH.chosenVisit ? TH.chosenVisit(s) : TH.visitsOf(s)[0];
          const timeEl = h("span", { class: "ts-left" });
          const tick = () => { if (!v) return; const m = Math.round((v.arriveMs - Date.now()) / 60000); timeEl.textContent = m <= 5 ? t("truckNow") : m < 60 ? t("truckLeftM", { m }) : m < 1440 ? t("truckLeft", { h: Math.floor(m / 60), m: m % 60 }) : ""; timeEl.classList.toggle("soon", m <= 30); timeEl.hidden = !timeEl.textContent; };
          tick();
          const timer = setInterval(() => document.body.contains(timeEl) ? tick() : clearInterval(timer), 30000);
          TH.onNavigate(() => clearInterval(timer));
          const dayKey = String(v ? SCH.taipeiParts(v.arriveMs).day : SCH.taipeiParts(Date.now()).day);
          const drop = TH.dropData() ? TH.dropData().points.filter(d => !d.confirm && (d.hours[dayKey] || []).length && d.accepts.includes("general"))
            .map(d => ({ d, dist: TH.haversine(s, d) })).sort((a, b) => a.dist - b.dist)[0] : null;
          const hrs = drop ? drop.d.hours[dayKey].map(([a, b]) => `${TH.fmtTime(a)}–${TH.fmtTime(b)}`).join(t("listSep")) : "";
          const bell = TH.bridge() ? lbtn("bell", t("s3Remind"), async ev => { const b = ev.currentTarget; b.disabled = true; try { await TH.loadFavs(true); await TH.setQuickReminders(s, true, 10); b.replaceChildren(icon("bell", 14), t("remindOn")); } catch (_) { b.disabled = false; } }) : null;
          // One card: time + place; tap it to pick another day / time (when.js), round button = directions.
          const pickTime = () => (TH.pickTimeSheet ? TH.pickTimeSheet(() => go("plan", { replace: true })) : go("when/" + whenGroup));
          fill(slot,
            h("div", { class: "go-card go-card2" },
              h("button", { class: "go-main", type: "button", onclick: pickTime },
                h("div", { class: "go-when" }, h("b", { text: v ? `${whenWord(v)} ${hhmm(v.arriveMs)}` : "—" }), timeEl),
                h("div", { class: "go-where" }, h("span", { text: shortAddr(s) })),
                h("span", { class: "go-change" }, icon("calendar", 14), t("s3Change"))),
              TH.needsNet(rbtn("direction-sign", t("seeOnMapNav"), () => TH.openMap(s), "primary"))),
            h("div", { class: "row-actions" }, bell, lbtn("message-circle", t("tcOpen"), () => go("talk/truck"))),
            drop ? h("button", { class: "link-btn small go-missed", type: "button", onclick: () => go("drop/" + drop.d.id),
              text: t("s3MissedLink", { name: drop.d.squad, hours: hrs }) }) : null);
        });
        return [slot, rows];
      }, "s3Truck"));
    }

    // 4. special items: one line + round call / map buttons; backups under ▾
    if (special.length) {
      // Nearest place: shown under the title; the round map button opens the layer; more under ▾.
      const placeRow = (i, txt, layer) => {
        const below = h("div");
        const more = h("div");
        const row = checkRow("sp-" + i.id, dest(TH.art(i, 28), label(i), true, labelPair(i)), { sub: destLine(txt), below, details: more,
          buttons: [rbtn("map", t("s4AllOnMap"), () => go("map/" + layer), "primary")] });
        // Talk card for the shop counter sits in the ▾ panel, so the row keeps room for its text.
        fillNearest(layer, below, more, layer === "battery" ? h("div", { class: "row-actions" }, lbtn("message-circle", t("tcOpenStore"), () => go("talk/store"))) : null);
        return row;
      };
      const destLine = key => h("span", { class: "row-dest", text: t(key), "data-pair": TH.pairT(key) });
      out.push(step(t("s4"), () => special.map(i => {
        const c = catOf(i);
        const title = () => dest(TH.art(i, 28), label(i), true, labelPair(i));
        if (c === "bulky") return checkRow("sp-" + i.id, title(), { sub: destLine("spBulky"),
          buttons: [rbtn("phone", squad ? t("sBulkyCall", { district: p.district }) : "1999", () => TH.dial(squad || rules.contacts.hotline), "primary")],
          details: [h("p", { class: "caption dark", text: t("sBulkyPut"), "data-pair": TH.pairT("sBulkyPut") }),
            h("div", { class: "row-actions" }, lbtn("message-circle", t("tcScript"), () => go("talk/phone"), true), lbtn("phone", "1999", () => TH.dial(rules.contacts.hotline)), lbtn(null, t("bookOnline"), () => TH.openExternal(rules.contacts.online)))] });
        if (c === "verify") return checkRow("sp-" + i.id, title(), { sub: destLine("spAsk"), buttons: [rbtn("phone", t("spCall"), () => TH.dial(squad || rules.contacts.hotline), "primary")] });
        if (i.takeback) return placeRow(i, "spTake", "battery");
        if (i.id === "clothes") return placeRow(i, "spClothes", "clothes");
        if (i.id === "pills") return placeRow(i, "spPills", "pills");
        if (i.id === "spray") return checkRow("sp-" + i.id, title(), { sub: destLine("spSpray") });
        return null;
      }).filter(Boolean), "s4"));
    }
    return out;
  }

  Object.assign(TH.views, { viewHome, viewList });
  TH.routes = Object.assign(TH.routes || {}, { list: () => viewList() });
  TH.routes = Object.assign(TH.routes || {}, { welcome: viewWelcome, plan: viewPlan });
})();
