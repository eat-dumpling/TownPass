import 'dart:async';

import 'package:flutter/cupertino.dart';
import 'package:flutter_inappwebview/flutter_inappwebview.dart';
import 'package:geolocator/geolocator.dart';
import 'package:get/get.dart';
import 'package:town_pass/gen/assets.gen.dart';
import 'package:town_pass/service/account_service.dart';
import 'package:town_pass/service/device_service.dart';
import 'package:town_pass/service/geo_locator_service.dart';
import 'package:town_pass/service/notification_service.dart';
import 'package:town_pass/service/shared_preferences_service.dart';
import 'package:town_pass/service/subscription_service.dart';
import 'package:town_pass/util/tp_button.dart';
import 'package:town_pass/util/tp_dialog.dart';
import 'package:town_pass/util/tp_route.dart';
import 'package:town_pass/util/tp_text.dart';
import 'package:town_pass/util/web_message_handler/tp_web_message_reply.dart';
import 'package:url_launcher/url_launcher.dart';

abstract class TPWebMessageHandler {
  String get name;

  Future<void> handle({
    required Object? message,
    required WebUri? sourceOrigin,
    required bool isMainFrame,
    required Function(WebMessage replyWebMessage)? onReply,
  });

  WebMessage replyWebMessage({required Object? data}) {
    return TPWebStringMessageReply(
      name: name,
      data: data,
    ).message;
  }
}

class UserinfoWebMessageHandler extends TPWebMessageHandler {
  @override
  String get name => 'userinfo';

  @override
  Future<void> handle({
    required Object? message,
    required WebUri? sourceOrigin,
    required bool isMainFrame,
    required onReply,
  }) async {
    onReply?.call(replyWebMessage(
      data: Get.find<AccountService>().account ?? [],
    ));
  }
}

class LaunchMapWebMessageHandler extends TPWebMessageHandler {
  @override
  String get name => 'launch_map';

  @override
  handle({
    required Object? message,
    required WebUri? sourceOrigin,
    required bool isMainFrame,
    required Function(WebMessage reply)? onReply,
  }) async {
    if (message == null || message is! String) {
      onReply?.call(
        replyWebMessage(data: false),
      );
    }
    final Uri uri = Uri.parse(message as String);
    final bool canLaunch = await canLaunchUrl(uri);

    onReply?.call(
      replyWebMessage(data: canLaunch),
    );

    if (canLaunch) {
      // Google Maps links go to the system so they open the Google Maps app when installed
      // (an in-app browser cannot hand a universal link over to another app).
      final bool googleMaps = uri.host.endsWith('google.com') && uri.path.startsWith('/maps');
      await launchUrl(uri, mode: googleMaps ? LaunchMode.externalApplication : LaunchMode.platformDefault);
    }
  }
}

class Agree1999MessageHandler extends TPWebMessageHandler {
  @override
  String get name => '1999agree';

  @override
  handle({
    required Object? message,
    required WebUri? sourceOrigin,
    required bool isMainFrame,
    required Function(WebMessage reply)? onReply,
  }) async {
    if (message == null) {
      onReply?.call(
        replyWebMessage(data: false),
      );
    }
    final Uri uri = Uri.parse('tel://1999');

    final bool canLaunch = await canLaunchUrl(uri);
    if (!canLaunch) {
      onReply?.call(replyWebMessage(data: false));
      return;
    }

    final bool userAgreement = SharedPreferencesService().instance.getBool(SharedPreferencesService.keyPhoneCallUserAgreement) ?? false;
    if (!userAgreement) {
      await Get.toNamed(TPRoute.phoneCallUserAgreement);

      final bool userAgreement = SharedPreferencesService().instance.getBool(SharedPreferencesService.keyPhoneCallUserAgreement) ?? false;
      if (!userAgreement) {
        onReply?.call(replyWebMessage(data: false));
        return;
      }
    }

    await TPDialog.show(
      padding: const EdgeInsets.symmetric(horizontal: 68, vertical: 40),
      showCloseCross: true,
      barrierDismissible: false,
      content: Column(
        mainAxisSize: MainAxisSize.min,
        children: [
          Assets.svg.phoneCallService.svg(),
          const TPText('語音通報', style: TPTextStyles.titleSemiBold),
          const SizedBox(height: 8),
          const TPText('電話撥號'),
          const SizedBox(height: 24),
          TPButton.primary(
            text: '立即撥號',
            onPressed: () async => await launchUrl(uri),
          ),
        ],
      ),
    );
  }
}

class PhoneCallMessageHandler extends TPWebMessageHandler {
  @override
  String get name => 'phone_call';

  @override
  handle({
    required Object? message,
    required WebUri? sourceOrigin,
    required bool isMainFrame,
    required Function(WebMessage reply)? onReply,
  }) async {
    if (message == null) {
      onReply?.call(
        replyWebMessage(data: false),
      );
    }
    final Uri uri = Uri.parse('tel://${message!}');
    final bool canLaunch = await canLaunchUrl(uri);

    onReply?.call(
      replyWebMessage(data: canLaunch),
    );

    if (canLaunch) {
      await launchUrl(uri);
    }
  }
}

class LocationMessageHandler extends TPWebMessageHandler {
  @override
  String get name => 'location';

  @override
  handle({
    required Object? message,
    required WebUri? sourceOrigin,
    required bool isMainFrame,
    required Function(WebMessage reply)? onReply,
  }) async {
    Position? position;

    // might have permission issue
    try {
      position = await Get.find<GeoLocatorService>().position();
    } catch (error) {
      printError(info: error.toString());
    }

    onReply?.call(replyWebMessage(
      data: position?.toJson() ?? [],
    ));
  }
}

class DeviceInfoMessageHandler extends TPWebMessageHandler {
  @override
  String get name => 'deviceinfo';

  @override
  handle({
    required Object? message,
    required WebUri? sourceOrigin,
    required bool isMainFrame,
    required Function(WebMessage reply)? onReply,
  }) async {
    onReply?.call(replyWebMessage(
      data: Get.find<DeviceService>().baseDeviceInfo?.data ?? [],
    ));
  }
}

class OpenLinkMessageHandler extends TPWebMessageHandler {
  @override
  String get name => 'open_link';

  @override
  handle({
    required Object? message,
    required WebUri? sourceOrigin,
    required bool isMainFrame,
    required Function(WebMessage reply)? onReply,
  }) async {
    switch (message as String?) {
      case String uri:
        await TPRoute.openUri(uri: uri);
      case null:
        onReply?.call(replyWebMessage(data: false));
    }
  }
}

class NotifyMessageHandler extends TPWebMessageHandler {
  @override
  String get name => 'notify';

  @override
  Future<void> handle(
      {required Object? message,
      required WebUri? sourceOrigin,
      required bool isMainFrame,
      required Function(
        WebMessage replyWebMessage,
      )? onReply}) async {
    switch (message) {
      case Object json when json is Map<String, dynamic>:
        NotificationService.showNotification(
          title: json['title'],
          content: json['content'],
        );
        final String content = json['content'];
        if (RegExp(r'已訂閱(.+)').hasMatch(content)) {
          final String target = RegExp(r'已訂閱(.+)').firstMatch(content)!.group(1)!;
          Get.find<SubscriptionService>().addSubscription(title: target);
        } else if (RegExp(r'已取消訂閱(.+)').hasMatch(content)) {
          final String target = RegExp(r'已取消訂閱(.+)').firstMatch(content)!.group(1)!;
          Get.find<SubscriptionService>().removeSubscription(title: target);
        }
      default:
        onReply?.call(replyWebMessage(data: false));
        return;
    }
  }
}

class QRCodeScanMessageHandler extends TPWebMessageHandler {
  @override
  String get name => 'qr_code_scan';

  @override
  Future<void> handle({
    required Object? message,
    required WebUri? sourceOrigin,
    required bool isMainFrame,
    required onReply,
  }) async {
    final result = await Get.toNamed(TPRoute.qrCodeScan);
    onReply?.call(
      replyWebMessage(data: result),
    );
  }
}

/// 微服務「回收小里長」：在指定時間排程本機通知（今晚垃圾車停靠前提醒）。
///
/// 網頁端送出：
/// `{ "name": "schedule_notify", "data": { "id": 1107, "title": "...", "content": "...", "at": "2026-11-07T20:55:00+08:00" } }`
/// 回覆 `data: true` 表示已排程；格式錯誤或時間已過回覆 `false`。
class ScheduleNotifyMessageHandler extends TPWebMessageHandler {
  @override
  String get name => 'schedule_notify';

  @override
  Future<void> handle({
    required Object? message,
    required WebUri? sourceOrigin,
    required bool isMainFrame,
    required Function(WebMessage replyWebMessage)? onReply,
  }) async {
    if (message is! Map) {
      onReply?.call(replyWebMessage(data: false));
      return;
    }
    final Object? id = message['id'];
    final DateTime? at = DateTime.tryParse('${message['at']}');
    if (id is! int || at == null || at.isBefore(DateTime.now())) {
      onReply?.call(replyWebMessage(data: false));
      return;
    }
    try {
      await NotificationService.requestPermission();
      await NotificationService.scheduleNotification(
        id: id,
        at: at,
        title: message['title']?.toString(),
        content: message['content']?.toString(),
      );
      onReply?.call(replyWebMessage(data: true));
    } catch (error) {
      printError(info: error.toString());
      onReply?.call(replyWebMessage(data: false));
    }
  }
}

/// 取消 schedule_notify 排程的通知：`{ "name": "cancel_notify", "data": { "id": 1107 } }`
class CancelNotifyMessageHandler extends TPWebMessageHandler {
  @override
  String get name => 'cancel_notify';

  @override
  Future<void> handle({
    required Object? message,
    required WebUri? sourceOrigin,
    required bool isMainFrame,
    required Function(WebMessage replyWebMessage)? onReply,
  }) async {
    final Object? id = message is Map ? message['id'] : null;
    if (id is! int) {
      onReply?.call(replyWebMessage(data: false));
      return;
    }
    await NotificationService.cancelNotification(id);
    onReply?.call(replyWebMessage(data: true));
  }
}
