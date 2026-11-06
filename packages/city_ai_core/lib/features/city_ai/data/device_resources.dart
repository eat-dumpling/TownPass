// SPDX-License-Identifier: AGPL-3.0-or-later
import 'package:flutter/services.dart';

import '../domain/model.dart';
import '../ports/services.dart';

class NativeDeviceResources implements DeviceResources {
  static const _channel = MethodChannel('tw.demo.townpass/resources');
  const NativeDeviceResources();
  @override
  Future<int> freeDiskBytes() async {
    try {
      final bytes = await _channel.invokeMethod<int>('freeDiskBytes');
      if (bytes == null || bytes < 0) throw const FormatException();
      return bytes;
    } catch (_) {
      throw const AiFailure(AiFailureKind.space, '無法確認儲存空間，下載暫停；離線檢索仍可使用');
    }
  }

  @override
  Future<bool> canRunModel({int modelBytes = 0}) async {
    try {
      return await _channel.invokeMethod<bool>('canRunModel', {
            'modelBytes': modelBytes,
          }) ??
          false;
    } catch (_) {
      return false;
    }
  }
}
