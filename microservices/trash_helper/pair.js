// SPDX-License-Identifier: AGPL-3.0-or-later
// Side-by-side language on every page. When a second language is set (TH.setPair), any text on
// screen that is one of our own strings — a UI string (TH_STRINGS, with {placeholders}) or a
// rules.json text (en / zh / TH_CONTENT) — gets the same words in the second language in small
// type below it (data-pair, drawn by style.css). Names, addresses and other data that are not
// our strings stay as they are. Pages need no changes: this follows whatever is rendered, also
// sheets, the map card and the voice assistant, and it redoes everything when either language
// changes. Elements that set data-pair themselves are left alone.
"use strict";

(function () {
  const TH = window.TH;
  const STR = window.TH_STRINGS;
  // Not paired: form fields, the map, things already marked, the talk card (it already shows
  // Chinese and the user's language on purpose) and what the user typed or said to the assistant.
  const SKIP = "script, style, textarea, input, select, option, svg, .leaflet-container, [data-pair], [data-pair-skip], "
    + ".tc-full, .tc-list, .tc-script, .tc-reply-grid, .tc-ask, .va-msg.me";
  const SEP = /(\s*[・·|｜\/]\s*)/;           // "特殊回收物・不用專用袋" pairs part by part
  const NUM = /([\d\s:.,、，()（）›‹+\-–~$%]+)/u;   // "週一 21:10", "更改 ›"
  const HAS_WORD = /[\p{L}]/u;

  let maps = null, stamp = "";

  // ---------------------------------------------------------------- what each text is
  function build(lang, pair) {
    const exact = new Map(), templates = [];
    const keys = new Set([...Object.keys(STR.en || {}), ...Object.keys(STR[lang] || {})]);
    const inLang = (code, key) => (STR[code] && STR[code][key]) ?? STR.en[key];
    for (const key of keys) {
      const cur = inLang(lang, key), other = inLang(pair, key);
      if (Array.isArray(cur) && Array.isArray(other)) {
        cur.forEach((s, i) => { if (typeof s === "string" && typeof other[i] === "string") addExact(exact, s, other[i]); });
        continue;
      }
      if (typeof cur !== "string" || typeof other !== "string" || cur === other) continue;
      if (/\{\w+\}/.test(cur)) {
        const names = [];
        const src = norm(cur).split(/(\{\w+\})/).map(part => {
          const m = /^\{(\w+)\}$/.exec(part);
          if (m) { names.push(m[1]); return "(.+?)"; }
          return part.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
        }).join("");
        // A template that is only placeholders ("{a}{b}") would match anything.
        if (src.replace(/\(\.\+\?\)/g, "").trim().length < 2) continue;
        templates.push({ re: new RegExp(`^${src}$`, "u"), names, other });
      } else addExact(exact, cur, other);
    }
    // Rules texts: every {en, zh, …} object, shown with L() in the screen language.
    const rules = TH.rules && TH.rules();
    const content = window.TH_CONTENT || {};
    const Lin = (code, obj) => obj[code] ?? (content[code] || {})[obj.en] ?? obj.en;
    const walk = o => {
      if (!o || typeof o !== "object") return;
      if (Array.isArray(o)) { o.forEach(walk); return; }
      if (typeof o.en === "string") {
        const cur = Lin(lang, o), other = Lin(pair, o);
        if (typeof cur === "string" && typeof other === "string" && cur !== other) addExact(exact, cur, other);
      }
      for (const v of Object.values(o)) if (v && typeof v === "object") walk(v);
    };
    walk(rules);
    // Weekday names as dates are written ("週日", "Sun"), from the phone's own date formatting.
    const loc = code => code === "zh" ? "zh-TW" : code === "fil" ? "fil-PH" : code;
    for (let d = 0; d < 7; d++) {
      const day = new Date(Date.UTC(2026, 10, 1 + d, 4));   // 2026-11-01 is a Sunday
      for (const weekday of ["short", "long"]) {
        try {
          const f = code => new Intl.DateTimeFormat(loc(code), { weekday, timeZone: "Asia/Taipei" }).format(day);
          addExact(exact, f(lang), f(pair));
        } catch (_) { /* no date names for this language here */ }
      }
    }
    // Longer templates first, so "{n} 家代售點" wins over "{n}".
    templates.sort((a, b) => b.re.source.length - a.re.source.length);
    return { exact, templates };
  }
  const norm = s => String(s).replace(/\s+/g, " ").trim();
  function addExact(map, cur, other) {
    const k = norm(cur);
    if (k && HAS_WORD.test(k) && !map.has(k)) map.set(k, norm(other));
  }

  function translate(s) {
    const hit = maps.exact.get(s);
    if (hit) return hit;
    for (const tp of maps.templates) {
      const m = tp.re.exec(s);
      if (!m) continue;
      let out = tp.other;
      tp.names.forEach((n, i) => { out = out.split(`{${n}}`).join(maps.exact.get(m[i + 1]) || m[i + 1]); });
      return out;
    }
    return null;
  }
  function pairFor(raw) {
    const s = norm(raw);
    if (!s || !HAS_WORD.test(s)) return null;
    const whole = translate(s);
    if (whole) return whole !== s ? whole : null;
    // Joined labels ("今天・週日"), then words around numbers ("週一 21:10", "5 分"): translate the
    // parts we know, keep the rest (times, numbers, names).
    for (const splitter of [SEP, NUM]) {
      if (!splitter.test(s)) continue;
      let any = false;
      const out = s.split(splitter).map((part, i) => {
        if (i % 2) return part;
        const tr = part.trim() && translate(part.trim());
        if (tr) { any = true; return part.replace(part.trim(), tr); }
        return part;
      }).join("");
      if (any && out !== s) return out;
    }
    return null;
  }

  // ---------------------------------------------------------------- marking the page
  function mark(node) {
    const parent = node.parentElement;
    if (!parent) return;
    const own = parent.hasAttribute("data-pair-auto") && parent.childNodes.length === 1;
    // Our own mark is re-checked when its text changes; anything else marked or skipped is left alone.
    const host = own ? parent.parentElement : parent;
    if (!host || host.closest(SKIP)) return;
    const pair = pairFor(node.nodeValue);
    if (!pair) { if (own) parent.removeAttribute("data-pair"); return; }
    let box = parent;
    if (!own) {
      // A block holding only this text (a paragraph, a list item, a title) gets the line itself;
      // text beside an icon, or in a flex row, goes in its own small box so the line sits under it.
      const only = [...parent.childNodes].every(n => n === node || (n.nodeType === 3 && !n.nodeValue.trim()));
      const d = only ? getComputedStyle(parent).display : "";
      if (!(only && (d === "block" || d === "list-item" || d === "table-cell"))) {
        box = document.createElement("span");
        box.className = "pair-auto";
        parent.replaceChild(box, node);
        box.append(node);
      }
      box.setAttribute("data-pair-auto", "");
    }
    box.setAttribute("data-pair", pair);
  }
  function scan(root) {
    if (!root) return;
    if (root.nodeType === 3) { mark(root); return; }
    if (root.nodeType !== 1 || root.closest(SKIP)) return;
    const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
    const list = [];
    while (walker.nextNode()) list.push(walker.currentNode);
    list.forEach(mark);
  }
  // Second language off, or a language changed: take every automatic line away first.
  function clear() {
    document.querySelectorAll("[data-pair-auto][data-pair]").forEach(el => el.removeAttribute("data-pair"));
  }
  function current() {
    const lang = TH.lang(), pair = TH.pairLang && TH.pairLang();
    const s = `${lang}|${pair || ""}|${TH.rules && TH.rules() ? 1 : 0}`;
    if (s !== stamp) {
      stamp = s;
      clear();
      maps = pair ? build(lang, pair) : null;
      document.documentElement.classList.toggle("pair-on", !!pair);
      return { changed: true };
    }
    return { changed: false };
  }

  let queued = new Set(), frame = 0;
  function flush() {
    frame = 0;
    const { changed } = current();
    const nodes = changed ? [document.body] : [...queued];
    queued = new Set();
    if (!maps) return;
    // .pair-auto spans stay in place when the second language goes off; they get their line back.
    if (changed) document.querySelectorAll("[data-pair-auto]").forEach(el => { if (el.firstChild) mark(el.firstChild); });
    nodes.forEach(n => { if (n.isConnected) scan(n); });
  }
  const observer = new MutationObserver(muts => {
    for (const m of muts) {
      if (m.type === "characterData") queued.add(m.target);
      else m.addedNodes.forEach(n => queued.add(n));
    }
    // A short timer, not an animation frame: it also runs in a background web view.
    if (!frame) frame = setTimeout(flush, 16);
  });
  function start() {
    observer.observe(document.body, { childList: true, subtree: true, characterData: true });
    flush();
  }
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", start); else start();
})();
