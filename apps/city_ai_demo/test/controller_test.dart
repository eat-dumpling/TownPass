// SPDX-License-Identifier: AGPL-3.0-or-later
import 'dart:async';

import 'package:flutter_test/flutter_test.dart';
import 'package:city_ai_core/features/city_ai/application/city_ai_controller.dart';
import 'package:city_ai_core/features/city_ai/data/lexical_retriever.dart';
import 'package:city_ai_core/features/city_ai/domain/model.dart';

import 'support.dart';

void main() {
  late FakeEngine engine;
  late FakeModels models;
  late CityAiController c;
  setUp(() async {
    engine = FakeEngine();
    models = FakeModels();
    c = CityAiController(
      knowledge: MemoryKnowledge(),
      models: models,
      retriever: const LexicalRetriever(),
      engine: engine,
    );
    await c.initialize();
  });
  tearDown(() async {
    await c.close();
    c.dispose();
  });
  test(
    'offline and missing model never generate; unknown query abstains',
    () async {
      await c.search('文山區社區關懷據點');
      expect(c.hits, isNotEmpty);
      expect(engine.generations, 0);
      await c.setEnabled(true);
      expect(c.enabled, isFalse);
      expect(engine.loads, 0);
      await c.search('zzxx123123');
      expect(c.status, contains('開啟手機 AI'));
      expect(engine.generations, 0);
      await c.update();
      await c.search('文山區社區關懷據點');
      expect(c.hits, isNotEmpty);
    },
  );
  test('explicit opt-in, source-checked fake streaming and reuse', () async {
    models.available = true;
    await c.setEnabled(true);
    await c.search('文山區社區關懷據點');
    await Future<void>.delayed(Duration.zero);
    expect(c.answer, endsWith('[1]'));
    expect(engine.loads, 1);
    await c.search('文山區社區關懷據點');
    await Future<void>.delayed(Duration.zero);
    expect(engine.loads, 1);
    expect(engine.generations, 2);
    await c.search('zzxx123123');
    expect(engine.generations, 3);
    await Future<void>.delayed(Duration.zero);
    expect(c.answerMode, 'general');
    expect(c.answer, contains('一般對話回答'));
    await c.deleteModel(models.models.first.id);
    expect(engine.isLoaded, isFalse);
    expect(models.available, isFalse);
  });
  test(
    'cancel ignores late events, supports next query and disposal',
    () async {
      models.available = true;
      await c.setEnabled(true);
      final stream = StreamController<String>();
      engine.manual = stream;
      await c.search('文山區社區關懷據點');
      expect(c.generating, isTrue);
      await c.stop();
      stream.add('不可信內容');
      await Future<void>.delayed(Duration.zero);
      expect(c.answer, isEmpty);
      expect(c.generating, isFalse);
      await stream.close();
      engine.manual = null;
      await c.search('文山區社區關懷據點');
      await Future<void>.delayed(Duration.zero);
      expect(c.answer, isNotEmpty);
      await c.close();
      expect(engine.isLoaded, isFalse);
    },
  );
  test('memory failure retains retriever and disables generation', () async {
    models.available = true;
    await c.setEnabled(true);
    engine.fail = true;
    await c.search('文山區社區關懷據點');
    await Future<void>.delayed(Duration.zero);
    expect(c.hits, isNotEmpty);
    expect(c.enabled, isFalse);
    expect(c.status, contains('記憶體不足'));
    expect(engine.isLoaded, isFalse);
    expect(c.loadingModel, isFalse);
  });
  test('opting out during pending load cannot enable a late model', () async {
    models.available = true;
    final gate = Completer<void>();
    engine.loadGate = gate;
    final loading = c.setEnabled(true);
    await Future<void>.delayed(Duration.zero);
    final disabling = c.setEnabled(false);
    expect(c.enabled, isFalse);
    gate.complete();
    await loading;
    await disabling;
    expect(c.enabled, isFalse);
    expect(engine.isLoaded, isFalse);
    expect(c.loadingModel, isFalse);
  });
  test(
    'injection document cannot become a generated answer or remote action',
    () async {
      models.available = true;
      await c.setEnabled(true);
      await c.search('惡意文件注入測試');
      await Future<void>.delayed(Duration.zero);
      expect(c.hits.first.document.id, 'demo-injection-001');
      expect(c.answer, isEmpty);
      expect(c.status, contains('未通過來源核對'));
      expect(models.installs, 0);
    },
  );
  test(
    'total deadline stops a stream even while deltas keep arriving',
    () async {
      final timed = CityAiController(
        knowledge: MemoryKnowledge(),
        models: models,
        retriever: const LexicalRetriever(),
        engine: engine,
        generationTimeout: const Duration(milliseconds: 100),
      );
      final completed = Completer<void>();
      Timer? producer;
      final stream = StreamController<String>(sync: true);
      try {
        await timed.initialize();
        models.available = true;
        await timed.setEnabled(true);
        engine.manual = stream;
        timed.addListener(() {
          if (!timed.generating &&
              !timed.loadingModel &&
              !completed.isCompleted) {
            completed.complete();
          }
        });
        await timed.search('文山區社區關懷據點');
        stream.add('字');
        producer = Timer.periodic(const Duration(milliseconds: 10), (_) {
          if (timed.generating) stream.add('字');
        });
        await completed.future.timeout(const Duration(seconds: 3));
        expect(timed.generating, isFalse);
        expect(timed.enabled, isFalse);
        expect(timed.status, contains('時間限制'));
        expect(engine.isLoaded, isFalse);
        expect(timed.hits, isNotEmpty);
        expect(timed.receivedCharacters, greaterThan(0));
      } finally {
        producer?.cancel();
        await timed.close();
        await stream.close();
        timed.dispose();
      }
    },
  );
  test(
    'old stop cannot erase a newer query and native cancellations serialize',
    () async {
      models.available = true;
      await c.setEnabled(true);
      final gate = Completer<void>();
      engine.cancelGate = gate;
      final stopping = c.stop();
      final searching = c.search('文山區社區關懷據點');
      await Future<void>.delayed(Duration.zero);
      expect(engine.cancels, 1);
      gate.complete();
      await Future.wait([stopping, searching]);
      await Future<void>.delayed(Duration.zero);
      expect(c.answer, isNotEmpty);
      expect(c.status, contains('回答完成'));
      expect(c.enabled, isTrue);
    },
  );
  test(
    'retrieval stays usable while failed native cleanup is still pending',
    () async {
      models.available = true;
      await c.setEnabled(true);
      final stream = StreamController<String>();
      final gate = Completer<void>();
      engine.manual = stream;
      try {
        await c.search('文山區社區關懷據點');
        engine.cancelGate = gate;
        stream.addError(const AiFailure(AiFailureKind.memory, '記憶體不足'));
        await Future<void>.delayed(Duration.zero);
        expect(c.loadingModel, isTrue);
        await c.search('文山區社區關懷據點').timeout(const Duration(seconds: 1));
        expect(c.hits, isNotEmpty);
        expect(engine.generations, 1);
        expect(c.enabled, isFalse);
      } finally {
        gate.complete();
        await c.close();
        await stream.close();
      }
    },
  );
  test(
    'synchronous native failure releases model and leaves searchable sources',
    () async {
      models.available = true;
      await c.setEnabled(true);
      engine.throwSynchronously = true;
      await c.search('文山區社區關懷據點');
      await Future<void>.delayed(Duration.zero);
      expect(c.generating, isFalse);
      expect(c.enabled, isFalse);
      expect(engine.isLoaded, isFalse);
      expect(c.hits, isNotEmpty);
      expect(c.status, contains('未能開始'));
    },
  );
  test('shutdown is idempotent and clears history even when native cancellation fails', () async {
    models.available = true;
    await c.setEnabled(true);
    await c.search('文山區社區關懷據點');
    await Future<void>.delayed(Duration.zero);
    engine.throwOnCancel = true;
    final closing = c.close();
    expect(identical(closing, c.close()), isTrue);
    await closing;
    expect(c.history, isEmpty);
    expect(c.hits, isEmpty);
    expect(engine.isLoaded, isFalse);
    final loads = engine.loads;
    await c.setEnabled(true);
    await c.download(models.models.first.id, true);
    expect(engine.loads, loads);
    expect(models.installs, 0);
  });
}
