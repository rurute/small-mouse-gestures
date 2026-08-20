// MV3 のコンテンツスクリプトは ES モジュールとして直接登録できない
// （content_scripts に "type": "module" は存在しない）。
// そのためクラシックスクリプトから動的 import でモジュール本体を読み込む。
// 対象ファイルは manifest.json の web_accessible_resources に列挙してある。
import(chrome.runtime.getURL('src/content/main.js')).catch((error) => {
  console.error('[small-mouse-gestures] モジュールの読み込みに失敗しました', error);
});
