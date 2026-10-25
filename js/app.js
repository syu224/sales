// アプリの骨組み：画面の切り替え（#/today など）、上部の見出し、下部のタブ、引っ張って更新

import * as sync from './sync.js';
import { state } from './sync.js';
import { icon, openSheet, closeSheet } from './ui.js';
import { esc, fmtDateTime } from './util.js';
import { pickProspect } from './views/pick.js';
import { nav } from './nav.js';

import * as today from './views/today.js';
import * as calls from './views/calls.js';
import * as deals from './views/deals.js';
import * as progress from './views/progress.js';
import * as search from './views/search.js';
import * as settings from './views/settings.js';
import * as prospectView from './views/prospect.js';
import * as prospectForm from './views/prospectForm.js';
import * as activityForm from './views/activityForm.js';
import * as dealView from './views/deal.js';
import * as dealForm from './views/dealForm.js';

const routes = [
  [/^today$/, () => today.render()],
  [/^calls$/, () => calls.render()],
  [/^deals$/, () => deals.render()],
  [/^progress$/, () => progress.render()],
  [/^search$/, () => search.render()],
  [/^settings$/, () => settings.render()],
  [/^p\/new$/, (m, q) => prospectForm.render(null, q)],
  [/^p\/([^/]+)\/edit$/, (m) => prospectForm.render(m[1])],
  [/^p\/([^/]+)$/, (m) => prospectView.render(m[1])],
  [/^act\/new$/, (m, q) => activityForm.render(null, q)],
  [/^act\/([^/]+)\/edit$/, (m) => activityForm.render(m[1])],
  [/^deal\/new$/, (m, q) => dealForm.render(null, q)],
  [/^deal\/([^/]+)\/edit$/, (m) => dealForm.render(m[1])],
  [/^deal\/([^/]+)$/, (m) => dealView.render(m[1])],
];

const TABS = [
  { id: 'today', label: '今日', icon: 'today' },
  { id: 'calls', label: '架電', icon: 'phone' },
  { id: 'add', label: '登録・記録', icon: 'plus' },
  { id: 'deals', label: '案件', icon: 'deal' },
  { id: 'progress', label: '進捗', icon: 'chart' },
];

let current = null; // { path, view }

function parseHash() {
  const raw = decodeURIComponent(location.hash.replace(/^#\/?/, '')) || 'today';
  const [path, qs] = raw.split('?');
  return { path, query: Object.fromEntries(new URLSearchParams(qs || '')) };
}

// アプリ内で何画面進んだか（戻るボタンでアプリの外に出てしまわないように）
let depth = -1;

export function go(path, { replace = false } = {}) {
  const h = `#/${path}`;
  if (replace) history.replaceState({ d: Math.max(depth, 0) }, '', h);
  else history.pushState(null, '', h);
  route();
}

export function back(fallback = 'today') {
  if (history.state?.d > 0) history.back();
  else go(fallback, { replace: true });
}

function route() {
  if (typeof history.state?.d !== 'number') history.replaceState({ d: depth + 1 }, '', location.hash || '#/today');
  depth = history.state.d;
  const { path, query } = parseHash();
  if (!sync.isConfigured() && path !== 'settings') {
    history.replaceState({ d: depth }, '', '#/settings');
    return route();
  }
  let view = null;
  for (const [re, fn] of routes) {
    const m = path.match(re);
    if (m) { view = fn(m, query); break; }
  }
  if (!view) { history.replaceState({ d: depth }, '', '#/today'); return route(); }
  const samePath = current?.path === path;
  current = { path, view };
  paint({ keepScroll: samePath });
}

function paint({ keepScroll = false } = {}) {
  const { view } = current;
  const main = document.getElementById('view');
  const y = window.scrollY;
  main.innerHTML = view.html;
  main.dataset.tab = view.tab || '';
  renderHeader();
  renderNav();
  view.mount?.(main);
  if (keepScroll) window.scrollTo(0, y); else window.scrollTo(0, 0);
}

/** データが変わったら、一覧系の画面だけ描き直す（入力中のフォームは消さない） */
function refreshLive() {
  if (!current || !current.view.live) return;
  const { path, query } = parseHash();
  for (const [re, fn] of routes) {
    const m = path.match(re);
    if (m) { current = { path, view: fn(m, query) }; break; }
  }
  paint({ keepScroll: true });
}

function statusPill() {
  const q = state.queue.length;
  const map = {
    syncing: ['sync', '同期中', 'refresh'],
    offline: ['off', q ? `未送信 ${q}件` : 'オフライン', 'cloudOff'],
    error: ['err', q ? `未送信 ${q}件` : 'つながりません', 'alert'],
    unconfigured: ['err', '未設定', 'alert'],
  };
  const [cls, label, ic] = map[state.status] || (q ? ['off', `未送信 ${q}件`, 'cloud'] : ['ok', '保存済み', 'check']);
  const tip = state.lastError || (state.lastPull ? `最終読み込み ${fmtDateTime(state.lastPull)}` : '');
  return `<button class="pill pill-${cls}" id="sync-pill" title="${esc(tip)}">${icon(ic, 16)}<span>${esc(label)}</span></button>`;
}

function renderHeader() {
  const v = current?.view || {};
  const hdr = document.getElementById('hdr');
  hdr.innerHTML = `
    <div class="hdr-in">
      ${v.back ? `<button class="icon-btn" id="hdr-back" aria-label="戻る">${icon('back')}</button>` : ''}
      <h1 class="hdr-title">${esc(v.title || '')}</h1>
      <div class="hdr-actions">
        ${statusPill()}
        <a class="icon-btn" href="#/search" aria-label="営業先を探す">${icon('search')}</a>
        <a class="icon-btn" href="#/settings" aria-label="設定">${icon('settings')}</a>
      </div>
    </div>`;
  hdr.querySelector('#hdr-back')?.addEventListener('click', () => back(v.backTo || 'today'));
  hdr.querySelector('#sync-pill').addEventListener('click', () => {
    if (state.status === 'error' || state.status === 'unconfigured') go('settings');
    else sync.sync();
  });
}

function renderNav() {
  const tab = current?.view?.tab;
  const nav = document.getElementById('nav');
  nav.innerHTML = TABS.map((t) => t.id === 'add'
    ? `<button class="nav-add" id="nav-add" aria-label="${t.label}">${icon('plus', 28)}</button>`
    : `<a class="nav-item ${tab === t.id ? 'on' : ''}" href="#/${t.id}">${icon(t.icon, 24)}<span>${t.label}</span></a>`).join('');
  nav.querySelector('#nav-add').addEventListener('click', openAddMenu);
}

function openAddMenu() {
  const ctx = current?.view?.context || {}; // 表示中の営業先・案件があれば、それを使う
  openSheet(`
    <div class="menu-list">
      <button class="menu-item" data-a="prospect">${icon('building')}<span><b>営業先を登録</b><small>新しい施設・会社を追加</small></span></button>
      <button class="menu-item" data-a="activity">${icon('note')}<span><b>活動を記録</b><small>${ctx.営業先ID ? esc(ctx.顧客名) + ' の架電・訪問など' : '架電・訪問・メールの結果'}</small></span></button>
      <button class="menu-item" data-a="deal">${icon('deal')}<span><b>案件を作成</b><small>${ctx.営業先ID ? esc(ctx.顧客名) + ' に新しい商談' : '営業先に新しい商談を追加'}</small></span></button>
    </div>`, {
    title: '登録・記録',
    onMount(body) {
      body.addEventListener('click', async (e) => {
        const a = e.target.closest('[data-a]')?.dataset.a;
        if (!a) return;
        closeSheet();
        if (a === 'prospect') return go('p/new');
        const sid = ctx.営業先ID || (await pickProspect(a === 'deal' ? '案件を作る営業先' : '記録する営業先'));
        if (!sid) return;
        const dq = ctx.案件ID && a === 'activity' ? `&d=${encodeURIComponent(ctx.案件ID)}` : '';
        go(a === 'deal' ? `deal/new?s=${encodeURIComponent(sid)}` : `act/new?s=${encodeURIComponent(sid)}${dq}`);
      });
    },
  });
}

// ───── 引っ張って更新（スマホ） ─────
function setupPullToRefresh() {
  const ind = document.getElementById('ptr');
  let startY = null;
  let dist = 0;
  window.addEventListener('touchstart', (e) => {
    if (window.scrollY <= 0 && !document.body.classList.contains('no-scroll')) startY = e.touches[0].clientY;
  }, { passive: true });
  window.addEventListener('touchmove', (e) => {
    if (startY === null) return;
    dist = e.touches[0].clientY - startY;
    if (dist > 0 && window.scrollY <= 0) {
      ind.style.transform = `translate(-50%, ${Math.min(dist, 90) - 50}px)`;
      ind.classList.toggle('ready', dist > 70);
    }
  }, { passive: true });
  window.addEventListener('touchend', async () => {
    if (startY === null) return;
    const ready = dist > 70;
    startY = null;
    dist = 0;
    if (ready) {
      ind.classList.add('spin');
      await sync.sync();
      ind.classList.remove('spin');
    }
    ind.classList.remove('ready');
    ind.style.transform = '';
  });
}

// ───── 起動 ─────
nav.go = go;
nav.back = back;
nav.refresh = () => { if (current) { current.view.live = true; refreshLive(); } };

async function start() {
  window.addEventListener('popstate', route);
  sync.subscribe((reason, detail) => {
    if (reason === 'status') renderHeader();
    if (reason === 'data') { renderHeader(); refreshLive(); }
    if (reason === 'idmap') {
      // 表示中のページが仮IDなら本IDに差し替える
      let h = location.hash;
      Object.entries(detail).forEach(([tmp, real]) => { h = h.split(tmp).join(real); });
      if (h !== location.hash) {
        history.replaceState({ d: depth }, '', h);
        if (current?.view.live) route(); // 入力中のフォームは描き直さない（保存時に本IDへ置き換わる）
      }
    }
  });
  await sync.init();
  route();
  setupPullToRefresh();
  if (sync.isConfigured()) sync.sync();

  if ('serviceWorker' in navigator && location.protocol === 'https:') {
    navigator.serviceWorker.register('./sw.js').catch((e) => console.warn('SW', e));
  }
}

start();
