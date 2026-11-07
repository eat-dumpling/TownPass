// SPDX-License-Identifier: AGPL-3.0-or-later
// Talk card (現場溝通卡): at the garbage truck, in a shop or on the phone, the user shows a
// phrase in large Chinese (with their own language underneath) or lets the phone read it out
// in Taiwan Mandarin. The other person can tap their answer on the same screen and the user
// sees it in their own language — a two-way card, not just a phrasebook.
// Route: #/talk/<scene>, scene = truck | store | drop | phone. Speech output is the phone's
// own text-to-speech; nothing is sent anywhere.
"use strict";

(function () {
  const TH = window.TH;
  const { h, t, go, fill } = TH;
  const icon = (...a) => TH.icon(...a);

  // zh is what the other person reads, so it is written as people in Taipei actually say it.
  Object.assign(window.TH_STRINGS.zh, {
    tcTitle: "現場溝通卡", tcOpen: "給隊員看", tcOpenStore: "給店員看", tcScript: "電話小抄",
    tcSay: "我要說", tcItems: "我手上的東西", tcHear: "可能會聽到", tcSpeak: "唸出來", tcReplies: "對方的回答",
    tcAskReply: "請點選您的回答", tcTheySaid: "對方說", tcFlip: "轉給對方看", tcCall: "撥打",
    tcScTruck: "垃圾車", tcScStore: "商店", tcScDrop: "收受點", tcScPhone: "打電話",
    tcP_t1: "這是一般垃圾。", tcP_t2: "這些是資源回收。", tcP_t3: "這是廚餘。", tcP_t4: "請問今天有收回收嗎？",
    tcP_t5: "請問回收車還會來嗎？", tcP_item: "這是{name}，要丟哪裡？",
    tcP_s1: "請問這裡可以回收廢電池嗎？", tcP_s2: "我要回收行動電源。", tcP_s3: "請問可以回收燈泡或燈管嗎？", tcP_s4: "請問有賣臺北市專用垃圾袋嗎？",
    tcP_d1: "我錯過垃圾車了，可以在這裡丟嗎？", tcP_d2: "請問現在可以丟一般垃圾嗎？",
    tcP_call: "您好，我住在{place}，想預約大型垃圾清運，要丟{items}。請問什麼時候可以拿出來？要放在哪裡？",
    tcP_slow: "可以請您說慢一點嗎？", tcP_thanks: "謝謝！",
    tcR_t1: "丟這裡就好。", tcR_t2: "交給後面的回收車。", tcR_t3: "要用專用垃圾袋。", tcR_t4: "今天不收這個。",
    tcR_t5: "要先倒乾淨、沖一下。", tcR_t6: "廚餘倒進藍色桶。", tcR_ok: "好，謝謝。",
    tcR_s1: "可以，交給我就好。", tcR_s2: "放進回收箱。", tcR_s3: "這裡不收，請去別家。", tcR_s4: "有，要多大的？", tcR_s5: "沒有賣。",
    tcR_d1: "可以，丟這裡。", tcR_d2: "現在不收，請看開放時間。", tcR_d3: "這裡只收回收和廚餘。",
    tcR_p1: "請放在門口或路邊。", tcR_p2: "晚上九點以後拿出來。", tcR_p3: "我們會再打電話給你。", tcR_p4: "請上網預約。", tcR_p5: "請打 1999。",
  });
  Object.assign(window.TH_STRINGS.en, {
    tcTitle: "Talk card", tcOpen: "Show the crew", tcOpenStore: "Show the clerk", tcScript: "Call script",
    tcSay: "I want to say", tcItems: "What I have", tcHear: "You may hear", tcSpeak: "Read aloud", tcReplies: "Their answer",
    tcAskReply: "Please tap your answer", tcTheySaid: "They said", tcFlip: "Turn to them", tcCall: "Call",
    tcScTruck: "Garbage truck", tcScStore: "Store", tcScDrop: "Drop-off", tcScPhone: "Phone call",
    tcP_t1: "This is general trash.", tcP_t2: "These are for recycling.", tcP_t3: "This is food waste.", tcP_t4: "Do you take recycling today?",
    tcP_t5: "Is the recycling truck still coming?", tcP_item: "This is {name}. Where should it go?",
    tcP_s1: "Can I recycle used batteries here?", tcP_s2: "I'd like to recycle a power bank.", tcP_s3: "Do you take light bulbs or tubes?", tcP_s4: "Do you sell Taipei official garbage bags?",
    tcP_d1: "I missed the garbage truck. Can I throw it out here?", tcP_d2: "Can I throw out general trash now?",
    tcP_call: "Hello, I live in {place}. I'd like to book a bulky waste pickup for {items}. When can I put it out, and where?",
    tcP_slow: "Could you speak a little more slowly?", tcP_thanks: "Thank you!",
    tcR_t1: "Put it here.", tcR_t2: "Give it to the recycling truck behind.", tcR_t3: "It needs an official garbage bag.", tcR_t4: "We don't take this today.",
    tcR_t5: "Empty it and rinse it first.", tcR_t6: "Pour food waste into the blue bucket.", tcR_ok: "OK, thank you.",
    tcR_s1: "Yes, just give it to me.", tcR_s2: "Put it in the recycling box.", tcR_s3: "We don't take it here. Please try another store.", tcR_s4: "Yes. What size?", tcR_s5: "We don't sell them.",
    tcR_d1: "Yes, put it here.", tcR_d2: "Not now. Please check the opening hours.", tcR_d3: "We only take recycling and food waste here.",
    tcR_p1: "Put it at your door or by the road.", tcR_p2: "Put it out after 9 pm.", tcR_p3: "We will call you back.", tcR_p4: "Please book online.", tcR_p5: "Please call 1999.",
  });

  const SCENES = {
    truck: { icon: "truck", label: "tcScTruck", say: ["tcP_t1", "tcP_t2", "tcP_t3", "tcP_t4", "tcP_t5", "tcP_slow", "tcP_thanks"], replies: ["tcR_t1", "tcR_t2", "tcR_t3", "tcR_t4", "tcR_t5", "tcR_t6", "tcR_ok"] },
    store: { icon: "building-store", label: "tcScStore", say: ["tcP_s1", "tcP_s2", "tcP_s3", "tcP_s4", "tcP_slow", "tcP_thanks"], replies: ["tcR_s1", "tcR_s2", "tcR_s3", "tcR_s4", "tcR_s5", "tcR_ok"] },
    drop: { icon: "clock", label: "tcScDrop", say: ["tcP_d1", "tcP_d2", "tcP_slow", "tcP_thanks"], replies: ["tcR_d1", "tcR_d2", "tcR_d3", "tcR_ok"] },
    phone: { icon: "phone", label: "tcScPhone", say: ["tcP_call", "tcP_slow", "tcP_thanks"], replies: ["tcR_p1", "tcR_p2", "tcR_p3", "tcR_p4", "tcR_p5"] },
  };

  const fillVars = (s, vars) => Object.entries(vars || {}).reduce((acc, [k, v]) => acc.split(`{${k}}`).join(v), s);
  // The Chinese line (always) and the user's own line (their language, or the side-by-side
  // language when the screen itself is in Chinese).
  const zhOf = (key, vars) => fillVars(TH.tIn("zh", key), vars);
  const mineOf = (key, vars) => {
    const code = TH.lang() !== "zh" ? TH.lang() : TH.pairLang();
    return code ? fillVars(TH.tIn(code, key), vars) : null;
  };
  const myCode = () => TH.lang() !== "zh" ? TH.lang() : (TH.pairLang() || "zh");

  // The phone's own text-to-speech, in Taiwan Mandarin (or the user's language for answers).
  function speak(text, lang) {
    if (!window.speechSynthesis || !text) return;
    try {
      window.speechSynthesis.cancel();
      const u = new SpeechSynthesisUtterance(text);
      u.lang = lang;
      const voices = window.speechSynthesis.getVoices() || [];
      const want = lang.toLowerCase(), base = want.split("-")[0];
      u.voice = voices.find(v => v.lang.toLowerCase().replace("_", "-") === want) || voices.find(v => v.lang.toLowerCase().startsWith(base)) || null;
      u.rate = 0.9;
      window.speechSynthesis.speak(u);
    } catch (_) { /* no speech output here */ }
  }
  const localeOf = code => (window.TH_LANGS.find(l => l.code === code) || {}).speech || "en-US";

  // What the user is throwing out (from the step list), with Chinese and own-language names.
  function heldItems() {
    let ids = [];
    try { ids = JSON.parse(localStorage.getItem("th.picks") || "[]"); } catch (_) { /* none */ }
    return ids.map(TH.itemById).filter(Boolean).filter(it => !["tissue"].includes(it.id)).slice(0, 6);
  }

  // ------------------------------------------------------------ full-screen card
  function showCard(scene, zh, mine) {
    const body = h("div", { class: "tc-big" });
    let flipped = false;
    const draw = () => fill(body,
      h("p", { class: "tc-zh", lang: "zh-Hant-TW", text: zh }),
      mine && mine !== zh ? h("p", { class: "tc-mine", lang: myCode(), text: mine }) : null);
    draw();
    const wrap = h("div", { class: "tc-full", role: "dialog", "aria-modal": "true", "aria-label": t("tcTitle") });
    const close = () => { if (window.speechSynthesis) window.speechSynthesis.cancel(); wrap.remove(); };
    const flipBtn = h("button", { class: "tc-act", type: "button", onclick: () => { flipped = !flipped; body.classList.toggle("flipped", flipped); } }, icon("refresh", 22), h("span", { text: t("tcFlip") }));
    const replies = () => showReplies(scene, close);
    fill(wrap,
      h("div", { class: "tc-top" }, h("button", { class: "icon-round", type: "button", "aria-label": t("close"), onclick: close }, icon("x", 20))),
      body,
      h("div", { class: "tc-actions" },
        h("button", { class: "tc-act primary", type: "button", onclick: () => speak(zh, "zh-TW") }, icon("volume", 22), h("span", { text: t("tcSpeak") })),
        flipBtn,
        h("button", { class: "tc-act", type: "button", onclick: replies }, icon("message-circle", 22), h("span", { text: t(scene === "phone" ? "tcHear" : "tcReplies") }))));
    document.body.append(wrap);
    TH.onNavigate(close);
  }

  // The other person taps their answer (written for them, in Chinese); the user then sees it in
  // their own language, large, and can have it read aloud. On the phone these are lines the user
  // may hear, so they can recognise them.
  function showReplies(scene, closeCard) {
    const s = SCENES[scene];
    const wrap = h("div", { class: "tc-full tc-replies", role: "dialog", "aria-modal": "true", "aria-label": t("tcReplies") });
    const close = () => wrap.remove();
    const showAnswer = key => {
      const mine = mineOf(key) || TH.tIn("zh", key);
      fill(wrap,
        h("div", { class: "tc-top" }, h("button", { class: "icon-round", type: "button", "aria-label": t("close"), onclick: close }, icon("x", 20))),
        h("div", { class: "tc-big" },
          h("p", { class: "tc-label", text: t("tcTheySaid") }),
          h("p", { class: "tc-zh", lang: myCode(), text: mine }),
          h("p", { class: "tc-mine", lang: "zh-Hant-TW", text: zhOf(key) })),
        h("div", { class: "tc-actions" },
          h("button", { class: "tc-act primary", type: "button", onclick: () => speak(mine, localeOf(myCode())) }, icon("volume", 22), h("span", { text: t("tcSpeak") })),
          h("button", { class: "tc-act", type: "button", onclick: () => { close(); closeCard(); } }, icon("check", 22), h("span", { text: t("vaGotIt") }))));
    };
    fill(wrap,
      h("div", { class: "tc-top" }, h("button", { class: "icon-round", type: "button", "aria-label": t("close"), onclick: close }, icon("x", 20))),
      // Addressed to the other person, so in Chinese first.
      h("p", { class: "tc-ask", lang: "zh-Hant-TW" }, scene === "phone" ? TH.tIn("zh", "tcHear") : TH.tIn("zh", "tcAskReply"),
        TH.lang() !== "zh" ? h("span", { class: "tc-ask-mine", text: t(scene === "phone" ? "tcHear" : "tcAskReply") }) : null),
      h("div", { class: "tc-reply-grid" }, s.replies.map(key => h("button", { class: "tc-reply", type: "button", onclick: () => showAnswer(key) },
        h("span", { class: "tc-reply-zh", lang: "zh-Hant-TW", text: zhOf(key) }),
        mineOf(key) && mineOf(key) !== zhOf(key) ? h("span", { class: "tc-reply-mine", lang: myCode(), text: mineOf(key) }) : null))));
    document.body.append(wrap);
    TH.onNavigate(close);
  }

  // ------------------------------------------------------------ the page
  function phraseRow(scene, zh, mine, art) {
    return h("button", { class: "tc-row", type: "button", onclick: () => showCard(scene, zh, mine) },
      art || null,
      h("span", { class: "grow" }, h("span", { class: "tc-row-zh", lang: "zh-Hant-TW", text: zh }), mine && mine !== zh ? h("span", { class: "tc-row-mine", lang: myCode(), text: mine }) : null),
      icon("chev", 18));
  }

  function viewTalk(sceneArg) {
    const scene = SCENES[sceneArg] ? sceneArg : "truck";
    TH.setHeader(t("tcTitle"));
    const s = SCENES[scene];
    const rules = TH.rules();
    const out = [];
    out.push(h("div", { class: "tc-tabs", role: "tablist" }, Object.entries(SCENES).map(([k, v]) =>
      h("button", { class: "tc-tab" + (k === scene ? " on" : ""), type: "button", role: "tab", "aria-selected": String(k === scene), onclick: () => go("talk/" + k, { replace: true }) },
        icon(v.icon, 20), h("span", { text: t(v.label) })))));

    if (scene === "phone") {
      // The call script, filled in with where the user lives and what they are throwing out.
      const p = TH.profile ? TH.profile.get() : {};
      const place = `臺北市${p.district || ""}${p.village || ""}`;
      const bulky = heldItems().filter(it => TH.catOf(it) === "bulky");
      const zhItems = (bulky.length ? bulky : [TH.itemById("furniture")].filter(Boolean)).map(it => TH.labelIn ? TH.labelIn("zh", it) : TH.LIn("zh", it.name)).join("、");
      const mineItems = (bulky.length ? bulky : [TH.itemById("furniture")].filter(Boolean)).map(it => TH.labelIn ? TH.labelIn(myCode(), it) : TH.LIn(myCode(), it.name)).join(", ");
      const zh = zhOf("tcP_call", { place, items: zhItems });
      const mine = mineOf("tcP_call", { place, items: mineItems });
      const squad = p.district && rules && rules.contacts.squads[p.district];
      out.push(h("div", { class: "tc-script" },
        h("p", { class: "tc-row-zh", lang: "zh-Hant-TW", text: zh }),
        mine && mine !== zh ? h("p", { class: "tc-row-mine", lang: myCode(), text: mine }) : null,
        h("div", { class: "row-actions" },
          h("button", { class: "mini-btn primary", type: "button", onclick: () => TH.dial(squad || rules.contacts.hotline) }, icon("phone", 14), `${t("tcCall")} ${squad || rules.contacts.hotline}`),
          h("button", { class: "mini-btn", type: "button", onclick: () => speak(zh, "zh-TW") }, icon("volume", 14), t("tcSpeak")),
          h("button", { class: "mini-btn", type: "button", onclick: () => showCard(scene, zh, mine) }, icon("maximize", 14), t("tcFlip")))));
    }

    if (scene === "truck") {
      const held = heldItems().filter(it => !["bulky"].includes(TH.catOf(it)));
      if (held.length) {
        out.push(h("h2", { class: "section-title", text: t("tcItems") }));
        out.push(h("div", { class: "tc-list" }, held.map(it => {
          const zhName = TH.labelIn ? TH.labelIn("zh", it) : TH.LIn("zh", it.name);
          const myName = TH.labelIn ? TH.labelIn(myCode(), it) : TH.LIn(myCode(), it.name);
          return phraseRow(scene, zhOf("tcP_item", { name: zhName }), mineOf("tcP_item", { name: myName }), TH.art(it, 36));
        })));
      }
    }

    const say = scene === "phone" ? s.say.filter(k => k !== "tcP_call") : s.say;
    out.push(h("h2", { class: "section-title", text: t("tcSay") }));
    out.push(h("div", { class: "tc-list" }, say.map(k => phraseRow(scene, zhOf(k), mineOf(k)))));
    out.push(h("div", { class: "actions" }, h("button", { class: "btn btn-secondary wide", type: "button", onclick: () => showReplies(scene, () => {}) },
      icon("message-circle", 18), t(scene === "phone" ? "tcHear" : "tcReplies"))));
    return out;
  }

  TH.routes = Object.assign(TH.routes || {}, { talk: viewTalk });
  TH.talk = { open: scene => go("talk/" + (SCENES[scene] ? scene : "truck")) };
})();
