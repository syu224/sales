// 営業先を選ぶパネル（活動の記録・案件の作成の前に使う）

import { state } from '../sync.js';
import { isActive } from '../logic.js';
import { openSheet, closeSheet, rankBadge } from '../ui.js';
import { esc, normName, phoneDigits } from '../util.js';

export function matchProspect(p, q) {
  if (!q) return true;
  const n = normName(q);
  const d = phoneDigits(q);
  return (n && (normName(p.施設名).includes(n) || normName(p.法人名).includes(n) || normName(p.市区町村).includes(n)))
    || (d.length >= 3 && phoneDigits(p.電話番号).includes(d));
}

export function pickProspect(title = '営業先を選ぶ') {
  return new Promise((resolve) => {
    let done = false;
    const finish = (v) => { if (!done) { done = true; closeSheet(); resolve(v); } };
    const list = (q) => {
      const rows = state.data.営業先.filter((p) => isActive(p) && matchProspect(p, q))
        .sort((a, b) => String(b.更新日時).localeCompare(String(a.更新日時)))
        .slice(0, 40);
      return rows.length
        ? rows.map((p) => `<button class="pick-row" data-id="${esc(p.営業先ID)}">${rankBadge(p.顧客ランク)}<span class="pick-name">${esc(p.施設名)}</span><span class="pick-sub">${esc(p.市区町村 || '')}</span></button>`).join('')
        : '<div class="empty">見つかりません</div>';
    };
    const wrap = openSheet(`
      <input type="search" class="search-input" placeholder="施設名・電話番号・市区町村で探す" autocomplete="off">
      <div class="pick-list">${list('')}</div>`, {
      title,
      onMount(body) {
        const input = body.querySelector('input');
        const out = body.querySelector('.pick-list');
        input.addEventListener('input', () => { out.innerHTML = list(input.value); });
        out.addEventListener('click', (e) => {
          const b = e.target.closest('[data-id]');
          if (b) finish(b.dataset.id);
        });
        setTimeout(() => input.focus(), 250);
      },
    });
    wrap.querySelectorAll('[data-close]').forEach((el) => el.addEventListener('click', () => finish(null)));
  });
}
