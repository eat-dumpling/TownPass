// Timetable checks for microservices/trash_helper/schedule.js (fixed clock, TEST DATA ONLY).
// Run: /System/Library/Frameworks/JavaScriptCore.framework/Versions/Current/Helpers/jsc microservices/trash_helper/schedule.js tools/trash_helper_schedule_test.js
const S = globalThis.THSchedule;
const tp = (y,m,d,h,mi) => Date.UTC(y,m-1,d,h,mi) - 8*3600000;
let fails = 0; const eq = (a,b,msg) => { if (JSON.stringify(a)!==JSON.stringify(b)) { fails++; print("FAIL "+msg+": "+JSON.stringify(a)+" != "+JSON.stringify(b)); } };
const G=[1,2,4,5,6];
// TEST DATA ONLY
const eve = {arrive: 1160, leave: 1165, note: null};
const mid = {arrive: 1450, leave: 1455, note: null};
const monthu = {arrive: 1020, leave: 1025, note: {days:[1,4]}};
// Saturday 2026-11-07 21:00 -> next is Monday 11-09 19:20 (Sun off)
let v = S.nextVisits(eve, {now: tp(2026,11,7,21,0), generalDays: G})[0];
eq(v.date, "2026-11-09", "skip Sunday"); eq(v.arriveMs, tp(2026,11,9,19,20), "arrive instant");
// Wednesday 00:05: Tuesday's 24:10 trip still ahead
v = S.nextVisits(mid, {now: tp(2026,11,11,0,5), generalDays: G})[0];
eq(v.date, "2026-11-10", "after-midnight trip"); eq(S.comesToday(v, tp(2026,11,11,0,5)), true, "comes today");
// Missed: Monday 19:30 -> Tuesday
v = S.nextVisits(eve, {now: tp(2026,11,9,19,30), generalDays: G})[0];
eq(v.date, "2026-11-10", "missed -> next");
// stop note days
v = S.nextVisits(monthu, {now: tp(2026,11,10,8,0), generalDays: G})[0];
eq(v.date, "2026-11-12", "note days Mon/Thu");
// suspension exception
v = S.nextVisits(eve, {now: tp(2026,11,8,9,0), generalDays: G, exceptions:[{date:"2026-11-09",type:"suspend",groups:["all"]}]})[0];
eq(v.date, "2026-11-10", "suspended date skipped");
// drop-off hours
eq(S.isOpen({"6":[[360,1380]]}, tp(2026,11,7,21,0)), true, "open Sat 21:00");
eq(S.isOpen({"6":[[360,1380]]}, tp(2026,11,7,23,30)), false, "closed 23:30");
print(fails ? fails+" failed" : "all JS schedule checks passed");
