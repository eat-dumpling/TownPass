// SPDX-License-Identifier: AGPL-3.0-or-later
import 'dart:io';

import 'package:city_ai_core/features/city_ai/domain/chat.dart';

import 'package:llamadart/llamadart.dart';

import 'package:city_ai_core/features/city_ai/domain/knowledge.dart';
import 'package:city_ai_core/features/city_ai/domain/model.dart';
import 'package:city_ai_core/features/city_ai/ports/services.dart';
import 'package:city_ai_core/features/city_ai/data/secure_transfer.dart';

import 'package:city_ai_core/features/city_ai/inference/grounding.dart';

class LlamadartInferenceEngine implements LocalInferenceEngine {
  final DeviceResources resources;
  final Directory privateModelDirectory;
  LlamaEngine? _engine;
  bool _generating = false;
  LlamadartInferenceEngine({
    required this.resources,
    required this.privateModelDirectory,
  });
  @override
  bool get isLoaded => _engine != null;

  @override
  Future<void> load(InstalledModel model) async {
    if (_engine != null) return;
    if (!Platform.isAndroid && !Platform.isIOS) {
      throw const AiFailure(
        AiFailureKind.unsupported,
        '本示範僅開放 Android / iOS 本機推論',
      );
    }
    if (!model.descriptor.approved) {
      throw const AiFailure(AiFailureKind.license, '模型來源或授權未核准');
    }
    if (!await resources.canRunModel(modelBytes: model.descriptor.sizeBytes)) {
      throw const AiFailure(AiFailureKind.memory, '裝置資源不足，請使用離線檢索');
    }
    final root = await privateModelDirectory.resolveSymbolicLinks();
    final file = File(model.path);
    final path = await file.resolveSymbolicLinks();
    if (file.parent.absolute.path != privateModelDirectory.absolute.path ||
        !path.startsWith('$root/')) {
      throw const AiFailure(AiFailureKind.integrity, '模型必須位於應用程式私有儲存空間');
    }
    if (!await verifyFile(
      file,
      model.descriptor.sizeBytes,
      model.descriptor.sha256!,
    )) {
      throw const AiFailure(AiFailureKind.integrity, '載入前校驗失敗');
    }
    await LlamaLogging.configure(
      level: LlamaLogLevel.none,
      nativeLevel: LlamaLogLevel.none,
    );
    try {
      _engine = await LlamaEngine.load(
        LlamaModel(ModelSource.path(path)),
        params: const ModelParams(
          contextSize: 4096,
          device: ComputeDevice.cpu,
          gpuLayers: 0,
          numberOfThreads: 2,
        ),
      );
    } on LlamaUnsupportedException {
      throw const AiFailure(AiFailureKind.unsupported, '此裝置不支援本機模型，請使用離線檢索');
    } catch (_) {
      throw const AiFailure(AiFailureKind.runtime, '模型無法載入，請使用離線檢索');
    }
  }

  @override
  Stream<String> generate(
    String question,
    List<SearchHit> hits, {
    List<ChatTurn> history = const [],
  }) async* {
    final engine = _engine;
    if (engine == null) {
      throw const AiFailure(AiFailureKind.runtime, '模型尚未載入');
    }
    if (_generating) throw const AiFailure(AiFailureKind.busy, '請先停止目前生成');
    if (!await resources.canRunModel()) {
      throw const AiFailure(AiFailureKind.memory, '記憶體不足，已保留離線檢索');
    }
    _generating = true;
    try {
      final system = hits.isEmpty
          ? conversationSystemPrompt
          : groundedSystemPrompt;
      final prompt = hits.isEmpty
          ? question
          : groundedUserPrompt(question, hits);
      var prior = history.length > 4
          ? history.sublist(history.length - 4)
          : history;
      Future<int> tokenCount() async => (await engine.tokenize(
        '$system\n${prior.map((t) => t.text).join("\n")}\n$prompt',
        addSpecial: false,
      )).length;
      while (prior.isNotEmpty && await tokenCount() > 3200) {
        prior = prior.sublist(prior.length >= 2 ? 2 : 1);
      }
      if (await tokenCount() > 3200) {
        throw const AiFailure(
          AiFailureKind.runtime,
          '問題與來源超過模型可用長度，請縮短問題或使用離線檢索',
        );
      }
      await for (final chunk in engine.create(
        [
          LlamaChatMessage.fromText(role: LlamaChatRole.system, text: system),
          for (final turn in prior)
            LlamaChatMessage.fromText(
              role: turn.role == ChatRole.user
                  ? LlamaChatRole.user
                  : LlamaChatRole.assistant,
              text: turn.text,
            ),
          LlamaChatMessage.fromText(role: LlamaChatRole.user, text: prompt),
        ],
        params: GenerationParams(maxTokens: 384, temp: 0.1),
        enableThinking: false,
      )) {
        for (final choice in chunk.choices) {
          final text = choice.delta.content;
          if (text != null && text.isNotEmpty) yield text;
        }
      }
    } on AiFailure {
      rethrow;
    } catch (_) {
      throw const AiFailure(
        AiFailureKind.runtime,
        '手機 AI 暫時無法回答，請稍後重試；仍可查離線資料',
      );
    } finally {
      _generating = false;
    }
  }

  @override
  Future<void> cancel() async {
    _engine?.cancelGeneration();
  }

  @override
  Future<void> dispose() async {
    try {
      await cancel();
    } finally {
      final engine = _engine;
      _engine = null;
      await engine?.dispose();
    }
  }
}
