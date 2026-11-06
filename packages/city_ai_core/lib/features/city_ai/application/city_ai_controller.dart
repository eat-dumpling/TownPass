// SPDX-License-Identifier: AGPL-3.0-or-later
import 'dart:async';

import 'package:flutter/foundation.dart';

import '../domain/knowledge.dart';
import '../domain/model.dart';
import '../domain/chat.dart';
import '../ports/services.dart';
import '../inference/grounding.dart';

class CityAiController extends ChangeNotifier {
  final KnowledgeRepository knowledge;
  final ModelRepository models;
  final OfflineRetriever retriever;
  final LocalInferenceEngine engine;
  final bool supportsGeneration;
  final bool automaticGeneration;
  final Duration generationTimeout;
  final Duration preparationTimeout;
  bool automaticPaused = false;
  bool waitingForModel = false;
  bool _automaticFailed = false;
  Future<void>? _automaticPreparation;
  final List<ChatTurn> _history = [];
  String _retrievalContext = '';
  List<ChatTurn> get history => List.unmodifiable(_history);
  KnowledgeSnapshot? snapshot;
  List<SearchHit> hits = [];
  String status = '正在讀取離線資料', answer = '', modelStatus = '本機生成預設關閉';
  String answerMode = 'retrieval';
  String? activeModelId;
  String dataStatus = '正在讀取離線資料';
  int dataReceivedBytes = 0;
  int? dataTotalBytes;
  int conversationRevision = 0;
  bool generating = false,
      enabled = false,
      loadingModel = false,
      updating = false,
      downloading = false;
  double? downloadProgress;
  int receivedCharacters = 0;
  int successfulModelLoads = 0;
  final Map<String, bool> installedModels = {};
  StreamSubscription<String>? _stream;
  Timer? _generationDeadline;
  Future<void>? _engineOperations;
  Future<void>? _closing;
  int _epoch = 0, _modelEpoch = 0;
  bool _closed = false;
  bool _cancelDataUpdate = false;
  CityAiController({
    required this.knowledge,
    required this.models,
    required this.retriever,
    required this.engine,
    this.supportsGeneration = true,
    this.automaticGeneration = false,
    this.generationTimeout = const Duration(seconds: 45),
    this.preparationTimeout = const Duration(seconds: 60),
  });
  Future<void> _engineAction(Future<void> Function() action) async {
    final previous = _engineOperations;
    final completed = Completer<void>();
    _engineOperations = completed.future;
    try {
      if (previous != null) await previous;
      await action();
    } finally {
      completed.complete();
      if (identical(_engineOperations, completed.future)) {
        _engineOperations = null;
      }
    }
  }

  void _notify() {
    if (!_closed) notifyListeners();
  }

  Future<void> initialize({bool checkModels = true}) async {
    try {
      snapshot = await knowledge.load();
      status = knowledge.status;
    } catch (_) {
      status = '離線資料無法讀取，請重新安裝或檢查更新包';
    }
    dataStatus = status;
    _notify();
    if (!checkModels) return;
    await refreshModelAvailability();
  }

  Future<void> refreshModelAvailability({bool onlyUnchecked = false}) async {
    for (final m in models.models) {
      if (_closed) return;
      if (onlyUnchecked && installedModels.containsKey(m.id)) continue;
      try {
        installedModels[m.id] = await models.installed(m.id) != null;
      } catch (_) {
        installedModels[m.id] = false;
      }
      if (_closed) return;
    }
    _notify();
  }

  bool get willPrepareAutomatically =>
      automaticGeneration && supportsGeneration && !automaticPaused;

  /// Reuses one preparation task for homepage warmup and an early question.
  /// No automatic download: only an already installed, verified model is used.
  Future<void> prepareAutomatically() async {
    if (_closed || !willPrepareAutomatically || enabled || _automaticFailed) {
      return;
    }
    final previous = _automaticPreparation;
    if (previous != null) return previous;
    final done = Completer<void>();
    _automaticPreparation = done.future;
    try {
      await setEnabled(true).timeout(preparationTimeout);
      _automaticFailed = !enabled;
      if (enabled) unawaited(refreshModelAvailability(onlyUnchecked: true));
    } on TimeoutException {
      _automaticFailed = true;
      unawaited(setEnabled(false));
      modelStatus = '本機 AI 準備逾時，仍可離線查資料；可在設定重試';
      status = modelStatus;
      _notify();
    } finally {
      done.complete();
      if (identical(_automaticPreparation, done.future)) {
        _automaticPreparation = null;
      }
    }
  }

  Future<void> setConversationEnabled(bool value) async {
    automaticPaused = !value;
    _automaticFailed = false;
    await setEnabled(value);
  }

  Future<void> resumeAutomatically() async {
    _automaticFailed = false;
    await prepareAutomatically();
  }

  Future<void> search(String question) async {
    if (_closed) return;
    if (updating) {
      throw const AiFailure(AiFailureKind.busy, '資料更新中，請完成或取消更新後再提問');
    }
    final epoch = ++_epoch;
    // Retrieval must remain responsive even while a failed native engine is
    // still releasing resources. Only active/opted-in inference needs its fence.
    if (enabled || generating || _stream != null) await _stop();
    if (_closed || epoch != _epoch) return;
    answer = '';
    receivedCharacters = 0;
    final data = snapshot;
    var retrievalQuestion = question;
    var remainder = question;
    for (final district in districts) {
      remainder = remainder.replaceAll(district, '');
    }
    remainder = remainder.replaceAll(RegExp(r'[\s，。？！,.?!]'), '');
    final followup =
        remainder.isNotEmpty &&
        RegExp(r'^(那|呢|換成|改成|請問|還有|也|的|有嗎|怎麼樣|電話|地址)+$').hasMatch(remainder);
    if (followup && _retrievalContext.isNotEmpty) {
      var topic = _retrievalContext;
      if (districts.any(question.contains)) {
        for (final district in districts) {
          topic = topic.replaceAll(district, '');
        }
        retrievalQuestion =
            '${districts.where(question.contains).first} $topic';
      } else {
        retrievalQuestion = topic;
      }
    }
    _retrievalContext = retrievalQuestion.substring(
      0,
      retrievalQuestion.length.clamp(0, 500),
    );
    hits = data == null ? [] : retriever.search(retrievalQuestion, data);
    status = hits.isEmpty ? insufficientData : '找到 ${hits.length} 筆來源，顯示資料原文';
    answerMode = hits.isEmpty ? 'general' : 'rag';
    if (willPrepareAutomatically && !enabled && !_automaticFailed) {
      waitingForModel = true;
      status = '問題已收到，正在連接手機裡的 AI…';
      _notify();
      await prepareAutomatically();
      if (_closed || epoch != _epoch) return;
      waitingForModel = false;
    }
    if (!enabled || !engine.isLoaded) {
      answerMode = 'retrieval';
      if (hits.isEmpty) {
        status = automaticGeneration
            ? (automaticPaused ? '目前使用省電查詢，可在設定恢復本機對話' : modelStatus)
            : '請先開啟手機 AI，即可直接對話；有相關資料時會自動參考。';
      }
      _remember(
        question,
        hits.isEmpty ? status : hits.map((h) => h.snippet).join('\n'),
      );
      _notify();
      return;
    }
    generating = true;
    status = hits.isEmpty ? '手機 AI 正在回答' : '手機 AI 正在參考離線資料';
    _notify();
    final raw = StringBuffer();
    _generationDeadline = Timer(generationTimeout, () {
      _generationFailed(
        epoch,
        question,
        const AiFailure(AiFailureKind.runtime, '本機生成超過時間限制，已保留離線檢索'),
      );
    });
    try {
      _stream = engine
          .generate(question, hits, history: history)
          .listen(
            (delta) {
              if (_closed || epoch != _epoch) return;
              raw.write(delta);
              receivedCharacters = raw.length;
              if (raw.length > 5000) {
                _generationFailed(
                  epoch,
                  question,
                  const AiFailure(AiFailureKind.runtime, '本機生成超過長度限制，請閱讀來源原文'),
                );
                return;
              }
              answer = hits.isEmpty
                  ? plainConversationText(raw.toString())
                  : referencedConversationText(raw.toString(), hits) ?? '';
              _notify();
            },
            onError: (Object error) {
              _generationFailed(epoch, question, error);
            },
            onDone: () {
              if (_closed || epoch != _epoch) return;
              _generationDeadline?.cancel();
              _generationDeadline = null;
              _stream = null;
              generating = false;
              answer = hits.isEmpty
                  ? plainConversationText(raw.toString()).trim()
                  : referencedConversationText(raw.toString(), hits) ?? '';
              status = answer.isEmpty
                  ? (hits.isEmpty ? '模型未提供回答，請換個說法再試一次' : '生成內容未通過來源核對，請閱讀下方原文')
                  : (hits.isEmpty ? '手機 AI 回答完成' : '手機 AI 回答完成；參考來源如下');
              _remember(question, answer.isEmpty ? status : answer);
              _notify();
            },
            cancelOnError: true,
          );
    } catch (error) {
      _generationFailed(epoch, question, error);
    }
  }

  void _generationFailed(int epoch, String question, Object error) {
    if (_closed || epoch != _epoch) return;
    ++_epoch;
    final modelEpoch = ++_modelEpoch;
    enabled = false;
    _automaticFailed = true;
    loadingModel = true;
    answer = '';
    status = error is AiFailure ? error.message : '本機生成中斷，已保留離線檢索';
    modelStatus = '正在釋放模型資源；離線檢索仍可使用';
    _remember(
      question,
      hits.isEmpty ? status : hits.map((hit) => hit.snippet).join('\n'),
    );
    unawaited(_releaseModel(modelEpoch));
    _notify();
  }

  Future<void> _releaseModel(int modelEpoch) async {
    try {
      try {
        await _stop();
      } finally {
        await _engineAction(engine.dispose);
      }
      if (!_closed && modelEpoch == _modelEpoch) {
        activeModelId = null;
        modelStatus = '模型已釋放；可使用離線檢索或重新啟用';
      }
    } catch (_) {
      if (!_closed && modelEpoch == _modelEpoch) {
        modelStatus = '模型清理未完成，請返回後重新開啟；離線檢索仍可使用';
      }
    } finally {
      if (modelEpoch == _modelEpoch) loadingModel = false;
      _notify();
    }
  }

  void _remember(String question, String reply) {
    _history.addAll([
      ChatTurn(
        ChatRole.user,
        question.substring(0, question.length.clamp(0, 500)),
      ),
      ChatTurn(
        ChatRole.assistant,
        reply.substring(0, reply.length.clamp(0, 500)),
      ),
    ]);
    if (_history.length > 6) _history.removeRange(0, _history.length - 6);
  }

  Future<void> clearConversation() async {
    if (_closed) return;
    final epoch = ++_epoch;
    await _stop();
    if (_closed || epoch != _epoch) return;
    _history.clear();
    _retrievalContext = '';
    hits = [];
    answer = '';
    status = '新對話已開始';
    conversationRevision++;
    _notify();
  }

  Future<void> _stop() async {
    final stream = _stream;
    final wasGenerating = generating;
    _stream = null;
    _generationDeadline?.cancel();
    _generationDeadline = null;
    generating = false;
    waitingForModel = false;
    // Cancelling a queued question must not wait for a native load to finish.
    if (loadingModel && stream == null && !wasGenerating) return;
    await _engineAction(() async {
      try {
        await engine.cancel();
      } finally {
        await stream?.cancel();
      }
    });
  }

  Future<void> stop() async {
    if (_closed) return;
    final epoch = ++_epoch;
    await _stop();
    if (_closed || epoch != _epoch) return;
    answer = '';
    status = '已停止，保留離線檢索結果';
    _notify();
  }

  Future<void> setEnabled(bool value) async {
    if (_closed) return;
    if (value && !supportsGeneration) {
      modelStatus = '此版本提供離線檢索；本機對話需使用 AI 版城市通';
      _notify();
      return;
    }
    if (loadingModel && value) return;
    if (value && enabled && engine.isLoaded) return;
    final modelEpoch = ++_modelEpoch;
    if (!value) {
      enabled = false;
      answer = '';
      status = '手機 AI 已暫停，仍可查離線資料';
      loadingModel = true;
      modelStatus = '正在釋放模型資源';
      _notify();
      ++_epoch;
      await _releaseModel(modelEpoch);
      return;
    }
    loadingModel = true;
    modelStatus = '正在檢查並載入模型';
    _notify();
    try {
      InstalledModel? model;
      for (final candidate in models.models.where((m) => m.approved)) {
        model = await models.installed(candidate.id);
        installedModels[candidate.id] = model != null;
        if (model != null) break;
      }
      if (model == null) {
        throw const AiFailure(AiFailureKind.configuration, '請先在模型管理下載並校驗模型');
      }
      await _engineAction(() async {
        if (_closed || modelEpoch != _modelEpoch) return;
        final alreadyLoaded = engine.isLoaded;
        await engine.load(model!);
        if (!alreadyLoaded && engine.isLoaded) successfulModelLoads++;
        if (_closed || modelEpoch != _modelEpoch) await engine.dispose();
      });
      if (_closed || modelEpoch != _modelEpoch) {
        return;
      }
      enabled = true;
      activeModelId = model.descriptor.id;
      installedModels[model.descriptor.id] = true;
      modelStatus = '手機 AI 已啟用（CPU）：${model.descriptor.name}';
    } catch (e) {
      if (_closed || modelEpoch != _modelEpoch) return;
      enabled = false;
      final message = e is AiFailure ? e.message : '模型無法使用，請使用離線檢索';
      await _releaseModel(modelEpoch);
      if (!_closed && modelEpoch == _modelEpoch) modelStatus = message;
    } finally {
      if (modelEpoch == _modelEpoch) loadingModel = false;
      _notify();
    }
  }

  Future<void> download(String id, bool consent) async {
    if (_closed || downloading) return;
    downloading = true;
    downloadProgress = null;
    modelStatus = '正在檢查可用空間';
    _notify();
    try {
      await models.install(
        id,
        consent: consent,
        progress: (progress, message) {
          downloadProgress = progress;
          modelStatus = message;
          _notify();
        },
      );
      installedModels[id] = true;
      _automaticFailed = false;
    } catch (e) {
      modelStatus = e is AiFailure ? e.message : '下載失敗，請檢查網路後重試';
    } finally {
      downloading = false;
      _notify();
    }
    if (!_closed && installedModels[id] == true && willPrepareAutomatically) {
      unawaited(prepareAutomatically());
    }
  }

  void cancelDownload() {
    if (_closed || !downloading) return;
    models.cancelDownload();
    modelStatus = '正在取消下載';
    _notify();
  }

  Future<void> deleteModel(String id) async {
    if (_closed || downloading || loadingModel) return;
    await setEnabled(false);
    try {
      await models.remove(id);
      installedModels[id] = false;
      modelStatus = '模型已刪除';
    } catch (_) {
      modelStatus = '模型刪除失敗，請重試';
    }
    _notify();
  }

  Future<void> update() async {
    if (_closed || updating) return;
    updating = true;
    _cancelDataUpdate = false;
    dataReceivedBytes = 0;
    dataTotalBytes = null;
    try {
      await stop();
      if (_closed) return;
      if (_cancelDataUpdate) {
        throw const AiFailure(AiFailureKind.cancelled, '更新已取消，保留原有離線資料');
      }
      dataStatus = '下載並驗證公開資料中';
      _notify();
      final next = await knowledge.update(
        onProgress: (received, total, message) {
          if (_closed || _cancelDataUpdate) return;
          dataReceivedBytes = received;
          dataTotalBytes = total;
          dataStatus = message;
          _notify();
        },
      );
      if (_closed) return;
      snapshot = next;
      _history.clear();
      _retrievalContext = '';
      conversationRevision++;
      hits = [];
      answer = '';
      dataStatus = knowledge.status;
      status = '資料更新成功，已開始新對話';
    } catch (e) {
      dataStatus = e is AiFailure ? e.message : '更新失敗，原有資料仍可離線檢索';
    } finally {
      updating = false;
      _notify();
    }
  }

  void cancelUpdate() {
    if (_closed || !updating) return;
    _cancelDataUpdate = true;
    knowledge.cancelUpdate();
    dataStatus = '正在取消公開資料更新';
    _notify();
  }

  Future<void> close() => _closing ??= _close();

  Future<void> _close() async {
    _closed = true;
    ++_epoch;
    ++_modelEpoch;
    models.cancelDownload();
    knowledge.cancelUpdate();
    try {
      try {
        await _stop();
      } finally {
        await _engineAction(engine.dispose);
      }
    } catch (_) {
      // Best-effort shutdown must still clear private conversation state.
    } finally {
      enabled = false;
      loadingModel = false;
      _history.clear();
      _retrievalContext = '';
      hits = [];
      answer = '';
    }
  }

  @override
  void dispose() {
    unawaited(close());
    super.dispose();
  }
}
