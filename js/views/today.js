// 「今日」画面：期限超過・今日やること・訪問予定・契約書の返送待ち

import { state } from '../sync.js';
import * as L from '../logic.js';
import { icon, nextIcon, kindIcon, rankBadge, stageBadge, empty } from '../ui.js';
import { esc, todayStr, fmtDate, fmtTime, fmtDateTime, daysBetween, weekRange, monthStr } from '../util.js';
import { stageCode, 段階色 } from '../schema.js';

export function render() {
  const today = todayStr();
  const todos = L.todayTodos();
  const overdue = todos.filter((t) => t.overdue);
  const dueToday = todos.filter((t) => !t.overdue);
  const visitsToday = L.visits(today, today);
  const [wFrom, wTo] = weekRange();
  const visitsWeek = L.visits(today, wTo).filter((v) => v.act.訪問予定日時.slice(0, 10) > today);
  const contracts = L.contractWaiting();
  const orphans = L.orphans();
  const orphanCount = orphans.活動履歴.length + orphans.案件.length + orphans.担当者.length;
  const noPhone = L.needsPhone();
  const sum = L.monthSummary();
  const d = new Date();

  const html = `
    <div class="page">
      <p class="page-date">${d.getMonth() + 1}月${d.getDate()}日（${'日月火水木金土'[d.getDay()]}）</p>
      ${alerts({ orphanCount, noPhone })}
      <div class="stats">
        ${stat('期限超過', overdue.length, '#todo', overdue.length ? 'warn' : '')}
        ${stat('今日やること', dueToday.length, '#todo', '')}
        ${stat('今日の訪問予定', visitsToday.length, '#visits', '')}
        ${stat('契約書の返送待ち', contracts.length, '#contracts', contracts.some((c) => c.overdue) ? 'warn' : '')}
      </div>

      <section class="card" id="todo">
        <h2 class="card-title">やること</h2>
        ${todos.length ? `<ul class="rows">${todos.map(todoRow).join('')}</ul>` : empty('今日やることはありません')}
      </section>

      <section class="card" id="visits">
        <h2 class="card-title">訪問予定</h2>
        <h3 class="sub-title">今日</h3>
        ${visitsToday.length ? `<ul class="rows">${visitsToday.map((v) => visitRow(v, false)).join('')}</ul>` : empty('今日の訪問予定はありません')}
        ${visitsWeek.length ? `<h3 class="sub-title">今週のこのあと</h3><ul class="rows">${visitsWeek.map((v) => visitRow(v, true)).join('')}</ul>` : ''}
      </section>

      ${contracts.length ? `
      <section class="card" id="contracts">
        <h2 class="card-title">契約書の返送待ち</h2>
        <ul class="rows">${contracts.map(contractRow).join('')}</ul>
      </section>` : ''}

      <section class="card">
        <h2 class="card-title">今月の案件 <small>${esc(monthStr().replace('-', '年'))}月</small></h2>
        ${miniBar('新規開拓', sum.新規開拓, '新規開拓')}
        ${miniBar('既存アップセル', sum.既存アップセル, '既存アップセル')}
      </section>
    </div>`;

  return {
    title: '今日', tab: 'today', live: true, html,
    mount(root) {
      root.querySelectorAll('[data-scroll]').forEach((a) => a.addEventListener('click', (e) => {
        e.preventDefault();
        root.querySelector(a.dataset.scroll)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }));
    },
  };
}

function stat(label, n, target, cls) {
  return `<a class="stat ${cls}" href="${target}" data-scroll="${target}"><span class="stat-n num">${n}</span><span class="stat-l">${esc(label)}</span></a>`;
}

function alerts({ orphanCount, noPhone }) {
  const out = [];
  if (state.warnings.length) out.push(`<div class="alert">${icon('alert', 18)}<div><b>シートの見出しを確認してください</b><br>${state.warnings.map(esc).join('<br>')}</div></div>`);
  if (state.failed.length) out.push(`<a class="alert" href="#/settings">${icon('alert', 18)}<div><b>保存できなかった変更が ${state.failed.length}件あります</b><br>設定画面で内容を確認できます</div></a>`);
  if (orphanCount) out.push(`<a class="alert" href="#/settings">${icon('alert', 18)}<div><b>営業先が見つからない記録が ${orphanCount}件あります</b><br>シートで営業先の行が消された可能性があります。設定画面で確認できます</div></a>`);
  if (noPhone.length) out.push(`<a class="alert alert-soft" href="#/calls">${icon('phone', 18)}<div><b>電話番号が「要入力」の営業先が ${noPhone.length}件あります</b><br>架電リストの下に並んでいます</div></a>`);
  return out.join('');
}

function dueBadge(t) {
  if (t.overdue) return `<span class="badge badge-warn">${daysBetween(t.date, todayStr())}日超過</span>`;
  return `<span class="badge badge-today">本日${t.time ? ' ' + esc(t.time) : ''}</span>`;
}

function todoRow(t) {
  const p = t.prospect;
  const ic = t.kind === 'contract' ? 'doc' : nextIcon(t.text);
  const href = t.deal ? `#/deal/${encodeURIComponent(t.deal.案件ID)}` : `#/p/${encodeURIComponent(p.営業先ID)}`;
  const rec = `#/act/new?s=${encodeURIComponent(p.営業先ID)}${t.deal ? `&d=${encodeURIComponent(t.deal.案件ID)}` : ''}`;
  return `<li class="row ${t.overdue ? 'row-warn' : ''}">
    <a class="row-main" href="${href}">
      <span class="row-ic">${icon(ic, 20)}</span>
      <span class="row-body">
        <span class="row-title">${esc(p.顧客名)}</span>
        <span class="row-text">${t.deal ? `${icon('deal', 13)} ${esc(t.deal.案件名 || '案件')}<br>` : ''}${esc(t.text)}</span>
      </span>
      ${dueBadge(t)}
    </a>
    ${t.kind === 'contract' ? '' : `<a class="row-act" href="${rec}" aria-label="結果を記録">${icon('edit', 20)}</a>`}
  </li>`;
}

function visitRow(v, showDate) {
  const a = v.act;
  return `<li class="row">
    <a class="row-main" href="#/p/${encodeURIComponent(v.prospect.営業先ID)}">
      <span class="row-ic">${icon('visit', 20)}</span>
      <span class="row-body">
        <span class="row-title">${esc(v.prospect.顧客名)}</span>
        <span class="row-text">${esc([v.prospect.市区町村, v.prospect.番地].filter(Boolean).join(' '))}${a.次の一手 ? ` ・ ${esc(a.次の一手)}` : ''}</span>
      </span>
      <span class="badge badge-chip num">${showDate ? esc(fmtDate(a.訪問予定日時)) + ' ' : ''}${esc(fmtTime(a.訪問予定日時))}</span>
    </a>
  </li>`;
}

function contractRow(c) {
  return `<li class="row ${c.overdue ? 'row-warn' : ''}">
    <a class="row-main" href="#/deal/${encodeURIComponent(c.deal.案件ID)}">
      <span class="row-ic">${icon('doc', 20)}</span>
      <span class="row-body">
        <span class="row-title">${esc(c.prospect.顧客名)}</span>
        <span class="row-text">${icon('deal', 13)} ${esc(c.deal.案件名 || '案件')}<br>送付 ${esc(fmtDate(c.deal.契約書送付日) || '未入力')} ・ 返送予定 ${esc(fmtDate(c.deal.契約書返送予定日) || '未入力')}</span>
      </span>
      ${c.overdue ? `<span class="badge badge-warn">${daysBetween(c.date, todayStr())}日超過</span>` : c.today ? '<span class="badge badge-today">本日</span>' : ''}
    </a>
  </li>`;
}

function miniBar(label, s, seg) {
  const open = state.data.案件.filter((d) => L.isOpenDeal(d) && L.segmentOf(L.prospect(d.営業先ID)) === seg && L.prospect(d.営業先ID));
  const counts = ['04', '05', '06', '07'].map((c) => ({ c, n: open.filter((d) => stageCode(d.段階) === c).length }));
  const total = open.length || 1;
  return `<div class="mini">
    <div class="mini-head"><b>${esc(label)}</b><span>新規 <b class="num">${s.created}</b> ・ 受注 <b class="num">${s.won}</b> ・ 進行中 <b class="num">${s.open}</b></span></div>
    <a class="mini-bar" href="#/deals">${open.length ? counts.filter((x) => x.n).map((x) => `<span style="width:${(x.n / total) * 100}%;background:${段階色[x.c]}" title="${x.c}：${x.n}件"></span>`).join('') : '<span class="mini-empty"></span>'}</a>
  </div>`;
}
