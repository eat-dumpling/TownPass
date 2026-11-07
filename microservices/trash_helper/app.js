// SPDX-License-Identifier: AGPL-3.0-or-later
// Taipei Trash Helper — TownPass microservice. Plain JS, no build step.
// All text is rendered with textContent (never innerHTML) so data cannot inject markup.
"use strict";

(function () {
  const STR = window.TH_STRINGS;
  const LANGS = window.TH_LANGS;
  const CFG = window.TH_CONFIG || {};
  const SCH = window.THSchedule;
  const app = document.getElementById("app");
  const titleEl = document.getElementById("page-title");
  const backBtn = document.getElementById("back");

  // ---------------------------------------------------------------- dev log
  // Only on the plain-http dev server (python3 server.py on a LAN address). Sends UI events,
  // never location or personal data. Off for the copy bundled in the app (127.0.0.1).
  const T0 = performance.now();
  const devLog = location.protocol === "http:" && location.hostname !== "127.0.0.1" && location.hostname !== "localhost" ? (ev, extra) => {
    try {
      const body = JSON.stringify({ t: Math.round(performance.now() - T0), ev, hash: location.hash, hist: history.length, ...extra });
      fetch("/api/log", { method: "POST", body, keepalive: true }).catch(() => {});
    } catch (_) { /* ignore */ }
  } : () => {};
  devLog("boot", { ua: navigator.userAgent.slice(0, 80), bridge: !!window.flutterObject });
  window.addEventListener("error", e => devLog("error", { msg: String(e.message), line: e.lineno }));
  window.addEventListener("unhandledrejection", e => devLog("rejection", { msg: String(e.reason) }));
  ["click"].forEach(type => document.addEventListener(type, e => {
    const el = e.target.closest("button, a, select, input") || e.target;
    devLog(type, { el: el.tagName + (el.id ? "#" + el.id : "") + "." + (el.className || "").toString().split(" ")[0], txt: (el.textContent || "").trim().slice(0, 20) });
  }, true));

  // ---------------------------------------------------------------- state
  const store = {
    get(k) { try { return localStorage.getItem(k); } catch (_) { return null; } },
    set(k, v) { try { localStorage.setItem(k, v); } catch (_) { /* private mode */ } },
  };
  // First visit: follow the phone's language when we have it (Android reports Indonesian as "in").
  const fromDevice = () => {
    for (const raw of navigator.languages || [navigator.language || ""]) {
      const c = (raw || "").toLowerCase().split("-")[0];
      const code = c === "in" ? "id" : c === "tl" ? "fil" : c;
      if (LANGS.some(l => l.code === code && l.ready)) return code;
    }
    return "en";
  };
  let lang = store.get("th.lang") || fromDevice();
  if (!LANGS.some(l => l.code === lang && l.ready)) lang = "en";
  let rules = null, stopsData = null, vendorsData = null, dropData = null, exceptionsData = null;
  let lastPosition = null;
  let favState = null;          // {favorites, reminders, permission, native}
  const mapState = { cat: "all", when: "today", center: null, zoom: null, selected: null, mode: null, area: null };

  // ---------------------------------------------------------------- helpers
  function t(key, vars) {
    let s = (STR[lang] && STR[lang][key]) ?? STR.en[key] ?? key;
    if (vars && typeof s === "string") for (const [k, v] of Object.entries(vars)) s = s.split(`{${k}}`).join(v);
    return s;
  }
  // Rules content carries en + zh; other languages come from TH_CONTENT, keyed by the English text.
  // Side-by-side language ("對照語言"): a second language shown in small type under key words,
  // so a caregiver and a Taiwanese family member can read the same screen. Off by default.
  const pairLang = () => { const p = store.get("th.pair"); return p && p !== lang && LANGS.some(l => l.code === p && l.ready) ? p : null; };
  const tIn = (code, key) => (STR[code] && STR[code][key]) ?? STR.en[key] ?? key;
  const LIn = (code, obj) => !obj ? "" : obj[code] ?? (window.TH_CONTENT[code] || {})[obj.en] ?? obj.en ?? "";
  // Value for a data-pair attribute (undefined = nothing shown): the same text in the pair language.
  const pairT = key => { const p = pairLang(); if (!p) return undefined; const s = tIn(p, key); return typeof s === "string" && s !== t(key) ? s : undefined; };
  const pairOf = obj => { const p = pairLang(); if (!p || !obj) return undefined; const s = LIn(p, obj); return s && s !== L(obj) ? s : undefined; };
  function setPair(code) { store.set("th.pair", code || ""); render(); }
  // Run a synchronous text builder in another language (t, L and fmtWhen follow it), e.g. to show
  // the voice assistant's reply in the side-by-side language too.
  function inLang(code, fn) { const prev = lang; lang = code; try { return fn(); } finally { lang = prev; } }

  function L(obj) {
    if (!obj) return "";
    if (obj[lang] != null) return obj[lang];
    const tr = (window.TH_CONTENT[lang] || {})[obj.en];
    return tr ?? obj.en ?? "";
  }

  function h(tag, attrs, ...children) {
    const el = document.createElement(tag);
    for (const [k, v] of Object.entries(attrs || {})) {
      if (v == null || v === false) continue;
      if (k === "class") el.className = v;
      else if (k === "text") el.textContent = v;
      else if (k.startsWith("on")) el.addEventListener(k.slice(2), v);
      else el.setAttribute(k, v === true ? "" : v);
    }
    for (const c of children.flat(Infinity)) {
      if (c == null || c === false) continue;
      el.append(c instanceof Node ? c : document.createTextNode(String(c)));
    }
    return el;
  }
  const chevron = () => {
    const s = document.createElementNS("http://www.w3.org/2000/svg", "svg");
    s.setAttribute("viewBox", "0 0 24 24"); s.setAttribute("width", "22"); s.setAttribute("height", "22");
    s.setAttribute("class", "chev"); s.setAttribute("aria-hidden", "true");
    const p = document.createElementNS("http://www.w3.org/2000/svg", "path");
    p.setAttribute("d", "M9 5l7 7-7 7"); p.setAttribute("fill", "none"); p.setAttribute("stroke", "currentColor");
    p.setAttribute("stroke-width", "2"); p.setAttribute("stroke-linecap", "round"); p.setAttribute("stroke-linejoin", "round");
    s.append(p); return s;
  };
  const fill = (el, ...kids) => el.replaceChildren(...kids.flat(Infinity).filter(k => k != null && k !== false));
  const btn = (cls, text, onclick, extra) => h("button", { class: "btn " + cls, type: "button", onclick, ...(extra || {}) }, text);
  const colon = () => t("colon");

  // In-app history: every entry carries its depth, so Back knows whether there is a page of ours to return to.
  let depth = (history.state && history.state.d) || 0;
  if (!history.state) history.replaceState({ d: 0 }, "", location.href);
  function go(path, opts) {
    const url = "#/" + path;
    if (opts && opts.replace) history.replaceState({ d: depth }, "", url);
    else { depth += 1; history.pushState({ d: depth }, "", url); }
    render();
  }
  function parentOf(hash) {
    const [view, a] = hash.replace(/^#\/?/, "").split("/");
    if (view === "item") return a && hash.split("/").length > 3 ? "item/" + a : "sort";
    if (view === "today" && a) return "item/" + a;
    if (view === "buy") return "bags";
    if (view === "stop" || view === "drop") return "map";
    if (view === "remind") return "favorites";
    return "";
  }

  const dayList = days => days.map(d => t("days")[d]).join(t("listSep"));
  const fmtTime = min => {
    const m = ((min % 1440) + 1440) % 1440;
    return `${pad2(Math.floor(m / 60))}:${pad2(m % 60)}`;
  };
  const pad2 = n => String(n).padStart(2, "0");
  // "today 19:20" / "Mon 11/9 19:20" in Taipei time.
  function fmtWhen(ms, now = Date.now()) {
    const p = SCH.taipeiParts(ms), n = SCH.taipeiParts(now);
    const tm = `${pad2(Math.floor(p.minutes / 60))}:${pad2(p.minutes % 60)}`;
    const same = (a, b) => a.y === b.y && a.m === b.m && a.d === b.d;
    if (same(p, n)) return `${t("today")} ${tm}`;
    if (same(p, SCH.addDays(n, 1))) return `${t("tomorrow")} ${tm}`;
    return lang === "zh" ? `${p.m}/${p.d}（${t("days")[p.day]}）${tm}` : `${t("days")[p.day]} ${p.m}/${p.d} ${tm}`;
  }
  function fmtDate(key) {
    const [y, m, d] = key.split("-").map(Number);
    const day = new Date(Date.UTC(y, m - 1, d)).getUTCDay();
    return lang === "zh" ? `${y}/${m}/${d}（${t("days")[day]}）` : `${t("days")[day]} ${y}-${pad2(m)}-${pad2(d)}`;
  }
  const taipeiNow = () => SCH.taipeiParts(Date.now());

  const normAddr = s => (s || "").replace(/台/g, "臺").replace(/\s+/g, "").replace(/^臺北市/, "");

  // ---------------------------------------------------------------- TownPass bridge
  function bridge() {
    const b = window.flutterObject;
    return b && typeof b.postMessage === "function" ? b : null;
  }
  let reqSeq = 0;
  // Ask the app and wait for its reply. Trash Helper messages carry a requestId so that
  // overlapping requests of the same name cannot pick up each other's replies.
  function askApp(name, data, timeoutMs = 15000, onProgress) {
    return new Promise((resolve, reject) => {
      const b = bridge();
      if (!b) return reject(new Error("no-bridge"));
      const withId = data && typeof data === "object" && !Array.isArray(data);
      const requestId = withId ? `${Date.now().toString(36)}-${++reqSeq}` : null;
      const payload = withId ? { ...data, requestId } : data;
      let timer;
      const onMsg = (event) => {
        let msg;
        try { msg = JSON.parse(event.data); } catch (_) { return; }
        if (!msg || msg.name !== name) return;
        if (requestId && !(msg.data && msg.data.requestId === requestId)) return;
        if (msg.data && msg.data.partial) { if (onProgress) onProgress(msg.data); return; }
        cleanup(); resolve(msg.data);
      };
      const cleanup = () => {
        clearTimeout(timer);
        if (typeof b.removeEventListener === "function") b.removeEventListener("message", onMsg);
        else if (b.onmessage === onMsg) b.onmessage = null;
      };
      if (typeof b.addEventListener === "function") b.addEventListener("message", onMsg);
      else b.onmessage = onMsg;
      timer = setTimeout(() => { cleanup(); reject(new Error("timeout")); }, timeoutMs);
      b.postMessage(JSON.stringify({ name, data: payload }));
    });
  }
  const tell = (name, data) => { const b = bridge(); if (b) b.postMessage(JSON.stringify({ name, data })); };
  function openExternal(url) {
    if (bridge()) tell("open_link", url);
    else window.open(url, "_blank", "noopener");
  }
  const extLink = (url, text) => h("a", { href: url, class: "ext", rel: "noopener", onclick: e => { e.preventDefault(); openExternal(url); } }, text);

  async function getLocation() {
    if (bridge()) {
      const d = await askApp("location", null);
      if (d && typeof d.latitude === "number" && typeof d.longitude === "number") return { lat: d.latitude, lng: d.longitude };
      throw new Error("no-location");
    }
    if (!navigator.geolocation) throw new Error("no-geolocation");
    return new Promise((resolve, reject) => navigator.geolocation.getCurrentPosition(
      p => resolve({ lat: p.coords.latitude, lng: p.coords.longitude }), reject, { timeout: 15000, maximumAge: 60000 }));
  }
  // Only the chosen destination goes to the map app — never the user's own position.
  // Walking directions in Google Maps (the app if installed, otherwise the web). Places whose pin
  // is estimated from an address pass `byAddress`, so Google resolves the exact address itself.
  function openMap(p) {
    if (navigator.onLine === false) return;
    const dest = p.byAddress && p.address ? p.address : `${p.lat},${p.lng}`;
    const url = `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(dest)}&travelmode=walking`;
    if (bridge()) askApp("launch_map", url).catch(() => {});
    else window.open(url, "_blank", "noopener");
  }

  // Buttons that open Google Maps need the internet: shown disabled while offline, updated live.
  function needsNet(el) {
    if (!el) return el;
    el.setAttribute("data-needs-net", "");
    netState(el);
    return el;
  }
  function netState(el) {
    const off = navigator.onLine === false;
    el.disabled = off;
    if (off) { el.setAttribute("aria-disabled", "true"); el.title = t("navOffline"); }
    else { el.removeAttribute("aria-disabled"); el.removeAttribute("title"); }
  }
  const netAll = () => document.querySelectorAll("[data-needs-net]").forEach(netState);
  window.addEventListener("online", netAll);
  window.addEventListener("offline", netAll);

  // Small in-page confirm (native JS dialogs are not reliable inside every WebView).
  function confirmDialog(text, okLabel) {
    return new Promise(resolve => {
      const dlg = h("dialog", { class: "confirm" },
        h("p", { text }),
        h("div", { class: "actions row" },
          btn("btn-secondary", t("cancel"), () => { dlg.close(); resolve(false); }),
          btn("btn-primary", okLabel || "OK", () => { dlg.close(); resolve(true); })));
      dlg.addEventListener("close", () => { dlg.remove(); resolve(false); });
      document.body.append(dlg);
      if (typeof dlg.showModal === "function") dlg.showModal(); else resolve(window.confirm(text));
    });
  }
  async function dial(number) {
    if (!(await confirmDialog(t("callConfirm", { number }), t("call")))) return;
    const digits = number.replace(/[^0-9]/g, "");
    if (bridge()) askApp("phone_call", digits).catch(() => {});
    else location.href = "tel:" + digits;
  }

  // ---------------------------------------------------------------- data
  const getJSON = async (path) => {
    const r = await fetch(path, { cache: "no-cache" });
    if (!r.ok) throw new Error(path + " " + r.status);
    return r.json();
  };
  async function loadRules() {
    if (!rules) rules = await getJSON("data/rules.json");
    if (!exceptionsData) exceptionsData = await getJSON("data/exceptions.json").catch(() => ({ exceptions: [] }));
    return rules;
  }
  async function loadStops() {
    if (!stopsData) {
      const raw = await getJSON("data/stops.json");
      const stops = raw.stops.map(s => ({
        district: raw.districts[s[0]], village: s[1], address: s[2],
        arrive: s[3], leave: s[4], lat: s[5], lng: s[6], route: s[7], trip: s[8], id: s[9], note: s[10] || null,
      }));
      stopsData = { source: raw.source, version: raw.version, generalDays: raw.generalDays || rules.groups.general.days, districts: raw.districts, stops, byId: new Map(stops.map(s => [s.id, s])) };
    }
    return stopsData;
  }
  async function loadVendors() {
    if (!vendorsData) vendorsData = await getJSON("data/bag_vendors.json");
    return vendorsData;
  }
  async function loadDrops() {
    if (!dropData) dropData = await getJSON("data/dropoffs.json");
    return dropData;
  }
  // Special-item places (data/places.json): clothes bins, battery take-back stores, medicine take-back.
  let placesData = null;
  async function loadPlaces() {
    if (!placesData) {
      const raw = await getJSON("data/places.json");
      const rows = (key, fn) => raw.layers[key].map((r, i) => ({ layer: key, id: key + i, lat: r[0], lng: r[1], ...fn(r) }));
      placesData = {
        sources: raw.sources, builtOn: raw.builtOn,
        clothes: rows("clothes", r => ({ name: r[2].replace(/^..區/, ""), address: "臺北市" + r[2], org: r[3], phone: r[4] })),
        battery: rows("battery", r => ({ name: r[2], address: r[3] ? "臺北市" + r[3] : "" })),
        pills: rows("pills", r => ({ name: r[2], address: r[3], phone: r[4], approx: !!r[5], hospital: !!r[6], byAddress: true })),
        bags: rows("bags", r => ({ name: r[2], address: "臺北市" + r[3], phone: r[4], approx: !!r[5], byAddress: true })),
      };
    }
    return placesData;
  }
  // Which place layer an item goes to, if any.
  const placeLayerOf = item => item.takeback ? "battery" : item.id === "clothes" ? "clothes" : item.id === "pills" ? "pills" : null;
  const itemById = id => rules.items.find(i => i.id === id);
  const groupOf = item => rules.groups[item.group];
  const catOf = item => groupOf(item).cat;
  const sourceById = id => rules.sources.find(s => s.id === id);
  const exceptions = () => (exceptionsData && exceptionsData.exceptions) || [];
  const visitsOf = (stop, opts) => SCH.nextVisits(stop, { generalDays: stopsData.generalDays, exceptions: exceptions(), ...(opts || {}) });

  function haversine(a, b) {
    const R = 6371000, rad = x => x * Math.PI / 180;
    const dLat = rad(b.lat - a.lat), dLng = rad(b.lng - a.lng);
    const s = Math.sin(dLat / 2) ** 2 + Math.cos(rad(a.lat)) * Math.cos(rad(b.lat)) * Math.sin(dLng / 2) ** 2;
    return 2 * R * Math.asin(Math.sqrt(s));
  }

  // ---------------------------------------------------------------- favourites & reminders store
  // Inside TownPass the app keeps them (SharedPreferences), so they survive a change of page
  // address; in a normal browser they live in localStorage and reminders are unavailable.
  const LOCAL_FAV = "th.fav.v1";
  async function loadFavs(force) {
    if (favState && !force) return favState;
    if (bridge()) {
      const r = await askApp("trash_favorites", { op: "list" });
      if (!r || !r.ok) throw new Error((r && r.error) || "favorites");
      favState = { favorites: r.favorites || [], reminders: r.reminders || [], permission: r.permission, platform: r.platform, native: true };
    } else {
      let list = [];
      try { list = JSON.parse(store.get(LOCAL_FAV) || "[]"); } catch (_) { list = []; }
      favState = { favorites: Array.isArray(list) ? list : [], reminders: [], native: false };
    }
    return favState;
  }
  function applyFavReply(r) {
    if (!r || !r.ok) throw new Error((r && r.error) || "failed");
    favState = { favorites: r.favorites || [], reminders: r.reminders || [], permission: r.permission, platform: r.platform, native: true };
    return r;
  }
  async function favOp(op, args) {
    if (bridge()) return applyFavReply(await askApp("trash_favorites", { op, ...args }));
    await loadFavs();
    let list = favState.favorites.slice();
    if (op === "save") {
      const s = stopsData.byId.get(args.stopId);
      if (s && !list.some(f => f.stopId === s.id)) list.push({ stopId: s.id, nickname: args.nickname || "", savedAt: new Date().toISOString(), snapshot: snapshotOf(s), dataVersion: stopsData.version });
    } else if (op === "remove") list = list.filter(f => f.stopId !== args.stopId);
    else if (op === "rename") list = list.map(f => f.stopId === args.stopId ? { ...f, nickname: String(args.nickname || "").slice(0, 40) } : f);
    store.set(LOCAL_FAV, JSON.stringify(list));
    favState = { ...favState, favorites: list };
    return { ok: true };
  }
  const snapshotOf = s => ({ address: s.address, district: s.district, village: s.village, route: s.route, trip: s.trip, arrive: s.arrive, leave: s.leave, lat: s.lat, lng: s.lng });
  const isFav = id => !!(favState && favState.favorites.some(f => f.stopId === id));

  // ---------------------------------------------------------------- shared pieces
  // v3: home, camera and map draw their own top area (title = null hides the bar).
  // Inside TownPass the native app bar already has a back arrow, so ours stays hidden there.
  const topbar = document.querySelector(".topbar");
  function setHeader(title) {
    // A blank title only needs the bar for our own back button (normal browser, with history).
    topbar.hidden = title == null || (!title.trim() && (!!bridge() || depth === 0));
    titleEl.textContent = title || "";
    backBtn.hidden = !!bridge() || depth === 0;
    backBtn.setAttribute("aria-label", t("back"));
    document.title = (title && title.trim()) || t("appTitle");
  }
  function sourceFooter(list, extra) {
    const items = list.filter(Boolean);
    return h("div", { class: "source" },
      h("div", {}, `${t("source")}${colon()}`,
        items.map((s, i) => [i ? " · " : "", extLink(s.url, s.name), s.updated ? ` (${t("updatedOn", { date: s.updated })})` : ""])),
      h("div", { class: "caption", text: [t("checkedOn", { date: rules.checked || rules.version }), extra].filter(Boolean).join(" · ") }));
  }
  const section = (title, ...kids) => h("section", { class: "card" }, h("h3", { class: "card-title", text: title }), kids);
  const I = (name, size) => TH.icon(name, size || 16);
  const catChip = cat => h("span", { class: `chip-cat cat-${cat}` }, I(rules.categories[cat].icon, 14), t("cat_" + cat));
  const notice = (text, cls) => h("div", { class: "notice " + (cls || ""), text });
  const verifyBox = text => h("div", { class: "verify" }, h("strong", {}, I("info-circle"), " ", t("needsCheck")), h("div", { text }));

  // ---------------------------------------------------------------- item result
  function matches(item, q) {
    if (!q) return true;
    const hay = [...Object.values(item.name), ...(item.keywords || [])].join(" ").toLowerCase();
    return q.toLowerCase().split(/\s+/).every(w => hay.includes(w));
  }
  function componentCard(c) {
    const g = rules.groups[c.group];
    const ref = c.item && itemById(c.item);
    return h("li", { class: "part" },
      h("div", { class: "part-head" }, h("strong", { text: L(c.name) }), catChip(g.cat)),
      c.note ? h("div", { class: "caption", text: L(c.note) }) : null,
      c.verify ? h("div", { class: "part-verify" }, h("span", { class: "kind kind-verify", text: t("needsCheck") }), " ", L(c.verify)) : null,
      ref ? h("button", { class: "link-btn", type: "button", onclick: () => go("item/" + ref.id), text: `${L(ref.name)} ›` }) : null);
  }
  function bookingPanel() {
    const c = rules.contacts;
    const sel = h("select", { class: "select", "aria-label": t("chooseDistrict") },
      h("option", { value: "", text: `${t("chooseDistrict")}${colon()}${t("choose")}` }),
      Object.keys(c.squads).map(d => h("option", { value: d, text: d })));
    const call = btn("btn-primary", t("callSquad", { district: "" }), () => sel.value && dial(c.squads[sel.value]), { disabled: true });
    sel.addEventListener("change", () => {
      call.disabled = !sel.value;
      call.textContent = t("callSquad", { district: sel.value }) + (sel.value ? ` ${c.squads[sel.value]}` : "");
    });
    return section(t("bookTitle"),
      h("p", { text: t("bookLead") }), sel,
      h("div", { class: "actions" }, call,
        btn("btn-secondary", t("call1999"), () => dial(c.hotline)),
        h("p", { class: "caption" }, extLink(c.online, t("onlineBooking")))));
  }
  // ---------------------------------------------------------------- bags
  function viewBags() {
    setHeader(t("bagsTitle"), true);
    const b = rules.bags;
    const srcs = b.src.map(sourceById);
    return [
      section(t("bagsWho"), h("ul", { class: "rule-list" }, b.rules.map(r => h("li", { text: L(r.text) })))),
      section(t("bagsSizes"),
        h("div", { class: "table-wrap" }, h("table", { class: "bag-table" },
          h("thead", {}, h("tr", {}, [t("bagsSize"), t("bagsPack"), t("bagsPrice"), t("bagsWeight"), t("bagsType")].map(x => h("th", { scope: "col", text: x })))),
          h("tbody", {}, b.sizes.map(s => h("tr", {},
            h("th", { scope: "row", text: `${s.liters} L` }), h("td", { text: t("pcs", { n: s.perPack }) }),
            h("td", { text: `NT$${s.packPrice}` }), h("td", { text: `${s.maxKg} kg` }), h("td", { text: t("bagType_" + s.type) })))))),
        h("p", { class: "caption", text: t("bagsRetail", { list: b.retail.map(r => `${r.liters} L NT$${r.price}`).join(t("listSep")) }) })),
      section(t("bagsDual"),
        h("p", { text: L(b.dualNote) }),
        h("p", { class: "caption", text: b.dual.map(d => `${L(d.size)} ${d.liters} L NT$${d.price}`).join(t("listSep")) })),
      section(t("bagsAdvice"), h("p", { text: L(b.advice) })),
      h("div", { class: "actions" }, btn("btn-primary", t("whereToBuy"), () => go("buy"))),
      sourceFooter(srcs),
    ];
  }
  function viewBuy() {
    setHeader(t("buyTitle"), true);
    const list = h("div", { "aria-live": "polite" });
    const count = h("p", { class: "caption" });
    const dSel = h("select", { class: "select", "aria-label": t("district") });
    const q = h("input", { type: "search", placeholder: t("buySearch"), "aria-label": t("buySearch"), enterkeyhint: "search" });
    const LIMIT = 60;
    const draw = () => {
      if (!vendorsData) return;
      const words = normAddr(q.value).toLowerCase().split(/\s+/).filter(Boolean);
      const di = dSel.value === "" ? -1 : Number(dSel.value);
      if (di < 0 && !words.length) { list.replaceChildren(); count.textContent = ""; return; }
      const rows = vendorsData.vendors.filter(v => (di < 0 || v[0] === di) && words.every(w => normAddr(v[1] + v[2]).toLowerCase().includes(w)));
      count.textContent = t("buyCount", { n: rows.length }) + (rows.length > LIMIT ? " · " + t("buyMore", { n: LIMIT }) : "");
      fill(list, rows.slice(0, LIMIT).map(v => h("div", { class: "vendor" },
        h("div", {}, h("strong", { text: v[1] }), h("div", { class: "caption", text: v[2] })),
        v[3] ? h("button", { class: "btn btn-ghost", type: "button", "aria-label": `${t("call")} ${v[1]}`, onclick: () => dial(v[3]) }, I("phone"), v[3]) : null)));
    };
    loadVendors().then(d => {
      fill(dSel, h("option", { value: "", text: `${t("district")}${colon()}${t("choose")}` }), d.districts.map((name, i) => h("option", { value: String(i), text: name })));
      const mine = TH.profile && TH.profile.get().district;
      if (mine && d.districts.includes(mine)) dSel.value = String(d.districts.indexOf(mine));
      draw();
    }).catch(() => { count.textContent = t("loadError"); });
    dSel.addEventListener("change", draw);
    q.addEventListener("input", draw);
    return [
      h("p", { class: "lead", text: t("buyLead"), "data-pair": TH.pairT("buyLead") }),
      dSel, h("label", { class: "search v3", style: "margin-top:8px" }, I("search", 18), q),
      count, list,
      sourceFooter([sourceById("vendors")], vendorsData && vendorsData.source.sourceModified ? t("dataVersion", { v: vendorsData.source.sourceModified.slice(0, 10) }) : null),
    ];
  }

  // ---------------------------------------------------------------- map
  const stopFits = (s, cat) => cat !== "food" || !(s.note && s.note.noFood);
  const dropFits = (d, cat) => cat === "all" ? true : cat === "special" ? false : d.accepts.includes(cat);
  function stopRow(s, opts) {
    const v = visitsOf(s)[0];
    const today = SCH.comesToday(v);
    const flags = [];
    if (s.note && s.note.noFood) flags.push(t("stopNoFoodShort"));
    if (s.note && s.note.confirm) flags.push(t("needsCheck"));
    const el = h("button", { class: `stop${opts.selected ? " stop-selected" : ""}${v && !today ? " stop-later" : ""}`, type: "button", "data-id": s.id, onclick: () => opts.onSelect(s) },
      h("div", { class: "stop-time" }, h("b", { text: fmtTime(s.arrive) }), h("span", { text: v ? (today ? t("arrive") : t("dayShort", { d: t("days")[SCH.taipeiParts(v.arriveMs).day] })) : "—" })),
      h("div", { class: "stop-body" },
        h("div", { class: "stop-addr", text: s.address.replace(/^臺北市/, "") }),
        h("div", { class: "stop-meta", text: [opts.dist != null ? t("straight", { m: Math.round(opts.dist) }) : null, `${s.district}${s.village}`, `${s.route} ${s.trip}`, flags.join(" ")].filter(Boolean).join(" · ") })),
      chevron());
    return el;
  }
  function dropRow(d, opts) {
    const open = SCH.isOpen(d.hours);
    return h("button", { class: `stop drop${opts.selected ? " stop-selected" : ""}`, type: "button", "data-id": d.id, onclick: () => opts.onSelect(d) },
      h("div", { class: "stop-time" }, h("b", { "aria-hidden": "true" }, I("recycle", 22)), h("span", { text: d.confirm ? "?" : open ? t("dropOpen") : t("dropClosed") })),
      h("div", { class: "stop-body" },
        h("div", { class: "stop-addr", text: `${t("dropTitle")} · ${d.squad}` }),
        h("div", { class: "stop-meta", text: [opts.dist != null ? t("straight", { m: Math.round(opts.dist) }) : null, d.address.replace(/^臺北市/, "")].filter(Boolean).join(" · ") })),
      chevron());
  }

  // ---------------------------------------------------------------- stop detail
  function viewStop(id) {
    setHeader(t("stopTitle"), true);
    const out = h("div");
    Promise.all([loadStops(), loadFavs().catch(() => null)]).then(() => {
      const s = stopsData.byId.get(id);
      if (!s) {
        fill(out, notice(t("stopGone"), "notice-warn"), h("div", { class: "actions" }, btn("btn-primary", t("stopGoneAction"), () => go("favorites"))));
        return;
      }
      const visits = visitsOf(s, { count: 3 });
      const fromNote = s.note && Array.isArray(s.note.days);
      const days = SCH.serviceDays(s, stopsData.generalDays);
      const saveBtn = btn(isFav(s.id) ? "btn-secondary" : "btn-primary", isFav(s.id) ? t("saved") : t("save"), async () => {
        saveBtn.disabled = true;
        try {
          await favOp(isFav(s.id) ? "remove" : "save", { stopId: s.id });
          saveBtn.textContent = isFav(s.id) ? t("saved") : t("save");
          saveBtn.className = "btn " + (isFav(s.id) ? "btn-secondary" : "btn-primary");
        } catch (_) { /* keep state */ }
        saveBtn.disabled = false;
      });
      fill(out,
        h("section", { class: "card" },
          h("h2", { class: "h2", text: s.address.replace(/^臺北市/, "") }),
          h("p", { class: "caption", text: `${s.district}${s.village} · ${t("stopRoute", { route: s.route, trip: s.trip })}` }),
          s.note && s.note.dup ? h("p", { class: "caption", text: `${t("stopDup")} (#${s.note.dup})` }) : null,
          lastPosition ? h("p", { class: "caption", text: t("straight", { m: Math.round(haversine(lastPosition, s)) }) }) : null),
        section(t("scheduled"),
          h("p", {}, h("strong", { class: "big-time", text: `${fmtTime(s.arrive)} – ${fmtTime(s.leave)}` }), s.arrive >= 1440 ? h("span", { class: "caption", text: " (+1)" }) : null),
          h("p", {}, h("strong", { text: t("stopDays") + colon() }), dayList(days)),
          h("p", { class: "caption", text: fromNote ? t("stopDaysNote") : t("stopDaysGeneral") }),
          h("p", {}, h("strong", { text: t("stopNext") + colon() })),
          visits.length ? h("ul", { class: "visit-list" }, visits.map(v => h("li", { text: `${fmtWhen(v.arriveMs)} – ${fmtTime(s.leave)}${v.exception ? " · " + L(v.exception.title) : ""}` }))) : h("p", { class: "muted", text: t("stopNone") })),
        s.note && (s.note.note || s.note.noFood || s.note.confirm) ? section(t("stopNote"),
          s.note.note ? h("p", { text: s.note.note }) : null,
          s.note.noFood ? notice(t("stopNoFood"), "notice-warn") : null,
          s.note.confirm ? notice(t("stopConfirm"), "notice-warn") : null) : null,
        h("div", { class: "actions" }, saveBtn,
          btn("btn-secondary", t("remind"), () => go("remind/" + s.id)),
          needsNet(btn("btn-ghost", t("openMap"), () => openMap(s)))),
        h("p", { class: "caption", text: t("scheduleNote") }),
        sourceFooter([sourceById("truck")], t("dataVersion", { v: stopsData.version })));
    }).catch(() => fill(out, h("p", { class: "empty", text: t("loadError") })));
    return out;
  }

  function viewDrop(id) {
    setHeader(t("dropTitle"), true);
    const out = h("div");
    loadDrops().then(dd => {
      const d = dd.points.find(p => p.id === id);
      if (!d) { fill(out, notice(t("stopGone"), "notice-warn")); return; }
      const { day } = taipeiNow();
      const catsTxt = d.accepts.map(c => t("cat_" + c)).join(t("listSep"));
      fill(out,
        h("section", { class: "card" },
          h("h2", { class: "h2", text: `${d.district} ${d.squad}` }),
          h("p", { text: d.address }),
          d.confirm ? null : h("p", {}, h("strong", { text: SCH.isOpen(d.hours) ? t("dropOpen") : t("dropClosed") }))),
        section(t("dropHours"),
          d.confirm ? notice(t("dropConfirm"), "notice-warn") : h("table", { class: "hours" }, h("tbody", {}, [1, 2, 3, 4, 5, 6, 0].map(k => h("tr", { class: k === day ? "today" : "" },
            h("th", { scope: "row", text: t("daysLong")[k] }),
            h("td", { text: (d.hours[String(k)] || []).map(([a, b]) => `${fmtTime(a)}–${fmtTime(b)}`).join(t("listSep")) || t("closedDay") }))))),
          d.warn ? notice(d.warn, "notice-warn") : null,
          h("p", { class: "caption", text: `${t("stopNote")}${colon()}${d.note}` })),
        section(t("dropAccepts"), h("p", {}, catsTxt, d.acceptsBasis === "title" ? h("span", { class: "caption", text: " " + t("dropAcceptsTitle") }) : null)),
        h("div", { class: "actions" },
          d.phone ? btn("btn-primary", t("callPoint") + " " + d.phone, () => dial(d.phone)) : null,
          needsNet(btn("btn-secondary", t("openMap"), () => openMap(d)))),
        sourceFooter([sourceById("dropoffs"), sourceById("dropoffpage")], dd.source.sourceModified ? t("dataVersion", { v: dd.source.sourceModified.slice(0, 10) }) : null));
    }).catch(() => fill(out, h("p", { class: "empty", text: t("loadError") })));
    return out;
  }

  // ---------------------------------------------------------------- reminder editor
  function viewRemind(stopId, reminderId) {
    setHeader(t("remTitle"), true);
    const out = h("div");
    if (!bridge()) {
      fill(out, notice(t("remNeedsApp")), h("div", { class: "actions" }, btn("btn-secondary", t("back"), () => history.back())));
      return out;
    }
    Promise.all([loadStops(), loadFavs(true)]).then(([, fs]) => {
      const s = stopsData.byId.get(stopId);
      if (!s) { fill(out, notice(t("remInvalid"), "notice-warn"), btn("btn-primary", t("stopGoneAction"), () => go("favorites"))); return; }
      const existing = reminderId ? fs.reminders.find(r => r.reminderId === reminderId) : null;
      const valid = SCH.serviceDays(s, stopsData.generalDays);
      const firstVisit = visitsOf(s)[0];
      const st = {
        weekday: existing ? existing.weekday : (firstVisit ? firstVisit.day : valid[0]),
        leadMinutes: existing ? existing.leadMinutes : 10,
        frequency: existing ? existing.frequency : "weekly",
        enabled: existing ? existing.enabled : true,
      };
      const msg = h("div", { role: "status" });
      const preview = h("div", { "aria-live": "polite" });
      const chipRow = (opts, get, set) => {
        const g = h("div", { class: "chips", role: "group" });
        opts.forEach(([v, label]) => {
          const b = h("button", { class: "chip", type: "button", "aria-pressed": String(get() === v), text: label });
          b.addEventListener("click", () => { set(v); g.querySelectorAll(".chip").forEach(x => x.setAttribute("aria-pressed", String(x === b))); preview.replaceChildren(); });
          g.append(b);
        });
        return g;
      };
      const custom = h("input", { type: "number", min: "1", max: "120", inputmode: "numeric", class: "num", "aria-label": t("remCustomHint"), placeholder: t("remCustomHint"),
        value: [5, 10, 15, 30].includes(st.leadMinutes) ? "" : String(st.leadMinutes) });
      const leadChips = chipRow([[5, t("remMinutes", { n: 5 })], [10, t("remMinutes", { n: 10 })], [15, t("remMinutes", { n: 15 })], [30, t("remMinutes", { n: 30 })]],
        () => st.leadMinutes, v => { st.leadMinutes = v; custom.value = ""; });
      custom.addEventListener("input", () => {
        const n = Math.round(Number(custom.value));
        if (n >= 1 && n <= 120) { st.leadMinutes = n; leadChips.querySelectorAll(".chip").forEach(x => x.setAttribute("aria-pressed", "false")); }
        preview.replaceChildren();
      });
      const enabled = h("input", { type: "checkbox", checked: st.enabled });
      enabled.addEventListener("change", () => { st.enabled = enabled.checked; });
      const payload = () => ({ reminderId: existing ? existing.reminderId : undefined, stopId: s.id, weekday: st.weekday, leadMinutes: st.leadMinutes, frequency: st.frequency, enabled: st.enabled, lang });

      function showStatus(r) {
        const status = r.reminder && r.reminder.status ? r.reminder.status : r.status;
        if (!status) return;
        const parts = [];
        if (status.state === "scheduled") parts.push(notice(t("remSavedOk", { n: status.count || 0 }), "notice-ok"));
        if (status.state === "partial") parts.push(notice(t("remPartial", { n: status.count || 0 }), "notice-warn"));
        if (status.state === "denied") parts.push(notice(t("remDenied"), "notice-warn"));
        if (status.state === "disabled") parts.push(notice(t("remDisabled")));
        if (status.state === "invalid") parts.push(notice(t("remInvalid"), "notice-warn"));
        if (status.until) parts.push(h("p", { class: "caption", text: t("remScheduledUntil", { date: fmtDate(status.until.slice(0, 10)) }) }));
        fill(msg, parts);
        if (status.occurrences) showOccurrences(status.occurrences);
      }
      function showOccurrences(list) {
        fill(preview, h("table", { class: "hours" },
          h("thead", {}, h("tr", {}, h("th", { text: t("remCollection") }), h("th", { text: t("remNotify") }))),
          h("tbody", {}, list.slice(0, 8).map(o => h("tr", { class: o.skipped ? "muted" : "" },
            h("td", { text: fmtWhen(Date.parse(o.collection)) }),
            h("td", { text: o.skipped ? t("remSkipped") : fmtWhen(Date.parse(o.notify)) }))))));
      }
      async function send(isPreview, button) {
        button.disabled = true;
        if (!isPreview) fill(msg, h("p", { class: "muted", text: t("remBusy") }));
        try {
          const r = await askApp("trash_reminder_save", { reminder: payload(), preview: isPreview }, 30000);
          if (!r || !r.ok) throw new Error((r && r.error) || "failed");
          if (isPreview) showOccurrences(r.preview.occurrences || []);
          else {
            applyFavReply(r);
            if (!existing && r.reminder) history.replaceState({ d: depth }, "", `#/remind/${s.id}/${r.reminder.reminderId}`);
            showStatus(r);
          }
        } catch (e) {
          fill(msg, notice(t("remError") + (e && e.message && e.message !== "failed" ? ` (${e.message})` : ""), "notice-warn"));
        } finally { button.disabled = false; }
      }
      const previewBtn = btn("btn-secondary", t("remPreview"), () => send(true, previewBtn));
      const saveBtn = btn("btn-primary", t("remSave"), () => send(false, saveBtn));
      // The 1-minute test notification is on the 什麼時候丟 page (when.js), one step earlier.
      fill(out,
        h("section", { class: "card" },
          h("strong", { text: s.address.replace(/^臺北市/, "") }),
          h("div", { class: "caption", text: `${t("stopRoute", { route: s.route, trip: s.trip })} · ${t("scheduled")} ${fmtTime(s.arrive)}` })),
        section(t("remDay"), chipRow(valid.map(d => [d, t("daysLong")[d]]), () => st.weekday, v => { st.weekday = v; })),
        section(t("remLead"), leadChips, h("label", { class: "custom-lead" }, t("remCustom") + " ", custom, " " + t("remCustomHint"))),
        section(t("remFreq"), chipRow([["once", t("freq_once")], ["weekly", t("freq_weekly")], ["biweekly", t("freq_biweekly")]], () => st.frequency, v => { st.frequency = v; })),
        h("label", { class: "toggle big" }, enabled, t("remOn")),
        h("div", { class: "actions row" }, previewBtn, saveBtn),
        msg, preview,
        existing ? btn("btn-ghost danger", t("remDelete"), async () => {
          if (!(await confirmDialog(t("remDelete") + "?", t("remDelete")))) return;
          try { applyFavReply(await askApp("trash_reminder_cancel", { reminderId: existing.reminderId }, 30000)); go("favorites", { replace: true }); }
          catch (_) { fill(msg, notice(t("remError"), "notice-warn")); }
        }) : null,
        h("p", { class: "caption", text: t("remNote") }),
        fs.platform === "android" ? h("p", { class: "caption", text: t("remAndroid") }) : null);
      if (existing && existing.status) showStatus({ status: existing.status });
    }).catch(() => fill(out, h("p", { class: "empty", text: t("loadError") }), btn("btn-primary", t("retry"), render)));
    return out;
  }

  // ---------------------------------------------------------------- shared with v3.js / v3map.js
  const navListeners = [];
  const TH = window.TH = {
    h, t, L, go, fill, btn, SCH, views: {},
    rules: () => rules, whenRulesReady: () => loadRules(), lang: () => lang, setLang, depth: () => depth,
    pairLang, setPair, pairT, pairOf, tIn, LIn, inLang,
    loadStops, loadDrops, loadVendors, vendorsData: () => vendorsData, loadFavs, favOp, applyFavReply, favState: () => favState, isFav,
    stopsData: () => stopsData, dropData: () => dropData, visitsOf, haversine, itemById, sourceById,
    lastPosition: () => lastPosition, setLastPosition: p => { lastPosition = p; }, getLocation,
    bridge, askApp, dial, openExternal, extLink, openMap, needsNet, loadPlaces, placesData: () => placesData, placeLayerOf, confirmDialog, notice, verifyBox, componentCard, bookingPanel,
    sourceFooter, setHeader, matches, stopFits, dropFits, stopRow, fmtTime, fmtWhen, mapState,
    onNavigate: fn => navListeners.push(fn),
  };

  // ---------------------------------------------------------------- router
  const TABBED = new Set(["", "list", "map", "nearby"]); // top-level pages: the bottom bar
  async function render() {
    navListeners.splice(0).forEach(fn => { try { fn(); } catch (_) { /* ignore */ } });
    document.documentElement.lang = lang === "zh" ? "zh-Hant-TW" : lang;
    document.documentElement.dataset.lang = lang;
    try { await loadRules(); }
    catch (_) {
      setHeader(t("appTitle"));
      fill(app, h("p", { class: "empty", text: t("loadError") }), btn("btn-primary", t("retry"), render, { style: "width:100%" }));
      return;
    }
    const V = TH.views;
    const [view, a, b] = location.hash.replace(/^#\/?/, "").split("?")[0].split("/");
    if (view !== "map" && view !== "nearby" && TH.dropMap) TH.dropMap();
    if (view !== "scan" && TH.resetScan) TH.resetScan();
    const content =
      view === "scan" ? V.viewScan() :
      view === "pick" || view === "sort" ? V.viewPick() :
      view === "item" ? V.viewItem(a, b) :
      view === "bags" ? viewBags() :
      view === "buy" ? viewBuy() :
      view === "map" || view === "nearby" ? V.viewMap(a) :
      view === "stop" ? viewStop(decodeURIComponent(a || "")) :
      view === "drop" ? viewDrop(decodeURIComponent(a || "")) :
      view === "favorites" ? V.viewFavorites() :
      view === "remind" ? viewRemind(decodeURIComponent(a || ""), b ? decodeURIComponent(b) : null) :
      TH.routes && TH.routes[view] ? TH.routes[view](a, b) :
      V.viewHome();
    const tabbed = TABBED.has(view || "");
    document.body.classList.toggle("has-tabbar", tabbed);
    document.body.classList.toggle("dark", view === "scan");
    document.body.classList.toggle("full", view === "map" || view === "nearby" || view === "scan");
    const TAB_OF = { "": "home", list: "home", map: "map", nearby: "map" };
    fill(app, content, tabbed ? V.tabBar(TAB_OF[view || ""]) : null);
    devLog("render", { view: view || "home", ms: Math.round(performance.now() - T0) });
    window.scrollTo(0, 0);
  }

  backBtn.addEventListener("click", () => {
    if (depth > 0) history.back();
    else go(parentOf(location.hash), { replace: true });
  });
  window.addEventListener("popstate", (e) => { depth = (e.state && e.state.d) || 0; render(); });

  function setLang(code) { lang = code; store.set("th.lang", code); render(); }

  // v3.js and v3map.js load after this file; render once every script is in.
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", render);
  else render();
})();
