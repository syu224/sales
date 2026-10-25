// 案件一覧：進行中（時期が近い順）／今月の受注／失注・保留

import { state } from '../sync.js';
import * as L from '../logic.js';
import { nav } from '../nav.js';
import { stageCode } from '../schema.js';
import { stageBadge, empty, segmented } from '../ui.js';
import { esc, fmtPeriod, fmtMonth, fmtDate, monthStr } from '../util.js';

const KEY = 'rentic-deal-seg';

export function render() {
  let seg = 'すべて';
  try { seg = localStorage.getItem(KEY) || 'すべて'; } catch { /* 既定値のまま */ }
  const month = monthStr();
  const all = state.data.案件
    .map((d) => ({ d, p: L.prospect(d.営業先ID) }))
    .filter(({ p }) => p && !L.isTrue(p.対象外) && (seg === 'すべて' || L.segmentOf(p) === seg));
  const byPeriod = (a, b) => String(a.d['納品・入居時期'] || '9999').localeCompare(String(b.d['納品・入居時期'] || '9999'));
  const open = all.filter(({ d }) => L.isOpenDeal(d)).sort(byPeriod);
  const won = all.filter(({ d }) => stageCode(d.段階) === '08' && L.wonMonth(d) === month);
  const wonOld = all.filter(({ d }) => stageCode(d.段階) === '08' && L.wonMonth(d) !== month);
  const paused = all.filter(({ d }) => ['09', '10'].includes(stageCode(d.段階)));
  const next = new Map(L.nextActions().filter((n) => n.deal).map((n) => [n.deal.案件ID, n]));

  const html = `
    <div class="page">
      <div class="seg-top">${segmented('seg', ['すべて', '新規開拓', '既存アップセル'], seg)}</div>
      <div class="list-head"><h2>進行中 <small>時期が近い順</small> <span class="count num">${open.length}</span></h2></div>
      ${open.length ? `<div class="card"><ul class="rows">${open.map((x) => row(x, next)).join('')}</ul></div>` : empty('進行中の案件はありません')}
      <div class="list-head"><h2>今月の受注 <span class="count num">${won.length}</span></h2></div>
      ${won.length ? `<div class="card"><ul class="rows">${won.map((x) => row(x, next)).join('')}</ul></div>` : empty('今月の受注はまだありません')}
      ${paused.length ? `<details class="fold"><summary>失注・保留 <span class="count num">${paused.length}</span></summary><div class="card"><ul class="rows">${paused.map((x) => row(x, next)).join('')}</ul></div></details>` : ''}
      ${wonOld.length ? `<details class="fold"><summary>過去の受注 <span class="count num">${wonOld.length}</span></summary><div class="card"><ul class="rows">${wonOld.map((x) => row(x, next)).join('')}</ul></div></details>` : ''}
    </div>`;

  return {
    title: '案件', tab: 'deals', live: true, html,
    mount(root) {
      root.querySelectorAll('input[name=seg]').forEach((r) => r.addEventListener('change', () => {
        try { localStorage.setItem(KEY, r.value); } catch { /* 保存できなくても動く */ }
        nav.refresh();
      }));
    },
  };
}

function row({ d, p }, next) {
  const n = next.get(d.案件ID);
  const c = stageCode(d.段階);
  const sub = c === '09' || c === '10'
    ? `${d['失注・保留理由'] || '理由未記入'}${d.再アプローチ時期 ? ` ・ 再アプローチ ${fmtMonth(d.再アプローチ時期)}` : ''}`
    : [d.利用目的, fmtPeriod(d['納品・入居時期']), [d.部屋数 && `${d.部屋数}部屋`, d.入居人数 && `${d.入居人数}名`].filter(Boolean).join('')].filter(Boolean).join(' ・ ');
  return `<li class="row ${n?.overdue ? 'row-warn' : ''}">
    <a class="row-main" href="#/deal/${encodeURIComponent(d.案件ID)}">
      <span class="row-body">
        <span class="row-title">${esc(p.施設名)} <small>／${esc(d.案件名 || '')}</small></span>
        <span class="row-text">${esc(sub)}</span>
        ${n ? `<span class="row-next ${n.overdue ? 'warn-text' : ''}">次：${esc(n.text)}（${esc(fmtDate(n.date))}）</span>` : ''}
      </span>
      ${stageBadge(d.段階)}
    </a>
  </li>`;
}
