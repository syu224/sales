// 「一覧」タブの中の切り替え（顧客｜活動｜進捗）と、一覧画面で使う小物

import { esc } from '../util.js';

const ITEMS = [
  { id: 'list/customers', label: '顧客' },
  { id: 'list/activities', label: '活動' },
  { id: 'progress', label: '進捗' },
];

export const LAST_KEY = 'rentic-list-last';

export function listTabs(active) {
  try { localStorage.setItem(LAST_KEY, active); } catch { /* 保存できなくても動く */ }
  return `<nav class="subtabs" aria-label="一覧の切り替え">${ITEMS.map((t) => `<a class="subtab ${t.id === active ? 'on' : ''}" href="#/${t.id}">${esc(t.label)}</a>`).join('')}</nav>`;
}

export function lastListTab() {
  try { return localStorage.getItem(LAST_KEY) || 'list/customers'; } catch { return 'list/customers'; }
}

/** 一覧の条件（端末に覚えておく） */
export function loadPrefs(key, defaults) {
  try { return { ...defaults, ...(JSON.parse(localStorage.getItem(key)) || {}) }; } catch { return { ...defaults }; }
}
export function savePrefs(key, v) {
  try { localStorage.setItem(key, JSON.stringify(v)); } catch { /* 保存できなくても動く */ }
}

/** 複数選べるチップ */
export function multiChips(name, options, selected) {
  return `<div class="chips">${options.map((o) => {
    const v = typeof o === 'string' ? o : o.value;
    const l = typeof o === 'string' ? o : o.label;
    const on = selected.includes(v);
    return `<button type="button" class="chip chip-btn ${on ? 'on' : ''}" data-multi="${esc(name)}" data-v="${esc(v)}" aria-pressed="${on}">${esc(l)}</button>`;
  }).join('')}</div>`;
}
