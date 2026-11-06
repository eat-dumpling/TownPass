// SPDX-License-Identifier: AGPL-3.0-or-later
import 'dart:io';

import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:flutter_inappwebview/flutter_inappwebview.dart';
import 'package:integration_test/integration_test.dart';
import 'package:city_ai_core/city_ai_core.dart';
import 'package:town_pass/features/city_ai/city_ai_runtime.dart';
import 'package:town_pass/page/home/home_view.dart';
import 'package:city_ai_demo/main.dart' as app;
import 'package:city_ai_demo/main_preload.dart' as prepared;

import 'model_smoke_test.dart' show SimulatorTestResources;

void main() {
  final binding = IntegrationTestWidgetsFlutterBinding.ensureInitialized();
  testWidgets(
    'TownPass home -> offline microservice -> real local AI conversation',
    (tester) async {
      InAppWebViewController? web;
      CityAiController? c;
      if (const bool.fromEnvironment('PRELOAD_APPROVED_MODEL')) {
        await prepared.main();
      } else {
        await app.main();
      }
      CityAiRuntime.create = () async {
        c = const bool.fromEnvironment('SIMULATOR_RESOURCE_OVERRIDE')
            ? await app.createController(
                resources: SimulatorTestResources(),
                automaticGeneration: true,
                checkModels: false,
              )
            : await app.createController(
                automaticGeneration: true,
                checkModels: false,
              );
        return c!;
      };
      CityAiRuntime.onMicroserviceReady = (controller) {
        web = controller;
      };
      Future<void> until(bool Function() predicate, {int seconds = 60}) async {
        final watch = Stopwatch()..start();
        while (!predicate() && watch.elapsed.inSeconds < seconds) {
          await tester.pump(const Duration(milliseconds: 200));
        }
        expect(predicate(), isTrue);
      }

      await tester.pump(const Duration(seconds: 4));
      expect(find.text('首頁'), findsWidgets);
      if (Platform.isIOS && const bool.fromEnvironment('CAPTURE_SCREENSHOTS')) {
        await tester.pump();
        await binding.takeScreenshot('townpass-original-home');
      }
      expect(find.text('優惠'), findsWidgets);
      await tester.scrollUntilVisible(
        find.byKey(const Key('open-city-ai-microservice')),
        200,
        scrollable: find
            .descendant(
              of: find.byType(HomeView),
              matching: find.byType(Scrollable),
            )
            .first,
      );
      await tester.tap(find.byKey(const Key('open-city-ai-microservice')));
      await until(() => web != null && c != null);
      await tester.pump(const Duration(seconds: 1));
      expect(
        await web!.evaluateJavascript(
          source: 'document.getElementById("data-count").textContent',
        ),
        contains('510'),
      );
      if (Platform.isIOS && const bool.fromEnvironment('CAPTURE_SCREENSHOTS')) {
        await Future<void>.delayed(const Duration(milliseconds: 500));
        await tester.pump();
        await binding.takeScreenshot('townpass-city-ai-welcome');
      }
      await web!.evaluateJavascript(
        source: 'document.getElementById("models-button").click()',
      );
      expect(
        await web!.evaluateJavascript(
          source: 'document.getElementById("management").open',
        ),
        isTrue,
      );
      await web!.evaluateJavascript(
        source: 'document.getElementById("settings-done").click()',
      );
      expect(
        await web!.evaluateJavascript(
          source: 'document.getElementById("management").open',
        ),
        isFalse,
      );
      await web!.evaluateJavascript(
        source: '''document.querySelector(".district-picker").open=true; document.querySelector('[data-question="文山區社區關懷據點"]').click()''',
      );
      await until(() => c!.hits.isNotEmpty);
      await tester.pump(const Duration(milliseconds: 300));
      expect(
        await web!.evaluateJavascript(
          source: 'document.querySelector(".source").textContent.includes("https://data.taipei/")',
        ),
        isTrue,
      );
      await until(() => !c!.waitingForModel && !c!.generating);
      if (const bool.fromEnvironment('RUN_MODEL_SMOKE')) {
        await web!.evaluateJavascript(
          source: 'document.getElementById("models-button").click()',
        );
        await until(() => !c!.loadingModel);
        if (c!.installedModels[c!.models.models.first.id] != true) {
          await web!.evaluateJavascript(
            source: 'document.querySelector("#models button").click()',
          );
          await tester.pump(const Duration(seconds: 1));
          expect(find.text('同意並下載'), findsOneWidget);
          await tester.tap(find.text('同意並下載'));
          await until(
            () => c!.installedModels[c!.models.models.first.id] == true,
            seconds: 180,
          );
        }
        await tester.pump(const Duration(milliseconds: 300));
        // Download completion and cached models activate automatically.
        await web!.evaluateJavascript(
          source: 'document.getElementById("settings-done").click()',
        );
        await until(
          () =>
              c!.enabled || (!c!.loadingModel && c!.modelStatus.contains('無法')),
          seconds: 60,
        );
        expect(c!.enabled, isTrue, reason: c!.modelStatus);
        await web!.evaluateJavascript(
          source: 'document.getElementById("question").value="文山區社區關懷據點"; document.getElementById("chat-form").requestSubmit(); document.getElementById("question").value="重複送出不得執行"; document.getElementById("chat-form").requestSubmit()',
        );
        await until(() => c!.receivedCharacters > 0 || !c!.enabled);
        await until(() => !c!.generating);
        expect(c!.receivedCharacters, greaterThan(0), reason: c!.status);
        expect(c!.answer, isNotEmpty, reason: c!.status);
        expect(
          c!.history.where((turn) => turn.role == ChatRole.user).length,
          2,
        );
        await tester.pump(const Duration(milliseconds: 300));
        expect(
          await web!.evaluateJavascript(
            source: 'document.querySelectorAll("#messages .user").length',
          ),
          2,
        );
        expect(
          await web!.evaluateJavascript(
            source: 'document.getElementById("send").disabled',
          ),
          isFalse,
        );
        await web!.evaluateJavascript(
          source: 'document.getElementById("question").value="那大安區呢？"; document.getElementById("chat-form").requestSubmit()',
        );
        await until(
          () => c!.hits.isNotEmpty && c!.hits.first.document.district == '大安區',
        );
        await until(() => !c!.generating);
        expect(c!.engine.isLoaded, isTrue);
        expect(
          c!.history.where((t) => t.role == ChatRole.user).last.text,
          '那大安區呢？',
        );
        // ignore: avoid_print
        print(
          'MICROSERVICE_LOCAL_CHAT passed=true turns=${c!.history.length} model_loaded=${c!.engine.isLoaded}',
        );
      }
      tester.platformDispatcher.textScaleFactorTestValue = 2;
      addTearDown(tester.platformDispatcher.clearTextScaleFactorTestValue);
      await tester.pump(const Duration(milliseconds: 300));
      expect(
        await web!.evaluateJavascript(
          source:
              'parseFloat(getComputedStyle(document.documentElement).fontSize)',
        ),
        40,
      );
      expect(
        await web!.evaluateJavascript(
          source: 'document.documentElement.scrollWidth <= innerWidth',
        ),
        isTrue,
      );
      tester.platformDispatcher.textScaleFactorTestValue = 1;
      await tester.pump(const Duration(milliseconds: 300));
      expect(
        await web!.evaluateJavascript(
          source:
              'parseFloat(getComputedStyle(document.documentElement).fontSize)',
        ),
        20,
      );
      if (Platform.isIOS && const bool.fromEnvironment('CAPTURE_SCREENSHOTS')) {
        await web!.evaluateJavascript(
          source: 'document.querySelector("#messages .assistant:last-child").previousElementSibling.scrollIntoView({block:"start"})',
        );
        // Allow the native WebView compositor to display the restored font.
        await Future<void>.delayed(const Duration(milliseconds: 500));
        await binding.takeScreenshot('townpass-ai-conversation');
      }
      await web!.evaluateJavascript(
        source: 'document.getElementById("question").value="你是誰"; document.getElementById("chat-form").requestSubmit()',
      );
      await until(() => c!.hits.isEmpty);
      await until(() => c!.receivedCharacters > 0 || !c!.enabled);
      await until(() => !c!.generating);
      expect(c!.receivedCharacters, greaterThan(0));
      expect(c!.answer, isNotEmpty);
      expect(c!.answerMode, 'general');
      await tester.pump(const Duration(milliseconds: 300));
      expect(
        await web!.evaluateJavascript(
          source: 'document.querySelector("#messages .assistant:last-child .speaker").textContent',
        ),
        '手機 AI 對話',
      );
      expect(
        await web!.evaluateJavascript(
          source: 'document.querySelector("#messages .assistant:last-child .note").textContent',
        ),
        contains('未連線查證'),
      );
      CityAiRuntime.onMicroserviceReady = null;
      await tester.pumpWidget(const SizedBox.shrink());
      await CityAiRuntime.session?.close();
      CityAiRuntime.session = null;
    },
  );
}
