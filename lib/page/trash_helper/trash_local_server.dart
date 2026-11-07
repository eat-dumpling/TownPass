// SPDX-License-Identifier: AGPL-3.0-or-later
import 'dart:async';
import 'dart:io';

import 'package:flutter/foundation.dart';
import 'package:flutter/services.dart';
import 'package:town_pass/util/tp_microservice_config.dart';
import 'package:town_pass/util/trash_helper.dart';

/// Serves a microservice bundled in Flutter assets on 127.0.0.1 only, so it opens without
/// a network connection and loads its models from the phone. Read-only, GET/HEAD, no
/// directory listing. iOS may close the socket while the app is suspended;
/// [ensureRunning] reopens it.
class LocalSiteServer {
  LocalSiteServer({required this.name, required this.port, required this.assetRoot, this.aliases = const {}, this.blocked = const [], this.hashedAssets = false});

  final String name;
  final int port;

  /// Flutter asset folder served at `/`.
  final String assetRoot;

  /// Path prefix → another asset folder (big files shared between two microservices).
  final Map<String, String> aliases;
  final List<String> blocked;

  /// `assets/` holds content-hashed build files (Vite), which can be cached for good.
  final bool hashedAssets;

  HttpServer? _server;
  Future<void>? _starting;

  static const _types = {
    'html': 'text/html; charset=utf-8',
    'js': 'text/javascript; charset=utf-8',
    'mjs': 'text/javascript; charset=utf-8',
    'css': 'text/css; charset=utf-8',
    'json': 'application/json; charset=utf-8',
    'wasm': 'application/wasm',
    'webp': 'image/webp',
    'png': 'image/png',
    'jpg': 'image/jpeg',
    'svg': 'image/svg+xml',
    'woff2': 'font/woff2',
    'woff': 'font/woff',
    'ttf': 'font/ttf',
    'mp3': 'audio/mpeg',
    'onnx': 'application/octet-stream',
    'tflite': 'application/octet-stream',
  };

  /// Starts the server, or restarts it if iOS reclaimed the socket while the app was in
  /// the background (the old HttpServer object can stay non-null but no longer accepts).
  Future<void> ensureRunning() => _starting ??= _check().whenComplete(() => _starting = null);

  Future<bool> _alive() async {
    try {
      final socket = await Socket.connect(InternetAddress.loopbackIPv4, port, timeout: const Duration(milliseconds: 400));
      socket.destroy();
      return true;
    } catch (_) {
      return false;
    }
  }

  Future<void> _check() async {
    if (_server != null && await _alive()) return;
    final old = _server;
    _server = null;
    if (old != null) {
      debugPrint('$name: socket gone, restarting');
      try {
        await old.close(force: true);
      } catch (_) {}
    }
    try {
      final server = await HttpServer.bind(InternetAddress.loopbackIPv4, port, shared: true);
      _server = server;
      server.listen(_handle, onError: (_) => _drop(server), onDone: () => _drop(server), cancelOnError: true);
    } catch (e) {
      debugPrint('$name: cannot listen on $port: $e');
    }
  }

  void _drop(HttpServer s) {
    if (identical(_server, s)) _server = null;
  }

  String _assetFor(String path) {
    for (final e in aliases.entries) {
      if (path.startsWith(e.key)) return e.value + path.substring(e.key.length);
    }
    return assetRoot + path;
  }

  Future<void> _handle(HttpRequest req) async {
    final res = req.response;
    try {
      if (req.method != 'GET' && req.method != 'HEAD') {
        res.statusCode = HttpStatus.methodNotAllowed;
        return;
      }
      var path = req.uri.path;
      if (path == '/' || path.isEmpty) path = '/index.html';
      path = path.substring(1);
      if (path.contains('..') || path.contains('\\') || blocked.any((b) => path == b || path.startsWith(b))) {
        res.statusCode = HttpStatus.notFound;
        return;
      }
      final ByteData data;
      try {
        data = await rootBundle.load(_assetFor(path));
      } catch (_) {
        res.statusCode = HttpStatus.notFound;
        return;
      }
      final ext = path.contains('.') ? path.substring(path.lastIndexOf('.') + 1).toLowerCase() : '';
      res.headers
        ..set(HttpHeaders.contentTypeHeader, _types[ext] ?? 'application/octet-stream')
        // Hashed build files never change; everything else is re-checked (the app update replaces it).
        ..set(HttpHeaders.cacheControlHeader, hashedAssets && path.startsWith('assets/') ? 'public, max-age=31536000, immutable' : 'no-cache')
        ..set('X-Content-Type-Options', 'nosniff');
      if (req.method == 'GET') res.add(data.buffer.asUint8List(data.offsetInBytes, data.lengthInBytes));
    } finally {
      await res.close();
    }
  }
}

/// 丟丟 (Taipei Trash Helper), served on 127.0.0.1:8790 from microservices/trash_helper/.
abstract class TrashLocalServer {
  static final _site = LocalSiteServer(
    name: 'TrashLocalServer',
    port: TrashHelper.bundledPort,
    assetRoot: TrashHelper.assetRoot,
    blocked: const ['server.py', 'README.md', 'data/source/'],
  );

  static Future<void> ensureRunning() => TrashHelper.isBundled ? _site.ensureRunning() : Future.value();
}

/// 回收小里長 (recycle-li), production build served on 127.0.0.1:8791 from microservices/recycle_li/
/// (tools/recycle_li_bundle/build.sh). Its models and wasm are the same files 丟丟 ships, so they
/// are read from 丟丟's vendor/recycle-vision/ instead of being bundled twice.
abstract class RecycleLiLocalServer {
  static const _shared = 'microservices/trash_helper/vendor/recycle-vision/';
  static final _site = LocalSiteServer(
    name: 'RecycleLiLocalServer',
    port: TPMicroserviceConfig.recycleLiBundledPort,
    assetRoot: 'microservices/recycle_li/',
    hashedAssets: true,
    aliases: const {
      'ort/': '${_shared}ort/',
      'mediapipe/': '${_shared}mediapipe/',
      'models/Xenova/siglip-base-patch16-224/': '${_shared}models/Xenova/siglip-base-patch16-224/',
      'models/mediapipe/': '${_shared}models/mediapipe/',
    },
  );

  static Future<void> ensureRunning() => TPMicroserviceConfig.recycleLiBundled ? _site.ensureRunning() : Future.value();
}
