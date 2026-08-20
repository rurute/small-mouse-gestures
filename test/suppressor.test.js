import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createSuppressor } from '../src/content/suppressor.js';

test('arm した直後の consume は true を返す', () => {
  const suppressor = createSuppressor({ ttlMs: 500 });
  suppressor.arm(1000);
  assert.equal(suppressor.consume(1010), true);
});

test('consume は 1 回きりで、2 回目は false を返す', () => {
  const suppressor = createSuppressor({ ttlMs: 500 });
  suppressor.arm(1000);
  assert.equal(suppressor.consume(1010), true);
  assert.equal(suppressor.consume(1020), false);
});

test('arm していない状態の consume は false を返す', () => {
  const suppressor = createSuppressor({ ttlMs: 500 });
  assert.equal(suppressor.consume(1000), false);
});

test('TTL を超えた consume は false を返し、フラグも消える', () => {
  const suppressor = createSuppressor({ ttlMs: 500 });
  suppressor.arm(1000);
  assert.equal(suppressor.consume(1501), false);
  assert.equal(suppressor.isArmed, false);
});

test('TTL ちょうどはまだ有効', () => {
  const suppressor = createSuppressor({ ttlMs: 500 });
  suppressor.arm(1000);
  assert.equal(suppressor.consume(1500), true);
});

test('arm し直すと TTL が延長される', () => {
  const suppressor = createSuppressor({ ttlMs: 500 });
  suppressor.arm(1000);
  suppressor.arm(1400);
  assert.equal(suppressor.consume(1800), true);
});

test('disarm でフラグを消せる', () => {
  const suppressor = createSuppressor({ ttlMs: 500 });
  suppressor.arm(1000);
  suppressor.disarm();
  assert.equal(suppressor.isArmed, false);
  assert.equal(suppressor.consume(1010), false);
});

test('isArmed は arm の有無を反映する', () => {
  const suppressor = createSuppressor({ ttlMs: 500 });
  assert.equal(suppressor.isArmed, false);
  suppressor.arm(1000);
  assert.equal(suppressor.isArmed, true);
  suppressor.consume(1010);
  assert.equal(suppressor.isArmed, false);
});
