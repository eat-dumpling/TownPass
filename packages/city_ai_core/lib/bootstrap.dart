// SPDX-License-Identifier: AGPL-3.0-or-later
import 'dart:io';

import 'package:flutter/services.dart';
import 'package:path_provider/path_provider.dart';

import 'city_ai_core.dart';

class RetrievalOnlyEngine implements LocalInferenceEngine {
  @override
  bool get isLoaded => false;
  @override
  Future<void> load(InstalledModel model) async =>
      throw const AiFailure(AiFailureKind.unsupported, '此建置提供純離線檢索');
  @override
  Stream<String> generate(
    String question,
    List<SearchHit> hits, {
    List<ChatTurn> history = const [],
  }) => const Stream.empty();
  @override
  Future<void> cancel() async {}
  @override
  Future<void> dispose() async {}
}

Future<CityAiController> createCityAiController({
  LocalInferenceEngine Function(Directory models)? engineFactory,
  DeviceResources resources = const NativeDeviceResources(),
  bool automaticGeneration = false,
  bool checkModels = true,
}) async {
  final root = await getApplicationSupportDirectory();
  final modelDir = Directory('${root.path}/city_ai/models');
  const manifest = String.fromEnvironment('KNOWLEDGE_MANIFEST_URL');
  const host = String.fromEnvironment('KNOWLEDGE_RELEASE_HOST');
  final c = CityAiController(
    knowledge: CachedKnowledgeRepository(
      directory: Directory('${root.path}/city_ai/knowledge'),
      resources: resources,
      seed: () => rootBundle.loadString(
        'packages/city_ai_core/assets/knowledge/knowledge.json',
      ),
      manifestUrl: manifest.isEmpty || host.isEmpty
          ? null
          : Uri.parse(manifest),
      updatePolicy: HttpsPolicy({host}),
    ),
    models: PrivateModelRepository(
      directory: modelDir,
      resources: resources,
      models: ModelDescriptor.parseRegistry(
        await rootBundle.loadString(
          'packages/city_ai_core/assets/models/model_registry.json',
        ),
      ),
    ),
    retriever: const LexicalRetriever(),
    engine: engineFactory?.call(modelDir) ?? RetrievalOnlyEngine(),
    supportsGeneration: engineFactory != null,
    automaticGeneration: automaticGeneration,
  );
  await c.initialize(checkModels: checkModels);
  return c;
}
