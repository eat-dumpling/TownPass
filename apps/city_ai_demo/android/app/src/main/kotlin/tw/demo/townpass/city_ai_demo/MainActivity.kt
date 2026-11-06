// SPDX-License-Identifier: AGPL-3.0-or-later
package tw.demo.townpass.city_ai_demo

import android.app.ActivityManager
import android.content.Context
import android.os.StatFs
import io.flutter.embedding.android.FlutterActivity
import io.flutter.embedding.engine.FlutterEngine
import io.flutter.plugin.common.MethodChannel

class MainActivity : FlutterActivity() {
    override fun configureFlutterEngine(flutterEngine: FlutterEngine) {
        super.configureFlutterEngine(flutterEngine)
        MethodChannel(flutterEngine.dartExecutor.binaryMessenger, "tw.demo.townpass/resources")
            .setMethodCallHandler { call, result ->
                when (call.method) {
                    "freeDiskBytes" -> result.success(StatFs(filesDir.absolutePath).availableBytes)
                    "canRunModel" -> {
                        val manager = getSystemService(Context.ACTIVITY_SERVICE) as ActivityManager
                        val modelBytes = (call.argument<Number>("modelBytes")?.toLong() ?: 0L).coerceAtLeast(0L)
                        val minimumAvailable = maxOf(512L * 1024 * 1024, modelBytes + 256L * 1024 * 1024)
                        val memory = ActivityManager.MemoryInfo()
                        manager.getMemoryInfo(memory)
                        result.success(!manager.isLowRamDevice && !memory.lowMemory &&
                            memory.totalMem >= 2L * 1024 * 1024 * 1024 && memory.availMem >= minimumAvailable)
                    }
                    else -> result.notImplemented()
                }
            }
    }
}
