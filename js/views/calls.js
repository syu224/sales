// 架電リスト：①再架電の期日が来た先 → ②未接触の先（ランク順）→ 要確認（番号なし・番号違い）

import * as L from '../logic.js';
import { nav } from '../nav.js';
import { 業種, ランク, つながった結果 } from '../schema.js';
import { state } from '../sync.js';
import { icon, rankBadge, chip, empty } from '../ui.js';
import { esc, fmtPhone, phoneDigits, copyText, toast, downloadCsv, todayStr, fmtDate, daysBetween } from '../util.js';

const KEY = 'rentic-call-filter';
function loadFilter() {
  try { return JSON.parse(localStorage.getItem(KEY)) || {}; } catch { return {}; }
}
function saveFilter(f) {
  try { localStorage.setItem(KEY, JSON.stringify(f)); } catch { /* 保存できなくても動く */ }
}

export function render() {
  const f = { area: '', ranks: [], kinds: [], ...loadFilter() };
  const { due, fresh, check } = L.callList(f);
  const areas = L.areas();
  const FRESH_MAX = 60;

  const today = todayStr();
  const todayCalls = state.data.活動履歴.filter((a) => a.種別 === '架電' && String(a.日時).slice(0, 10) === today);
  const reached = todayCalls.filter((a) => つながった結果.includes(a.結果)).length;
  const appo = todayCalls.filter((a) => a.結果 === 'アポ獲得').length;

  const html = `
    <div class="page">
      <div class="today-count">
        <span class="cnt"><span>今日の架電</span><b class="num">${todayCalls.length}</b><span>件</span></span>
        <span class="sep"></span><span class="cnt"><span>つながり</span><b class="num">${reached}</b></span>
        <span class="sep"></span><span class="cnt"><span>アポ</span><b class="num">${appo}</b></span>
      </div>
      <div class="filters">
        <div class="filter-line">
          <span class="filter-label">エリア</span>
          <select id="f-area" class="chip-select">
            <option value="">すべて</option>
            ${areas.map((a) => `<option value="${esc(a.name)}" ${a.name === f.area ? 'selected' : ''}>${esc(a.name)}（${a.n}）</option>`).join('')}
          </select>
        </div>
        <div class="filter-line">
          <span class="filter-label">ランク</span>
          <div class="chips">${ランク.map((r) => toggle('rank', r, f.ranks.includes(r))).join('')}</div>
        </div>
        <div class="filter-line">
          <span class="filter-label">業種</span>
          <div class="chips chips-scroll">${業種.map((k) => toggle('kind', k, f.kinds.includes(k))).join('')}</div>
        </div>
      </div>

      <div class="list-head">
        <h2>再架電の期日が来た先 <span class="count num">${due.length}</span></h2>
      </div>
      ${due.length ? due.map((d) => card(d.prospect, d)).join('') : empty('期日が来た先はありません')}

      <div class="list-head">
        <h2>未接触 <small>ランク順</small> <span class="count num">${fresh.length}</span></h2>
      </div>
      ${fresh.length ? fresh.slice(0, FRESH_MAX).map((p) => card(p)).join('') : empty('未接触の先はありません')}
      ${fresh.length > FRESH_MAX ? `<p class="more-note">ほか ${fresh.length - FRESH_MAX}件（エリアなどで絞り込むと表示されます）</p>` : ''}

      ${check.length ? `
      <div class="list-head"><h2>要確認 <small>電話番号なし・番号違い</small> <span class="count num">${check.length}</span></h2></div>
      ${check.map((p) => checkCard(p)).join('')}` : ''}

      <button class="btn btn-ghost btn-wide" id="csv">${icon('download', 20)}この一覧を CSV で保存</button>
    </div>`;

  return {
    title: '架電リスト', tab: 'calls', live: true, html,
    mount(root) {
      const update = (fn) => { const nf = { ...f, ranks: [...f.ranks], kinds: [...f.kinds] }; fn(nf); saveFilter(nf); nav.refresh(); };
      root.querySelector('#f-area').addEventListener('change', (e) => update((nf) => { nf.area = e.target.value; }));
      root.querySelectorAll('[data-toggle]').forEach((b) => b.addEventListener('click', () => {
        const [type, v] = b.dataset.toggle.split(':');
        update((nf) => {
          const k = type === 'rank' ? 'ranks' : 'kinds';
          nf[k] = nf[k].includes(v) ? nf[k].filter((x) => x !== v) : [...nf[k], v];
        });
      }));
      root.addEventListener('click', async (e) => {
        const c = e.target.closest('[data-copy]');
        if (c) {
          e.preventDefault();
          const ok = await copyText(c.dataset.copy);
          toast(ok ? `${c.dataset.copy} をコピーしました` : 'コピーできませんでした。番号を長押ししてください', { kind: ok ? 'info' : 'warn' });
        }
      });
      root.querySelector('#csv').addEventListener('click', () => exportCsv(due, fresh, check));
    },
  };
}

function toggle(type, v, on) {
  return `<button class="chip chip-btn ${on ? 'on' : ''}" data-toggle="${type}:${esc(v)}" aria-pressed="${on}">${esc(v)}</button>`;
}

function card(p, due) {
  const last = L.lastActivity(p.営業先ID);
  const digits = phoneDigits(p.電話番号);
  const id = encodeURIComponent(p.営業先ID);
  const dq = due?.deal ? `&d=${encodeURIComponent(due.deal.案件ID)}` : '';
  return `<article class="call-card">
    <a class="call-top" href="#/p/${id}">
      ${rankBadge(p.顧客ランク)}
      <span class="call-name">${esc(p.顧客名)}</span>
      ${p.確認状態 === '未確認' || !p.確認状態 ? '<span class="badge badge-chip">未確認</span>' : ''}
    </a>
    <div class="call-meta">${chip(p.業種 || '業種未設定')} <span>${esc(p.市区町村 || '')}</span></div>
    ${due ? `<div class="call-due ${due.overdue ? 'warn' : ''}">${icon('calendar', 16)}<span>${esc(due.reason === '再アプローチ' ? '再アプローチ時期' : fmtDate(due.date))}${due.overdue ? `（${daysBetween(due.date, todayStr())}日超過）` : ''}：${esc(due.text)}</span></div>` : ''}
    <div class="call-last">${last ? `前回 ${esc(fmtDate(last.日時))}：${esc(last.結果 || last.種別)}${last.メモ ? ` ・ ${esc(last.メモ.slice(0, 40))}` : ''}` : '前回の記録なし'}</div>
    <a class="call-phone num" href="tel:${esc(digits)}">${esc(fmtPhone(p.電話番号))}</a>
    <div class="call-btns">
      <button class="btn btn-ghost" data-copy="${esc(digits)}">${icon('copy', 20)}コピー</button>
      <a class="btn btn-ghost" href="tel:${esc(digits)}">${icon('phone', 20)}発信</a>
      <a class="btn btn-primary" href="#/act/new?s=${id}${dq}&type=${encodeURIComponent('架電')}">${icon('edit', 20)}結果を記録</a>
    </div>
  </article>`;
}

function checkCard(p) {
  return `<a class="call-card call-check" href="#/p/${encodeURIComponent(p.営業先ID)}/edit">
    <div class="call-top">${rankBadge(p.顧客ランク)}<span class="call-name">${esc(p.顧客名)}</span>
      <span class="badge badge-warn">${phoneDigits(p.電話番号) ? '番号違い' : '要入力'}</span></div>
    <div class="call-meta">${chip(p.業種 || '業種未設定')} <span>${esc(p.市区町村 || '')}</span></div>
    <div class="call-last">${phoneDigits(p.電話番号) ? `登録番号 ${esc(fmtPhone(p.電話番号))}（つながらなかった番号）` : '電話番号が未入力です'}・タップして編集</div>
  </a>`;
}

function exportCsv(due, fresh, check) {
  const head = ['区分', '営業先ID', '顧客名', '電話番号', 'ランク', '業種', '都道府県', '市区町村', '確認状態', '前回の日付', '前回の結果', '次の一手', '期日'];
  const row = (kind, p, d) => {
    const last = L.lastActivity(p.営業先ID);
    return [kind, p.営業先ID, p.顧客名, fmtPhone(p.電話番号), p.顧客ランク, p.業種, p.都道府県, p.市区町村, p.確認状態,
      last ? last.日時.slice(0, 10) : '', last ? last.結果 : '', d ? d.text : '', d ? d.date : ''];
  };
  const rows = [head,
    ...due.map((d) => row('再架電', d.prospect, d)),
    ...fresh.map((p) => row('未接触', p)),
    ...check.map((p) => row('要確認', p))];
  downloadCsv(`架電リスト_${todayStr()}.csv`, rows);
}
