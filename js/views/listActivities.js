// 活動一覧：期間・種別・結果・新規／既存で絞り込み、言葉で検索、CSV 保存（月次報告の材料）

import { state } from '../sync.js';
import * as L from '../logic.js';
import { 活動種別, 活動結果, 段階変更 } from '../schema.js';
import { icon, chip, empty, kindIcon, segmented } from '../ui.js';
import { esc, fmtDate, fmtTime, todayStr, monthStr, weekRange, addMonths, normName, downloadCsv } from '../util.js';
import { contactLabel } from './prospect.js';
import { listTabs, loadPrefs, savePrefs, multiChips } from './listTabs.js';

const KEY = 'rentic-list-activities';
const DEFAULTS = { period: 'month', from: '', to: '', kinds: [], result: '', seg: 'すべて', q: '', sort: 'desc', showStage: false, open: false };
const PERIODS = [
  { value: 'today', label: '今日' }, { value: 'week', label: '今週' }, { value: 'month', label: '今月' },
  { value: 'lastmonth', label: '先月' }, { value: 'all', label: 'すべて' }, { value: 'custom', label: '期間指定' },
];
const MAX = 300;

function range(S) {
  const t = todayStr();
  if (S.period === 'today') return [t, t];
  if (S.period === 'week') return weekRange();
  if (S.period === 'month') return [`${monthStr()}-01`, `${monthStr()}-31`];
  if (S.period === 'lastmonth') { const m = addMonths(`${monthStr()}-01`, -1).slice(0, 7); return [`${m}-01`, `${m}-31`]; }
  if (S.period === 'custom') return [S.from || '0000', S.to || '9999'];
  return ['0000', '9999'];
}

function filtered(S) {
  const [from, to] = range(S);
  const q = normName(S.q);
  const rows = state.data.活動履歴.filter((a) => {
    const d = String(a.日時).slice(0, 10);
    if (d < from || d > to) return false;
    if (a.結果 === 段階変更) return S.showStage && !S.kinds.length && !S.result && matchSeg(a, S) && matchQ(a, q);
    if (S.kinds.length && !S.kinds.includes(a.種別)) return false;
    if (S.result && a.結果 !== S.result) return false;
    return matchSeg(a, S) && matchQ(a, q);
  });
  const key = (a) => `${a.日時}|${a.作成日時}`;
  rows.sort((x, y) => (S.sort === 'asc' ? key(x).localeCompare(key(y)) : key(y).localeCompare(key(x))));
  return rows;
}
function matchSeg(a, S) {
  if (S.seg === 'すべて') return true;
  const p = L.prospect(a.営業先ID);
  return p && L.segmentOf(p) === S.seg;
}
function matchQ(a, q) {
  if (!q) return true;
  const p = L.prospect(a.営業先ID);
  const d = a.案件ID ? L.deal(a.案件ID) : null;
  return [p?.顧客名, p?.よみがな, p?.系列, a.メモ, a.次の一手, d?.案件名].some((s) => normName(s).includes(q));
}

export function render() {
  const S = loadPrefs(KEY, DEFAULTS);
  const html = `
    <div class="page">
      ${listTabs('list/activities')}
      ${segmented('period', PERIODS, S.period, { cls: 'seg-wrap seg-period' })}
      <div class="grid2" id="custom" ${S.period === 'custom' ? '' : 'hidden'}>
        <input type="date" id="from" value="${esc(S.from)}" aria-label="開始日">
        <input type="date" id="to" value="${esc(S.to)}" aria-label="終了日">
      </div>
      <input type="search" id="q" class="search-input" placeholder="顧客名・メモの言葉で探す（例：特定技能）" value="${esc(S.q)}" autocomplete="off">
      <div class="list-tools">
        <button type="button" class="btn btn-ghost btn-small" id="toggle">${icon('list', 18)}絞り込み<span id="fcount"></span></button>
        <select id="sort" class="chip-select" aria-label="並べ替え">
          <option value="desc" ${S.sort === 'desc' ? 'selected' : ''}>新しい順</option>
          <option value="asc" ${S.sort === 'asc' ? 'selected' : ''}>古い順</option>
        </select>
      </div>
      <div class="filters" id="panel" ${S.open ? '' : 'hidden'}>
        <div class="filter-line"><span class="filter-label">種別</span>${multiChips('kinds', 活動種別, S.kinds)}</div>
        <div class="filter-line"><span class="filter-label">結果</span>
          <select id="f-result" class="chip-select"><option value="">すべて</option>${活動結果.map((r) => `<option ${r === S.result ? 'selected' : ''}>${esc(r)}</option>`).join('')}</select></div>
        <div class="filter-line"><span class="filter-label">区分</span>${segmented('seg', ['すべて', '新規開拓', '既存アップセル'], S.seg)}</div>
        <label class="check"><input type="checkbox" id="f-stage" ${S.showStage ? 'checked' : ''}><span>案件の段階の変更も表示</span></label>
      </div>
      <div id="summary"></div>
      <div id="results"></div>
      <button class="btn btn-ghost btn-wide" id="csv">${icon('download', 20)}この一覧を CSV で保存</button>
    </div>`;

  return {
    title: '一覧', tab: 'list', live: false, html,
    mount(root) {
      const $ = (s) => root.querySelector(s);
      const save = () => savePrefs(KEY, S);
      const draw = () => {
        const n = S.kinds.length + (S.result ? 1 : 0) + (S.seg !== 'すべて' ? 1 : 0) + (S.showStage ? 1 : 0);
        $('#fcount').textContent = n ? `（${n}）` : '';
        const rows = filtered(S);
        $('#summary').innerHTML = summary(rows);
        $('#results').innerHTML = results(rows);
      };
      draw();

      root.querySelectorAll('input[name=period]').forEach((r) => r.addEventListener('change', () => {
        S.period = r.value; $('#custom').hidden = S.period !== 'custom'; save(); draw();
      }));
      $('#from').addEventListener('change', (e) => { S.from = e.target.value; save(); draw(); });
      $('#to').addEventListener('change', (e) => { S.to = e.target.value; save(); draw(); });
      $('#q').addEventListener('input', (e) => { S.q = e.target.value; save(); draw(); });
      $('#sort').addEventListener('change', (e) => { S.sort = e.target.value; save(); draw(); });
      $('#toggle').addEventListener('click', () => { S.open = !S.open; $('#panel').hidden = !S.open; save(); });
      $('#panel').addEventListener('click', (e) => {
        const b = e.target.closest('[data-multi]');
        if (!b) return;
        const v = b.dataset.v;
        S.kinds = S.kinds.includes(v) ? S.kinds.filter((x) => x !== v) : [...S.kinds, v];
        b.classList.toggle('on');
        save(); draw();
      });
      $('#panel').addEventListener('change', (e) => {
        if (e.target.id === 'f-result') S.result = e.target.value;
        if (e.target.name === 'seg') S.seg = e.target.value;
        if (e.target.id === 'f-stage') S.showStage = e.target.checked;
        save(); draw();
      });
      $('#csv').addEventListener('click', () => exportCsv(filtered(S), S));
    },
    onData(root) {
      const S = loadPrefs(KEY, DEFAULTS);
      const rows = filtered(S);
      root.querySelector('#summary').innerHTML = summary(rows);
      root.querySelector('#results').innerHTML = results(rows);
    },
  };
}

function summary(rows) {
  const acts = rows.filter((a) => a.結果 !== 段階変更);
  const c = (f) => acts.filter(f).length;
  const items = [
    ['架電', c((a) => a.種別 === '架電')], ['訪問', c((a) => a.種別 === '訪問')], ['メール', c((a) => a.種別 === 'メール')],
    ['アポ', c((a) => a.結果 === 'アポ獲得')], ['見積依頼', c((a) => a.結果 === '見積依頼')],
  ];
  return `<div class="today-count"><span class="cnt"><span>全</span><b class="num">${acts.length}</b><span>件</span></span>${items.map(([l, n]) => `<span class="sep"></span><span class="cnt"><span>${l}</span><b class="num">${n}</b></span>`).join('')}</div>`;
}

function results(rows) {
  if (!rows.length) return empty('条件に合う記録はありません');
  let lastDay = '';
  const out = [];
  rows.slice(0, MAX).forEach((a) => {
    const day = String(a.日時).slice(0, 10);
    if (day !== lastDay) {
      if (lastDay) out.push('</ol></div>');
      out.push(`<h3 class="day-head">${esc(fmtDate(day))}</h3><div class="card"><ol class="timeline">`);
      lastDay = day;
    }
    out.push(item(a));
  });
  out.push('</ol></div>');
  return (rows.length > MAX ? `<p class="note">${rows.length}件のうち先頭の${MAX}件を表示（期間を絞ってください）</p>` : '') + out.join('');
}

function item(a) {
  const p = L.prospect(a.営業先ID);
  const d = a.案件ID ? L.deal(a.案件ID) : null;
  const name = p ? esc(p.顧客名) : `<span class="warn-text">営業先なし（${esc(a.営業先ID)}）</span>`;
  const href = p ? `#/p/${encodeURIComponent(p.営業先ID)}` : '#/settings';
  if (a.結果 === 段階変更) {
    return `<li class="tl tl-sys"><span class="tl-dot"></span><div class="tl-body"><div class="tl-head"><span class="num">${esc(fmtTime(a.日時))}</span><a href="${href}"><b>${name}</b></a></div><div class="tl-memo">${esc(a.メモ)}${d ? `（${esc(d.案件名 || '')}）` : ''}</div></div></li>`;
  }
  const c = L.contact(a.担当者ID);
  return `<li class="tl">
    <span class="tl-dot">${icon(kindIcon(a.種別), 16)}</span>
    <div class="tl-body">
      <div class="tl-head"><span class="num">${esc(fmtTime(a.日時))}</span><a href="${href}"><b>${name}</b></a>${a.結果 ? chip(a.結果) : ''}
        <a class="tl-edit" href="#/act/${encodeURIComponent(a.活動ID)}/edit" aria-label="記録を直す">${icon('edit', 16)}</a></div>
      ${c || d ? `<div class="tl-sub">${c ? `${icon('user', 14)}${esc(contactLabel(c))}` : ''}${d ? ` ${icon('deal', 14)}${esc(d.案件名 || '案件')}` : ''}</div>` : ''}
      ${a.メモ ? `<div class="tl-memo clamp3">${esc(a.メモ)}</div>` : ''}
      ${a.次の一手 ? `<div class="tl-next">${icon('chevron', 14)}次：${esc(a.次の一手)}${a.次の予定日 ? `（${esc(fmtDate(a.次の予定日))}）` : ''}</div>` : ''}
    </div>
  </li>`;
}

function exportCsv(rows, S) {
  const head = ['日時', '営業先ID', '顧客名', '系列', '区分', '業種', '市区町村', '種別', '結果', '先方担当者', '案件名', '利用目的', 'メモ', '次の一手', '次の予定日', '訪問予定日時'];
  const body = rows.map((a) => {
    const p = L.prospect(a.営業先ID) || {};
    const d = a.案件ID ? L.deal(a.案件ID) || {} : {};
    return [a.日時, a.営業先ID, p.顧客名, p.系列, p.顧客名 ? L.segmentOf(p) : '', p.業種, p.市区町村, a.種別, a.結果,
      contactLabel(L.contact(a.担当者ID)), d.案件名, d.利用目的, a.メモ, a.次の一手, a.次の予定日, a.訪問予定日時];
  });
  const [from, to] = range(S);
  const label = S.period === 'all' ? 'すべて' : `${from}_${to}`.replace(/-31$/, '末');
  downloadCsv(`活動一覧_${label}.csv`, [head, ...body]);
}
