import 'dart:convert';

import 'package:flutter_test/flutter_test.dart';
import 'package:town_pass/page/trash_helper/trash_data.dart';
import 'package:town_pass/page/trash_helper/trash_reminders.dart';
import 'package:town_pass/page/trash_helper/trash_schedule.dart';

import 'fixtures.dart';

class MemoryKV implements TrashKeyValue {
  final Map<String, String> data = {};

  @override
  String? getString(String key) => data[key];

  @override
  Future<void> setString(String key, String value) async => data[key] = value;
}

class FakeNotifier implements TrashNotifier {
  bool granted;
  final Map<int, (DateTime, String, String)> scheduled = {};
  int scheduleCalls = 0;
  int cancelCalls = 0;
  Set<int> refuse = {};

  FakeNotifier({this.granted = true});

  @override
  String get platform => 'ios';

  @override
  Future<bool> permissionGranted({bool request = false}) async => granted;

  @override
  Future<List<PendingTrashNotification>> pending() async => [
        for (final e in scheduled.entries)
          if ((jsonDecode(e.value.$3) as Map)['src'] == trashPayloadSource)
            PendingTrashNotification(e.key, Map<String, dynamic>.from(jsonDecode(e.value.$3) as Map)),
      ];

  @override
  Future<void> schedule({required int id, required DateTime at, required String title, required String body, required String payload}) async {
    scheduleCalls++;
    if (refuse.contains(id)) throw StateError('refused');
    scheduled[id] = (at, title, payload);
  }

  @override
  Future<void> cancel(int id) async {
    cancelCalls++;
    scheduled.remove(id);
  }

  int countFor(String reminderId) => scheduled.values.where((v) => (jsonDecode(v.$3) as Map)['reminderId'] == reminderId).length;
}

void main() {
  late MemoryKV kv;
  late FakeNotifier notifier;
  late DateTime now;
  late TrashData data;

  TrashReminderService make() => TrashReminderService(kv: kv, notifier: notifier, loadData: () async => data, clock: () => now);

  setUp(() {
    kv = MemoryKV();
    notifier = FakeNotifier();
    now = taipei(2026, 11, 7, 10, 0);
    data = testData();
    // Another feature's notification must never be touched.
    notifier.scheduled[3] = (DateTime.utc(2030), 'other', jsonEncode({'src': 'subscription'}));
  });

  Map<String, dynamic> input({String? id, int weekday = 1, int lead = 15, String freq = 'biweekly', bool enabled = true, String stopId = 'test-evening'}) =>
      {if (id != null) 'reminderId': id, 'stopId': stopId, 'weekday': weekday, 'leadMinutes': lead, 'frequency': freq, 'enabled': enabled};

  test('saving a stop does not ask for notifications; saved stops survive a restart', () async {
    notifier.granted = false;
    final s = make();
    await s.saveFavorite('test-evening', nickname: '家門口');
    expect(notifier.scheduleCalls, 0);
    final reopened = make();
    final snap = await reopened.snapshot();
    expect((snap['favorites'] as List).single['nickname'], '家門口');
  });

  test('unknown stop and out-of-range values are refused', () async {
    final s = make();
    expect(() => s.saveFavorite('not-a-stop'), throwsA(isA<TrashInputError>()));
    expect(() => s.saveReminder(input(weekday: 3)), throwsA(isA<TrashInputError>())); // Wednesday
    expect(() => s.saveReminder(input(lead: 0)), throwsA(isA<TrashInputError>()));
    expect(() => s.saveReminder(input(lead: 121)), throwsA(isA<TrashInputError>()));
    expect(() => s.saveReminder(input(freq: 'daily')), throwsA(isA<TrashInputError>()));
    expect(() => s.saveReminder({'stopId': 'test-evening', 'weekday': '1', 'leadMinutes': 15, 'frequency': 'weekly'}), throwsA(isA<TrashInputError>()));
    expect(() => s.saveReminder(input(stopId: 'test-monthu', weekday: 2)), throwsA(isA<TrashInputError>()));
  });

  test('biweekly reminder schedules 11-09 and 11-23 at 19:05 and reports the native result', () async {
    final s = make();
    final r = await s.saveReminder(input());
    final rem = r['reminder'] as Map;
    expect(rem['anchorDate'], '2026-11-09');
    expect(rem['status']['state'], 'scheduled');
    expect(rem['status']['count'], 4); // 8-week window, every 2 weeks
    final times = notifier.scheduled.values.where((v) => v.$2 != 'other').map((v) => v.$1).toList()..sort();
    expect(times.take(2), [taipei(2026, 11, 9, 19, 5), taipei(2026, 11, 23, 19, 5)]);
    expect(DateTime.parse(rem['status']['nextNotify'] as String), taipei(2026, 11, 9, 19, 5));
  });

  test('saving the same reminder again leaves exactly one set of notifications', () async {
    final s = make();
    final first = await s.saveReminder(input());
    final id = (first['reminder'] as Map)['reminderId'] as String;
    final ids = notifier.scheduled.keys.toSet();
    await s.saveReminder(input(id: id));
    await s.reschedule();
    await make().reschedule(); // app relaunch
    expect(notifier.scheduled.keys.toSet(), ids);
    expect(notifier.countFor(id), 4);
  });

  test('changing the lead time keeps the anchor and replaces the old notifications', () async {
    final s = make();
    final id = ((await s.saveReminder(input()))['reminder'] as Map)['reminderId'] as String;
    now = taipei(2026, 11, 10, 8, 0); // first reminder already fired
    final r = await s.saveReminder(input(id: id, lead: 30));
    expect((r['reminder'] as Map)['anchorDate'], '2026-11-09');
    final times = notifier.scheduled.values.where((v) => v.$2 != 'other').map((v) => v.$1).toList()..sort();
    expect(times.first, taipei(2026, 11, 23, 18, 50));
    expect(notifier.countFor(id), 4);
  });

  test('turning a reminder off, deleting it, or removing the stop cancels only its notifications', () async {
    final s = make();
    final a = ((await s.saveReminder(input()))['reminder'] as Map)['reminderId'] as String;
    final b = ((await s.saveReminder(input(stopId: 'test-monthu', weekday: 4, freq: 'weekly')))['reminder'] as Map)['reminderId'] as String;
    expect(notifier.countFor(b), 8);

    final off = await s.saveReminder(input(id: a, enabled: false));
    expect((off['reminder'] as Map)['status']['state'], 'disabled');
    expect(notifier.countFor(a), 0);
    expect(notifier.countFor(b), 8);

    await s.cancelReminder(b);
    expect(notifier.countFor(b), 0);

    await s.saveReminder(input(id: a, enabled: true));
    expect(notifier.countFor(a), 4);
    await s.removeFavorite('test-evening');
    expect(notifier.countFor(a), 0);
    expect(notifier.scheduled.containsKey(3), isTrue, reason: 'other features untouched');
  });

  test('permission denied: nothing is scheduled and the status says so', () async {
    notifier.granted = false;
    final r = await make().saveReminder(input());
    expect((r['reminder'] as Map)['status']['state'], 'denied');
    expect(notifier.scheduled.keys, [3]);
    expect((r['favorites'] as List), hasLength(1), reason: 'stop stays saved and editable');
  });

  test('a scheduling failure is reported as partial, not as success', () async {
    final s = make();
    final firstNotify = taipei(2026, 11, 9, 19, 5);
    // We do not know the id before saving, so refuse by computing it the same way.
    final r0 = await s.saveReminder(input(enabled: false));
    final id = (r0['reminder'] as Map)['reminderId'] as String;
    notifier.refuse = {TrashReminderService.notificationId(id, firstNotify)};
    final r = await s.saveReminder(input(id: id));
    expect((r['reminder'] as Map)['status']['state'], 'partial');
    expect((r['reminder'] as Map)['status']['count'], 3);
  });

  test('a known suspension date is not scheduled', () async {
    data = testData(exceptions: [CollectionException(date: const TaipeiDate(2026, 11, 16), type: 'suspend')]);
    final s = make();
    final r = await s.saveReminder(input(freq: 'weekly'));
    final dates = notifier.scheduled.values.where((v) => v.$2 != 'other').map((v) => TaipeiDate.of(v.$1).key).toSet();
    expect(dates.contains('2026-11-16'), isFalse);
    expect(dates.contains('2026-11-23'), isTrue);
    final occ = ((r['reminder'] as Map)['status']['occurrences'] as List).cast<Map>();
    expect(occ.firstWhere((o) => o['date'] == '2026-11-16')['skipped'], isTrue);
  });

  test('a stop that disappears from the data cancels its notifications and is marked invalid', () async {
    final s = make();
    await s.saveReminder(input());
    data = TrashData(version: 'test-2', stops: {testStopMonThu.id: testStopMonThu}, schedule: data.schedule);
    await s.reschedule();
    expect(notifier.scheduled.keys, [3]);
    final snap = await s.snapshot();
    expect(((snap['reminders'] as List).single as Map)['status']['state'], 'invalid');
  });

  test('never more than maxPending notifications for this feature, nearest first', () async {
    final s = make();
    for (final wd in [1, 2, 4, 5, 6]) {
      await s.saveReminder(input(weekday: wd, freq: 'weekly'));
    }
    final ours = notifier.scheduled.values.where((v) => v.$2 != 'other').toList();
    expect(ours.length, TrashReminderService.maxPending);
  });

  test('notification ids are stable and stay out of other features\' range', () {
    final a = TrashReminderService.notificationId('r1', taipei(2026, 11, 9, 19, 5));
    expect(a, TrashReminderService.notificationId('r1', taipei(2026, 11, 9, 19, 5)));
    expect(a, greaterThanOrEqualTo(TrashReminderService.idBase));
    expect(a, lessThan(TrashReminderService.idBase + TrashReminderService.idSpan));
  });
}
