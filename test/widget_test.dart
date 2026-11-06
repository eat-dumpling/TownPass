import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:get/get.dart';
import 'package:flutter_inappwebview/flutter_inappwebview.dart';
import 'package:shared_preferences/shared_preferences.dart';
import 'package:town_pass/main.dart';
import 'package:town_pass/service/shared_preferences_service.dart';
import 'package:town_pass/service/subscription_service.dart';
import 'package:town_pass/page/city_service/model/my_service_model.dart';
import 'package:town_pass/util/tp_route.dart';

class TestWebViewPlatform extends InAppWebViewPlatform {
  @override
  PlatformInAppWebViewWidget createPlatformInAppWebViewWidget(
    PlatformInAppWebViewWidgetCreationParams params,
  ) => TestWebView(params);
}

class TestWebView extends PlatformInAppWebViewWidget {
  TestWebView(super.params) : super.implementation();
  @override
  Widget build(BuildContext context) => const SizedBox.shrink();
  @override
  T controllerFromPlatform<T>(PlatformInAppWebViewController controller) =>
      throw UnimplementedError();
  @override
  void dispose() {}
}

void main() {
  setUp(() async {
    InAppWebViewPlatform.instance = TestWebViewPlatform();
    Get.testMode = true;
    SharedPreferences.setMockInitialValues({});
    await Get.putAsync<SharedPreferencesService>(
      () => SharedPreferencesService().init(),
    );
    Get.put(SubscriptionService());
  });
  tearDown(() async {
    Get.reset();
  });
  testWidgets(
    'original TownPass home and navigation retain microservice entry',
    (tester) async {
      await tester.pumpWidget(
        const MyApp(requestNotificationPermission: false),
      );
      // Existing banner controllers defer their fixture loads by 2-3 seconds.
      await tester.pump(const Duration(seconds: 4));
      expect(find.text('首頁'), findsWidgets);
      expect(find.text('服務'), findsWidgets);
      expect(find.text('優惠'), findsWidgets);
      expect(find.text('帳務'), findsWidgets);
      expect(
        find.byKey(const Key('open-city-ai-microservice')),
        findsOneWidget,
      );
      expect(TPRoute.page.any((p) => p.name == TPRoute.cityAi), isTrue);
      expect(MyServiceItemId.localAi.item.destinationUrl, 'townpass://city-ai');
      await tester.pumpWidget(const SizedBox.shrink());
    },
  );
}
