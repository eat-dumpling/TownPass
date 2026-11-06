// SPDX-License-Identifier: AGPL-3.0-or-later
import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:city_ai_demo/main.dart';
import 'package:city_ai_core/features/city_ai/application/city_ai_controller.dart';
import 'package:city_ai_core/features/city_ai/data/lexical_retriever.dart';
import 'package:city_ai_demo/features/city_ai/presentation/city_ai_page.dart';

import 'support.dart';

void main() {
  late CityAiController c;
  setUp(() async {
    c = CityAiController(
      knowledge: MemoryKnowledge(),
      models: FakeModels(),
      retriever: const LexicalRetriever(),
      engine: FakeEngine(),
    );
    await c.initialize();
  });
  tearDown(() async {
    await c.close();
    c.dispose();
  });
  testWidgets(
    'Traditional Chinese search, demo marker, source and no-result UI',
    (tester) async {
      await tester.pumpWidget(CityAiApp(home: CityAiPage(controller: c)));
      expect(find.text('離線城市助理'), findsOneWidget);
      await tester.enterText(find.byType(TextField), '文山區社區關懷據點');
      await tester.scrollUntilVisible(
        find.text('查詢離線資料'),
        200,
        scrollable: find
            .descendant(
              of: find.byKey(const Key('knowledge-list')),
              matching: find.byType(Scrollable),
            )
            .first,
      );
      await tester.pumpAndSettle();
      await tester.tap(find.text('查詢離線資料'));
      await tester.pumpAndSettle();
      await tester.scrollUntilVisible(
        find.byType(SourceCard),
        250,
        scrollable: find
            .descendant(
              of: find.byKey(const Key('knowledge-list')),
              matching: find.byType(Scrollable),
            )
            .first,
      );
      expect(find.textContaining('測試用文山區'), findsOneWidget);
      expect(find.text('測試資料，非真實市政服務'), findsWidgets);
      expect(find.textContaining('資料日期：未知'), findsWidgets);
      await c.search('zzxx123123');
      await tester.pumpAndSettle();
      expect(c.hits, isEmpty);
      expect(find.byType(SourceCard), findsNothing);
      expect(c.status, contains('開啟手機 AI'));
    },
  );
  testWidgets('200% font, labels, accessible targets and locked Gemma', (
    tester,
  ) async {
    tester.view.physicalSize = const Size(400, 900);
    tester.view.devicePixelRatio = 1;
    addTearDown(tester.view.resetPhysicalSize);
    addTearDown(tester.view.resetDevicePixelRatio);
    final semantics = tester.ensureSemantics();
    tester.platformDispatcher.textScaleFactorTestValue = 2;
    addTearDown(tester.platformDispatcher.clearTextScaleFactorTestValue);
    await tester.pumpWidget(CityAiApp(home: CityAiPage(controller: c)));
    expect(tester.takeException(), isNull);
    await tester.tap(find.byTooltip('模型管理'));
    await tester.pumpAndSettle();
    await tester.scrollUntilVisible(
      find.text('Gemma 3 1B IT QAT Q4_0'),
      350,
      scrollable: find
          .descendant(
            of: find.byKey(const Key('model-list')),
            matching: find.byType(Scrollable),
          )
          .first,
    );
    expect(find.textContaining('已鎖定：'), findsOneWidget);
    expect(tester.takeException(), isNull);
    await expectLater(tester, meetsGuideline(androidTapTargetGuideline));
    await expectLater(tester, meetsGuideline(labeledTapTargetGuideline));
    semantics.dispose();
  });
}
