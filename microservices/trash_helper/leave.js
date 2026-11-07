// SPDX-License-Identifier: AGPL-3.0-or-later
// "Time to leave" (該出發了): when to walk out so you reach the stop before the truck.
//
//   leave = scheduled arrival − walking time − 5 min early (trucks only stop a few minutes)
//
// Walking time comes from your live position when the app has it, otherwise from what you
// told us for that stop ("走過去大約幾分鐘？"), kept on this phone only. Times are the city's
// scheduled times, not live truck positions.
"use strict";

(function () {
  const TH = window.TH;
  const { h, t, fill, SCH } = TH;
  const icon = (...a) => TH.icon(...a);
  const EARLY = 5;
  const KEY = "th.walk.v1";

  Object.assign(window.TH_STRINGS.zh, {
    lvGoNow: "該出發了！", lvAt: "{time} 出門", lvIn: "再 {n} 分鐘出門", lvHere: "車預定已到，現在去還來得及",
    lvWhy: "步行 {w} 分＋提早 {e} 分", lvWhyLive: "依你現在的位置", lvAsk: "從家走到這裡大約幾分鐘？", lvSet: "改步行時間",
    lvMin: "{n} 分", lvChip: "出門時（{n} 分）", lvNote: "依預定班表推算，不是即時位置。", lvWhen: "幾點出門？", lvWalk: "走 {n} 分", lvAskShort: "走過去幾分鐘？",
  });
  Object.assign(window.TH_STRINGS.en, {
    lvGoNow: "Time to leave!", lvAt: "Leave at {time}", lvIn: "Leave in {n} min", lvHere: "Truck due now — go now",
    lvWhy: "{w} min walk + {e} min early", lvWhyLive: "from where you are now", lvAsk: "About how many minutes' walk from home?", lvSet: "Change walk time",
    lvMin: "{n} min", lvChip: "Leave time ({n} min)", lvNote: "From the scheduled timetable, not the truck's live position.", lvWhen: "When to leave?", lvWalk: "{n} min walk", lvAskShort: "Minutes to walk there?",
  });

  const readAll = () => { try { return JSON.parse(localStorage.getItem(KEY) || "{}") || {}; } catch (_) { return {}; } };
  const savedWalk = id => { const v = readAll()[id]; return Number.isInteger(v) && v >= 0 && v <= 60 ? v : null; };
  const setWalk = (id, n) => { const all = readAll(); all[id] = n; try { localStorage.setItem(KEY, JSON.stringify(all)); } catch (_) {} };
  const pad = n => String(n).padStart(2, "0");
  const hhmm = ms => { const p = SCH.taipeiParts(ms); return `${pad(Math.floor(p.minutes / 60))}:${pad(p.minutes % 60)}`; };

  // Walking minutes to this stop: live position first, then the saved answer.
  function walkFor(stop) {
    const pos = TH.lastPosition();
    if (pos) return { walk: Math.max(1, Math.round(TH.haversine(pos, stop) / 75)), live: true };
    const w = savedWalk(stop.id);
    return w == null ? null : { walk: w, live: false };
  }

  // { walk, live, leaveMs, state: later|soon|now|due|null, text } for the next visit (or `visit`).
  function plan(stop, visit, now = Date.now()) {
    const v = visit || TH.visitsOf(stop)[0];
    const w = walkFor(stop);
    if (!v || !w) return { visit: v, ...w, state: null };
    const leaveMs = v.arriveMs - (w.walk + EARLY) * 60000;
    const truckGone = v.arriveMs + Math.max(1, stop.leave - stop.arrive) * 60000;
    let state = null, text = "";
    if (now < leaveMs - 30 * 60000) { state = "later"; text = t("lvAt", { time: hhmm(leaveMs) }); }
    else if (now < leaveMs) { state = "soon"; text = t("lvIn", { n: Math.max(1, Math.ceil((leaveMs - now) / 60000)) }); }
    else if (now < v.arriveMs) { state = "now"; text = t("lvGoNow"); }
    else if (now <= truckGone) { state = "due"; text = t("lvHere"); }
    return { visit: v, ...w, leaveMs, state, text, lead: w.walk + EARLY };
  }

  // A line for cards: "該出發了！ 步行 3 分＋提早 5 分", or a walk-time question when we don't know.
  function line(stop, opts = {}) {
    const box = h("div", { class: "leave-line", style: "margin:8px 0" });
    const draw = () => {
      const p = plan(stop, opts.visit);
      if (p.walk == null) {
        if (opts.compact) { box.replaceChildren(); return; }
        fill(box, h("p", { class: "caption dark", style: "margin:0 0 6px", text: t("lvAsk") }),
          h("div", { style: "display:flex;gap:8px;flex-wrap:wrap" }, [1, 3, 5, 10, 15].map(n =>
            h("button", { class: "lead-chip", type: "button", onclick: () => { setWalk(stop.id, n); draw(); if (opts.onChange) opts.onChange(); } }, t("lvMin", { n })))));
        return;
      }
      if (!p.state) { box.replaceChildren(); return; }
      const hot = p.state === "now" || p.state === "due" || p.state === "soon";
      fill(box,
        h("div", { style: `display:flex;gap:10px;align-items:center;padding:10px 12px;border-radius:12px;background:${hot ? "#FDF3EC" : "#EDF8FA"};color:${hot ? "#9A4A1E" : "#22474E"}` },
          icon("walk", 20),
          h("div", { style: "flex:1;min-width:0" },
            h("strong", { style: "display:block;font-size:1.0625rem", text: p.text }),
            h("span", { class: "caption", style: "color:inherit;opacity:.85", text: `${t("lvWhy", { w: p.walk, e: EARLY })}${p.live ? "・" + t("lvWhyLive") : ""}` })),
          !p.live && !opts.compact ? h("button", { class: "link-btn small", type: "button", onclick: () => { setWalk(stop.id, null); draw(); } , text: t("lvSet") }) : null),
        opts.compact ? null : h("p", { class: "caption", style: "margin:4px 2px 0", text: t("lvNote") }));
    };
    draw();
    // Keep the countdown fresh while the card is on screen.
    const timer = setInterval(() => { if (document.body.contains(box)) draw(); else clearInterval(timer); }, 30000);
    return box;
  }

  // Small right-hand pill for cards: "21:00 出門 / 走 5 分". Unknown walk time → "幾點出門？",
  // which opens the minute choices in place. Tapping a known pill lets you change the minutes.
  function pill(stop, visit) {
    const box = h("div", { style: "flex:none" });
    const chips = () => fill(box, h("div", { style: "display:flex;gap:6px;flex-wrap:wrap;justify-content:flex-end;max-width:210px" },
      h("span", { class: "caption", style: "width:100%;text-align:right", text: t("lvAskShort") }),
      [1, 3, 5, 10, 15].map(n => h("button", { class: "lead-chip", type: "button", onclick: () => { setWalk(stop.id, n); draw(); } }, t("lvMin", { n })))));
    const draw = () => {
      const p = plan(stop, visit);
      if (p.walk == null) {
        fill(box, h("button", { type: "button", onclick: chips, style: "border:1px dashed #91A0A8;background:#fff;border-radius:12px;padding:8px 12px;font:inherit;font-weight:600;color:#475259;min-height:44px" }, icon("walk", 18), " ", t("lvWhen")));
        return;
      }
      if (!p.state) { box.replaceChildren(); return; }
      const hot = p.state !== "later";
      fill(box, h("button", { type: "button", onclick: () => { if (!p.live) chips(); }, "aria-label": `${p.text} ${t("lvWalk", { n: p.walk })}`,
        style: `text-align:right;border:0;border-radius:12px;padding:8px 12px;font:inherit;background:${hot ? "#FDF3EC" : "#EDF8FA"};color:${hot ? "#9A4A1E" : "#22474E"};min-height:44px` },
        h("strong", { style: "display:block;font-size:1.0625rem", text: p.text }),
        h("span", { style: "font-size:.75rem;opacity:.85" }, icon("walk", 12), " ", t("lvWalk", { n: p.walk }))));
    };
    draw();
    const timer = setInterval(() => { if (document.body.contains(box)) draw(); else clearInterval(timer); }, 30000);
    return box;
  }

  TH.leave = { plan, line, pill, walkFor, setWalk, EARLY };
})();
