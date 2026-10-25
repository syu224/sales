// 設定：Apps Script の URL と合言葉、同期の状態、お知らせ、困ったとき

import * as sync from '../sync.js';
import { state } from '../sync.js';
import * as L from '../logic.js';
import { nav } from '../nav.js';
import { field, icon, confirmDialog, empty } from '../ui.js';
import { esc, fmtDateTime, toast } from '../util.js';

export const APP_VERSION = '1.2.0';

export function render() {
  const first = !sync.isConfigured();
  const s = state.settings;
  const o = L.orphans();
  const orphanRows = [
    ...o.活動履歴.map((a) => `活動履歴 ${a.活動ID}（${a.日時?.slice(0, 10) || ''}・営業先ID ${a.営業先ID}）`),
    ...o.案件.map((d) => `案件 ${d.案件ID}「${d.案件名 || ''}」（営業先ID ${d.営業先ID}）`),
    ...o.担当者.map((c) => `担当者 ${c.担当者ID}「${c.氏名 || ''}」（営業先ID ${c.営業先ID}）`),
  ];

  const html = `
    <div class="page">
      ${first ? `<section class="card welcome">
        <h2 class="card-title">はじめに</h2>
        <p>PC で「初期設定手順書」の手順を終えると、<b>Apps Script の URL</b> と <b>合言葉</b> が手に入ります。下に入力して「接続を確認して保存」を押してください。</p>
        <p class="note">スマホ2台・PC それぞれで、最初に1回だけ入力します。</p>
      </section>` : ''}

      <section class="card">
        <h2 class="card-title">シートとの接続</h2>
        <form class="form" id="conn" novalidate>
          ${field('Apps Script の URL', `<input name="url" value="${esc(s.url)}" inputmode="url" autocomplete="off" placeholder="https://script.google.com/macros/s/…/exec">`, { hint: '末尾が /exec のもの' })}
          ${field('合言葉', `<input name="secret" value="${esc(s.secret)}" autocomplete="off" autocapitalize="characters" spellcheck="false" placeholder="例：ABCD-EFGH-JKMN">`, { hint: 'スプレッドシートのメニュー「営業管理アプリ → 合言葉を表示する」で確認できます' })}
          <button class="btn btn-primary btn-wide" type="submit">${icon('check', 20)}接続を確認して保存</button>
        </form>
        ${!first ? `<dl class="kv">
          <dt>状態</dt><dd>${esc(statusText())}</dd>
          <dt>最後の読み込み</dt><dd>${esc(state.lastPull ? fmtDateTime(state.lastPull) : 'まだ')}</dd>
          <dt>未送信の変更</dt><dd>${state.queue.length}件</dd>
        </dl>
        ${state.lastError ? `<div class="alert">${icon('alert', 18)}<div>${esc(state.lastError)}</div></div>` : ''}
        <button class="btn btn-ghost btn-wide" id="sync-now">${icon('refresh', 20)}今すぐシートと同期</button>` : ''}
      </section>

      ${state.failed.length ? `<section class="card">
        <h2 class="card-title">保存できなかった変更 <span class="count num">${state.failed.length}</span></h2>
        <ul class="plain">${state.failed.map((op) => `<li><b>${esc(op.tab)} ${esc(op.id)}</b>：${esc(op.lastError || '')}<br><small>${esc(Object.entries(op.patch).map(([k, v]) => `${k}=${v}`).join(' / ').slice(0, 200))}</small></li>`).join('')}</ul>
        <p class="note">内容を控えてから「破棄」してください。必要ならアプリで入れ直します。</p>
        <button class="btn btn-ghost btn-wide" id="discard">破棄する</button>
      </section>` : ''}

      ${orphanRows.length ? `<section class="card">
        <h2 class="card-title">営業先が見つからない記録 <span class="count num">${orphanRows.length}</span></h2>
        <p class="note">シートの「営業先」タブで行が消された可能性があります。営業先を元に戻すか、シートでこれらの行を削除してください。</p>
        <ul class="plain">${orphanRows.map((r) => `<li>${esc(r)}</li>`).join('')}</ul>
      </section>` : ''}

      ${!first ? `<section class="card">
        <div class="card-head"><h2 class="card-title">お知らせ</h2>${state.notices.length ? '<button class="btn btn-small btn-ghost" id="clear-notices">消す</button>' : ''}</div>
        ${state.notices.length ? `<ul class="plain">${state.notices.map((n) => `<li class="${n.kind === 'warn' ? 'warn-text' : ''}"><small>${esc(fmtDateTime(n.at))}</small><br>${esc(n.text)}</li>`).join('')}</ul>` : empty('お知らせはありません')}
      </section>

      <section class="card">
        <h2 class="card-title">困ったとき</h2>
        <p class="note">この端末に保存した控えを消して、シートから読み込み直します（シートのデータは消えません）。未送信の変更があると失われます。</p>
        <button class="btn btn-ghost btn-wide" id="reset">${icon('refresh', 20)}この端末の控えを消して読み直す</button>
        <p class="note">版 ${APP_VERSION}</p>
      </section>` : ''}
    </div>`;

  return {
    title: '設定', back: !first, tab: '', live: false, html,
    mount(root) {
      root.querySelector('#conn').addEventListener('submit', async (e) => {
        e.preventDefault();
        const f = e.target;
        const url = f.url.value.trim();
        const secret = f.secret.value.trim().toUpperCase();
        if (!/^https:\/\/script\.google\.com\/.+\/exec$/.test(url) || url.includes('…')) {
          toast('URL は https://script.google.com/ で始まり /exec で終わるものを入れてください', { kind: 'warn', ms: 6000 });
          return;
        }
        if (!secret) { toast('合言葉を入れてください', { kind: 'warn' }); return; }
        const btn = f.querySelector('button[type=submit]');
        btn.disabled = true;
        btn.textContent = '確認中…';
        try {
          await sync.ping({ url, secret });
          await sync.saveSettings({ url, secret });
          toast('つながりました。シートを読み込みます');
          await sync.sync();
          nav.go('today', { replace: true });
        } catch (err) {
          const code = err?.name === 'AbortError' ? 'AbortError' : err?.message;
          toast(sync.errorMessage(code), { kind: 'warn', ms: 7000 });
          btn.disabled = false;
          btn.innerHTML = `${icon('check', 20)}接続を確認して保存`;
        }
      });
      root.querySelector('#sync-now')?.addEventListener('click', async () => {
        const ok = await sync.sync();
        toast(ok ? '最新の内容を読み込みました' : (state.lastError || '同期できませんでした'), { kind: ok ? 'info' : 'warn' });
        nav.refresh();
      });
      root.querySelector('#discard')?.addEventListener('click', async () => {
        if (await confirmDialog('保存できなかった変更を破棄しますか？', { ok: '破棄する', danger: true })) {
          await sync.discardFailed();
          nav.refresh();
        }
      });
      root.querySelector('#clear-notices')?.addEventListener('click', async () => { await sync.clearNotices(); nav.refresh(); });
      root.querySelector('#reset')?.addEventListener('click', async () => {
        const msg = state.queue.length
          ? `未送信の変更が ${state.queue.length}件あります。消すと失われます。本当に消しますか？`
          : 'この端末の控えを消して、シートから読み込み直しますか？\n（URL と合言葉も入れ直しになります）';
        if (await confirmDialog(msg, { ok: '消して読み直す', danger: true })) sync.resetLocal();
      });
    },
  };
}

function statusText() {
  return {
    idle: state.queue.length ? '送信待ち' : 'シートと同じ内容です',
    syncing: '同期中…',
    offline: 'オフライン（電波が戻ると自動で送ります）',
    error: 'つながりません',
    unconfigured: '未設定',
  }[state.status] || state.status;
}
