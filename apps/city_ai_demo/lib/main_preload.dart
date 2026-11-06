// SPDX-License-Identifier: AGPL-3.0-or-later
// Developer entry point: explicitly prepare the approved public conversation model
// before opening the original TownPass home. Generation remains opt-in.
import 'package:flutter/foundation.dart';
import 'package:flutter/widgets.dart';

import 'main.dart' as app;

Future<void> main() async {
  WidgetsFlutterBinding.ensureInitialized();
  if (!kDebugMode) throw StateError('模型預備入口僅供開發測試');
  final controller = await app.createController();
  try {
    final model = controller.models.models.firstWhere(
      (model) => model.approved,
    );
    if (await controller.models.installed(model.id) == null) {
      try {
        await controller.models.install(
          model.id,
          consent: true,
          progress: (_, _) {},
        );
      } catch (error) {
        throw StateError('模型預備失敗（${error.runtimeType}）');
      }
    }
    if (await controller.models.installed(model.id) == null) {
      throw StateError(controller.modelStatus);
    }
    // Public artifact metadata only; never log questions, replies or private paths.
    debugPrint(
      'APPROVED_MODEL_PREPARED id=${model.id} bytes=${model.sizeBytes} sha256=${model.sha256}',
    );
  } finally {
    await controller.close();
    controller.dispose();
  }
  await app.main();
}
