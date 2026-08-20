import { createMachine, STATE } from './gesture-state.js';
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
let machine = createMachine({ startPx: settings.thresholds.startPx });
let stroke = createStroke({ stepPx: settings.thresholds.stepPx });
const overlay = createOverlay(settings.overlay);

// ESC キー押下時に現在のポインタ位置を状態機械へ渡すために保持する。
let pointerX = 0;
let pointerY = 0;

// ジェスチャ進行中に届いた設定。IDLE に戻った時点で反映する。
let pendingThresholds = null;

function rebuild(next) {
  machine = createMachine({ startPx: next.thresholds.startPx });
  stroke = createStroke({ stepPx: next.thresholds.stepPx });
  pendingThresholds = null;
}

/**
 * 設定を反映する。割当は即時に効かせるが、閾値の差し替えは
 * 状態機械とストロークの作り直しを伴うため、ジェスチャ進行中は保留する。
 * 進行中に作り直すと状態が取り残され、mouseup が握り潰されて
 * アクションが実行されないまま右クリックメニューが不意に出る。
 */
function applySettings(next) {
  settings = next;
  overlay.update(settings.overlay);
  if (machine.state === STATE.IDLE) {
    rebuild(next);
    return;
  }
  pendingThresholds = next;
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

function onMouseEvent(event) {
  // ページが dispatchEvent した合成イベントで拡張を操作されないようにする。
  if (!event.isTrusted) return;
  pointerX = event.clientX;
  pointerY = event.clientY;
  applyEffects(
    machine.handle({
      type: event.type,
      button: event.button,
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

function onReset() {
  applyEffects(machine.handle({ type: 'reset' }), null);
}

function onContextMenu(event) {
  if (!contextMenuSuppressor.consume(performance.now())) return;
  event.preventDefault();
  event.stopPropagation();
}

function onClick(event) {
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

  // ジェスチャが終わって IDLE に戻ったら、保留していた閾値の変更を反映する。
  if (pendingThresholds && machine.state === STATE.IDLE) {
    rebuild(pendingThresholds);
  }
}

function runBinding(key) {
  if (!key) return;

  const actionId = settings.bindings[key];
  if (!actionId) {
    console.debug(`[mouse-gestures] 未割当のジェスチャ: ${key}`);
    return;
  }

  const action = getAction(actionId);
  if (!action) {
    console.warn(`[mouse-gestures] 未知のアクション ID: ${actionId}`);
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
    console.warn('[mouse-gestures] アクションの実行に失敗しました', error);
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
