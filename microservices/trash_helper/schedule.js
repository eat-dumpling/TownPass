// SPDX-License-Identifier: AGPL-3.0-or-later
// Timetable maths for display. Everything is in Asia/Taipei (UTC+8, no daylight saving),
// whatever time zone the phone is set to. Reminder scheduling uses the Dart copy of this
// logic (lib/page/trash_helper/trash_schedule.dart), which has the unit tests.
"use strict";

(function (root) {
  const OFFSET_MIN = 8 * 60;
  const DAY_MS = 86400000;

  // Calendar date and minute-of-day in Taipei for an instant (ms since epoch).
  function taipeiParts(ms) {
    const d = new Date(ms + OFFSET_MIN * 60000);
    return { y: d.getUTCFullYear(), m: d.getUTCMonth() + 1, d: d.getUTCDate(), day: d.getUTCDay(), minutes: d.getUTCHours() * 60 + d.getUTCMinutes() };
  }
  function addDays(p, n) {
    const d = new Date(Date.UTC(p.y, p.m - 1, p.d + n));
    return { y: d.getUTCFullYear(), m: d.getUTCMonth() + 1, d: d.getUTCDate(), day: d.getUTCDay() };
  }
  const pad = n => String(n).padStart(2, "0");
  const dateKey = p => `${p.y}-${pad(p.m)}-${pad(p.d)}`;
  // Instant for a Taipei service date plus minutes; minutes ≥ 1440 are after midnight.
  const instant = (p, minutes) => Date.UTC(p.y, p.m - 1, p.d) + (minutes - OFFSET_MIN) * 60000;

  function exceptionFor(exceptions, key, group) {
    return (exceptions || []).find(e => (e.date === key || (e.end && e.date <= key && key <= e.end)) &&
      (e.groups || ["all"]).some(g => g === "all" || g === group)) || null;
  }

  // Days the truck serves this stop: the stop's own note wins over the city-wide rule.
  function serviceDays(stop, generalDays) {
    return stop.note && Array.isArray(stop.note.days) ? stop.note.days : generalDays;
  }

  // Upcoming scheduled visits of one stop. Starts from yesterday's service day so that a
  // trip after midnight (arrive ≥ 24:00) is still found the next morning.
  function nextVisits(stop, { now = Date.now(), generalDays, exceptions, group = "general", count = 1, horizonDays = 14 } = {}) {
    const today = taipeiParts(now);
    const days = serviceDays(stop, generalDays);
    const out = [];
    for (let i = -1; i <= horizonDays && out.length < count; i++) {
      const p = addDays(today, i);
      const key = dateKey(p);
      const ex = exceptionFor(exceptions, key, group);
      if (ex && ex.type === "suspend") continue;
      if (!days.includes(p.day) && !(ex && ex.type === "extra")) continue;
      const leaveMs = instant(p, stop.leave);
      if (leaveMs < now) continue;
      out.push({ date: key, day: p.day, offset: i, arriveMs: instant(p, stop.arrive), leaveMs, exception: ex });
    }
    return out;
  }

  // Is the next visit still today (Taipei calendar), counting after-midnight trips of yesterday?
  function comesToday(visit, now = Date.now()) {
    if (!visit) return false;
    const t = taipeiParts(now);
    const a = taipeiParts(visit.arriveMs);
    return a.y === t.y && a.m === t.m && a.d === t.d;
  }

  // Opening hours like {"1": [[360, 1380]]}: open at this instant?
  function isOpen(hours, now = Date.now()) {
    const p = taipeiParts(now);
    return (hours[String(p.day)] || []).some(([a, b]) => p.minutes >= a && p.minutes < b);
  }

  root.THSchedule = { taipeiParts, addDays, dateKey, instant, exceptionFor, serviceDays, nextVisits, comesToday, isOpen, DAY_MS };
})(typeof window !== "undefined" ? window : globalThis);
