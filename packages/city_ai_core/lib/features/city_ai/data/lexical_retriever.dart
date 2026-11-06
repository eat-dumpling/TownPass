// SPDX-License-Identifier: AGPL-3.0-or-later
import 'dart:math';

import '../domain/knowledge.dart';
import '../ports/services.dart';

String normalize(String text) {
  var s = String.fromCharCodes(
    text.runes.map((r) => r >= 0xff01 && r <= 0xff5e ? r - 0xfee0 : r),
  ).toLowerCase();
  for (final term in ['銀髮族', '銀髮', '老人', '長輩']) {
    s = s.replaceAll(term, '長者');
  }
  return s.replaceAll('台北', '臺北').replaceAll(RegExp(r'\s+'), ' ').trim();
}

Set<String> tokens(String s, {bool bigramsOnly = false}) {
  final result = <String>{};
  for (final m in RegExp(
    r'[\u3400-\u9fff]+|[a-z0-9]+|[\uac00-\ud7af]+',
  ).allMatches(normalize(s))) {
    final t = m.group(0)!;
    if (RegExp(r'^[\u3400-\u9fff]').hasMatch(t)) {
      for (var i = 0; i < t.length; i++) {
        if (!bigramsOnly) result.add(t[i]);
        if (i + 1 < t.length) result.add(t.substring(i, i + 2));
      }
    } else {
      result.add(t);
    }
  }
  return result;
}

class LexicalRetriever implements OfflineRetriever {
  const LexicalRetriever();
  @override
  List<SearchHit> search(
    String query,
    KnowledgeSnapshot snapshot, {
    int topK = 3,
  }) {
    if (query.trim().isEmpty || query.length > 500) return [];
    // This snapshot has no live availability, eligibility, fees or schedules.
    if (RegExp(r'即時|名額|資格|保證|報名|費用|收費|幾點|時間|日期|今天|明天|醫療|診斷').hasMatch(query)) {
      return [];
    }
    final q = normalize(query);
    final terms = tokens(q);
    final district = districts.where(q.contains).firstOrNull;
    final semanticQuery = q
        .replaceAll('臺北市', '')
        .replaceAll('臺北', '')
        .replaceAll(district ?? '\u0000', '');
    final strong = tokens(semanticQuery, bigramsOnly: true);
    if (terms.isEmpty || strong.isEmpty) return [];
    final corpus = snapshot.documents;
    final docTerms = {
      for (final d in corpus)
        d.id: tokens('${d.title} ${d.body} ${d.district ?? ''}'),
    };
    final frequencies = <String, int>{};
    for (final ts in docTerms.values) {
      for (final t in ts) {
        frequencies[t] = (frequencies[t] ?? 0) + 1;
      }
    }
    final hits = <SearchHit>[];
    for (final doc in corpus) {
      if (district != null && doc.district != district) continue;
      final dt = docTerms[doc.id]!;
      final matches = strong.intersection(dt);
      final confidence = matches.length / strong.length;
      // A district alone, or a single common Chinese character, is not evidence.
      final semantic = matches.where(
        (t) => district == null || !district.contains(t),
      );
      if (semantic.isEmpty || confidence < .45) continue;
      final titleTokens = tokens(doc.title);
      var score = 0.0;
      for (final t in terms.intersection(dt)) {
        final weight = t.length >= 2 ? 2.0 : .15;
        score +=
            weight *
            (log(1 + (corpus.length + .5) / ((frequencies[t] ?? 0) + .5))) *
            (titleTokens.contains(t) ? 2 : 1);
      }
      if (district != null) score += 3;
      hits.add(
        SearchHit(
          doc,
          score,
          confidence.clamp(0, 1),
          doc.body.length > 350 ? '${doc.body.substring(0, 350)}…' : doc.body,
        ),
      );
    }
    hits.sort((a, b) {
      final c = b.score.compareTo(a.score);
      return c == 0 ? a.document.id.compareTo(b.document.id) : c;
    });
    return hits.take(topK.clamp(1, 5)).toList();
  }
}
