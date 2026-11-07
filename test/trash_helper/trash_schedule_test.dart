import 'package:flutter_test/flutter_test.dart';
import 'package:town_pass/page/trash_helper/trash_schedule.dart';

import 'fixtures.dart';

void main() {
  const schedule = TrashSchedule();

  group('TaipeiDate', () {
    test('wall-clock minutes map to the right instant, whatever the device zone', () {
      expect(const TaipeiDate(2026, 11, 9).at(19 * 60 + 20), DateTime.utc(2026, 11, 9, 11, 20));
      expect(const TaipeiDate(2026, 11, 10).at(24 * 60 + 10), DateTime.utc(2026, 11, 10, 16, 10)); // 11-11 00:10 Taipei
      expect(TaipeiDate.of(DateTime.utc(2026, 11, 8, 16, 30)), const TaipeiDate(2026, 11, 9)); // 00:30 Taipei
      expect(const TaipeiDate(2026, 11, 9).weekday, 1); // Monday
      expect(const TaipeiDate(2026, 11, 11).weekday, 3); // Wednesday
    });

    test('parses only real dates', () {
      expect(TaipeiDate.tryParse('2026-11-09'), const TaipeiDate(2026, 11, 9));
      expect(TaipeiDate.tryParse('2026-02-30'), isNull);
      expect(TaipeiDate.tryParse('nope'), isNull);
    });
  });

  group('collection days', () {
    test('Wednesday and Sunday are never valid reminder days', () {
      expect(schedule.isValidWeekday(testStopEvening, 3), isFalse);
      expect(schedule.isValidWeekday(testStopEvening, 0), isFalse);
      expect(schedule.isValidWeekday(testStopEvening, 1), isTrue);
    });

    test("a stop's own note narrows the days", () {
      expect(schedule.isValidWeekday(testStopMonThu, 2), isFalse);
      expect(schedule.isValidWeekday(testStopMonThu, 4), isTrue);
    });
  });

  group('spec example: Monday 19:20, 15 minutes early, every 2 weeks', () {
    final now = taipei(2026, 11, 7, 10, 0);

    test('anchor is the next Monday and reminders fall on 11-09 and 11-23 at 19:05; 11-16 is skipped', () {
      final anchor = schedule.firstAnchor(stop: testStopEvening, weekday: 1, leadMinutes: 15, now: now)!;
      expect(anchor, const TaipeiDate(2026, 11, 9));
      final occ = schedule.occurrences(stop: testStopEvening, anchor: anchor, leadMinutes: 15, frequency: ReminderFrequency.biweekly, now: now);
      expect(occ.take(2).map((o) => o.notify), [taipei(2026, 11, 9, 19, 5), taipei(2026, 11, 23, 19, 5)]);
      expect(occ.any((o) => o.serviceDate == const TaipeiDate(2026, 11, 16)), isFalse);
      expect(occ.first.collection, taipei(2026, 11, 9, 19, 20));
    });

    test('changing the lead time keeps the same weeks', () {
      const anchor = TaipeiDate(2026, 11, 9);
      final later = taipei(2026, 11, 10, 8, 0); // after the first reminder
      final occ = schedule.occurrences(stop: testStopEvening, anchor: anchor, leadMinutes: 30, frequency: ReminderFrequency.biweekly, now: later);
      expect(occ.first.notify, taipei(2026, 11, 23, 18, 50));
    });

    test('weekly reminders include 11-16', () {
      final occ = schedule.occurrences(stop: testStopEvening, anchor: const TaipeiDate(2026, 11, 9), leadMinutes: 15, frequency: ReminderFrequency.weekly, now: now);
      expect(occ.take(3).map((o) => o.serviceDate.key), ['2026-11-09', '2026-11-16', '2026-11-23']);
      expect(occ.length, 8); // 8-week window
    });
  });

  test('a reminder time already passed moves to the next matching visit', () {
    final now = taipei(2026, 11, 9, 19, 10); // after 19:05, before the truck
    expect(schedule.firstAnchor(stop: testStopEvening, weekday: 1, leadMinutes: 15, now: now), const TaipeiDate(2026, 11, 16));
    final once = schedule.occurrences(stop: testStopEvening, anchor: const TaipeiDate(2026, 11, 9), leadMinutes: 15, frequency: ReminderFrequency.once, now: now);
    expect(once, isEmpty);
  });

  test('after-midnight trip belongs to the previous service day', () {
    // Tuesday's trip at 24:10 = Wednesday 00:10. At Wednesday 00:01 it is still ahead.
    final now = taipei(2026, 11, 11, 0, 1);
    final anchor = schedule.firstAnchor(stop: testStopMidnight, weekday: 2, leadMinutes: 5, now: now);
    expect(anchor, const TaipeiDate(2026, 11, 10));
    final occ = schedule.occurrences(stop: testStopMidnight, anchor: anchor!, leadMinutes: 5, frequency: ReminderFrequency.weekly, now: now);
    expect(occ.first.collection, taipei(2026, 11, 11, 0, 10));
    expect(occ.first.notify, taipei(2026, 11, 11, 0, 5));
  });

  test('an announced suspension is skipped but keeps the cycle', () {
    final s = TrashSchedule(exceptions: [CollectionException(date: const TaipeiDate(2026, 11, 16), type: 'suspend')]);
    final occ = s.occurrences(stop: testStopEvening, anchor: const TaipeiDate(2026, 11, 9), leadMinutes: 10, frequency: ReminderFrequency.weekly, now: taipei(2026, 11, 7));
    expect(occ[1].serviceDate.key, '2026-11-16');
    expect(occ[1].skipped, isTrue);
    expect(occ[2].serviceDate.key, '2026-11-23');
    expect(occ[2].skipped, isFalse);
    // A new reminder does not anchor on a suspended date.
    expect(s.firstAnchor(stop: testStopEvening, weekday: 1, leadMinutes: 10, now: taipei(2026, 11, 10)), const TaipeiDate(2026, 11, 23));
  });
}
