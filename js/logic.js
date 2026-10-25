// 画面に出す集計（今日やること・架電リストなど）。データは sync.js の state.data から読むだけ。

import { state, realId } from './sync.js';
import { stageCode, 段階変更, ランク } from './schema.js';
import { todayStr, monthStr, phoneDigits } from './util.js';

export const isTrue = (v) => v === true || String(v).toUpperCase() === 'TRUE';
export const isActive = (p) => p && !isTrue(p.対象外) && !p.統合先ID;
export const isExisting = (p) => p?.顧客区分 === '既存顧客';
export const segmentOf = (p) => (isExisting(p) ? '既存アップセル' : '新規開拓');
export const isOpenDeal = (d) => ['04', '05', '06', '07'].includes(stageCode(d.段階));
export const isClosedDeal = (d) => ['08', '09', '10'].includes(stageCode(d.段階));

const actSort = (a) => `${a.日時 || ''}|${a.作成日時 || ''}`;
const desc = (x, y) => (actSort(x) < actSort(y) ? 1 : -1);

export const prospect = (id) => state.byId.営業先?.get(realId(id));
export const deal = (id) => state.byId.案件?.get(realId(id));
export const contact = (id) => state.byId.担当者?.get(realId(id));

export function activitiesOf(sid) {
  sid = realId(sid);
  return state.data.活動履歴.filter((a) => a.営業先ID === sid).sort(desc);
}
export function activitiesOfDeal(did) {
  did = realId(did);
  return state.data.活動履歴.filter((a) => a.案件ID === did).sort(desc);
}
export function dealsOf(sid) {
  sid = realId(sid);
  return state.data.案件.filter((d) => d.営業先ID === sid)
    .sort((a, b) => (`${a.作成日時 || '9'}` < `${b.作成日時 || '9'}` ? 1 : -1));
}
export function contactsOf(sid) {
  sid = realId(sid);
  return state.data.担当者.filter((c) => c.営業先ID === sid);
}

/** 営業先の最後の活動（段階変更の自動記録は除く） */
export function lastActivity(sid) {
  return activitiesOf(sid).find((a) => a.結果 !== 段階変更);
}

/**
 * 「次の一手」の一覧。案件に紐づく活動は案件ごと、紐づかない活動は営業先ごとに、
 * いちばん新しい記録の「次の一手」だけを有効とする。
 */
export function nextActions() {
  const latest = new Map();
  state.data.活動履歴.forEach((a) => {
    if (a.結果 === 段階変更) return;
    const key = a.案件ID ? `A:${a.案件ID}` : `S:${a.営業先ID}`;
    const cur = latest.get(key);
    if (!cur || actSort(a) > actSort(cur)) latest.set(key, a);
  });
  const today = todayStr();
  const out = [];
  latest.forEach((a, key) => {
    if (!a.次の予定日) return;
    const p = prospect(a.営業先ID);
    if (!isActive(p)) return;
    const d = a.案件ID ? deal(a.案件ID) : null;
    if (d && isClosedDeal(d)) return;
    out.push({
      kind: 'next', key, act: a, prospect: p, deal: d,
      date: a.次の予定日, time: a.次の予定時刻 || '', text: a.次の一手 || '（次の一手が未記入）',
      overdue: a.次の予定日 < today, today: a.次の予定日 === today,
    });
  });
  return out.sort(byDateTime);
}

/** 日付→時刻の順（時刻なしはその日の最後） */
export const byDateTime = (x, y) => `${x.date}|${x.time || '99'}`.localeCompare(`${y.date}|${y.time || '99'}`);

export function nowHM(d = new Date()) {
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
}

/** 架電の回数（今日・通算）と、最後の架電 */
export function callStats(sid) {
  const today = todayStr();
  const calls = state.data.活動履歴.filter((a) => a.営業先ID === sid && a.種別 === '架電').sort((x, y) => actSort(y).localeCompare(actSort(x)));
  return { today: calls.filter((a) => String(a.日時).slice(0, 10) === today).length, total: calls.length, last: calls[0] };
}

/** 契約書の返送待ち（07 の案件） */
export function contractWaiting() {
  const today = todayStr();
  return state.data.案件
    .filter((d) => stageCode(d.段階) === '07' && isActive(prospect(d.営業先ID)))
    .map((d) => ({
      kind: 'contract', deal: d, prospect: prospect(d.営業先ID),
      date: d.契約書返送予定日 || '',
      text: d.契約書返送予定日 ? '契約書の返送を確認' : '契約書の返送予定日が未入力',
      overdue: !!d.契約書返送予定日 && d.契約書返送予定日 < today,
      today: d.契約書返送予定日 === today,
    }))
    .sort((x, y) => ((x.date || '9') < (y.date || '9') ? -1 : 1));
}

/** 「今日」画面のやること（期限超過 → 本日） */
export function todayTodos() {
  const items = [
    ...nextActions().filter((n) => n.overdue || n.today),
    ...contractWaiting().filter((c) => c.overdue || c.today),
  ];
  return items.sort((x, y) => (x.overdue !== y.overdue ? (x.overdue ? -1 : 1) : byDateTime(x, y)));
}

/** 訪問予定（from〜to の日付範囲） */
export function visits(from, to) {
  return state.data.活動履歴
    .filter((a) => a.訪問予定日時 && a.訪問予定日時.slice(0, 10) >= from && a.訪問予定日時.slice(0, 10) <= to)
    .map((a) => ({ act: a, prospect: prospect(a.営業先ID), deal: a.案件ID ? deal(a.案件ID) : null }))
    .filter((v) => isActive(v.prospect))
    .sort((x, y) => (x.act.訪問予定日時 < y.act.訪問予定日時 ? -1 : 1));
}

/** 持ち主（営業先）がいない活動・案件・担当者（シートで行が消された場合） */
export function orphans() {
  const has = (id) => state.byId.営業先.has(id);
  return {
    活動履歴: state.data.活動履歴.filter((a) => a.営業先ID && !has(a.営業先ID)),
    案件: state.data.案件.filter((d) => d.営業先ID && !has(d.営業先ID)),
    担当者: state.data.担当者.filter((c) => c.営業先ID && !has(c.営業先ID)),
  };
}

export function needsPhone() {
  return state.data.営業先.filter((p) => isActive(p) && !phoneDigits(p.電話番号));
}

/** 電話番号が同じ営業先 */
export function samePhone(phone, exceptId) {
  const d = phoneDigits(phone);
  if (d.length < 6) return [];
  return state.data.営業先.filter((p) => p.営業先ID !== exceptId && phoneDigits(p.電話番号) === d);
}

const rankOrder = (r) => { const i = ランク.indexOf(r); return i < 0 ? 9 : i; };

/**
 * 架電リスト
 *  due      … 今かける先：次の予定日が今日以前（今日で時刻指定ありなら、その時刻を過ぎたもの）と、
 *              再アプローチ時期が来た失注・保留案件
 *  later    … 今日このあと：今日の予定で、指定時刻がまだ来ていない先
 *  fresh    … 未接触のテレアポ候補（ランク順）
 *  future   … 予定が明日以降の先
 *  check    … 電話番号が空・番号違い
 */
export function callList(f = {}) {
  const today = todayStr();
  const month = monthStr();
  const now = nowHM();
  const match = (p) => isActive(p)
    && (!f.area || p.市区町村 === f.area)
    && (!f.ranks?.length || f.ranks.includes(p.顧客ランク || 'C'))
    && (!f.kinds?.length || f.kinds.includes(String(p.業種 || '').startsWith('その他') ? 'その他' : p.業種));

  const nexts = nextActions();
  const scheduled = new Set(); // 先の予定が入っている営業先
  const due = [];
  const later = [];
  const future = [];
  const dueIds = new Set();
  nexts.forEach((n) => {
    if (!match(n.prospect)) return;
    const id = n.prospect.営業先ID;
    if (n.date <= today) {
      if (!n.deal && !dueIds.has(id)) {
        if (n.today && n.time && n.time > now) later.push({ ...n, reason: 'このあと' });
        else due.push({ ...n, reason: n.overdue ? '期限超過' : '本日' });
        dueIds.add(id);
      }
    } else {
      if (!n.deal && !scheduled.has(id)) future.push({ ...n, reason: '予定' });
      scheduled.add(id);
    }
  });
  const futureList = future.filter((n) => !dueIds.has(n.prospect.営業先ID));
  state.data.案件.forEach((d) => {
    const c = stageCode(d.段階);
    if ((c === '09' || c === '10') && d.再アプローチ時期 && d.再アプローチ時期.slice(0, 7) <= month) {
      const p = prospect(d.営業先ID);
      if (!match(p) || dueIds.has(p.営業先ID)) return;
      due.push({ kind: 'reapproach', prospect: p, deal: d, date: d.再アプローチ時期, text: `再アプローチ（${c === '09' ? '失注' : '保留'}：${d['失注・保留理由'] || '理由未記入'}）`, reason: '再アプローチ' });
      dueIds.add(p.営業先ID);
    }
  });

  const fresh = [];
  const check = [];
  state.data.営業先.forEach((p) => {
    if (!match(p)) return;
    if (!phoneDigits(p.電話番号) || p.確認状態 === '番号違い') { check.push(p); return; }
    if (dueIds.has(p.営業先ID) || scheduled.has(p.営業先ID)) return;
    // 未接触の欄はテレアポ候補だけ（区分が空の行はシート直貼りのテレアポ候補として扱う）
    if (stageCode(p.段階 || '01') === '01' && (p.顧客区分 || 'テレアポ候補') === 'テレアポ候補') fresh.push(p);
  });
  fresh.sort((a, b) => rankOrder(a.顧客ランク || 'C') - rankOrder(b.顧客ランク || 'C')
    || String(a.市区町村).localeCompare(String(b.市区町村), 'ja')
    || String(a.顧客名).localeCompare(String(b.顧客名), 'ja'));
  // 今かける先：期限超過 → 時刻が来た順 → 時刻なし
  due.sort((x, y) => (x.overdue !== y.overdue ? (x.overdue ? -1 : 1) : byDateTime(x, y)));
  later.sort(byDateTime);
  return { due, later, fresh, future: futureList, check };
}

export function areas() {
  const set = new Map();
  state.data.営業先.forEach((p) => {
    if (isActive(p) && p.市区町村) set.set(p.市区町村, (set.get(p.市区町村) || 0) + 1);
  });
  return [...set.entries()].sort((a, b) => b[1] - a[1]).map(([name, n]) => ({ name, n }));
}

/** 案件が受注（08）になった月：段階変更の記録から。なければ更新日時 */
export function wonMonth(d) {
  const log = activitiesOfDeal(d.案件ID).find((a) => a.結果 === 段階変更 && /→\s*08/.test(a.メモ));
  return (log?.日時 || d.更新日時 || '').slice(0, 7);
}

/** 案件の最後の動き（活動・段階変更・更新のいちばん新しい日） */
export function lastMove(d) {
  const a = activitiesOfDeal(d.案件ID)[0];
  const dates = [a?.日時, d.更新日時, d.作成日時].filter(Boolean).map((s) => s.slice(0, 10)).sort();
  return dates[dates.length - 1] || '';
}

export function monthSummary(month = monthStr()) {
  const seg = { 新規開拓: { created: 0, won: 0, open: 0 }, 既存アップセル: { created: 0, won: 0, open: 0 } };
  state.data.案件.forEach((d) => {
    const p = prospect(d.営業先ID);
    if (!p) return;
    const s = seg[segmentOf(p)];
    if (String(d.作成日時).slice(0, 7) === month) s.created++;
    if (stageCode(d.段階) === '08' && wonMonth(d) === month) s.won++;
    if (isOpenDeal(d)) s.open++;
  });
  return seg;
}
