// SPDX-License-Identifier: AGPL-3.0-or-later
import 'dart:async';
import 'dart:convert';

import 'package:city_ai_core/city_ai_core.dart';

const cityAiOrigin = 'https://city-ai.townpass.local';

class CityAiGateway {
  final CityAiController controller;
  final void Function(Map<String, dynamic>) emit;
  final Future<bool> Function(ModelDescriptor) confirmDownload;
  final Future<void> Function(Uri) openOfficialSource;
  final Future<void> Function(CityAiController)? releaseController;
  String? _requestId;
  String? _searchingRequestId;
  bool _closed = false;
  bool _confirmingDownload = false;
  CityAiGateway({
    required this.controller,
    required this.emit,
    required this.confirmDownload,
    required this.openOfficialSource,
    this.releaseController,
  }) {
    controller.addListener(_changed);
  }
  void _changed() {
    if (!_closed) emit(state());
  }

  Map<String, dynamic> state() => {
    'type': 'state',
    'request_id': _requestId,
    'reply_ready':
        _searchingRequestId != _requestId &&
        !controller.generating &&
        !controller.waitingForModel,
    'conversation_revision': controller.conversationRevision,
    'status': controller.status,
    'answer': controller.answer,
    'answer_mode': controller.answerMode,
    'active_model_id': controller.activeModelId,
    'generating': controller.generating,
    'enabled': controller.enabled,
    'supports_generation': controller.supportsGeneration,
    'loading_model': controller.loadingModel,
    'automatic_generation': controller.automaticGeneration,
    'automatic_paused': controller.automaticPaused,
    'waiting_for_model': controller.waitingForModel,
    'downloading': controller.downloading,
    'download_progress': controller.downloadProgress,
    'model_status': controller.modelStatus,
    'received_characters': controller.receivedCharacters,
    'count': controller.snapshot?.documents.length ?? 0,
    'updated_at': controller.snapshot?.updatedAt?.toIso8601String(),
    'can_update': controller.knowledge.canUpdate,
    'updating': controller.updating,
    'data_status': controller.dataStatus,
    'data_received_bytes': controller.dataReceivedBytes,
    'data_total_bytes': controller.dataTotalBytes,
    'dataset_id': controller.snapshot?.datasetId,
    'built_at': controller.snapshot?.builtAt.toIso8601String(),
    'source_url': controller.snapshot?.sourceUrl.toString(),
    'sources': [
      for (var i = 0; i < controller.hits.length; i++)
        {
          'index': i + 1,
          'id': controller.hits[i].document.id,
          'title': controller.hits[i].document.title,
          'excerpt': controller.hits[i].snippet,
          'phone': controller.hits[i].document.phone,
          'address': controller.hits[i].document.address,
          'district': controller.hits[i].document.district,
          'url': controller.hits[i].document.sourceUrl.toString(),
          'updated_at': controller.hits[i].document.updatedAt
              ?.toIso8601String(),
          'is_demo': controller.hits[i].document.isDemo,
        },
    ],
    'models': [
      for (final m in controller.models.models)
        {
          'id': m.id,
          'name': m.name,
          'developer': m.developer,
          'publisher': m.publisher,
          'license': m.license,
          'license_status': m.licenseStatus,
          'revision': m.revision,
          'sha256': m.sha256,
          'size_bytes': m.sizeBytes,
          'approved': m.approved,
          'message': m.message,
          'installed': controller.installedModels[m.id] == true,
          'checked': controller.installedModels.containsKey(m.id),
        },
    ],
  };

  Future<void> receive(
    String raw, {
    required Uri? origin,
    required bool isMainFrame,
  }) async {
    if (_closed ||
        !isMainFrame ||
        origin == null ||
        origin.origin != cityAiOrigin ||
        raw.length > 3000) {
      return;
    }
    String? action;
    String? requestId;
    try {
      final j = jsonDecode(raw) as Map<String, dynamic>;
      final name = j['name'];
      final data = j['data'];
      action = name is String && name.length <= 40 ? name : null;
      if (data is Map &&
          data['request_id'] is String &&
          RegExp(r'^[a-zA-Z0-9-]{1,64}$').hasMatch(data['request_id'])) {
        requestId = data['request_id'];
      }
      switch (name) {
        case 'city_ai_state':
          _changed();
        case 'llm_ask':
          if (data is! Map ||
              data['question'] is! String ||
              data['request_id'] is! String) {
            throw const FormatException();
          }
          final question = (data['question'] as String).trim();
          final id = data['request_id'] as String;
          if (question.isEmpty ||
              question.length > 500 ||
              !RegExp(r'^[a-zA-Z0-9-]{1,64}$').hasMatch(id)) {
            throw const FormatException();
          }
          if (_searchingRequestId != null ||
              controller.generating ||
              controller.waitingForModel) {
            throw const AiFailure(AiFailureKind.busy, '請先停止或等待目前回答完成');
          }
          _requestId = id;
          _searchingRequestId = id;
          var accepted = false;
          try {
            await controller.search(question);
            accepted = true;
          } finally {
            if (_searchingRequestId == id) _searchingRequestId = null;
            if (accepted) _changed();
          }
        case 'llm_cancel':
          _searchingRequestId = null;
          await controller.stop();
        case 'conversation_clear':
          _searchingRequestId = null;
          _requestId = null;
          await controller.clearConversation();
        case 'model_enable':
          if (data is! bool) throw const FormatException();
          await controller.setConversationEnabled(data);
        case 'model_install':
          if (!controller.supportsGeneration ||
              data is! String ||
              controller.downloading ||
              _confirmingDownload) {
            return;
          }
          final model = controller.models.models
              .where((m) => m.id == data && m.approved)
              .firstOrNull;
          if (model == null) throw const FormatException();
          _confirmingDownload = true;
          try {
            if (await confirmDownload(model) && !_closed) {
              await controller.download(model.id, true);
            }
          } finally {
            _confirmingDownload = false;
          }
        case 'model_cancel':
          controller.cancelDownload();
        case 'model_delete':
          if (data is! String ||
              !controller.models.models.any((m) => m.id == data)) {
            throw const FormatException();
          }
          await controller.deleteModel(data);
        case 'data_update':
          await controller.update();
        case 'data_cancel':
          controller.cancelUpdate();
        case 'source_open':
          if (data is! String || data.length > 128) {
            throw const FormatException();
          }
          final doc = controller.snapshot?.documents
              .where((d) => d.id == data)
              .firstOrNull;
          if (doc != null) {
            await openOfficialSource(officialUrl(doc.sourceUrl.toString()));
          }
        default:
          throw const FormatException();
      }
    } catch (error) {
      if (!_closed) {
        emit({
          'type': 'error',
          'action': action,
          'request_id': requestId,
          'message': error is AiFailure ? error.message : '無法處理這項操作，請重試',
        });
      }
    }
  }

  Future<void> close() async {
    if (_closed) return;
    _closed = true;
    controller.removeListener(_changed);
    if (releaseController != null) {
      await releaseController!(controller);
    } else {
      await controller.close();
      controller.dispose();
    }
  }
}
