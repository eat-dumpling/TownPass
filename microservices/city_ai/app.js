/* SPDX-License-Identifier: AGPL-3.0-or-later */
(() => {
  'use strict';
  const $ = id => document.getElementById(id);
  const text = (tag, value, className) => {
    const node = document.createElement(tag); node.textContent = value ?? '';
    if (className) node.className = className; return node;
  };
  const updateText = (node, value) => { if (node.textContent !== value) node.textContent = value; };
  let state = null, pending = null, modelFingerprint = '', resetting = false, conversationRevision = null, readingScale = 1, enabling = false;
  const requests = new Map();
  const bridge = () => window.flutterObject && typeof window.flutterObject.postMessage === 'function';
  function post(name, data = null) {
    if (!bridge()) { $('connection-warning').hidden = false; return false; }
    try { window.flutterObject.postMessage(JSON.stringify({ name, data })); return true; }
    catch (_) { $('connection-warning').hidden = false; return false; }
  }
  function openSettings() { if (!$('management').open) $('management').showModal(); $('models-button').setAttribute('aria-expanded', 'true'); }
  function closeSettings() { if ($('management').open) $('management').close(); $('models-button').setAttribute('aria-expanded', 'false'); }
  function applyTextScale() { document.documentElement.style.fontSize = `${20 * Math.min(4, Math.max(.5, Number(state?.text_scale) || 1)) * readingScale}px`; }
  function enableAi() {
    if (!(state?.models || []).some(model => model.approved && model.installed)) { openSettings(); return; }
    enabling = post('model_enable', true);
  }
  const date = value => value ? `${value.slice(0, 10)}（非即時）` : '未知';
  function refreshComposer() {
    const busy = Boolean(pending || resetting || state?.updating || !bridge());
    $('send').disabled = busy;
    $('send').hidden = Boolean(pending);
    $('stop').hidden = !pending;
    $('question').disabled = Boolean(resetting || state?.updating);
    $('clear').disabled = Boolean(resetting || state?.updating);
    document.querySelectorAll('[data-question]').forEach(button => button.disabled = busy);
  }
  function clearMessages(message) {
    pending = null; requests.clear();
    $('welcome').hidden = false;
    $('messages').replaceChildren(text('p', message, 'note'));
  }
  function sourceCard(s) {
    const card = text('section', '', 'source'); card.append(text('h3', `[${s.index}] ${s.title}`));
    if (s.is_demo) card.append(text('p', '測試資料，非真實市政服務', 'demo'));
    card.append(text('p', s.address || s.excerpt, 'address'));
    if (s.phone) card.append(text('p', `電話：${s.phone}`, 'phone'));
    card.append(text('p', `${s.district || '行政區未知'} · 資料日期：${date(s.updated_at)}`, 'date'));
    const details = document.createElement('details'); details.append(text('summary', '資料原文與網址'), text('p', s.excerpt), text('p', s.url));
    const button = text('button', '查看官方資料'); button.type = 'button';
    button.addEventListener('click', () => post('source_open', s.id)); card.append(button, details); return card;
  }
  function renderSources(s) {
    const all = s.sources || [];
    const cited = new Set(Array.from((s.answer || '').matchAll(/\[(\d+)\]/g), match => Number(match[1])));
    const main = all.filter(source => cited.has(source.index));
    if (!main.length && all.length) main.push(all[0]);
    const remainder = all.filter(source => !main.includes(source));
    const nodes = main.map(sourceCard);
    if (remainder.length) {
      const more = document.createElement('details'); more.className = 'more-sources';
      more.append(text('summary', `還有 ${remainder.length} 筆資料`), ...remainder.map(sourceCard)); nodes.push(more);
    }
    return nodes;
  }
  function submit(question) {
    question = question.trim(); if (!question || question.length > 500 || !bridge()) { post('city_ai_state'); return; }
    if (pending || resetting || state?.updating) return;
    const id = `q-${Date.now()}-${Math.floor(Math.random() * 100000)}`;
    const user = text('article', '', 'message user'); user.append(text('span', '您問', 'speaker'), text('p', question));
    const bot = text('article', '', 'message assistant');
    const speaker = text('span', state?.supports_generation ? '手機 AI 對話' : '離線資料摘要', 'speaker');
    const reply = text('p', '問題已收到…', 'reply'); const note = text('p', '', 'note');
    const sources = text('div', '', 'sources'); bot.append(speaker, reply, note, sources);
    $('messages').append(user, bot); pending = id; requests.set(id, {bot, speaker, reply, note, sources});
    $('welcome').hidden = true;
    $('operation-status').hidden = true;
    refreshComposer();
    $('question').value = ''; $('counter').textContent = '0 / 500';
    $('question').style.height = ''; $('question').blur();
    if (!post('llm_ask', { question, request_id: id })) {
      reply.textContent = '連接暫時中斷，請返回城市通後重試。'; pending = null; refreshComposer();
    }
    bot.scrollIntoView({block:'start'});
  }
  function renderModels(s) {
    const fingerprint = JSON.stringify([s.models, s.downloading, s.loading_model, s.supports_generation]);
    if (fingerprint === modelFingerprint) return; modelFingerprint = fingerprint;
    $('models').replaceChildren();
    (s.models || []).forEach(m => {
      const row = text('article', '', 'model'); row.append(text('h3', m.name));
      row.append(text('p', `${m.developer} 開發 · ${m.publisher} 發布 · ${m.license}`));
      row.append(text('p', m.installed ? '已安裝，SHA-256 校驗通過' : !m.approved ? '授權鎖定，尚不可下載' : m.checked === false ? '正在檢查是否已安裝' : '尚未安裝'));
      row.append(text('p', m.message, 'note'));
      const details = document.createElement('details'); details.append(text('summary', '版本與校驗資訊'), text('small', `版本：${m.revision}`), text('small', `SHA-256：${m.sha256 || '尚未設定'}`)); row.append(details);
      const controls = text('div', '', 'controls');
      const download = text('button', `下載／重試${m.size_bytes ? `（${(m.size_bytes / 1048576).toFixed(1)} MiB）` : ''}`);
      download.type = 'button'; download.disabled = !s.supports_generation || !m.approved || m.installed || s.downloading || s.loading_model;
      download.addEventListener('click', () => post('model_install', m.id));
      const remove = text('button', '刪除模型'); remove.type = 'button'; remove.disabled = !m.approved || s.downloading || s.loading_model;
      remove.addEventListener('click', () => post('model_delete', m.id)); controls.append(download, remove); row.append(controls); $('models').append(row);
    });
  }
  function receive(s) {
    if (!s || typeof s !== 'object') return;
    if (s.type === 'error') {
      $('operation-status').textContent = s.message;
      $('operation-status').hidden = false;
      if (s.action === 'llm_ask' && s.request_id === pending) {
        const failed = requests.get(pending);
        if (failed) { failed.speaker.textContent = '查詢未完成'; failed.reply.textContent = s.message; failed.note.textContent = '請稍後重試；問題未上傳。'; failed.sources.replaceChildren(); }
        pending = null;
      }
      if (s.action === 'conversation_clear') resetting = false;
      refreshComposer(); return;
    }
    if (s.type !== 'state') return;
    const finishedEnable = enabling && state?.loading_model && !s.loading_model;
    state = s; $('connection-warning').hidden = true;
    if (finishedEnable) {
      enabling = false;
      if (s.enabled) closeSettings();
      else { $('operation-status').hidden = false; $('operation-status').textContent = s.model_status; }
    }
    applyTextScale();
    if (Number.isInteger(s.conversation_revision)) {
      if (conversationRevision !== null && conversationRevision !== s.conversation_revision) {
        resetting = false;
        clearMessages('新對話已開始；引用以目前資料版本為準。');
      }
      conversationRevision = s.conversation_revision;
    }
    $('mode').textContent = s.loading_model ? '手機 AI 連接中' : s.enabled ? '手機 AI 對話' : '離線查詢';
    $('data-count').textContent = `${s.count} 筆官方資料`;
    $('model-status').textContent = s.model_status;
    const hasModel = (s.models || []).some(model => model.approved && model.installed);
    $('enable-button').textContent = '下載對話模型';
    $('enable-button').hidden = !s.supports_generation || s.enabled || s.loading_model || hasModel;
    $('enable-button').disabled = !s.supports_generation || s.loading_model || s.downloading;
    $('settings-enable').hidden = !s.supports_generation || s.enabled;
    $('settings-enable').textContent = s.automatic_paused ? '恢復本機對話' : '重試本機 AI';
    $('settings-enable').disabled = s.loading_model || s.downloading;
    $('disable-button').hidden = !s.enabled;
    $('stop').hidden = !s.generating; $('download-progress').hidden = !s.downloading; $('cancel-download').hidden = !s.downloading;
    if (s.download_progress == null) $('download-progress').removeAttribute('value'); else $('download-progress').value = s.download_progress;
    $('data-source').textContent = `資料來源：${s.source_url || '未知'}`;
    $('data-source-updated').textContent = `來源更新日期：${date(s.updated_at)}`;
    $('data-version').textContent = `資料包建置：${s.built_at || '未知'}（非來源更新時間）`;
    $('data-status').textContent = `${s.data_status || ''}。${s.can_update ? '只在按更新時下載。' : '更新服務尚未啟用，目前提供內建離線資料。'}`;
    $('data-transfer').textContent = s.data_total_bytes ? `${s.data_received_bytes || 0} / ${s.data_total_bytes} bytes` : '';
    $('data-progress').hidden = !s.updating;
    if (s.data_total_bytes) $('data-progress').value = (s.data_received_bytes || 0) / s.data_total_bytes;
    else $('data-progress').removeAttribute('value');
    $('cancel-data').hidden = !s.updating;
    $('update-data').disabled = !s.can_update || s.updating || resetting;
    renderModels(s);
    const current = requests.get(s.request_id);
    if (current && s.request_id === pending) {
      updateText(current.speaker, s.waiting_for_model ? '手機 AI 對話' : s.generating || s.answer ? (s.answer_mode === 'general' ? '手機 AI 對話' : '手機 AI・資料參考') : '查詢結果');
      updateText(current.reply, s.answer || (s.waiting_for_model ? '問題已保留，連接完成就會自動回答…' : s.generating ? '手機正在回答，請稍候…' : s.status));
      updateText(current.note, s.waiting_for_model ? '不必重送，可以按停止取消。' : s.generating ? '正在手機裡回答…' : s.answer ? (s.answer_mode === 'general' ? '由手機 AI 回答，未連線查證。' : '參考手機裡的資料，來源如下。') : (s.sources || []).length ? '以下是手機裡的資料原文。' : s.received_characters ? '這次回答未完成，請換個說法再試一次。' : '尚無本機回答，可在設定檢查模型；問題未上傳。');
      const sourceKey = JSON.stringify([s.sources || [], (s.answer || '').match(/\[\d+\]/g) || []]);
      if (sourceKey !== current.sourceKey) { current.sources.replaceChildren(...renderSources(s)); current.sourceKey = sourceKey; }
      if (s.reply_ready) pending = null;
    }
    refreshComposer();
  }
  window.CityAi = Object.freeze({ receive });
  $('chat-form').addEventListener('submit', e => { e.preventDefault(); submit($('question').value); });
  $('question').addEventListener('input', () => { $('counter').textContent = `${$('question').value.length} / 500`; $('question').style.height = 'auto'; $('question').style.height = `${Math.min(150, $('question').scrollHeight)}px`; });
  document.querySelectorAll('[data-question]').forEach(b => b.addEventListener('click', () => submit(b.dataset.question)));
  $('models-button').addEventListener('click', openSettings);
  $('settings-done').addEventListener('click', closeSettings);
  $('management').addEventListener('close', () => { $('models-button').setAttribute('aria-expanded', 'false'); $('models-button').focus(); });
  $('enable-button').addEventListener('click', enableAi);
  $('settings-enable').addEventListener('click', enableAi);
  $('disable-button').addEventListener('click', () => post('model_enable', false));
  for (const [id, scale] of [['font-normal', 1], ['font-large', 1.25]]) {
    $(id).addEventListener('click', () => { readingScale = scale; applyTextScale(); $('font-normal').setAttribute('aria-pressed', String(scale === 1)); $('font-large').setAttribute('aria-pressed', String(scale !== 1)); });
  }
  $('stop').addEventListener('click', () => post('llm_cancel'));
  $('cancel-download').addEventListener('click', () => post('model_cancel'));
  $('update-data').addEventListener('click', () => post('data_update'));
  $('cancel-data').addEventListener('click', () => post('data_cancel'));
  $('clear').addEventListener('click', () => {
    resetting = true; clearMessages('正在清除舊對話…'); refreshComposer();
    if (!post('conversation_clear')) { resetting = false; refreshComposer(); }
  });
  function connect() {
    if (!bridge()) { $('connection-warning').hidden = false; return; }
    window.flutterObject.addEventListener('message', event => { try { receive(JSON.parse(event.data)); } catch (_) { /* Ignore malformed native messages. */ } });
    post('city_ai_state');
  }
  connect();
  refreshComposer();
})();
