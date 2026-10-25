// 案件の詳細：段階の変更・契約書の期日・失注／保留の理由・活動

import * as sync from '../sync.js';
import * as L from '../logic.js';
import { 案件段階, 段階変更, stageCode, stageName, 段階色, 段階文字色 } from '../schema.js';
import { icon, stageBadge, chip, empty, openSheet, closeSheet, field, formValues, kindIcon } from '../ui.js';
import { esc, fmtDate, fmtDateTime, fmtPeriod, fmtMonth, safeUrl, localDateTime, todayStr, addDays, addMonths, monthStr, toast } from '../util.js';
import { contactLabel } from './prospect.js';

export function render(id) {
  const d = L.deal(id);
  if (!d) return { title: '案件', back: true, backTo: 'deals', live: true, html: '<div class="page"><div class="empty">この案件は見つかりません</div></div>' };
  const p = L.prospect(d.営業先ID);
  const acts = L.activitiesOfDeal(d.案件ID);
  const code = stageCode(d.段階);
  const enc = encodeURIComponent(d.案件ID);
  const est = safeUrl(d.見積書URL);
  const con = safeUrl(d.契約書URL);
  const overdue = code === '07' && d.契約書返送予定日 && d.契約書返送予定日 < todayStr();

  const html = `
    <div class="page">
      <section class="card">
        ${p ? `<a class="for-head" href="#/p/${encodeURIComponent(p.営業先ID)}"><span class="for-label">${esc(L.segmentOf(p))}</span><b>${esc(p.顧客名)}</b><span class="for-sub">${esc(p.業種 || '')}</span></a>` : `<div class="alert">${icon('alert', 18)}<div>営業先（${esc(d.営業先ID)}）が見つかりません</div></div>`}
        <h2 class="p-name">${esc(d.案件名 || '（案件名なし）')}</h2>
        <div class="p-badges">${stageBadge(d.段階)} ${d.利用目的 ? chip(d.利用目的) : ''}</div>
        <dl class="kv">
          <dt>納品・入居時期</dt><dd>${esc(fmtPeriod(d['納品・入居時期']) || '未定')}</dd>
          <dt>規模</dt><dd>${esc([d.部屋数 && `${d.部屋数}部屋`, d.入居人数 && `${d.入居人数}名`].filter(Boolean).join(' ・ ') || '未定')}</dd>
          ${code === '07' || d.契約書送付日 ? `<dt>契約書</dt><dd class="${overdue ? 'warn-text' : ''}">送付 ${esc(fmtDate(d.契約書送付日) || '未入力')} ／ 返送予定 ${esc(fmtDate(d.契約書返送予定日) || '未入力')}${overdue ? '（期限超過）' : ''}</dd>` : ''}
          ${code === '09' || code === '10' ? `<dt>${code === '09' ? '失注' : '保留'}の理由</dt><dd>${esc(d['失注・保留理由'] || '未入力')}</dd><dt>再アプローチ</dt><dd>${esc(fmtMonth(d.再アプローチ時期) || '未定')}</dd>` : ''}
        </dl>
        <ul class="info">
          ${est ? `<li><a href="${esc(est)}" target="_blank" rel="noopener">${icon('doc', 18)}<span>見積書</span></a></li>` : ''}
          ${con ? `<li><a href="${esc(con)}" target="_blank" rel="noopener">${icon('doc', 18)}<span>契約書</span></a></li>` : ''}
        </ul>
        <div class="btn-row">
          <a class="btn btn-primary" href="#/act/new?s=${encodeURIComponent(d.営業先ID)}&d=${enc}">${icon('edit', 20)}活動を記録</a>
          <a class="btn btn-ghost" href="#/deal/${enc}/edit">${icon('edit', 20)}編集</a>
        </div>
      </section>

      <section class="card">
        <h2 class="card-title">段階を変える</h2>
        <div class="stepper">
          ${案件段階.map((s) => {
            const c = stageCode(s);
            const on = c === code;
            return `<button class="step ${on ? 'on' : ''} step-${c}" data-stage="${esc(s)}" style="${on ? `background:${段階色[c]};color:${段階文字色[c]}` : `--dot:${段階色[c]}`}"><span class="step-c num">${c}</span><span class="step-n">${esc(stageName(s))}</span></button>`;
          }).join('')}
        </div>
      </section>

      <section class="card">
        <h2 class="card-title">この案件の活動 <span class="count num">${acts.length}</span></h2>
        ${acts.length ? `<ol class="timeline">${acts.map(actItem).join('')}</ol>` : empty('まだ記録はありません')}
      </section>
    </div>`;

  return {
    title: '案件', back: true, backTo: 'deals', live: true, html, context: p ? { ...p, 案件ID: d.案件ID } : null,
    mount(root) {
      root.querySelectorAll('[data-stage]').forEach((b) => b.addEventListener('click', () => {
        if (b.dataset.stage !== d.段階) askStage(d, b.dataset.stage);
      }));
    },
  };
}

function actItem(a) {
  const c = L.contact(a.担当者ID);
  if (a.結果 === 段階変更) {
    return `<li class="tl tl-sys"><span class="tl-dot"></span><div class="tl-body"><div class="tl-head"><span class="num">${esc(fmtDateTime(a.日時))}</span></div><div class="tl-memo">${esc(a.メモ)}</div></div></li>`;
  }
  return `<li class="tl">
    <span class="tl-dot">${icon(kindIcon(a.種別), 16)}</span>
    <div class="tl-body">
      <div class="tl-head"><span class="num">${esc(fmtDateTime(a.日時))}</span><b>${esc(a.種別)}</b>${a.結果 ? chip(a.結果) : ''}
        <a class="tl-edit" href="#/act/${encodeURIComponent(a.活動ID)}/edit" aria-label="記録を直す">${icon('edit', 16)}</a></div>
      ${c ? `<div class="tl-sub">${icon('user', 14)}${esc(contactLabel(c))}</div>` : ''}
      ${a.メモ ? `<div class="tl-memo">${esc(a.メモ)}</div>` : ''}
      ${a.次の一手 ? `<div class="tl-next">${icon('chevron', 14)}次：${esc(a.次の一手)}${a.次の予定日 ? `（${esc(fmtDate(a.次の予定日))}${a.次の予定時刻 ? ' ' + esc(a.次の予定時刻) : ''}）` : ''}</div>` : ''}
    </div>
  </li>`;
}

/** 段階を変える。07・09・10 のときは必要な項目を聞いてから */
export function askStage(d, stage) {
  const c = stageCode(stage);
  if (c === '07') {
    openSheet(`
      <form class="form" id="sf">
        ${field('契約書の送付日', `<input type="date" name="契約書送付日" value="${esc(d.契約書送付日 || todayStr())}">`)}
        ${field('返送予定日', `<input type="date" name="契約書返送予定日" value="${esc(d.契約書返送予定日 || addDays(todayStr(), 7))}">`, { hint: '過ぎると「今日」に期限超過として出ます' })}
        ${field('契約書のURL（Googleドライブ）', `<input name="契約書URL" value="${esc(d.契約書URL || '')}" inputmode="url" placeholder="https://drive.google.com/...">`)}
        <div class="btn-row"><button type="button" class="btn btn-ghost" data-close>やめる</button><button class="btn btn-primary">07 にする</button></div>
      </form>`, { title: '07 内諾・契約手続き中', onMount: (b) => bindForm(b, d, stage) });
  } else if (c === '09' || c === '10') {
    openSheet(`
      <form class="form" id="sf">
        ${field(c === '09' ? '失注の理由' : '保留の理由', `<input name="失注・保留理由" value="${esc(d['失注・保留理由'] || '')}" placeholder="例：他社に決定／入居時期が未定">`, { required: true })}
        ${field('再アプローチ時期', `<input type="month" name="再アプローチ時期" value="${esc(d.再アプローチ時期 || addMonths(todayStr(), c === '09' ? 6 : 1).slice(0, 7))}">`, { hint: 'この月になると架電リストに戻ります（4月・10月の入国時期など）' })}
        <div class="btn-row"><button type="button" class="btn btn-ghost" data-close>やめる</button><button class="btn btn-primary">${c} にする</button></div>
      </form>`, { title: stage, onMount: (b) => bindForm(b, d, stage) });
  } else {
    changeStage(d, stage, {});
  }
}

function bindForm(body, d, stage) {
  const form = body.querySelector('form');
  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const v = formValues(form);
    if ('失注・保留理由' in v && !v['失注・保留理由']) { toast('理由を入れてください', { kind: 'warn' }); return; }
    closeSheet();
    await changeStage(d, stage, v);
  });
}

export async function changeStage(d, stage, extra) {
  const from = d.段階;
  await sync.save('案件', d.案件ID, { 段階: stage, ...extra });
  await logStage(d.営業先ID, d.案件ID, from, stage);
  toast(`段階を「${stage}」にしました`);
}

/** 段階の変化を活動履歴に残す（受注月の集計・月次報告に使う） */
export function logStage(sid, did, from, to) {
  return sync.save('活動履歴', null, {
    日時: localDateTime(), 営業先ID: sid, 案件ID: did, 種別: 'その他', 結果: 段階変更,
    メモ: from ? `段階：${from} → ${to}` : `案件を作成：→ ${to}`,
  });
}
