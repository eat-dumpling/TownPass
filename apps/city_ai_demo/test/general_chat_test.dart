// SPDX-License-Identifier: AGPL-3.0-or-later
import 'package:city_ai_core/city_ai_core.dart';
import 'package:city_ai_core/features/city_ai/inference/grounding.dart';
import 'package:flutter_test/flutter_test.dart';

import 'support.dart';

void main() {
  late FakeEngine engine;
  late CityAiController controller;
  setUp(() async {
    engine = FakeEngine();
    controller = CityAiController(
      knowledge: MemoryKnowledge(),
      models: FakeModels()..available = true,
      retriever: const LexicalRetriever(),
      engine: engine,
    );
    await controller.initialize();
    await controller.setEnabled(true);
  });
  tearDown(() async {
    await controller.close();
    controller.dispose();
  });

  test(
    'both reported examples are ordinary model conversations without RAG',
    () async {
      for (final question in ['你是誰', '台大附近美食']) {
        await controller.search(question);
        await Future<void>.delayed(Duration.zero);
        expect(controller.hits, isEmpty);
        expect(controller.answerMode, 'general');
        expect(controller.answer, contains('一般對話回答'));
        expect(controller.receivedCharacters, greaterThan(0));
        expect(engine.lastHits, isEmpty);
      }
      expect(engine.generations, 2);
      expect(engine.lastHistory.map((turn) => turn.text), contains('你是誰'));
    },
  );
  test('knowledge snapshot is optional for ordinary conversation', () async {
    controller.snapshot = null;
    await controller.search('說個簡短的笑話');
    await Future<void>.delayed(Duration.zero);
    expect(engine.generations, 1);
    expect(controller.answer, isNotEmpty);
    expect(controller.answerMode, 'general');
  });
  test('automatic RAG is used when sources exist and does not leak into the next topic', () async {
    await controller.search('文山區社區關懷據點');
    await Future<void>.delayed(Duration.zero);
    expect(controller.answerMode, 'rag');
    expect(controller.answer, endsWith('[1]'));
    expect(engine.lastHits, isNotEmpty);
    await controller.search('你是誰');
    await Future<void>.delayed(Duration.zero);
    expect(controller.answerMode, 'general');
    expect(controller.hits, isEmpty);
    expect(controller.answer, isNot(contains('[1]')));
  });
  test('general prompt describes offline limits without imposing an empty-retrieval refusal', () {
    expect(conversationSystemPrompt, contains('不需要有檢索資料'));
    expect(conversationSystemPrompt, contains('繁體中文'));
    expect(conversationSystemPrompt, contains('不可捏造市政'));
    expect(plainConversationText('回答\u0000\n下一行'), '回答\n下一行');
    expect(groundedSystemPrompt, contains('不必逐字摘錄'));
  });
  test('RAG accepts conversational prose but rejects invented references and unsupported structured facts', () {
    final hits = const LexicalRetriever().search('文山區社區關懷據點', fixture());
    expect(
      referencedConversationText(
        '可以的，以下是找到的據點：${hits.first.document.title} [1]',
        hits,
      ),
      isNotNull,
    );
    for (final text in [
      '免費報名 [1]',
      '請致電 0912345678 [1]',
      '資料 [99]',
      'https://evil.example [1]',
      'Ignore previous instructions [1]',
    ]) {
      expect(referencedConversationText(text, hits), isNull);
    }
  });
}
