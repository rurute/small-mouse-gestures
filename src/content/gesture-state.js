export const STATE = {
  IDLE: 'IDLE',
  ARMED_RIGHT: 'ARMED_RIGHT',
  GESTURING: 'GESTURING',
  ARMED_LEFT: 'ARMED_LEFT',
};

/** ジェスチャとみなすまでの最小移動距離（px）。 */
export const DEFAULT_START_PX = 12;

const LEFT_BUTTON = 0;
const RIGHT_BUTTON = 2;

/** event.buttons のビットマスク（押されているボタンの集合を表す）。 */
const RIGHT_BUTTON_MASK = 2;

/**
 * そのイベントの時点で右ボタンが押されているか。
 * button は「今変化したボタン」だが buttons は「今押されているボタン」なので、
 * 押下そのものを見ていなくても保持状態を判定できる。
 */
function rightButtonHeld(event) {
  return ((event.buttons ?? 0) & RIGHT_BUTTON_MASK) !== 0;
}

/**
 * ストロークとロッカーを統合した状態機械。
 * タイマーを持たず DOM にも触れない。副作用は配列で返すだけで、
 * 実際の適用は呼び出し側が行う。
 */
export function createMachine({ startPx = DEFAULT_START_PX } = {}) {
  let state = STATE.IDLE;
  let originX = 0;
  let originY = 0;
  // 右ボタンを離したときにコンテキストメニューを抑止すべきか。
  // Windows Chrome では contextmenu が右ボタンの離上時に発火するため、
  // ロッカー発火時ではなく離上時に抑止フラグを立てる。
  let suppressMenuOnRelease = false;

  function goIdle() {
    state = STATE.IDLE;
    suppressMenuOnRelease = false;
  }

  function arm(next, x, y) {
    state = next;
    originX = x;
    originY = y;
  }

  function movedFarEnough(x, y) {
    return Math.hypot(x - originX, y - originY) >= startPx;
  }

  function onMouseDown(event) {
    if (event.button === RIGHT_BUTTON) {
      if (state === STATE.ARMED_LEFT) {
        arm(STATE.ARMED_RIGHT, event.x, event.y);
        suppressMenuOnRelease = true;
        return [
          { type: 'rocker', side: 'right' },
          { type: 'preventDefault' },
          { type: 'suppressClick' },
        ];
      }
      if (state === STATE.IDLE) arm(STATE.ARMED_RIGHT, event.x, event.y);
      return [];
    }

    if (event.button === LEFT_BUTTON) {
      // 状態が IDLE でも、右ボタンが物理的に押されていればロッカーとして扱う。
      // ロッカーでページを遷移した直後は、遷移先のインスタンスが右ボタンの押下を
      // 見ていないため IDLE になる。ここを取りこぼすと、続けての左クリックが
      // 素通りしてカーソル下のリンクを踏む。
      if (state === STATE.ARMED_RIGHT || state === STATE.GESTURING || rightButtonHeld(event)) {
        const effects = [];
        if (state === STATE.GESTURING) effects.push({ type: 'gestureCancel' });
        arm(STATE.ARMED_RIGHT, event.x, event.y);
        suppressMenuOnRelease = true;
        effects.push(
          { type: 'rocker', side: 'left' },
          { type: 'preventDefault' },
          { type: 'suppressClick' },
        );
        return effects;
      }
      if (state === STATE.IDLE) arm(STATE.ARMED_LEFT, event.x, event.y);
      return [];
    }

    return [];
  }

  function onMouseMove(event) {
    if (state === STATE.ARMED_RIGHT) {
      if (!movedFarEnough(event.x, event.y)) return [];
      state = STATE.GESTURING;
      return [
        { type: 'gestureStart', x: originX, y: originY },
        { type: 'gestureMove', x: event.x, y: event.y },
        { type: 'preventDefault' },
      ];
    }

    if (state === STATE.GESTURING) {
      return [{ type: 'gestureMove', x: event.x, y: event.y }, { type: 'preventDefault' }];
    }

    if (state === STATE.ARMED_LEFT && movedFarEnough(event.x, event.y)) {
      // テキスト選択やドラッグ&ドロップとみなし、ロッカー待機を解除する。
      goIdle();
    }

    return [];
  }

  function onMouseUp(event) {
    if (event.button === RIGHT_BUTTON) {
      if (state === STATE.GESTURING) {
        goIdle();
        return [
          { type: 'gestureEnd' },
          { type: 'preventDefault' },
          { type: 'suppressContextMenu' },
        ];
      }
      if (state === STATE.ARMED_RIGHT) {
        const suppress = suppressMenuOnRelease;
        goIdle();
        // 動かさず、ロッカーも撃たずに離した場合は何も抑止せず、
        // ページ本来の右クリックメニューを通す。
        return suppress ? [{ type: 'suppressContextMenu' }] : [];
      }

      if (state === STATE.IDLE) {
        // この文書では右ボタンの押下を見ていない。直前のページでロッカーが
        // 実行されて遷移し、遷移先で離された場合がこれにあたる（抑止フラグは
        // ページごとのインスタンスが持つため、遷移をまたげない）。
        // 押していない場所にメニューが出るのは意図しない挙動なので抑止する。
        return [{ type: 'suppressContextMenu' }];
      }

      return [];
    }

    if (event.button === LEFT_BUTTON) {
      if (state === STATE.ARMED_LEFT) {
        goIdle();
        return [];
      }

      // 右ボタンを押したままの左ボタン離上は、ロッカー操作の一部とみなして
      // 続く click を抑止する。次の 2 つの穴が塞がる。
      //
      // 1. rocker:right では左ボタンが右クリックより前から押されており、
      //    遷移先で離される。遷移先は押下を見ていないため何も抑止しておらず、
      //    click がカーソル下のリンクを踏む。
      // 2. rocker:left のあと左ボタンを長く持つと、押下時に立てた抑止が
      //    TTL 切れになり、離上時の click が素通りする。
      if (rightButtonHeld(event)) {
        return [{ type: 'suppressClick' }];
      }
    }

    return [];
  }

  function onKeyDown(event) {
    if (event.key !== 'Escape' || state !== STATE.GESTURING) return [];
    // 右ボタンはまだ押されている。現在位置を新たな原点として ARMED_RIGHT に戻し、
    // 離上時のメニュー抑止は残す。そのまま描き直せば新しいジェスチャになる。
    arm(STATE.ARMED_RIGHT, event.x, event.y);
    suppressMenuOnRelease = true;
    return [{ type: 'gestureCancel' }];
  }

  return {
    get state() {
      return state;
    },

    /**
     * @param {object} event 入力イベント
     * @returns {Array<object>} 呼び出し側が適用すべき副作用の一覧
     */
    handle(event) {
      switch (event.type) {
        case 'mousedown':
          return onMouseDown(event);
        case 'mousemove':
          return onMouseMove(event);
        case 'mouseup':
          return onMouseUp(event);
        case 'keydown':
          return onKeyDown(event);
        case 'reset': {
          const cancelling = state === STATE.GESTURING;
          goIdle();
          return cancelling ? [{ type: 'gestureCancel' }] : [];
        }
        default:
          return [];
      }
    },
  };
}
