import { test } from 'node:test';
import assert from 'node:assert/strict';
import { DEFAULTS, defaultSettings, mergeSettings } from '../src/shared/settings.js';

test('既定のバインディングは spec のとおり', () => {
  assert.deepEqual(DEFAULTS.bindings, {
    L: 'back',
    R: 'forward',
    U: 'scrollTop',
    D: 'scrollBottom',
    DR: 'closeTab',
    DL: 'reopenTab',
    'rocker:left': 'back',
    'rocker:right': 'forward',
  });
  assert.deepEqual(DEFAULTS.thresholds, { startPx: 12, stepPx: 16 });
  assert.deepEqual(DEFAULTS.overlay, { trail: true, label: true, color: '#4a9eff', width: 3 });
});

test('defaultSettings は毎回新しい複製を返す', () => {
  const a = defaultSettings();
  const b = defaultSettings();
  assert.notEqual(a, b);
  assert.notEqual(a.bindings, b.bindings);
  a.bindings.L = 'forward';
  assert.equal(defaultSettings().bindings.L, 'back');
});

test('保存値が無い場合は既定値を返す', () => {
  assert.deepEqual(mergeSettings(undefined), defaultSettings());
  assert.deepEqual(mergeSettings(null), defaultSettings());
  assert.deepEqual(mergeSettings('壊れた値'), defaultSettings());
});

test('欠損したセクションは既定値で補完される', () => {
  const merged = mergeSettings({ bindings: { L: 'forward' } });
  assert.deepEqual(merged.bindings, { L: 'forward' });
  assert.deepEqual(merged.thresholds, DEFAULTS.thresholds);
  assert.deepEqual(merged.overlay, DEFAULTS.overlay);
});

test('未知のトップレベルキーは保持される（前方互換のため）', () => {
  const merged = mergeSettings({ futureFlag: 'keep-me' });
  assert.equal(merged.futureFlag, 'keep-me');
});

test('未知のアクション ID を持つバインディングは落とされる', () => {
  const merged = mergeSettings({ bindings: { L: 'nope', R: 'back' } });
  assert.deepEqual(merged.bindings, { R: 'back' });
});

test('空のバインディングは尊重される（既定値で上書きしない）', () => {
  assert.deepEqual(mergeSettings({ bindings: {} }).bindings, {});
});

test('不正な閾値は既定値に置き換えられる', () => {
  const merged = mergeSettings({ thresholds: { startPx: 'abc', stepPx: -5 } });
  assert.deepEqual(merged.thresholds, DEFAULTS.thresholds);
});

test('範囲外の閾値は既定値に置き換えられる', () => {
  const merged = mergeSettings({ thresholds: { startPx: 0, stepPx: 9999 } });
  assert.deepEqual(merged.thresholds, DEFAULTS.thresholds);
});

test('妥当な閾値はそのまま採用される', () => {
  const merged = mergeSettings({ thresholds: { startPx: 20, stepPx: 30 } });
  assert.deepEqual(merged.thresholds, { startPx: 20, stepPx: 30 });
});

test('overlay の各項目が型ごとに検証される', () => {
  const merged = mergeSettings({
    overlay: { trail: false, label: 'はい', color: 123, width: 8 },
  });
  assert.equal(merged.overlay.trail, false);
  assert.equal(merged.overlay.label, DEFAULTS.overlay.label);
  assert.equal(merged.overlay.color, DEFAULTS.overlay.color);
  assert.equal(merged.overlay.width, 8);
});

test('version は常に現行の値になる', () => {
  assert.equal(mergeSettings({ version: 99 }).version, DEFAULTS.version);
});

test('mergeSettings は入力オブジェクトを変更しない', () => {
  const stored = { bindings: { L: 'nope' } };
  mergeSettings(stored);
  assert.deepEqual(stored, { bindings: { L: 'nope' } });
});
