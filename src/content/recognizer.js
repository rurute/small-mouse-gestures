/** 方向を 1 つ記録するのに必要な最小移動距離（px）。 */
export const DEFAULT_STEP_PX = 16;

/** 方向列の最大長。これを超える軌跡は認識対象外とする。 */
export const MAX_LENGTH = 4;

/**
 * 変位を優勢軸で 4 方向に量子化する。
 * 縦横が同値のときは縦を選ぶ（挙動を決定的にするため）。
 */
export function quantize(dx, dy) {
  if (Math.abs(dx) > Math.abs(dy)) {
    return dx > 0 ? 'R' : 'L';
  }
  return dy > 0 ? 'D' : 'U';
}

/**
 * 点をインクリメンタルに受け取り、方向文字列を組み立てる。
 * DOM にも chrome.* にも依存しない。
 */
export function createStroke({ stepPx = DEFAULT_STEP_PX, maxLength = MAX_LENGTH } = {}) {
  let lastX = null;
  let lastY = null;
  let directions = '';

  return {
    addPoint(x, y) {
      if (lastX === null) {
        lastX = x;
        lastY = y;
        return;
      }
      const dx = x - lastX;
      const dy = y - lastY;
      if (Math.hypot(dx, dy) < stepPx) return;

      lastX = x;
      lastY = y;
      if (directions.length >= maxLength) return;

      const direction = quantize(dx, dy);
      if (direction !== directions[directions.length - 1]) {
        directions += direction;
      }
    },

    get directions() {
      return directions;
    },

    reset() {
      lastX = null;
      lastY = null;
      directions = '';
    },
  };
}
