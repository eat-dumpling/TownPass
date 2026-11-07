# 全字庫正楷體（子集）

`tw-kai-subset.woff2` 是「全字庫正楷體」（TW-Kai，版本 11510.1）的子集，只留 App 用到的字、注音符號、聲調與中文標點。

- 來源與授權：數位發展部，CNS11643中文標準交換碼全字庫網站，https://www.cns11643.gov.tw 。依「政府資料開放授權條款－第 1 版」使用，可以改作（包括取子集）與再散布，須標示出處。
- 下載：https://data.cns11643.gov.tw/opendata/Fonts_Kai.zip
- 為什麼不用教育部標準楷書：教育部標準楷書字形檔是 CC BY-ND（禁止改作），不能取子集；整個字型檔太大，不適合放進 WebView。

重新產生（先跑 `scripts/gen-zhuyin.mjs` 更新字表，要裝 fonttools 與 brotli）：

```bash
node -e "const c=require('./src/zhuyin/chars.json');let s=Object.keys(c).join('');for(let u=0x3105;u<=0x312F;u++)s+=String.fromCodePoint(u);s+='ˊˇˋ˙「」『』，。！？、：；（）…—～・＋％';require('fs').writeFileSync('/tmp/kai-chars.txt',s)"
pyftsubset TW-Kai.ttf --text-file=/tmp/kai-chars.txt --flavor=woff2 --layout-features='*' --output-file=src/assets/fonts/tw-kai-subset.woff2
```
