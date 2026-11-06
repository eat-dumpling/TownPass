// SPDX-License-Identifier: AGPL-3.0-or-later
import 'dart:async';
import 'dart:convert';

import 'package:city_ai_core/city_ai_core.dart';
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_inappwebview/flutter_inappwebview.dart';
import 'package:url_launcher/url_launcher.dart';
import 'package:town_pass/util/tp_colors.dart';

import 'city_ai_gateway.dart';
import 'city_ai_runtime.dart';

class CityAiMicroservicePage extends StatefulWidget {
  const CityAiMicroservicePage({super.key});
  @override
  State<CityAiMicroservicePage> createState() => _CityAiMicroservicePageState();
}

class _CityAiMicroservicePageState extends State<CityAiMicroservicePage>
    with WidgetsBindingObserver {
  CityAiGateway? _gateway;
  InAppWebViewController? _web;
  final _html = rootBundle.loadString(
    'assets/microservices/city_ai/index.html',
  );
  late final Future<CityAiController> _controller;
  bool _disposed = false;
  bool _initialDocumentLoading = true;
  double _textScale = 1;
  @override
  void didChangeDependencies() {
    super.didChangeDependencies();
    final scale = MediaQuery.textScalerOf(context).scale(16) / 16;
    if (_textScale == scale) return;
    _textScale = scale;
    WidgetsBinding.instance.addPostFrameCallback((_) {
      if (!_disposed && _gateway != null) _send(_gateway!.state());
    });
  }

  @override
  void initState() {
    super.initState();
    PlatformInAppWebViewController.debugLoggingSettings.enabled = false;
    WidgetsBinding.instance.addObserver(this);
    final session = CityAiRuntime.session;
    final release = session?.release ?? CityAiRuntime.disposeController;
    _controller = (session?.acquire() ?? CityAiRuntime.create()).then((c) {
      if (_disposed) {
        unawaited(release(c));
        return c;
      }
      _gateway = CityAiGateway(
        controller: c,
        emit: _send,
        confirmDownload: _consent,
        openOfficialSource: (uri) async {
          await launchUrl(uri, mode: LaunchMode.externalApplication);
        },
        releaseController: release,
      );
      return c;
    });
  }

  void _send(Map<String, dynamic> value) {
    unawaited(_deliver(value));
  }

  Future<void> _deliver(Map<String, dynamic> value) async {
    final web = _web;
    if (_disposed || web == null) return;
    try {
      await web.evaluateJavascript(
        source:
            'window.CityAi.receive(${jsonEncode({...value, 'text_scale': _textScale})});',
      );
    } catch (_) {
      // The platform view may close while a pending delivery is in flight.
      // Never log its payload, which can contain the local conversation.
    }
  }

  Future<bool> _consent(ModelDescriptor model) async =>
      await showDialog<bool>(
        context: context,
        builder: (context) => AlertDialog(
          title: const Text('下載本機對話模型'),
          content: SingleChildScrollView(
            child: Text(
              '${model.name}\n開發者：${model.developer}\n發布者：${model.publisher}\n授權：${model.license}\n下載 ${(model.sizeBytes / 1048576).toStringAsFixed(1)} MiB，會占用儲存、記憶體及電量。下載後以 SHA-256 校驗，問題不會上傳。\n${model.message}',
            ),
          ),
          actions: [
            TextButton(
              onPressed: () => Navigator.pop(context, false),
              child: const Text('取消'),
            ),
            FilledButton(
              onPressed: () => Navigator.pop(context, true),
              child: const Text('同意並下載'),
            ),
          ],
        ),
      ) ??
      false;
  @override
  void didHaveMemoryPressure() {
    if (CityAiRuntime.session != null) return;
    unawaited(_gateway?.controller.setEnabled(false));
  }

  @override
  void didChangeAppLifecycleState(AppLifecycleState state) {
    if (CityAiRuntime.session != null) return;
    if (state == AppLifecycleState.paused ||
        state == AppLifecycleState.detached) {
      unawaited(_gateway?.controller.setEnabled(false));
      _gateway?.controller.cancelUpdate();
    }
  }

  @override
  void dispose() {
    _disposed = true;
    WidgetsBinding.instance.removeObserver(this);
    unawaited(_gateway?.close());
    _web = null;
    super.dispose();
  }

  @override
  Widget build(BuildContext context) => Scaffold(
    appBar: AppBar(
      title: const Text('城市小幫手'),
      leading: IconButton(
        tooltip: '返回城市通',
        icon: const Icon(Icons.arrow_back_ios_new, size: 24),
        onPressed: () => Navigator.of(context).maybePop(),
      ),
      backgroundColor: TPColors.primary500,
      foregroundColor: TPColors.grayscale950,
    ),
    body: SafeArea(
      child: FutureBuilder<List<dynamic>>(
        future: Future.wait([_html, _controller]),
        builder: (context, snapshot) {
          if (snapshot.hasError) {
            return const Center(child: Text('微服務初始化失敗，請返回後重試。'));
          }
          if (!snapshot.hasData) {
            return const Center(
              child: CircularProgressIndicator(semanticsLabel: '正在載入離線微服務'),
            );
          }
          return InAppWebView(
            key: const Key('city-ai-microservice'),
            initialSettings: InAppWebViewSettings(
              javaScriptEnabled: true,
              useShouldOverrideUrlLoading: true,
              allowFileAccess: false,
              allowContentAccess: false,
              javaScriptCanOpenWindowsAutomatically: false,
              supportMultipleWindows: false,
              mediaPlaybackRequiresUserGesture: true,
              isInspectable: false,
            ),
            onWebViewCreated: (web) async {
              if (_disposed) return;
              _web = web;
              await web.addWebMessageListener(
                WebMessageListener(
                  jsObjectName: 'flutterObject',
                  allowedOriginRules: {cityAiOrigin},
                  onPostMessage: (message, origin, isMainFrame, reply) async {
                    if (message?.data is String) {
                      await _gateway?.receive(
                        message!.data as String,
                        origin: origin == null
                            ? null
                            : Uri.tryParse(origin.toString()),
                        isMainFrame: isMainFrame,
                      );
                    }
                  },
                ),
              );
              if (_disposed) return;
              await web.loadData(
                data: snapshot.data![0] as String,
                baseUrl: WebUri('$cityAiOrigin/'),
              );
            },
            onLoadStop: (_, url) {
              if (_disposed) return;
              if (url?.toString() != '$cityAiOrigin/') return;
              _initialDocumentLoading = false;
              _send(_gateway!.state());
              if (_web != null) CityAiRuntime.onMicroserviceReady?.call(_web!);
            },
            shouldOverrideUrlLoading: (_, action) async {
              final url = action.request.url?.toString();
              if (_initialDocumentLoading &&
                  (url == 'about:blank' || url == '$cityAiOrigin/')) {
                return NavigationActionPolicy.ALLOW;
              }
              return NavigationActionPolicy.CANCEL;
            },
            onPermissionRequest: (_, request) async => PermissionResponse(
              resources: request.resources,
              action: PermissionResponseAction.DENY,
            ),
            onCreateWindow: (_, _) async => false,
          );
        },
      ),
    ),
  );
}
