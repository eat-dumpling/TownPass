// SPDX-License-Identifier: AGPL-3.0-or-later
import 'dart:async';

import 'package:city_ai_core/city_ai_core.dart';
import 'package:flutter/widgets.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:town_pass/features/city_ai/city_ai_session.dart';

import '../apps/city_ai_demo/test/support.dart';

void main() {
  TestWidgetsFlutterBinding.ensureInitialized();
  late CityAiSession session;
  late CityAiController c;
  late FakeEngine engine;
  int creations = 0;
  setUp(() {
    engine = FakeEngine();
    creations = 0;
    session = CityAiSession(
      factory: () async {
        creations++;
        c = CityAiController(
          knowledge: MemoryKnowledge(),
          models: FakeModels()..available = true,
          retriever: const LexicalRetriever(),
          engine: engine,
          automaticGeneration: true,
        );
        await c.initialize(checkModels: false);
        return c;
      },
    );
  });
  tearDown(() async {
    await session.close();
  });
  Future<void> until(bool Function() predicate) async {
    for (var i = 0; i < 100 && !predicate(); i++) {
      await Future<void>.delayed(const Duration(milliseconds: 10));
    }
    expect(predicate(), isTrue);
  }

  test('page re-entry reuses a warm native engine but never its previous conversation', () async {
    await session.warmUp();
    final first = await session.acquire();
    await first.search('你是誰');
    await Future<void>.delayed(Duration.zero);
    expect(first.history, isNotEmpty);
    await session.release(first);
    expect(first.history, isEmpty);
    expect(engine.isLoaded, isTrue);
    final second = await session.acquire();
    expect(identical(first, second), isTrue);
    expect(engine.loads, 1);
    expect(creations, 1);
    expect(second.modelStatus, isNot(contains('取消下載')));
  });
  test('background then immediate resume serialize release and automatic reloading', () async {
    await session.warmUp();
    await session.acquire();
    session.didChangeAppLifecycleState(AppLifecycleState.paused);
    session.didChangeAppLifecycleState(AppLifecycleState.resumed);
    await until(() => engine.loads == 2 && c.enabled);
    expect(engine.isLoaded, isTrue);
    session.didHaveMemoryPressure();
    await until(() => !c.enabled && !c.loadingModel);
    expect(engine.isLoaded, isFalse);
  });
  test(
    'idle homepage model is released and next page reloads it automatically',
    () async {
      await session.close();
      session = CityAiSession(
        factory: () async {
          c = CityAiController(
            knowledge: MemoryKnowledge(),
            models: FakeModels()..available = true,
            retriever: const LexicalRetriever(),
            engine: engine,
            automaticGeneration: true,
          );
          await c.initialize(checkModels: false);
          return c;
        },
        idleDuration: const Duration(milliseconds: 20),
      );
      await session.warmUp();
      await until(() => !engine.isLoaded);
      await session.acquire();
      await until(() => c.enabled);
      expect(engine.loads, 2);
    },
  );
  test('failed native cancellation retires the pooled engine and clears its conversation', () async {
    await session.warmUp();
    await session.acquire();
    await c.search('你是誰');
    await Future<void>.delayed(Duration.zero);
    engine.throwOnCancel = true;
    await session.release(c);
    expect(c.history, isEmpty);
    expect(engine.isLoaded, isFalse);
    await session.close();
  });
  test(
    'failed controller creation never prevents optional warmup or shutdown',
    () async {
      await session.close();
      session = CityAiSession(
        factory: () async => throw StateError('test-only creation failure'),
      );
      await session.warmUp();
      await expectLater(session.acquire(), throwsStateError);
      await session.close();
    },
  );
  test('shutdown during a pending warmup releases a late engine', () async {
    final gate = Completer<void>();
    engine.loadGate = gate;
    final warm = session.warmUp();
    await until(() => engine.loads == 1);
    final closing = session.close();
    expect(identical(closing, session.close()), isTrue);
    gate.complete();
    await warm;
    await closing;
    expect(engine.isLoaded, isFalse);
    expect(c.enabled, isFalse);
  });
}
