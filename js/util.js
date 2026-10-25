// 共通の小道具（文字の安全な表示・日付・電話番号・通知・CSV）

export function esc(v) {
  return String(v ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

// ───── 日付（端末の時刻＝日本時間を前提） ─────
const p2 = (n) => String(n).padStart(2, '0');

export function todayStr(d = new Date()) {
  return `${d.getFullYear()}-${p2(d.getMonth() + 1)}-${p2(d.getDate())}`;
}
export function monthStr(d = new Date()) {
  return `${d.getFullYear()}-${p2(d.getMonth() + 1)}`;
}
export function addDays(dateStr, n) {
  const d = parseDate(dateStr) || new Date();
  d.setDate(d.getDate() + n);
  return todayStr(d);
}
export function addMonths(dateStr, n) {
  const d = parseDate(dateStr) || new Date();
  const day = d.getDate();
  d.setDate(1);
  d.setMonth(d.getMonth() + n);
  const last = new Date(d.getFullYear(), d.getMonth() + 1, 0).getDate();
  d.setDate(Math.min(day, last));
  return todayStr(d);
}
/** 'YYYY-MM-DD' / 'YYYY-MM-DDTHH:mm(:ss)(+09:00)' を Date に */
export function parseDate(s) {
  if (!s) return null;
  const m = String(s).match(/^(\d{4})-(\d{2})-(\d{2})(?:[T ](\d{2}):(\d{2})(?::(\d{2}))?)?/);
  if (!m) return null;
  return new Date(+m[1], +m[2] - 1, +m[3], +(m[4] || 0), +(m[5] || 0), +(m[6] || 0));
}
/** 現在時刻を '2026-10-25T14:30:00+09:00' 形式で */
export function nowIso(d = new Date()) {
  const off = -d.getTimezoneOffset();
  const sign = off >= 0 ? '+' : '-';
  const a = Math.abs(off);
  return `${todayStr(d)}T${p2(d.getHours())}:${p2(d.getMinutes())}:${p2(d.getSeconds())}${sign}${p2(Math.floor(a / 60))}:${p2(a % 60)}`;
}
/** datetime-local 入力欄用 'YYYY-MM-DDTHH:mm' */
export function localDateTime(d = new Date()) {
  return `${todayStr(d)}T${p2(d.getHours())}:${p2(d.getMinutes())}`;
}
const WD = ['日', '月', '火', '水', '木', '金', '土'];
export function fmtDate(s, { year = false } = {}) {
  const d = parseDate(s);
  if (!d) return s || '';
  const y = year || d.getFullYear() !== new Date().getFullYear() ? `${d.getFullYear()}/` : '';
  return `${y}${d.getMonth() + 1}/${d.getDate()}（${WD[d.getDay()]}）`;
}
export function fmtDateTime(s) {
  const d = parseDate(s);
  if (!d) return s || '';
  const hasTime = /T\d{2}:\d{2}/.test(String(s));
  return fmtDate(s) + (hasTime ? ` ${d.getHours()}:${p2(d.getMinutes())}` : '');
}
export function fmtTime(s) {
  const d = parseDate(s);
  return d ? `${d.getHours()}:${p2(d.getMinutes())}` : '';
}
export function daysBetween(a, b) {
  const da = parseDate(a), db = parseDate(b);
  if (!da || !db) return 0;
  return Math.round((new Date(db.getFullYear(), db.getMonth(), db.getDate()) - new Date(da.getFullYear(), da.getMonth(), da.getDate())) / 86400000);
}
/** 週の初め（月曜）〜終わり（日曜） */
export function weekRange(d = new Date()) {
  const s = new Date(d.getFullYear(), d.getMonth(), d.getDate());
  const diff = (s.getDay() + 6) % 7;
  s.setDate(s.getDate() - diff);
  const e = new Date(s);
  e.setDate(e.getDate() + 6);
  return [todayStr(s), todayStr(e)];
}
/** 納品・入居時期 '2026-11 中旬' を表示用に */
export function fmtPeriod(s) {
  const m = String(s || '').match(/^(\d{4})-(\d{2})(?:\s*(上旬|中旬|下旬))?/);
  if (!m) return s || '';
  const y = +m[1] !== new Date().getFullYear() ? `${m[1]}年` : '';
  return `${y}${+m[2]}月${m[3] || ''}`;
}
export function fmtMonth(s) {
  const m = String(s || '').match(/^(\d{4})-(\d{2})/);
  return m ? `${m[1]}年${+m[2]}月` : s || '';
}

// ───── 電話番号 ─────
export function phoneDigits(s) {
  return String(s || '').normalize('NFKC').replace(/[^\d]/g, '');
}
/** 表示用に区切る（市外局番の厳密な判定はせず、よくある形にそろえる） */
export function fmtPhone(s) {
  const d = phoneDigits(s);
  if (!d) return String(s || '');
  if (/^0[5789]0\d{8}$/.test(d)) return `${d.slice(0, 3)}-${d.slice(3, 7)}-${d.slice(7)}`;
  if (/^0120\d{6}$/.test(d)) return `${d.slice(0, 4)}-${d.slice(4, 7)}-${d.slice(7)}`;
  if (/^0[36]\d{8}$/.test(d)) return `${d.slice(0, 2)}-${d.slice(2, 6)}-${d.slice(6)}`;
  if (/^0\d{9}$/.test(d)) return `${d.slice(0, 3)}-${d.slice(3, 6)}-${d.slice(6)}`;
  return String(s);
}

// ───── 顧客名の似ている判定 ─────
const CORP_WORDS = /(株式会社|有限会社|合同会社|合資会社|医療法人(社団|財団)?|社会福祉法人|一般社団法人|公益社団法人|一般財団法人|公益財団法人|協同組合|事業協同組合|特定非営利活動法人|NPO法人|\(株\)|\(有\)|㈱|㈲)/g;
export function normName(s) {
  return String(s || '').normalize('NFKC').toLowerCase().replace(CORP_WORDS, '').replace(/[\s・\-ー()（）「」]/g, '');
}
function bigrams(s) {
  const out = new Set();
  for (let i = 0; i < s.length - 1; i++) out.add(s.slice(i, i + 2));
  return out;
}
export function similarName(a, b) {
  const x = normName(a), y = normName(b);
  if (!x || !y) return false;
  if (x === y) return true;
  if (x.length >= 3 && y.length >= 3 && (x.includes(y) || y.includes(x))) return true;
  const bx = bigrams(x), by = bigrams(y);
  if (!bx.size || !by.size) return false;
  let inter = 0;
  bx.forEach((g) => { if (by.has(g)) inter++; });
  return (2 * inter) / (bx.size + by.size) >= 0.7;
}

// ───── 通知（画面下の小さなお知らせ） ─────
export function toast(msg, { kind = 'info', ms = 3200 } = {}) {
  const host = document.getElementById('toasts');
  if (!host) return;
  const el = document.createElement('div');
  el.className = `toast toast-${kind}`;
  el.textContent = msg;
  host.appendChild(el);
  setTimeout(() => el.classList.add('out'), ms);
  setTimeout(() => el.remove(), ms + 400);
}

export async function copyText(text) {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    const ta = document.createElement('textarea');
    ta.value = text;
    ta.style.position = 'fixed';
    ta.style.opacity = '0';
    document.body.appendChild(ta);
    ta.select();
    let ok = false;
    try { ok = document.execCommand('copy'); } catch { ok = false; }
    ta.remove();
    return ok;
  }
}

// ───── CSV（Excel で文字化けしないよう BOM 付き） ─────
export function downloadCsv(filename, rows) {
  const cell = (v) => {
    const s = String(v ?? '');
    return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  const text = '﻿' + rows.map((r) => r.map(cell).join(',')).join('\r\n');
  const blob = new Blob([text], { type: 'text/csv;charset=utf-8' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 1000);
}

export function mapsUrl(p) {
  const q = [p.都道府県, p.市区町村, p.番地].filter(Boolean).join('') || p.顧客名;
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(q)}`;
}

export function safeUrl(u) {
  const s = String(u || '').trim();
  return /^https?:\/\//i.test(s) ? s : '';
}

export function uid() {
  if (crypto.randomUUID) return crypto.randomUUID();
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 10);
}
