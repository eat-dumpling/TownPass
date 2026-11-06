// SPDX-License-Identifier: AGPL-3.0-or-later
import 'dart:convert';

const insufficientData = '目前離線資料不足，無法確認；請查詢官方最新資訊。';
const districts = [
  '松山區',
  '信義區',
  '大安區',
  '中山區',
  '中正區',
  '大同區',
  '萬華區',
  '文山區',
  '南港區',
  '內湖區',
  '士林區',
  '北投區',
];

Uri officialUrl(String value) {
  final uri = Uri.parse(value);
  if (value.length > 2048 ||
      uri.scheme != 'https' ||
      !{
        'data.taipei',
        'www.gov.taipei',
        'www.dosw.gov.taipei',
      }.contains(uri.host) ||
      uri.userInfo.isNotEmpty ||
      (uri.hasPort && uri.port != 443)) {
    throw const FormatException('來源必須是允許的官方 HTTPS 網址');
  }
  return uri;
}

String requiredText(Map<String, dynamic> j, String key, int max) {
  final value = j[key];
  if (value is! String ||
      value.trim().isEmpty ||
      value.length > max ||
      RegExp(r'[<>\x00-\x08\x0B\x0C\x0E-\x1F]').hasMatch(value)) {
    throw FormatException('欄位格式錯誤：$key');
  }
  return value.trim();
}

DateTime? sourceDate(dynamic value) {
  if (value == null) return null;
  if (value is! String ||
      !RegExp(r'^\d{4}-\d{2}-\d{2}T.*(Z|[+-]\d{2}:\d{2})$').hasMatch(value)) {
    throw const FormatException('日期必須有時區');
  }
  return DateTime.parse(value).toUtc();
}

class KnowledgeDocument {
  final String id, title, body, sourceType;
  final String? district, address, phone;
  final Uri sourceUrl;
  final DateTime? updatedAt;
  final bool isDemo;
  const KnowledgeDocument({
    required this.id,
    required this.title,
    required this.body,
    required this.sourceUrl,
    required this.updatedAt,
    required this.isDemo,
    required this.sourceType,
    this.district,
    this.address,
    this.phone,
  });

  factory KnowledgeDocument.fromJson(Map<String, dynamic> j) {
    String? optional(String key, int max) =>
        j[key] == null ? null : requiredText(j, key, max);
    final district = optional('district', 10);
    final type = requiredText(j, 'source_type', 50);
    if (j['is_demo'] is! bool ||
        !{'taipei_open_data', 'fictional_test_fixture'}.contains(type) ||
        (type == 'fictional_test_fixture') != j['is_demo'] ||
        (district != null && !districts.contains(district))) {
      throw const FormatException('資料類型或行政區錯誤');
    }
    return KnowledgeDocument(
      id: requiredText(j, 'id', 128),
      title: requiredText(j, 'title', 300),
      body: requiredText(j, 'body', 5000),
      sourceUrl: officialUrl(requiredText(j, 'source_url', 2048)),
      updatedAt: sourceDate(j['source_updated_at']),
      isDemo: j['is_demo'] as bool,
      sourceType: type,
      district: district,
      address: optional('address', 500),
      phone: optional('phone', 100),
    );
  }
}

class KnowledgeSnapshot {
  final String datasetId;
  final Uri sourceUrl;
  final DateTime builtAt;
  final DateTime? updatedAt;
  final List<KnowledgeDocument> documents;
  const KnowledgeSnapshot({
    required this.datasetId,
    required this.sourceUrl,
    required this.builtAt,
    required this.updatedAt,
    required this.documents,
  });
  bool get isDemo => documents.first.isDemo;
  factory KnowledgeSnapshot.parse(String text) {
    if (utf8.encode(text).length > 10 * 1024 * 1024) {
      throw const FormatException('資料超過 10 MB');
    }
    final j = jsonDecode(text) as Map<String, dynamic>;
    if (j['schema_version'] is! int ||
        j['schema_version'] != 1 ||
        j['documents'] is! List) {
      throw const FormatException('不支援的資料版本');
    }
    final rows = j['documents'] as List;
    if (rows.isEmpty || rows.length > 10000) {
      throw const FormatException('資料筆數錯誤');
    }
    final docs = rows
        .map((e) => KnowledgeDocument.fromJson(e as Map<String, dynamic>))
        .toList();
    if (docs.map((e) => e.id).toSet().length != docs.length ||
        docs.any((e) => e.isDemo != docs.first.isDemo)) {
      throw const FormatException('ID 重複或混合測試與正式資料');
    }
    return KnowledgeSnapshot(
      datasetId: requiredText(j, 'dataset_id', 128),
      sourceUrl: officialUrl(requiredText(j, 'source_url', 2048)),
      builtAt:
          sourceDate(j['built_at']) ?? (throw const FormatException('缺少建置時間')),
      updatedAt: sourceDate(j['source_updated_at']),
      documents: List.unmodifiable(docs),
    );
  }
}

class SearchHit {
  final KnowledgeDocument document;
  final double score, confidence;
  final String snippet;
  const SearchHit(this.document, this.score, this.confidence, this.snippet);
}
