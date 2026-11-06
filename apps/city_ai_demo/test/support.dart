// SPDX-License-Identifier: AGPL-3.0-or-later
import 'dart:async';
import 'dart:io';

import 'package:city_ai_core/features/city_ai/domain/chat.dart';

import 'package:city_ai_core/features/city_ai/domain/knowledge.dart';
import 'package:city_ai_core/features/city_ai/domain/model.dart';
import 'package:city_ai_core/features/city_ai/data/secure_transfer.dart';
import 'package:city_ai_core/features/city_ai/ports/services.dart';

KnowledgeSnapshot fixture() => KnowledgeSnapshot.parse(
  File(
    File('assets/knowledge/knowledge_demo.json').existsSync()
        ? 'assets/knowledge/knowledge_demo.json'
        : 'packages/city_ai_core/assets/knowledge/knowledge_demo.json',
  ).readAsStringSync(),
);
List<ModelDescriptor> registry() => ModelDescriptor.parseRegistry(
  File(
    File('assets/models/model_registry.json').existsSync()
        ? 'assets/models/model_registry.json'
        : 'packages/city_ai_core/assets/models/model_registry.json',
  ).readAsStringSync(),
);

class FakeResources implements DeviceResources {
  int space = 4 * 1024 * 1024 * 1024;
  bool supported = true;
  @override
  Future<int> freeDiskBytes() async => space;
  @override
  Future<bool> canRunModel({int modelBytes = 0}) async => supported;
}

class MemoryKnowledge implements KnowledgeRepository {
  @override
  String status = '使用內建離線測試資料';
  @override
  bool get canUpdate => false;
  @override
  Future<KnowledgeSnapshot> load() async => fixture();
  @override
  Future<KnowledgeSnapshot> update({
    void Function(int receivedBytes, int? totalBytes, String message)?
    onProgress,
  }) async => throw const SocketException('offline');
  @override
  void cancelUpdate() {}
}

class FakeModels implements ModelRepository {
  bool available = false;
  int installs = 0;
  @override
  List<ModelDescriptor> get models => registry();
  @override
  Future<InstalledModel?> installed(String id) async =>
      available ? InstalledModel(models.first, '/private/test.gguf') : null;
  @override
  Future<InstalledModel> install(
    String id, {
    required bool consent,
    required void Function(double?, String) progress,
  }) async {
    installs++;
    if (!consent) throw const AiFailure(AiFailureKind.consent, '未同意');
    available = true;
    progress(1, '測試完成');
    return InstalledModel(models.first, '/private/test.gguf');
  }

  @override
  void cancelDownload() {}
  @override
  Future<void> remove(String id) async {
    available = false;
  }
}

class FakeEngine implements LocalInferenceEngine {
  int loads = 0, generations = 0, cancels = 0, disposals = 0;
  bool loaded = false;
  List<ChatTurn> lastHistory = [];
  List<SearchHit> lastHits = [];
  bool fail = false;
  Completer<void>? loadGate;
  Completer<void>? cancelGate;
  bool throwOnCancel = false, throwSynchronously = false;
  StreamController<String>? manual;
  @override
  bool get isLoaded => loaded;
  @override
  Future<void> load(InstalledModel model) async {
    loads++;
    await loadGate?.future;
    loaded = true;
  }

  @override
  Stream<String> generate(
    String question,
    List<SearchHit> hits, {
    List<ChatTurn> history = const [],
  }) {
    generations++;
    if (throwSynchronously) {
      throw const AiFailure(AiFailureKind.runtime, '本機引擎未能開始生成');
    }
    lastHistory = List.of(history);
    lastHits = List.of(hits);
    if (fail) {
      return Stream.error(const AiFailure(AiFailureKind.memory, '記憶體不足'));
    }
    return manual?.stream ??
        Stream.fromIterable(
          hits.isEmpty
              ? ['這是單元測試的', '一般對話回答。']
              : ['${hits.first.document.body} ', '[1]'],
        );
  }

  @override
  Future<void> cancel() async {
    cancels++;
    await cancelGate?.future;
    if (throwOnCancel) throw StateError('test-only cancellation failure');
  }

  @override
  Future<void> dispose() async {
    disposals++;
    loaded = false;
  }
}

class FakeTransport implements DownloadTransport {
  final Map<String, List<int>> responses = {};
  final List<Uri> requests = [];
  int? chunkSize;
  @override
  Stream<List<int>> get(
    Uri uri,
    HttpsPolicy policy,
    CancelToken cancel,
  ) async* {
    policy.check(uri);
    cancel.check();
    requests.add(uri);
    final payload = responses[uri.toString()];
    if (payload == null) throw const SocketException('offline');
    final step = chunkSize ?? payload.length;
    for (var offset = 0; offset < payload.length; offset += step) {
      cancel.check();
      yield payload.sublist(offset, (offset + step).clamp(0, payload.length));
    }
  }
}
