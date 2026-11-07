// SPDX-License-Identifier: AGPL-3.0-or-later
//
// Collection timetable and reminder dates for Trash Helper, in Asia/Taipei time
// (UTC+8, no daylight saving) whatever time zone the phone uses. Pure functions with an
// injectable "now", so the tests can pin the clock.

/// A calendar date in Taipei.
class TaipeiDate implements Comparable<TaipeiDate> {
  final int year;
  final int month;
  final int day;

  const TaipeiDate(this.year, this.month, this.day);

  static const offset = Duration(hours: 8);

  /// The Taipei calendar date of an instant.
  factory TaipeiDate.of(DateTime instant) {
    final t = instant.toUtc().add(offset);
    return TaipeiDate(t.year, t.month, t.day);
  }

  /// Parses `YYYY-MM-DD`.
  static TaipeiDate? tryParse(String? s) {
    final m = RegExp(r'^(\d{4})-(\d{2})-(\d{2})$').firstMatch(s ?? '');
    if (m == null) return null;
    final d = TaipeiDate(int.parse(m[1]!), int.parse(m[2]!), int.parse(m[3]!));
    final check = DateTime.utc(d.year, d.month, d.day);
    return check.month == d.month && check.day == d.day ? d : null;
  }

  DateTime get _utcMidnight => DateTime.utc(year, month, day);

  /// 0 = Sunday … 6 = Saturday (same as JavaScript and the stop data).
  int get weekday => _utcMidnight.weekday % 7;

  TaipeiDate addDays(int n) {
    final d = DateTime.utc(year, month, day + n);
    return TaipeiDate(d.year, d.month, d.day);
  }

  int daysUntil(TaipeiDate other) => other._utcMidnight.difference(_utcMidnight).inDays;

  /// The instant at [minutes] after midnight of this Taipei date (≥ 1440 = next day).
  DateTime at(int minutes) => _utcMidnight.add(Duration(minutes: minutes)).subtract(offset);

  String get key => '${year.toString().padLeft(4, '0')}-${month.toString().padLeft(2, '0')}-${day.toString().padLeft(2, '0')}';

  @override
  int compareTo(TaipeiDate other) => key.compareTo(other.key);

  @override
  bool operator ==(Object other) => other is TaipeiDate && other.key == key;

  @override
  int get hashCode => key.hashCode;

  @override
  String toString() => key;
}

/// One truck stop, as published in data/stops.json.
class TrashStop {
  final String id;
  final String district;
  final String village;
  final String address;
  final int arrive;
  final int leave;
  final double lat;
  final double lng;
  final String route;
  final String trip;

  /// Service days from the stop's own note (e.g. "週一、週四收運"); null = city-wide rule.
  final List<int>? noteDays;
  final bool noFood;
  final bool confirm;

  const TrashStop({
    required this.id,
    required this.district,
    required this.village,
    required this.address,
    required this.arrive,
    required this.leave,
    required this.lat,
    required this.lng,
    required this.route,
    required this.trip,
    this.noteDays,
    this.noFood = false,
    this.confirm = false,
  });

  /// From one row of stops.json: [district, village, address, arrive, leave, lat, lng, route, trip, id, note].
  factory TrashStop.fromRow(List<dynamic> row, List<dynamic> districts) {
    final note = row.length > 10 && row[10] is Map ? row[10] as Map : const {};
    return TrashStop(
      district: districts[row[0] as int] as String,
      village: row[1] as String,
      address: row[2] as String,
      arrive: row[3] as int,
      leave: row[4] as int,
      lat: (row[5] as num).toDouble(),
      lng: (row[6] as num).toDouble(),
      route: row[7] as String,
      trip: row[8] as String,
      id: row[9] as String,
      noteDays: note['days'] is List ? List<int>.from(note['days'] as List) : null,
      noFood: note['noFood'] == true,
      confirm: note['confirm'] == true,
    );
  }

  List<int> serviceDays(List<int> generalDays) => noteDays ?? generalDays;
}

/// An officially announced date that overrides the weekday rule (data/exceptions.json).
class CollectionException {
  final TaipeiDate date;
  final TaipeiDate? end;

  /// suspend = no collection; normal = collected as usual; extra = collected on a day that is normally off.
  final String type;
  final List<String> groups;

  const CollectionException({required this.date, this.end, required this.type, this.groups = const ['all']});

  static CollectionException? fromJson(Map<String, dynamic> j) {
    final d = TaipeiDate.tryParse(j['date'] as String?);
    if (d == null) return null;
    return CollectionException(
      date: d,
      end: TaipeiDate.tryParse(j['end'] as String?),
      type: (j['type'] as String?) ?? 'normal',
      groups: j['groups'] is List ? List<String>.from(j['groups'] as List) : const ['all'],
    );
  }

  bool covers(TaipeiDate day, String group) {
    final inRange = day == date || (end != null && date.compareTo(day) <= 0 && day.compareTo(end!) <= 0);
    return inRange && (groups.contains('all') || groups.contains(group));
  }
}

enum ReminderFrequency {
  once,
  weekly,
  biweekly;

  static ReminderFrequency? parse(Object? s) => switch (s) {
        'once' => once,
        'weekly' => weekly,
        'biweekly' => biweekly,
        _ => null,
      };

  int get periodDays => this == biweekly ? 14 : 7;
}

/// One reminder occurrence: the scheduled truck time and when to notify.
class ReminderOccurrence {
  final TaipeiDate serviceDate;
  final DateTime collection;
  final DateTime notify;

  /// The service day is suspended by an official exception: shown in the preview, not scheduled.
  final bool skipped;

  const ReminderOccurrence({required this.serviceDate, required this.collection, required this.notify, this.skipped = false});

  Map<String, dynamic> toJson() => {
        'date': serviceDate.key,
        'collection': collection.toUtc().toIso8601String(),
        'notify': notify.toUtc().toIso8601String(),
        if (skipped) 'skipped': true,
      };
}

class TrashSchedule {
  final List<int> generalDays;
  final List<CollectionException> exceptions;

  const TrashSchedule({this.generalDays = const [1, 2, 4, 5, 6], this.exceptions = const []});

  CollectionException? exceptionOn(TaipeiDate day, {String group = 'general'}) {
    for (final e in exceptions) {
      if (e.covers(day, group)) return e;
    }
    return null;
  }

  bool isCollectionDay(TrashStop stop, TaipeiDate day) {
    final ex = exceptionOn(day);
    if (ex?.type == 'suspend') return false;
    if (ex?.type == 'extra') return true;
    return stop.serviceDays(generalDays).contains(day.weekday);
  }

  bool isValidWeekday(TrashStop stop, int weekday) => stop.serviceDays(generalDays).contains(weekday);

  /// First service date on [weekday] whose reminder time is still in the future. Suspended
  /// dates are passed over. Used as the anchor of a new reminder.
  TaipeiDate? firstAnchor({required TrashStop stop, required int weekday, required int leadMinutes, required DateTime now, int horizonDays = 70}) {
    if (!isValidWeekday(stop, weekday)) return null;
    final today = TaipeiDate.of(now);
    for (var i = -1; i <= horizonDays; i++) {
      final d = today.addDays(i);
      if (d.weekday != weekday || !isCollectionDay(stop, d)) continue;
      final notify = d.at(stop.arrive).subtract(Duration(minutes: leadMinutes));
      if (notify.isAfter(now)) return d;
    }
    return null;
  }

  /// Reminder occurrences from [now] up to [now] + [windowDays].
  ///
  /// The cycle is anchored on [anchor]: every 7 days (weekly) or 14 days (biweekly) from it,
  /// in Taipei calendar days. An officially suspended date is reported as skipped and the
  /// cycle keeps its rhythm. Occurrences whose reminder time has passed are left out, so the
  /// first one is always the next future reminder. A one-off reminder has at most one.
  List<ReminderOccurrence> occurrences({
    required TrashStop stop,
    required TaipeiDate anchor,
    required int leadMinutes,
    required ReminderFrequency frequency,
    required DateTime now,
    int windowDays = 56,
  }) {
    final out = <ReminderOccurrence>[];
    final end = now.add(Duration(days: windowDays));
    if (frequency == ReminderFrequency.once) {
      final collection = anchor.at(stop.arrive);
      final notify = collection.subtract(Duration(minutes: leadMinutes));
      if (notify.isAfter(now) && isCollectionDay(stop, anchor)) {
        out.add(ReminderOccurrence(serviceDate: anchor, collection: collection, notify: notify));
      }
      return out;
    }
    final period = frequency.periodDays;
    final today = TaipeiDate.of(now);
    // Jump to the first cycle date not earlier than yesterday (after-midnight trips).
    var k = 0;
    final gap = anchor.daysUntil(today.addDays(-1));
    if (gap > 0) k = gap ~/ period;
    for (;; k++) {
      final d = anchor.addDays(k * period);
      final collection = d.at(stop.arrive);
      final notify = collection.subtract(Duration(minutes: leadMinutes));
      if (notify.isAfter(end)) break;
      if (!notify.isAfter(now)) continue;
      final suspended = !isCollectionDay(stop, d);
      out.add(ReminderOccurrence(serviceDate: d, collection: collection, notify: notify, skipped: suspended));
    }
    return out;
  }
}
