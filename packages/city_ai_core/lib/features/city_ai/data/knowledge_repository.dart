// SPDX-License-Identifier: AGPL-3.0-or-later
import 'dart:convert';
import 'dart:io';

import 'package:crypto/crypto.dart';

import '../domain/knowledge.dart';
import '../domain/model.dart';
import '../ports/services.dart';
import 'secure_transfer.dart';

class CachedKnowledgeRepository implements KnowledgeRepository {
  final Directory directory;
  final Future<String> Function() seed;
  final DownloadTransport transport;
  final Uri? manifestUrl;
  final HttpsPolicy updatePolicy;
  final DeviceResources resources;
  bool _updating = false;
  CancelToken? _active;
  @override
  String status = '使用內建離線資料；資料非即時';
  @override
  bool get canUpdate => manifestUrl != null;
  CachedKnowledgeRepository({
    required this.directory,
    required this.seed,
    required this.resources,
    this.transport = const HttpsTransport(),
    this.manifestUrl,
    this.updatePolicy = const HttpsPolicy({}),
  });
  File get _current => File('${directory.path}/snapshot.json');
  File get _backup => File('${directory.path}/snapshot.backup.json');

  Future<KnowledgeSnapshot> _read(File file) async {
    if (await file.length() > maxSnapshotBytes * 2) {
      throw const FormatException('快取過大');
    }
    final envelope =
        jsonDecode(await file.readAsString()) as Map<String, dynamic>;
    final payload = envelope['payload'] as String;
    if (sha256.convert(utf8.encode(payload)).toString() != envelope['sha256']) {
      throw const FormatException('快取損壞');
    }
    return KnowledgeSnapshot.parse(payload);
  }

  @override
  Future<KnowledgeSnapshot> load() async {
    for (final file in [_current, _backup]) {
      try {
        if (await file.exists()) {
          final snapshot = await _read(file);
          status = file.path == _backup.path
              ? '快取復原：使用上一版資料'
              : '使用已下載離線資料；資料非即時';
          return snapshot;
        }
      } catch (_) {
        status = '快取損壞，改用備份或內建資料';
      }
    }
    return KnowledgeSnapshot.parse(await seed());
  }

  @override
  Future<KnowledgeSnapshot> update({
    void Function(int receivedBytes, int? totalBytes, String message)?
    onProgress,
  }) async {
    if (_updating) throw const AiFailure(AiFailureKind.busy, '資料更新進行中');
    final url = manifestUrl;
    if (url == null) {
      throw const AiFailure(
        AiFailureKind.configuration,
        '資料更新服務尚未啟用，目前仍可查詢內建離線資料',
      );
    }
    _updating = true;
    final part = File('${directory.path}/knowledge.part');
    final pending = File('${directory.path}/snapshot.pending');
    final backupPart = File('${directory.path}/backup.pending');
    final cancel = CancelToken();
    _active = cancel;
    try {
      onProgress?.call(0, null, '正在讀取公開資料更新資訊');
      final manifest = jsonDecode(
        await fetchManifest(transport, url, updatePolicy, cancel),
      ) as Map<String, dynamic>;
      final size = manifest['size_bytes'];
      if (manifest['schema_version'] is! int ||
          manifest['schema_version'] != 1 ||
          size is! int ||
          size <= 0 ||
          size > maxSnapshotBytes ||
          manifest['snapshot_version'] is! String ||
          (manifest['snapshot_version'] as String).isEmpty ||
          (manifest['snapshot_version'] as String).length > 128 ||
          sourceDate(manifest['published_at']) == null) {
        throw const FormatException('更新資訊版本或大小錯誤');
      }
      final old = await load();
      if (manifest['dataset_id'] != old.datasetId) {
        throw const FormatException('資料集不符');
      }
      if (await resources.freeDiskBytes() < size * 4 + 16 * 1024 * 1024) {
        throw const AiFailure(AiFailureKind.space, '空間不足，保留原有資料');
      }
      final download = updatePolicy.check(
        Uri.parse(manifest['download_url'] as String),
      );
      cancel.check();
      onProgress?.call(0, size, '正在下載公開資料');
      await transferFile(
        transport: transport,
        uri: download,
        policy: updatePolicy,
        part: part,
        size: size,
        digest: manifest['sha256'] as String,
        cancel: cancel,
        progress: (fraction, _) => onProgress?.call(
          fraction == null ? size : (fraction * size).round(),
          size,
          fraction == null ? '正在校驗公開資料' : '正在下載公開資料',
        ),
      );
      final payload = await part.readAsString();
      final next = KnowledgeSnapshot.parse(payload);
      if (next.datasetId != manifest['dataset_id'] ||
          next.datasetId != old.datasetId ||
          next.isDemo != old.isDemo) {
        throw const FormatException('資料集不符');
      }
      // A single envelope contains payload and digest; no two-file commit window.
      cancel.check();
      await pending.writeAsString(
        jsonEncode({'payload': payload, 'sha256': manifest['sha256']}),
        flush: true,
      );
      if (await _current.exists()) {
        // Validate before replacing the last-known-good backup.
        try {
          await _read(_current);
          await _current.copy(backupPart.path);
          await backupPart.rename(_backup.path);
        } catch (_) {
          /* Existing valid backup is retained. */
        }
      }
      cancel.check();
      await pending.rename(_current.path);
      status = '更新成功：${manifest['snapshot_version']}；$size bytes；非即時資料';
      return next;
    } catch (_) {
      status = cancel.cancelled ? '更新已取消，保留原有離線資料' : '更新失敗，保留原有離線資料';
      rethrow;
    } finally {
      try {
        for (final temporary in [part, pending, backupPart]) {
          if (await temporary.exists()) await temporary.delete();
        }
      } finally {
        _active = null;
        _updating = false;
      }
    }
  }

  @override
  void cancelUpdate() => _active?.cancel();
}
