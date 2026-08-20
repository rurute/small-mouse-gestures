/**
 * コンテンツスクリプト内で実行するアクション。
 * キーは src/shared/actions.js の id と一致させること。
 *
 * スクロールはページ本体（window）のみを対象とする。
 * サイト独自の内部スクロールコンテナには対応しない。
 */
export const CONTENT_ACTIONS = {
  back() {
    history.back();
  },

  forward() {
    history.forward();
  },

  scrollTop() {
    window.scrollTo({ top: 0, behavior: 'instant' });
  },

  scrollBottom() {
    const target = document.scrollingElement ?? document.documentElement;
    window.scrollTo({ top: target.scrollHeight, behavior: 'instant' });
  },
};
