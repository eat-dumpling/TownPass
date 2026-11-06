// SPDX-License-Identifier: AGPL-3.0-or-later
import 'dart:io';

import '../domain/model.dart';
import '../ports/services.dart';
import 'secure_transfer.dart';

class PrivateModelRepository implements ModelRepository {
  final Directory directory;
  final DeviceResources resources;
  final DownloadTransport transport;
  @override
  final List<ModelDescriptor> models;
  CancelToken? _active;
  static const policy = HttpsPolicy({
    'huggingface.co',
    'cas-bridge.xethub.hf.co',
    'cdn-lfs.huggingface.co',
    'cdn-lfs-us-1.hf.co',
    'us.aws.cdn.hf.co',
  });
  PrivateModelRepository({
    required this.directory,
    required this.models,
    required this.resources,
    this.transport = const HttpsTransport(),
  });
  ModelDescriptor _model(String id) => models.firstWhere((m) => m.id == id);
  File _file(ModelDescriptor m) {
    if (!RegExp(r'^[a-z0-9-]+$').hasMatch(m.id)) {
      throw const AiFailure(AiFailureKind.configuration, '模型識別碼錯誤');
    }
    return File('${directory.path}/${m.id}.gguf');
  }

  @override
  Future<InstalledModel?> installed(String id) async {
    final model = _model(id);
    if (!model.approved) return null;
    final file = _file(model);
    final part = File('${file.path}.part');
    if (_active == null && await part.exists()) await part.delete();
    if (!await verifyFile(file, model.sizeBytes, model.sha256!)) return null;
    return InstalledModel(model, file.path);
  }

  @override
  Future<InstalledModel> install(
    String id, {
    required bool consent,
    required void Function(double?, String) progress,
  }) async {
    if (!consent) throw const AiFailure(AiFailureKind.consent, '請先同意模型下載與授權說明');
    final model = _model(id);
    if (!model.approved) throw AiFailure(AiFailureKind.license, model.message);
    if (_active != null) throw const AiFailure(AiFailureKind.busy, '已有模型下載中');
    final cancel = CancelToken();
    _active = cancel;
    final file = _file(model);
    final part = File('${file.path}.part');
    try {
      if (await resources.freeDiskBytes() <
          model.sizeBytes * 2 + 64 * 1024 * 1024) {
        throw const AiFailure(AiFailureKind.space, '可用空間不足，請先清理儲存空間');
      }
      cancel.check();
      await transferFile(
        transport: transport,
        uri: Uri.parse(model.artifactUrl!),
        policy: policy,
        part: part,
        size: model.sizeBytes,
        digest: model.sha256!,
        cancel: cancel,
        progress: progress,
      );
      cancel.check();
      await part.rename(file.path);
      progress(1, '已安裝且校驗通過');
      return InstalledModel(model, file.path);
    } finally {
      try {
        if (await part.exists()) await part.delete();
      } finally {
        _active = null;
      }
    }
  }

  @override
  void cancelDownload() => _active?.cancel();
  @override
  Future<void> remove(String id) async {
    if (_active != null) {
      throw const AiFailure(AiFailureKind.busy, '請先取消並等待下載結束');
    }
    final file = _file(_model(id));
    for (final f in [file, File('${file.path}.part')]) {
      if (await f.exists()) await f.delete();
    }
  }
}
