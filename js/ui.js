// 画面部品（線画アイコン・バッジ・下から出るパネル・確認ダイアログ）

import { esc } from './util.js';
import { stageCode, stageName, 段階色, 段階文字色 } from './schema.js';

const P = {
  today: '<path d="M4 7h16M4 7v12a1 1 0 0 0 1 1h14a1 1 0 0 0 1-1V7M4 7V5a1 1 0 0 1 1-1h14a1 1 0 0 1 1 1v2M8 2v4M16 2v4"/><path d="M8.5 13.5l2.5 2.5 4.5-5"/>',
  phone: '<path d="M5 3h3.5l1.5 4.5-2 1.5a11 11 0 0 0 7 7l1.5-2 4.5 1.5V19a2 2 0 0 1-2 2A17 17 0 0 1 3 5a2 2 0 0 1 2-2z"/>',
  plus: '<path d="M12 5v14M5 12h14"/>',
  deal: '<rect x="3" y="7" width="18" height="13" rx="2"/><path d="M8 7V5a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2M3 13h18"/>',
  chart: '<path d="M4 20V10M10 20V4M16 20v-7M22 20H2"/>',
  search: '<circle cx="11" cy="11" r="7"/><path d="M20 20l-3.5-3.5"/>',
  settings: '<circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z"/>',
  copy: '<rect x="9" y="9" width="12" height="12" rx="2"/><path d="M5 15H4a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1h10a1 1 0 0 1 1 1v1"/>',
  pin: '<path d="M12 21s-7-6.2-7-12a7 7 0 0 1 14 0c0 5.8-7 12-7 12z"/><circle cx="12" cy="9" r="2.5"/>',
  globe: '<circle cx="12" cy="12" r="9"/><path d="M3 12h18M12 3a14 14 0 0 1 0 18M12 3a14 14 0 0 0 0 18"/>',
  mail: '<rect x="3" y="5" width="18" height="14" rx="2"/><path d="M3 7l9 6 9-6"/>',
  visit: '<path d="M3 13l2-6a2 2 0 0 1 1.9-1.4h10.2A2 2 0 0 1 19 7l2 6v4a1 1 0 0 1-1 1h-1M3 13v4a1 1 0 0 0 1 1h1M3 13h18"/><circle cx="7.5" cy="17.5" r="1.8"/><circle cx="16.5" cy="17.5" r="1.8"/><path d="M9.3 17.5h5.4"/>',
  note: '<path d="M5 3h10l4 4v14H5z"/><path d="M15 3v4h4M8 12h8M8 16h6"/>',
  doc: '<path d="M6 3h8l5 5v13H6z"/><path d="M14 3v5h5"/>',
  user: '<circle cx="12" cy="8" r="4"/><path d="M4 21a8 8 0 0 1 16 0"/>',
  edit: '<path d="M4 20h4L19 9l-4-4L4 16z"/><path d="M14 6l4 4"/>',
  back: '<path d="M15 5l-7 7 7 7"/>',
  chevron: '<path d="M9 5l7 7-7 7"/>',
  refresh: '<path d="M20 11a8 8 0 0 0-14.6-4.5L4 8M4 4v4h4M4 13a8 8 0 0 0 14.6 4.5L20 16M20 20v-4h-4"/>',
  alert: '<path d="M12 3l10 18H2z"/><path d="M12 10v5M12 18v.5"/>',
  check: '<path d="M5 12.5l4.5 4.5L19 7"/>',
  close: '<path d="M6 6l12 12M18 6L6 18"/>',
  download: '<path d="M12 4v11M7 10l5 5 5-5M5 20h14"/>',
  cloud: '<path d="M7 18a5 5 0 0 1-.6-10A6 6 0 0 1 18 9a4.5 4.5 0 0 1-.5 9z"/>',
  cloudOff: '<path d="M3 3l18 18M8.5 6.3A6 6 0 0 1 18 9a4.5 4.5 0 0 1 2.4 8.1M17 18H7a5 5 0 0 1-1.5-9.8"/>',
  building: '<path d="M4 21V5a1 1 0 0 1 1-1h9a1 1 0 0 1 1 1v16M15 9h4a1 1 0 0 1 1 1v11M2 21h20M8 8h3M8 12h3M8 16h3"/>',
  calendar: '<rect x="3" y="5" width="18" height="16" rx="2"/><path d="M3 10h18M8 3v4M16 3v4"/>',
  list: '<path d="M9 6h11M9 12h11M9 18h11M4 6h.5M4 12h.5M4 18h.5"/>',
};

export function icon(name, size = 22, cls = '') {
  return `<svg class="ic ${cls}" width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${P[name] || ''}</svg>`;
}

export function kindIcon(種別) {
  return { 架電: 'phone', 訪問: 'visit', メール: 'mail' }[種別] || 'note';
}
/** 次の一手の文面から、何をするかのアイコンを推測 */
export function nextIcon(text) {
  const t = String(text || '');
  if (/訪問|伺|持参|現地/.test(t)) return 'visit';
  if (/メール|送付|送る|郵送/.test(t)) return 'mail';
  if (/契約/.test(t)) return 'doc';
  return 'phone';
}

export function rankBadge(r) {
  const v = r || 'C';
  return `<span class="rank rank-${esc(v)}" title="ランク${esc(v)}">${esc(v)}</span>`;
}

export function stageBadge(s) {
  const c = stageCode(s);
  if (!c) return '';
  return `<span class="stage" style="background:${段階色[c] || '#E3E6EB'};color:${段階文字色[c] || '#14171F'}">${esc(c)} ${esc(stageName(s))}</span>`;
}

export function chip(text, cls = '') {
  return `<span class="chip ${cls}">${esc(text)}</span>`;
}

export function empty(text) {
  return `<div class="empty">${esc(text)}</div>`;
}

// ───── 下から出るパネル（スマホ）／中央のダイアログ（PC） ─────

let openSheetEl = null;

export function openSheet(html, { onMount, title = '' } = {}) {
  closeSheet();
  const wrap = document.createElement('div');
  wrap.className = 'sheet-wrap';
  wrap.innerHTML = `
    <div class="sheet-backdrop" data-close></div>
    <div class="sheet" role="dialog" aria-modal="true" aria-label="${esc(title)}">
      <div class="sheet-grip"></div>
      ${title ? `<div class="sheet-head"><h2>${esc(title)}</h2><button class="icon-btn" data-close aria-label="閉じる">${icon('close')}</button></div>` : ''}
      <div class="sheet-body">${html}</div>
    </div>`;
  wrap.addEventListener('click', (e) => {
    if (e.target.closest('[data-close]')) closeSheet();
  });
  document.body.appendChild(wrap);
  document.body.classList.add('no-scroll');
  openSheetEl = wrap;
  requestAnimationFrame(() => wrap.classList.add('open'));
  onMount?.(wrap.querySelector('.sheet-body'));
  return wrap;
}

export function closeSheet() {
  if (!openSheetEl) return;
  const el = openSheetEl;
  openSheetEl = null;
  el.classList.remove('open');
  document.body.classList.remove('no-scroll');
  setTimeout(() => el.remove(), 220);
}

export function confirmDialog(message, { ok = 'はい', cancel = 'やめる', danger = false } = {}) {
  return new Promise((resolve) => {
    let done = false;
    const finish = (v) => { if (!done) { done = true; closeSheet(); resolve(v); } };
    const wrap = openSheet(`
      <p class="confirm-text">${esc(message).replace(/\n/g, '<br>')}</p>
      <div class="btn-row">
        <button class="btn btn-ghost" data-v="0">${esc(cancel)}</button>
        <button class="btn ${danger ? 'btn-danger' : 'btn-primary'}" data-v="1">${esc(ok)}</button>
      </div>`, {
      onMount(body) {
        body.addEventListener('click', (e) => {
          const b = e.target.closest('[data-v]');
          if (b) finish(b.dataset.v === '1');
        });
      },
    });
    wrap.querySelectorAll('[data-close]').forEach((el) => el.addEventListener('click', () => finish(false)));
  });
}

/** 選択式のボタン群（ラジオ）。name は form 内で一意に */
export function segmented(name, options, value, { cls = '' } = {}) {
  return `<div class="seg ${cls}" role="radiogroup">${options.map((o) => {
    const v = typeof o === 'string' ? o : o.value;
    const label = typeof o === 'string' ? o : o.label;
    return `<label class="seg-item"><input type="radio" name="${esc(name)}" value="${esc(v)}" ${v === value ? 'checked' : ''}><span>${esc(label)}</span></label>`;
  }).join('')}</div>`;
}

export function selectBox(name, options, value, { placeholder = '', required = false, id = '' } = {}) {
  return `<select name="${esc(name)}" ${id ? `id="${esc(id)}"` : ''} ${required ? 'required' : ''}>
    ${placeholder !== null ? `<option value="">${esc(placeholder || '選んでください')}</option>` : ''}
    ${options.map((o) => {
      const v = typeof o === 'string' ? o : o.value;
      const label = typeof o === 'string' ? o : o.label;
      return `<option value="${esc(v)}" ${v === value ? 'selected' : ''}>${esc(label)}</option>`;
    }).join('')}
  </select>`;
}

export function field(label, control, { hint = '', required = false, cls = '' } = {}) {
  return `<label class="field ${cls}"><span class="field-label">${esc(label)}${required ? '<em class="req">必須</em>' : ''}</span>${control}${hint ? `<span class="field-hint">${esc(hint)}</span>` : ''}</label>`;
}

/** フォームの値を {name: value} に（チェックボックスは 'TRUE'/'FALSE'） */
export function formValues(form) {
  const out = {};
  form.querySelectorAll('input[name], select[name], textarea[name]').forEach((el) => {
    if (el.type === 'radio') {
      if (el.checked) out[el.name] = el.value;
      else if (!(el.name in out)) out[el.name] = '';
    } else if (el.type === 'checkbox') {
      out[el.name] = el.checked ? 'TRUE' : 'FALSE';
    } else {
      out[el.name] = el.value.trim();
    }
  });
  return out;
}
