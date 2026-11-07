// SPDX-License-Identifier: AGPL-3.0-or-later
import 'dart:async';
import 'dart:convert';

import 'package:flutter/widgets.dart';
import 'package:get/get.dart';
import 'package:shared_preferences/shared_preferences.dart';
import 'package:town_pass/page/trash_helper/trash_data.dart';
import 'package:town_pass/page/trash_helper/trash_local_server.dart';
import 'package:town_pass/page/trash_helper/trash_reminders.dart';
import 'package:town_pass/service/notification_service.dart';
import 'package:town_pass/util/tp_route.dart';
import 'package:town_pass/util/tp_web_view.dart';
import 'package:town_pass/util/trash_helper.dart';

class _PrefsKeyValue implements TrashKeyValue {
  final SharedPreferences prefs;

  _PrefsKeyValue(this.prefs);

  @override
  String? getString(String key) => prefs.getString(key);

  @override
  Future<void> setString(String key, String value) => prefs.setString(key, value);
}

/// App-side part of Trash Helper: the bundled page server, saved stops and reminders,
/// and opening the right stop when a reminder is tapped.
class TrashHelperService extends GetxService with WidgetsBindingObserver {
  late final TrashReminderService reminders;

  Future<TrashHelperService> init() async {
    final prefs = await SharedPreferences.getInstance();
    reminders = TrashReminderService(kv: _PrefsKeyValue(prefs), notifier: LocalTrashNotifier(), loadData: TrashData.load);
    await TrashLocalServer.ensureRunning();
    NotificationService.onTap = _openFromPayload;
    WidgetsBinding.instance.addObserver(this);
    return this;
  }

  /// After the first frame: open a stop if a reminder launched the app, then reconcile.
  void onAppReady() {
    final payload = NotificationService.launchPayload;
    NotificationService.launchPayload = null;
    if (payload != null) _openFromPayload(payload);
    unawaited(reminders.reschedule().catchError((Object e) => debugPrint('Trash reminders: $e')));
  }

  @override
  void didChangeAppLifecycleState(AppLifecycleState state) {
    if (state == AppLifecycleState.resumed) {
      // Both bundled sites: 丟丟's "kids mode" switches to 回收小里長 on 8791.
      unawaited(TrashLocalServer.ensureRunning());
      unawaited(RecycleLiLocalServer.ensureRunning());
      unawaited(reminders.reschedule().catchError((Object e) => debugPrint('Trash reminders: $e')));
    }
  }

  Future<void> _openFromPayload(String? payload) async {
    if (payload == null) return;
    String? stopId;
    try {
      final j = jsonDecode(payload);
      if (j is Map && j['src'] == trashPayloadSource && j['stopId'] is String) stopId = j['stopId'] as String;
    } catch (_) {
      return;
    }
    if (stopId == null) return;
    await TrashLocalServer.ensureRunning();
    // The page shows the stop, or a "no longer in the data" message with a link to the saved list.
    // preventDuplicates: false — a web page (often Trash Helper itself) may already be on top.
    Get.toNamed(
      TPRoute.webView,
      arguments: WebViewArgument(url: TrashHelper.stopUrl(stopId), forceTitle: '丟丟 TossTalk'),
      preventDuplicates: false,
    );
  }
}
