// MV3 のコンテンツスクリプトは ES モジュールとして直接登録できない
// （content_scripts に "type": "module" は存在しない）。
// そのためクラシックスクリプトから動的 import でモジュール本体を読み込む。
// 対象ファイルは manifest.json の web_accessible_resources に列挙してある。
//
// Windows 以外では本体を読み込まない（理由は platform.js を参照）。
// リスナーを 1 つも登録しないので、右クリックはブラウザ本来の挙動のままになる。
import(chrome.runtime.getURL('src/shared/platform.js'))
  .then(({ isWindows }) => {
    if (!isWindows(navigator)) return undefined;
    return import(chrome.runtime.getURL('src/content/main.js'));
  })
  .catch((error) => {
    console.error('[small-mouse-gestures] モジュールの読み込みに失敗しました', error);
  });
