// SPDX-License-Identifier: AGPL-3.0-or-later
const {test} = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const path = require('node:path');

// Minimal DOM adapter: execute the actual shipped frontend, with no network,
// browser storage, copied state machine or fabricated model implementation.
class Element {
  constructor(tag = 'div') { this.tag = tag; this.children = []; this.listeners = {}; this.style = {}; this.attributes = {}; this.hidden = false; this.disabled = false; this.value = ''; this.open = false; this.dataset = {}; this.scrollHeight = 70; this._text = ''; }
  set textContent(value) { this._text = String(value ?? ''); this.children = []; }
  get textContent() { return this._text + this.children.map(child => child.textContent).join(''); }
  set innerHTML(_) { throw Error('Untrusted content must use textContent'); }
  append(...children) { this.children.push(...children); }
  replaceChildren(...children) { this._text = ''; this.children = children; }
  addEventListener(name, callback) { this.listeners[name] = callback; }
  setAttribute(name, value) { this.attributes[name] = value; }
  removeAttribute(name) { delete this.attributes[name]; }
  click() { if (!this.disabled) this.listeners.click?.({preventDefault(){}}); }
  focus() { this.focused = true; }
  blur() { this.focused = false; }
  scrollIntoView() {}
  showModal() { this.open = true; }
  close() { this.open = false; this.listeners.close?.({}); }
}
function setup() {
  const html = fs.readFileSync(path.join(__dirname, '../index.html'), 'utf8');
  const nodes = new Map(Array.from(html.matchAll(/id="([^"]+)"/g), match => [match[1], new Element()]));
  const chips = Array.from(html.matchAll(/data-question="([^"]+)"/g), match => { const chip = new Element('button'); chip.dataset.question = match[1]; return chip; });
  const posted = [];
  const document = {getElementById: id => { assert(nodes.has(id), `Missing HTML ID: ${id}`); return nodes.get(id); }, createElement: tag => new Element(tag), querySelectorAll: selector => { assert.equal(selector, '[data-question]'); return chips; }, documentElement: new Element('html')};
  const window = {flutterObject: {postMessage: payload => posted.push(JSON.parse(payload)), addEventListener(){}}};
  vm.runInNewContext(fs.readFileSync(path.join(__dirname, '../app.js'), 'utf8'), {window, document});
  const state = {type:'state', conversation_revision:0, count:3, models:[], enabled:false, supports_generation:true, loading_model:false, downloading:false, updating:false, can_update:false, data_received_bytes:0, text_scale:1, sources:[], answer:'', status:'已就緒', model_status:'測試狀態', request_id:null, reply_ready:true};
  const receive = extra => window.CityAi.receive({...state, ...extra});
  receive({});
  const get = id => nodes.get(id);
  const submit = question => { get('question').value = question; get('chat-form').listeners.submit({preventDefault(){}}); };
  return {get, receive, submit, posted, document, chips, window};
}
const source = {id:'fixture-1', index:1, title:'明確標記的虛構測試據點', address:'測試地址', phone:'測試電話', excerpt:'僅供測試', district:'文山區', updated_at:null, url:'https://data.taipei/'};

test('double submit is blocked and matching native error restores the composer', () => {
  const app = setup();
  app.submit('文山區社區關懷據點');
  const request = app.posted.at(-1);
  app.submit('不應再次送出');
  assert.equal(app.posted.filter(item => item.name === 'llm_ask').length, 1);
  assert.equal(app.get('send').disabled, true);
  app.window.CityAi.receive({type:'error', action:'llm_ask', request_id:request.data.request_id, message:'資料更新中，請稍後重試'});
  assert.equal(app.get('send').disabled, false);
  assert.match(app.get('messages').textContent, /請稍後重試/);
  app.submit('再問一次');
  assert.equal(app.posted.filter(item => item.name === 'llm_ask').length, 2);
});
test('new conversation waits for native acknowledgement before accepting a new query', () => {
  const app = setup();
  app.get('clear').click();
  app.submit('尚未清除不得送出');
  assert.equal(app.posted.filter(item => item.name === 'llm_ask').length, 0);
  app.receive({conversation_revision:1});
  assert.equal(app.get('welcome').hidden, false);
  app.submit('現在可以提問');
  assert.equal(app.posted.at(-1).name, 'llm_ask');
});
test('public data update locks the composer, exposes bytes and supports cancellation', () => {
  const app = setup();
  app.receive({updating:true, can_update:true, data_received_bytes:32, data_total_bytes:128, data_status:'正在下載公開資料'});
  app.submit('更新中不得送出');
  assert.equal(app.posted.filter(item => item.name === 'llm_ask').length, 0);
  assert.equal(app.get('data-transfer').textContent, '32 / 128 bytes');
  assert.equal(app.get('cancel-data').hidden, false);
  app.get('cancel-data').click();
  assert.equal(app.posted.at(-1).name, 'data_cancel');
});
test('successful data replacement removes old citation nodes and request state', () => {
  const app = setup();
  app.submit('文山區');
  app.receive({request_id:app.posted.at(-1).data.request_id, sources:[source]});
  assert.match(app.get('messages').textContent, /虛構測試據點/);
  app.receive({conversation_revision:1, built_at:'2026-11-06T00:00:00Z'});
  assert.doesNotMatch(app.get('messages').textContent, /虛構測試據點/);
  assert.equal(app.get('send').disabled, false);
});
test('font controls combine with system scale and settings return to the conversation', () => {
  const app = setup();
  app.receive({text_scale:2});
  assert.equal(app.document.documentElement.style.fontSize, '40px');
  app.get('models-button').click();
  assert.equal(app.get('management').open, true);
  app.get('font-large').click();
  assert.equal(app.document.documentElement.style.fontSize, '50px');
  app.get('settings-done').click();
  assert.equal(app.get('management').open, false);
  assert.equal(app.get('models-button').focused, true);
});
test('AI text remains plain text and sources only send verified document IDs', () => {
  const app = setup();
  app.submit('<img src=x onerror=bad()>');
  const id = app.posted.at(-1).data.request_id;
  app.receive({request_id:id, answer:'<script>bad()</script> [1]', sources:[source], enabled:true});
  assert.match(app.get('messages').textContent, /<script>bad\(\)<\/script>/);
  const bot = app.get('messages').children.at(-1);
  const card = bot.children.at(-1).children[0];
  const button = card.children.find(child => child.tag === 'button');
  button.click();
  assert.deepEqual(app.posted.at(-1), {name:'source_open', data:'fixture-1'});
});
test('main screen offers preparation when no model is installed, without enabling a fake model', () => {
  const app = setup();
  app.get('enable-button').click();
  assert.equal(app.get('management').open, true);
  assert.equal(app.posted.some(item => item.name === 'model_enable'), false);
});
test('stream progress preserves source nodes instead of repeatedly rebuilding accessible controls', () => {
  const app = setup();
  app.submit('文山區');
  const request_id = app.posted.at(-1).data.request_id;
  app.receive({request_id, generating:true, reply_ready:false, sources:[source]});
  const sources = app.get('messages').children.at(-1).children.at(-1);
  const original = sources.children[0];
  app.receive({request_id, generating:true, reply_ready:false, received_characters:15, sources:[source]});
  assert.equal(sources.children[0], original);
});
test('unsupported inference keeps offline search usable and hides the AI action', () => {
  const app = setup();
  app.receive({supports_generation:false});
  assert.equal(app.get('enable-button').hidden, true);
  assert.equal(app.get('send').disabled, false);
  app.chips[0].click();
  assert.equal(app.posted.at(-1).name, 'llm_ask');
});
test('general answer without any RAG source stays visible and is labelled as a local conversation', () => {
  const app = setup();
  app.submit('你是誰');
  app.receive({request_id:app.posted.at(-1).data.request_id, answer_mode:'general', enabled:true, answer:'我是測試用的本機助理。', received_characters:12, sources:[]});
  const bot = app.get('messages').children.at(-1);
  assert.equal(bot.children[0].textContent, '手機 AI 對話');
  assert.match(bot.children[1].textContent, /本機助理/);
  assert.match(bot.children[2].textContent, /未連線查證/);
  assert.equal(bot.children.at(-1).children.length, 0);
  assert.equal(app.get('send').disabled, false);
});

test('installed model needs no main-screen enable action while warming and composer accepts an early question', () => {
  const app = setup();
  app.receive({automatic_generation:true, loading_model:true, models:[{id:'fixture-model', approved:true, installed:true}]});
  assert.equal(app.get('enable-button').hidden, true);
  assert.equal(app.get('send').disabled, false);
  app.submit('你是誰');
  const id = app.posted.at(-1).data.request_id;
  app.receive({request_id:id, waiting_for_model:true, loading_model:true, reply_ready:false});
  assert.match(app.get('messages').textContent, /問題已保留/);
  assert.equal(app.get('stop').hidden, false);
  assert.equal(app.get('send').disabled, true);
  assert.equal(app.posted.some(item => item.name === 'model_enable'), false);
  app.get('stop').click();
  assert.equal(app.posted.at(-1).name, 'llm_cancel');
  app.receive({request_id:id, waiting_for_model:false, loading_model:true, reply_ready:true, status:'已停止'});
  assert.equal(app.get('send').disabled, false);
});
