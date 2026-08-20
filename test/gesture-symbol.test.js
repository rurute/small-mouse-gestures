import { test } from 'node:test';
import assert from 'node:assert/strict';
import { describeGesture } from '../src/options/gesture-symbol.js';

test('1 ストロークは viewBox の中央に配置される', () => {
  assert.deepEqual(describeGesture('R').points, [[5, 12], [19, 12]]);
  assert.deepEqual(describeGesture('L').points, [[19, 12], [5, 12]]);
  assert.deepEqual(describeGesture('D').points, [[12, 5], [12, 19]]);
  assert.deepEqual(describeGesture('U').points, [[12, 19], [12, 5]]);
});

test('2 ストロークは折れ線になる', () => {
  assert.deepEqual(describeGesture('DR').points, [[5, 5], [5, 19], [19, 19]]);
  assert.deepEqual(describeGesture('DL').points, [[19, 5], [19, 19], [5, 19]]);
});

test('矢印の先端は軌跡の終点と一致する', () => {
  for (const key of ['L', 'R', 'U', 'D', 'DR', 'DL']) {
    const shape = describeGesture(key);
    assert.deepEqual(shape.head[1], shape.points[shape.points.length - 1], key);
  }
});

test('矢印の 2 本の羽は先端をはさんで対称になる', () => {
  const { head } = describeGesture('R');
  const [first, tip, second] = head;
  assert.equal(first[0], second[0]);
  assert.equal(tip[1] - first[1], -(tip[1] - second[1]));
});

test('矢印は最後のストロークの向きを指す', () => {
  // 右向きなら、羽は先端より左（x が小さい側）にある
  const right = describeGesture('R');
  assert.ok(right.head[0][0] < right.head[1][0]);
  // 下向きなら、羽は先端より上（y が小さい側）にある
  const down = describeGesture('D');
  assert.ok(down.head[0][1] < down.head[1][1]);
});

test('すべての点が viewBox 24x24 に収まる', () => {
  for (const key of ['L', 'R', 'U', 'D', 'DR', 'DL', 'RDLU', 'ULDR']) {
    const shape = describeGesture(key);
    for (const [x, y] of [...shape.points, ...shape.head]) {
      assert.ok(x >= 0 && x <= 24, `${key}: x=${x}`);
      assert.ok(y >= 0 && y <= 24, `${key}: y=${y}`);
    }
  }
});

test('4 ストロークでも縮尺が合う', () => {
  assert.deepEqual(describeGesture('RDLU').points, [[5, 5], [19, 5], [19, 19], [5, 19], [5, 5]]);
});

test('描けないものには null を返す', () => {
  assert.equal(describeGesture(''), null);
  assert.equal(describeGesture('rocker:left'), null);
  assert.equal(describeGesture('X'), null);
  assert.equal(describeGesture('RX'), null);
  assert.equal(describeGesture(undefined), null);
  assert.equal(describeGesture(null), null);
  assert.equal(describeGesture(42), null);
});
