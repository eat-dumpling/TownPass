import 'dart:collection';
import 'dart:io';


import 'package:flutter/foundation.dart';
import 'package:flutter/gestures.dart';
import 'package:flutter/material.dart';
import 'package:flutter_inappwebview/flutter_inappwebview.dart';
import 'package:get/get.dart';
import 'package:permission_handler/permission_handler.dart';
import 'package:town_pass/gen/assets.gen.dart';
import 'package:town_pass/util/tp_app_bar.dart';
import 'package:town_pass/util/tp_colors.dart';
import 'package:town_pass/page/trash_helper/trash_local_server.dart';
import 'package:town_pass/util/tp_microservice_config.dart';
import 'package:town_pass/util/trash_helper.dart';
import 'package:town_pass/util/web_message_handler/tp_web_message_listener.dart';

class WebViewArgument {
  final String? url;
  final String? forceTitle;

  const WebViewArgument({
    this.url,
    this.forceTitle,
  });
}

/// App 內開網頁使用，可使用 `openUrl` 並以 `url` 為參數帶入開啟網頁： \
/// `forceTitle` 將會強制套用網頁標題為
///
/// ```
/// Get.toNamed(TPRoute.webView, arguments: url);
/// ```
class TPWebView extends StatelessWidget {
  final TPAppBarController? titleController;

  TPWebView({
    super.key,
    this.titleController,
  });

  String get url => (Get.arguments as WebViewArgument?)?.url ?? '';

  String? get forceTitle => (Get.arguments as WebViewArgument?)?.forceTitle;

  final TPAppBarController _defaultTitleController = TPAppBarController();

  TPAppBarController get appBarController => titleController ?? _defaultTitleController;

  final Rxn<InAppWebViewController> webViewController = Rxn<InAppWebViewController>();

  final RxBool canGoBack = RxBool(false);

  /// On iOS, same-document navigations (pushState / hash changes) report the
  /// visited-history update before WKWebView's back list is final, so a single
  /// read can leave a stale back arrow that does nothing. Read again shortly after.
  Future<void> _refreshCanGoBack() async {
    canGoBack.value = await webViewController.value?.canGoBack() ?? false;
    await Future<void>.delayed(const Duration(milliseconds: 300));
    canGoBack.value = await webViewController.value?.canGoBack() ?? false;
  }

  Future<void> _goBack() async {
    final controller = webViewController.value;
    if (controller != null && await controller.canGoBack()) {
      await controller.goBack();
    }
    await _refreshCanGoBack();
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: TPAppBar(
        backgroundColor: TPColors.primary500,
        foregroundColor: TPColors.white,
        leading: Obx(
          () => switch (canGoBack.value) {
            true => IconButton(
                icon: Assets.svg.expand.svg(),
                onPressed: _goBack,
                style: const ButtonStyle(
                  iconSize: WidgetStatePropertyAll<double>(24),
                ),
              ),
            false => const SizedBox.shrink(),
          },
        ),
        actions: [
          CloseButton(
            color: TPColors.white,
            onPressed: () => Get.back(),
            style: const ButtonStyle(
              iconSize: WidgetStatePropertyAll<double>(24),
            ),
          ),
        ],
        title: appBarController.title.value,
        controller: appBarController,
      ),
      body: TPInAppWebView(
        // Without this, Flutter's iOS platform-view gesture arbitration delays taps inside the page.
        preventGestureDelay: true,
        onWebViewCreated: (controller) async {
          webViewController.value = controller;
          // The bundled Trash Helper and recycle-li pages are served by the app; make sure that server is up.
          // 丟丟首頁有「兒童模式」按鈕會切到回收小里長，所以開丟丟時兩個都要先開好。
          if (url.startsWith(TrashHelper.url)) await Future.wait([TrashLocalServer.ensureRunning(), RecycleLiLocalServer.ensureRunning()]);
          if (url.startsWith(recycleLiUrl)) await RecycleLiLocalServer.ensureRunning();
          try {
            controller.loadUrl(urlRequest: URLRequest(url: WebUri(url)));
          } catch (_) {
            controller.loadData(data: _failedToLoadUrlData(url: url));
          }
        },
        onUpdateVisitedHistory: (_, _, _) => _refreshCanGoBack(),
        // 除錯版、Profile 版把網頁的 console 印到 App log（看辨識模型載入失敗的原因）；正式版不印。
        onConsoleMessage: kReleaseMode ? null : (_, message) => debugPrint('[web] ${message.messageLevel} ${message.message}'),
        // iOS 記憶體吃緊時會關掉網頁行程（兩個辨識模型都載入時可能發生），畫面會停住；重新載入就恢復。
        onWebContentProcessDidTerminate: (controller) {
          debugPrint('[web] content process terminated, reloading');
          controller.reload();
        },
        onTitleChanged: (_, title) {
          appBarController.title.value = switch (forceTitle == null) {
            true => title,
            false => forceTitle,
          };
        },
        // iOS 需要 inline 播放，相機畫面才不會被拉成全螢幕。
        // 丟丟會載入 OpenStreetMap 圖磚；OSM 圖磚政策要求 App 標明身分。
        initialSettings: InAppWebViewSettings(
          allowsInlineMediaPlayback: true,
          mediaPlaybackRequiresUserGesture: false,
          applicationNameForUserAgent: url.startsWith(TrashHelper.url) ? 'TownPass-TrashHelper/1.0' : null,
          // 丟丟和兒童模式（回收小里長）互相切換時，先確定對方的本機伺服器開著。
          useShouldOverrideUrlLoading: url.startsWith(TrashHelper.url) || url.startsWith(recycleLiUrl),
        ),
        // iOS 在背景會收回本機伺服器的連線；切到 127.0.0.1:8791（兒童模式）或切回丟丟之前先重開，
        // 不然「兒童模式」按了沒反應。其他網址照常放行。
        shouldOverrideUrlLoading: (controller, action) async {
          final String next = action.request.url?.toString() ?? '';
          if (next.startsWith(recycleLiUrl)) await RecycleLiLocalServer.ensureRunning();
          if (next.startsWith(TrashHelper.url)) await TrashLocalServer.ensureRunning();
          return NavigationActionPolicy.ALLOW;
        },
        // 預設 WebView 會拒絕相機；只對白名單內的微服務開放相機（不含麥克風）。
        onPermissionRequest: (controller, request) async {
          // 白名單微服務（回收小里長等），或 App 內建的丟丟頁面（主框架）。
          final bool allowedSite = TPMicroserviceConfig.canUseCamera(request.origin) || TrashHelper.isTrustedSource(request.origin, true);
          final List<PermissionResourceType> camera =
              request.resources.where((r) => r == PermissionResourceType.CAMERA).toList();
          if (!allowedSite || camera.isEmpty) {
            return PermissionResponse(resources: request.resources, action: PermissionResponseAction.DENY);
          }
          // Android 的 WebView 要 App 本身先拿到相機權限；iOS 由 WKWebView 自己詢問。
          if (Platform.isAndroid && !(await Permission.camera.request()).isGranted) {
            return PermissionResponse(resources: request.resources, action: PermissionResponseAction.DENY);
          }
          return PermissionResponse(resources: camera, action: PermissionResponseAction.GRANT);
        },
        // 實機測試：除錯版只信任區網開發機的自簽憑證（相機要 https 才能用）；其他網站照系統的憑證檢查。
        // 其他主機一定要回 null（= 系統預設檢查）：回 CANCEL 會讓每個 https 請求都被拒絕，
        // 例如丟丟地圖的 OpenStreetMap 圖磚全部失敗，頁面就以為沒有網路。
        onReceivedServerTrustAuthRequest: (controller, challenge) async {
          final String host = challenge.protectionSpace.host;
          return TPMicroserviceConfig.trustDevCertificate(host)
              ? ServerTrustAuthResponse(action: ServerTrustAuthResponseAction.PROCEED)
              : null;
        },
        onGeolocationPermissionsShowPrompt: (controller, origin) async {
          // should be deal individually (ask for user agreement)
          return GeolocationPermissionShowPromptResponse(origin: origin, allow: true, retain: true);
        },
        onCloseWindow: (_) => Get.back(),
      ),
    );
  }
}

class TPInAppWebView extends StatelessWidget {
  final Set<Factory<OneSequenceGestureRecognizer>>? gestureRecognizers;
  final int? windowId;
  final HeadlessInAppWebView? headlessWebView;
  final InAppWebViewKeepAlive? keepAlive;
  final bool? preventGestureDelay;
  final TextDirection? layoutDirection;
  final InAppWebViewInitialData? initialData;
  final String? initialFile;
  final InAppWebViewSettings? initialSettings;
  final URLRequest? initialUrlRequest;
  final UnmodifiableListView<UserScript>? initialUserScripts;
  final PullToRefreshController? pullToRefreshController;
  final FindInteractionController? findInteractionController;
  final ContextMenu? contextMenu;
  final Function(InAppWebViewController, WebUri?)? onPageCommitVisible;
  final Function(InAppWebViewController, String?)? onTitleChanged;
  final Future<AjaxRequestAction> Function(InAppWebViewController, AjaxRequest)? onAjaxProgress;
  final Future<AjaxRequestAction?> Function(InAppWebViewController, AjaxRequest)? onAjaxReadyStateChange;
  final Function(InAppWebViewController, ConsoleMessage)? onConsoleMessage;
  final Future<bool?> Function(InAppWebViewController, CreateWindowAction)? onCreateWindow;
  final Function(InAppWebViewController)? onCloseWindow;
  final Function(InAppWebViewController)? onWindowFocus;
  final Function(InAppWebViewController)? onWindowBlur;
  final Function(InAppWebViewController, DownloadStartRequest)? onDownloadStartRequest;
  final Future<JsAlertResponse?> Function(InAppWebViewController, JsAlertRequest)? onJsAlert;
  final Future<JsConfirmResponse?> Function(InAppWebViewController, JsConfirmRequest)? onJsConfirm;
  final Future<JsPromptResponse?> Function(InAppWebViewController, JsPromptRequest)? onJsPrompt;
  final Function(InAppWebViewController, WebResourceRequest, WebResourceError)? onReceivedError;
  final Function(InAppWebViewController, WebResourceRequest, WebResourceResponse)? onReceivedHttpError;
  final Function(InAppWebViewController, LoadedResource)? onLoadResource;
  final Future<CustomSchemeResponse?> Function(InAppWebViewController, WebResourceRequest)? onLoadResourceWithCustomScheme;
  final Function(InAppWebViewController, WebUri?)? onLoadStart;
  final Function(InAppWebViewController, WebUri?)? onLoadStop;
  final Function(InAppWebViewController, InAppWebViewHitTestResult)? onLongPressHitTestResult;
  final Future<bool?> Function(InAppWebViewController, WebUri?, PlatformPrintJobController?)? onPrintRequest;
  final Function(InAppWebViewController, int)? onProgressChanged;
  final Future<ClientCertResponse?> Function(InAppWebViewController, URLAuthenticationChallenge)? onReceivedClientCertRequest;
  final Future<HttpAuthResponse?> Function(InAppWebViewController, URLAuthenticationChallenge)? onReceivedHttpAuthRequest;
  final Future<ServerTrustAuthResponse?> Function(InAppWebViewController, URLAuthenticationChallenge)? onReceivedServerTrustAuthRequest;
  final Function(InAppWebViewController, int, int)? onScrollChanged;
  final Function(InAppWebViewController, WebUri?, bool?)? onUpdateVisitedHistory;
  final Function(InAppWebViewController)? onWebViewCreated;
  final Future<AjaxRequest?> Function(InAppWebViewController, AjaxRequest)? shouldInterceptAjaxRequest;
  final Future<FetchRequest?> Function(InAppWebViewController, FetchRequest)? shouldInterceptFetchRequest;
  final Future<NavigationActionPolicy?> Function(InAppWebViewController, NavigationAction)? shouldOverrideUrlLoading;
  final Function(InAppWebViewController)? onEnterFullscreen;
  final Function(InAppWebViewController)? onExitFullscreen;
  final Function(InAppWebViewController, int, int, bool, bool)? onOverScrolled;
  final Function(InAppWebViewController, double, double)? onZoomScaleChanged;
  final Function(InAppWebViewController)? onDidReceiveServerRedirectForProvisionalNavigation;
  final Future<FormResubmissionAction?> Function(InAppWebViewController, WebUri?)? onFormResubmission;
  final Function(InAppWebViewController)? onGeolocationPermissionsHidePrompt;
  final Future<GeolocationPermissionShowPromptResponse?> Function(InAppWebViewController, String)? onGeolocationPermissionsShowPrompt;
  final Future<JsBeforeUnloadResponse?> Function(InAppWebViewController, JsBeforeUnloadRequest)? onJsBeforeUnload;
  final Future<NavigationResponseAction?> Function(InAppWebViewController, NavigationResponse)? onNavigationResponse;
  final Future<PermissionResponse?> Function(InAppWebViewController, PermissionRequest)? onPermissionRequest;
  final Function(InAppWebViewController, Uint8List)? onReceivedIcon;
  final Function(InAppWebViewController, LoginRequest)? onReceivedLoginRequest;
  final Function(InAppWebViewController, PermissionRequest)? onPermissionRequestCanceled;
  final Function(InAppWebViewController)? onRequestFocus;
  final Function(InAppWebViewController, WebUri, bool)? onReceivedTouchIconUrl;
  final Function(InAppWebViewController, RenderProcessGoneDetail)? onRenderProcessGone;
  final Future<WebViewRenderProcessAction?> Function(InAppWebViewController, WebUri?)? onRenderProcessResponsive;
  final Future<WebViewRenderProcessAction?> Function(InAppWebViewController, WebUri?)? onRenderProcessUnresponsive;
  final Future<SafeBrowsingResponse?> Function(InAppWebViewController, WebUri, SafeBrowsingThreat?)? onSafeBrowsingHit;
  final Function(InAppWebViewController)? onWebContentProcessDidTerminate;
  final Future<ShouldAllowDeprecatedTLSAction?> Function(InAppWebViewController, URLAuthenticationChallenge)? shouldAllowDeprecatedTLS;
  final Future<WebResourceResponse?> Function(InAppWebViewController, WebResourceRequest)? shouldInterceptRequest;
  final Future<void> Function(InAppWebViewController, MediaCaptureState?, MediaCaptureState?)? onCameraCaptureStateChanged;
  final Future<void> Function(InAppWebViewController, MediaCaptureState?, MediaCaptureState?)? onMicrophoneCaptureStateChanged;

  const TPInAppWebView({
    super.key,
    this.gestureRecognizers,
    this.windowId,
    this.headlessWebView,
    this.keepAlive,
    this.preventGestureDelay,
    this.layoutDirection,
    this.initialData,
    this.initialFile,
    this.initialSettings,
    this.initialUrlRequest,
    this.initialUserScripts,
    this.pullToRefreshController,
    this.findInteractionController,
    this.contextMenu,
    this.onPageCommitVisible,
    this.onTitleChanged,
    this.onAjaxProgress,
    this.onAjaxReadyStateChange,
    this.onConsoleMessage,
    this.onCreateWindow,
    this.onCloseWindow,
    this.onWindowFocus,
    this.onWindowBlur,
    this.onDownloadStartRequest,
    this.onJsAlert,
    this.onJsConfirm,
    this.onJsPrompt,
    this.onReceivedError,
    this.onReceivedHttpError,
    this.onLoadResource,
    this.onLoadResourceWithCustomScheme,
    this.onLoadStart,
    this.onLoadStop,
    this.onLongPressHitTestResult,
    this.onPrintRequest,
    this.onProgressChanged,
    this.onReceivedClientCertRequest,
    this.onReceivedHttpAuthRequest,
    this.onReceivedServerTrustAuthRequest,
    this.onScrollChanged,
    this.onUpdateVisitedHistory,
    this.onWebViewCreated,
    this.shouldInterceptAjaxRequest,
    this.shouldInterceptFetchRequest,
    this.shouldOverrideUrlLoading,
    this.onEnterFullscreen,
    this.onExitFullscreen,
    this.onOverScrolled,
    this.onZoomScaleChanged,
    this.onDidReceiveServerRedirectForProvisionalNavigation,
    this.onFormResubmission,
    this.onGeolocationPermissionsHidePrompt,
    this.onGeolocationPermissionsShowPrompt,
    this.onJsBeforeUnload,
    this.onNavigationResponse,
    this.onPermissionRequest,
    this.onReceivedIcon,
    this.onReceivedLoginRequest,
    this.onPermissionRequestCanceled,
    this.onRequestFocus,
    this.onReceivedTouchIconUrl,
    this.onRenderProcessGone,
    this.onRenderProcessResponsive,
    this.onRenderProcessUnresponsive,
    this.onSafeBrowsingHit,
    this.onWebContentProcessDidTerminate,
    this.shouldAllowDeprecatedTLS,
    this.shouldInterceptRequest,
    this.onCameraCaptureStateChanged,
    this.onMicrophoneCaptureStateChanged,
  });

  @override
  Widget build(BuildContext context) {
    return InAppWebView(
      onWebViewCreated: (controller) async {
        await controller.addWebMessageListener(TPWebMessageListener.webMessageListener());
        onWebViewCreated?.call(controller);
      },
      gestureRecognizers: gestureRecognizers,
      windowId: windowId,
      headlessWebView: headlessWebView,
      keepAlive: keepAlive,
      preventGestureDelay: preventGestureDelay,
      layoutDirection: layoutDirection,
      initialData: initialData,
      initialFile: initialFile,
      initialSettings: initialSettings,
      initialUrlRequest: initialUrlRequest,
      initialUserScripts: initialUserScripts,
      pullToRefreshController: pullToRefreshController,
      findInteractionController: findInteractionController,
      contextMenu: contextMenu,
      onPageCommitVisible: onPageCommitVisible,
      onTitleChanged: onTitleChanged,
      onAjaxProgress: onAjaxProgress,
      onAjaxReadyStateChange: onAjaxReadyStateChange,
      onConsoleMessage: onConsoleMessage,
      onCreateWindow: onCreateWindow,
      onCloseWindow: onCloseWindow,
      onWindowFocus: onWindowFocus,
      onWindowBlur: onWindowBlur,
      onDownloadStartRequest: onDownloadStartRequest,
      onJsAlert: onJsAlert,
      onJsConfirm: onJsConfirm,
      onJsPrompt: onJsPrompt,
      onReceivedError: onReceivedError,
      onReceivedHttpError: onReceivedHttpError,
      onLoadResource: onLoadResource,
      onLoadResourceWithCustomScheme: onLoadResourceWithCustomScheme,
      onLoadStart: onLoadStart,
      onLoadStop: onLoadStop,
      onLongPressHitTestResult: onLongPressHitTestResult,
      onPrintRequest: onPrintRequest,
      onProgressChanged: onProgressChanged,
      onReceivedClientCertRequest: onReceivedClientCertRequest,
      onReceivedHttpAuthRequest: onReceivedHttpAuthRequest,
      onReceivedServerTrustAuthRequest: onReceivedServerTrustAuthRequest,
      onScrollChanged: onScrollChanged,
      onUpdateVisitedHistory: onUpdateVisitedHistory,
      shouldInterceptAjaxRequest: shouldInterceptAjaxRequest,
      shouldInterceptFetchRequest: shouldInterceptFetchRequest,
      shouldOverrideUrlLoading: shouldOverrideUrlLoading,
      onEnterFullscreen: onEnterFullscreen,
      onExitFullscreen: onExitFullscreen,
      onOverScrolled: onOverScrolled,
      onZoomScaleChanged: onZoomScaleChanged,
      onDidReceiveServerRedirectForProvisionalNavigation: onDidReceiveServerRedirectForProvisionalNavigation,
      onFormResubmission: onFormResubmission,
      onGeolocationPermissionsHidePrompt: onGeolocationPermissionsHidePrompt,
      onGeolocationPermissionsShowPrompt: onGeolocationPermissionsShowPrompt,
      onJsBeforeUnload: onJsBeforeUnload,
      onNavigationResponse: onNavigationResponse,
      onPermissionRequest: onPermissionRequest,
      onReceivedIcon: onReceivedIcon,
      onReceivedLoginRequest: onReceivedLoginRequest,
      onPermissionRequestCanceled: onPermissionRequestCanceled,
      onRequestFocus: onRequestFocus,
      onReceivedTouchIconUrl: onReceivedTouchIconUrl,
      onRenderProcessGone: onRenderProcessGone,
      onRenderProcessResponsive: onRenderProcessResponsive,
      onRenderProcessUnresponsive: onRenderProcessUnresponsive,
      onSafeBrowsingHit: onSafeBrowsingHit,
      onWebContentProcessDidTerminate: onWebContentProcessDidTerminate,
      shouldAllowDeprecatedTLS: shouldAllowDeprecatedTLS,
      shouldInterceptRequest: shouldInterceptRequest,
      onCameraCaptureStateChanged: onCameraCaptureStateChanged,
      onMicrophoneCaptureStateChanged: onMicrophoneCaptureStateChanged,
    );
  }
}

String _failedToLoadUrlData({String? url}) {
  return '''
  <!DOCTYPE html>
  <html>
  <head>
    <title>Failed to load URL</title>
  </head>
  <body>

  <h1>Failed to load url:</h1>

  <h3>${switch (url) {
    null => '(null)',
    String() when url.isEmpty => '(empty)',
    _ => url,
  }}</h3>

  </body>
  </html>
  ''';
}
