// 顧客一覧：検索・絞り込み・並べ替え

import { state } from '../sync.js';
import * as L from '../logic.js';
import { 業種, ランク, 営業先段階, 顧客区分, 段階変更, stageCode } from '../schema.js';
import { icon, rankBadge, stageBadge, empty } from '../ui.js';
import { esc, fmtDate, todayStr, nameKey, daysBetween } from '../util.js';
import { matchProspect } from './pick.js';
import { listTabs, loadPrefs, savePrefs, multiChips } from './listTabs.js';

const KEY = 'rentic-list-customers';
const DEFAULTS = { q: '', sort: 'last-desc', area: '', ranks: [], kinds: [], stages: [], segs: [], showEx: false, open: false };
const SORTS = [
  ['last-desc', '最後の活動が新しい順'],
  ['last-asc', '最後の活動が古い順（ご無沙汰の先が上）'],
  ['next-asc', '次の予定日が近い順'],
  ['created-desc', '登録が新しい順'],
  ['name', 'あいうえお順（よみがな）'],
  ['rank', 'ランク順'],
  ['area', 'エリア順'],
];
const MAX = 300;

export function render() {
  const S = loadPrefs(KEY, DEFAULTS);
  const html = `
    <div class="page">
      ${listTabs('list/customers')}
      <input type="search" id="q" class="search-input" placeholder="顧客名・よみがな・系列・電話番号・市区町村" value="${esc(S.q)}" autocomplete="off">
      <div class="list-tools">
        <button type="button" class="btn btn-ghost btn-small" id="toggle">${icon('list', 18)}絞り込み<span id="fcount"></span></button>
        <select id="sort" class="chip-select" aria-label="並べ替え">${SORTS.map(([v, l]) => `<option value="${v}" ${v === S.sort ? 'selected' : ''}>${esc(l)}</option>`).join('')}</select>
      </div>
      <div class="filters" id="panel" ${S.open ? '' : 'hidden'}></div>
      <div id="results"></div>
      <a class="btn btn-ghost btn-wide" href="#/p/new">${icon('plus', 20)}営業先を登録</a>
    </div>`;

  return {
    title: '一覧', tab: 'list', live: false, html,
    mount(root) {
      const $ = (s) => root.querySelector(s);
      const save = () => savePrefs(KEY, S);
      const drawPanel = () => {
        const areas = L.areas();
        $('#panel').innerHTML = `
          <div class="filter-line"><span class="filter-label">エリア</span>
            <select id="f-area" class="chip-select"><option value="">すべて</option>${areas.map((a) => `<option value="${esc(a.name)}" ${a.name === S.area ? 'selected' : ''}>${esc(a.name)}（${a.n}）</option>`).join('')}</select></div>
          <div class="filter-line"><span class="filter-label">ランク</span>${multiChips('ranks', ランク, S.ranks)}</div>
          <div class="filter-line"><span class="filter-label">業種</span>${multiChips('kinds', 業種, S.kinds)}</div>
          <div class="filter-line"><span class="filter-label">段階</span>${multiChips('stages', 営業先段階.map((s) => ({ value: s.slice(0, 2), label: s })), S.stages)}</div>
          <div class="filter-line"><span class="filter-label">区分</span>${multiChips('segs', 顧客区分, S.segs)}</div>
          <label class="check"><input type="checkbox" id="f-ex" ${S.showEx ? 'checked' : ''}><span>営業対象外も表示</span></label>
          <button type="button" class="link-btn" id="clear">条件をクリア</button>`;
      };
      const draw = () => {
        const n = (S.area ? 1 : 0) + S.ranks.length + S.kinds.length + S.stages.length + S.segs.length + (S.showEx ? 1 : 0);
        $('#fcount').textContent = n ? `（${n}）` : '';
        $('#results').innerHTML = results(S);
      };
      drawPanel();
      draw();

      $('#q').addEventListener('input', (e) => { S.q = e.target.value; save(); draw(); });
      $('#sort').addEventListener('change', (e) => { S.sort = e.target.value; save(); draw(); });
      $('#toggle').addEventListener('click', () => { S.open = !S.open; $('#panel').hidden = !S.open; save(); });
      $('#panel').addEventListener('click', (e) => {
        const b = e.target.closest('[data-multi]');
        if (b) {
          const k = b.dataset.multi;
          const v = b.dataset.v;
          S[k] = S[k].includes(v) ? S[k].filter((x) => x !== v) : [...S[k], v];
          b.classList.toggle('on');
          save(); draw();
        }
        if (e.target.closest('#clear')) {
          Object.assign(S, { area: '', ranks: [], kinds: [], stages: [], segs: [], showEx: false });
          save(); drawPanel(); draw();
        }
      });
      $('#panel').addEventListener('change', (e) => {
        if (e.target.id === 'f-area') S.area = e.target.value;
        if (e.target.id === 'f-ex') S.showEx = e.target.checked;
        save(); draw();
      });
    },
    onData(root) { root.querySelector('#results').innerHTML = results(loadPrefs(KEY, DEFAULTS)); },
  };
}

function ago(date, today) {
  const n = daysBetween(date, today);
  if (n <= 0) return '今日';
  if (n === 1) return '昨日';
  return n < 60 ? `${n}日前` : fmtDate(date);
}

function results(S) {
  // 最後の活動・次の予定日を一度に集計
  const last = new Map();
  state.data.活動履歴.forEach((a) => {
    if (a.結果 === 段階変更) return;
    const cur = last.get(a.営業先ID);
    if (!cur || `${a.日時}|${a.作成日時}` > `${cur.日時}|${cur.作成日時}`) last.set(a.営業先ID, a);
  });
  const next = new Map();
  L.nextActions().forEach((n) => {
    const id = n.prospect.営業先ID;
    if (!next.has(id) || n.date < next.get(id).date) next.set(id, n);
  });

  const rows = state.data.営業先.filter((p) => {
    if (p.統合先ID) return false;
    if (!S.showEx && L.isTrue(p.対象外)) return false;
    if (S.area && p.市区町村 !== S.area) return false;
    if (S.ranks.length && !S.ranks.includes(p.顧客ランク || 'C')) return false;
    if (S.kinds.length && !S.kinds.includes(String(p.業種 || '').startsWith('その他') ? 'その他' : p.業種)) return false;
    if (S.stages.length && !S.stages.includes(stageCode(p.段階 || '01'))) return false;
    if (S.segs.length && !S.segs.includes(p.顧客区分)) return false;
    return matchProspect(p, S.q);
  });

  const lastKey = (p) => last.get(p.営業先ID)?.日時 || '';
  const cmp = {
    'last-desc': (a, b) => lastKey(b).localeCompare(lastKey(a)),
    'last-asc': (a, b) => lastKey(a).localeCompare(lastKey(b)),
    'next-asc': (a, b) => (next.get(a.営業先ID)?.date || '9999').localeCompare(next.get(b.営業先ID)?.date || '9999'),
    'created-desc': (a, b) => String(b.登録日時).localeCompare(String(a.登録日時)),
    name: (a, b) => nameKey(a).localeCompare(nameKey(b), 'ja'),
    rank: (a, b) => (a.顧客ランク || 'C').localeCompare(b.顧客ランク || 'C'),
    area: (a, b) => `${a.都道府県}${a.市区町村}`.localeCompare(`${b.都道府県}${b.市区町村}`, 'ja'),
  }[S.sort] || (() => 0);
  rows.sort((a, b) => cmp(a, b) || nameKey(a).localeCompare(nameKey(b), 'ja'));

  if (!rows.length) return empty('条件に合う顧客はいません');
  const today = todayStr();
  return `<p class="note">${rows.length}件${rows.length > MAX ? `（先頭の${MAX}件を表示）` : ''}</p>
    <div class="card"><ul class="rows">${rows.slice(0, MAX).map((p) => {
      const a = last.get(p.営業先ID);
      const n = next.get(p.営業先ID);
      const ex = L.isTrue(p.対象外);
      return `<li class="row ${ex ? 'row-muted' : ''}">
        <a class="row-main" href="#/p/${encodeURIComponent(p.営業先ID)}">
          ${rankBadge(p.顧客ランク)}
          <span class="row-body">
            <span class="row-title">${esc(p.顧客名)}${ex ? ' <span class="badge badge-chip">対象外</span>' : ''}</span>
            <span class="row-text">${esc([p.業種, p.市区町村, p.系列 && `系列 ${p.系列}`].filter(Boolean).join(' ・ '))}</span>
            <span class="row-text">${a ? `前回 ${esc(ago(a.日時, today))} ${esc(a.結果 || a.種別)}` : '記録なし'}${n ? ` ・ <span class="${n.overdue ? 'warn-text' : ''}">次 ${esc(fmtDate(n.date))}</span>` : ''}</span>
          </span>
          ${stageBadge(p.段階 || '01 未接触')}
        </a>
      </li>`;
    }).join('')}</ul></div>`;
}
