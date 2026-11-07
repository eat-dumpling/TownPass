/// Taipei Trash Helper microservice (microservices/trash_helper).
///
/// By default the page is bundled with the app and served from 127.0.0.1 by
/// [TrashLocalServer], so it opens offline. For development, point it at the dev
/// server with `--dart-define=TRASH_HELPER_URL=http://<Mac IP>:8788/`, or at a
/// deployed HTTPS copy.
abstract class TrashHelper {
  static const devUrl = String.fromEnvironment('TRASH_HELPER_URL');
  static const bundledPort = 8790;
  static const bundledUrl = 'http://127.0.0.1:$bundledPort/';
  static const url = devUrl == '' ? bundledUrl : devUrl;

  /// Flutter asset folder that holds the page and its data.
  static const assetRoot = 'microservices/trash_helper/';

  static bool get isBundled => devUrl == '';

  static String get origin => Uri.parse(url).origin;

  /// Page link for one stop (used when a reminder notification is tapped).
  static String stopUrl(String stopId) => '$url#/stop/${Uri.encodeComponent(stopId)}';

  /// Trash Helper bridge messages are only accepted from the Trash Helper page itself,
  /// in the main frame — never from other sites or iframes.
  static bool isTrustedSource(Object? sourceOrigin, bool isMainFrame) {
    if (!isMainFrame || sourceOrigin == null) return false;
    final o = Uri.tryParse(sourceOrigin.toString());
    if (o == null || o.host.isEmpty) return false;
    return o.origin == origin;
  }
}
