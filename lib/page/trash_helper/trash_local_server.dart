// SPDX-License-Identifier: AGPL-3.0-or-later
import 'dart:async';
import 'dart:io';

import 'package:flutter/foundation.dart';
import 'package:flutter/services.dart';
import 'package:town_pass/util/trash_helper.dart';

/// Serves the bundled Trash Helper page from Flutter assets on 127.0.0.1 only, so the
/// service opens without a network connection. Read-only, GET/HEAD, no directory listing.
/// iOS may close the socket while the app is suspended; [ensureRunning] reopens it.
abstract class TrashLocalServer {
  static HttpServer? _server;
  static Future<void>? _starting;

  static const _types = {
    'html': 'text/html; charset=utf-8',
    'js': 'text/javascript; charset=utf-8',
    'css': 'text/css; charset=utf-8',
    'json': 'application/json; charset=utf-8',
    'mjs': 'text/javascript; charset=utf-8',
    'wasm': 'application/wasm',
    'webp': 'image/webp',
    'png': 'image/png',
    'svg': 'image/svg+xml',
  };
  static const _blocked = ['server.py', 'README.md', 'data/source/'];

  /// Starts the server, or restarts it if iOS reclaimed the socket while the app was in
  /// the background (the old HttpServer object can stay non-null but no longer accepts).
  static Future<void> ensureRunning() {
    if (!TrashHelper.isBundled) return Future.value();
    return _starting ??= _check().whenComplete(() => _starting = null);
  }

  static Future<bool> _alive() async {
    try {
      final socket = await Socket.connect(InternetAddress.loopbackIPv4, TrashHelper.bundledPort, timeout: const Duration(milliseconds: 400));
      socket.destroy();
      return true;
    } catch (_) {
      return false;
    }
  }

  static Future<void> _check() async {
    if (_server != null && await _alive()) return;
    final old = _server;
    _server = null;
    if (old != null) {
      debugPrint('TrashLocalServer: socket gone, restarting');
      try {
        await old.close(force: true);
      } catch (_) {}
    }
    await _start();
  }

  static Future<void> _start() async {
    try {
      final server = await HttpServer.bind(InternetAddress.loopbackIPv4, TrashHelper.bundledPort, shared: true);
      _server = server;
      server.listen(_handle, onError: (_) => _drop(server), onDone: () => _drop(server), cancelOnError: true);
    } catch (e) {
      debugPrint('TrashLocalServer: cannot listen on ${TrashHelper.bundledPort}: $e');
    }
  }

  static void _drop(HttpServer s) {
    if (identical(_server, s)) _server = null;
  }

  static Future<void> _handle(HttpRequest req) async {
    final res = req.response;
    try {
      if (req.method != 'GET' && req.method != 'HEAD') {
        res.statusCode = HttpStatus.methodNotAllowed;
        return;
      }
      var path = req.uri.path;
      if (path == '/' || path.isEmpty) path = '/index.html';
      path = path.substring(1);
      if (path.contains('..') || path.contains('\\') || _blocked.any((b) => path == b || path.startsWith(b))) {
        res.statusCode = HttpStatus.notFound;
        return;
      }
      final ByteData data;
      try {
        data = await rootBundle.load('${TrashHelper.assetRoot}$path');
      } catch (_) {
        res.statusCode = HttpStatus.notFound;
        return;
      }
      final ext = path.contains('.') ? path.substring(path.lastIndexOf('.') + 1).toLowerCase() : '';
      res.headers
        ..set(HttpHeaders.contentTypeHeader, _types[ext] ?? 'application/octet-stream')
        ..set(HttpHeaders.cacheControlHeader, 'no-cache')
        ..set('X-Content-Type-Options', 'nosniff');
      if (req.method == 'GET') res.add(data.buffer.asUint8List(data.offsetInBytes, data.lengthInBytes));
    } finally {
      await res.close();
    }
  }
}
