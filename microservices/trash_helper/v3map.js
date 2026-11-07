// SPDX-License-Identifier: AGPL-3.0-or-later
// Trash Helper v3: full-screen map ("附近") and saved stops ("常用丟點").
"use strict";

(function () {
  const TH = window.TH;
  const { h, t, go, fill, btn, SCH } = TH;
  const icon = (...a) => TH.icon(...a);
  const pad2 = n => String(n).padStart(2, "0");
  const hhmm = ms => { const p = SCH.taipeiParts(ms); return `${pad2(Math.floor(p.minutes / 60))}:${pad2(p.minutes % 60)}`; };
  const shortAddr = s => s.address.replace(/^臺北市/, "").replace(s.district, "").replace(/[（(].*?[)）]/g, "");
  const walkMin = (a, b) => Math.max(1, Math.round(TH.haversine(a, b) / 75));
  const RIGID = [2, 4, 6];
  // "19:30" today, "週一 19:30" / "Mon 19:30" otherwise.
  const compactWhen = v => SCH.comesToday(v) ? hhmm(v.arriveMs) : `${t("dayShort", { d: t("days")[SCH.taipeiParts(v.arriveMs).day] })} ${hhmm(v.arriveMs)}`;

  // Strings used only by the route lines and the no-collection-day fallback.
  const LOCAL = {
    en: { trucks: "Trucks", takesToday: "Today", takesNext: "No pickup today · {day}", tFlat: "Recycling, flat", tRigid: "Recycling, 3-D", tHazard: "Batteries, bulbs", offToday: "No pickup today · {day}", routeNote: "Numbered dots show this truck's stops in timetable order. The city data has no street path or live position.", routeName: "Route {route} · {trip}",
      routeTitle: "This truck · {n} stops", routeDay: "", routeNow: "Now near stop {n}", routeBefore: "Starts {time}", routeDone: "Done for today", routeHere: "you", routeEstimate: "",
      foot: "Scheduled times, not live", today: "Today", details: "More" },
    zh: { trucks: "垃圾車", takesToday: "今天收", takesNext: "今天停收・{day}收", tFlat: "回收・平面類", tRigid: "回收・立體類", tHazard: "電池・燈管", offToday: "今天停收・看{day}", routeNote: "編號圓點是這台車依班表的停靠順序。市府資料沒有行駛路徑和即時位置。", routeName: "路線 {route}・{trip}",
      routeTitle: "這台車停 {n} 站", routeDay: "", routeNow: "現在約在第 {n} 站", routeBefore: "{time} 開始收", routeDone: "今天已收完", routeHere: "這裡", routeEstimate: "",
      foot: "預定時間，非即時位置", today: "今天", details: "更多" },
  };
  const tl = (k, vars) => {
    let s = (LOCAL[TH.lang()] || LOCAL.en)[k] || LOCAL.en[k];
    for (const [a, b] of Object.entries(vars || {})) s = s.split(`{${a}}`).join(b);
    return s;
  };

  // Small time labels next to the selected trip's stops (Leaflet's default tooltip is too big here).
  if (!document.getElementById("route-time-css")) {
    const st = document.createElement("style");
    st.id = "route-time-css";
    st.textContent = ".leaflet-tooltip.route-time{padding:0 4px;font-size:11px;font-weight:700;line-height:16px;color:#9A4A1E;background:#fff;border:1px solid #F3C9B2;border-radius:6px;box-shadow:none}.leaflet-tooltip.route-time:before{display:none}";
    document.head.append(st);
  }

  // Route lines: the official data has no geometry, but every stop has 路線 + 車次 and a scheduled
  // arrival, so joining one trip's stops in arrival order traces where that truck goes.
  const routeKey = s => `${s.district}|${s.route}|${s.trip}`;
  let routeIndex = null, routeIndexFor = null;
  function routes() {
    const data = TH.stopsData();
    if (!data) return new Map();
    if (routeIndexFor !== data) {
      routeIndex = new Map();
      for (const s of data.stops) {
        const k = routeKey(s);
        if (!routeIndex.has(k)) routeIndex.set(k, []);
        routeIndex.get(k).push(s);
      }
      for (const list of routeIndex.values()) list.sort((a, b) => a.arrive - b.arrive);
      routeIndexFor = data;
    }
    return routeIndex;
  }
  TH.routeOf = s => routes().get(routeKey(s)) || [s];

  // Timetable of the whole trip, for the day of this stop's next visit: which stops are done,
  // and (only on that day, while the trip runs) roughly where the truck should be now.
  function routeTimeline(s, v) {
    const list = TH.routeOf(s);
    if (list.length < 2) return null;
    const now = Date.now();
    const base = v ? v.arriveMs - s.arrive * 60000 : null; // Taipei midnight of the service day
    const at = m => base != null ? base + m * 60000 : null;
    let current = null, status = "";
    if (base != null && SCH.comesToday(v)) {
      const start = at(list[0].arrive), end = at(list[list.length - 1].leave);
      if (now < start) status = tl("routeBefore", { time: TH.fmtTime(list[0].arrive) });
      else if (now > end) status = tl("routeDone");
      else {
        current = [...list].reverse().find(x => at(x.arrive) <= now) || list[0];
        status = tl("routeNow", { n: list.indexOf(current) + 1 });
      }
    }
    const rows = list.map((x, i) => {
      const passed = base != null && at(x.leave) < now;
      const me = x.id === s.id, here = current && x.id === current.id;
      return h("li", { style: `display:flex;gap:10px;align-items:center;padding:5px 0;${passed ? "opacity:.45;" : ""}${me ? "font-weight:700;" : ""}` },
        h("span", { "aria-hidden": "true", style: `flex:none;width:20px;height:20px;border-radius:10px;display:grid;place-items:center;font:700 11px/1 system-ui;color:#fff;background:${me || here ? "#E6692C" : "#F0A57D"}`, text: String(i + 1) }),
        h("b", { style: "flex:none;width:44px;font-variant-numeric:tabular-nums", text: TH.fmtTime(x.arrive) }),
        h("span", { style: "flex:1;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap", text: shortAddr(x) }),
        here ? h("span", { "aria-hidden": "true" }, icon("truck", 16)) : me ? h("span", { class: "caption", text: tl("routeHere") }) : null);
    });
    // Folded by default: one line says how many stops (and where the truck is now, by the timetable).
    return h("details", { class: "route-timeline", style: "margin-top:10px;border-top:1px solid var(--gray-100,#E3E7E9);padding-top:8px" },
      h("summary", { style: "cursor:pointer;display:flex;gap:8px;align-items:center;min-height:40px;font-weight:600" },
        icon("truck", 18), h("span", { style: "flex:1", text: tl("routeTitle", { n: list.length }) }),
        status ? h("span", { class: "caption", style: "color:#9A4A1E", text: status }) : null),
      h("ol", { style: "list-style:none;margin:4px 0 0;padding:0" }, rows));
  }

  // ------------------------------------------------------------ stop sheet (shared by map and lists)
  function stopSheet(s) {
    const v = TH.visitsOf(s)[0];
    const pos = TH.lastPosition();
    const vday = v ? v.day : null;
    const chips = [
      h("span", { class: "pill pill-general" }, icon("trash", 14), t("chipGeneral")),
      s.note && s.note.noFood ? null : h("span", { class: "pill pill-food" }, icon("leaf", 14), t("chipFood")),
      h("span", { class: "pill pill-recycle" }, icon("up", 14), `${t("f_recycle")}・${vday != null && RIGID.includes(vday) ? t("chipRigid") : t("chipFlat")}`),
    ];
    const saved = TH.isFav(s.id);
    const star = h("button", { class: "square-btn star-btn" + (saved ? " on" : ""), type: "button", "aria-pressed": String(saved), "aria-label": t("save") }, icon("star", 20, saved ? "filled" : null));
    star.addEventListener("click", async () => {
      star.disabled = true;
      try { await TH.favOp(TH.isFav(s.id) ? "remove" : "save", { stopId: s.id }); } catch (_) { /* keep */ }
      const on = TH.isFav(s.id);
      star.classList.toggle("on", on); star.setAttribute("aria-pressed", String(on));
      star.replaceChildren(icon("star", 20, on ? "filled" : null));
      star.disabled = false;
    });
    // Big arrival time, then when to walk out; everything else is one tap away.
    const dayWord = v ? (SCH.comesToday(v) ? tl("today") : TH.fmtWhen(v.arriveMs).replace(/\s*\d{1,2}:\d{2}$/, "")) : "";
    TH.sheet(shortAddr(s),
      h("div", { style: "display:flex;align-items:center;gap:12px;margin:2px 0 10px" },
        h("div", { style: "flex:1;min-width:0" },
          dayWord ? h("div", { class: "caption", text: dayWord }) : null,
          h("div", { style: "font-size:2rem;font-weight:700;line-height:1.1;color:#356C77;font-variant-numeric:tabular-nums", text: TH.fmtTime(s.arrive) })),
        TH.leave ? TH.leave.pill(s, v) : null),
      h("div", { class: "pill-row" }, chips),
      s.note && s.note.noFood ? TH.notice(t("stopNoFood"), "notice-warn") : null,
      s.note && s.note.confirm ? TH.notice(t("stopConfirm"), "notice-warn") : null,
      h("div", { class: "sheet-actions" },
        btn("btn-primary grow", t("navigate"), () => TH.openMap(s)),
        h("button", { class: "square-btn", type: "button", "aria-label": t("remind"), onclick: () => go("remind/" + s.id) }, icon("bell", 20)),
        star),
      routeTimeline(s, v),
      h("button", { class: "link-row", type: "button", style: "margin-top:4px", onclick: () => go("stop/" + s.id) },
        h("span", { class: "caption", style: "flex:1;text-align:left", text: `${tl("foot")}・${s.route} ${s.trip}` }), h("span", { class: "caption", text: tl("details") }), icon("chev", 16)));
  }
  TH.stopSheet = stopSheet;

  // ------------------------------------------------------------ special-item places
  const LAYERS = {
    clothes: { icon: "shirt", label: "layerClothes", chip: "chipClothes", note: "placeClothesNote" },
    battery: { icon: "battery-2", label: "layerBattery", chip: "chipBattery", note: "placeBatteryNote" },
    pills: { icon: "pill", label: "layerPills", chip: "chipPills", note: "placePillsNote" },
    bags: { icon: "shopping-bag", label: "layerBags", chip: "chipBags", note: "placeBagsNote" },
  };
  const isPlaceLayer = k => !!LAYERS[k];
  const fmtDist = m => m < 1000 ? `${Math.round(m / 10) * 10} m` : `${(m / 1000).toFixed(1)} km`;
  // Where distances are measured from: live position, else the stop chosen during setup.
  function anchor() {
    const pos = TH.lastPosition(); if (pos) return { pos, live: true };
    const id = TH.profile && TH.profile.get().stopId;
    const s = id && TH.stopsData() ? TH.stopsData().byId.get(id) : null;
    return s ? { pos: { lat: s.lat, lng: s.lng }, live: false } : null;
  }
  const awayText = (a, p) => a.live ? t("walk", { n: walkMin(a.pos, p) }) : t("placeAway", { d: fmtDist(TH.haversine(a.pos, p)) });
  function nearestPlaces(layer, from, n) {
    const pd = TH.placesData(); if (!pd || !from) return [];
    return pd[layer].map(p => ({ p, d: TH.haversine(from, p) })).sort((a, b) => a.d - b.d).slice(0, n).map(x => x.p);
  }
  function placeSheet(p) {
    const L = LAYERS[p.layer], a = anchor(), src = (TH.placesData().sources || {})[p.layer];
    const sub = p.layer === "pills" ? t(p.hospital ? "placeHospital" : "placePharmacy") : p.layer === "clothes" ? `${t("placeOrg")} ${p.org}` : null;
    TH.sheet(p.name,
      h("div", { class: "place-head" }, h("span", { class: `place-art place-${p.layer}` }, icon(L.icon, 24)),
        h("span", { class: "grow" }, h("strong", { text: t(L.label) }), sub ? h("span", { class: "caption dark", text: sub }) : null),
        a ? h("span", { class: "caption dark", text: awayText(a, p) }) : null),
      p.address ? h("p", { class: "place-addr" }, icon("map-pin", 16), h("span", { text: p.address.replace(/^臺北市/, "") })) : null,
      h("p", { class: "caption dark", text: t(L.note) }),
      p.approx ? h("p", { class: "caption", text: t("placeApprox") }) : null,
      h("div", { class: "sheet-actions" },
        btn("btn-primary grow", t("navGoogle"), () => TH.openMap(p)),
        p.phone ? h("button", { class: "square-btn", type: "button", "aria-label": p.phone, onclick: () => TH.dial(p.phone.replace(/\s*#.*/, "")) }, icon("phone", 20)) : null),
      src ? h("p", { class: "caption", text: `${t("placeSource")}${t("colon")}${src.name}（${src.publisher}）` }) : null);
  }
  TH.placeSheet = placeSheet;
  TH.nearestPlaces = nearestPlaces;
  TH.placeAnchor = anchor;
  TH.placeAway = awayText;

  // ------------------------------------------------------------ map
  let leafletMap = null;
  TH.dropMap = () => { if (leafletMap) { leafletMap.remove(); leafletMap = null; } };
  function viewMap(catParam) {
    TH.setHeader(null);
    const ms = TH.mapState;
    // Garbage truck, recycling truck and food bucket stop at the same place and time (only 1 of 4,012 stops
    // takes no food), so there is one stops layer; map/general|recycle|food all open it.
    if (catParam && Object.keys(LAYERS).includes(catParam)) ms.cat = catParam;
    else if (catParam || !isPlaceLayer(ms.cat)) ms.cat = "all";
    const mapEl = h("div", { class: "map-full", role: "application", "aria-label": t("mapTitle") });
    const bottom = h("div", { class: "map-bottom" });
    let failed = false, layerStops = null, layerDrops = null, layerMe = null, layerRoutes = null, shown = [], places = [];
    const today = SCH.taipeiParts(Date.now()).day;

    const chipBtn = (label, on, fn, extra) => h("button", { class: "map-chip" + (on ? " on" : ""), type: "button", "aria-pressed": String(on), onclick: fn }, label, extra || null);
    const chipsEl = h("div", { class: "map-chips" });
    // Place pins only show from zoom 14, so switching to a place layer brings the map to me (or my stop).
    const focusPlaces = () => {
      if (!leafletMap || !isPlaceLayer(ms.cat) || leafletMap.getZoom() >= 14) return false;
      const a = anchor();
      leafletMap.setView(a ? [a.pos.lat, a.pos.lng] : leafletMap.getCenter(), 15);
      return true;
    };
    // Scroll only the chip row so the chosen layer is visible (scrollIntoView would also move the map).
    const centerChip = () => {
      const on = chipsEl.querySelector(".place-chip.on"); if (!on) return;
      chipsEl.scrollLeft = Math.max(0, on.offsetLeft - (chipsEl.clientWidth - on.offsetWidth) / 2);
    };
    const pick = k => {
      ms.cat = k; ms.selected = null; drawChips();
      if (!focusPlaces()) refresh();
      centerChip();
    };
    const dayName = d => TH.lang() === "zh" ? "週" + t("days")[d] : t("days")[d];
    // On a day with no pickup (Wed/Sun, or every truck has already left) "today" falls back
    // to the next collection day instead of showing an empty map; the chip says so.
    let shownDay = null;
    const whenLabel = () => ms.when !== "today" ? t("mapAny")
      : shownDay != null && shownDay !== today ? tl("offToday", { day: dayName(shownDay) })
      : t("mapToday", { day: dayName(today) });
    const drawChips = () => fill(chipsEl,
      isPlaceLayer(ms.cat) ? null : chipBtn(whenLabel(), true,
        () => { ms.when = ms.when === "today" ? "any" : "today"; drawChips(); refresh(); }, icon("down", 14)),
      isPlaceLayer(ms.cat) ? chipBtn([icon("truck", 16), " ", tl("trucks")], false, () => pick("all")) : null,
      h("span", { class: "chip-sep", "aria-hidden": "true" }),
      Object.entries(LAYERS).map(([k, L]) => h("button", { class: `map-chip place-chip place-${k}` + (ms.cat === k ? " on" : ""), type: "button", "aria-pressed": String(ms.cat === k), onclick: () => pick(ms.cat === k ? "all" : k) },
        icon(L.icon, 16), t(L.chip))),
      drawToday());
    // 「今天收什麼」: what the trucks take on the day the map shows (today, or the next collection day).
    const todayEl = h("div", { class: "map-today", "aria-live": "polite" });
    const TAKES = { general: ["trash", "chipGeneral", "general"], food: ["leaf", "chipFood", "food"], flat: ["recycle", "tFlat", "recycle"], rigid: ["recycle", "tRigid", "recycle"], hazard: ["battery-2", "tHazard", "special"] };
    function drawToday() {
      if (!todayEl) return null;
      if (isPlaceLayer(ms.cat) || ms.when !== "today") { todayEl.hidden = true; return null; }
      const general = (TH.stopsData() && TH.stopsData().generalDays) || TH.rules().groups.general.days;
      // The day the stops on the map are for; with none shown (zoomed out) or on a no-pickup day, the next collection day.
      let day = shownDay != null && general.includes(shownDay) ? shownDay : null;
      for (let i = 0; i < 7 && day == null; i++) if (general.includes((today + i) % 7)) day = (today + i) % 7;
      const groups = TH.collectsOn ? TH.collectsOn(day) : [];
      todayEl.hidden = false;
      fill(todayEl,
        h("b", { text: day === today ? tl("takesToday") : tl("takesNext", { day: dayName(day) }) }),
        h("span", { class: "mt-pills" }, groups.map(g => TAKES[g] ? h("span", { class: "mt-pill mt-" + TAKES[g][2] }, icon(TAKES[g][0], 14), TAKES[g][1].startsWith("chip") ? t(TAKES[g][1]) : tl(TAKES[g][1])) : null)));
      return null;
    }
    if (!ms.when || ms.when === "any") ms.when = ms.when || "today";
    drawChips();

    function placeCandidates() {
      const pd = TH.placesData(); if (!pd || !isPlaceLayer(ms.cat)) return [];
      const pos = TH.lastPosition();
      if (pos && ms.mode === "near") return pd[ms.cat].map(p => ({ p, d: TH.haversine(pos, p) })).filter(x => x.d < 3000).sort((a, b) => a.d - b.d).slice(0, 40);
      if (!leafletMap || leafletMap.getZoom() < 14) return [];
      const b = leafletMap.getBounds(), c = leafletMap.getCenter();
      return pd[ms.cat].filter(p => b.contains([p.lat, p.lng])).map(p => ({ p, d: TH.haversine({ lat: c.lat, lng: c.lng }, p) })).sort((a, b2) => a.d - b2.d).slice(0, 40);
    }
    function candidates() {
      const data = TH.stopsData(); if (!data || isPlaceLayer(ms.cat)) return [];
      const pos = TH.lastPosition();
      let base = [];
      if (ms.area) base = data.stops.filter(s => s.district === ms.area.d && (!ms.area.v || s.village === ms.area.v)).map(s => ({ s }));
      else if (pos && ms.mode === "near") base = data.stops.map(s => ({ s, d: TH.haversine(pos, s) })).filter(x => x.d < 1500).sort((a, b) => a.d - b.d);
      else if (leafletMap && leafletMap.getZoom() >= 15) {
        const b = leafletMap.getBounds(), c = leafletMap.getCenter();
        base = data.stops.filter(s => b.contains([s.lat, s.lng])).map(s => ({ s, d: TH.haversine({ lat: c.lat, lng: c.lng }, s) })).sort((a, b2) => a.d - b2.d);
      }
      base = base.filter(x => TH.stopFits(x.s, ms.cat === "all" ? "all" : ms.cat));
      shownDay = null;
      if (ms.when === "today") {
        const withV = base.map(x => ({ ...x, v: TH.visitsOf(x.s)[0] })).filter(x => x.v);
        const todays = withV.filter(x => SCH.comesToday(x.v));
        if (todays.length || !withV.length) {
          shownDay = today;
          base = todays;
        } else {
          // Nothing left today: show the next service day that has visits here.
          const nextDate = withV.map(x => x.v.date).sort()[0];
          base = withV.filter(x => x.v.date === nextDate);
          shownDay = base[0].v.day;
        }
      }
      return base.slice(0, 60);
    }

    // The selected stop's trip: every stop of that trip gets a numbered dot with its scheduled
    // time. No lines are drawn — the data has the stopping order, not the streets the truck takes,
    // and a straight line between stops would look like a path it doesn't drive.
    function drawRoutes() {
      layerRoutes.clearLayers();
      if (isPlaceLayer(ms.cat) || !ms.selected) return;
      const sel = TH.stopsData().byId.get(ms.selected);
      if (!sel) return;
      const list = routes().get(routeKey(sel)) || [];
      if (list.length < 2) return;
      list.forEach((s, i) => {
        const me = s.id === sel.id;
        const el = h("div", { style: `width:20px;height:20px;border-radius:10px;display:grid;place-items:center;font:700 11px/1 system-ui;color:#fff;background:${me ? "#E6692C" : "#F0A57D"};border:2px solid #fff;box-shadow:0 1px 3px rgba(0,0,0,.3)`, text: String(i + 1) });
        const m = window.L.marker([s.lat, s.lng], { icon: window.L.divIcon({ className: "pin-wrap", html: el, iconSize: [20, 20], iconAnchor: [10, 10] }), interactive: !me, keyboard: false, zIndexOffset: me ? 1000 : 500 })
          .bindTooltip(`${i + 1}. ${TH.fmtTime(s.arrive)}`, { permanent: true, direction: "right", offset: [10, 0], className: "route-time" });
        if (!me) m.on("click", () => { ms.selected = s.id; drawMarkers(); stopSheet(s); });
        layerRoutes.addLayer(m);
      });
    }

    function pin(s, selected) {
      const v = TH.visitsOf(s)[0];
      const el = h("div", { class: "pin" + (selected ? " sel" : "") + (v && SCH.comesToday(v) ? "" : " later") },
        h("span", { class: "pin-head" }, icon("truck", 16)), h("span", { class: "pin-time", text: TH.fmtTime(s.arrive) }));
      return window.L.divIcon({ className: "pin-wrap", html: el, iconSize: [52, 54], iconAnchor: [26, 30] });
    }
    function drawMarkers() {
      if (!leafletMap) return;
      layerStops.clearLayers(); layerDrops.clearLayers();
      drawRoutes();
      if (isPlaceLayer(ms.cat)) {
        const L = LAYERS[ms.cat];
        places.forEach(x => {
          const el = h("div", { class: `place-pin place-${ms.cat}` + (x.p.id === ms.selected ? " sel" : "") }, icon(L.icon, 14));
          const m = window.L.marker([x.p.lat, x.p.lng], { icon: window.L.divIcon({ className: "pin-wrap", html: el, iconSize: [28, 28], iconAnchor: [14, 14] }), title: x.p.name, keyboard: true });
          m.on("click", () => { ms.selected = x.p.id; drawMarkers(); placeSheet(x.p); });
          layerStops.addLayer(m);
        });
        return;
      }
      shown.forEach(x => {
        const m = window.L.marker([x.s.lat, x.s.lng], { icon: pin(x.s, x.s.id === ms.selected), title: x.s.address, keyboard: true });
        m.on("click", () => { ms.selected = x.s.id; drawMarkers(); stopSheet(x.s); });
        layerStops.addLayer(m);
      });
      const drops = TH.dropData();
      if (drops) drops.points.filter(d => TH.dropFits(d, ms.cat)).forEach(d => {
        const m = window.L.marker([d.lat, d.lng], { icon: window.L.divIcon({ className: "drop-pin", html: "", iconSize: [22, 22] }), title: `${t("dropTitle")} ${d.squad}` });
        m.on("click", () => go("drop/" + d.id));
        layerDrops.addLayer(m);
      });
    }
    function drawBottom() {
      const pos = TH.lastPosition();
      const first = shown[0];
      const listBtn = h("button", { class: "map-list-btn", type: "button", onclick: listSheet }, icon("list", 18), t("listView"));
      if (failed) { fill(bottom, h("div", { class: "near-card" }, h("span", { class: "grow", text: t("tilesFailed") }), listBtn)); return; }
      if (isPlaceLayer(ms.cat)) {
        const L = LAYERS[ms.cat], a = anchor();
        // Nearest to me (or my stop) when known; otherwise nearest to the map centre.
        const best = a ? nearestPlaces(ms.cat, a.pos, 1)[0] : (places[0] && places[0].p);
        if (!best) { fill(bottom, h("div", { class: "near-card" }, h("span", { class: "grow caption dark", text: leafletMap && leafletMap.getZoom() >= 14 ? t("placeNone") : t("placeZoom") }))); return; }
        fill(bottom, h("div", { class: "near-card" },
          h("button", { class: "near-main", type: "button", onclick: () => { ms.selected = best.id; drawMarkers(); placeSheet(best); } },
            h("span", { class: `place-art place-${ms.cat}` }, icon(L.icon, 20)),
            h("span", { class: "grow" }, h("strong", { text: best.name }),
              h("span", { class: "caption dark", text: [t("nearestLabel"), a ? awayText(a, best) : null].filter(Boolean).join("・") })),
            icon("chev", 18)),
          h("button", { class: "map-list-btn nav-btn", type: "button", onclick: () => TH.openMap(best) }, icon("direction-sign", 18), t("seeOnMapNav"))));
        return;
      }
      if (!first) {
        fill(bottom, h("div", { class: "near-card" }, h("span", { class: "grow caption dark", text: shown.length === 0 && (ms.mode || ms.area || (leafletMap && leafletMap.getZoom() >= 15)) ? t("noStops") : t("zoomHint") }), listBtn));
        return;
      }
      const v = TH.visitsOf(first.s)[0];
      fill(bottom, h("div", { class: "near-card" },
        h("button", { class: "near-main", type: "button", onclick: () => { ms.selected = first.s.id; drawMarkers(); stopSheet(first.s); } },
          h("b", { class: "near-time", text: v ? compactWhen(v) : TH.fmtTime(first.s.arrive) }),
          h("span", { class: "grow" }, h("strong", { text: shortAddr(first.s) }),
            h("span", { class: "caption dark", text: [ms.mode === "near" ? t("nearestLabel") : null, pos ? t("walk", { n: walkMin(pos, first.s) }) : null].filter(Boolean).join("・") })),
          icon("chev", 18)),
        listBtn));
    }
    function refresh() {
      const before = whenLabel();
      shown = candidates(); places = placeCandidates();
      if (whenLabel() !== before) drawChips();
      drawToday();
      drawMarkers(); drawBottom();
    }

    function listSheet() {
      const data = TH.stopsData(); if (!data) return;
      const results = h("div");
      const showRows = () => fill(results, candidates().map(x => TH.stopRow(x.s, { dist: TH.lastPosition() ? TH.haversine(TH.lastPosition(), x.s) : null, onSelect: s => stopSheet(s) })),
        !candidates().length ? h("p", { class: "muted", text: t("zoomHint") }) : null);
      const dSel = h("select", { class: "select", "aria-label": t("district") },
        h("option", { value: "", text: `${t("district")}${t("colon")}${t("choose")}` }), data.districts.map(d => h("option", { value: d, text: d })));
      const vSel = h("select", { class: "select", "aria-label": t("village"), disabled: true, style: "margin-top:8px" });
      dSel.addEventListener("change", () => {
        const vs = [...new Set(data.stops.filter(s => s.district === dSel.value).map(s => s.village))].sort();
        fill(vSel, h("option", { value: "", text: `${t("village")}${t("colon")}${t("choose")}` }), vs.map(v => h("option", { value: v, text: v })));
        vSel.disabled = !dSel.value;
        ms.area = dSel.value ? { d: dSel.value, v: "" } : null; ms.when = "any"; drawChips(); refresh(); showRows();
      });
      vSel.addEventListener("change", () => {
        ms.area = { d: dSel.value, v: vSel.value }; refresh(); showRows();
        const pts = data.stops.filter(s => s.district === dSel.value && (!vSel.value || s.village === vSel.value));
        if (leafletMap && pts.length) leafletMap.fitBounds(window.L.latLngBounds(pts.map(s => [s.lat, s.lng])), { maxZoom: 17, padding: [24, 24] });
      });
      showRows();
      TH.sheet(t("pickArea"), dSel, vSel, results, h("p", { class: "caption", text: t("scheduleNote") }));
    }

    async function locate() {
      try {
        const p = await TH.getLocation();
        TH.setLastPosition(p); ms.mode = "near"; ms.area = null;
        if (leafletMap) {
          layerMe.clearLayers();
          layerMe.addLayer(window.L.circleMarker([p.lat, p.lng], { radius: 9, color: "#fff", weight: 3, fillColor: "#5AB4C5", fillOpacity: 1 }).bindTooltip(t("me")));
          leafletMap.setView([p.lat, p.lng], 16);
        }
        refresh();
      } catch (_) { fill(bottom, h("div", { class: "near-card" }, h("span", { class: "grow", text: t("locationFailed") }), h("button", { class: "map-list-btn", type: "button", onclick: listSheet }, icon("list", 18), t("listView")))); }
    }

    Promise.all([TH.loadStops(), TH.loadDrops().catch(() => null), TH.loadFavs().catch(() => null), TH.loadPlaces().catch(() => null)]).then(() => {
      TH.dropMap();
      if (!window.L) { failed = true; refresh(); return; }
      const tiles = (window.TH_CONFIG || {}).tiles || {};
      leafletMap = window.L.map(mapEl, { zoomControl: false, attributionControl: true }).setView(ms.center || [25.0478, 121.5319], ms.zoom || 13);
      let loaded = 0, errors = 0;
      const layer = window.L.tileLayer(tiles.url || "https://tile.openstreetmap.org/{z}/{x}/{y}.png", { maxZoom: tiles.maxZoom || 19, attribution: tiles.attribution || "© OpenStreetMap contributors" });
      layer.on("tileload", () => { loaded++; });
      layer.on("tileerror", () => { errors++; if (errors >= 3 && loaded === 0 && !failed) { failed = true; drawBottom(); } });
      layer.addTo(leafletMap);
      layerRoutes = window.L.layerGroup().addTo(leafletMap);
      layerStops = window.L.layerGroup().addTo(leafletMap);
      layerDrops = window.L.layerGroup().addTo(leafletMap);
      layerMe = window.L.layerGroup().addTo(leafletMap);
      const pos = TH.lastPosition();
      if (pos) layerMe.addLayer(window.L.circleMarker([pos.lat, pos.lng], { radius: 9, color: "#fff", weight: 3, fillColor: "#5AB4C5", fillOpacity: 1 }));
      leafletMap.on("moveend", () => { ms.center = leafletMap.getCenter(); ms.zoom = leafletMap.getZoom(); if ((!ms.mode && !ms.area) || isPlaceLayer(ms.cat)) refresh(); });
      leafletMap.on("dragstart", () => { if (ms.mode === "near") ms.mode = null; });
      if (pos && ms.mode === "near" && !ms.center) leafletMap.setView([pos.lat, pos.lng], 16);
      // No live position yet: open on the stop chosen during setup instead of the whole city.
      const homeId = !pos && !ms.center && TH.profile ? TH.profile.get().stopId : null;
      const home = homeId ? TH.stopsData().byId.get(homeId) : null;
      if (home) leafletMap.setView([home.lat, home.lng], 16);
      if (!focusPlaces()) refresh();
      centerChip();
      if (!pos && !ms.center && TH.bridge()) locate();
    }).catch(() => { failed = true; drawBottom(); });

    return h("div", { class: "map-page" }, mapEl, chipsEl, todayEl,
      h("button", { class: "locate-btn", type: "button", "aria-label": t("useLocation"), onclick: locate }, icon("locate", 20)),
      bottom);
  }

  // ------------------------------------------------------------ saved stops
  async function saveReminder(rem) {
    const r = await TH.askApp("trash_reminder_save", { reminder: { ...rem, lang: TH.lang() }, preview: false }, 30000);
    TH.applyFavReply(r);
    return r;
  }
  async function setQuick(stop, on, lead) {
    const fs = TH.favState();
    const rems = fs.reminders.filter(r => r.stopId === stop.id);
    if (on && !rems.length) {
      for (const wd of SCH.serviceDays(stop, TH.stopsData().generalDays)) {
        await saveReminder({ stopId: stop.id, weekday: wd, leadMinutes: lead, frequency: "weekly", enabled: true });
      }
    } else {
      for (const r of rems) {
        await saveReminder({ reminderId: r.reminderId, stopId: stop.id, weekday: r.weekday, leadMinutes: lead, frequency: r.frequency, enabled: on });
      }
    }
  }
  function viewFavorites() {
    TH.setHeader(t("favTitle"));
    const out = h("div", { class: "favs3" });
    const draw = () => {
      const data = TH.stopsData(), fs = TH.favState();
      if (!fs.favorites.length) {
        fill(out, h("p", { class: "empty", text: t("favEmpty") }), btn("btn-primary wide", t("findNearby"), () => go("map")),
          fs.native ? null : h("p", { class: "caption", text: t("favBrowser") }));
        return;
      }
      const pos = TH.lastPosition();
      const cards = fs.favorites.map((f, idx) => {
        const s = data.byId.get(f.stopId);
        const snap = s || f.snapshot || {};
        const v = s ? TH.visitsOf(s)[0] : null;
        const rems = fs.reminders.filter(r => r.stopId === f.stopId);
        const on = rems.some(r => r.enabled);
        const lead = rems[0] ? rems[0].leadMinutes : 10;
        const denied = rems.some(r => r.enabled && r.status && r.status.state === "denied");
        const next = rems.map(r => r.status && r.status.nextNotify).filter(Boolean).sort()[0];
        const msg = h("div", { role: "status" });
        const busy = async (fn) => {
          card.classList.add("busy");
          try { await fn(); draw(); } catch (e) { fill(msg, TH.notice(t("remError") + (e && e.message ? ` (${e.message})` : ""), "notice-warn")); }
          card.classList.remove("busy");
        };
        const toggle = h("input", { type: "checkbox", class: "switch", checked: on, disabled: !fs.native || !s, "aria-label": t("remindToggle") });
        toggle.addEventListener("change", () => busy(() => setQuick(s, toggle.checked, lead)));
        // Choosing a lead time keeps the switch as it is; with no reminder yet it turns reminders on.
        const leadChip = n => h("button", { class: "lead-chip" + (n === lead ? " on" : ""), type: "button", disabled: !fs.native || !s,
          onclick: () => busy(() => setQuick(s, rems.length ? on : true, n)) }, t("minShort", { n }));
        const card = h("section", { class: "fav3" + (s ? "" : " gone") },
          h("div", { class: "fav3-top" },
            h("span", { class: "star" }, icon("star", 18, "filled")),
            h("button", { class: "fav3-main", type: "button", disabled: !s, onclick: () => s && go("stop/" + s.id) },
              h("span", { class: "caption", text: f.nickname || (idx === 0 ? t("nickHome") : t("favLabel")) }),
              h("span", { class: "fav3-line" }, h("b", { text: v ? compactWhen(v) : (snap.arrive != null ? TH.fmtTime(snap.arrive) : "—") }),
                h("span", { text: (snap.address || "").replace(/^臺北市/, "").replace(snap.district || "", "") }))),
            h("label", { class: "switch-wrap" }, toggle, h("span", { class: "caption", text: t("remindToggle") }))),
          h("div", { class: "lead-row" }, h("span", { class: "caption", text: t("lead") }), [5, 10, 15].map(leadChip),
            // Remind at the moment to walk out: walking time + 5 min early.
            s && TH.leave && TH.leave.walkFor(s) ? (() => { const n = TH.leave.walkFor(s).walk + TH.leave.EARLY; return h("button", { class: "lead-chip" + (n === lead ? " on" : ""), type: "button", disabled: !fs.native,
              onclick: () => busy(() => setQuick(s, rems.length ? on : true, n)) }, t("lvChip", { n })); })() : null),
          s && TH.leave ? TH.leave.line(s, { compact: false, onChange: () => draw() }) : null,
          !s ? TH.notice(t("favGone"), "notice-warn") : null,
          denied ? TH.notice(t("remDenied"), "notice-warn") : on && next ? h("p", { class: "caption", text: `${t("remNotify")}${t("colon")}${TH.fmtWhen(Date.parse(next))}` }) : null,
          !fs.native ? h("p", { class: "caption", text: t("remNeedsApp") }) : null,
          msg,
          h("div", { class: "fav3-links" },
            s ? h("button", { class: "link-btn small", type: "button", onclick: () => go("remind/" + s.id + (rems[0] ? "/" + rems[0].reminderId : "")), text: t("customize") + " ›" }) : null,
            h("button", { class: "link-btn small", type: "button", onclick: async () => {
              const name = window.prompt(t("nickname"), f.nickname || ""); if (name == null) return;
              await TH.favOp("rename", { stopId: f.stopId, nickname: name.trim() }).catch(() => {}); draw();
            }, text: t("rename") }),
            h("button", { class: "link-btn small danger", type: "button", onclick: async () => {
              if (!(await TH.confirmDialog(t("removeConfirm"), t("remove")))) return;
              await TH.favOp("remove", { stopId: f.stopId }).catch(() => {}); draw();
            }, text: t("remove") })));
        return card;
      });
      // Other stops near the first saved one that are still coming today.
      const first = fs.favorites.map(f => data.byId.get(f.stopId)).find(Boolean);
      const near = first ? data.stops.filter(s => !TH.isFav(s.id) && TH.haversine(first, s) < 700)
        .map(s => ({ s, v: TH.visitsOf(s)[0] })).filter(x => x.v && SCH.comesToday(x.v)).sort((a, b) => a.v.arriveMs - b.v.arriveMs).slice(0, 5) : [];
      fill(out,
        h("h3", { class: "section-title", text: t("myFavs") }), cards,
        near.length ? h("h3", { class: "section-title", text: t("tonightCan") }) : null,
        near.length ? h("div", { class: "near-list" }, near.map(x => h("div", { class: "near-row" },
          h("button", { class: "near-row-main", type: "button", onclick: () => stopSheet(x.s) }, h("b", { text: hhmm(x.v.arriveMs) }), h("span", { class: "grow", text: shortAddr(x.s) }),
            h("span", { class: "caption", text: pos ? t("minShort", { n: walkMin(pos, x.s) }) : `${Math.round(TH.haversine(first, x.s))} m` })),
          h("button", { class: "icon-round", type: "button", "aria-label": t("save"), onclick: async () => { await TH.favOp("save", { stopId: x.s.id }).catch(() => {}); draw(); } }, icon("star", 18))))) : null,
        TH.sourceFooter([TH.sourceById("truck")], t("dataVersion", { v: data.version })));
    };
    Promise.all([TH.loadStops(), TH.loadFavs(true)]).then(draw).catch(() => fill(out, h("p", { class: "empty", text: t("loadError") })));
    return out;
  }

  TH.setQuickReminders = setQuick;
  Object.assign(TH.views, { viewMap, viewFavorites });
})();
