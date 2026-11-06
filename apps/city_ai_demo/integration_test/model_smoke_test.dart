// SPDX-License-Identifier: AGPL-3.0-or-later
import 'package:flutter_test/flutter_test.dart';
import 'package:integration_test/integration_test.dart';
import 'package:city_ai_demo/main.dart';
import 'package:city_ai_core/features/city_ai/data/device_resources.dart';
import 'package:city_ai_core/features/city_ai/ports/services.dart';

// Test-only injection: iOS Simulator can report no process memory budget.
// Never compiled into the production entry point or used for device acceptance.
class SimulatorTestResources implements DeviceResources {
  @override
  Future<int> freeDiskBytes() => const NativeDeviceResources().freeDiskBytes();
  @override
  Future<bool> canRunModel({int modelBytes = 0}) async => true;
}

// Explicitly opt in: this test downloads the approved ~100.6 MiB artifact.
// It proves runtime execution only, not Traditional Chinese answer quality.
void main() {
  IntegrationTestWidgetsFlutterBinding.ensureInitialized();
  testWidgets('approved GGUF download, CPU inference, cancellation and reuse', (
    tester,
  ) async {
    final c = const bool.fromEnvironment('SIMULATOR_RESOURCE_OVERRIDE')
        ? await createController(resources: SimulatorTestResources())
        : await createController();
    try {
      final id = c.models.models.first.id;
      if (await c.models.installed(id) == null) {
        await c.download(id, true);
      }
      expect(await c.models.installed(id), isNotNull, reason: c.modelStatus);
      if (const bool.fromEnvironment('MODEL_SMOKE_WAIT_FOR_OFFLINE')) {
        // The external emulator-only harness disables all device networking.
        // ignore: avoid_print
        print('MODEL_READY_FOR_OFFLINE');
        await Future<void>.delayed(const Duration(seconds: 20));
        await c.search('文山區社區關懷據點');
        expect(c.hits, isNotEmpty);
      }
      await c.setEnabled(true);
      expect(c.enabled, isTrue, reason: c.modelStatus);
      final hits = c.retriever.search('文山區社區關懷據點', c.snapshot!);
      final watch = Stopwatch()..start();
      var count = 0;
      await for (final delta in c.engine.generate('請逐字摘錄來源', hits)) {
        count += delta.length;
        if (count > 20) {
          await c.engine.cancel();
          break;
        }
      }
      expect(count, greaterThan(0));
      var second = 0;
      await for (final delta in c.engine.generate('請逐字摘錄來源', hits)) {
        second += delta.length;
      }
      expect(second, greaterThan(0));
      // No question or generated content is written to logs.
      // ignore: avoid_print
      print(
        'MODEL_SMOKE cpu=true first_chars=$count second_chars=$second elapsed_ms=${watch.elapsedMilliseconds}',
      );
      await c.setEnabled(false);
      expect(c.engine.isLoaded, isFalse);
      await c.deleteModel(id);
      expect(await c.models.installed(id), isNull);
    } finally {
      await c.close();
    }
  }, skip: !const bool.fromEnvironment('RUN_MODEL_SMOKE'));
}
