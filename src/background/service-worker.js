/**
 * 拡張 API が必要なアクションだけを実行する。
 * 対象タブはメッセージ送信元（sender.tab.id）から取るため、
 * tabs 権限は不要。
 */
async function runAction(actionId, tabId) {
  switch (actionId) {
    case 'closeTab':
      if (tabId === undefined) throw new Error('タブ ID を特定できませんでした');
      await chrome.tabs.remove(tabId);
      return;
    case 'reopenTab':
      await chrome.sessions.restore();
      return;
    default:
      throw new Error(`未知のアクション ID: ${actionId}`);
  }
}

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message?.type !== 'runAction') return false;

  runAction(message.actionId, sender.tab?.id)
    .then(() => sendResponse({ ok: true }))
    .catch((error) => {
      console.warn('[small-mouse-gestures]', error);
      sendResponse({ ok: false, error: String(error?.message ?? error) });
    });

  // 非同期に応答するため true を返す必要がある。
  return true;
});
