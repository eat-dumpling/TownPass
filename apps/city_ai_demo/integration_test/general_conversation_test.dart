// SPDX-License-Identifier: AGPL-3.0-or-later
import 'dart:io';
import 'dart:convert';

import 'package:city_ai_core/city_ai_core.dart';
import 'package:city_ai_demo/main.dart' as app;
import 'package:flutter/material.dart';
import 'package:flutter_inappwebview/flutter_inappwebview.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:integration_test/integration_test.dart';
import 'package:town_pass/features/city_ai/city_ai_runtime.dart';

void main() {
  final binding = IntegrationTestWidgetsFlutterBinding.ensureInitialized();
  testWidgets(
    'normal local conversation with optional RAG and no source prerequisite',
    (tester) async {
      await app.main();
      InAppWebViewController? web;
      CityAiController? controller;
      final factory = CityAiRuntime.create;
      var creations = 0;
      var queued = false;
      CityAiRuntime.create = () async {
        creations++;
        controller = await factory();
        controller!.addListener(() {
          queued |= controller!.waitingForModel;
        });
        return controller!;
      };
      CityAiRuntime.onMicroserviceReady = (value) => web = value;
      Future<void> until(bool Function() condition, {int seconds = 120}) async {
        final watch = Stopwatch()..start();
        while (!condition() && watch.elapsed.inSeconds < seconds) {
          await tester.pump(const Duration(milliseconds: 100));
        }
        expect(condition(), isTrue, reason: controller?.modelStatus);
      }

      try {
        await tester.pump(const Duration(seconds: 4));
        await tester.tap(find.byKey(const Key('open-city-ai-microservice')));
        await until(() => web != null);
        await tester.pump(const Duration(milliseconds: 500));
        expect(
          await web!.evaluateJavascript(
            source: 'document.getElementById("enable-button").hidden',
          ),
          isTrue,
        );
        for (final question in ['你是誰', '台大附近美食']) {
          await web!.evaluateJavascript(
            source:
                'document.getElementById("question").value=${jsonEncode(question)}; document.getElementById("chat-form").requestSubmit()',
          );
          await until(
            () =>
                controller!.history
                        .where((turn) => turn.role == ChatRole.user)
                        .lastOrNull
                        ?.text ==
                    question &&
                !controller!.generating,
          );
          await until(() => !controller!.generating);
          expect(controller!.activeModelId, 'granite-4-1b-q4km');
          expect(controller!.hits, isEmpty);
          expect(controller!.answerMode, 'general');
          expect(controller!.receivedCharacters, greaterThan(0));
          expect(controller!.answer, isNotEmpty, reason: controller!.status);
          expect(controller!.answer, isNot(insufficientData));
          expect(controller!.answer, isNot(contains('�')));
          expect(controller!.answer, isNot(contains('**')));
          await tester.pump(const Duration(milliseconds: 300));
          expect(
            await web!.evaluateJavascript(
              source: 'document.querySelector("#messages .assistant:last-child .note").textContent',
            ),
            contains('未連線查證'),
          );
          if (Platform.isIOS &&
              const bool.fromEnvironment('CAPTURE_SCREENSHOTS')) {
            await web!.evaluateJavascript(
              source: 'document.querySelector("#messages .assistant:last-child").previousElementSibling.scrollIntoView({block:"start"})',
            );
            await Future<void>.delayed(const Duration(milliseconds: 500));
            await binding.takeScreenshot(
              question == '你是誰' ? 'general-chat-identity' : 'general-chat-food',
            );
          }
        }
        final warmController = controller;
        await tester.tap(find.byTooltip('返回城市通'));
        await until(() => controller!.history.isEmpty);
        web = null;
        await tester.pump(const Duration(milliseconds: 500));
        await tester.tap(find.byKey(const Key('open-city-ai-microservice')));
        await until(() => web != null);
        expect(identical(controller, warmController), isTrue);
        expect(controller!.enabled, isTrue);
        expect(controller!.successfulModelLoads, 1);
        expect(creations, 1);
        await web!.evaluateJavascript(
          source: 'document.getElementById("question").value="最近有哪些社區活動"; document.getElementById("chat-form").requestSubmit()',
        );
        await until(
          () =>
              controller!.history
                      .where((t) => t.role == ChatRole.user)
                      .lastOrNull
                      ?.text ==
                  '最近有哪些社區活動' &&
              !controller!.generating,
        );
        expect(controller!.receivedCharacters, greaterThan(0));
        expect(controller!.answer, isNotEmpty);
        // Public counters only; never log questions or model replies.
        // ignore: avoid_print
        print(
          'AUTOMATIC_CHAT_NATIVE passed=true manual_enable=false loads=${controller!.successfulModelLoads} reentry_reused=true early_queue_observed=$queued model=${controller!.activeModelId}',
        );
      } finally {
        CityAiRuntime.onMicroserviceReady = null;
        await tester.pumpWidget(const SizedBox.shrink());
        await CityAiRuntime.session?.close();
        CityAiRuntime.session = null;
        CityAiRuntime.create = factory;
      }
    },
  );
}
