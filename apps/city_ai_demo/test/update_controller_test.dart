// SPDX-License-Identifier: AGPL-3.0-or-later
import 'dart:async';

import 'package:city_ai_core/city_ai_core.dart';
import 'package:flutter_test/flutter_test.dart';

import 'support.dart';

class ControlledKnowledge extends MemoryKnowledge {
  final result = Completer<KnowledgeSnapshot>();
  int updates = 0, cancellations = 0;
  bool active = false;
  @override
  bool get canUpdate => true;
  @override
  Future<KnowledgeSnapshot> update({
    void Function(int, int?, String)? onProgress,
  }) async {
    updates++;
    active = true;
    onProgress?.call(32, 128, '正在下載公開資料');
    try {
      final snapshot = await result.future;
      status = '更新成功：fixture-version';
      return snapshot;
    } finally {
      active = false;
    }
  }

  @override
  void cancelUpdate() {
    if (active && !result.isCompleted) {
      cancellations++;
      result.completeError(
        const AiFailure(AiFailureKind.cancelled, '更新已取消，保留原有離線資料'),
      );
    }
  }
}

void main() {
  late ControlledKnowledge knowledge;
  late FakeEngine engine;
  late CityAiController controller;
  setUp(() async {
    knowledge = ControlledKnowledge();
    engine = FakeEngine();
    controller = CityAiController(
      knowledge: knowledge,
      models: FakeModels(),
      retriever: const LexicalRetriever(),
      engine: engine,
    );
    await controller.initialize();
  });
  tearDown(() async {
    await controller.close();
    controller.dispose();
  });

  test('cancel during preflight prevents any update request', () async {
    final gate = Completer<void>();
    engine.cancelGate = gate;
    final updating = controller.update();
    controller.cancelUpdate();
    gate.complete();
    await updating;
    expect(knowledge.updates, 0);
    expect(controller.updating, isFalse);
    expect(controller.dataStatus, contains('已取消'));
  });
  test(
    'progress and cancellation preserve existing snapshot and conversation',
    () async {
      await controller.search('文山區社區關懷據點');
      final previous = controller.snapshot;
      final updating = controller.update();
      await Future<void>.delayed(Duration.zero);
      expect(controller.dataReceivedBytes, 32);
      expect(controller.dataTotalBytes, 128);
      expect(controller.updating, isTrue);
      await expectLater(controller.search('那大安區呢？'), throwsA(isA<AiFailure>()));
      controller.cancelUpdate();
      await updating;
      expect(identical(controller.snapshot, previous), isTrue);
      expect(controller.history, isNotEmpty);
      expect(controller.conversationRevision, 0);
      expect(controller.dataStatus, contains('已取消'));
    },
  );
  test('successful update clears prior citations and context before a new conversation', () async {
    await controller.search('文山區社區關懷據點');
    final updating = controller.update();
    await Future<void>.delayed(Duration.zero);
    knowledge.result.complete(fixture());
    await updating;
    expect(controller.history, isEmpty);
    expect(controller.hits, isEmpty);
    expect(controller.conversationRevision, 1);
    expect(controller.dataStatus, contains('fixture-version'));
    await controller.search('那大安區呢？');
    expect(controller.hits, isEmpty);
  });
  test('leaving cancels pending download and emits no late state', () async {
    var notifications = 0;
    controller.addListener(() => notifications++);
    final updating = controller.update();
    await Future<void>.delayed(Duration.zero);
    await controller.close();
    final afterClose = notifications;
    await updating;
    expect(knowledge.cancellations, 1);
    expect(controller.history, isEmpty);
    expect(notifications, afterClose);
  });
}
