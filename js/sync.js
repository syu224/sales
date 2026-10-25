// データの出入口。シート（Apps Script）との読み書きと、端末内の控え・未送信の変更を管理する。
//
// しくみ
//   server … 最後にシートから読んだ内容
//   queue  … まだシートに届いていない変更（1件＝1行の、変えた列だけ）
//   data   … 画面に出す内容（server に queue を重ねたもの）
// 保存したらすぐ queue に積んで送信。届いたら queue から消し、シートが返した行で server を更新する。

import * as db from './db.js';
import { TABS, REF_FIELDS } from './schema.js';
import { nowIso, uid, toast } from './util.js';

const ALL_TABS = ['営業先', '担当者', '案件', '活動履歴', '社内取引先'];
const emptyData = () => Object.fromEntries(ALL_TABS.map((t) => [t, []]));

export const state = {
  settings: { url: '', secret: '' },
  server: emptyData(),
  queue: [],
  failed: [],
  data: emptyData(),
  byId: {},
  status: 'idle', // idle | syncing | offline | error | unconfigured
  lastPull: '',
  lastError: '',
  notices: [],
  warnings: [],
  loaded: false,
};

const listeners = new Set();
export function subscribe(fn) {
  listeners.add(fn);
  return () => listeners.delete(fn);
}
function emit(reason, detail) {
  listeners.forEach((fn) => {
    try { fn(reason, detail); } catch (e) { console.error(e); }
  });
}

// この起動中に本IDへ置き換わった仮ID（入力中の画面が古い仮IDを持っていても正しく保存するため）
const tmpMap = {};

export function realId(id) {
  return tmpMap[id] || id;
}

export const isConfigured = () => !!(state.settings.url && state.settings.secret);

// ───────────── 起動 ─────────────

export async function init() {
  if (location.hostname === 'localhost' && localStorage.getItem('rentic-dev-mock') === '1') {
    await import('/__dev/mock.js'); // 開発用の模擬シート（公開先では動かない）
  }
  state.settings = (await db.get('settings')) || { url: '', secret: '' };
  state.server = { ...emptyData(), ...((await db.get('server')) || {}) };
  state.queue = (await db.get('queue')) || [];
  state.failed = (await db.get('failed')) || [];
  state.lastPull = (await db.get('lastPull')) || '';
  state.notices = (await db.get('notices')) || [];
  state.status = isConfigured() ? 'idle' : 'unconfigured';
  recompute();
  state.loaded = true;
  emit('data');
}

export async function saveSettings(settings) {
  state.settings = { url: settings.url.trim(), secret: settings.secret.trim() };
  await db.set('settings', state.settings);
  state.status = isConfigured() ? 'idle' : 'unconfigured';
  emit('status');
}

// ───────────── 画面用データの組み立て ─────────────

function idField(tab) {
  return TABS[tab]?.id;
}

function recompute() {
  const data = {};
  ALL_TABS.forEach((tab) => {
    data[tab] = state.server[tab].map((r) => ({ ...r }));
  });
  const index = {};
  ALL_TABS.forEach((tab) => {
    const f = idField(tab);
    index[tab] = new Map();
    if (f) data[tab].forEach((r) => index[tab].set(r[f], r));
  });
  state.queue.forEach((op) => {
    const f = idField(op.tab);
    let rec = index[op.tab].get(op.id);
    if (!rec) {
      rec = { [f]: op.id };
      data[op.tab].push(rec);
      index[op.tab].set(op.id, rec);
    }
    Object.assign(rec, op.patch);
    rec._pending = true;
  });
  state.data = data;
  state.byId = index;
}

export function get(tab, id) {
  return state.byId[tab]?.get(id);
}

// ───────────── 保存（画面から呼ぶ） ─────────────

/**
 * 1行を追加・更新する。id を省くと新規（仮ID）。戻り値は ID。
 * patch には変えたい列だけを入れる。
 */
export async function save(tab, id, patch) {
  const f = idField(tab);
  // 送信済みの仮IDを指していたら本IDに置き換える
  if (id && tmpMap[id]) id = tmpMap[id];
  patch = { ...patch };
  REF_FIELDS.forEach((k) => { if (patch[k] && tmpMap[patch[k]]) patch[k] = tmpMap[patch[k]]; });
  const isNew = !id;
  const recId = id || `tmp-${uid()}`;
  const current = isNew ? null : get(tab, recId);
  const serverRec = isNew ? null : state.server[tab].find((r) => r[f] === recId);

  const diff = {};
  Object.entries(patch).forEach(([k, v]) => {
    const val = v === null || v === undefined ? '' : String(v);
    if (isNew || !current || String(current[k] ?? '') !== val) diff[k] = val;
  });
  if (!isNew && Object.keys(diff).length === 0) return recId;

  const prev = {};
  if (serverRec) Object.keys(diff).forEach((k) => { prev[k] = serverRec[k] ?? ''; });

  state.queue.push({ opId: uid(), tab, id: recId, patch: diff, prev, editedAt: nowIso(), attempts: 0 });
  await db.set('queue', state.queue);
  recompute();
  emit('data');
  flush();
  return recId;
}

// ───────────── 通信 ─────────────

async function request(body) {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), 30000);
  try {
    const res = await fetch(state.settings.url, {
      method: 'POST',
      // text/plain にすると、ブラウザの事前確認（CORS）なしで Apps Script に届く
      headers: { 'Content-Type': 'text/plain;charset=utf-8' },
      body: JSON.stringify({ ...body, secret: state.settings.secret }),
      signal: ctrl.signal,
      redirect: 'follow',
    });
    const text = await res.text();
    let json;
    try { json = JSON.parse(text); } catch { throw new Error('bad_response'); }
    if (!json.ok) throw new Error(json.error || 'server_error');
    return json;
  } finally {
    clearTimeout(timer);
  }
}

export function errorMessage(code) {
  return ({
    bad_secret: '合言葉が違います。設定画面で確認してください。',
    not_configured: 'Apps Script 側で合言葉がまだ発行されていません（手順書の手順4）。',
    busy: 'シートが混み合っています。少し待つと自動で再送します。',
    bad_response: 'Apps Script の URL が正しくないか、公開の設定が違います（手順書の手順5）。',
    server_error: 'シート側でエラーが起きました。',
    AbortError: '通信が時間切れになりました。電波の良い所で再度お試しください。',
    'Failed to fetch': 'つながりませんでした。電波か URL を確認してください。',
  })[code] || code;
}

export async function ping(settings) {
  const saved = state.settings;
  state.settings = settings;
  try {
    return await request({ action: 'ping' });
  } finally {
    state.settings = saved;
  }
}

let pulling = null;
export function pull() {
  if (!isConfigured()) return Promise.resolve(false);
  if (pulling) return pulling;
  pulling = (async () => {
    setStatus('syncing');
    try {
      const res = await request({ action: 'list' });
      const server = emptyData();
      const warnings = [];
      ALL_TABS.forEach((tab) => {
        const t = res.data[tab];
        if (!t) { warnings.push(`シートに「${tab}」タブがありません`); return; }
        server[tab] = t.rows;
        (t.warnings || []).forEach((w) => warnings.push(`「${tab}」タブ：${w}`));
      });
      state.server = server;
      state.warnings = warnings;
      state.lastPull = nowIso();
      state.lastError = '';
      await db.set('server', server);
      await db.set('lastPull', state.lastPull);
      recompute();
      setStatus('idle');
      emit('data');
      return true;
    } catch (e) {
      failStatus(e);
      return false;
    } finally {
      pulling = null;
    }
  })();
  return pulling;
}

let flushing = null;
export function flush() {
  if (!isConfigured() || state.queue.length === 0) return Promise.resolve();
  if (flushing) return flushing.then(() => flush());
  flushing = (async () => {
    if (!navigator.onLine) { setStatus('offline'); return; }
    const ops = state.queue.map(({ opId, tab, id, patch, prev, editedAt }) => ({ opId, tab, id, patch, prev, editedAt }));
    setStatus('syncing');
    try {
      const res = await request({ action: 'write', ops });
      await applyResults(res.results || []);
      state.lastError = '';
      setStatus('idle');
    } catch (e) {
      failStatus(e);
    } finally {
      flushing = null;
    }
  })();
  return flushing;
}

/** 起動時・画面復帰時・引っ張って更新：未送信を送ってから最新を読む */
export async function sync() {
  await flush();
  return pull();
}

async function applyResults(results) {
  const byOp = new Map(results.map((r) => [r.opId, r]));
  const idMap = {};
  const keep = [];

  for (const op of state.queue) {
    const r = byOp.get(op.opId);
    if (!r) { keep.push(op); continue; } // 送信後に積まれた変更
    if (r.status === 'created' || r.status === 'updated') {
      if (r.tmpId) idMap[r.tmpId] = r.id;
      upsertServer(op.tab, r.row);
      (r.conflicts || []).forEach((c) => {
        const name = describe(op.tab, r.row);
        notice(c.winner === 'sheet'
          ? `${name}の「${c.field}」はシートで先に変更されていたため、シートの値「${c.sheetValue}」を残しました（アプリの入力：「${c.appValue}」）`
          : `${name}の「${c.field}」をアプリの入力「${c.appValue}」で上書きしました（シートの値：「${c.sheetValue}」）`, 'warn');
      });
    } else if (r.status === 'missing') {
      notice(`${op.tab} ${op.id} はシートから消されていたため、変更を保存できませんでした`, 'warn');
    } else {
      op.attempts = (op.attempts || 0) + 1;
      op.lastError = r.message;
      const waitingParent = String(r.message || '').includes('参照先がまだ');
      if (!waitingParent && op.attempts >= 3) {
        state.failed.push(op);
        notice(`保存できなかった変更があります（${op.tab}：${r.message}）。設定画面で確認できます`, 'warn');
      } else {
        keep.push(op);
      }
    }
  }

  // 仮ID → 本ID の置き換え（残りの変更・画面の表示中ページ）
  if (Object.keys(idMap).length) {
    Object.assign(tmpMap, idMap);
    keep.forEach((op) => {
      if (idMap[op.id]) op.id = idMap[op.id];
      REF_FIELDS.forEach((k) => {
        if (op.patch[k] && idMap[op.patch[k]]) op.patch[k] = idMap[op.patch[k]];
      });
    });
    emit('idmap', idMap);
  }
  state.queue = keep;
  await db.set('queue', state.queue);
  await db.set('failed', state.failed);
  await db.set('server', state.server);
  recompute();
  emit('data');
}

function upsertServer(tab, row) {
  const f = idField(tab);
  const list = state.server[tab];
  const i = list.findIndex((r) => r[f] === row[f]);
  if (i >= 0) list[i] = row; else list.push(row);
}

function describe(tab, row) {
  if (tab === '営業先') return `「${row.施設名 || row.営業先ID}」`;
  if (tab === '案件') return `案件「${row.案件名 || row.案件ID}」`;
  if (tab === '担当者') return `担当者「${row.氏名 || row.担当者ID}」`;
  return `${tab} ${row[idField(tab)] || ''}`;
}

function setStatus(s) {
  state.status = isConfigured() ? s : 'unconfigured';
  emit('status');
}
function failStatus(e) {
  const code = e?.name === 'AbortError' ? 'AbortError' : (e?.message || String(e));
  state.lastError = errorMessage(code);
  setStatus(navigator.onLine ? 'error' : 'offline');
}

// ───────────── お知らせ ─────────────

export function notice(text, kind = 'info') {
  state.notices.unshift({ at: nowIso(), text, kind });
  state.notices = state.notices.slice(0, 50);
  db.set('notices', state.notices);
  toast(text, { kind, ms: kind === 'warn' ? 7000 : 3200 });
  emit('notice');
}

export async function clearNotices() {
  state.notices = [];
  await db.set('notices', []);
  emit('notice');
}

export async function discardFailed() {
  state.failed = [];
  await db.set('failed', []);
  emit('status');
}

export async function resetLocal() {
  await db.clearAll();
  location.reload();
}

// ───────────── 自動の読み書き ─────────────

window.addEventListener('online', () => sync());
window.addEventListener('offline', () => setStatus('offline'));
document.addEventListener('visibilitychange', () => {
  if (document.visibilityState === 'visible' && state.loaded) sync();
});
