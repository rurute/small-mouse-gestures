import { test } from 'node:test';
import assert from 'node:assert/strict';
import { quantize, createStroke, DEFAULT_STEP_PX, MAX_LENGTH } from '../src/content/recognizer.js';

/** 点列を順に流し込んで方向文字列を得るヘルパー。 */
function strokeOf(points, options) {
  const stroke = createStroke(options);
  for (const [x, y] of points) stroke.addPoint(x, y);
  return stroke.directions;
}

test('quantize は優勢軸で 4 方向に量子化する', () => {
  assert.equal(quantize(20, 3), 'R');
  assert.equal(quantize(-20, 3), 'L');
  assert.equal(quantize(3, 20), 'D');
  assert.equal(quantize(3, -20), 'U');
});

test('quantize は縦横が同値のとき縦を選ぶ（決定的な挙動）', () => {
  assert.equal(quantize(20, 20), 'D');
  assert.equal(quantize(20, -20), 'U');
});

test('既定値は spec のとおり', () => {
  assert.equal(DEFAULT_STEP_PX, 16);
  assert.equal(MAX_LENGTH, 4);
});

test('水平の直線移動は単一方向になる', () => {
  assert.equal(strokeOf([[0, 0], [40, 0]]), 'R');
  assert.equal(strokeOf([[0, 0], [-40, 0]]), 'L');
});

test('垂直の直線移動は単一方向になる', () => {
  assert.equal(strokeOf([[0, 0], [0, 40]]), 'D');
  assert.equal(strokeOf([[0, 0], [0, -40]]), 'U');
});

test('stepPx 未満の移動は記録されない', () => {
  assert.equal(strokeOf([[0, 0], [10, 0]]), '');
});

test('stepPx 未満の移動を重ねても、累積が閾値を超えれば記録される', () => {
  assert.equal(strokeOf([[0, 0], [10, 0], [20, 0]]), 'R');
});

test('連続する同方向は圧縮される', () => {
  assert.equal(strokeOf([[0, 0], [20, 0], [40, 0], [60, 0]]), 'R');
});

test('方向が変わると追記される', () => {
  assert.equal(strokeOf([[0, 0], [0, 40], [40, 40]]), 'DR');
  assert.equal(strokeOf([[0, 0], [0, 40], [-40, 40]]), 'DL');
});

test('斜めのぶれを含む水平移動は R ひとつになる', () => {
  assert.equal(strokeOf([[0, 0], [20, 5], [40, -3], [60, 4]]), 'R');
});

test('方向列は最大長 4 で打ち切られる', () => {
  const points = [[0, 0], [40, 0], [40, 40], [0, 40], [0, 0], [40, 0]];
  assert.equal(strokeOf(points), 'RDLU');
});

test('stepPx は上書きできる', () => {
  assert.equal(strokeOf([[0, 0], [10, 0]], { stepPx: 5 }), 'R');
});

test('reset で状態が初期化される', () => {
  const stroke = createStroke();
  stroke.addPoint(0, 0);
  stroke.addPoint(40, 0);
  assert.equal(stroke.directions, 'R');
  stroke.reset();
  assert.equal(stroke.directions, '');
  stroke.addPoint(0, 0);
  stroke.addPoint(0, 40);
  assert.equal(stroke.directions, 'D');
});
