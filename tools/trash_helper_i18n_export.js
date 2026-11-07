// SPDX-License-Identifier: AGPL-3.0-or-later
// Exports every UI string (en + zh) of the Trash Helper page as JSON, for translators.
// Usage (macOS JavaScriptCore): jsc tools/trash_helper_i18n_export.js -- <page dir>
// Reads i18n.js plus the Object.assign(window.TH_STRINGS.xx, {...}) blocks in the view scripts.
var dir = arguments[0];
var window = {};
load(dir + "/i18n.js");
function blocks(src) {
  var out = [], re = /Object\.assign\(window\.TH_STRINGS\.(\w+),\s*\{/g, m;
  while ((m = re.exec(src))) {
    var i = re.lastIndex - 1, depth = 0, q = null;
    for (var j = i; j < src.length; j++) {
      var c = src[j];
      if (q) { if (c === "\\") { j++; continue; } if (c === q) q = null; continue; }
      if (c === '"' || c === "'" || c === "`") { q = c; continue; }
      if (c === "{") depth++;
      else if (c === "}") { depth--; if (depth === 0) break; }
    }
    out.push([m[1], src.slice(i, j + 1)]);
  }
  return out;
}
["flow.js", "scan.js", "sort.js", "assistant.js"].forEach(function (f) {
  blocks(readFile(dir + "/" + f)).forEach(function (b) {
    var obj = eval("(" + b[1] + ")");
    var target = window.TH_STRINGS[b[0]];
    for (var k in obj) target[k] = obj[k];
  });
});
var en = window.TH_STRINGS.en, zh = window.TH_STRINGS.zh, res = {};
Object.keys(en).forEach(function (k) { res[k] = { en: en[k], zh: zh[k] }; });
print(JSON.stringify(res, null, 1));
