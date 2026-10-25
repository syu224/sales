// シートのタブ・列と、選択肢の定義。
// 列の見出しを変える場合は apps-script/コード.gs の SCHEMA と手順書も合わせて変えること。

export const TABS = {
  営業先: { id: '営業先ID', updated: '更新日時' },
  担当者: { id: '担当者ID', updated: '更新日時' },
  案件: { id: '案件ID', updated: '更新日時' },
  活動履歴: { id: '活動ID' },
};
export const REF_FIELDS = ['営業先ID', '案件ID', '担当者ID', '統合先ID'];

export const 業種 = ['病院', '介護施設', '派遣会社', '企業', '受入団体', '不動産会社', '社宅代行会社', 'その他'];
export const 業種補足 = { 受入団体: '協同組合・監理団体など' };
export const 顧客区分 = ['既存顧客', '見込み顧客', 'テレアポ候補'];
export const ランク = ['A', 'B', 'C'];
export const ランク説明 = {
  A: '他の事業部と取引あり',
  B: '関連グループ内で取引あり',
  C: '取引なし',
};
export const 確認状態 = ['未確認', '確認済み', '番号違い'];
export const 利用目的 = ['技能実習生', '特定技能', '留学生', '学生', '社会人の一時利用',
  '看護師などの一時派遣', '施設内の備品', 'その他'];

export const 営業先段階 = ['01 未接触', '02 初回接触', '03 ニーズ確認'];
export const 案件段階 = ['04 提案・見積作成', '05 見積提出', '06 検討中・回答待ち', '07 内諾・契約手続き中',
  '08 契約締結', '09 失注', '10 保留'];
export const 進行中段階 = ['04', '05', '06', '07'];

export const 活動種別 = ['架電', '訪問', 'メール', 'その他'];
export const 活動結果 = ['不在', '番号違い', '担当者接触', 'アポ獲得', '見積依頼', '断り', 'その他'];
// 先方につながったとみなす結果（確認状態を「確認済み」、段階 01→02 の候補にする）
export const つながった結果 = ['担当者接触', 'アポ獲得', '見積依頼', '断り'];
// 案件の段階を変えたときにアプリが自動で残す記録（「今日やること」の計算には使わない）
export const 段階変更 = '段階変更';

export const 段階色 = {
  '01': '#E3E6EB', '02': '#C7CCD5', '03': '#8E96A6',
  '04': '#C9D5FA', '05': '#93AAF2', '06': '#5C7FE8', '07': '#2F56D6', '08': '#14307A',
  '09': '#B9BEC8', '10': '#E0A848',
};
// 段階色の上に載せる文字色
export const 段階文字色 = {
  '01': '#14171F', '02': '#14171F', '03': '#FFFFFF',
  '04': '#14171F', '05': '#14171F', '06': '#FFFFFF', '07': '#FFFFFF', '08': '#FFFFFF',
  '09': '#14171F', '10': '#14171F',
};

export const stageCode = (s) => String(s || '').slice(0, 2);
export const stageName = (s) => String(s || '').slice(3) || String(s || '');

/** 「その他：○○」形式の値を分解する（シートには1列で保存） */
export function splitOther(value) {
  const v = String(value || '');
  if (v.startsWith('その他')) return { base: 'その他', other: v.replace(/^その他[：:]?/, '').trim() };
  return { base: v, other: '' };
}
export function joinOther(base, other) {
  if (base === 'その他' && other && other.trim()) return 'その他：' + other.trim();
  return base;
}
