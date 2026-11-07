// SPDX-License-Identifier: AGPL-3.0-or-later
//
// Saved stops and collection reminders for Trash Helper.
//
// * Saved stops and reminder settings are stored by the app (SharedPreferences), so they
//   survive a change of the page's address.
// * Reminder times are computed here from the bundled timetable, never taken from the page.
// * Notifications are one-off OS schedules for the next 8 weeks (nearest first, at most
//   [maxPending] for this feature, leaving room in iOS's 64-notification limit for others).
//   They are reconciled on launch, on return to the foreground and after every change, so
//   saving twice never leaves duplicates. Only notifications whose payload marks them as
//   ours are ever cancelled.
import 'dart:async';
import 'dart:convert';
import 'dart:math';

import 'package:town_pass/page/trash_helper/trash_data.dart';
import 'package:town_pass/page/trash_helper/trash_schedule.dart';

const String trashPayloadSource = 'trash_helper';

/// Minimal key-value storage (SharedPreferences in the app, a map in tests).
abstract class TrashKeyValue {
  String? getString(String key);
  Future<void> setString(String key, String value);
}

class PendingTrashNotification {
  final int id;
  final Map<String, dynamic> payload;

  const PendingTrashNotification(this.id, this.payload);
}

/// The OS notification scheduler, abstracted for tests.
abstract class TrashNotifier {
  /// Whether notifications are allowed; asks the user first when [request] is true.
  Future<bool> permissionGranted({bool request = false});

  /// Pending notifications that belong to Trash Helper (payload src == trash_helper).
  Future<List<PendingTrashNotification>> pending();

  Future<void> schedule({required int id, required DateTime at, required String title, required String body, required String payload});

  Future<void> cancel(int id);

  String get platform;
}

class TrashFavorite {
  final String stopId;
  final String nickname;
  final String savedAt;
  final Map<String, dynamic> snapshot;
  final String dataVersion;

  const TrashFavorite({required this.stopId, this.nickname = '', required this.savedAt, required this.snapshot, required this.dataVersion});

  TrashFavorite copyWith({String? nickname}) =>
      TrashFavorite(stopId: stopId, nickname: nickname ?? this.nickname, savedAt: savedAt, snapshot: snapshot, dataVersion: dataVersion);

  Map<String, dynamic> toJson() => {'stopId': stopId, 'nickname': nickname, 'savedAt': savedAt, 'snapshot': snapshot, 'dataVersion': dataVersion};

  static TrashFavorite? fromJson(Object? j) {
    if (j is! Map || j['stopId'] is! String) return null;
    return TrashFavorite(
      stopId: j['stopId'] as String,
      nickname: (j['nickname'] as String?) ?? '',
      savedAt: (j['savedAt'] as String?) ?? '',
      snapshot: j['snapshot'] is Map ? Map<String, dynamic>.from(j['snapshot'] as Map) : const {},
      dataVersion: (j['dataVersion'] as String?) ?? '',
    );
  }
}

class TrashReminder {
  final String reminderId;
  final String stopId;
  final int weekday;
  final int leadMinutes;
  final ReminderFrequency frequency;
  final bool enabled;

  /// First collection date of the cycle (Taipei). Every-2-weeks reminders count from it.
  final TaipeiDate? anchor;
  final String dataVersion;
  final String lang;

  /// Native notification IDs scheduled for this reminder at the last reconcile.
  final List<int> nativeIds;
  final Map<String, dynamic> status;

  const TrashReminder({
    required this.reminderId,
    required this.stopId,
    required this.weekday,
    required this.leadMinutes,
    required this.frequency,
    required this.enabled,
    required this.anchor,
    required this.dataVersion,
    this.lang = 'zh',
    this.nativeIds = const [],
    this.status = const {},
  });

  TrashReminder copyWith({TaipeiDate? anchor, List<int>? nativeIds, Map<String, dynamic>? status}) => TrashReminder(
        reminderId: reminderId,
        stopId: stopId,
        weekday: weekday,
        leadMinutes: leadMinutes,
        frequency: frequency,
        enabled: enabled,
        anchor: anchor ?? this.anchor,
        dataVersion: dataVersion,
        lang: lang,
        nativeIds: nativeIds ?? this.nativeIds,
        status: status ?? this.status,
      );

  Map<String, dynamic> toJson() => {
        'reminderId': reminderId,
        'stopId': stopId,
        'weekday': weekday,
        'leadMinutes': leadMinutes,
        'frequency': frequency.name,
        'enabled': enabled,
        'anchorDate': anchor?.key,
        'dataVersion': dataVersion,
        'lang': lang,
        'nativeIds': nativeIds,
        'status': status,
      };

  static TrashReminder? fromJson(Object? j) {
    if (j is! Map) return null;
    final f = ReminderFrequency.parse(j['frequency']);
    if (j['reminderId'] is! String || j['stopId'] is! String || j['weekday'] is! int || j['leadMinutes'] is! int || f == null) return null;
    return TrashReminder(
      reminderId: j['reminderId'] as String,
      stopId: j['stopId'] as String,
      weekday: j['weekday'] as int,
      leadMinutes: j['leadMinutes'] as int,
      frequency: f,
      enabled: j['enabled'] != false,
      anchor: TaipeiDate.tryParse(j['anchorDate'] as String?),
      dataVersion: (j['dataVersion'] as String?) ?? '',
      lang: (j['lang'] as String?) == 'en' ? 'en' : 'zh',
      nativeIds: j['nativeIds'] is List ? List<int>.from((j['nativeIds'] as List).whereType<int>()) : const [],
      status: j['status'] is Map ? Map<String, dynamic>.from(j['status'] as Map) : const {},
    );
  }
}

/// Thrown for page input the app refuses (bad type, unknown stop, out-of-range value).
class TrashInputError implements Exception {
  final String code;

  const TrashInputError(this.code);

  @override
  String toString() => code;
}

class TrashReminderService {
  static const storeKey = 'trash_helper.store.v1';
  static const maxPending = 40;
  static const windowDays = 56;
  static const maxFavorites = 30;
  static const maxReminders = 20;

  /// Notification IDs of this feature live in [idBase, idBase + idSpan); the test
  /// notification uses [testId]. Other app notifications count up from 0.
  static const idBase = 0x50000000;
  static const idSpan = 0x0FFFFFF0;
  static const testId = idBase + idSpan + 1;

  final TrashKeyValue kv;
  final TrashNotifier notifier;
  final Future<TrashData> Function() loadData;
  final DateTime Function() clock;

  TrashReminderService({required this.kv, required this.notifier, required this.loadData, DateTime Function()? clock}) : clock = clock ?? DateTime.now;

  List<TrashFavorite> _favorites = [];
  List<TrashReminder> _reminders = [];
  bool _loaded = false;
  Future<void> _queue = Future.value();

  List<TrashFavorite> get favorites => List.unmodifiable(_favorites);
  List<TrashReminder> get reminders => List.unmodifiable(_reminders);

  /// Runs [task] after every earlier task, so overlapping page requests cannot interleave.
  Future<T> _serial<T>(Future<T> Function() task) {
    final c = Completer<T>();
    _queue = _queue.then((_) async {
      try {
        c.complete(await task());
      } catch (e, s) {
        c.completeError(e, s);
      }
    });
    return c.future;
  }

  void _ensureLoaded() {
    if (_loaded) return;
    _loaded = true;
    final raw = kv.getString(storeKey);
    if (raw == null) return;
    try {
      final j = jsonDecode(raw) as Map<String, dynamic>;
      _favorites = (j['favorites'] as List? ?? const []).map(TrashFavorite.fromJson).whereType<TrashFavorite>().toList();
      _reminders = (j['reminders'] as List? ?? const []).map(TrashReminder.fromJson).whereType<TrashReminder>().toList();
    } catch (_) {
      // Unreadable store: start empty rather than crash. The raw value stays until the next save.
    }
  }

  Future<void> _persist() => kv.setString(
        storeKey,
        jsonEncode({'version': 1, 'favorites': _favorites.map((f) => f.toJson()).toList(), 'reminders': _reminders.map((r) => r.toJson()).toList()}),
      );

  Future<Map<String, dynamic>> snapshot() async {
    _ensureLoaded();
    final granted = await notifier.permissionGranted();
    return {
      'ok': true,
      'favorites': _favorites.map((f) => f.toJson()).toList(),
      'reminders': _reminders.map(_publicReminder).toList(),
      'permission': granted ? 'granted' : 'denied',
      'platform': notifier.platform,
    };
  }

  Map<String, dynamic> _publicReminder(TrashReminder r) {
    final j = r.toJson();
    j.remove('nativeIds');
    return j;
  }

  // ------------------------------------------------------------------ favourites

  Future<Map<String, dynamic>> saveFavorite(Object? stopId, {Object? nickname}) => _serial(() async {
        _ensureLoaded();
        final data = await loadData();
        final stop = stopId is String ? data.stops[stopId] : null;
        if (stop == null) throw const TrashInputError('unknown-stop');
        if (!_favorites.any((f) => f.stopId == stop.id)) {
          if (_favorites.length >= maxFavorites) throw const TrashInputError('too-many');
          _favorites.add(TrashFavorite(
            stopId: stop.id,
            nickname: _cleanName(nickname),
            savedAt: clock().toUtc().toIso8601String(),
            snapshot: {
              'address': stop.address, 'district': stop.district, 'village': stop.village, 'route': stop.route,
              'trip': stop.trip, 'arrive': stop.arrive, 'leave': stop.leave, 'lat': stop.lat, 'lng': stop.lng,
            },
            dataVersion: data.version,
          ));
          await _persist();
        }
        return snapshot();
      });

  Future<Map<String, dynamic>> renameFavorite(Object? stopId, Object? nickname) => _serial(() async {
        _ensureLoaded();
        final i = _favorites.indexWhere((f) => f.stopId == stopId);
        if (i < 0) throw const TrashInputError('not-saved');
        _favorites[i] = _favorites[i].copyWith(nickname: _cleanName(nickname));
        await _persist();
        return snapshot();
      });

  /// Removing a saved stop also deletes its reminders and their notifications.
  Future<Map<String, dynamic>> removeFavorite(Object? stopId) => _serial(() async {
        _ensureLoaded();
        _favorites.removeWhere((f) => f.stopId == stopId);
        _reminders.removeWhere((r) => r.stopId == stopId);
        await _persist();
        await _reconcile();
        return snapshot();
      });

  static String _cleanName(Object? s) => s is String ? s.trim().replaceAll(RegExp(r'[\u0000-\u001f]'), '').characters40 : '';

  // ------------------------------------------------------------------ reminders

  /// Validates page input against the bundled timetable. Returns the reminder to save.
  Future<TrashReminder> _validate(Object? input, {required bool keepAnchor}) async {
    if (input is! Map) throw const TrashInputError('bad-input');
    final data = await loadData();
    final stopId = input['stopId'];
    final stop = stopId is String ? data.stops[stopId] : null;
    if (stop == null) throw const TrashInputError('unknown-stop');
    final weekday = input['weekday'];
    if (weekday is! int || !data.schedule.isValidWeekday(stop, weekday)) throw const TrashInputError('bad-weekday');
    final lead = input['leadMinutes'];
    if (lead is! int || lead < 1 || lead > 120) throw const TrashInputError('bad-lead');
    final freq = ReminderFrequency.parse(input['frequency']);
    if (freq == null) throw const TrashInputError('bad-frequency');
    final enabled = input['enabled'] != false;
    final lang = input['lang'] == 'en' ? 'en' : 'zh';

    final id = input['reminderId'];
    final existing = id is String ? _reminders.where((r) => r.reminderId == id).firstOrNull : null;
    if (id != null && existing == null) throw const TrashInputError('unknown-reminder');
    if (existing != null && existing.stopId != stop.id) throw const TrashInputError('stop-mismatch');

    final now = clock();
    // Changing only the lead time or turning the reminder on/off keeps the anchor, so an
    // every-2-weeks cycle stays on the same weeks. A new weekday starts a new cycle.
    TaipeiDate? anchor;
    if (keepAnchor && existing?.anchor != null && existing!.weekday == weekday && existing.frequency != ReminderFrequency.once && freq != ReminderFrequency.once) {
      anchor = existing.anchor;
    } else if (keepAnchor && existing?.anchor != null && existing!.weekday == weekday && freq == ReminderFrequency.once) {
      final a = existing.anchor!;
      anchor = a.at(stop.arrive).subtract(Duration(minutes: lead)).isAfter(now) ? a : null;
    }
    anchor ??= data.schedule.firstAnchor(stop: stop, weekday: weekday, leadMinutes: lead, now: now);
    if (anchor == null) throw const TrashInputError('no-date');
    return TrashReminder(
      reminderId: existing?.reminderId ?? _newId(),
      stopId: stop.id,
      weekday: weekday,
      leadMinutes: lead,
      frequency: freq,
      enabled: enabled,
      anchor: anchor,
      dataVersion: data.version,
      lang: lang,
      nativeIds: existing?.nativeIds ?? const [],
      status: existing?.status ?? const {},
    );
  }

  String _newId() {
    final r = Random.secure();
    return 'r${clock().millisecondsSinceEpoch.toRadixString(36)}${r.nextInt(1 << 30).toRadixString(36)}';
  }

  Future<Map<String, dynamic>> preview(Object? input) => _serial(() async {
        _ensureLoaded();
        final r = await _validate(input, keepAnchor: true);
        final data = await loadData();
        final occ = data.schedule.occurrences(
          stop: data.stops[r.stopId]!, anchor: r.anchor!, leadMinutes: r.leadMinutes, frequency: r.frequency, now: clock(), windowDays: windowDays);
        return {'ok': true, 'preview': {'anchorDate': r.anchor!.key, 'occurrences': occ.map((o) => o.toJson()).toList()}};
      });

  /// Saves a reminder (asking for notification permission if it is enabled) and reschedules.
  Future<Map<String, dynamic>> saveReminder(Object? input) => _serial(() async {
        _ensureLoaded();
        final r = await _validate(input, keepAnchor: true);
        if (!_favorites.any((f) => f.stopId == r.stopId)) {
          // A reminder implies the stop is saved; saving a stop never asks for notifications.
          final data = await loadData();
          final s = data.stops[r.stopId]!;
          _favorites.add(TrashFavorite(
              stopId: s.id,
              savedAt: clock().toUtc().toIso8601String(),
              snapshot: {'address': s.address, 'district': s.district, 'village': s.village, 'route': s.route, 'trip': s.trip, 'arrive': s.arrive, 'leave': s.leave, 'lat': s.lat, 'lng': s.lng},
              dataVersion: data.version));
        }
        final i = _reminders.indexWhere((x) => x.reminderId == r.reminderId);
        if (i >= 0) {
          _reminders[i] = r;
        } else {
          if (_reminders.length >= maxReminders) throw const TrashInputError('too-many');
          _reminders.add(r);
        }
        await _persist();
        await _reconcile(requestPermission: r.enabled);
        final saved = _reminders.firstWhere((x) => x.reminderId == r.reminderId);
        return {...await snapshot(), 'reminder': _publicReminder(saved)};
      });

  Future<Map<String, dynamic>> cancelReminder(Object? reminderId) => _serial(() async {
        _ensureLoaded();
        if (reminderId is! String || !_reminders.any((r) => r.reminderId == reminderId)) throw const TrashInputError('unknown-reminder');
        _reminders.removeWhere((r) => r.reminderId == reminderId);
        await _persist();
        await _reconcile();
        return snapshot();
      });

  /// One notification about a stop one minute from now, to check delivery and tapping.
  Future<Map<String, dynamic>> scheduleTest(Object? stopId, {String lang = 'zh'}) => _serial(() async {
        final data = await loadData();
        final stop = stopId is String ? data.stops[stopId] : null;
        if (stop == null) throw const TrashInputError('unknown-stop');
        if (!await notifier.permissionGranted(request: true)) return {'ok': false, 'permission': 'denied'};
        final at = clock().add(const Duration(minutes: 1));
        final text = _texts(stop, null, stop.arrive, lang, leadMinutes: 1, test: true);
        await notifier.cancel(testId);
        await notifier.schedule(id: testId, at: at, title: text.$1, body: text.$2, payload: jsonEncode({'src': trashPayloadSource, 'stopId': stop.id, 'test': true}));
        final ok = (await notifier.pending()).any((p) => p.id == testId);
        return {'ok': ok, 'at': at.toUtc().toIso8601String()};
      });

  /// Recompute and reconcile all notifications (app launch, foreground, data change).
  Future<void> reschedule() => _serial(() async {
        _ensureLoaded();
        await _reconcile();
      });

  static int notificationId(String reminderId, DateTime notify) {
    // FNV-1a over the reminder ID and the reminder instant: stable across launches.
    var h = 0x811c9dc5;
    for (final c in utf8.encode('$reminderId|${notify.toUtc().toIso8601String()}')) {
      h ^= c;
      h = (h * 0x01000193) & 0xffffffff;
    }
    return idBase + (h % idSpan);
  }

  (String, String) _texts(TrashStop stop, String? nickname, int arrive, String lang, {required int leadMinutes, bool test = false}) {
    final place = (nickname != null && nickname.isNotEmpty) ? nickname : stop.address.replaceFirst('臺北市', '').replaceFirst(stop.district, '');
    final hh = ((arrive % 1440) ~/ 60).toString().padLeft(2, '0');
    final mm = (arrive % 60).toString().padLeft(2, '0');
    if (lang == 'en') {
      return (
        '${test ? '[Test] ' : ''}TownPass · TossTalk',
        'The garbage truck is due at $place in $leadMinutes min ($hh:$mm). Take your trash down! Times follow the timetable.',
      );
    }
    return (
      '${test ? '【測試】' : ''}台北通・丟丟',
      '垃圾車預定 $leadMinutes 分鐘後到$place（$hh:$mm），帶垃圾下樓吧！提醒依預定班表。',
    );
  }

  Future<void> _reconcile({bool requestPermission = false}) async {
    final data = await loadData();
    final now = clock();
    final granted = await notifier.permissionGranted(request: requestPermission);

    // 1. What should be scheduled, per reminder.
    final planned = <String, List<(int, ReminderOccurrence)>>{};
    final allOcc = <String, List<ReminderOccurrence>>{};
    final candidates = <(String, int, ReminderOccurrence)>[];
    for (final r in _reminders) {
      final stop = data.stops[r.stopId];
      if (stop == null || r.anchor == null || !data.schedule.isValidWeekday(stop, r.weekday)) continue;
      final occ = data.schedule.occurrences(stop: stop, anchor: r.anchor!, leadMinutes: r.leadMinutes, frequency: r.frequency, now: now, windowDays: windowDays);
      allOcc[r.reminderId] = occ;
      if (!r.enabled || !granted) continue;
      for (final o in occ.where((o) => !o.skipped)) {
        candidates.add((r.reminderId, notificationId(r.reminderId, o.notify), o));
      }
    }
    candidates.sort((a, b) => a.$3.notify.compareTo(b.$3.notify));
    final chosen = candidates.take(maxPending).toList();
    final desired = <int, (String, ReminderOccurrence)>{};
    for (final c in chosen) {
      desired[c.$2] = (c.$1, c.$3);
      planned.putIfAbsent(c.$1, () => []).add((c.$2, c.$3));
    }

    // 2. Cancel ours that are no longer wanted, schedule what is missing.
    final before = await notifier.pending();
    final beforeIds = {for (final p in before) p.id};
    for (final p in before) {
      if (p.id == testId || p.payload['test'] == true) continue;
      if (!desired.containsKey(p.id)) await notifier.cancel(p.id);
    }
    final failed = <int>{};
    for (final e in desired.entries) {
      if (beforeIds.contains(e.key)) continue;
      final r = _reminders.firstWhere((x) => x.reminderId == e.value.$1);
      final stop = data.stops[r.stopId]!;
      final nick = _favorites.where((f) => f.stopId == r.stopId).firstOrNull?.nickname;
      final text = _texts(stop, nick, stop.arrive, r.lang, leadMinutes: r.leadMinutes);
      try {
        await notifier.schedule(
          id: e.key,
          at: e.value.$2.notify,
          title: text.$1,
          body: text.$2,
          payload: jsonEncode({'src': trashPayloadSource, 'stopId': r.stopId, 'reminderId': r.reminderId}),
        );
      } catch (_) {
        failed.add(e.key);
      }
    }

    // 3. Status from what the OS actually has pending.
    final after = {for (final p in await notifier.pending()) p.id};
    _reminders = _reminders.map((r) {
      final stop = data.stops[r.stopId];
      final occ = allOcc[r.reminderId] ?? const <ReminderOccurrence>[];
      final mine = planned[r.reminderId] ?? const [];
      final present = mine.where((m) => after.contains(m.$1)).toList();
      String state;
      if (stop == null || r.anchor == null) {
        state = 'invalid';
      } else if (!r.enabled) {
        state = 'disabled';
      } else if (!granted) {
        state = 'denied';
      } else if (occ.where((o) => !o.skipped).isEmpty) {
        state = 'none';
      } else if (present.isNotEmpty && present.length == mine.length) {
        state = 'scheduled';
      } else {
        state = 'partial';
      }
      final status = <String, dynamic>{
        'state': state,
        'count': present.length,
        if (present.isNotEmpty) 'nextNotify': present.first.$2.notify.toUtc().toIso8601String(),
        if (present.isNotEmpty) 'until': present.last.$2.serviceDate.key,
        'occurrences': occ.take(8).map((o) => o.toJson()).toList(),
        'checkedAt': now.toUtc().toIso8601String(),
      };
      return r.copyWith(nativeIds: present.map((m) => m.$1).toList(), status: status);
    }).toList();
    await _persist();
  }
}

extension on String {
  String get characters40 => runes.length <= 40 ? this : String.fromCharCodes(runes.take(40));
}
