// SPDX-License-Identifier: AGPL-3.0-or-later
import 'dart:convert';

import 'package:flutter/foundation.dart';
import 'package:flutter/services.dart';
import 'package:town_pass/page/trash_helper/trash_schedule.dart';
import 'package:town_pass/util/trash_helper.dart';

/// The stop timetable bundled with the app (same files the web page uses). The app checks
/// every stop ID and computes reminder times from this copy, never from page input.
class TrashData {
  final String version;
  final Map<String, TrashStop> stops;
  final TrashSchedule schedule;

  const TrashData({required this.version, required this.stops, required this.schedule});

  static Future<TrashData>? _loading;

  static Future<TrashData> load({AssetBundle? bundle}) {
    return _loading ??= _load(bundle ?? rootBundle).catchError((Object e) {
      _loading = null;
      throw e;
    });
  }

  @visibleForTesting
  static void reset() => _loading = null;

  static Future<TrashData> _load(AssetBundle bundle) async {
    final stopsText = await bundle.loadString('${TrashHelper.assetRoot}data/stops.json');
    String exceptionsText = '{"exceptions":[]}';
    try {
      exceptionsText = await bundle.loadString('${TrashHelper.assetRoot}data/exceptions.json');
    } catch (_) {}
    return compute(parse, [stopsText, exceptionsText]);
  }

  static TrashData parse(List<String> texts) {
    final raw = jsonDecode(texts[0]) as Map<String, dynamic>;
    final districts = raw['districts'] as List<dynamic>;
    final stops = <String, TrashStop>{};
    for (final row in raw['stops'] as List<dynamic>) {
      final s = TrashStop.fromRow(row as List<dynamic>, districts);
      stops[s.id] = s;
    }
    final ex = (jsonDecode(texts[1]) as Map<String, dynamic>)['exceptions'] as List<dynamic>? ?? const [];
    return TrashData(
      version: (raw['version'] as String?) ?? '',
      stops: stops,
      schedule: TrashSchedule(
        generalDays: raw['generalDays'] is List ? List<int>.from(raw['generalDays'] as List) : const [1, 2, 4, 5, 6],
        exceptions: ex.map((e) => CollectionException.fromJson(e as Map<String, dynamic>)).whereType<CollectionException>().toList(),
      ),
    );
  }
}
