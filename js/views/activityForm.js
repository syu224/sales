// 活動の記録（架電・訪問・メール）。最後に「次の一手」と「次の予定日」を必ず入れる。

import * as sync from '../sync.js';
import * as L from '../logic.js';
import { nav } from '../nav.js';
import { 活動種別, 活動結果, つながった結果, stageCode } from '../schema.js';
import { field, segmented, formValues, icon, confirmDialog } from '../ui.js';
import { esc, localDateTime, todayStr, addDays, addMonths, fmtDate, toast } from '../util.js';
import { editContact, contactLabel } from './prospect.js';

const QUICK_DAYS = [['今日', 0], ['明日', 1], ['3日後', 3], ['1週間後', 7], ['2週間後', 14], ['1か月後', 'm1'], ['3か月後', 'm3']];
// 'h1' = 今から1時間後、'13:00' = その時刻
const QUICK_TIMES = [['1時間後', 'h1'], ['2時間後', 'h2'], ['3時間後', 'h3'], ['13時', '13:00'], ['16時', '16:00']];
const QUICK_NEXT =['再架電', '訪問', '見積書を送る', '資料を送る', '契約書の確認'];

export function render(actId, q = {}) {
  const a = actId ? sync.get('活動履歴', sync.realId(actId)) : null;
  if (actId && !a) return { title: '活動', back: true, html: '<div class="page"><div class="empty">記録が見つかりません</div></div>' };
  const sid = a ? a.営業先ID : q.s;
  const p = L.prospect(sid);
  if (!p) return { title: '活動を記録', back: true, html: '<div class="page"><div class="empty">営業先が見つかりません</div></div>' };

  const v = a || {
    種別: 活動種別.includes(q.type) ? q.type : '架電',
    日時: localDateTime(),
    案件ID: q.d || '',
  };
  const deals = L.dealsOf(p.営業先ID);
  const openFirst = [...deals.filter(L.isOpenDeal), ...deals.filter((d) => !L.isOpenDeal(d))];

  const html = `
    <div class="page">
      <a class="for-head card" href="#/p/${encodeURIComponent(p.営業先ID)}">
        <span class="for-label">営業先</span><b>${esc(p.顧客名)}</b><span class="for-sub">${esc(p.市区町村 || '')}</span>
      </a>
      <form class="form card" id="aform" novalidate>
        ${field('種別', segmented('種別', 活動種別, v.種別))}
        ${field('日時', `<input type="datetime-local" name="日時" value="${esc(String(v.日時 || '').slice(0, 16))}">`)}
        ${field('結果', segmented('結果', 活動結果, v.結果 || '', { cls: 'seg-wrap' }), { required: true })}
        <div id="visit-box" ${v.結果 === 'アポ獲得' ? '' : 'hidden'}>
          ${field('訪問日時', `<input type="datetime-local" name="訪問予定日時" value="${esc(String(v.訪問予定日時 || '').slice(0, 16))}">`, { required: true, hint: '「今日」画面の訪問予定に出ます' })}
        </div>
        ${field('先方の担当者', `<div class="inline">
          <select name="担当者ID" id="contact-sel">${contactOptions(p.営業先ID, v.担当者ID)}</select>
          <button type="button" class="btn btn-ghost btn-small" id="new-contact">${icon('plus', 18)}新規</button></div>`)}
        ${deals.length ? field('案件', `<select name="案件ID">
            <option value="">案件に紐づけない（営業先全体の記録）</option>
            ${openFirst.map((d) => `<option value="${esc(d.案件ID)}" ${d.案件ID === v.案件ID ? 'selected' : ''}>${esc(d.案件名 || d.案件ID)}（${esc(d.段階)}）</option>`).join('')}
          </select>`, { hint: '案件ごとに「次の一手」を管理します' }) : ''}
        ${field('メモ', `<textarea name="メモ" rows="7" class="memo" placeholder="話した内容：&#10;先方の反応：&#10;次の一手：&#10;&#10;（キーボードのマイクで音声入力できます）">${esc(v.メモ || '')}</textarea>`, { hint: '利用目的・見込み時期・受注までの課題が分かれば書いておくと、月次報告に使えます' })}

        <div class="next-box">
          <h3>次の一手</h3>
          <div class="chips">${QUICK_NEXT.map((t) => `<button type="button" class="chip chip-btn" data-next="${esc(t)}">${esc(t)}</button>`).join('')}</div>
          ${field('次の一手', `<input name="次の一手" value="${esc(v.次の一手 || '')}" placeholder="例：見積書を送って反応を聞く" autocomplete="off">`, { required: true })}
          <div class="chips">${QUICK_DAYS.map(([l, n]) => `<button type="button" class="chip chip-btn" data-days="${n}">${l}</button>`).join('')}</div>
          ${field('次の予定日', `<input type="date" name="次の予定日" value="${esc(v.次の予定日 || '')}">`, { required: true, hint: 'この日に「今日やること」に出ます' })}
          <div class="chips">${QUICK_TIMES.map(([l, t]) => `<button type="button" class="chip chip-btn" data-time="${t}">${l}</button>`).join('')}</div>
          ${field('時刻（任意）', `<div class="inline"><input type="time" name="次の予定時刻" value="${esc(v.次の予定時刻 || '')}"><button type="button" class="btn btn-ghost btn-small" id="clear-time">消す</button></div>`, { hint: 'かけ直す時刻。その時刻になると架電リストの「今かける先」に移ります' })}
        </div>

        ${a ? '' : `<div id="auto-box" class="auto-box" hidden></div>`}

        <div class="btn-row sticky-actions">
          <button type="button" class="btn btn-ghost" id="cancel">やめる</button>
          <button type="submit" class="btn btn-primary">記録する</button>
        </div>
      </form>
    </div>`;

  return {
    title: a ? '記録を直す' : '活動を記録', back: true, live: false, html, context: p,
    mount(root) {
      const form = root.querySelector('#aform');
      const el = form.elements;

      const refreshAuto = () => {
        const box = root.querySelector('#auto-box');
        if (!box) return;
        const r = formValues(form).結果;
        const items = [];
        if (つながった結果.includes(r) && stageCode(p.段階 || '01') === '01') items.push(['stage', '営業先の段階を「02 初回接触」に進める']);
        if (つながった結果.includes(r) && p.確認状態 !== '確認済み') items.push(['ok', '電話番号を「確認済み」にする']);
        if (r === '番号違い' && p.確認状態 !== '番号違い') items.push(['bad', '電話番号を「番号違い」にする（架電リストの要確認に移ります）']);
        box.hidden = !items.length;
        box.innerHTML = items.map(([k, t]) => `<label class="check"><input type="checkbox" data-auto="${k}" checked><span>${esc(t)}</span></label>`).join('');
      };
      refreshAuto();

      form.addEventListener('change', (e) => {
        if (e.target.name === '結果') {
          const appo = e.target.value === 'アポ獲得';
          root.querySelector('#visit-box').hidden = !appo;
          if (appo && !el.次の一手.value) el.次の一手.value = '訪問';
          // 不在なら、たいてい同じ日にかけ直す
          if (e.target.value === '不在' && !a) {
            if (!el.次の一手.value) el.次の一手.value = '再架電';
            if (!el.次の予定日.value) el.次の予定日.value = todayStr();
          }
          refreshAuto();
        }
        if (e.target.name === '訪問予定日時' && e.target.value && !el.次の予定日.value) {
          el.次の予定日.value = e.target.value.slice(0, 10);
        }
      });
      form.addEventListener('click', (e) => {
        const n = e.target.closest('[data-next]');
        if (n) { el.次の一手.value = n.dataset.next; el.次の一手.focus(); }
        const d = e.target.closest('[data-days]');
        if (d) {
          const k = d.dataset.days;
          el.次の予定日.value = k.startsWith('m') ? addMonths(todayStr(), +k.slice(1)) : addDays(todayStr(), +k);
        }
        const t = e.target.closest('[data-time]');
        if (t) {
          const k = t.dataset.time;
          if (k.startsWith('h')) {
            const at = new Date(Date.now() + (+k.slice(1)) * 3600000);
            el.次の予定日.value = todayStr(at);
            el.次の予定時刻.value = `${String(at.getHours()).padStart(2, '0')}:${String(at.getMinutes()).padStart(2, '0')}`;
          } else {
            el.次の予定時刻.value = k;
            if (!el.次の予定日.value) el.次の予定日.value = todayStr();
          }
        }
        if (e.target.closest('#clear-time')) el.次の予定時刻.value = '';
      });
      root.querySelector('#new-contact').addEventListener('click', async () => {
        const id = await editContact(p.営業先ID, null);
        if (id) root.querySelector('#contact-sel').innerHTML = contactOptions(p.営業先ID, id);
      });
      root.querySelector('#cancel').addEventListener('click', () => nav.back(`p/${p.営業先ID}`));

      form.addEventListener('submit', async (e) => {
        e.preventDefault();
        const f = formValues(form);
        const missing = [];
        if (!f.結果) missing.push('結果');
        if (f.結果 === 'アポ獲得' && !f.訪問予定日時) missing.push('訪問日時');
        if (!f.次の一手) missing.push('次の一手');
        if (!f.次の予定日) missing.push('次の予定日');
        if (missing.length) { toast(`${missing.join('・')}を入れてください`, { kind: 'warn' }); return; }
        if (f.次の予定日 < todayStr() && !a) {
          const ok = await confirmDialog(`次の予定日が過去の日付（${fmtDate(f.次の予定日)}）です。このまま記録しますか？`, { ok: '記録する' });
          if (!ok) return;
        }
        const patch = {
          日時: f.日時 || localDateTime(), 営業先ID: p.営業先ID, 案件ID: f.案件ID || '', 種別: f.種別, 結果: f.結果,
          担当者ID: f.担当者ID || '', メモ: f.メモ, 次の一手: f.次の一手, 次の予定日: f.次の予定日, 次の予定時刻: f.次の予定時刻 || '',
          訪問予定日時: f.結果 === 'アポ獲得' ? f.訪問予定日時 : (a ? f.訪問予定日時 || '' : ''),
        };
        await sync.save('活動履歴', a?.活動ID || null, patch);

        const pp = {};
        root.querySelectorAll('[data-auto]').forEach((c) => {
          if (!c.checked) return;
          if (c.dataset.auto === 'stage') pp.段階 = '02 初回接触';
          if (c.dataset.auto === 'ok') pp.確認状態 = '確認済み';
          if (c.dataset.auto === 'bad') pp.確認状態 = '番号違い';
        });
        if (Object.keys(pp).length) await sync.save('営業先', p.営業先ID, pp);
        toast('記録しました');
        nav.back(`p/${p.営業先ID}`);
      });
    },
  };
}

function contactOptions(sid, selected) {
  const cs = L.contactsOf(sid).sort((x, y) => (x.在籍 === '異動退職') - (y.在籍 === '異動退職'));
  return `<option value="">（選ばない）</option>${cs.map((c) => `<option value="${esc(c.担当者ID)}" ${c.担当者ID === selected ? 'selected' : ''}>${esc(contactLabel(c))}</option>`).join('')}`;
}
