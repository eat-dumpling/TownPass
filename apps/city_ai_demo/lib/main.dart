// SPDX-License-Identifier: AGPL-3.0-or-later
import 'package:flutter/material.dart';
import 'package:flutter_localizations/flutter_localizations.dart';
import 'package:city_ai_core/city_ai_core.dart';
import 'package:town_pass/main.dart' as townpass;
import 'package:town_pass/features/city_ai/city_ai_runtime.dart';
import 'package:town_pass/features/city_ai/city_ai_session.dart';

import 'features/city_ai/inference/llamadart_inference_engine.dart';

Future<void> main() async {
  WidgetsFlutterBinding.ensureInitialized();
  CityAiRuntime.create = () =>
      createController(automaticGeneration: true, checkModels: false);
  await CityAiRuntime.session?.close();
  final session = CityAiSession(factory: () => CityAiRuntime.create());
  CityAiRuntime.session = session;
  await townpass.initServices();
  runApp(const townpass.MyApp(requestNotificationPermission: false));
  WidgetsBinding.instance.addPostFrameCallback((_) {
    session.warmUp();
  });
}

Future<CityAiController> createController({
  DeviceResources resources = const NativeDeviceResources(),
  bool automaticGeneration = false,
  bool checkModels = true,
}) => createCityAiController(
  resources: resources,
  automaticGeneration: automaticGeneration,
  checkModels: checkModels,
  engineFactory: (directory) => LlamadartInferenceEngine(
    resources: resources,
    privateModelDirectory: directory,
  ),
);

// Minimal shell retained for isolated widget regression tests, not the launcher.
class CityAiApp extends StatelessWidget {
  final Widget home;
  const CityAiApp({super.key, required this.home});
  @override
  Widget build(BuildContext context) => MaterialApp(
    debugShowCheckedModeBanner: false,
    title: '離線城市助理 PoC',
    locale: const Locale('zh', 'TW'),
    supportedLocales: const [Locale('zh', 'TW')],
    localizationsDelegates: GlobalMaterialLocalizations.delegates,
    theme: ThemeData(
      useMaterial3: true,
      colorScheme: ColorScheme.fromSeed(
        seedColor: const Color(0xff5ab4c5),
        secondary: const Color(0xfff5ba4b),
      ),
      scaffoldBackgroundColor: const Color(0xfff3f6f7),
      filledButtonTheme: FilledButtonThemeData(
        style: FilledButton.styleFrom(minimumSize: const Size(48, 48)),
      ),
      outlinedButtonTheme: OutlinedButtonThemeData(
        style: OutlinedButton.styleFrom(minimumSize: const Size(48, 48)),
      ),
      textButtonTheme: TextButtonThemeData(
        style: TextButton.styleFrom(minimumSize: const Size(48, 48)),
      ),
      chipTheme: const ChipThemeData(padding: EdgeInsets.all(12)),
      materialTapTargetSize: MaterialTapTargetSize.padded,
    ),
    home: home,
  );
}
