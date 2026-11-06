// SPDX-License-Identifier: AGPL-3.0-or-later
import 'package:flutter/material.dart';

import 'package:city_ai_core/features/city_ai/application/city_ai_controller.dart';

class ModelManagerPage extends StatelessWidget {
  final CityAiController controller;
  const ModelManagerPage({super.key, required this.controller});
  Future<void> _download(BuildContext context, String id, int size) async {
    final consent = await showDialog<bool>(
      context: context,
      builder: (context) => AlertDialog(
        title: const Text('下載本機測試模型'),
        content: Text(
          '將下載 ${(size / 1024 / 1024).toStringAsFixed(1)} MiB。下載後會校驗 SHA-256。授權：Apache-2.0；開發者 Hugging Face，量化發布者 Unsloth AI。模型只在手機運作，會占用儲存空間、記憶體及電量。此小模型僅供測試，下載不會自動開啟生成。',
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
    );
    if (consent == true) await controller.download(id, true);
  }

  @override
  Widget build(BuildContext context) => ListenableBuilder(
    listenable: controller,
    builder: (context, _) {
      final c = controller;
      return Scaffold(
        appBar: AppBar(title: const Text('模型管理')),
        body: SafeArea(
          child: ListView(
            key: const Key('model-list'),
            padding: const EdgeInsets.all(20),
            children: [
              const Text(
                '離線檢索不需要模型',
                style: TextStyle(fontSize: 24, fontWeight: FontWeight.bold),
              ),
              const SizedBox(height: 8),
              const Text('只有經過來源審核與校驗的模型才能載入。低階裝置請持續使用離線檢索。'),
              const SizedBox(height: 16),
              Semantics(liveRegion: true, child: Text(c.modelStatus)),
              if (c.downloading) ...[
                LinearProgressIndicator(
                  value: c.downloadProgress,
                  semanticsLabel: '模型下載與校驗進度',
                ),
                if (c.downloadProgress != null)
                  Text('${(c.downloadProgress! * 100).round()}%'),
                OutlinedButton(
                  onPressed: c.cancelDownload,
                  child: const Text('取消下載'),
                ),
              ],
              for (final m in c.models.models)
                Card(
                  child: Padding(
                    padding: const EdgeInsets.all(16),
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text(
                          m.name,
                          style: const TextStyle(
                            fontSize: 18,
                            fontWeight: FontWeight.bold,
                          ),
                        ),
                        Text('原始開發者：${m.developer} · 發布者：${m.publisher}'),
                        Text(
                          '授權：${m.license} · 審核：${m.licenseStatus == 'approved' ? '本機測試核准' : '待授權配置'}',
                        ),
                        SelectableText('原始來源：${m.originalUrl}'),
                        Text(m.message),
                        if (m.sizeBytes > 0) Text('下載大小：${m.sizeBytes} bytes'),
                        if (m.sha256 != null)
                          SelectableText('SHA-256：${m.sha256}'),
                        SelectableText('版本：${m.revision}'),
                        Text(
                          c.installedModels[m.id] == true
                              ? '已安裝，SHA-256 校驗通過'
                              : m.approved
                              ? '尚未安裝'
                              : '已鎖定：需要合法授權與發佈設定',
                        ),
                        const SizedBox(height: 8),
                        Wrap(
                          spacing: 8,
                          runSpacing: 8,
                          children: [
                            FilledButton(
                              onPressed:
                                  !m.approved ||
                                      c.downloading ||
                                      c.loadingModel ||
                                      c.installedModels[m.id] == true
                                  ? null
                                  : () => _download(context, m.id, m.sizeBytes),
                              child: const Text('下載／重試'),
                            ),
                            OutlinedButton(
                              onPressed:
                                  c.downloading || c.loadingModel || !m.approved
                                  ? null
                                  : () => c.deleteModel(m.id),
                              child: const Text('刪除模型'),
                            ),
                          ],
                        ),
                      ],
                    ),
                  ),
                ),
            ],
          ),
        ),
      );
    },
  );
}
