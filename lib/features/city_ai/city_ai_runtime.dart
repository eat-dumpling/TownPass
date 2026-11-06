// SPDX-License-Identifier: AGPL-3.0-or-later
import 'package:city_ai_core/city_ai_core.dart';
import 'package:flutter_inappwebview/flutter_inappwebview.dart';

import 'city_ai_session.dart';

/// Native AI builds register the real device engine here before TownPass starts.
/// The regular iOS 15.x TownPass build keeps the same offline microservice UI.
abstract final class CityAiRuntime {
  static Future<CityAiController> Function() create = createCityAiController;
  static CityAiSession? session;
  static Future<CityAiController> acquire() => session?.acquire() ?? create();
  static Future<void> release(CityAiController c) async {
    final shared = session;
    if (shared != null) {
      await shared.release(c);
    } else {
      await disposeController(c);
    }
  }

  static Future<void> disposeController(CityAiController c) async {
    await c.close();
    c.dispose();
  }

  static void Function(InAppWebViewController)? onMicroserviceReady;
}
