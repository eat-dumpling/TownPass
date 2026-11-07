// SPDX-License-Identifier: AGPL-3.0-or-later
// Trash Helper photo recognition, powered by 回收小里長 (recycle-li, develop branch).
//
// Live camera in the page: every item in view gets a box and a name (MediaPipe object detector
// → tracker → SigLIP image model in a Web Worker), all on the phone. The camera picture is never
// uploaded or saved. The recognised 回收小里長 item is mapped onto Trash Helper's own rule table
// (data/rv_map.json); what to do with it always comes from data/rules.json.
// Module: vendor/recycle-vision/ (tools/trash_helper_vision/build.sh). Text uses the page's normal fonts.
"use strict";

(function () {
  const TH = window.TH;
  const { h, t, L, go, fill, btn } = TH;
  const icon = (...a) => TH.icon(...a);

  Object.assign(window.TH_STRINGS.zh, {
    scanTitleV3: "拍照看怎麼丟", scanAim: "把要丟的東西放進畫面", scanShoot: "拍下來",
    scanLoading: "準備辨識…", scanLoadingPct: "準備辨識… {p}%", scanModelError: "辨識模型無法載入，請改用相簿或手動選擇。",
    scanCamOff: "無法開啟相機。可以從相簿選照片，或手動選擇品項。", scanFound: "畫面上的東西",
    scanMaybe: "可能是", scanPrivacy: "畫面只在手機上辨識，不上傳、不存檔。",
    scanNothing: "還沒認出東西。對準一件、靠近一點再試。", rvBasis: "這件依「回收小里長」品項表的臺北市分類顯示，請以清潔隊說明為準。",
    rvSource: "分類依據：{s}",
  });
  Object.assign(window.TH_STRINGS.en, {
    scanTitleV3: "Snap to sort", scanAim: "Point the camera at what you're throwing out", scanShoot: "Capture",
    scanLoading: "Getting ready…", scanLoadingPct: "Getting ready… {p}%", scanModelError: "The recognition model couldn't load. Use a photo or pick the item.",
    scanCamOff: "The camera isn't available. Choose a photo or pick the item.", scanFound: "In view",
    scanMaybe: "Maybe", scanPrivacy: "Recognised on your phone. Nothing is uploaded or saved.",
    scanNothing: "Nothing recognised yet. Aim at one item and move closer.", rvBasis: "Shown with the Taipei category from the 回收小里長 item list. Check with the cleaning squad.",
    rvSource: "Based on: {s}",
  });

  // ------------------------------------------------------------ module + mapping (loaded once, when first needed)
  let modPromise = null, mapPromise = null;
  function loadVision() {
    if (!modPromise) {
      window.__RV_BASE = new URL("vendor/recycle-vision/", document.baseURI).href;
      modPromise = import(new URL("vendor/recycle-vision/recycle-vision.js", document.baseURI).href);
      modPromise.catch(() => { modPromise = null; });
    }
    return modPromise;
  }
  function loadMap() {
    if (!mapPromise) { mapPromise = fetch("data/rv_map.json").then(r => r.json()); mapPromise.catch(() => { mapPromise = null; }); }
    return mapPromise;
  }
  const ourItem = (map, rvId) => map.map[rvId] ? TH.itemById(map.map[rvId]) : null;
  function openFound(map, rvId) {
    const id = map.map[rvId];
    try { const s = new Set(JSON.parse(localStorage.getItem("th.dex") || "[]")); if (id) { s.add(id); localStorage.setItem("th.dex", JSON.stringify([...s])); } } catch (_) { /* ignore */ }
    // Always open the guide page for what was recognised (sort.js), like 回收小里長's guide card.
    // The home picker's TH.onScanPick (flow.js) stays set after home renders; a photo must not
    // silently add the item there and jump back home.
    TH.onScanPick = null;
    go("learn/" + encodeURIComponent(rvId));
  }
  // Picture for a recognised thing: our item art, or the category tile for the fallback ones.
  function foundArt(map, rvId, size) {
    const it = ourItem(map, rvId);
    if (it) return TH.art(it, size);
    const fb = map.fallback[rvId];
    return TH.catArt(fb ? TH.rules().groups[fb.group].cat : "verify", size);
  }

  // ------------------------------------------------------------ live scan page
  let session = null; // running scanner (stopped when the page changes)
  function stopSession() { if (session) { session.stop(); session = null; } }

  function viewScan() {
    TH.setHeader(null);
    const lang = TH.lang() === "en" ? "en" : "zh";
    const video = h("video", { playsinline: true, muted: true, autoplay: true, "aria-hidden": "true" });
    const overlay = h("canvas", { class: "rv-overlay", "aria-hidden": "true" });
    const placeholder = h("div", { class: "rv-placeholder" }, icon("camera", 56));
    const hint = h("p", { class: "cam-hint", "aria-live": "polite", text: t("scanLoading") });
    const list = h("div", { class: "rv-found" });
    const fileIn = h("input", { type: "file", accept: "image/*", hidden: true });
    const root = h("div", { class: "cam rv" });
    let found = [];
    let map = null;

    const shutter = h("button", { class: "shutter", type: "button", "aria-label": t("scanShoot"), onclick: () => (found.length ? chooseSheet(found.map(f => ({ id: f.id, name: f.name, kindLabel: f.kindLabel, p: f.conf, sure: f.sure }))) : failSheet()) });
    fill(root,
      h("div", { class: "cam-head" },
        h("button", { class: "icon-round dark", type: "button", "aria-label": t("close"), onclick: () => (TH.depth() > 0 ? history.back() : go("", { replace: true })) }, icon("x", 22)),
        h("h1", { text: t("scanTitleV3") }), h("span", { style: "width:44px" })),
      h("div", { class: "viewfinder live" }, placeholder, video, overlay),
      hint, list,
      h("div", { class: "cam-controls" },
        h("button", { class: "cam-side", type: "button", onclick: () => go("pick") }, icon("layout-grid", 24), h("span", { text: t("manual") })),
        shutter,
        h("button", { class: "cam-side", type: "button", onclick: () => fileIn.click() }, icon("photo", 24), h("span", { text: t("album") }))),
      h("p", { class: "cam-privacy", text: t("scanPrivacy") }),
      fileIn);

    const drawList = () => fill(list, found.slice(0, 3).map(f => h("button", { class: "rv-card", type: "button", style: `--k:${f.color}`, onclick: () => openFound(map, f.id) },
      foundArt(map, f.id, 40),
      h("span", { class: "grow" }, h("b", { text: (f.sure ? "" : t("scanMaybe") + " ") + f.name }), h("small", { text: f.kindLabel })),
      icon("chev", 18))));

    // Album photo: one picture, the best candidates.
    fileIn.addEventListener("change", async () => {
      const file = fileIn.files && fileIn.files[0];
      fileIn.value = "";
      if (!file) return;
      hint.textContent = t("recognizing");
      try {
        const [mod] = await Promise.all([loadVision(), loadMap().then(m => { map = m; })]);
        const top = (await mod.recognizeFile(file, lang)).filter(c => c.p >= 0.05).slice(0, 3);
        hint.textContent = "";
        top.length ? chooseSheet(top.map(c => ({ ...c, sure: c.p >= 0.5 }))) : failSheet();
      } catch (e) { hint.textContent = t("scanModelError"); }
    });

    function chooseSheet(cands) {
      const sureOne = cands.length === 1 && cands[0].sure;
      TH.sheet(sureOne ? t("isThisIt") : t("notSureWhich"),
        h("div", { class: "cand3" }, cands.slice(0, 3).map((c, i) => h("button", { class: "cand-tile" + (i === 0 ? " top" : ""), type: "button", onclick: () => openFound(map, c.id) },
          foundArt(map, c.id, 52), h("span", { class: "cand-name", text: c.name }), h("span", { class: "caption", text: `${c.kindLabel}・${Math.round(c.p * 100)}%` })))),
        btn("btn-secondary wide", t("noneOfThese"), () => go("pick")));
    }
    function failSheet() {
      TH.sheet(t("blurryTitle"), h("p", { class: "muted", text: t("blurryTips") }),
        btn("btn-primary wide", t("album"), () => fileIn.click()),
        btn("btn-secondary wide", t("pickManually"), () => go("pick")));
    }

    stopSession();
    TH.onNavigate(stopSession);
    // Start after the page is in the DOM (the overlay needs its size).
    requestAnimationFrame(async () => {
      try {
        const [mod] = await Promise.all([loadVision(), loadMap().then(m => { map = m; })]);
        if (!root.isConnected) return;
        session = await mod.startScanner({
          video, canvas: overlay, lang,
          onStatus: s => {
            placeholder.hidden = s.camera === "on";
            if (s.camera === "off") hint.textContent = t("scanCamOff");
            else if (s.model === "error") hint.textContent = t("scanModelError");
            else if (s.model === "loading") hint.textContent = s.pct ? t("scanLoadingPct", { p: s.pct }) : t("scanLoading");
            else hint.textContent = s.hint || t("scanAim");
          },
          onFound: f => { found = f; drawList(); },
          onTap: f => openFound(map, f.id),
        });
        if (!root.isConnected) stopSession();
      } catch (e) {
        console.warn("[scan]", e);
        hint.textContent = t("scanModelError");
      }
    });
    return root;
  }

  // ------------------------------------------------------------ recognised item without its own rule entry
  function viewRecognised(rvId) {
    const rules = TH.rules();
    const out = h("div");
    loadMap().then(map => {
      const fb = map.fallback[rvId];
      if (map.map[rvId]) { go("item/" + map.map[rvId], { replace: true }); return; }
      if (!fb) { go("pick", { replace: true }); return; }
      const g = rules.groups[fb.group];
      // Same layout as a rule item; what to do comes from the group's rules.
      const item = {
        id: "rv:" + rvId, icon: rules.categories[g.cat].icon, name: fb.name, group: fb.group, bag: g.bag, steps: [],
        verify: { zh: t("rvBasis"), en: t("rvBasis") }, src: [],
        handover: { zh: L(g.note) || "", en: L(g.note) || "" },
      };
      fill(out, TH.views.viewItem(item),
        fb.source ? h("p", { class: "caption", text: t("rvSource", { s: fb.source }) }) : null);
    }).catch(() => go("pick", { replace: true }));
    return out;
  }

  TH.views.viewScan = viewScan;
  TH.resetScan = stopSession;
  TH.routes = Object.assign(TH.routes || {}, { rv: id => viewRecognised(decodeURIComponent(id || "")) });
})();
