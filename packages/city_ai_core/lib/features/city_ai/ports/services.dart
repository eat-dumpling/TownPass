// SPDX-License-Identifier: AGPL-3.0-or-later
import '../domain/knowledge.dart';
import '../domain/model.dart';
import '../domain/chat.dart';

abstract interface class KnowledgeRepository {
  Future<KnowledgeSnapshot> load();
  Future<KnowledgeSnapshot> update({
    void Function(int receivedBytes, int? totalBytes, String message)?
    onProgress,
  });
  void cancelUpdate();
  String get status;
  bool get canUpdate;
}

abstract interface class OfflineRetriever {
  List<SearchHit> search(
    String query,
    KnowledgeSnapshot snapshot, {
    int topK = 3,
  });
}

abstract interface class LocalInferenceEngine {
  bool get isLoaded;
  Future<void> load(InstalledModel model);

  /// Empty hits mean normal local conversation; otherwise include those
  /// untrusted references. Retrieval is an optional augmentation, not a gate.
  Stream<String> generate(
    String question,
    List<SearchHit> hits, {
    List<ChatTurn> history = const [],
  });
  Future<void> cancel();
  Future<void> dispose();
}

abstract interface class DeviceResources {
  Future<int> freeDiskBytes();
  Future<bool> canRunModel({int modelBytes = 0});
}

abstract interface class ModelRepository {
  List<ModelDescriptor> get models;
  Future<InstalledModel?> installed(String id);
  Future<InstalledModel> install(
    String id, {
    required bool consent,
    required void Function(double?, String) progress,
  });
  void cancelDownload();
  Future<void> remove(String id);
}
