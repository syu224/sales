// 営業先の登録・編集（電話番号は必須。同じ番号・似た顧客名があれば注意を出す）

import * as sync from '../sync.js';
import { state } from '../sync.js';
import * as L from '../logic.js';
import { nav } from '../nav.js';
import { 業種, 業種補足, 顧客区分, ランク, ランク説明, 確認状態, 営業先段階, splitOther, joinOther } from '../schema.js';
import { field, selectBox, segmented, formValues, confirmDialog, icon } from '../ui.js';
import { esc, phoneDigits, fmtPhone, similarName, toast } from '../util.js';

export function render(id) {
  const p = id ? L.prospect(id) : null;
  if (id && !p) return { title: '営業先', back: true, html: '<div class="page"><div class="empty">見つかりません</div></div>' };
  const v = p || { 顧客ランク: 'C', 段階: '01 未接触', 確認状態: '未確認', 顧客区分: '見込み顧客' };
  const kind = splitOther(v.業種);

  const html = `
    <div class="page">
      <form class="form card" id="pform" novalidate>
        ${field('顧客名', `<input name="顧客名" value="${esc(v.顧客名 || '')}" required autocomplete="off" placeholder="例：○○病院">`, { required: true })}
        <div id="name-warn"></div>
        <button type="button" class="link-btn" id="show-keiretsu" ${v.系列 ? 'hidden' : ''}>${icon('plus', 16)}系列を入れる（系列がある場合）</button>
        <div id="keiretsu-box" ${v.系列 ? '' : 'hidden'}>
          ${field('系列', `<input name="系列" value="${esc(v.系列 || '')}" autocomplete="off" list="keiretsu-list" placeholder="例：○○会、△△ホールディングス">`, { hint: '同じ系列は同じ書き方で（候補から選べます）。社内の取引先との照合（ランクB）に使います' })}
          <datalist id="keiretsu-list">${[...new Set(state.data.営業先.map((x) => x.系列).filter(Boolean))].sort().map((k) => `<option value="${esc(k)}">`).join('')}</datalist>
        </div>
        ${field('電話番号', `<input name="電話番号" value="${esc(v.電話番号 || '')}" inputmode="tel" autocomplete="off" placeholder="例：0312345678（ハイフンなしでも可）">`, { required: true, hint: '重複チェックに使います' })}
        <div id="phone-warn"></div>
        ${field('業種', segmented('業種', 業種, kind.base, { cls: 'seg-wrap' }), { required: true, hint: `受入団体＝${業種補足.受入団体}` })}
        <div class="field other-field" id="kind-other" ${kind.base === 'その他' ? '' : 'hidden'}>
          <input name="業種その他" value="${esc(kind.other)}" placeholder="その他の業種（例：学校）">
        </div>
        <div class="grid2">
          ${field('顧客区分', selectBox('顧客区分', 顧客区分, v.顧客区分, { placeholder: null }))}
          ${field('段階', selectBox('段階', 営業先段階, v.段階 || '01 未接触', { placeholder: null }))}
        </div>
        ${field('顧客ランク', segmented('顧客ランク', ランク.map((r) => ({ value: r, label: `${r}：${ランク説明[r]}` })), v.顧客ランク || 'C', { cls: 'seg-col' }))}
        <div class="grid2">
          ${field('都道府県', `<input name="都道府県" value="${esc(v.都道府県 || '')}" autocomplete="off" placeholder="例：東京都">`)}
          ${field('市区町村', `<input name="市区町村" value="${esc(v.市区町村 || '')}" autocomplete="off" placeholder="例：新宿区" list="area-list">`, { hint: '架電リストのエリア絞り込みに使います' })}
        </div>
        <datalist id="area-list">${L.areas().map((a) => `<option value="${esc(a.name)}">`).join('')}</datalist>
        ${field('番地', `<input name="番地" value="${esc(v.番地 || '')}" autocomplete="off" placeholder="例：西新宿1-2-3 ○○ビル">`)}
        ${field('WebサイトURL', `<input name="WebサイトURL" value="${esc(v.WebサイトURL || '')}" inputmode="url" autocomplete="off" placeholder="https://">`)}
        ${field('情報元URL', `<input name="情報元URL" value="${esc(v.情報元URL || '')}" inputmode="url" autocomplete="off" placeholder="https://（調べた元のページ）">`)}
        ${field('電話番号の確認状態', segmented('確認状態', 確認状態, v.確認状態 || '未確認'))}
        ${field('メモ', `<textarea name="メモ" rows="3">${esc(v.メモ || '')}</textarea>`)}
        ${p ? `
        <fieldset class="exclude">
          <label class="check"><input type="checkbox" name="対象外" ${L.isTrue(v.対象外) ? 'checked' : ''}><span>営業対象外にする（一覧から隠します。あとで戻せます）</span></label>
          <div id="exclude-reason" ${L.isTrue(v.対象外) ? '' : 'hidden'}>${field('対象外の理由', `<input name="対象外理由" value="${esc(v.対象外理由 || '')}" placeholder="例：自社で家具家電を用意している">`)}</div>
        </fieldset>` : ''}
        <div class="btn-row sticky-actions">
          <button type="button" class="btn btn-ghost" id="cancel">やめる</button>
          <button type="submit" class="btn btn-primary">${p ? '保存' : '登録'}</button>
        </div>
      </form>
    </div>`;

  return {
    title: p ? '営業先を編集' : '営業先を登録', back: true, live: false, html,
    mount(root) {
      const form = root.querySelector('#pform');
      const exceptId = p?.営業先ID;
      const phoneInput = form.elements.電話番号;
      const nameInput = form.elements.顧客名;

      const checkPhone = () => {
        const dup = L.samePhone(phoneInput.value, exceptId);
        root.querySelector('#phone-warn').innerHTML = dup.length
          ? `<div class="alert">${icon('alert', 18)}<div><b>同じ電話番号の営業先があります</b><br>${dup.map((d) => `<a href="#/p/${encodeURIComponent(d.営業先ID)}">${esc(d.顧客名)}（${esc(d.市区町村 || '')}）</a>`).join('<br>')}</div></div>`
          : '';
        return dup;
      };
      const checkName = () => {
        const name = nameInput.value.trim();
        const sim = name.length < 2 ? [] : state.data.営業先.filter((x) => x.営業先ID !== exceptId && similarName(x.顧客名, name)).slice(0, 5);
        root.querySelector('#name-warn').innerHTML = sim.length
          ? `<div class="alert alert-soft">${icon('alert', 18)}<div><b>似た名前の営業先があります</b>（別の施設なら、そのまま登録できます）<br>${sim.map((d) => `<a href="#/p/${encodeURIComponent(d.営業先ID)}">${esc(d.顧客名)}</a> ${esc(fmtPhone(d.電話番号))}`).join('<br>')}</div></div>`
          : '';
      };
      root.querySelector('#show-keiretsu').addEventListener('click', (e) => {
        e.currentTarget.hidden = true;
        root.querySelector('#keiretsu-box').hidden = false;
        form.elements.系列.focus();
      });
      phoneInput.addEventListener('blur', checkPhone);
      phoneInput.addEventListener('input', () => { if (phoneDigits(phoneInput.value).length >= 10) checkPhone(); });
      nameInput.addEventListener('blur', checkName);
      if (p) { checkPhone(); }

      form.addEventListener('change', (e) => {
        if (e.target.name === '業種') root.querySelector('#kind-other').hidden = e.target.value !== 'その他';
        if (e.target.name === '対象外') root.querySelector('#exclude-reason').hidden = !e.target.checked;
      });
      root.querySelector('#cancel').addEventListener('click', () => nav.back(p ? `p/${p.営業先ID}` : 'today'));

      form.addEventListener('submit', async (e) => {
        e.preventDefault();
        const v2 = formValues(form);
        const errors = [];
        if (!v2.顧客名) errors.push('顧客名');
        if (!phoneDigits(v2.電話番号)) errors.push('電話番号');
        if (!v2.業種) errors.push('業種');
        if (errors.length) { toast(`${errors.join('・')}を入れてください`, { kind: 'warn' }); return; }
        if (checkPhone().length) {
          const ok = await confirmDialog('同じ電話番号の営業先がすでにあります。\nそれでも保存しますか？', { ok: '保存する' });
          if (!ok) return;
        }
        const patch = {
          顧客名: v2.顧客名, 系列: v2.系列, 業種: joinOther(v2.業種, v2.業種その他),
          顧客区分: v2.顧客区分, 顧客ランク: v2.顧客ランク, 段階: v2.段階,
          電話番号: v2.電話番号, 都道府県: v2.都道府県, 市区町村: v2.市区町村, 番地: v2.番地,
          WebサイトURL: v2.WebサイトURL, 情報元URL: v2.情報元URL, 確認状態: v2.確認状態, メモ: v2.メモ,
        };
        if (p) {
          patch.対象外 = v2.対象外;
          patch.対象外理由 = v2.対象外 === 'TRUE' ? v2.対象外理由 : '';
        } else {
          patch.対象外 = 'FALSE';
        }
        const sid = await sync.save('営業先', p?.営業先ID || null, patch);
        toast(p ? '保存しました' : '登録しました');
        nav.go(`p/${sid}`, { replace: true });
      });
    },
  };
}
