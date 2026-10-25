// 進捗（第1段階は簡易版。段階バー・業種別・停滞案件は第2段階で作る）

import { state } from '../sync.js';
import * as L from '../logic.js';
import { esc, monthStr } from '../util.js';
import { listTabs } from './listTabs.js';

export function render() {
  const month = monthStr();
  const open = state.data.案件.filter((d) => L.isOpenDeal(d) && L.isActive(L.prospect(d.営業先ID)));
  const sum = L.monthSummary(month);
  const visits = state.data.活動履歴.filter((a) => a.種別 === '訪問' && String(a.日時).slice(0, 7) === month).length;
  const calls = state.data.活動履歴.filter((a) => a.種別 === '架電' && String(a.日時).slice(0, 7) === month).length;
  const prospects = state.data.営業先.filter(L.isActive).length;

  const html = `
    <div class="page">
      ${listTabs('progress')}
      <div class="stats">
        ${stat('進行中の案件', open.length)}
        ${stat('今月の受注', sum.新規開拓.won + sum.既存アップセル.won)}
        ${stat('今月の訪問', visits)}
        ${stat('今月の架電', calls)}
      </div>
      <section class="card">
        <h2 class="card-title">今月 <small>${esc(month.replace('-', '年'))}月</small></h2>
        <table class="tbl">
          <thead><tr><th></th><th>新規案件</th><th>受注</th><th>進行中</th></tr></thead>
          <tbody>
            ${['新規開拓', '既存アップセル'].map((k) => `<tr><th>${k}</th><td class="num">${sum[k].created}</td><td class="num">${sum[k].won}</td><td class="num">${sum[k].open}</td></tr>`).join('')}
          </tbody>
        </table>
        <p class="note">営業先 ${prospects}件を管理中</p>
      </section>
      <section class="card">
        <h2 class="card-title">この画面について</h2>
        <p class="note">段階ごとのグラフ・業種別の表・「14日以上動きのない案件」は第2段階で追加します。</p>
      </section>
    </div>`;
  return { title: '一覧', tab: 'list', live: true, html };
}

function stat(label, n) {
  return `<div class="stat"><span class="stat-n num">${n}</span><span class="stat-l">${esc(label)}</span></div>`;
}
