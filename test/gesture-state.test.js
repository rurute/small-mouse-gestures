import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createMachine, STATE } from '../src/content/gesture-state.js';

const LEFT = 0;
const RIGHT = 2;
const MIDDLE = 1;

const down = (button, x = 0, y = 0) => ({ type: 'mousedown', button, x, y });
const move = (x, y) => ({ type: 'mousemove', button: -1, x, y });
const up = (button, x = 0, y = 0) => ({ type: 'mouseup', button, x, y });

/** 副作用の type だけを取り出す。 */
const types = (effects) => effects.map((effect) => effect.type);

test('動かさずに右クリックして離すと、何も起きない', () => {
  const machine = createMachine();
  assert.deepEqual(machine.handle(down(RIGHT, 100, 100)), []);
  assert.equal(machine.state, STATE.ARMED_RIGHT);
  assert.deepEqual(machine.handle(up(RIGHT, 100, 100)), []);
  assert.equal(machine.state, STATE.IDLE);
});

test('開始閾値未満の移動ではジェスチャが始まらない', () => {
  const machine = createMachine({ startPx: 12 });
  machine.handle(down(RIGHT, 0, 0));
  assert.deepEqual(machine.handle(move(5, 0)), []);
  assert.equal(machine.state, STATE.ARMED_RIGHT);
});

test('開始閾値を超えるとジェスチャが始まり、原点から追跡される', () => {
  const machine = createMachine({ startPx: 12 });
  machine.handle(down(RIGHT, 0, 0));
  const effects = machine.handle(move(20, 0));
  assert.deepEqual(types(effects), ['gestureStart', 'gestureMove', 'preventDefault']);
  assert.deepEqual(effects[0], { type: 'gestureStart', x: 0, y: 0 });
  assert.deepEqual(effects[1], { type: 'gestureMove', x: 20, y: 0 });
  assert.equal(machine.state, STATE.GESTURING);
});

test('ジェスチャ中の移動は追跡され、既定動作が抑止される', () => {
  const machine = createMachine({ startPx: 12 });
  machine.handle(down(RIGHT, 0, 0));
  machine.handle(move(20, 0));
  assert.deepEqual(types(machine.handle(move(40, 0))), ['gestureMove', 'preventDefault']);
});

test('ジェスチャ中に右ボタンを離すと確定し、コンテキストメニューを抑止する', () => {
  const machine = createMachine({ startPx: 12 });
  machine.handle(down(RIGHT, 0, 0));
  machine.handle(move(20, 0));
  assert.deepEqual(
    types(machine.handle(up(RIGHT, 20, 0))),
    ['gestureEnd', 'preventDefault', 'suppressContextMenu'],
  );
  assert.equal(machine.state, STATE.IDLE);
});

test('ESC でジェスチャをキャンセルし、離上時にメニューを抑止する', () => {
  const machine = createMachine({ startPx: 12 });
  machine.handle(down(RIGHT, 0, 0));
  machine.handle(move(20, 0));
  assert.deepEqual(
    types(machine.handle({ type: 'keydown', key: 'Escape', x: 20, y: 0 })),
    ['gestureCancel'],
  );
  assert.equal(machine.state, STATE.ARMED_RIGHT);
  assert.deepEqual(types(machine.handle(up(RIGHT, 20, 0))), ['suppressContextMenu']);
});

test('ESC 以外のキーは無視される', () => {
  const machine = createMachine({ startPx: 12 });
  machine.handle(down(RIGHT, 0, 0));
  machine.handle(move(20, 0));
  assert.deepEqual(machine.handle({ type: 'keydown', key: 'a', x: 20, y: 0 }), []);
  assert.equal(machine.state, STATE.GESTURING);
});

test('右ボタン押下中の左クリックで rocker:left が発火する', () => {
  const machine = createMachine();
  machine.handle(down(RIGHT, 0, 0));
  const effects = machine.handle(down(LEFT, 0, 0));
  assert.deepEqual(types(effects), ['rocker', 'preventDefault', 'suppressClick']);
  assert.equal(effects[0].side, 'left');
  assert.equal(machine.state, STATE.ARMED_RIGHT);
});

test('rocker:left は右ボタンを押したまま連続で発火できる', () => {
  const machine = createMachine();
  machine.handle(down(RIGHT, 0, 0));
  machine.handle(down(LEFT, 0, 0));
  machine.handle(up(LEFT, 0, 0));
  const effects = machine.handle(down(LEFT, 0, 0));
  assert.equal(effects[0].type, 'rocker');
  assert.equal(effects[0].side, 'left');
});

test('rocker:left の後、右ボタンを離すとメニューが抑止される', () => {
  const machine = createMachine();
  machine.handle(down(RIGHT, 0, 0));
  machine.handle(down(LEFT, 0, 0));
  assert.deepEqual(types(machine.handle(up(RIGHT, 0, 0))), ['suppressContextMenu']);
  assert.equal(machine.state, STATE.IDLE);
});

test('ストローク中の左クリックはストロークを破棄して rocker:left になる', () => {
  const machine = createMachine({ startPx: 12 });
  machine.handle(down(RIGHT, 0, 0));
  machine.handle(move(20, 0));
  assert.deepEqual(
    types(machine.handle(down(LEFT, 20, 0))),
    ['gestureCancel', 'rocker', 'preventDefault', 'suppressClick'],
  );
  assert.equal(machine.state, STATE.ARMED_RIGHT);
});

test('左ボタン押下中の右クリックで rocker:right が発火する', () => {
  const machine = createMachine();
  machine.handle(down(LEFT, 0, 0));
  assert.equal(machine.state, STATE.ARMED_LEFT);
  const effects = machine.handle(down(RIGHT, 0, 0));
  assert.deepEqual(types(effects), ['rocker', 'preventDefault', 'suppressClick']);
  assert.equal(effects[0].side, 'right');
  assert.deepEqual(types(machine.handle(up(RIGHT, 0, 0))), ['suppressContextMenu']);
});

test('左ドラッグ後の右クリックではロッカーが誤爆しない', () => {
  const machine = createMachine({ startPx: 12 });
  machine.handle(down(LEFT, 0, 0));
  assert.deepEqual(machine.handle(move(50, 0)), []);
  assert.equal(machine.state, STATE.IDLE);
  assert.deepEqual(machine.handle(down(RIGHT, 50, 0)), []);
  assert.equal(machine.state, STATE.ARMED_RIGHT);
});

test('左ボタンを普通に離すと IDLE に戻る', () => {
  const machine = createMachine();
  machine.handle(down(LEFT, 0, 0));
  assert.deepEqual(machine.handle(up(LEFT, 0, 0)), []);
  assert.equal(machine.state, STATE.IDLE);
});

test('reset はジェスチャ中ならキャンセルを返す', () => {
  const machine = createMachine({ startPx: 12 });
  machine.handle(down(RIGHT, 0, 0));
  machine.handle(move(20, 0));
  assert.deepEqual(types(machine.handle({ type: 'reset' })), ['gestureCancel']);
  assert.equal(machine.state, STATE.IDLE);
});

test('reset は ARMED_RIGHT なら副作用なしで IDLE に戻す', () => {
  const machine = createMachine();
  machine.handle(down(RIGHT, 0, 0));
  assert.deepEqual(machine.handle({ type: 'reset' }), []);
  assert.equal(machine.state, STATE.IDLE);
});

test('この文書で押下を見ていない右ボタンの離上はメニューを抑止する', () => {
  // ロッカーで遷移した先では、押下を見ないまま離上だけが届く。
  // 抑止フラグはページごとのインスタンスが持つため遷移をまたげず、
  // これを抑止しないと遷移先でメニューが出てしまう。
  const machine = createMachine({ startPx: 12 });
  assert.equal(machine.state, STATE.IDLE);
  assert.deepEqual(types(machine.handle(up(RIGHT, 0, 0))), ['suppressContextMenu']);
});

test('reset で IDLE に戻ったあとの右ボタン離上もメニューを抑止する', () => {
  // 押していない場所にメニューが出る方が不自然なので、上と同じ扱いにする。
  const machine = createMachine({ startPx: 12 });
  machine.handle(down(RIGHT, 0, 0));
  machine.handle(down(LEFT, 0, 0));
  machine.handle({ type: 'reset' });
  assert.deepEqual(types(machine.handle(up(RIGHT, 0, 0))), ['suppressContextMenu']);
});

test('押下を見ていなくても右ボタンが押されていれば rocker:left になる', () => {
  // ロッカーで遷移した直後の状態。遷移先は右ボタンの押下を見ていない。
  const machine = createMachine({ startPx: 12 });
  assert.equal(machine.state, STATE.IDLE);
  const effects = machine.handle({ type: 'mousedown', button: LEFT, buttons: 3, x: 0, y: 0 });
  assert.deepEqual(types(effects), ['rocker', 'preventDefault', 'suppressClick']);
  assert.equal(effects[0].side, 'left');
  assert.equal(machine.state, STATE.ARMED_RIGHT);
});

test('右ボタンが押されていない左クリックはロッカーにならない', () => {
  const machine = createMachine({ startPx: 12 });
  const effects = machine.handle({ type: 'mousedown', button: LEFT, buttons: 1, x: 0, y: 0 });
  assert.deepEqual(effects, []);
  assert.equal(machine.state, STATE.ARMED_LEFT);
});

test('右ボタンを押したままの左ボタン離上は click を抑止する', () => {
  // rocker:right で左ボタンを保持したまま遷移した先での離上。
  // 押下を見ていないので抑止が何も立っておらず、放置すると
  // click がカーソル下のリンクを踏む。
  const machine = createMachine({ startPx: 12 });
  assert.equal(machine.state, STATE.IDLE);
  const effects = machine.handle({ type: 'mouseup', button: LEFT, buttons: 2, x: 0, y: 0 });
  assert.deepEqual(types(effects), ['suppressClick']);
});

test('rocker:left のあとの左ボタン離上でも click 抑止を張り直す', () => {
  // 押下時に立てた抑止は TTL 切れになりうるので、離上でも張り直す。
  const machine = createMachine({ startPx: 12 });
  machine.handle(down(RIGHT, 0, 0));
  machine.handle({ type: 'mousedown', button: LEFT, buttons: 3, x: 0, y: 0 });
  const effects = machine.handle({ type: 'mouseup', button: LEFT, buttons: 2, x: 0, y: 0 });
  assert.deepEqual(types(effects), ['suppressClick']);
  assert.equal(machine.state, STATE.ARMED_RIGHT);
});

test('割り当てが無ければ左ボタン離上でも click を抑止しない', () => {
  // 抑止すると、割り当てを外したのにリンクが開かないという状態になる。
  const machine = createMachine({ startPx: 12 });
  machine.handle(down(RIGHT, 0, 0));
  const effects = machine.handle({
    type: 'mouseup', button: LEFT, buttons: 2, rockerAssigned: false, x: 0, y: 0,
  });
  assert.deepEqual(effects, []);
});

test('右ボタンを押していない普通の左ボタン離上は抑止しない', () => {
  const machine = createMachine({ startPx: 12 });
  machine.handle({ type: 'mousedown', button: LEFT, buttons: 1, x: 0, y: 0 });
  assert.equal(machine.state, STATE.ARMED_LEFT);
  assert.deepEqual(machine.handle({ type: 'mouseup', button: LEFT, buttons: 0, x: 0, y: 0 }), []);
  assert.equal(machine.state, STATE.IDLE);
});

test('割り当てが無ければ rocker:left は発火せず、クリックも抑止しない', () => {
  const machine = createMachine({ startPx: 12 });
  machine.handle(down(RIGHT, 0, 0));
  const effects = machine.handle({
    type: 'mousedown', button: LEFT, buttons: 3, rockerAssigned: false, x: 0, y: 0,
  });
  assert.deepEqual(effects, []);
  // ストロークの待機状態は保たれる（右ボタンはまだ押されている）
  assert.equal(machine.state, STATE.ARMED_RIGHT);
});

test('割り当てが無ければ rocker:right も発火せず、通常の右クリックとして扱う', () => {
  const machine = createMachine({ startPx: 12 });
  machine.handle(down(LEFT, 0, 0));
  assert.equal(machine.state, STATE.ARMED_LEFT);
  const effects = machine.handle({
    type: 'mousedown', button: RIGHT, buttons: 3, rockerAssigned: false, x: 0, y: 0,
  });
  assert.deepEqual(effects, []);
  // そのままストロークの起点になる
  assert.equal(machine.state, STATE.ARMED_RIGHT);
});

test('割り当てが無い rocker:right のあと、動かさず離せばメニューが出る', () => {
  const machine = createMachine({ startPx: 12 });
  machine.handle(down(LEFT, 0, 0));
  machine.handle({
    type: 'mousedown', button: RIGHT, buttons: 3, rockerAssigned: false, x: 0, y: 0,
  });
  // 抑止フラグが立っていないので、離上時に何も抑止しない
  assert.deepEqual(machine.handle(up(RIGHT, 0, 0)), []);
});

test('rockerAssigned の指定が無ければ割当ありとみなす', () => {
  const machine = createMachine({ startPx: 12 });
  machine.handle(down(RIGHT, 0, 0));
  const effects = machine.handle({ type: 'mousedown', button: LEFT, buttons: 3, x: 0, y: 0 });
  assert.deepEqual(types(effects), ['rocker', 'preventDefault', 'suppressClick']);
});

test('左ボタン待機中の右ボタン離上は抑止しない', () => {
  const machine = createMachine({ startPx: 12 });
  machine.handle(down(LEFT, 0, 0));
  assert.equal(machine.state, STATE.ARMED_LEFT);
  assert.deepEqual(machine.handle(up(RIGHT, 0, 0)), []);
});

test('rocker:left でストロークをキャンセルした後、原点が現在位置に更新される', () => {
  const machine = createMachine({ startPx: 12 });
  machine.handle(down(RIGHT, 0, 0));
  machine.handle(move(20, 0));
  machine.handle(down(LEFT, 20, 0));
  // 原点が (20,0) に更新されているので、1px の移動では閾値を超えない
  assert.deepEqual(machine.handle(move(21, 0)), []);
  assert.equal(machine.state, STATE.ARMED_RIGHT);
  // 閾値を超えれば、古い原点 (0,0) ではなくロッカー位置 (20,0) から始まる
  const effects = machine.handle(move(40, 0));
  assert.deepEqual(types(effects), ['gestureStart', 'gestureMove', 'preventDefault']);
  assert.deepEqual(effects[0], { type: 'gestureStart', x: 20, y: 0 });
});

test('中ボタンは無視される', () => {
  const machine = createMachine();
  assert.deepEqual(machine.handle(down(MIDDLE, 0, 0)), []);
  assert.equal(machine.state, STATE.IDLE);
});
