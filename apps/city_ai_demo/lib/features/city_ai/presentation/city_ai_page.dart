// SPDX-License-Identifier: AGPL-3.0-or-later
import 'dart:async';

import 'package:flutter/material.dart';
import 'package:url_launcher/url_launcher.dart';

import 'package:city_ai_core/features/city_ai/application/city_ai_controller.dart';
import 'package:city_ai_core/features/city_ai/domain/knowledge.dart';

import 'model_manager_page.dart';

String dateLabel(DateTime? date) => date == null
    ? '未知'
    : '${date.toLocal().toIso8601String().split('T').first}（非即時）';

class CityAiPage extends StatefulWidget {
  final CityAiController controller;
  const CityAiPage({super.key, required this.controller});
  @override
  State<CityAiPage> createState() => _CityAiPageState();
}

class _CityAiPageState extends State<CityAiPage> with WidgetsBindingObserver {
  final _query = TextEditingController();
  CityAiController get c => widget.controller;
  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addObserver(this);
  }

  @override
  void didHaveMemoryPressure() {
    unawaited(c.setEnabled(false));
  }

  @override
  void didChangeAppLifecycleState(AppLifecycleState state) {
    if (state == AppLifecycleState.paused ||
        state == AppLifecycleState.detached) {
      unawaited(c.setEnabled(false));
    }
  }

  @override
  void dispose() {
    WidgetsBinding.instance.removeObserver(this);
    _query.dispose();
    super.dispose();
  }

  Future<void> _search() async {
    FocusScope.of(context).unfocus();
    await c.search(_query.text);
  }

  @override
  Widget build(BuildContext context) => ListenableBuilder(
    listenable: c,
    builder: (context, _) {
      final snapshot = c.snapshot;
      return Scaffold(
        appBar: AppBar(
          title: const Text('離線城市助理'),
          actions: [
            IconButton(
              tooltip: '模型管理',
              icon: const Icon(Icons.settings_outlined),
              onPressed: () => Navigator.of(context).push(
                MaterialPageRoute<void>(
                  builder: (_) => ModelManagerPage(controller: c),
                ),
              ),
            ),
          ],
        ),
        body: SafeArea(
          child: Align(
            alignment: Alignment.topCenter,
            child: ConstrainedBox(
              constraints: const BoxConstraints(maxWidth: 760),
              child: ListView(
                key: const Key('knowledge-list'),
                padding: const EdgeInsets.all(20),
                children: [
                  const Text(
                    '把已下載的城市資訊，\n留在手機裡查。',
                    style: TextStyle(fontSize: 24, fontWeight: FontWeight.bold),
                  ),
                  const SizedBox(height: 12),
                  const Text('本地端 AI 功能示範（PoC）・非臺北市正式服務'),
                  const SizedBox(height: 16),
                  Card(
                    child: Padding(
                      padding: const EdgeInsets.all(16),
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Text(
                            snapshot == null ? '離線資料尚未就緒' : '離線檢索可用',
                            style: const TextStyle(
                              fontSize: 18,
                              fontWeight: FontWeight.bold,
                            ),
                          ),
                          const Text('問題不會上傳。無網路仍可查詢手機上的資料；連線狀態不影響搜尋。'),
                          const SizedBox(height: 8),
                          Text(
                            '已下載 ${snapshot?.documents.length ?? 0} 筆 · 資料日期：${dateLabel(snapshot?.updatedAt)}',
                          ),
                          if (snapshot != null) ...[
                            if (snapshot.isDemo)
                              const Text(
                                '測試資料，非真實市政服務',
                                style: TextStyle(fontWeight: FontWeight.bold),
                              ),
                          ],
                          ExpansionTile(
                            tilePadding: EdgeInsets.zero,
                            title: const Text('資料來源與更新'),
                            children: [
                              if (snapshot != null) ...[
                                Text('資料集：${snapshot.datasetId}'),
                                Text(
                                  '離線包建置時間：${snapshot.builtAt.toIso8601String()}（非來源更新時間）',
                                ),
                                SelectableText(snapshot.sourceUrl.toString()),
                              ],
                              TextButton.icon(
                                onPressed: c.updating ? null : c.update,
                                icon: const Icon(Icons.system_update_alt),
                                label: Text(c.updating ? '更新中…' : '更新公開資料'),
                              ),
                              if (!c.knowledge.canUpdate)
                                const Text('更新服務尚未啟用，目前提供內建離線資料。'),
                            ],
                          ),
                        ],
                      ),
                    ),
                  ),
                  const SizedBox(height: 16),
                  TextField(
                    controller: _query,
                    maxLength: 500,
                    minLines: 1,
                    maxLines: 3,
                    textInputAction: TextInputAction.search,
                    onSubmitted: (_) => _search(),
                    decoration: const InputDecoration(
                      labelText: '想查詢什麼？',
                      hintText: '例如：文山區社區關懷據點',
                      border: OutlineInputBorder(),
                    ),
                  ),
                  Wrap(
                    spacing: 8,
                    runSpacing: 8,
                    children: [
                      for (final question in ['文山區社區關懷據點', '大安區長者據點'])
                        ActionChip(
                          label: Text(question),
                          onPressed: () {
                            _query.text = question;
                            unawaited(_search());
                          },
                        ),
                    ],
                  ),
                  const SizedBox(height: 8),
                  FilledButton.icon(
                    onPressed: snapshot == null || c.updating ? null : _search,
                    icon: const Icon(Icons.search),
                    label: const Text('查詢離線資料'),
                  ),
                  const SizedBox(height: 12),
                  SwitchListTile(
                    contentPadding: EdgeInsets.zero,
                    title: const Text('啟用本機生成（選用）'),
                    subtitle: Text(c.modelStatus),
                    value: c.enabled,
                    onChanged: c.loadingModel || c.downloading
                        ? null
                        : c.setEnabled,
                  ),
                  if (c.loadingModel)
                    const LinearProgressIndicator(semanticsLabel: '模型載入中'),
                  const Divider(height: 24),
                  Semantics(
                    liveRegion: true,
                    child: Text(
                      c.status,
                      key: const Key('search-status'),
                      style: const TextStyle(fontWeight: FontWeight.bold),
                    ),
                  ),
                  if (c.generating) ...[
                    const LinearProgressIndicator(semanticsLabel: '本機生成中'),
                    Text('已接收 ${c.receivedCharacters} 字；僅顯示通過來源核對的摘錄'),
                    OutlinedButton.icon(
                      onPressed: c.stop,
                      icon: const Icon(Icons.stop),
                      label: const Text('停止生成'),
                    ),
                  ],
                  if (c.answer.isNotEmpty)
                    Card(
                      child: Padding(
                        padding: const EdgeInsets.all(16),
                        child: SelectableText(c.answer),
                      ),
                    ),
                  for (var i = 0; i < c.hits.length; i++)
                    SourceCard(
                      key: ValueKey('source-$i'),
                      hit: c.hits[i],
                      index: i + 1,
                    ),
                  const SizedBox(height: 24),
                  const Text(
                    '僅提供來源原文與經核對摘錄。資料不含即時活動名額、申請資格或醫療判斷；需要時請查詢官方最新資訊。',
                  ),
                  const SizedBox(height: 12),
                  TextButton(
                    onPressed: () => showDialog<void>(
                      context: context,
                      builder: (_) => AlertDialog(
                        title: const Text('隱私與使用說明'),
                        content: const SingleChildScrollView(
                          child: Text(
                            '不需登入，不要求定位、相機、麥克風或通訊錄。問題與回答只留在記憶體，不保存聊天紀錄，也不傳送至雲端模型。只有按下模型下載或公開資料更新才會下載檔案。檢視來源會以外部瀏覽器連線到官方網站。模型可於管理頁刪除；刪除 App 由系統清除私有檔案。SmolLM2 僅供本機推論測試，繁體中文品質尚未通過真機與人工評估。',
                          ),
                        ),
                        actions: [
                          TextButton(
                            onPressed: () => Navigator.pop(context),
                            child: const Text('關閉'),
                          ),
                        ],
                      ),
                    ),
                    child: const Text('隱私與使用說明'),
                  ),
                  TextButton(
                    onPressed: () => showLicensePage(
                      context: context,
                      applicationName: '離線城市助理 PoC',
                      applicationVersion: '1.0.0',
                    ),
                    child: const Text('開源套件授權'),
                  ),
                ],
              ),
            ),
          ),
        ),
      );
    },
  );
}

class SourceCard extends StatelessWidget {
  final SearchHit hit;
  final int index;
  const SourceCard({super.key, required this.hit, required this.index});
  @override
  Widget build(BuildContext context) {
    final d = hit.document;
    return Card(
      margin: const EdgeInsets.symmetric(vertical: 8),
      child: Padding(
        padding: const EdgeInsets.all(16),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text(
              '[$index] ${d.title}',
              style: const TextStyle(fontSize: 18, fontWeight: FontWeight.bold),
            ),
            if (d.isDemo)
              const Text(
                '測試資料，非真實市政服務',
                style: TextStyle(fontWeight: FontWeight.bold),
              ),
            const SizedBox(height: 8),
            SelectableText(hit.snippet),
            if (d.phone != null) Text('來源電話：${d.phone}'),
            Text('行政區：${d.district ?? '未知'} · 資料日期：${dateLabel(d.updatedAt)}'),
            Text('檢索詞符合度：${(hit.confidence * 100).round()}%（非事實可信度）'),
            SelectableText(d.sourceUrl.toString()),
            TextButton.icon(
              icon: const Icon(Icons.open_in_new),
              label: const Text('檢視官方原始資料'),
              onPressed: () async {
                try {
                  final uri = officialUrl(d.sourceUrl.toString());
                  if (!await launchUrl(
                    uri,
                    mode: LaunchMode.externalApplication,
                  )) {
                    throw const FormatException();
                  }
                } catch (_) {
                  if (context.mounted) {
                    ScaffoldMessenger.of(context).showSnackBar(
                      const SnackBar(content: Text('無法開啟來源，請稍後重試')),
                    );
                  }
                }
              },
            ),
          ],
        ),
      ),
    );
  }
}
