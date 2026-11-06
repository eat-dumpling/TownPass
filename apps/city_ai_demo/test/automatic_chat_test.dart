// SPDX-License-Identifier: AGPL-3.0-or-later
import 'dart:async';

import 'package:city_ai_core/city_ai_core.dart';
import 'package:flutter_test/flutter_test.dart';

import 'support.dart';

void main() {
  late FakeEngine engine;
  late FakeModels models;
  late CityAiController c;
  setUp(() async {
    engine = FakeEngine();
    models = FakeModels()..available = true;
    c = CityAiController(
      knowledge: MemoryKnowledge(),
      models: models,
      retriever: const LexicalRetriever(),
      engine: engine,
      automaticGeneration: true,
    );
    await c.initialize(checkModels: false);
  });
  tearDown(() async {
    await c.close();
    c.dispose();
  });
  test('homepage preparation and immediate question share one load, without a toggle or download', () async {
    final gate = Completer<void>();
    engine.loadGate = gate;
    final warm = c.prepareAutomatically();
    final question = c.search('你是誰');
    await Future<void>.delayed(Duration.zero);
    expect(c.waitingForModel, isTrue);
    expect(engine.loads, 1);
    expect(engine.generations, 0);
    gate.complete();
    await warm;
    await question;
    await Future<void>.delayed(Duration.zero);
    expect(engine.loads, 1);
    expect(engine.generations, 1);
    expect(c.answerMode, 'general');
    expect(c.answer, isNotEmpty);
    expect(models.installs, 0);
  });
  test('queued question can be stopped and replaced before the native load finishes', () async {
    final gate = Completer<void>();
    engine.loadGate = gate;
    final first = c.search('不要回答這題');
    await Future<void>.delayed(Duration.zero);
    await c.stop().timeout(const Duration(seconds: 1));
    expect(c.waitingForModel, isFalse);
    final second = c.search('你是誰');
    gate.complete();
    await first;
    await second;
    await Future<void>.delayed(Duration.zero);
    expect(engine.loads, 1);
    expect(engine.generations, 1);
    expect(c.history.where((t) => t.role == ChatRole.user).single.text, '你是誰');
  });
  test('clear cancels a queued question without holding the UI until native load completes', () async {
    final gate = Completer<void>();
    engine.loadGate = gate;
    final question = c.search('不要保留這題');
    await Future<void>.delayed(Duration.zero);
    await c.clearConversation().timeout(const Duration(seconds: 1));
    gate.complete();
    await question;
    expect(c.history, isEmpty);
    expect(engine.generations, 0);
    expect(c.waitingForModel, isFalse);
  });
  test('missing model keeps retrieval, never downloads automatically, and download resumes conversation automatically', () async {
    models.available = false;
    await c.search('你是誰');
    expect(c.enabled, isFalse);
    expect(models.installs, 0);
    expect(c.status, contains('下載'));
    await c.search('文山區社區關懷據點');
    expect(c.hits, isNotEmpty);
    expect(engine.generations, 0);
    await c.download(models.models.first.id, true);
    await c.prepareAutomatically();
    await c.search('你是誰');
    await Future<void>.delayed(Duration.zero);
    expect(c.enabled, isTrue);
    expect(engine.generations, 1);
    expect(models.installs, 1);
  });
  test(
    'manual energy-saving preference is respected on new questions and resume',
    () async {
      await c.prepareAutomatically();
      await c.setConversationEnabled(false);
      await c.resumeAutomatically();
      await c.search('你是誰');
      expect(engine.loads, 1);
      expect(engine.generations, 0);
      expect(c.status, contains('省電查詢'));
      await c.setConversationEnabled(true);
      await c.search('你是誰');
      await Future<void>.delayed(Duration.zero);
      expect(engine.generations, 1);
    },
  );
  test(
    'suspending active generation never presents a partial reply as completed',
    () async {
      await c.prepareAutomatically();
      final stream = StreamController<String>();
      engine.manual = stream;
      await c.search('你是誰');
      stream.add('尚未完成的測試回答');
      await Future<void>.delayed(Duration.zero);
      expect(c.answer, isNotEmpty);
      await c.setEnabled(false);
      expect(c.answer, isEmpty);
      expect(c.generating, isFalse);
      expect(c.status, contains('暫停'));
      expect(c.history, isEmpty);
      await stream.close();
    },
  );
  test('preparation timeout completes a queued request and releases a late native load', () async {
    final gate = Completer<void>();
    engine.loadGate = gate;
    final timed = CityAiController(
      knowledge: MemoryKnowledge(),
      models: models,
      retriever: const LexicalRetriever(),
      engine: engine,
      automaticGeneration: true,
      preparationTimeout: const Duration(milliseconds: 30),
    );
    try {
      await timed.initialize(checkModels: false);
      await timed.search('你是誰').timeout(const Duration(seconds: 1));
      expect(timed.waitingForModel, isFalse);
      expect(timed.enabled, isFalse);
      expect(timed.status, contains('逾時'));
      gate.complete();
      await timed.close();
      expect(engine.isLoaded, isFalse);
      expect(engine.generations, 0);
    } finally {
      if (!gate.isCompleted) gate.complete();
      await timed.close();
      timed.dispose();
    }
  });
}
