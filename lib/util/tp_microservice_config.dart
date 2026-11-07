import 'package:flutter/foundation.dart';
import 'package:flutter_inappwebview/flutter_inappwebview.dart';

/// 微服務「回收小里長」的網址。開發時可用
/// `flutter run --dart-define=RECYCLE_LI_URL=http://192.168.x.x:5173/` 指向自己電腦上的 Vite。
const String recycleLiUrl = String.fromEnvironment(
  'RECYCLE_LI_URL',
  defaultValue: 'https://recycle-li.web.app/',
);

/// 微服務「Taipei Trash Helper（台北垃圾生活助手）」的網址：
/// `flutter run --dart-define=TRASH_HELPER_URL=http://localhost:5174/`
const String trashHelperUrl = String.fromEnvironment(
  'TRASH_HELPER_URL',
  defaultValue: 'https://taipei-trash-helper.web.app/',
);

/// 允許在 WebView 內使用相機的網站（只給相機，不給麥克風）。
/// 正式網址固定列出；除錯版另外允許本機與區網，方便連到開發機。
abstract class TPMicroserviceConfig {
  static final Set<String> _cameraHosts = {
    Uri.parse(recycleLiUrl).host,
    Uri.parse(trashHelperUrl).host,
    'taipei-trash-helper.web.app',
    'recycle-li.web.app',
    'recycle-li.firebaseapp.com',
  };

  static bool canUseCamera(WebUri origin) {
    final String host = origin.host;
    if (_cameraHosts.contains(host)) return true;
    if (!kDebugMode) return false;
    return host == 'localhost' ||
        host == '127.0.0.1' ||
        host == '10.0.2.2' ||
        host.startsWith('192.168.') ||
        host.startsWith('10.') ||
        RegExp(r'^172\.(1[6-9]|2\d|3[01])\.').hasMatch(host);
  }
}
