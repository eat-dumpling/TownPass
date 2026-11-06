import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:town_pass/util/tp_text_span.dart';

void main() {
  test('mixed Traditional Chinese, Latin and child spans retain text once', () {
    final span = TPTextSpan(
      text: '臺北 TownPass 123',
      children: const [TextSpan(text: '，你好')],
    );
    expect(span.toPlainText(), '臺北 TownPass 123，你好');
    expect(
      span.children!.whereType<TextSpan>().any(
        (s) => s.style?.fontFamily == 'Roboto',
      ),
      isTrue,
    );
    expect(
      span.children!.whereType<TextSpan>().any(
        (s) => s.style?.fontFamily == 'PingFangTC',
      ),
      isTrue,
    );
  });
}
