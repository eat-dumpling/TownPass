// SPDX-License-Identifier: AGPL-3.0-or-later
import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:integration_test/integration_test.dart';
import 'package:city_ai_demo/main.dart';
import 'package:city_ai_demo/features/city_ai/presentation/city_ai_page.dart';

void main() {
  IntegrationTestWidgetsFlutterBinding.ensureInitialized();
  testWidgets('bundled Taipei search, source links and no model opt-in', (
    tester,
  ) async {
    final c = await createController();
    await tester.pumpWidget(CityAiApp(home: CityAiPage(controller: c)));
    expect(c.snapshot!.documents.length, 510);
    expect(c.enabled, isFalse);
    await tester.enterText(find.byType(TextField), '文山區社區關懷據點');
    await tester.testTextInput.receiveAction(TextInputAction.search);
    await tester.pumpAndSettle();
    expect(c.hits, isNotEmpty);
    expect(
      c.hits.every((h) => h.document.sourceUrl.host == 'data.taipei'),
      isTrue,
    );
    await tester.scrollUntilVisible(
      find.byKey(const Key('source-0')),
      250,
      scrollable: find
          .descendant(
            of: find.byKey(const Key('knowledge-list')),
            matching: find.byType(Scrollable),
          )
          .first,
    );
    expect(find.byType(SourceCard), findsWidgets);
    await c.search('今天剩餘名額');
    await tester.pumpAndSettle();
    expect(c.hits, isEmpty);
    expect(c.answer, isEmpty);
    expect(c.engine.isLoaded, isFalse);
    await c.close();
  });
}
