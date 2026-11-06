import importlib.util
from pathlib import Path
import unittest

spec = importlib.util.spec_from_file_location('importer', Path(__file__).parents[1] / 'import_taipei_csv.py')
m = importlib.util.module_from_spec(spec)
spec.loader.exec_module(m)


class ImportTests(unittest.TestCase):
    def convert(self, text, **kwargs):
        return m.convert(text.encode('utf-8-sig'), 'fictional-test', 'https://data.taipei/',
                         '2026-11-06T00:00:00Z', demo=True, **kwargs)

    def test_bom_alias_dedupe_and_normalize(self):
        s = self.convert('名稱,地址,電話\n虛構據點,台北市文山區測試路,123\n虛構據點,台北市文山區測試路,123\n')
        self.assertEqual(len(s['documents']), 1)
        self.assertEqual(s['documents'][0]['district'], '文山區')
        self.assertTrue(s['documents'][0]['is_demo'])
        self.assertIsNone(s['source_updated_at'])

    def test_stable_sort(self):
        header = '名稱,地址\n'
        a, b = '虛構 A,文山區甲路\n', '虛構 B,大安區乙路\n'
        self.assertEqual(self.convert(header+a+b), self.convert(header+b+a))

    def test_missing_and_ambiguous(self):
        for s in ['名稱\n虛構\n', '名稱,據點名稱,地址\na,b,c\n', '名稱,地址\n,文山區\n', '名稱,地址\n', '名稱,名稱,地址\na,b,c\n']:
            with self.subTest(s=s), self.assertRaises(ValueError): self.convert(s)

    def test_invalid_url(self):
        for url in ['http://data.taipei/', 'https://evil.example/', 'https://data.taipei@evil.example/', 'javascript:alert(1)']:
            with self.subTest(url=url), self.assertRaises(ValueError): m.safe_url(url)

    def test_limits_encoding_and_conflicts(self):
        with self.assertRaises(ValueError): m.convert(b'x'*(m.MAX_BYTES+1), 'x', 'https://data.taipei/', '2026-11-06T00:00:00Z')
        with self.assertRaises(ValueError): m.convert(b'\xff', 'x', 'https://data.taipei/', '2026-11-06T00:00:00Z')
        with self.assertRaises(ValueError): self.convert('id,名稱,地址\nx,A,文山區\nx,B,大安區\n')
        with self.assertRaises(ValueError): self.convert('名稱,地址\n<script>,文山區\n')
        with self.assertRaises(ValueError): m.timestamp('2026-11-06T00:00:00')


if __name__ == '__main__': unittest.main()
