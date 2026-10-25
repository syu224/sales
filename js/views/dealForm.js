// 案件の作成・編集（前回の案件をコピー／途中の段階から開始できる）

import * as sync from '../sync.js';
import * as L from '../logic.js';
import { nav } from '../nav.js';
import { 利用目的, 案件段階, stageCode, splitOther, joinOther } from '../schema.js';
import { field, segmented, selectBox, formValues, icon } from '../ui.js';
import { esc, fmtPeriod, toast } from '../util.js';
import { logStage } from './deal.js';

const 旬 = ['', '上旬', '中旬', '下旬'];

export function render(id, q = {}) {
  const d = id ? L.deal(id) : null;
  if (id && !d) return { title: '案件', back: true, html: '<div class="page"><div class="empty">見つかりません</div></div>' };
  const sid = d ? d.営業先ID : q.s;
  const p = L.prospect(sid);
  if (!p) return { title: '案件を作成', back: true, html: '<div class="page"><div class="empty">営業先が見つかりません</div></div>' };
  const prevDeal = d ? null : L.dealsOf(p.営業先ID)[0];
  const html = `
    <div class="page">
      <a class="for-head card" href="#/p/${encodeURIComponent(p.営業先ID)}">
        <span class="for-label">${esc(L.segmentOf(p))}</span><b>${esc(p.施設名)}</b><span class="for-sub">${esc(p.業種 || '')}</span>
      </a>
      ${prevDeal ? `<button type="button" class="btn btn-ghost btn-wide" id="copy-prev">${icon('copy', 20)}前回の案件をコピー（${esc(prevDeal.案件名 || prevDeal.案件ID)}）</button>` : ''}
      <form class="form card" id="dform" novalidate>${fields(d || { 段階: '04 提案・見積作成' })}</form>
    </div>`;

  return {
    title: d ? '案件を編集' : '案件を作成', back: true, live: false, html, context: p,
    mount(root) {
      const form = root.querySelector('#dform');
      const bind = () => {
        form.addEventListener('change', (e) => {
          if (e.target.name === '利用目的') form.querySelector('#purpose-other').hidden = e.target.value !== 'その他';
          if (e.target.name === '段階') showStageFields(form);
        });
        form.querySelector('#auto-name').addEventListener('click', () => {
          const v = formValues(form);
          const period = v.時期月 ? fmtPeriod(`${v.時期月}${v.時期旬 ? ' ' + v.時期旬 : ''}`) : '';
          const scale = [v.部屋数 && `${v.部屋数}部屋`, v.入居人数 && `${v.入居人数}名`].filter(Boolean).join('');
          form.elements.案件名.value = [period && `${period}`, joinOther(v.利用目的, v.利用目的その他), scale].filter(Boolean).join(' ') || '';
        });
        form.querySelector('#cancel').addEventListener('click', () => nav.back(`p/${p.営業先ID}`));
        showStageFields(form);
      };
      bind();

      root.querySelector('#copy-prev')?.addEventListener('click', () => {
        const src = { ...prevDeal, 段階: '04 提案・見積作成', 見積書URL: '', 契約書送付日: '', 契約書返送予定日: '', 契約書URL: '', '失注・保留理由': '', 再アプローチ時期: '', '納品・入居時期': '' };
        form.innerHTML = fields(src);
        bind();
        toast('前回の案件の内容を入れました。時期と段階を確認してください');
      });

      form.addEventListener('submit', async (e) => {
        e.preventDefault();
        const v = formValues(form);
        const missing = [];
        if (!v.案件名) missing.push('案件名');
        if (!v.利用目的) missing.push('利用目的');
        if (missing.length) { toast(`${missing.join('・')}を入れてください`, { kind: 'warn' }); return; }
        const c = stageCode(v.段階);
        const patch = {
          案件名: v.案件名, 利用目的: joinOther(v.利用目的, v.利用目的その他),
          '納品・入居時期': v.時期月 ? `${v.時期月}${v.時期旬 ? ' ' + v.時期旬 : ''}` : '',
          部屋数: v.部屋数, 入居人数: v.入居人数, 段階: v.段階, 見積書URL: v.見積書URL,
          契約書送付日: v.契約書送付日 || '', 契約書返送予定日: v.契約書返送予定日 || '', 契約書URL: v.契約書URL || '',
          '失注・保留理由': c === '09' || c === '10' ? v['失注・保留理由'] : (d?.['失注・保留理由'] || ''),
          再アプローチ時期: c === '09' || c === '10' ? v.再アプローチ時期 : (d?.再アプローチ時期 || ''),
        };
        if (d) {
          await sync.save('案件', d.案件ID, patch);
          if (d.段階 !== v.段階) await logStage(p.営業先ID, d.案件ID, d.段階, v.段階);
          toast('保存しました');
          nav.back(`deal/${d.案件ID}`);
        } else {
          const did = await sync.save('案件', null, { ...patch, 営業先ID: p.営業先ID });
          await logStage(p.営業先ID, did, '', v.段階);
          toast('案件を作成しました');
          nav.go(`deal/${did}`, { replace: true });
        }
      });
    },
  };
}

function fields(d) {
  const purpose = splitOther(d.利用目的);
  const m = String(d['納品・入居時期'] || '').match(/^(\d{4}-\d{2})(?:\s*(上旬|中旬|下旬))?/);
  return `
    ${field('利用目的', segmented('利用目的', 利用目的, purpose.base, { cls: 'seg-wrap' }), { required: true })}
    <div class="field other-field" id="purpose-other" ${purpose.base === 'その他' ? '' : 'hidden'}>
      <input name="利用目的その他" value="${esc(purpose.other)}" placeholder="その他の利用目的">
    </div>
    <div class="grid2">
      ${field('納品・入居時期', `<input type="month" name="時期月" value="${esc(m ? m[1] : '')}">`)}
      ${field('旬', selectBox('時期旬', 旬.map((x) => ({ value: x, label: x || '（指定なし）' })), m?.[2] || '', { placeholder: null }))}
    </div>
    <div class="grid2">
      ${field('部屋数', `<input type="number" name="部屋数" min="0" inputmode="numeric" value="${esc(d.部屋数 || '')}">`)}
      ${field('入居人数', `<input type="number" name="入居人数" min="0" inputmode="numeric" value="${esc(d.入居人数 || '')}">`)}
    </div>
    ${field('案件名', `<div class="inline"><input name="案件名" value="${esc(d.案件名 || '')}" placeholder="例：11月中旬 特定技能 1部屋1名" autocomplete="off"><button type="button" class="btn btn-ghost btn-small" id="auto-name">自動</button></div>`, { required: true, hint: '「自動」で時期・利用目的・規模から名前を付けます' })}
    ${field('段階', selectBox('段階', 案件段階, d.段階 || '04 提案・見積作成', { placeholder: null }), { hint: '途中の段階から始めてもかまいません' })}
    ${field('見積書のURL（Googleドライブ）', `<input name="見積書URL" value="${esc(d.見積書URL || '')}" inputmode="url" placeholder="https://drive.google.com/...">`)}
    <div data-for="07" hidden>
      <div class="grid2">
        ${field('契約書の送付日', `<input type="date" name="契約書送付日" value="${esc(d.契約書送付日 || '')}">`)}
        ${field('返送予定日', `<input type="date" name="契約書返送予定日" value="${esc(d.契約書返送予定日 || '')}">`)}
      </div>
      ${field('契約書のURL', `<input name="契約書URL" value="${esc(d.契約書URL || '')}" inputmode="url" placeholder="https://drive.google.com/...">`)}
    </div>
    <div data-for="0910" hidden>
      ${field('失注・保留の理由', `<input name="失注・保留理由" value="${esc(d['失注・保留理由'] || '')}">`)}
      ${field('再アプローチ時期', `<input type="month" name="再アプローチ時期" value="${esc(d.再アプローチ時期 || '')}">`, { hint: 'この月になると架電リストに戻ります' })}
    </div>
    <div class="btn-row sticky-actions">
      <button type="button" class="btn btn-ghost" id="cancel">やめる</button>
      <button type="submit" class="btn btn-primary">保存</button>
    </div>`;
}

function showStageFields(form) {
  const c = stageCode(form.elements.段階.value);
  form.querySelector('[data-for="07"]').hidden = !(c === '07' || c === '08');
  form.querySelector('[data-for="0910"]').hidden = !(c === '09' || c === '10');
}
