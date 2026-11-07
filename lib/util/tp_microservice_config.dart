import 'package:flutter/foundation.dart';
import 'package:flutter_inappwebview/flutter_inappwebview.dart';

/// 微服務「回收小里長」的網址。預設用 App 內建的正式版（`tools/recycle_li_bundle/build.sh` 產生
/// `microservices/recycle_li/`，由 App 在 127.0.0.1:8791 提供，模型和丟丟共用、離線可用、載入快）。
/// 開發時可用 `flutter run --dart-define=RECYCLE_LI_URL=http://192.168.x.x:5173/` 指向自己電腦上的 Vite，
/// 或 `RECYCLE_LI_URL=https://recycle-li.web.app/` 用網路上的版本。
const String recycleLiDevUrl = String.fromEnvironment('RECYCLE_LI_URL');
const String recycleLiUrl = recycleLiDevUrl == '' ? 'http://127.0.0.1:${TPMicroserviceConfig.recycleLiBundledPort}/' : recycleLiDevUrl;

/// 微服務「Taipei Trash Helper（台北垃圾生活助手）」的網址：
/// `flutter run --dart-define=TRASH_HELPER_URL=http://localhost:5174/`
const String trashHelperUrl = String.fromEnvironment(
  'TRASH_HELPER_URL',
  defaultValue: 'https://taipei-trash-helper.web.app/',
);

/// 允許在 WebView 內使用相機的網站（只給相機，不給麥克風）。
/// 正式網址固定列出；除錯版與 Profile 版另外允許本機與區網，方便實機連到開發機。
abstract class TPMicroserviceConfig {
  /// App 內建回收小里長的本機埠（丟丟是 8790）。
  static const int recycleLiBundledPort = 8791;
  static const bool recycleLiBundled = recycleLiDevUrl == '';

  static final Set<String> _cameraHosts = {
    if (!recycleLiBundled) Uri.parse(recycleLiUrl).host,
    Uri.parse(trashHelperUrl).host,
    'taipei-trash-helper.web.app',
    'recycle-li.web.app',
    'recycle-li.firebaseapp.com',
  };

  /// 除錯版與 Profile 版（實機測試用）連到開發機（區網、自簽 https 憑證）時信任憑證；正式版（Release）一律照系統規則。
  static bool trustDevCertificate(String host) {
    if (kReleaseMode) return false;
    return host == 'localhost' ||
        host == '127.0.0.1' ||
        host.startsWith('192.168.') ||
        host.startsWith('10.') ||
        RegExp(r'^172\.(1[6-9]|2\d|3[01])\.').hasMatch(host);
  }

  static bool canUseCamera(WebUri origin) {
    final String host = origin.host;
    if (_cameraHosts.contains(host)) return true;
    // App 內建的回收小里長：只認本機這個埠（正式版也允許）。
    if (recycleLiBundled && host == '127.0.0.1' && origin.port == recycleLiBundledPort) return true;
    if (kReleaseMode) return false; // 除錯版、Profile 版另外允許本機與區網
    return host == 'localhost' ||
        host == '127.0.0.1' ||
        host == '10.0.2.2' ||
        host.startsWith('192.168.') ||
        host.startsWith('10.') ||
        RegExp(r'^172\.(1[6-9]|2\d|3[01])\.').hasMatch(host);
  }
}
