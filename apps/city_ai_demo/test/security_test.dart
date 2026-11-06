// SPDX-License-Identifier: AGPL-3.0-or-later
import 'dart:async';
import 'dart:convert';
import 'dart:io';

import 'package:crypto/crypto.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:city_ai_core/features/city_ai/data/knowledge_repository.dart';
import 'package:city_ai_core/features/city_ai/data/model_repository.dart';
import 'package:city_ai_core/features/city_ai/data/secure_transfer.dart';
import 'package:city_ai_core/features/city_ai/domain/model.dart';

import 'support.dart';

class PendingManifestTransport implements DownloadTransport {
  final started = Completer<void>();
  @override
  Stream<List<int>> get(
    Uri uri,
    HttpsPolicy policy,
    CancelToken cancel,
  ) async* {
    policy.check(uri);
    final waiting = Completer<void>();
    cancel.abort = () => waiting.completeError(
      const AiFailure(AiFailureKind.cancelled, '更新已取消'),
    );
    started.complete();
    try {
      await waiting.future;
    } finally {
      cancel.abort = null;
    }
  }
}

void main() {
  late Directory dir;
  late FakeTransport network;
  late FakeResources resources;
  const policy = HttpsPolicy({'release.example'});
  final manifestUrl = Uri.parse('https://release.example/manifest.json');
  final dataUrl = Uri.parse('https://release.example/knowledge.json');
  late List<int> payload;
  late Map<String, dynamic> manifest;
  late CachedKnowledgeRepository repo;
  setUp(() async {
    dir = await Directory.systemTemp.createTemp('city_ai_security_');
    network = FakeTransport();
    resources = FakeResources();
    payload = File('assets/knowledge/knowledge_demo.json').readAsBytesSync();
    manifest = {
      'schema_version': 1,
      'dataset_id': 'fictional-demo-fixture',
      'snapshot_version': 'test-1',
      'published_at': '2026-11-06T00:00:00Z',
      'download_url': dataUrl.toString(),
      'sha256': sha256.convert(payload).toString(),
      'size_bytes': payload.length,
    };
    repo = CachedKnowledgeRepository(
      directory: dir,
      seed: () async => utf8.decode(payload),
      resources: resources,
      transport: network,
      manifestUrl: manifestUrl,
      updatePolicy: policy,
    );
    network.responses[dataUrl.toString()] = payload;
  });
  tearDown(() async {
    await dir.delete(recursive: true);
  });
  void publish() {
    network.responses[manifestUrl.toString()] = utf8.encode(
      jsonEncode(manifest),
    );
  }

  test('no requests until explicit update; atomic cache works offline after restart', () async {
    expect((await repo.load()).documents, hasLength(3));
    expect(network.requests, isEmpty);
    publish();
    await repo.update();
    network.responses.clear();
    final restarted = CachedKnowledgeRepository(
      directory: dir,
      resources: resources,
      seed: () async => throw StateError('seed unavailable'),
    );
    expect((await restarted.load()).documents, hasLength(3));
    expect(
      network.requests.every((u) => !u.toString().contains('question')),
      isTrue,
    );
  });
  test('tampered payload never replaces last good snapshot', () async {
    publish();
    await repo.update();
    final before = File('${dir.path}/snapshot.json').readAsStringSync();
    network.responses[dataUrl.toString()] = List.filled(payload.length, 0);
    await expectLater(repo.update(), throwsA(isA<AiFailure>()));
    expect(File('${dir.path}/snapshot.json').readAsStringSync(), before);
    expect((await repo.load()).documents, hasLength(3));
    expect(File('${dir.path}/knowledge.part').existsSync(), isFalse);
  });
  test('bad schema, empty docs, dataset mismatch, oversize and unsafe URL retain seed', () async {
    for (final change in [
      {'schema_version': 2},
      {'size_bytes': maxSnapshotBytes + 1},
      {'download_url': 'http://release.example/x'},
      {'download_url': 'https://evil.example/x'},
      {'dataset_id': 'wrong-id'},
    ]) {
      final original = Map<String, dynamic>.from(manifest);
      manifest.addAll(change);
      publish();
      await expectLater(repo.update(), throwsA(anything));
      expect((await repo.load()).documents, hasLength(3));
      manifest = original;
    }
    final data = jsonDecode(utf8.decode(payload)) as Map<String, dynamic>;
    for (final documents in [
      [],
      [data['documents'][0], data['documents'][0]],
    ]) {
      final bad = utf8.encode(jsonEncode({...data, 'documents': documents}));
      network.responses[dataUrl.toString()] = bad;
      manifest['size_bytes'] = bad.length;
      manifest['sha256'] = sha256.convert(bad).toString();
      publish();
      await expectLater(repo.update(), throwsA(anything));
    }
  });
  test('cancelling a pending manifest aborts transport and retains the last good data', () async {
    publish();
    await repo.update();
    final before = File('${dir.path}/snapshot.json').readAsStringSync();
    final pending = PendingManifestTransport();
    final cancellable = CachedKnowledgeRepository(
      directory: dir,
      seed: () async => utf8.decode(payload),
      resources: resources,
      manifestUrl: manifestUrl,
      updatePolicy: policy,
      transport: pending,
    );
    final updating = cancellable.update();
    final assertion = expectLater(updating, throwsA(isA<AiFailure>()));
    await pending.started.future;
    cancellable.cancelUpdate();
    await assertion;
    expect(cancellable.status, contains('已取消'));
    expect(File('${dir.path}/snapshot.json').readAsStringSync(), before);
    expect((await cancellable.load()).documents, hasLength(3));
  });
  test('cancel during partial transfer or hash verification cleans temporary files and permits retry', () async {
    publish();
    await repo.update();
    final before = File('${dir.path}/snapshot.json').readAsStringSync();
    network.chunkSize = 64;
    for (final cancelAtHash in [false, true]) {
      var cancelled = false;
      await expectLater(
        repo.update(
          onProgress: (received, total, message) {
            if (total != null &&
                !cancelled &&
                (cancelAtHash ? message.contains('校驗') : received > 0)) {
              cancelled = true;
              if (!cancelAtHash) expect(received, lessThan(total));
              repo.cancelUpdate();
            }
          },
        ),
        throwsA(isA<AiFailure>()),
      );
      expect(cancelled, isTrue);
      expect(File('${dir.path}/snapshot.json').readAsStringSync(), before);
      expect(
        dir.listSync().where(
          (file) =>
              file.path.endsWith('.part') || file.path.endsWith('.pending'),
        ),
        isEmpty,
      );
    }
    final progress = <int>[];
    await repo.update(
      onProgress: (received, total, _) {
        if (total != null) progress.add(received);
      },
    );
    expect(progress.first, 0);
    expect(progress.last, payload.length);
  });
  test(
    'wrong dataset or invalid version is rejected before snapshot download',
    () async {
      for (final change in [
        {'dataset_id': 'other-data'},
        {'snapshot_version': ''},
        {'snapshot_version': 'x' * 129},
      ]) {
        final saved = Map<String, dynamic>.from(manifest);
        manifest.addAll(change);
        publish();
        network.requests.clear();
        await expectLater(repo.update(), throwsA(isA<FormatException>()));
        expect(network.requests, [manifestUrl]);
        manifest = saved;
      }
    },
  );
  test('corrupt cache rolls back to verified backup then seed', () async {
    publish();
    await repo.update();
    await repo.update();
    File('${dir.path}/snapshot.json').writeAsStringSync('corrupt');
    expect((await repo.load()).documents, hasLength(3));
    expect(repo.status, contains('復原'));
    File('${dir.path}/snapshot.backup.json').writeAsStringSync('corrupt');
    expect((await repo.load()).documents, hasLength(3));
  });
  test(
    'cancel, truncation, overflow and digest mismatch remove partial files',
    () async {
      final file = File('${dir.path}/model.part');
      final uri = Uri.parse('https://release.example/model');
      final bytes = utf8.encode('verified bytes');
      for (final received in [
        bytes.take(3).toList(),
        [...bytes, 1],
        List.filled(bytes.length, 0),
      ]) {
        network.responses[uri.toString()] = received;
        await expectLater(
          transferFile(
            transport: network,
            uri: uri,
            policy: policy,
            part: file,
            size: bytes.length,
            digest: sha256.convert(bytes).toString(),
            cancel: CancelToken(),
          ),
          throwsA(isA<AiFailure>()),
        );
        expect(file.existsSync(), isFalse);
      }
      network.responses[uri.toString()] = bytes;
      final token = CancelToken();
      await expectLater(
        transferFile(
          transport: network,
          uri: uri,
          policy: policy,
          part: file,
          size: bytes.length,
          digest: sha256.convert(bytes).toString(),
          cancel: token,
          progress: (_, _) => token.cancel(),
        ),
        throwsA(isA<AiFailure>()),
      );
      expect(file.existsSync(), isFalse);
      await transferFile(
        transport: network,
        uri: uri,
        policy: policy,
        part: file,
        size: bytes.length,
        digest: sha256.convert(bytes).toString(),
        cancel: CancelToken(),
      );
      expect(
        await verifyFile(file, bytes.length, sha256.convert(bytes).toString()),
        isTrue,
      );
    },
  );
  test(
    'redirect policy checks every hop and credentials; manifest size bounded',
    () async {
      for (final uri in [
        'http://release.example/x',
        'https://evil.example/x',
        'https://u:p@release.example/',
        'https://release.example:8443/',
      ]) {
        expect(() => policy.check(Uri.parse(uri)), throwsA(isA<AiFailure>()));
      }
      network.responses[manifestUrl.toString()] = List.filled(65537, 1);
      await expectLater(repo.update(), throwsA(isA<AiFailure>()));
    },
  );
  test(
    'resume accepts only the exact next byte and a consistent bounded object',
    () {
      expect(verifiedResumeTotal(206, 'bytes 64-127/128', 64), 128);
      expect(
        () => verifiedResumeTotal(206, 'bytes 64-127/128', 64, maximumEnd: 100),
        throwsA(isA<AiFailure>()),
      );
      for (final header in [
        'bytes 0-127/128',
        'bytes 64-128/128',
        'bytes 64-63/128',
        'bytes 64-127/*',
        'bytes 64-127/9999999999',
      ]) {
        expect(
          () => verifiedResumeTotal(206, header, 64),
          throwsA(isA<AiFailure>()),
        );
      }
      expect(
        () => verifiedResumeTotal(200, 'bytes 64-127/128', 64),
        throwsA(isA<AiFailure>()),
      );
    },
  );
  test('model provenance, consent, disk checks and Gemma gate happen before network', () async {
    final models = PrivateModelRepository(
      directory: dir,
      models: registry(),
      resources: resources,
      transport: network,
    );
    expect(models.models.first.approved, isTrue);
    expect(models.models.last.initialState, ModelState.licenseRequired);
    await expectLater(
      models.install(models.models.last.id, consent: true, progress: (_, _) {}),
      throwsA(isA<AiFailure>()),
    );
    await expectLater(
      models.install(
        models.models.first.id,
        consent: false,
        progress: (_, _) {},
      ),
      throwsA(isA<AiFailure>()),
    );
    resources.space = 1;
    await expectLater(
      models.install(
        models.models.first.id,
        consent: true,
        progress: (_, _) {},
      ),
      throwsA(isA<AiFailure>()),
    );
    expect(network.requests, isEmpty);
    File('${dir.path}/${models.models.first.id}.gguf')
        .writeAsStringSync('tampered');
    expect(await models.installed(models.models.first.id), isNull);
    await models.remove(models.models.first.id);
    expect(dir.listSync(), isEmpty);
  });
}
