// 営業先を探す（すべての営業先。対象外も表示できる）

import { state } from '../sync.js';
import * as L from '../logic.js';
import { matchProspect } from './pick.js';
import { rankBadge, stageBadge, chip, empty, icon } from '../ui.js';
import { esc, fmtPhone } from '../util.js';

let lastQuery = '';
let showExcluded = false;

export function render() {
  const html = `
    <div class="page">
      <input type="search" id="q" class="search-input" placeholder="顧客名・系列・電話番号・市区町村" value="${esc(lastQuery)}" autocomplete="off">
      <label class="check"><input type="checkbox" id="ex" ${showExcluded ? 'checked' : ''}><span>営業対象外も表示</span></label>
      <div id="results"></div>
      <a class="btn btn-ghost btn-wide" href="#/p/new">${icon('plus', 20)}営業先を登録</a>
    </div>`;
  return {
    // 入力中に描き直すと文字が消えるので、データ更新時の自動描き直しはしない
    title: '営業先を探す', tab: '', back: true, live: false, html,
    mount(root) {
      const q = root.querySelector('#q');
      const ex = root.querySelector('#ex');
      const out = root.querySelector('#results');
      const draw = () => {
        lastQuery = q.value;
        showExcluded = ex.checked;
        const rows = state.data.営業先
          .filter((p) => (showExcluded ? !p.統合先ID : L.isActive(p)) && matchProspect(p, q.value))
          .sort((a, b) => String(a.顧客名).localeCompare(String(b.顧客名), 'ja'));
        out.innerHTML = rows.length
          ? `<p class="note">${rows.length}件</p><div class="card"><ul class="rows">${rows.slice(0, 200).map(row).join('')}</ul></div>`
          : empty('見つかりません');
      };
      q.addEventListener('input', draw);
      ex.addEventListener('change', draw);
      draw();
      if (!lastQuery) setTimeout(() => q.focus(), 50);
    },
  };
}

function row(p) {
  const ex = L.isTrue(p.対象外);
  return `<li class="row ${ex ? 'row-muted' : ''}">
    <a class="row-main" href="#/p/${encodeURIComponent(p.営業先ID)}">
      ${rankBadge(p.顧客ランク)}
      <span class="row-body">
        <span class="row-title">${esc(p.顧客名)} ${ex ? '<span class="badge badge-chip">対象外</span>' : ''}</span>
        <span class="row-text">${esc([p.業種, p.市区町村, fmtPhone(p.電話番号) || '電話番号なし'].filter(Boolean).join(' ・ '))}</span>
      </span>
      ${stageBadge(p.段階 || '01 未接触')}
    </a>
  </li>`;
}
