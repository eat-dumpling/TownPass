// SPDX-License-Identifier: AGPL-3.0-or-later
//
// Voice input for the Trash Helper assistant. Uses the phone's own speech recogniser
// (iOS Speech framework, Android SpeechRecognizer) through speech_to_text. It listens only
// after the user taps the voice button, stops by itself after a short pause, and returns
// the recognised text; nothing is recorded or stored by the app.
import 'dart:async';
import 'dart:io';

import 'package:speech_to_text/speech_to_text.dart';

class TrashSpeech {
  TrashSpeech._();
  static final TrashSpeech instance = TrashSpeech._();

  final SpeechToText _stt = SpeechToText();
  bool _ready = false;
  Completer<Map<String, dynamic>>? _pending;
  String _words = '';
  String? _locale;
  void Function(String words)? _onPartial;

  Future<bool> _init() async {
    if (_ready) return true;
    _ready = await _stt.initialize(onStatus: _onStatus, onError: (e) => _finish(error: e.errorMsg));
    // First run: iOS asks for speech recognition, then the microphone, and the first
    // initialize can report failure before the second prompt is answered. Try once more.
    if (!_ready) {
      await Future.delayed(const Duration(milliseconds: 300));
      _ready = await _stt.initialize(onStatus: _onStatus, onError: (e) => _finish(error: e.errorMsg));
    }
    return _ready;
  }

  void _onStatus(String status) {
    // "done" arrives after the final result; give that result a moment to land first.
    if (status == SpeechToText.doneStatus || status == SpeechToText.notListeningStatus) {
      Future.delayed(const Duration(milliseconds: 400), () => _finish());
    }
  }

  void _finish({String? error}) {
    final c = _pending;
    if (c == null || c.isCompleted) return;
    _pending = null;
    _onPartial = null;
    if (error != null && _words.trim().isEmpty) {
      c.complete({'ok': false, 'error': error.contains('no_match') || error.contains('speech_timeout') ? 'no-speech' : 'error'});
    } else {
      c.complete({'ok': true, 'text': _words.trim(), 'locale': _locale});
    }
  }

  /// Picks the recogniser locale closest to [wanted] (BCP-47, e.g. "zh-TW", "fil-PH").
  Future<String?> _pickLocale(String wanted) async {
    final all = await _stt.locales();
    String norm(String s) => s.replaceAll('_', '-').toLowerCase();
    final w = norm(wanted);
    final lang = w.split('-').first;
    for (final l in all) {
      if (norm(l.localeId) == w) return l.localeId;
    }
    if (lang == 'zh') {
      // Taiwan Mandarin first, then any Traditional/Mandarin variant.
      for (final pref in ['zh-tw', 'zh-hant-tw', 'cmn-hant-tw', 'zh-hk', 'zh-cn']) {
        for (final l in all) {
          if (norm(l.localeId) == pref) return l.localeId;
        }
      }
    }
    for (final l in all) {
      if (norm(l.localeId).split('-').first == lang) return l.localeId;
    }
    // Filipino is not offered by every recogniser; Filipinos in Taiwan commonly use English.
    if (lang == 'fil' || lang == 'tl') {
      for (final l in all) {
        if (norm(l.localeId) == 'en-ph') return l.localeId;
      }
    }
    return null; // the recogniser's default
  }

  /// Listens once and completes with {ok, text} or {ok: false, error}.
  Future<Map<String, dynamic>> listen(String locale, void Function(String words) onPartial) async {
    // The iOS simulator has no usable microphone input and the recogniser crashes reading it;
    // report "unavailable" so the page offers typing instead.
    if (Platform.isIOS && Platform.environment.containsKey('SIMULATOR_DEVICE_NAME')) {
      return {'ok': false, 'error': 'unavailable'};
    }
    if (!await _init()) {
      return {'ok': false, 'error': await _stt.hasPermission ? 'unavailable' : 'denied'};
    }
    if (_stt.isListening) await _stt.cancel();
    _finish();
    _words = '';
    _onPartial = onPartial;
    _locale = await _pickLocale(locale);
    final c = Completer<Map<String, dynamic>>();
    _pending = c;
    await _stt.listen(
      onResult: (r) {
        _words = r.recognizedWords;
        if (r.finalResult) {
          _finish();
        } else {
          _onPartial?.call(_words);
        }
      },
      listenOptions: SpeechListenOptions(
        localeId: _locale,
        listenFor: const Duration(seconds: 20),
        pauseFor: const Duration(seconds: 3),
        partialResults: true,
        listenMode: ListenMode.search,
        cancelOnError: true,
      ),
    );
    return c.future.timeout(const Duration(seconds: 26), onTimeout: () {
      _stt.stop();
      return {'ok': true, 'text': _words.trim(), 'locale': _locale};
    });
  }

  /// Stops listening; the pending [listen] completes with what was heard so far.
  Future<void> stop() async {
    await _stt.stop();
    Future.delayed(const Duration(milliseconds: 600), () => _finish());
  }

  Future<void> cancel() async {
    await _stt.cancel();
    _words = '';
    _finish();
  }
}
