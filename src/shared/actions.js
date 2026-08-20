/**
 * アクションの唯一の定義元。
 *
 * where: 'content'    … コンテンツスクリプト内で直接実行する（低レイテンシ）
 *        'background' … 拡張 API が必要なためサービスワーカーへ委譲する
 *
 * アクションを追加する場合はこの配列と、'content' なら
 * src/content/actions-content.js、'background' なら
 * src/background/service-worker.js の 2 箇所だけを編集する。
 */
export const ACTIONS = [
  { id: 'back', label: '戻る', where: 'content' },
  { id: 'forward', label: '進む', where: 'content' },
  { id: 'scrollTop', label: 'ページ最上部へ', where: 'content' },
  { id: 'scrollBottom', label: 'ページ最下部へ', where: 'content' },
  { id: 'closeTab', label: 'タブを閉じる', where: 'background' },
  { id: 'reopenTab', label: '閉じたタブを復元', where: 'background' },
];

export const ACTION_IDS = ACTIONS.map((action) => action.id);

/** 未知の ID には null を返す。呼び出し側で警告を出すため例外は投げない。 */
export function getAction(id) {
  return ACTIONS.find((action) => action.id === id) ?? null;
}
