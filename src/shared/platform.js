/**
 * Windows 上で動いているか。
 *
 * contextmenu は Windows では右ボタンの離上時に、macOS / Linux では押下時に
 * 発火する。押下時に発火すると、ドラッグするかどうかが分かる前にメニューが
 * 出てしまい、ジェスチャと両立できない。そのため Windows 以外では拡張を動かさない。
 *
 * userAgentData は Chrome 90 以降で使える。取れない場合は非推奨の
 * navigator.platform に頼る。
 *
 * @param {Navigator} nav 判定に使う navigator（テストでは差し替える）
 */
export function isWindows(nav) {
  const platform = nav.userAgentData?.platform || nav.platform || '';
  // userAgentData は 'Windows'、navigator.platform は 'Win32' を返す。
  return platform.startsWith('Win');
}
