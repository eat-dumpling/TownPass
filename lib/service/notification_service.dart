import 'dart:async';
import 'dart:convert';
import 'dart:io';

import 'package:flutter_local_notifications/flutter_local_notifications.dart';
import 'package:get/get.dart';
import 'package:timezone/data/latest.dart' as tzdata;
import 'package:timezone/timezone.dart' as tz;
import 'package:town_pass/page/trash_helper/trash_reminders.dart';

class NotificationService extends GetxService {
  static int _id = 0;
  static final FlutterLocalNotificationsPlugin _notificationInstance = FlutterLocalNotificationsPlugin();

  /// Called when the user taps a notification (app running, or launched by the tap).
  static void Function(String? payload)? onTap;

  /// Payload of the notification that launched the app, until someone consumes it.
  static String? launchPayload;

  Future<NotificationService> init() async {
    tzdata.initializeTimeZones();

    final launch = await _notificationInstance.getNotificationAppLaunchDetails();
    if (launch?.didNotificationLaunchApp == true) {
      launchPayload = launch?.notificationResponse?.payload;
    }

    final InitializationSettings initializationSettings = InitializationSettings(
      android: const AndroidInitializationSettings('@mipmap/ic_launcher'),
      iOS: DarwinInitializationSettings(
        requestAlertPermission: false,
        requestBadgePermission: false,
        requestSoundPermission: false,
      ),
    );

    await _notificationInstance.initialize(
      settings: initializationSettings,
      onDidReceiveNotificationResponse: (response) => onTap?.call(response.payload),
    );

    return this;
  }

  static Future<void> requestPermission() async {
    if (Platform.isAndroid) {
      await _notificationInstance.resolvePlatformSpecificImplementation<AndroidFlutterLocalNotificationsPlugin>()?.requestNotificationsPermission();
    } else if (Platform.isIOS) {
      await _notificationInstance.resolvePlatformSpecificImplementation<IOSFlutterLocalNotificationsPlugin>()?.requestPermissions(
            alert: true,
            badge: true,
            sound: true,
          );
    }
  }

  static Future<void> showNotification({String? title, String? content}) async {
    await _notificationInstance.show(
      id: _id++,
      title: title,
      body: content,
      notificationDetails: const NotificationDetails(
        android: AndroidNotificationDetails(
          'TownPass android notification id',
          'TownPass android notification channel name',
          importance: Importance.max,
          priority: Priority.max,
        ),
      ),
    );
  }
}

/// [TrashNotifier] backed by flutter_local_notifications one-off schedules (zonedSchedule).
class LocalTrashNotifier implements TrashNotifier {
  FlutterLocalNotificationsPlugin get _plugin => NotificationService._notificationInstance;

  static const _details = NotificationDetails(
    android: AndroidNotificationDetails(
      'trash_helper_reminders',
      '垃圾車提醒 Garbage truck reminders',
      channelDescription: '丟丟：收藏停靠點的收運提醒',
      importance: Importance.high,
      priority: Priority.high,
    ),
    iOS: DarwinNotificationDetails(presentAlert: true, presentBanner: true, presentList: true, presentSound: true),
  );

  @override
  String get platform => Platform.isIOS ? 'ios' : Platform.isAndroid ? 'android' : 'other';

  @override
  Future<bool> permissionGranted({bool request = false}) async {
    if (Platform.isIOS) {
      final ios = _plugin.resolvePlatformSpecificImplementation<IOSFlutterLocalNotificationsPlugin>();
      final current = await ios?.checkPermissions();
      if (current?.isEnabled == true) return true;
      if (!request) return false;
      return await ios?.requestPermissions(alert: true, badge: false, sound: true) ?? false;
    }
    if (Platform.isAndroid) {
      final android = _plugin.resolvePlatformSpecificImplementation<AndroidFlutterLocalNotificationsPlugin>();
      if (await android?.areNotificationsEnabled() == true) return true;
      if (!request) return false;
      return await android?.requestNotificationsPermission() ?? false;
    }
    return false;
  }

  @override
  Future<List<PendingTrashNotification>> pending() async {
    final list = await _plugin.pendingNotificationRequests();
    final out = <PendingTrashNotification>[];
    for (final p in list) {
      final raw = p.payload;
      if (raw == null) continue;
      try {
        final j = jsonDecode(raw);
        if (j is Map && j['src'] == trashPayloadSource) out.add(PendingTrashNotification(p.id, Map<String, dynamic>.from(j)));
      } catch (_) {
        // not ours
      }
    }
    return out;
  }

  @override
  Future<void> schedule({required int id, required DateTime at, required String title, required String body, required String payload}) {
    return _plugin.zonedSchedule(
      id: id,
      title: title,
      body: body,
      scheduledDate: tz.TZDateTime.from(at.toUtc(), tz.UTC),
      notificationDetails: _details,
      // Inexact: no exact-alarm permission needed. Android may deliver a few minutes late.
      androidScheduleMode: AndroidScheduleMode.inexactAllowWhileIdle,
      payload: payload,
    );
  }

  @override
  Future<void> cancel(int id) => _plugin.cancel(id: id);
}
