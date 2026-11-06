// SPDX-License-Identifier: AGPL-3.0-or-later
import 'dart:async';
import 'dart:convert';
import 'dart:io';
import 'dart:isolate';
import 'dart:typed_data';

import 'package:crypto/crypto.dart';

import '../domain/model.dart';

const maxSnapshotBytes = 10 * 1024 * 1024;

class CancelToken {
  bool cancelled = false;
  void Function()? abort;
  void cancel() {
    cancelled = true;
    abort?.call();
  }

  void check() {
    if (cancelled) throw const AiFailure(AiFailureKind.cancelled, '下載已取消');
  }
}

class HttpsPolicy {
  final Set<String> hosts;
  const HttpsPolicy(this.hosts);
  Uri check(Uri uri) {
    if (uri.scheme != 'https' ||
        !hosts.contains(uri.host) ||
        uri.userInfo.isNotEmpty ||
        (uri.hasPort && uri.port != 443)) {
      throw const AiFailure(AiFailureKind.configuration, '下載來源不在允許清單');
    }
    return uri;
  }
}

abstract interface class DownloadTransport {
  Stream<List<int>> get(Uri uri, HttpsPolicy policy, CancelToken cancel);
}

// This network boundary supports GET only. No question, history, identity,
// arbitrary headers, cookies or remote inference APIs are accepted.
class HttpsTransport implements DownloadTransport {
  const HttpsTransport();
  @override
  Stream<List<int>> get(
    Uri uri,
    HttpsPolicy policy,
    CancelToken cancel,
  ) async* {
    final client = HttpClient()
      ..connectionTimeout = const Duration(seconds: 20)
      ..autoUncompress = false;
    cancel.abort = () => client.close(force: true);
    final deadline = Timer(
      const Duration(minutes: 15),
      () => client.close(force: true),
    );
    var received = 0;
    var failures = 0;
    const chunkBytes = 32 * 1024 * 1024;
    int? expectedTotal;
    String? etag;
    try {
      while (true) {
        try {
          var current = policy.check(uri);
          for (var hop = 0; hop <= 4; hop++) {
            cancel.check();
            final request = await client
                .getUrl(current)
                .timeout(const Duration(seconds: 20));
            request.followRedirects = false;
            request.headers.set(HttpHeaders.acceptEncodingHeader, 'identity');
            final chunkEnd = expectedTotal == null
                ? received + chunkBytes - 1
                : (received + chunkBytes).clamp(0, expectedTotal) - 1;
            request.headers.set(
              HttpHeaders.rangeHeader,
              'bytes=$received-$chunkEnd',
            );
            if (etag != null) {
              request.headers.set(HttpHeaders.ifRangeHeader, etag);
            }
            final response = await request.close().timeout(
              const Duration(seconds: 30),
            );
            if ({301, 302, 303, 307, 308}.contains(response.statusCode)) {
              final location = response.headers.value(
                HttpHeaders.locationHeader,
              );
              if (location == null || hop == 4) {
                throw const AiFailure(AiFailureKind.network, '重新導向次數超過限制');
              }
              current = policy.check(current.resolve(location));
              await response.drain<void>().timeout(const Duration(seconds: 10));
              continue;
            }
            if (received > 0 || response.statusCode == 206) {
              final total = verifiedResumeTotal(
                response.statusCode,
                response.headers.value(HttpHeaders.contentRangeHeader),
                received,
                maximumEnd: chunkEnd,
              );
              if (expectedTotal != null && expectedTotal != total) {
                throw const AiFailure(AiFailureKind.integrity, '續傳檔案版本不符');
              }
              expectedTotal = total;
            } else {
              if (response.statusCode != 200) {
                throw const AiFailure(AiFailureKind.network, '下載失敗，請稍後重試');
              }
              if (response.contentLength >= 0) {
                expectedTotal = response.contentLength;
              }
            }
            final value = response.headers.value(HttpHeaders.etagHeader);
            if (etag == null && value != null && !value.startsWith('W/')) {
              etag = value;
            }
            final before = received;
            await for (final bytes in response.timeout(
              const Duration(seconds: 30),
            )) {
              cancel.check();
              received += bytes.length;
              yield bytes;
            }
            if (expectedTotal == null || received >= expectedTotal) return;
            if (received == before) {
              throw const AiFailure(AiFailureKind.network, '下載未收到資料');
            }
            break; // Request the next bounded chunk from the original approved URL.
          }
        } on AiFailure {
          rethrow;
        } catch (error) {
          cancel.check();
          if (expectedTotal != null && received == expectedTotal) return;
          final retryable = error is IOException || error is TimeoutException;
          if (!retryable || ++failures >= 12) rethrow;
          await Future<void>.delayed(Duration(milliseconds: 250 * failures));
        }
      }
    } catch (_) {
      cancel.check();
      rethrow;
    } finally {
      deadline.cancel();
      cancel.abort = null;
      client.close(force: true);
    }
  }
}

// Resume is accepted only for the exact next byte in the same bounded object.
// The caller still verifies the full expected length and SHA-256 before install.
int verifiedResumeTotal(
  int status,
  String? contentRange,
  int offset, {
  int? maximumEnd,
}) {
  final match = RegExp(r'^bytes (\d+)-(\d+)/(\d+)$')
      .firstMatch(contentRange ?? '');
  if (status != 206 || match == null) {
    throw const AiFailure(AiFailureKind.network, '伺服器不支援安全續傳，請重新下載');
  }
  final start = int.parse(match[1]!);
  final end = int.parse(match[2]!);
  final total = int.parse(match[3]!);
  if (start != offset ||
      end < start ||
      end >= total ||
      (maximumEnd != null && end > maximumEnd) ||
      total > 2 * 1024 * 1024 * 1024) {
    throw const AiFailure(AiFailureKind.integrity, '續傳範圍或大小不符');
  }
  return total;
}

Future<bool> verifyFile(File file, int size, String digest) async {
  final path = file.path;
  return Isolate.run(() async {
    final candidate = File(path);
    if (!await candidate.exists() || await candidate.length() != size) {
      return false;
    }
    return (await sha256.bind(candidate.openRead()).first).toString() == digest;
  });
}

Future<void> transferFile({
  required DownloadTransport transport,
  required Uri uri,
  required HttpsPolicy policy,
  required File part,
  required int size,
  required String digest,
  required CancelToken cancel,
  void Function(double?, String)? progress,
}) async {
  if (size <= 0 ||
      size > 2 * 1024 * 1024 * 1024 ||
      !RegExp(r'^[a-f0-9]{64}$').hasMatch(digest)) {
    throw const AiFailure(AiFailureKind.integrity, '檔案資訊不完整');
  }
  policy.check(uri);
  await part.parent.create(recursive: true);
  final sink = part.openWrite();
  var count = 0;
  try {
    await for (final bytes in transport.get(uri, policy, cancel)) {
      cancel.check();
      count += bytes.length;
      if (count > size) {
        throw const AiFailure(AiFailureKind.integrity, '下載檔案超過宣告大小');
      }
      sink.add(bytes);
      // Backpressure keeps model transfers bounded in memory.
      await sink.flush();
      progress?.call(count / size, '下載中');
    }
    await sink.close();
    cancel.check();
    progress?.call(null, '校驗中');
    if (!await verifyFile(part, size, digest)) {
      throw const AiFailure(AiFailureKind.integrity, 'SHA-256 或檔案大小不符');
    }
    cancel.check();
  } catch (_) {
    try {
      await sink.close();
    } catch (_) {
      /* Keep original failure. */
    }
    if (await part.exists()) await part.delete();
    rethrow;
  }
}

Future<String> fetchManifest(
  DownloadTransport transport,
  Uri uri,
  HttpsPolicy policy,
  CancelToken cancel,
) async {
  policy.check(uri);
  final buffer = BytesBuilder(copy: false);
  await for (final chunk in transport.get(uri, policy, cancel)) {
    if (buffer.length + chunk.length > 64 * 1024) {
      throw const AiFailure(AiFailureKind.integrity, '更新資訊過大');
    }
    buffer.add(chunk);
  }
  return utf8.decode(buffer.takeBytes());
}
