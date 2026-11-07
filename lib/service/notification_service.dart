import 'dart:async';
import 'dart:io';

import 'package:flutter_local_notifications/flutter_local_notifications.dart';
import 'package:get/get.dart';
import 'package:timezone/data/latest.dart' as tz_data;
import 'package:timezone/timezone.dart' as tz;

class NotificationService extends GetxService {
  static int _id = 0;
  static final FlutterLocalNotificationsPlugin _notificationInstance = FlutterLocalNotificationsPlugin();

  Future<NotificationService> init() async {
    // 排程通知（schedule_notify）需要時區資料；台北通固定使用臺北時區。
    tz_data.initializeTimeZones();
    tz.setLocalLocation(tz.getLocation('Asia/Taipei'));

    await _notificationInstance.getNotificationAppLaunchDetails();

    final InitializationSettings initializationSettings = InitializationSettings(
      android: const AndroidInitializationSettings('@mipmap/ic_launcher'),
      iOS: DarwinInitializationSettings(
        requestAlertPermission: false,
        requestBadgePermission: false,
        requestSoundPermission: false,
      ),
    );

    await _notificationInstance.initialize(settings: initializationSettings);

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

  /// 在指定時間排程一則本機通知（給微服務的 schedule_notify 使用）。
  /// 不申請精準鬧鐘權限，系統可能延後幾分鐘，對「垃圾車停靠前提醒」可以接受。
  static Future<void> scheduleNotification({
    required int id,
    required DateTime at,
    String? title,
    String? content,
  }) async {
    await _notificationInstance.zonedSchedule(
      id: id,
      title: title,
      body: content,
      scheduledDate: tz.TZDateTime.from(at, tz.local),
      notificationDetails: const NotificationDetails(
        android: AndroidNotificationDetails(
          'TownPass android notification id',
          'TownPass android notification channel name',
          importance: Importance.max,
          priority: Priority.max,
        ),
      ),
      androidScheduleMode: AndroidScheduleMode.inexactAllowWhileIdle,
    );
  }

  static Future<void> cancelNotification(int id) async {
    await _notificationInstance.cancel(id: id);
  }
}
