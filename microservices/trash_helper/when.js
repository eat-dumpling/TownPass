// SPDX-License-Identifier: AGPL-3.0-or-later
// "When can I take it out?" — kept simple: your stop, the days the truck comes, one time.
//
//   [ 你的收運點：忠孝東路5段63號前   換一個 ]
//   [ 今天 ] [ 明天 ] [ 週二 ] [ 週四 ] …     ← only days the truck comes (for this kind of trash)
//   ┌──────────────────────────────┐
//   │ 明天 11/9                     │
//   │ 21:10  垃圾車到              │
//   │ 21:18 前離開・回收車跟在後面   │
//   │ [ 提醒我 ]  [ 帶我去 ]         │
//   └──────────────────────────────┘
//
// Taipei rules (data/rules.json): general trash / food / recycling Mon Tue Thu Fri Sat; recycling flat Mon Fri,
// 3-D Tue Thu Sat, and the other collection days are accepted too (DEP FAQ); Wed and Sun no collection.
// Times: data.taipei 臺北市垃圾車點位路線資訊 (data/stops.json); holiday changes: data/exceptions.json.
// Page: #/when/<group>; TH.whenPicker({ group, cat }) gives the same content to embed.
"use strict";

(function () {
  const TH = window.TH;
  const { h, t, go, fill, btn, SCH } = TH;
  const icon = (...a) => TH.icon(...a);

  Object.assign(window.TH_STRINGS.zh, {
    whnTitle: "什麼時候丟", whnStop: "你的收運點", whnChange: "換一個", whnNoStop: "還沒選收運點",
    whnUseLoc: "用我的位置找", whnPickStop: "選收運點", whnFinding: "正在取得位置…", whnNoLoc: "拿不到位置，請選收運點。",
    whnArrive: "垃圾車到", whnLeave: "{time} 前離開", whnRecycle: "回收車跟在後面", whnPassed: "今天的車已經走了",
    whnRemind: "提醒我", whnGo: "帶我去", whnBooking: "大型家具要先預約，清潔隊會約時間。", whnAsk: "這類先問清潔隊再丟。",
    whnOffShort: "停收", whnNoDays: "這個點這週沒有收運。", whnBest: "建議",
  });
  Object.assign(window.TH_STRINGS.en, {
    whnTitle: "When to take it out", whnStop: "Your stop", whnChange: "Change", whnNoStop: "No stop chosen yet",
    whnUseLoc: "Use my location", whnPickStop: "Choose a stop", whnFinding: "Finding your location…", whnNoLoc: "Couldn't get your location. Choose a stop.",
    whnArrive: "Truck arrives", whnLeave: "Leaves by {time}", whnRecycle: "The recycling truck follows", whnPassed: "Today's truck has gone",
    whnRemind: "Remind me", whnGo: "Directions", whnBooking: "Bulky items must be booked first; the squad sets a time.", whnAsk: "Ask the cleaning squad before you throw this out.",
    whnOffShort: "No pickup", whnNoDays: "No pickup at this stop this week.", whnBest: "Best",
  });

  const pad = n => String(n).padStart(2, "0");
  const hhmm = m => `${pad(Math.floor(m / 60) % 24)}:${pad(m % 60)}`;
  const shortAddr = s => s.address.replace(/^臺北市/, "").replace(s.district, "");

  let exData = null;
  const loadExceptions = () => exData ? Promise.resolve(exData)
    : fetch("data/exceptions.json").then(r => r.json()).then(d => (exData = d)).catch(() => (exData = { exceptions: [] }));

  // Can this group go out on that weekday? best = its own suggested day.
  function fit(groupId, day) {
    const rules = TH.rules();
    const g = rules.groups[groupId];
    if (g.booking || g.ask) return { ok: false };
    if (g.flexible) return { ok: rules.groups.general.days.includes(day), best: g.days.includes(day) };
    return { ok: g.days.includes(day), best: false };
  }
  const collects = day => ["general", "food", "flat", "rigid", "hazard"].filter(id => TH.rules().groups[id].days.includes(day));

  // The next 7 days on which the truck stops at `stop` and takes this group.
  function days(stop, groupId) {
    const sd = TH.stopsData();
    const now = Date.now();
    const today = SCH.taipeiParts(now);
    const exceptions = (exData && exData.exceptions) || [];
    const runs = SCH.serviceDays(stop, sd.generalDays);
    const out = [];
    for (let i = 0; i < 7; i++) {
      const p = SCH.addDays(today, i);
      const ex = SCH.exceptionFor(exceptions, SCH.dateKey(p), groupId);
      const f = fit(groupId, p.day);
      const running = ex ? ex.type !== "suspend" : runs.includes(p.day);
      if (!f.ok || !running) { if (ex && ex.type === "suspend" && f.ok && runs.includes(p.day)) out.push({ i, p, ex, off: true }); continue; }
      const leaveMs = SCH.instant(p, stop.leave);
      if (i === 0 && leaveMs < now) continue; // today's truck has gone
      out.push({ i, p, ex, best: f.best, arriveMs: SCH.instant(p, stop.arrive) });
    }
    return out;
  }
  const dayName = d => d.i === 0 ? t("today") : d.i === 1 ? t("tomorrow") : (TH.lang() === "zh" ? "週" : "") + t("days")[d.p.day];

  function myStop(cat) {
    const sd = TH.stopsData();
    const p = TH.profile ? TH.profile.get() : {};
    const mine = p && p.stopId ? sd.byId.get(p.stopId) : null;
    if (mine) return mine;
    const pos = TH.lastPosition();
    if (!pos) return null;
    return sd.stops.filter(s => TH.stopFits(s, cat)).map(s => ({ s, m: TH.haversine(pos, s) })).sort((a, b) => a.m - b.m)[0]?.s || null;
  }

  // opts: { group, cat }
  function whenPicker(opts) {
    const groupId = opts.group || "general";
    const g = TH.rules().groups[groupId];
    const cat = opts.cat || g.cat;
    const root = h("div", { class: "whn" });
    if (g.booking) { fill(root, h("p", { class: "muted", text: t("whnBooking") })); return root; }
    if (g.ask) { fill(root, h("p", { class: "muted", text: t("whnAsk") })); return root; }

    const pickStop = () => go("welcome/1");
    function noStop(msg) {
      const status = h("p", { class: "caption", "aria-live": "polite", text: msg || "" });
      fill(root,
        h("div", { class: "whn-stop" }, icon("map-pin", 20), h("span", { class: "grow", text: t("whnNoStop") })),
        h("div", { class: "whn-actions" },
          btn("btn-primary", t("whnUseLoc"), async () => {
            status.textContent = t("whnFinding");
            try { TH.setLastPosition(await TH.getLocation()); draw(); } catch (_) { status.textContent = t("whnNoLoc"); }
          }),
          btn("btn-secondary", t("whnPickStop"), pickStop)),
        status);
    }

    function draw() {
      const stop = myStop(cat);
      if (!stop) { noStop(); return; }
      const list = days(stop, groupId);
      let sel = list.find(d => !d.off) || null;
      const card = h("div", { class: "whn-card" });
      const chips = h("div", { class: "whn-days", role: "group", "aria-label": t("whnTitle") });
      const drawChips = () => fill(chips, list.map(d => {
        const b = h("button", { class: "whn-day" + (d.off ? " off" : ""), type: "button", "aria-pressed": String(d === sel), disabled: !!d.off },
          h("b", { text: dayName(d) }), h("small", { text: d.off ? t("whnOffShort") : `${d.p.m}/${d.p.d}` }),
          d.best ? h("span", { class: "whn-best", text: t("whnBest") }) : null);
        b.addEventListener("click", () => { sel = d; drawChips(); drawCard(); });
        return b;
      }));
      const drawCard = () => {
        if (!sel) { fill(card, h("p", { class: "muted", text: t("whnNoDays") })); return; }
        fill(card,
          h("div", { class: "whn-when", text: `${dayName(sel)} ${sel.p.m}/${sel.p.d}` }),
          h("div", { class: "whn-time" }, h("b", { text: hhmm(stop.arrive) }), h("span", { text: t("whnArrive") })),
          h("p", { class: "whn-leave", text: [t("whnLeave", { time: hhmm(stop.leave) }), g.cat === "recycle" || g.cat === "special" ? t("whnRecycle") : ""].filter(Boolean).join("・") }),
          TH.leave ? TH.leave.line(stop, { visit: { arriveMs: sel.arriveMs } }) : null,
          h("div", { class: "whn-actions" },
            btn("btn-primary", t("whnRemind"), () => go("remind/" + encodeURIComponent(stop.id))),
            btn("btn-secondary", t("whnGo"), () => TH.openMap(stop))));
      };
      fill(root,
        h("button", { class: "whn-stop", type: "button", onclick: pickStop },
          icon("map-pin", 20),
          h("span", { class: "grow" }, h("small", { text: t("whnStop") }), h("b", { text: shortAddr(stop) })),
          h("span", { class: "whn-change", text: t("whnChange") })),
        chips, card);
      drawChips(); drawCard();
    }

    Promise.all([TH.loadStops(), loadExceptions()]).then(draw).catch(() => fill(root, h("p", { class: "muted", text: t("loadError") })));
    return root;
  }

  // ------------------------------------------------------------ the time you picked (home card / plan step 3)
  // profile.trip = { stopId, date: "YYYY-MM-DD" }: a chosen stop + day. Used while that visit is still to come;
  // otherwise the stop's next visit.
  function chosenVisit(stop) {
    const p = TH.profile ? TH.profile.get() : {};
    const trip = p && p.trip;
    if (trip && trip.stopId === stop.id) {
      const v = TH.visitsOf(stop, { count: 8 }).find(x => x.date === trip.date);
      if (v) return v;
    }
    return TH.visitsOf(stop)[0] || null;
  }

  // Bottom sheet: pick a day (only days the truck comes), then a time — your stop or one nearby that day.
  const NEAR = 500; // metres around your stop
  function pickTimeSheet(onDone) {
    Promise.all([TH.loadStops(), loadExceptions()]).then(() => {
      const sd = TH.stopsData();
      const p = TH.profile.get();
      const mine = p.stopId ? sd.byId.get(p.stopId) : null;
      if (!mine) { go("welcome/1"); return; }
      const list = days(mine, "general").filter(d => !d.off);
      const cur = chosenVisit(mine);
      let sel = list.find(d => cur && SCH.dateKey(d.p) === cur.date) || list[0];
      const chips = h("div", { class: "whn-days", role: "group", "aria-label": t("whnTitle") });
      const times = h("div", { class: "pt-times" });
      let close = null;
      const choose = (s, d) => {
        TH.profile.set({ stopId: s.id, trip: { stopId: s.id, date: SCH.dateKey(d.p) } });
        if (close) close();
        if (onDone) onDone();
      };
      const drawTimes = () => {
        if (!sel) { fill(times, h("p", { class: "muted", text: t("whnNoDays") })); return; }
        const now = Date.now();
        const rows = sd.stops.filter(s => s.id === mine.id || TH.haversine(mine, s) <= NEAR)
          .filter(s => SCH.serviceDays(s, sd.generalDays).includes(sel.p.day) && SCH.instant(sel.p, s.leave) > now)
          // your stop + the 4 closest others, shown in time order
          .map(s => ({ s, m: s.id === mine.id ? -1 : TH.haversine(mine, s) })).sort((a, b) => a.m - b.m).slice(0, 5)
          .map(x => x.s).sort((a, b) => a.arrive - b.arrive);
        const curId = cur && p.trip && p.trip.date === SCH.dateKey(sel.p) ? p.trip.stopId : (cur && SCH.dateKey(sel.p) === cur.date ? mine.id : null);
        fill(times, rows.map(s => h("button", { class: "pt-row" + (s.id === curId ? " on" : ""), type: "button", "aria-pressed": String(s.id === curId), onclick: () => choose(s, sel) },
          h("b", { text: hhmm(s.arrive) }),
          h("span", { class: "grow" }, h("span", { class: "pt-addr", text: shortAddr(s) }), h("small", { text: s.id === mine.id ? t("ptMine") : t("ptAway", { m: Math.round(TH.haversine(mine, s) / 10) * 10 }) })),
          s.id === curId ? icon("circle-check", 22) : h("span", { class: "whn-radio", "aria-hidden": "true" }))));
      };
      const drawChips = () => fill(chips, list.map(d => {
        const b = h("button", { class: "whn-day", type: "button", "aria-pressed": String(d === sel) }, h("b", { text: dayName(d) }), h("small", { text: `${d.p.m}/${d.p.d}` }));
        b.addEventListener("click", () => { sel = d; drawChips(); drawTimes(); });
        return b;
      }));
      drawChips(); drawTimes();
      close = TH.sheet(t("ptTitle"), chips, times,
        h("button", { class: "link-btn small", type: "button", onclick: () => { if (close) close(); go("welcome/1"); }, text: t("ptOtherStop") }));
    }).catch(() => {});
  }
  Object.assign(window.TH_STRINGS.zh, { ptTitle: "選丟垃圾的時間", ptMine: "你的收運點", ptAway: "離你的點 {m} 公尺", ptOtherStop: "換別區的收運點 ›" });
  Object.assign(window.TH_STRINGS.en, { ptTitle: "Pick a time", ptMine: "Your stop", ptAway: "{m} m from your stop", ptOtherStop: "Choose a stop elsewhere ›" });

  function viewWhen(groupId) {
    TH.setHeader(t("whnTitle"));
    const id = TH.rules().groups[groupId] ? groupId : "general";
    return h("div", { class: "whn-page" }, whenPicker({ group: id }));
  }

  TH.whenPicker = whenPicker;
  TH.chosenVisit = chosenVisit;
  TH.pickTimeSheet = pickTimeSheet;
  TH.collectsOn = collects;
  TH.routes = Object.assign(TH.routes || {}, { when: a => viewWhen(decodeURIComponent(a || "general")) });
})();
