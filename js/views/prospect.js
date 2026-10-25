// 営業先の詳細：基本情報・電話・地図／案件／担当者／活動履歴

import * as sync from '../sync.js';
import * as L from '../logic.js';
import { 段階変更 } from '../schema.js';
import { icon, rankBadge, stageBadge, chip, empty, kindIcon, openSheet, closeSheet, field, selectBox, formValues } from '../ui.js';
import { esc, fmtPhone, phoneDigits, copyText, toast, mapsUrl, safeUrl, fmtDate, fmtDateTime, fmtPeriod, normName, nameKey } from '../util.js';

export function render(id) {
  const p = L.prospect(id);
  if (!p) {
    return { title: '営業先', back: true, backTo: 'calls', live: true, html: `<div class="page">${empty('この営業先は見つかりません（シートで削除された可能性があります）')}</div>` };
  }
  const sid = p.営業先ID;
  const enc = encodeURIComponent(sid);
  const deals = L.dealsOf(sid);
  const contacts = L.contactsOf(sid);
  const acts = L.activitiesOf(sid);
  const digits = phoneDigits(p.電話番号);
  const address = [p.都道府県, p.市区町村, p.番地].filter(Boolean).join('');
  const web = safeUrl(p.WebサイトURL);
  const src = safeUrl(p.情報元URL);
  const excluded = L.isTrue(p.対象外);
  const siblings = p.系列
    ? sync.state.data.営業先.filter((x) => x.営業先ID !== sid && !x.統合先ID && normName(x.系列) === normName(p.系列))
      .sort((a, b) => nameKey(a).localeCompare(nameKey(b), 'ja'))
    : [];

  const html = `
    <div class="page">
      ${excluded ? `<div class="alert">${icon('alert', 18)}<div><b>営業対象外にしています</b>${p.対象外理由 ? `<br>理由：${esc(p.対象外理由)}` : ''}<br><button class="link-btn" id="restore">対象に戻す</button></div></div>` : ''}
      ${p.統合先ID ? `<div class="alert">${icon('alert', 18)}<div>この営業先は <a href="#/p/${encodeURIComponent(p.統合先ID)}">${esc(p.統合先ID)}</a> に統合されています</div></div>` : ''}
      <section class="card p-head">
        <div class="p-badges">${rankBadge(p.顧客ランク)} ${stageBadge(p.段階 || '01 未接触')} ${chip(p.業種 || '業種未設定')} ${chip(p.顧客区分 || '区分未設定')}
          ${p.確認状態 && p.確認状態 !== '確認済み' ? `<span class="badge ${p.確認状態 === '番号違い' ? 'badge-warn' : 'badge-chip'}">${esc(p.確認状態)}</span>` : ''}</div>
        <h2 class="p-name">${esc(p.顧客名)}</h2>
        ${p.系列 ? `<p class="p-corp">系列：${esc(p.系列)}</p>` : ''}
        ${digits
          ? `<a class="call-phone num" href="tel:${esc(digits)}">${esc(fmtPhone(p.電話番号))}</a>
             <div class="call-btns">
               <button class="btn btn-ghost" id="copy">${icon('copy', 20)}コピー</button>
               <a class="btn btn-ghost" href="tel:${esc(digits)}">${icon('phone', 20)}発信</a>
             </div>`
          : `<a class="alert alert-soft" href="#/p/${enc}/edit">${icon('phone', 18)}<div><b>電話番号が要入力です</b><br>タップして入力</div></a>`}
        <ul class="info">
          ${address ? `<li><a href="${esc(mapsUrl(p))}" target="_blank" rel="noopener">${icon('pin', 18)}<span>${esc(address)}</span></a></li>` : ''}
          ${web ? `<li><a href="${esc(web)}" target="_blank" rel="noopener">${icon('globe', 18)}<span>Webサイト</span></a></li>` : ''}
          ${src ? `<li><a href="${esc(src)}" target="_blank" rel="noopener">${icon('doc', 18)}<span>情報元</span></a></li>` : ''}
        </ul>
        ${p.メモ ? `<p class="p-memo">${esc(p.メモ)}</p>` : ''}
        <div class="btn-row">
          <a class="btn btn-primary" href="#/act/new?s=${enc}">${icon('edit', 20)}活動を記録</a>
          <a class="btn btn-ghost" href="#/deal/new?s=${enc}">${icon('deal', 20)}案件を作成</a>
        </div>
        <a class="link-btn" href="#/p/${enc}/edit">${icon('edit', 16)}営業先の情報を編集</a>
      </section>

      ${siblings.length ? `<section class="card">
        <h2 class="card-title">同じ系列の顧客 <span class="count num">${siblings.length}</span></h2>
        <ul class="rows">${siblings.map(siblingRow).join('')}</ul>
      </section>` : ''}

      <section class="card">
        <div class="card-head"><h2 class="card-title">案件 <span class="count num">${deals.length}</span></h2></div>
        ${deals.length ? `<ul class="rows">${deals.map(dealRow).join('')}</ul>` : empty('案件はまだありません')}
      </section>

      <section class="card">
        <div class="card-head"><h2 class="card-title">先方の担当者</h2><button class="btn btn-small btn-ghost" id="add-contact">${icon('plus', 18)}追加</button></div>
        ${contacts.length ? `<ul class="rows">${contacts.map(contactRow).join('')}</ul>` : empty('担当者はまだ登録されていません')}
      </section>

      <section class="card">
        <h2 class="card-title">活動履歴 <span class="count num">${acts.length}</span></h2>
        ${acts.length ? `<ol class="timeline">${acts.map(actItem).join('')}</ol>` : empty('まだ記録はありません')}
      </section>
    </div>`;

  return {
    title: p.顧客名, back: true, backTo: 'calls', tab: '', live: true, html, context: p,
    mount(root) {
      root.querySelector('#copy')?.addEventListener('click', async () => {
        const ok = await copyText(digits);
        toast(ok ? `${digits} をコピーしました` : 'コピーできませんでした', { kind: ok ? 'info' : 'warn' });
      });
      root.querySelector('#restore')?.addEventListener('click', () => {
        sync.save('営業先', sid, { 対象外: 'FALSE', 対象外理由: '' });
        toast('営業対象に戻しました');
      });
      root.querySelector('#add-contact').addEventListener('click', () => editContact(sid, null));
      root.querySelectorAll('[data-contact]').forEach((b) => b.addEventListener('click', () => editContact(sid, b.dataset.contact)));
    },
  };
}

function siblingRow(x) {
  const last = L.lastActivity(x.営業先ID);
  return `<li class="row ${L.isTrue(x.対象外) ? 'row-muted' : ''}">
    <a class="row-main" href="#/p/${encodeURIComponent(x.営業先ID)}">
      ${rankBadge(x.顧客ランク)}
      <span class="row-body">
        <span class="row-title">${esc(x.顧客名)}</span>
        <span class="row-text">${esc([x.業種, x.市区町村, last ? `前回 ${fmtDate(last.日時)} ${last.結果 || last.種別}` : '記録なし'].filter(Boolean).join(' ・ '))}</span>
      </span>
      ${stageBadge(x.段階 || '01 未接触')}
    </a>
  </li>`;
}

function dealRow(d) {
  return `<li class="row">
    <a class="row-main" href="#/deal/${encodeURIComponent(d.案件ID)}">
      <span class="row-body">
        <span class="row-title">${esc(d.案件名 || '（案件名なし）')}</span>
        <span class="row-text">${esc([d.利用目的, fmtPeriod(d['納品・入居時期']), d.部屋数 && `${d.部屋数}部屋`, d.入居人数 && `${d.入居人数}名`].filter(Boolean).join(' ・ '))}</span>
      </span>
      ${stageBadge(d.段階)}
    </a>
  </li>`;
}

function contactRow(c) {
  const gone = c.在籍 === '異動退職';
  return `<li class="row ${gone ? 'row-muted' : ''}">
    <button class="row-main" data-contact="${esc(c.担当者ID)}">
      <span class="row-ic">${icon('user', 20)}</span>
      <span class="row-body">
        <span class="row-title">${esc(c.氏名 || '（氏名なし）')} ${gone ? '<span class="badge badge-chip">異動・退職</span>' : ''}</span>
        <span class="row-text">${esc(c.部署 || '')}${c.メモ ? ` ・ ${esc(c.メモ)}` : ''}</span>
      </span>
      ${icon('edit', 18)}
    </button>
  </li>`;
}

export function contactLabel(c) {
  if (!c) return '';
  return [c.部署, c.氏名].filter(Boolean).join(' ') + (c.在籍 === '異動退職' ? '（異動・退職）' : '');
}

function actItem(a) {
  if (a.結果 === 段階変更) {
    return `<li class="tl tl-sys"><span class="tl-dot"></span><div class="tl-body"><div class="tl-head"><span>${esc(fmtDateTime(a.日時))}</span></div><div class="tl-memo">${esc(a.メモ)}</div></div></li>`;
  }
  const c = L.contact(a.担当者ID);
  const d = a.案件ID ? L.deal(a.案件ID) : null;
  return `<li class="tl">
    <span class="tl-dot">${icon(kindIcon(a.種別), 16)}</span>
    <div class="tl-body">
      <div class="tl-head"><span class="num">${esc(fmtDateTime(a.日時))}</span><b>${esc(a.種別)}</b>${a.結果 ? chip(a.結果) : ''}
        <a class="tl-edit" href="#/act/${encodeURIComponent(a.活動ID)}/edit" aria-label="記録を直す">${icon('edit', 16)}</a></div>
      ${c ? `<div class="tl-sub">${icon('user', 14)}${esc(contactLabel(c))}</div>` : ''}
      ${d ? `<div class="tl-sub">${icon('deal', 14)}${esc(d.案件名 || '案件')}</div>` : ''}
      ${a.メモ ? `<div class="tl-memo">${esc(a.メモ)}</div>` : ''}
      ${a.訪問予定日時 ? `<div class="tl-next">${icon('visit', 14)}訪問予定 ${esc(fmtDateTime(a.訪問予定日時))}</div>` : ''}
      ${a.次の一手 || a.次の予定日 ? `<div class="tl-next">${icon('chevron', 14)}次：${esc(a.次の一手 || '')}${a.次の予定日 ? `（${esc(fmtDate(a.次の予定日))}${a.次の予定時刻 ? ' ' + esc(a.次の予定時刻) : ''}）` : ''}</div>` : ''}
    </div>
  </li>`;
}

/** 担当者の追加・編集パネル。保存後に担当者IDを返す */
export function editContact(sid, cid) {
  const c = cid ? L.contact(cid) : {};
  return new Promise((resolve) => {
    openSheet(`
      <form class="form" id="contact-form">
        ${field('部署', `<input name="部署" value="${esc(c.部署 || '')}" placeholder="例：総務部、人事課" autocomplete="off">`)}
        ${field('氏名', `<input name="氏名" value="${esc(c.氏名 || '')}" placeholder="例：山田様" autocomplete="off">`, { required: true })}
        ${field('在籍', selectBox('在籍', ['在籍', '異動退職'], c.在籍 || '在籍', { placeholder: null }), { hint: '異動・退職したら「異動退職」に。履歴の相手名は残ります' })}
        ${field('メモ', `<input name="メモ" value="${esc(c.メモ || '')}" placeholder="役職・決裁権など">`)}
        <div class="btn-row"><button type="button" class="btn btn-ghost" data-close>やめる</button><button class="btn btn-primary" type="submit">保存</button></div>
      </form>`, {
      title: cid ? '担当者を編集' : '担当者を追加',
      onMount(body) {
        const form = body.querySelector('form');
        form.addEventListener('submit', async (e) => {
          e.preventDefault();
          const v = formValues(form);
          if (!v.氏名) { toast('氏名を入れてください', { kind: 'warn' }); return; }
          const id = await sync.save('担当者', cid, cid ? v : { ...v, 営業先ID: sid });
          closeSheet();
          toast('担当者を保存しました');
          resolve(id);
        });
        setTimeout(() => form.querySelector(cid ? 'input[name=部署]' : 'input[name=部署]').focus(), 250);
      },
    });
  });
}
