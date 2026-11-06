// SPDX-License-Identifier: AGPL-3.0-or-later
import 'dart:async';
import 'dart:convert';
import 'dart:io';

import 'package:flutter_test/flutter_test.dart';
import 'package:city_ai_core/city_ai_core.dart';
import 'package:town_pass/features/city_ai/city_ai_gateway.dart';

import '../apps/city_ai_demo/test/support.dart';

void main() {
  late FakeModels models;
  late FakeEngine engine;
  late CityAiController c;
  late CityAiGateway gateway;
  late List<Map<String, dynamic>> events;
  late List<Uri> opened;
  late Future<bool> Function(ModelDescriptor) confirmation;
  setUp(() async {
    models = FakeModels()..available = true;
    engine = FakeEngine();
    c = CityAiController(
      knowledge: MemoryKnowledge(),
      models: models,
      retriever: const LexicalRetriever(),
      engine: engine,
    );
    await c.initialize();
    events = [];
    opened = [];
    confirmation = (_) async => false;
    gateway = CityAiGateway(
      controller: c,
      emit: events.add,
      confirmDownload: (model) => confirmation(model),
      openOfficialSource: (uri) async {
        opened.add(uri);
      },
    );
  });
  tearDown(() async {
    await gateway.close();
  });
  Future<void> send(
    String name,
    dynamic data, {
    String origin = cityAiOrigin,
    bool main = true,
  }) => gateway.receive(
    jsonEncode({'name': name, 'data': data}),
    origin: Uri.parse(origin),
    isMainFrame: main,
  );
  test('only exact origin and main frame may reach native engine', () async {
    for (final origin in [
      'https://evil.example',
      'https://city-ai.townpass.local.evil.example',
      'http://city-ai.townpass.local',
    ]) {
      await send('model_enable', true, origin: origin);
      await send('llm_ask', {
        'question': '文山區社區關懷據點',
        'request_id': 'q-1',
      }, origin: origin);
    }
    await send('model_enable', true, main: false);
    expect(engine.loads, 0);
    expect(engine.generations, 0);
    expect(events, isEmpty);
    await send('source_open', 'https://evil.example');
    expect(opened, isEmpty);
    await send('model_install', 'arbitrary-model');
    expect(models.installs, 0);
  });
  test('local AI conversation keeps bounded history and resolves district followup', () async {
    c.snapshot = KnowledgeSnapshot.parse(
      File('packages/city_ai_core/assets/knowledge/knowledge.json')
          .readAsStringSync(),
    );
    await send('model_enable', true);
    await send('llm_ask', {'question': '文山區社區關懷據點', 'request_id': 'q-1'});
    await Future<void>.delayed(Duration.zero);
    expect(engine.generations, 1);
    expect(c.answer, isNotEmpty);
    await send('llm_ask', {'question': '那大安區呢？', 'request_id': 'q-2'});
    await Future<void>.delayed(Duration.zero);
    expect(c.hits.first.document.district, '大安區');
    expect(engine.lastHistory.map((t) => t.text), contains('文山區社區關懷據點'));
    expect(engine.loads, 1);
    expect(engine.generations, 2);
    expect(events.last['request_id'], 'q-2');
    await send('source_open', c.hits.first.document.id);
    expect(opened.single.host, 'data.taipei');
    await send('conversation_clear', null);
    expect(c.history, isEmpty);
    expect(c.hits, isEmpty);
  });
  test('no sources still invokes local conversation; malformed requests never invoke it', () async {
    await send('model_enable', true);
    await send('llm_ask', {'question': '保證即時活動名額', 'request_id': 'q-3'});
    await Future<void>.delayed(Duration.zero);
    expect(engine.generations, 1);
    expect(c.answerMode, 'general');
    expect(c.answer, isNotEmpty);
    await gateway.receive(
      'not-json',
      origin: Uri.parse(cityAiOrigin),
      isMainFrame: true,
    );
    await send('llm_ask', {'question': 'x' * 501, 'request_id': 'q-4'});
    expect(engine.generations, 1);
    expect(events.last['type'], 'error');
  });
  test('query during data update returns a correlated error without the previous answer', () async {
    await send('model_enable', true);
    await send('llm_ask', {'question': '文山區社區關懷據點', 'request_id': 'q-old'});
    await Future<void>.delayed(Duration.zero);
    expect(c.answer, isNotEmpty);
    c.updating = true;
    events.clear();
    await send('llm_ask', {'question': '那大安區呢？', 'request_id': 'q-new'});
    expect(events, hasLength(1));
    expect(events.single['type'], 'error');
    expect(events.single['action'], 'llm_ask');
    expect(events.single['request_id'], 'q-new');
    expect(events.single['message'], contains('更新中'));
    expect(events.single.containsKey('answer'), isFalse);
    c.updating = false;
  });
  test(
    'repeated download action opens only one native consent dialog',
    () async {
      final consent = Completer<bool>();
      var confirmations = 0;
      confirmation = (_) {
        confirmations++;
        return consent.future;
      };
      final first = send('model_install', models.models.first.id);
      await send('model_install', models.models.first.id);
      expect(confirmations, 1);
      consent.complete(true);
      await first;
      expect(models.installs, 1);
    },
  );
  test(
    'reply is ready only after retrieval or streaming has completed',
    () async {
      await send('llm_ask', {'question': '文山區社區關懷據點', 'request_id': 'q-local'});
      expect(events.any((event) => event['reply_ready'] == false), isTrue);
      expect(events.last['reply_ready'], isTrue);
      await send('model_enable', true);
      final stream = StreamController<String>();
      engine.manual = stream;
      await send('llm_ask', {'question': '文山區社區關懷據點', 'request_id': 'q-model'});
      expect(events.last['reply_ready'], isFalse);
      stream.add('${c.hits.first.document.body} [1]');
      await stream.close();
      await Future<void>.delayed(Duration.zero);
      expect(events.last['reply_ready'], isTrue);
      expect(events.last['answer'], isNotEmpty);
    },
  );
  test('queued native request can be cancelled and replaced while one shared load continues', () async {
    final auto = CityAiController(
      knowledge: MemoryKnowledge(),
      models: models,
      retriever: const LexicalRetriever(),
      engine: engine,
      automaticGeneration: true,
    );
    await auto.initialize(checkModels: false);
    final loading = Completer<void>();
    engine.loadGate = loading;
    final bridge = CityAiGateway(
      controller: auto,
      emit: events.add,
      confirmDownload: (_) async => false,
      openOfficialSource: (_) async {},
    );
    Future<void> post(String name, dynamic data) => bridge.receive(
      jsonEncode({'name': name, 'data': data}),
      origin: Uri.parse(cityAiOrigin),
      isMainFrame: true,
    );
    try {
      final first = post('llm_ask', {
        'question': '不要回答這題',
        'request_id': 'q-queued',
      });
      await Future<void>.delayed(Duration.zero);
      expect(events.last['waiting_for_model'], isTrue);
      expect(events.last['reply_ready'], isFalse);
      await post('llm_cancel', null).timeout(const Duration(seconds: 1));
      expect(events.last['reply_ready'], isTrue);
      final second = post('llm_ask', {
        'question': '你是誰',
        'request_id': 'q-replaced',
      });
      loading.complete();
      await first;
      await second;
      await Future<void>.delayed(Duration.zero);
      expect(engine.generations, 1);
      expect(engine.loads, 1);
      expect(events.last['request_id'], 'q-replaced');
      expect(events.last['reply_ready'], isTrue);
    } finally {
      if (!loading.isCompleted) loading.complete();
      await bridge.close();
    }
  });
}
