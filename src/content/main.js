import { createMachine } from './gesture-state.js';
import { createStroke } from './recognizer.js';
import { createSuppressor } from './suppressor.js';
import { CONTENT_ACTIONS } from './actions-content.js';
import { createOverlay } from './overlay.js';
import { getAction } from '../shared/actions.js';
import { defaultSettings, loadSettings, subscribeSettings } from '../shared/settings.js';

const CONTEXT_MENU_TTL_MS = 500;
// クリック抑止の TTL がコンテキストメニューより長いのは、ロッカー操作で
// 左ボタンを意図的に長く押した場合でもリンクを開かせないため。
const CLICK_TTL_MS = 1000;

const contextMenuSuppressor = createSuppressor({ ttlMs: CONTEXT_MENU_TTL_MS });
const clickSuppressor = createSuppressor({ ttlMs: CLICK_TTL_MS });

// storage の読み込みは非同期なので、完了するまでは既定値で動作させる。
// これによりページを開いた直後のジェスチャも取りこぼさない。
let settings = defaultSettings();

// 認識のしきい値はコードの定数（gesture-state.js / recognizer.js）に固定されており
// 実行中に変わらない。そのため状態機械とストロークは一度だけ作ればよい。
const machine = createMachine();
const stroke = createStroke();
const overlay = createOverlay(settings.overlay);

// ESC キー押下時に現在のポインタ位置を状態機械へ渡すために保持する。
let pointerX = 0;
let pointerY = 0;

/** 設定を反映する。状態機械を作り直さないので、ジェスチャ進行中でも安全。 */
function applySettings(next) {
  settings = next;
  overlay.update(settings.overlay);
}

loadSettings().then(applySettings);
subscribeSettings(applySettings);

// capture: true でページ側のハンドラより先に受け取り、
// passive: false で preventDefault() を可能にする。
const LISTENER_OPTIONS = { capture: true, passive: false };

window.addEventListener('mousedown', onMouseEvent, LISTENER_OPTIONS);
window.addEventListener('mousemove', onMouseEvent, LISTENER_OPTIONS);
window.addEventListener('mouseup', onMouseEvent, LISTENER_OPTIONS);
window.addEventListener('contextmenu', onContextMenu, LISTENER_OPTIONS);
window.addEventListener('click', onClick, LISTENER_OPTIONS);
window.addEventListener('keydown', onKeyDown, LISTENER_OPTIONS);
// mouseup が届かないケース（ウィンドウ外での離上、タブ切替）で状態が残らないようにする。
// blur はキャプチャ指定にしないこと。キャプチャするとページ内のあらゆる要素の
// blur を拾ってしまい、右ボタン押下でフォーカスが移動した瞬間に
// ジェスチャがリセットされる。ウィンドウ自身の blur はターゲット段階で届く。
window.addEventListener('blur', onReset, false);
document.addEventListener('visibilitychange', onReset, true);

/** そのボタンの押下が引き起こしうるロッカーのキー。 */
function rockerKeyFor(button) {
  if (button === 0) return 'rocker:left';
  if (button === 2) return 'rocker:right';
  return null;
}

function onMouseEvent(event) {
  // ページが dispatchEvent した合成イベントで拡張を操作されないようにする。
  if (!event.isTrusted) return;
  pointerX = event.clientX;
  pointerY = event.clientY;
  applyEffects(
    machine.handle({
      type: event.type,
      button: event.button,
      // 押下を見ていない状況でも保持状態を判定できるよう、そのまま渡す。
      buttons: event.buttons,
      // 割当が無いロッカーには手を出さないので、その判断材料を渡す。
      rockerAssigned: Boolean(settings.bindings[rockerKeyFor(event.button)]),
      x: event.clientX,
      y: event.clientY,
    }),
    event,
  );
}

function onKeyDown(event) {
  // ページが dispatchEvent した合成イベントで拡張を操作されないようにする。
  if (!event.isTrusted) return;
  applyEffects(
    machine.handle({ type: 'keydown', key: event.key, x: pointerX, y: pointerY }),
    event,
  );
}

function onReset(event) {
  // 合成 blur / visibilitychange で状態機械をリセットされないようにする。
  // これを許すと、ページ側が合成イベントを撒くだけでそのページ上の
  // ジェスチャを無効化できてしまう（「戻る」を殺して閉じ込める手口になる）。
  if (!event.isTrusted) return;
  applyEffects(machine.handle({ type: 'reset' }), null);
}

function onContextMenu(event) {
  // 合成イベントで抑止フラグを消費されないようにする。consume() は無条件に
  // フラグを消すため、これが無いとページ側が合成イベントを撒くだけで抑止を外せる。
  if (!event.isTrusted) return;
  if (!contextMenuSuppressor.consume(performance.now())) return;
  event.preventDefault();
  event.stopPropagation();
}

function onClick(event) {
  // 合成イベントで抑止フラグを消費されないようにする。これが無いと、ページ側が
  // 合成クリックを撒くことでロッカー時のクリック抑止を外し、リンクを開かせられる。
  if (!event.isTrusted) return;
  if (!clickSuppressor.consume(performance.now())) return;
  event.preventDefault();
  event.stopPropagation();
}

function applyEffects(effects, event) {
  for (const effect of effects) {
    switch (effect.type) {
      case 'preventDefault':
        if (event) {
          event.preventDefault();
          event.stopPropagation();
        }
        break;
      case 'gestureStart':
        stroke.reset();
        stroke.addPoint(effect.x, effect.y);
        overlay.start(effect.x, effect.y);
        break;
      case 'gestureMove':
        stroke.addPoint(effect.x, effect.y);
        overlay.addPoint(effect.x, effect.y);
        overlay.setLabel(describeBinding(stroke.directions));
        break;
      case 'gestureEnd':
        runBinding(stroke.directions);
        overlay.end();
        stroke.reset();
        break;
      case 'gestureCancel':
        overlay.end();
        stroke.reset();
        break;
      case 'rocker':
        runBinding(`rocker:${effect.side}`);
        break;
      case 'suppressContextMenu':
        contextMenuSuppressor.arm(performance.now());
        break;
      case 'suppressClick':
        clickSuppressor.arm(performance.now());
        break;
      default:
        break;
    }
  }
}

function runBinding(key) {
  if (!key) return;

  const actionId = settings.bindings[key];
  if (!actionId) {
    console.debug(`[small-mouse-gestures] 未割当のジェスチャ: ${key}`);
    return;
  }

  const action = getAction(actionId);
  if (!action) {
    console.warn(`[small-mouse-gestures] 未知のアクション ID: ${actionId}`);
    return;
  }

  if (action.where === 'content') {
    CONTENT_ACTIONS[action.id]();
    return;
  }

  sendToBackground(action.id);
}

/**
 * サービスワーカーへアクションを委譲する。
 * MV3 のサービスワーカーはサスペンドされるため、初回は起動待ちで
 * 失敗しうる。1 度だけ再送し、それでも駄目なら画面に表示する。
 */
async function sendToBackground(actionId, attempt = 0) {
  try {
    const response = await chrome.runtime.sendMessage({ type: 'runAction', actionId });
    if (response?.ok) return;
    throw new Error(response?.error ?? '応答がありませんでした');
  } catch (error) {
    if (attempt === 0) {
      await sendToBackground(actionId, 1);
      return;
    }
    console.warn('[small-mouse-gestures] アクションの実行に失敗しました', error);
    overlay.flashError(`実行に失敗しました: ${actionId}`);
  }
}

/** 認識中のジェスチャを「DR → タブを閉じる」の形で表す。 */
function describeBinding(key) {
  if (!key) return '';
  const actionId = settings.bindings[key];
  const action = actionId ? getAction(actionId) : null;
  return action ? `${key} → ${action.label}` : `${key} → 未割当`;
}
