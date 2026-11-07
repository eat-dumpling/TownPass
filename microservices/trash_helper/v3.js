// SPDX-License-Identifier: AGPL-3.0-or-later
// Trash Helper shared UI: line icons (Tabler, MIT), item art, bottom sheets, tab bar,
// camera, manual pick and the item result page. No emoji anywhere: every picture is a
// Tabler line icon, items are a category-coloured tile with a white icon (the same idea
// as the team's kids-recycle-village design).
"use strict";

(function () {
  const TH = window.TH;
  const { h, t, L, go, fill, btn, SCH } = TH;
  const ICONS = window.TH_ICONS || {};
  const SVG = "http://www.w3.org/2000/svg";
  const ALIAS = {
    grid: "layout-grid", doc: "file-text", bag: "shopping-bag", help: "help-circle", locate: "current-location", close: "x",
    chev: "chevron-right", down: "chevron-down", album: "photo", play: "player-play", up: "recycle", alert: "alert-triangle",
  };

  // ------------------------------------------------------------ icons
  function icon(name, size = 22, cls) {
    const nodes = ICONS[ALIAS[name] || name] || ICONS["help-circle"] || [];
    const s = document.createElementNS(SVG, "svg");
    for (const [k, v] of [["viewBox", "0 0 24 24"], ["width", size], ["height", size], ["fill", cls === "filled" ? "currentColor" : "none"],
      ["stroke", "currentColor"], ["stroke-width", "1.75"], ["stroke-linecap", "round"], ["stroke-linejoin", "round"], ["aria-hidden", "true"]]) s.setAttribute(k, v);
    if (cls) s.setAttribute("class", cls);
    for (const [tag, attrs] of nodes) {
      const el = document.createElementNS(SVG, tag);
      for (const [k, v] of Object.entries(attrs)) if (k !== "key") el.setAttribute(k, v);
      s.append(el);
    }
    return s;
  }
  const catOf = it => TH.rules().groups[it.group].cat;
  // Item picture: rounded tile in the category colour with a white line icon.
  function art(it, size = 48) {
    return h("span", { class: `art art-${catOf(it)}`, style: `width:${size}px;height:${size}px;border-radius:${Math.round(size * 0.28)}px`, "aria-hidden": "true" },
      icon(it.icon, Math.round(size * 0.56)));
  }
  const catArt = (cat, size = 40) => h("span", { class: `art art-${cat}`, style: `width:${size}px;height:${size}px;border-radius:${Math.round(size * 0.28)}px`, "aria-hidden": "true" },
    icon(TH.rules().categories[cat].icon, Math.round(size * 0.56)));
  Object.assign(TH, { icon, art, catArt, catOf });

  const pad2 = n => String(n).padStart(2, "0");
  const hhmm = ms => { const p = SCH.taipeiParts(ms); return `${pad2(Math.floor(p.minutes / 60))}:${pad2(p.minutes % 60)}`; };
  const shortAddr = s => s.address.replace(/^臺北市/, "").replace(s.district, "").replace(/[（(].*?[)）]/g, "");
  const walkMin = (a, b) => Math.max(1, Math.round(TH.haversine(a, b) / 75));
  const VERDICT = { recycle: "v_recycle", general: "v_general", food: "v_food", special: "v_special", bulky: "v_bulky", verify: "v_verify" };

  // ------------------------------------------------------------ bottom sheet
  function sheet(title, ...body) {
    const close = () => { wrap.classList.remove("open"); setTimeout(() => wrap.remove(), 200); };
    const wrap = h("div", { class: "sheet-wrap", role: "dialog", "aria-modal": "true", "aria-label": title },
      h("div", { class: "sheet-backdrop", onclick: close }),
      h("section", { class: "sheet" },
        h("div", { class: "sheet-handle", "aria-hidden": "true" }),
        h("div", { class: "sheet-head" }, h("h2", { text: title }), h("button", { class: "icon-round", type: "button", "aria-label": t("close"), onclick: close }, icon("x", 18))),
        h("div", { class: "sheet-body" }, body)));
    document.body.append(wrap);
    requestAnimationFrame(() => wrap.classList.add("open"));
    TH.onNavigate(close);
    return close;
  }
  TH.sheet = sheet;

  // Language picker: every language shown in its own name, so anyone can find theirs.
  function langSheet() {
    const close = sheet(t("langTitle"),
      h("div", { class: "lang-list", role: "listbox", "aria-label": t("langTitle") },
        window.TH_LANGS.filter(l => l.ready).map(l => h("button", {
          class: "lang-row" + (l.code === TH.lang() ? " on" : ""), type: "button", role: "option", lang: l.code,
          "aria-selected": l.code === TH.lang() ? "true" : "false",
          onclick: () => { close(); TH.setLang(l.code); },
        }, h("span", { class: "grow", text: l.label }), l.code === TH.lang() ? icon("check", 20) : null))),
      // Side-by-side: a second language in small type under key words (for a caregiver and the
      // Taiwanese family, or a new resident learning the Chinese words).
      h("h3", { class: "pair-title" }, icon("columns-2", 18), h("span", { text: t("pairTitle") })),
      h("div", { class: "pair-chips", role: "radiogroup", "aria-label": t("pairTitle") },
        [{ code: "", label: t("pairOff") }, ...window.TH_LANGS.filter(l => l.ready && l.code !== TH.lang())].map(l => {
          const on = (TH.pairLang() || "") === l.code;
          return h("button", { class: "va-lang" + (on ? " on" : ""), type: "button", role: "radio", "aria-checked": String(on), lang: l.code || null,
            onclick: () => { close(); TH.setPair(l.code); } }, l.label);
        })));
  }
  function langButton() {
    const cur = window.TH_LANGS.find(l => l.code === TH.lang()) || { short: "EN" };
    return h("button", { class: "lang-pill", type: "button", "aria-label": t("langTitle"), onclick: langSheet }, icon("language", 16), h("span", { text: cur.short }));
  }
  // Kids mode = 回收小里長 (same official rule table, with zhuyin and a drag-into-the-bin game).
  // In the app it is served next to 丟丟 (127.0.0.1:8791); ?from= gives it a way back here.
  // Kids mode replaces this page instead of stacking on it: a page kept for "back" keeps its
  // recognition model in memory, and the iPhone WebView then cannot load the kids' copy
  // ("[wasm] RangeError: Out of memory"). The kids page has its own arrow back here.
  function kidsUrl() {
    const c = window.TH_CONFIG || {};
    const base = c.kidsUrl ? c.kidsUrl
      : location.port === "8790" ? "http://127.0.0.1:8791/"
      : location.port === "8788" ? `${location.protocol}//${location.hostname}:5173/`
      : "https://recycle-li.web.app/";
    const back = location.href.split("#")[0] + "#/";
    return `${base}?from=${encodeURIComponent(back)}#/`;
  }
  // The kids page loads its recognition model before it first paints (about 2 s on a phone), so the
  // button shows it is opening right away; otherwise it looks dead and gets tapped again.
  function kidsButton() {
    const b = h("button", { class: "lang-pill kids-pill", type: "button", "aria-label": t("kidsMode"), onclick: () => {
      if (b.classList.contains("busy")) return;
      b.classList.add("busy"); b.setAttribute("aria-busy", "true");
      const star = b.firstChild, spin = h("span", { class: "spinner", "aria-hidden": "true" });
      star.replaceWith(spin);
      // If the page never leaves (no connection to the kids page), the button comes back.
      setTimeout(() => { if (spin.isConnected) { spin.replaceWith(star); b.classList.remove("busy"); b.removeAttribute("aria-busy"); } }, 8000);
      location.replace(kidsUrl());
    } }, icon("star", 16), h("span", { text: t("kidsMode") }));
    return b;
  }

  function bagSheet() {
    sheet(t("bagsTitle"),
      h("div", { class: "bag-rows" },
        h("div", { class: "bag-row" }, catArt("general", 36), h("span", { class: "grow", text: t("cat_general") }), h("strong", { class: "accent", text: t("needBag"), "data-pair": TH.pairT("needBag") })),
        h("div", { class: "bag-row" }, catArt("recycle", 36), h("span", { class: "grow", text: t("cat_recycle") }), h("span", { class: "muted", text: t("noBag") })),
        h("div", { class: "bag-row" }, catArt("food", 36), h("span", { class: "grow", text: t("cat_food") }), h("span", { class: "muted", text: t("noBag") }))),
      h("p", { class: "caption dark", text: t("fineNote"), "data-pair": TH.pairT("fineNote") }),
      h("div", { class: "sheet-actions" }, btn("btn-primary grow", t("s1Buy"), () => go("buy")), btn("btn-secondary grow", t("sizesPrices"), () => go("bags"))));
  }

  // Für Elise opening (Beethoven, public domain), played with Web Audio — no recording needed.
  const ELISE = [[76, 1], [75, 1], [76, 1], [75, 1], [76, 1], [71, 1], [74, 1], [72, 1], [69, 2], [0, 1], [60, 1], [64, 1], [69, 1], [71, 2], [0, 1], [64, 1], [68, 1], [71, 1], [72, 2], [0, 1], [64, 1], [76, 1], [75, 1], [76, 1], [75, 1], [76, 1], [71, 1], [74, 1], [72, 1], [69, 3]];
  let audioCtx = null;
  function playElise(button) {
    try {
      audioCtx = audioCtx || new (window.AudioContext || window.webkitAudioContext)();
      let at = audioCtx.currentTime + 0.05;
      const beat = 0.22;
      for (const [note, len] of ELISE) {
        if (note) {
          const o = audioCtx.createOscillator(), g = audioCtx.createGain();
          o.type = "triangle"; o.frequency.value = 440 * Math.pow(2, (note - 69) / 12);
          g.gain.setValueAtTime(0.0001, at); g.gain.exponentialRampToValueAtTime(0.25, at + 0.02); g.gain.exponentialRampToValueAtTime(0.0001, at + beat * len);
          o.connect(g).connect(audioCtx.destination); o.start(at); o.stop(at + beat * len + 0.02);
        }
        at += beat * len;
      }
      if (button) { button.disabled = true; setTimeout(() => { button.disabled = false; }, (at - audioCtx.currentTime) * 1000); }
    } catch (_) { /* no audio */ }
  }
  function musicSheet() {
    const eliseBtn = h("button", { class: "play-row", type: "button", onclick: () => playElise(eliseBtn) },
      h("span", { class: "play-dot" }, icon("play", 16)), h("span", { class: "grow", text: t("musicElise") }));
    sheet(t("musicTitle"), h("p", { class: "caption dark", text: t("musicLead"), "data-pair": TH.pairT("musicLead") }), eliseBtn,
      h("div", { class: "play-row disabled" }, h("span", { class: "play-dot" }, icon("play", 16)), h("span", { class: "grow", text: t("musicMaiden") }), h("span", { class: "caption", text: t("musicNA") })));
  }

  // ------------------------------------------------------------ manual pick
  let pickQuery = "";
  function viewPick() {
    TH.setHeader(t("pickTitle"));
    const rules = TH.rules();
    const grid = h("div", { class: "pick-grid3" });
    const empty = h("p", { class: "empty", hidden: true, text: t("noResult") });
    const pickIt = id => { if (TH.onScanPick) TH.onScanPick(id); else go("item/" + id); };
    const draw = () => {
      const list = rules.items.filter(i => TH.matches(i, pickQuery));
      fill(grid, list.map(i => h("button", { class: "pick-chip", type: "button", onclick: () => pickIt(i.id) }, art(i, 44), h("span", { class: "pc-name", text: L(i.name), "data-pair": TH.pairOf(i.name) }))));
      empty.hidden = list.length > 0;
    };
    const input = h("input", { type: "search", value: pickQuery, placeholder: t("pickSearch"), "aria-label": t("pickSearch"), enterkeyhint: "search" });
    input.addEventListener("input", () => { pickQuery = input.value.trim(); draw(); });
    draw();
    return [h("label", { class: "search v3" }, icon("search", 18), input), grid, empty];
  }

  // ------------------------------------------------------------ result (item)
  function nextTruckCard(cat) {
    const slot = h("div");
    if (cat === "bulky" || cat === "verify") return slot;
    Promise.all([TH.loadStops(), TH.loadFavs().catch(() => null)]).then(([data]) => {
      const p = TH.profile ? TH.profile.get() : {};
      const pos = TH.lastPosition();
      let stop = p.stopId ? data.byId.get(p.stopId) : null;
      if (!stop && pos) stop = data.stops.filter(s => TH.stopFits(s, cat)).map(s => ({ s, d: TH.haversine(pos, s) })).sort((a, b) => a.d - b.d)[0]?.s;
      if (!stop) { fill(slot, h("button", { class: "truck-card", type: "button", onclick: () => go("map/" + cat) }, icon("truck", 22), h("span", { class: "grow", text: t("findNearby") }), icon("chev", 18))); return; }
      const v = TH.visitsOf(stop)[0];
      if (!v) return;
      fill(slot, h("button", { class: "truck-card", type: "button", onclick: () => go("stop/" + stop.id) },
        h("div", { class: "tc-time" }, h("b", { text: SCH.comesToday(v) ? hhmm(v.arriveMs) : TH.fmtWhen(v.arriveMs) })),
        h("div", { class: "grow" }, h("div", { class: "tc-addr", text: shortAddr(stop) }), pos ? h("div", { class: "caption", text: t("walk", { n: walkMin(pos, stop) }) }) : null),
        icon("chev", 18)));
    }).catch(() => {});
    return slot;
  }
  // id: a rules.json item id, or an item-shaped object (recognised things without their own entry, scan.js).
  function viewItem(id) {
    const item = id && typeof id === "object" ? id : TH.itemById(id);
    if (!item) return viewPick();
    const rules = TH.rules();
    const g = rules.groups[item.group], cat = g.cat;
    TH.setHeader(" ");
    const steps = item.steps || [];
    const srcs = [...new Set([...(item.src || []), ...(g.src || []), ...steps.map(s => s.src).filter(Boolean)])].map(TH.sourceById);
    // Language and kids mode right on the answer, so the same card can be read another way in one tap.
    const out = [h("div", { class: "head-actions res-actions" }, kidsButton(), langButton()),
      h("div", { class: "res-hero" }, art(item, 88), h("h1", { class: "res-name", text: L(item.name), "data-pair": TH.pairOf(item.name) }))];
    const sub = { required: t("needBag"), exempt: t("noBag"), booking: "", unknown: "" }[item.bag] || "";
    out.push(h("div", { class: `verdict3 v-${cat}` }, h("span", { class: "v3-icon" }, icon(rules.categories[cat].icon, 24)),
      h("div", { class: "grow" }, h("div", { class: "v3-top", text: [t("cat_" + cat), sub].filter(Boolean).join("・") }), h("div", { class: "v3-title", text: t(VERDICT[cat]), "data-pair": TH.pairT(VERDICT[cat]) })),
      item.bag === "required" ? h("button", { class: "v3-buy", type: "button", onclick: () => go("buy") }, icon("shopping-bag", 18), h("span", { text: t("howBuy") }), icon("chev", 16)) : null));
    if (cat === "bulky") {
      out.push(h("ol", { class: "num-steps" }, ["bulkyStep1", "bulkyStep2", "bulkyStep3"].map(k => h("li", { text: t(k) }))));
      out.push(h("div", { class: "actions" }, btn("btn-primary", t("call1999short"), () => TH.dial(rules.contacts.hotline)),
        btn("btn-secondary", t("bookOnline"), () => TH.openExternal(rules.contacts.online))));
      out.push(TH.bookingPanel());
    } else {
      if (steps.length) {
        out.push(h("ol", { class: "step-tiles" }, steps.map((s, i) => h("li", { class: "step-tile" },
          h("span", { class: "st-n", text: String(i + 1) }), h("span", { class: "st-art" }, icon(s.icon, 30)), h("span", { class: "st-title", text: L(s.title), "data-pair": TH.pairOf(s.title) })))));
      }
      if (item.warn) out.push(h("div", { class: "warn-pill" }, icon("alert-triangle", 16), h("span", { text: L(item.warn), "data-pair": TH.pairOf(item.warn) })));
      if (item.verify) out.push(TH.verifyBox(L(item.verify)));
      if (item.components) out.push(h("section", { class: "card" }, h("h3", { class: "card-title", text: t("secParts"), "data-pair": TH.pairT("secParts") }), h("ul", { class: "parts" }, item.components.map(TH.componentCard))));
      if (cat === "verify") out.push(TH.bookingPanel());
      out.push(nextTruckCard(cat));
      if (cat !== "verify") out.push(h("div", { class: "actions" }, btn("btn-primary", t("takeMe"), () => go("map/" + (TH.placeLayerOf(item) || cat)))));
    }
    out.push(TH.sourceFooter(srcs));
    return out;
  }

  // ------------------------------------------------------------ bottom tab bar
  function tabBar(active) {
    const tab = (route, ic, label, key) => h("button", { class: "tab" + (active === key ? " on" : ""), type: "button", onclick: () => go(route, { replace: true }), "aria-current": active === key ? "page" : null }, icon(ic, 24), h("span", { text: label }));
    return h("nav", { class: "tabbar", "aria-label": t("appTitle") },
      // Two places: home (today, my truck, the big camera button, what to do) and what is nearby.
      // The camera is the home page's own big button, so the bar has no second one. The talk card,
      // bags and reminders come up in the steps.
      tab("", "home", t("navHome"), "home"),
      tab("map", "map", t("navNear"), "map"));
  }

  Object.assign(TH.views, { viewPick, viewItem, tabBar, bagSheet, musicSheet, langSheet, langButton, kidsButton });
})();
