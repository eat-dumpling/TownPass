/// Taipei Trash Helper microservice (microservices/trash_helper).
///
/// Point it at a deployed HTTPS copy with
/// `--dart-define=TRASH_HELPER_URL=https://<your-host>/`.
/// The default is the local dev server started by
/// `python3 microservices/trash_helper/server.py` (port 8788).
abstract class TrashHelper {
  static const url = String.fromEnvironment(
    'TRASH_HELPER_URL',
    defaultValue: 'http://127.0.0.1:8788/',
  );
}
