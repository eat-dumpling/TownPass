// SPDX-License-Identifier: AGPL-3.0-or-later
import 'dart:async';

import 'package:city_ai_core/city_ai_core.dart';
import 'package:flutter/widgets.dart';

/// App-scoped foreground model; chat history remains scoped to the open page.
class CityAiSession with WidgetsBindingObserver {
  final Future<CityAiController> Function() factory;
  final Duration idleDuration;
  Future<CityAiController>? _creating;
  Future<void>? _suspending;
  Future<void>? _closing;
  Timer? _idle;
  final _disposedControllers = Expando<bool>();
  bool _attached = false, _foreground = true, _closed = false;
  CityAiSession({
    required this.factory,
    this.idleDuration = const Duration(seconds: 90),
  }) {
    WidgetsBinding.instance.addObserver(this);
  }

  Future<CityAiController> _get() => _creating ??= factory();

  Future<void> warmUp() async {
    try {
      await _suspending;
      if (_closed || !_foreground) return;
      final c = await _get();
      if (_closed || !_foreground) return;
      await c.prepareAutomatically();
      _scheduleIdle();
    } catch (_) {
      // A failed optional warmup must not prevent the original home from opening.
      // Let a subsequent page entry retry controller creation.
      _creating = null;
    }
  }

  Future<CityAiController> acquire() async {
    if (_closed) throw StateError('AI session closed');
    _attached = true;
    _idle?.cancel();
    await _suspending;
    final c = await _get();
    if (_closed) throw StateError('AI session closed');
    if (_foreground) unawaited(c.prepareAutomatically());
    return c;
  }

  Future<void> release(CityAiController c) async {
    _attached = false;
    try {
      await c.clearConversation();
      c.cancelUpdate();
      c.cancelDownload();
    } catch (_) {
      // A broken native cancel cannot leave private history in a reusable pool.
      _creating = null;
      await _disposeController(c);
    }
    _scheduleIdle();
  }

  Future<void> _disposeController(CityAiController c) async {
    await c.close();
    if (_disposedControllers[c] != true) {
      _disposedControllers[c] = true;
      c.dispose();
    }
  }

  void _scheduleIdle() {
    _idle?.cancel();
    if (_closed || !_foreground || _attached) return;
    _idle = Timer(idleDuration, () => unawaited(_suspend()));
  }

  Future<void> _suspend() async {
    final previous = _suspending;
    if (previous != null) return previous;
    final pending = _creating;
    if (pending == null) return;
    final done = Completer<void>();
    _suspending = done.future;
    try {
      final c = await pending;
      c.cancelUpdate();
      c.cancelDownload();
      await c.setEnabled(false);
    } catch (_) {
      // Controller reports native cleanup errors without private payload logs.
    } finally {
      done.complete();
      if (identical(_suspending, done.future)) _suspending = null;
    }
  }

  @override
  void didHaveMemoryPressure() {
    _idle?.cancel();
    unawaited(_suspend());
  }

  @override
  void didChangeAppLifecycleState(AppLifecycleState state) {
    if (state == AppLifecycleState.paused ||
        state == AppLifecycleState.detached) {
      _foreground = false;
      _idle?.cancel();
      unawaited(_suspend());
    } else if (state == AppLifecycleState.resumed) {
      _foreground = true;
      unawaited(_resume());
    }
  }

  Future<void> _resume() async {
    await _suspending;
    if (_closed || !_foreground || _creating == null) return;
    final c = await _creating!;
    if (_closed || !_foreground) return;
    await c.resumeAutomatically();
    _scheduleIdle();
  }

  Future<void> close() => _closing ??= _close();

  Future<void> _close() async {
    _closed = true;
    _idle?.cancel();
    WidgetsBinding.instance.removeObserver(this);
    final pending = _creating;
    if (pending != null) {
      try {
        await _disposeController(await pending);
      } catch (_) {
        // Controller creation may have failed before any native engine existed.
      }
    }
  }
}
