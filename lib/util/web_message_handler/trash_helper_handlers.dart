// SPDX-License-Identifier: AGPL-3.0-or-later
//
// Bridge messages used only by the Trash Helper page. Every request carries a requestId
// that is echoed in the reply. Requests from any other origin, or from an iframe, are
// refused without side effects (no camera, no scheduling, no storage access).
import 'package:flutter_inappwebview/flutter_inappwebview.dart';
import 'package:get/get.dart';
import 'package:town_pass/page/trash_helper/trash_helper_service.dart';
import 'package:town_pass/page/trash_helper/trash_reminders.dart';
import 'package:town_pass/page/trash_helper/trash_speech.dart';
import 'package:town_pass/util/trash_helper.dart';
import 'package:town_pass/util/web_message_handler/tp_web_message_handler.dart';

abstract class _TrashHandler extends TPWebMessageHandler {
  Future<Map<String, dynamic>> run(Map<dynamic, dynamic> message);

  /// Like [run], for requests that also send progress messages (marked `partial: true`)
  /// before the final reply.
  Future<Map<String, dynamic>> runWithProgress(Map<dynamic, dynamic> message, void Function(Map<String, dynamic>) progress) =>
      run(message);

  @override
  Future<void> handle({
    required Object? message,
    required WebUri? sourceOrigin,
    required bool isMainFrame,
    required Function(WebMessage replyWebMessage)? onReply,
  }) async {
    final requestId = message is Map && message['requestId'] is String ? message['requestId'] as String : null;
    void reply(Map<String, dynamic> data) => onReply?.call(replyWebMessage(data: {...data, 'requestId': requestId}));
    if (!TrashHelper.isTrustedSource(sourceOrigin, isMainFrame)) {
      reply({'ok': false, 'error': 'untrusted-origin'});
      return;
    }
    if (message is! Map || requestId == null || requestId.length > 64) {
      reply({'ok': false, 'error': 'bad-request'});
      return;
    }
    try {
      reply(await runWithProgress(message, (data) => reply({...data, 'partial': true})));
    } on TrashInputError catch (e) {
      reply({'ok': false, 'error': e.code});
    } catch (e) {
      reply({'ok': false, 'error': 'internal'});
    }
  }

  TrashReminderService get service => Get.find<TrashHelperService>().reminders;
}

class TrashFavoritesMessageHandler extends _TrashHandler {
  @override
  String get name => 'trash_favorites';

  @override
  Future<Map<String, dynamic>> run(Map message) => switch (message['op']) {
        'list' => service.snapshot(),
        'save' => service.saveFavorite(message['stopId'], nickname: message['nickname']),
        'remove' => service.removeFavorite(message['stopId']),
        'rename' => service.renameFavorite(message['stopId'], message['nickname']),
        _ => throw const TrashInputError('bad-op'),
      };
}

class TrashReminderSaveMessageHandler extends _TrashHandler {
  @override
  String get name => 'trash_reminder_save';

  @override
  Future<Map<String, dynamic>> run(Map message) {
    final reminder = message['reminder'];
    return message['preview'] == true ? service.preview(reminder) : service.saveReminder(reminder);
  }
}

class TrashReminderCancelMessageHandler extends _TrashHandler {
  @override
  String get name => 'trash_reminder_cancel';

  @override
  Future<Map<String, dynamic>> run(Map message) => service.cancelReminder(message['reminderId']);
}

class TrashReminderTestMessageHandler extends _TrashHandler {
  @override
  String get name => 'trash_reminder_test';

  @override
  Future<Map<String, dynamic>> run(Map message) => service.scheduleTest(message['stopId'], lang: message['lang'] == 'en' ? 'en' : 'zh');
}

/// Voice input for the assistant: {op: "listen", locale} replies with the recognised text
/// (and sends partial transcripts while listening); {op: "stop"} ends listening early.
class TrashListenMessageHandler extends _TrashHandler {
  @override
  String get name => 'trash_listen';

  @override
  Future<Map<String, dynamic>> run(Map message) => runWithProgress(message, (_) {});

  @override
  Future<Map<String, dynamic>> runWithProgress(Map message, void Function(Map<String, dynamic>) progress) async {
    final speech = TrashSpeech.instance;
    switch (message['op']) {
      case 'listen':
        final locale = message['locale'];
        if (locale is! String || locale.length > 16) throw const TrashInputError('bad-locale');
        return speech.listen(locale, (words) => progress({'ok': true, 'text': words}));
      case 'stop':
        await speech.stop();
        return {'ok': true};
      case 'cancel':
        await speech.cancel();
        return {'ok': true};
      default:
        throw const TrashInputError('bad-op');
    }
  }
}
