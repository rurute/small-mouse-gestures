/**
 * ジェスチャの方向文字列を、軌跡として描くための座標に変換する。
 *
 * 「DR」のような文字列より、実際に描く軌跡の形をそのまま見せた方が速く読める。
 * 拡張がページ上に描く軌跡やアイコンと同じ表現（丸い端点のストロークと矢印）に
 * なるよう、線の引き方は呼び出し側の SVG 属性で揃える。
 *
 * DOM に依存しない純粋関数。
 */

/** 出力座標系。SVG の viewBox と一致させること。 */
const VIEWBOX = 24;

/** 軌跡が viewBox の縁に触れないよう空ける余白。 */
const PADDING = 5;

/** 矢印の羽の、先端からの後退量と広がり。 */
const HEAD_BACK = 3.5;
const HEAD_SPREAD = 3.5;

const VECTORS = {
  L: [-1, 0],
  R: [1, 0],
  U: [0, -1],
  D: [0, 1],
};

function round(value) {
  return Math.round(value * 10) / 10;
}

/**
 * @param {string} directions 例: "DR"
 * @returns {{ points: Array<[number, number]>, head: Array<[number, number]> } | null}
 *          描けない入力（空文字、未知の方向、ロッカーのキーなど）には null を返す。
 *          呼び出し側はその場合、文字列のまま表示する。
 */
export function describeGesture(directions) {
  if (typeof directions !== 'string' || directions.length === 0) return null;

  const steps = [];
  for (const character of directions) {
    const vector = VECTORS[character];
    if (!vector) return null;
    steps.push(vector);
  }

  // 単位長で折れ線を組み立てる。
  const raw = [[0, 0]];
  for (const [dx, dy] of steps) {
    const [x, y] = raw[raw.length - 1];
    raw.push([x + dx, y + dy]);
  }

  // 縦横の長い方を基準に、余白を除いた枠へ収まるよう拡大する。
  const xs = raw.map(([x]) => x);
  const ys = raw.map(([, y]) => y);
  const minX = Math.min(...xs);
  const minY = Math.min(...ys);
  const spanX = Math.max(...xs) - minX;
  const spanY = Math.max(...ys) - minY;
  const scale = (VIEWBOX - PADDING * 2) / Math.max(spanX, spanY);

  const offsetX = (VIEWBOX - spanX * scale) / 2;
  const offsetY = (VIEWBOX - spanY * scale) / 2;

  const points = raw.map(([x, y]) => [
    round((x - minX) * scale + offsetX),
    round((y - minY) * scale + offsetY),
  ]);

  // 矢印は最後のストロークの向きを指す。羽は先端をはさんで対称に置く。
  const [dx, dy] = steps[steps.length - 1];
  const [tipX, tipY] = points[points.length - 1];
  const head = [
    [round(tipX - dx * HEAD_BACK - dy * HEAD_SPREAD), round(tipY - dy * HEAD_BACK + dx * HEAD_SPREAD)],
    [tipX, tipY],
    [round(tipX - dx * HEAD_BACK + dy * HEAD_SPREAD), round(tipY - dy * HEAD_BACK - dx * HEAD_SPREAD)],
  ];

  return { points, head };
}
