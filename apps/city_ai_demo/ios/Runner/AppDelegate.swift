// SPDX-License-Identifier: AGPL-3.0-or-later
import Flutter
import UIKit
import os
import Darwin

@main
@objc class AppDelegate: FlutterAppDelegate, FlutterImplicitEngineDelegate {
  private var resourcesChannel: FlutterMethodChannel?
  override func application(
    _ application: UIApplication,
    didFinishLaunchingWithOptions launchOptions: [UIApplication.LaunchOptionsKey: Any]?
  ) -> Bool {
    return super.application(application, didFinishLaunchingWithOptions: launchOptions)
  }
  func didInitializeImplicitFlutterEngine(_ engineBridge: FlutterImplicitEngineBridge) {
    GeneratedPluginRegistrant.register(with: engineBridge.pluginRegistry)
    resourcesChannel = FlutterMethodChannel(name: "tw.demo.townpass/resources",
      binaryMessenger: engineBridge.applicationRegistrar.messenger())
    resourcesChannel?.setMethodCallHandler { call, result in
      switch call.method {
      case "freeDiskBytes":
        do {
          var root = try FileManager.default.url(for: .applicationSupportDirectory,
            in: .userDomainMask, appropriateFor: nil, create: true)
          var excluded = URLResourceValues()
          excluded.isExcludedFromBackup = true
          try root.setResourceValues(excluded)
          let values = try root.resourceValues(forKeys: [.volumeAvailableCapacityForImportantUsageKey])
          guard let bytes = values.volumeAvailableCapacityForImportantUsage else {
            result(FlutterError(code: "storage", message: "無法讀取可用空間", details: nil)); return
          }
          result(bytes)
        } catch { result(FlutterError(code: "storage", message: "無法讀取可用空間", details: nil)) }
      case "canRunModel":
        let args = call.arguments as? [String: Any]
        let modelBytes = max(0, (args?["modelBytes"] as? NSNumber)?.int64Value ?? 0)
        result(self.hasModelMemoryBudget(modelBytes: UInt64(modelBytes)))
      default: result(FlutterMethodNotImplemented)
      }
    }
  }
  private func hasModelMemoryBudget(modelBytes: UInt64) -> Bool {
    let minimumPhysical: UInt64 = 2 * 1024 * 1024 * 1024
    let minimumAvailable: UInt64 = max(512 * 1024 * 1024, modelBytes + 256 * 1024 * 1024)
    guard ProcessInfo.processInfo.physicalMemory >= minimumPhysical else { return false }
    #if targetEnvironment(simulator)
    // Simulator has no iOS process limit. Measure real host free/inactive pages.
    var stats = vm_statistics64()
    let capacity = MemoryLayout<vm_statistics64>.size / MemoryLayout<integer_t>.size
    var count = mach_msg_type_number_t(capacity)
    let host = mach_host_self()
    var pageSize: vm_size_t = 0
    guard host_page_size(host, &pageSize) == KERN_SUCCESS else { return false }
    let status = withUnsafeMutablePointer(to: &stats) { pointer in
      pointer.withMemoryRebound(to: integer_t.self, capacity: capacity) {
        host_statistics64(host, HOST_VM_INFO64, $0, &count)
      }
    }
    guard status == KERN_SUCCESS else { return false }
    return (UInt64(stats.free_count) + UInt64(stats.inactive_count)) * UInt64(pageSize) >= minimumAvailable
    #else
    return UInt64(os_proc_available_memory()) >= minimumAvailable
    #endif
  }

}
