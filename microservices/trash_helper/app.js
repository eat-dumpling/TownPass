// SPDX-License-Identifier: AGPL-3.0-or-later
// Taipei Trash Helper — TownPass microservice. Plain JS, no build step.
// All text is rendered with textContent (never innerHTML) so data cannot inject markup.
"use strict";

(function () {
  const STR = window.TH_STRINGS;
  const LANGS = window.TH_LANGS;
  const app = document.getElementById("app");
  const titleEl = document.getElementById("page-title");
  const backBtn = document.getElementById("back");

  // ---------------------------------------------------------------- dev log
  // Only on a plain-http dev server (python3 server.py). Sends UI events, never location or personal data.
  const T0 = performance.now();
  const devLog = location.protocol === "http:" ? (ev, extra) => {
    try {
      const body = JSON.stringify({ t: Math.round(performance.now() - T0), ev, hash: location.hash, hist: history.length, ...extra });
      fetch("/api/log", { method: "POST", body, keepalive: true }).catch(() => {});
    } catch (_) { /* ignore */ }
  } : () => {};
  devLog("boot", { ua: navigator.userAgent.slice(0, 80), bridge: !!window.flutterObject });
  window.addEventListener("error", e => devLog("error", { msg: String(e.message), line: e.lineno }));
  window.addEventListener("unhandledrejection", e => devLog("rejection", { msg: String(e.reason) }));
  ["pointerdown", "click"].forEach(type => document.addEventListener(type, e => {
    const el = e.target.closest("button, a, select, input") || e.target;
    devLog(type, { el: el.tagName + (el.id ? "#" + el.id : "") + "." + (el.className || "").toString().split(" ")[0], txt: (el.textContent || "").trim().slice(0, 20) });
  }, true));
  window.addEventListener("popstate", () => devLog("popstate"));
  window.addEventListener("pageshow", e => devLog("pageshow", { persisted: e.persisted }));

  // ---------------------------------------------------------------- state
  const store = {
    get(k) { try { return localStorage.getItem(k); } catch (_) { return null; } },
    set(k, v) { try { localStorage.setItem(k, v); } catch (_) { /* private mode */ } },
  };
  let lang = store.get("th.lang") || ((navigator.language || "").toLowerCase().startsWith("zh") ? "zh" : "en");
  if (!LANGS.some(l => l.code === lang && l.ready)) lang = "en";
  let rules = null;
  let stopsData = null;
  let lastPosition = null;
  let sortFilter = "all";
  let sortQuery = "";

  // ---------------------------------------------------------------- helpers
  function t(key, vars) {
    let s = (STR[lang] && STR[lang][key]) ?? STR.en[key] ?? key;
    if (vars && typeof s === "string") for (const [k, v] of Object.entries(vars)) s = s.replace(`{${k}}`, v);
    return s;
  }
  // Pick a localized value from {en, zh, vi, id}; fall back to English.
  function L(obj) { return obj ? (obj[lang] ?? obj.en ?? "") : ""; }

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
  const emoji = (e, cls) => h("span", { class: cls, "aria-hidden": "true", text: e });
  const chevron = () => {
    const s = document.createElementNS("http://www.w3.org/2000/svg", "svg");
    s.setAttribute("viewBox", "0 0 24 24"); s.setAttribute("width", "22"); s.setAttribute("height", "22");
    s.setAttribute("class", "chev"); s.setAttribute("aria-hidden", "true");
    const p = document.createElementNS("http://www.w3.org/2000/svg", "path");
    p.setAttribute("d", "M9 5l7 7-7 7"); p.setAttribute("fill", "none"); p.setAttribute("stroke", "currentColor");
    p.setAttribute("stroke-width", "2"); p.setAttribute("stroke-linecap", "round"); p.setAttribute("stroke-linejoin", "round");
    s.append(p); return s;
  };
  // replaceChildren() does not flatten arrays or skip nulls; this does.
  const fill = (el, ...kids) => el.replaceChildren(...kids.flat(Infinity).filter(k => k != null && k !== false));
  // In-app history: every entry carries its depth, so Back knows whether there is a page of ours to return to.
  // pushState does not fire hashchange, and only popstate re-renders, so one navigation = one render.
  let depth = (history.state && history.state.d) || 0;
  if (!history.state) history.replaceState({ d: 0 }, "", location.href);
  function go(path, opts) {
    const url = "#/" + path;
    if (opts && opts.replace) history.replaceState({ d: depth }, "", url);
    else { depth += 1; history.pushState({ d: depth }, "", url); }
    render();
  }
  // Where the in-page Back goes when there is no earlier entry (e.g. opened on a deep link).
  function parentOf(hash) {
    const [view, a] = hash.replace(/^#\/?/, "").split("/");
    if (view === "item") return a && hash.split("/").length > 3 ? "item/" + a : "sort";
    if (view === "today" && a) return "item/" + a;
    return "";
  }

  // Today's weekday in Taipei, regardless of the phone's time zone.
  function taipeiNow() {
    const parts = new Intl.DateTimeFormat("en-US", {
      timeZone: "Asia/Taipei", weekday: "short", hour: "2-digit", minute: "2-digit", hourCycle: "h23",
    }).formatToParts(new Date());
    const get = type => parts.find(p => p.type === type)?.value;
    const day = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].indexOf(get("weekday"));
    return { day, minutes: Number(get("hour")) * 60 + Number(get("minute")) };
  }
  function nextDayFrom(days, from) {
    for (let i = 1; i <= 7; i++) { const d = (from + i) % 7; if (days.includes(d)) return d; }
    return null;
  }
  const dayList = days => days.map(d => t("days")[d]).join(t("listSep"));
  const fmtTime = min => {
    const m = min % 1440;
    return `${String(Math.floor(m / 60)).padStart(2, "0")}:${String(m % 60).padStart(2, "0")}`;
  };

  // ---------------------------------------------------------------- TownPass bridge
  // window.flutterObject is injected by TownPass's WebView; it is absent in a normal browser.
  function bridge() {
    const b = window.flutterObject;
    return b && typeof b.postMessage === "function" ? b : null;
  }
  function askApp(name, data, timeoutMs = 15000) {
    return new Promise((resolve, reject) => {
      const b = bridge();
      if (!b) return reject(new Error("no-bridge"));
      let timer;
      const onMsg = (event) => {
        let msg;
        try { msg = JSON.parse(event.data); } catch (_) { return; }
        if (!msg || msg.name !== name) return;
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
      b.postMessage(JSON.stringify({ name, data }));
    });
  }
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
  function openMap(stop) {
    // OpenStreetMap: open-source map, as the competition rules require.
    const url = `https://www.openstreetmap.org/?mlat=${stop.lat}&mlon=${stop.lng}#map=18/${stop.lat}/${stop.lng}`;
    if (bridge()) askApp("launch_map", url).catch(() => {});
    else window.open(url, "_blank", "noopener");
  }

  // ---------------------------------------------------------------- data
  async function loadRules() {
    if (!rules) rules = await (await fetch("data/rules.json", { cache: "no-cache" })).json();
    return rules;
  }
  async function loadStops() {
    if (!stopsData) {
      const raw = await (await fetch("data/stops.json")).json();
      stopsData = {
        source: raw.source,
        districts: raw.districts,
        stops: raw.stops.map(s => ({
          district: raw.districts[s[0]], village: s[1], address: s[2],
          arrive: s[3], leave: s[4], lat: s[5], lng: s[6], route: s[7], trip: s[8],
        })),
      };
    }
    return stopsData;
  }
  const itemById = id => rules.items.find(i => i.id === id);
  const groupOf = item => rules.groups[item.group];
  const catOf = item => groupOf(item).cat;

  function haversine(a, b) {
    const R = 6371000, rad = x => x * Math.PI / 180;
    const dLat = rad(b.lat - a.lat), dLng = rad(b.lng - a.lng);
    const s = Math.sin(dLat / 2) ** 2 + Math.cos(rad(a.lat)) * Math.cos(rad(b.lat)) * Math.sin(dLng / 2) ** 2;
    return 2 * R * Math.asin(Math.sqrt(s));
  }

  // ---------------------------------------------------------------- shared pieces
  function setHeader(title, showBack) {
    titleEl.textContent = title;
    // Inside TownPass the native app bar already has a back arrow; one back button is enough.
    backBtn.hidden = !showBack || !!bridge();
    backBtn.setAttribute("aria-label", t("back"));
    document.title = title;
  }
  function todayStrip() {
    const { day } = taipeiNow();
    const off = !rules.groups.general.days.includes(day);
    return h("div", { class: "today-strip", role: "status" },
      h("span", { class: "dot", style: `background:${off ? "var(--gray-400)" : "var(--green-600)"}` }),
      h("div", {},
        h("strong", { text: t("todayIs", { day: t("daysLong")[day] }) }),
        h("div", { class: "caption", text: off ? t("todayOff") : t("todayOn") })));
  }
  function sourceFooter(list) {
    return h("p", { class: "source" }, `${t("source")}: `,
      list.map((s, i) => [i ? " · " : "", h("a", { href: s.url, target: "_blank", rel: "noopener", text: s.name })]));
  }
  function wizard({ steps, index, onIndex, finish }) {
    const n = steps.length;
    const s = steps[index];
    return [
      h("div", { class: "progress", "aria-hidden": "true" }, steps.map((_, i) => h("span", { class: i <= index ? "on" : "" }))),
      h("section", { class: "step-card", "aria-live": "polite" },
        h("div", { class: "step-count", text: t("stepOf", { i: index + 1, n }) }),
        emoji(s.emoji, "step-emoji"),
        h("h2", { class: "step-title", text: L(s.title) }),
        s.text ? h("p", { class: "step-text", text: L(s.text) }) : null,
        s.tip ? h("div", { class: "step-tip", text: "💡 " + L(s.tip) }) : null,
        s.warn ? h("div", { class: "step-warn", text: "⚠️ " + L(s.warn) }) : null),
      h("div", { class: "actions row" },
        h("button", { class: "btn btn-secondary", type: "button", disabled: index === 0, onclick: () => onIndex(index - 1), text: t("prev") }),
        index < n - 1
          ? h("button", { class: "btn btn-primary", type: "button", onclick: () => onIndex(index + 1), text: t("next") })
          : finish),
    ];
  }

  // ---------------------------------------------------------------- views
  function viewHome() {
    setHeader(t("appTitle"), false);
    const task = (route, e, bg, title, desc) => h("li", {},
      h("button", { class: "task", type: "button", onclick: () => go(route) },
        h("span", { class: "task-icon", style: `background:${bg}`, "aria-hidden": "true", text: e }),
        h("span", { class: "task-body" }, h("span", { class: "task-title", text: title }), h("span", { class: "task-desc", text: desc })),
        chevron()));
    return [
      h("h2", { class: "h1", text: t("homeHello") }),
      h("p", { class: "lead", text: t("homeLead") }),
      todayStrip(),
      h("ul", { class: "task-list" },
        task("sort", "🔍", "var(--primary-100)", t("taskSortTitle"), t("taskSortDesc")),
        task("today", "📅", "var(--secondary-100)", t("taskTodayTitle"), t("taskTodayDesc")),
        task("guide/0", "🚛", "var(--green-50)", t("taskGuideTitle"), t("taskGuideDesc")),
        task("nearby", "📍", "var(--orange-50)", t("taskNearbyTitle"), t("taskNearbyDesc"))),
      sourceFooter(rules.sources),
    ];
  }

  function matches(item, q) {
    if (!q) return true;
    const hay = [...Object.values(item.name), ...(item.keywords || [])].join(" ").toLowerCase();
    return q.toLowerCase().split(/\s+/).every(w => hay.includes(w));
  }
  function viewSort() {
    setHeader(t("sortTitle"), true);
    const grid = h("div", { class: "grid", role: "list" });
    const empty = h("p", { class: "empty", hidden: true, text: t("noResult") });
    const draw = () => {
      const list = rules.items.filter(i => (sortFilter === "all" || catOf(i) === sortFilter) && matches(i, sortQuery));
      grid.replaceChildren(...list.map(i => h("button", {
        class: `tile cat-${catOf(i)}`, type: "button", role: "listitem",
        "aria-label": `${L(i.name)} — ${t("cat_" + catOf(i))}`, onclick: () => go("item/" + i.id),
      }, emoji(i.emoji, "tile-emoji"), h("span", { class: "tile-name", text: L(i.name) }), h("span", { class: "tile-bar" }))));
      empty.hidden = list.length > 0;
    };
    const input = h("input", { type: "search", value: sortQuery, placeholder: t("searchPlaceholder"), "aria-label": t("searchPlaceholder"), enterkeyhint: "search" });
    input.addEventListener("input", () => { sortQuery = input.value.trim(); draw(); });
    const cats = ["all", "general", "recycle", "food", "special", "bulky"];
    const chips = h("div", { class: "chips", role: "group" }, cats.map(c => {
      const b = h("button", { class: "chip", type: "button", "aria-pressed": String(sortFilter === c), text: c === "all" ? t("all") : t("cat_" + c) });
      b.addEventListener("click", () => {
        sortFilter = c;
        chips.querySelectorAll(".chip").forEach(x => x.setAttribute("aria-pressed", String(x === b)));
        draw();
      });
      return b;
    }));
    draw();
    return [
      h("label", { class: "search" }, emoji("🔍"), input),
      chips, grid, empty,
      h("p", { class: "caption", style: "margin-top:16px", text: t("unsure") }),
    ];
  }

  function itemHero(item) {
    const cat = catOf(item), cdef = rules.categories[cat];
    return h("section", { class: `result-hero cat-${cat}` },
      emoji(item.emoji, "result-emoji"),
      h("div", { class: "result-item", text: L(item.name) }),
      h("div", { class: "badge" }, emoji(cdef.emoji), t("cat_" + cat)),
      rules.groups[item.group].label ? h("div", { class: "where", text: L(rules.groups[item.group].label) }) : null,
      h("div", { class: "where" }, h("strong", { text: t("goesTo") + (lang === "zh" ? "：" : ": ") }), L(cdef.where)));
  }
  function viewItem(id, stepStr) {
    const item = itemById(id);
    if (!item) return viewSort();
    setHeader(t("resultTitle"), true);
    const steps = item.steps || [];
    if (stepStr == null) {
      return [
        itemHero(item),
        item.warn ? h("div", { class: "step-warn", text: "⚠️ " + L(item.warn) }) : null,
        h("div", { class: "actions" },
          steps.length
            ? h("button", { class: "btn btn-primary", type: "button", onclick: () => go(`item/${id}/0`), text: t("prepSteps", { n: steps.length }) })
            : h("p", { class: "muted", style: "text-align:center", text: t("noPrep") }),
          h("button", { class: steps.length ? "btn btn-secondary" : "btn btn-primary", type: "button", onclick: () => go("today/" + id), text: t("canToday") })),
        sourceFooter(rules.sources.filter(s => s.core)),
      ];
    }
    const index = Math.max(0, Math.min(steps.length - 1, Number(stepStr) || 0));
    return [
      h("div", { class: "caption", style: "text-align:center", text: `${item.emoji} ${L(item.name)} · ${t("cat_" + catOf(item))}` }),
      wizard({
        steps, index,
        onIndex: i => go(`item/${id}/${i}`, { replace: true }),
        finish: h("button", { class: "btn btn-primary", type: "button", onclick: () => go("today/" + id), text: t("canToday") }),
      }),
    ];
  }

  function verdictRow(kind, icon, label, title, text) {
    return h("div", { class: `verdict ${kind}` },
      h("span", { class: "verdict-icon", "aria-hidden": "true", text: icon }),
      h("div", {},
        h("div", { class: "verdict-label", text: label }),
        h("div", { class: "verdict-title", text: title }),
        text ? h("div", { class: "verdict-text", text }) : null));
  }
  function viewToday(id) {
    setHeader(t("todayTitle"), true);
    const { day } = taipeiNow();
    const item = id ? itemById(id) : null;
    const generalDays = rules.groups.general.days;
    const week = h("div", { class: "week", "aria-label": dayList(generalDays) },
      [1, 2, 3, 4, 5, 6, 0].map(d => h("div", {
        class: `week-day${generalDays.includes(d) ? "" : " off"}${d === day ? " today" : ""}`,
        "aria-current": d === day ? "date" : null,
      }, h("span", { text: t("days")[d] }), h("b", { text: generalDays.includes(d) ? "●" : "—" }))));

    const groupVerdict = (gkey, labelText) => {
      const g = rules.groups[gkey];
      const yes = g.days.includes(day);
      const nd = nextDayFrom(g.days, day);
      if (g.booking) return verdictRow("ask", "☎", labelText, t("bookFirst"), L(g.note));
      return verdictRow(yes ? "yes" : "no", yes ? "✓" : "✕", labelText,
        yes ? t("todayYes") : t("todayNo"),
        yes ? t("collectedOn", { days: dayList(g.days) }) : t("nextDay", { day: t("daysLong")[nd] }));
    };

    const out = [
      h("div", { class: "day-head" }, h("h2", { class: "h1", text: t("daysLong")[day] })),
      week,
    ];
    if (item) {
      out.push(h("div", { class: "caption", text: `${item.emoji} ${L(item.name)}` }), groupVerdict(item.group, t("cat_" + catOf(item))));
      if (L(item.handover)) out.push(h("div", { class: "notice", text: L(item.handover) }));
      out.push(h("h3", { class: "section-title", text: t("allToday") }));
    }
    for (const [gkey, g] of Object.entries(rules.groups)) {
      if (item && gkey === item.group) continue;
      out.push(groupVerdict(gkey, g.label ? `${t("cat_" + g.cat)} · ${L(g.label)}` : t("cat_" + g.cat)));
    }
    out.push(h("div", { class: "actions" },
      h("button", { class: "btn btn-primary", type: "button", onclick: () => go("nearby"), text: "📍 " + t("findTruck") })));
    out.push(sourceFooter(rules.sources.filter(s => s.core)));
    return out;
  }

  function viewGuide(stepStr) {
    setHeader(t("guideTitle"), true);
    const steps = rules.guide;
    const index = Math.max(0, Math.min(steps.length - 1, Number(stepStr) || 0));
    return [
      wizard({
        steps, index,
        onIndex: i => go("guide/" + i, { replace: true }),
        finish: h("button", { class: "btn btn-primary", type: "button", onclick: () => go("nearby"), text: "📍 " + t("findTruck") }),
      }),
      sourceFooter(rules.sources.filter(s => s.core)),
    ];
  }

  function stopCard(s, nowMin, today, dist) {
    const passed = today && s.leave < nowMin;
    return h("div", { class: passed ? "stop stop-passed" : "stop" },
      h("div", { class: "stop-time" }, h("b", { text: fmtTime(s.arrive) }), h("span", { text: passed ? t("passed") : t("arrive") })),
      h("div", { class: "stop-body" },
        h("div", { class: "stop-addr", text: s.address.replace(/^臺北市/, "") }),
        h("div", { class: "stop-meta", text: [dist != null ? t("distance", { m: Math.round(dist) }) : null, `${s.district}${s.village}`, `${fmtTime(s.arrive)}–${fmtTime(s.leave)}`].filter(Boolean).join(" · ") })),
      h("button", { class: "btn btn-ghost stop-map", type: "button", "aria-label": `${t("openMap")}: ${s.address}`, onclick: () => openMap(s), text: "🗺 " + t("openMap") }));
  }
  function viewNearby() {
    setHeader(t("nearbyTitle"), true);
    const { day, minutes } = taipeiNow();
    const runsToday = rules.groups.general.days.includes(day);
    const nd = nextDayFrom(rules.groups.general.days, day);
    const results = h("div", { "aria-live": "polite" });
    const status = h("p", { class: "muted", role: "status" });

    const showList = (title, list, withDist) => {
      fill(results,
        h("h3", { class: "section-title", text: title }),
        runsToday ? null : h("div", { class: "notice", text: t("noStopToday", { day: t("daysLong")[nd] }) }),
        list.map(x => stopCard(x.stop, minutes, runsToday, withDist ? x.dist : null)),
        h("p", { class: "caption", text: t("scheduleNote") }));
    };
    const locate = async () => {
      status.textContent = t("locating");
      results.replaceChildren();
      try {
        const [{ stops }, pos] = await Promise.all([loadStops(), getLocation()]);
        lastPosition = pos;
        const list = stops.map(stop => ({ stop, dist: haversine(pos, stop) })).sort((a, b) => a.dist - b.dist).slice(0, 5);
        status.textContent = "";
        showList(t("nearestStops"), list, true);
      } catch (_) {
        status.textContent = t("locationFailed");
      }
    };

    // Manual fallback: district → village → stops ordered by time.
    const dSel = h("select", { class: "select", "aria-label": t("district") });
    const vSel = h("select", { class: "select", "aria-label": t("village"), disabled: true, style: "margin-top:8px" });
    loadStops().then(({ districts }) => {
      fill(dSel, h("option", { value: "", text: `${t("district")}：${t("choose")}` }), districts.map(d => h("option", { value: d, text: d })));
    }).catch(() => { status.textContent = t("loadError"); });
    dSel.addEventListener("change", () => {
      const vs = [...new Set(stopsData.stops.filter(s => s.district === dSel.value).map(s => s.village))].sort();
      fill(vSel, h("option", { value: "", text: `${t("village")}：${t("choose")}` }), vs.map(v => h("option", { value: v, text: v })));
      vSel.disabled = !dSel.value;
      results.replaceChildren();
    });
    vSel.addEventListener("change", () => {
      if (!vSel.value) return;
      const list = stopsData.stops.filter(s => s.district === dSel.value && s.village === vSel.value)
        .sort((a, b) => a.arrive - b.arrive).map(stop => ({ stop }));
      showList(t("stopsIn", { area: dSel.value + vSel.value }), list, false);
    });

    if (lastPosition || bridge()) setTimeout(locate, 0);
    return [
      h("button", { class: "btn btn-primary", type: "button", style: "width:100%", onclick: locate, text: "📍 " + t("useLocation") }),
      status,
      results,
      h("h3", { class: "section-title", text: t("orPick") }),
      dSel, vSel,
      stopsData ? sourceFooter([stopsData.source]) : sourceFooter(rules.sources.filter(s => s.id === "truck")),
    ];
  }

  // ---------------------------------------------------------------- router
  async function render() {
    document.documentElement.lang = lang === "zh" ? "zh-Hant-TW" : lang;
    document.querySelectorAll(".lang-btn[data-lang]").forEach(b => b.setAttribute("aria-pressed", String(b.dataset.lang === lang)));
    try { await loadRules(); }
    catch (_) {
      setHeader(t("appTitle"), false);
      app.replaceChildren(h("p", { class: "empty", text: t("loadError") }),
        h("button", { class: "btn btn-primary", type: "button", style: "width:100%", onclick: render, text: t("retry") }));
      return;
    }
    const [view, a, b] = location.hash.replace(/^#\/?/, "").split("/");
    const content =
      view === "sort" ? viewSort() :
      view === "item" ? viewItem(a, b) :
      view === "today" ? viewToday(a) :
      view === "guide" ? viewGuide(a) :
      view === "nearby" ? viewNearby() :
      viewHome();
    fill(app, content);
    devLog("render", { view: view || "home", ms: Math.round(performance.now() - T0) });
    window.scrollTo(0, 0);
  }

  backBtn.addEventListener("click", () => {
    if (depth > 0) history.back();
    else go(parentOf(location.hash), { replace: true });
  });
  window.addEventListener("popstate", (e) => { depth = (e.state && e.state.d) || 0; render(); });

  // ---------------------------------------------------------------- language
  const dialog = document.getElementById("lang-dialog");
  function setLang(code) { lang = code; store.set("th.lang", code); render(); }
  document.querySelectorAll(".lang-btn").forEach(b => b.addEventListener("click", () => {
    if (b.dataset.lang !== "more") return setLang(b.dataset.lang);
    document.getElementById("lang-dialog-title").textContent = t("langTitle");
    document.getElementById("lang-close").textContent = t("close");
    document.getElementById("lang-list").replaceChildren(...LANGS.map(l => h("li", {},
      h("button", {
        type: "button", disabled: !l.ready, "aria-pressed": String(l.code === lang),
        onclick: () => { dialog.close(); setLang(l.code); },
      }, h("span", { text: l.label }), h("span", { class: "caption", text: l.ready ? (l.code === lang ? "✓" : "") : t("langSoon") })))));
    if (typeof dialog.showModal === "function") dialog.showModal();
  }));
  document.getElementById("lang-close").addEventListener("click", () => dialog.close());

  render();
})();
