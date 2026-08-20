import { test } from 'node:test';
import assert from 'node:assert/strict';
import { ACTIONS, ACTION_IDS, getAction } from '../src/shared/actions.js';

test('アクション ID が重複していない', () => {
  assert.equal(new Set(ACTION_IDS).size, ACTIONS.length);
});

test('ACTION_IDS は ACTIONS の id と一致する', () => {
  assert.deepEqual(ACTION_IDS, ACTIONS.map((action) => action.id));
});

test('where は content か background のいずれか', () => {
  for (const action of ACTIONS) {
    assert.ok(
      action.where === 'content' || action.where === 'background',
      `${action.id} の where が不正: ${action.where}`,
    );
  }
});

test('すべてのアクションに表示名がある', () => {
  for (const action of ACTIONS) {
    assert.ok(action.label.length > 0, `${action.id} に label がない`);
  }
});

test('spec が定める 6 種のアクションがすべて存在する', () => {
  assert.deepEqual(
    [...ACTION_IDS].sort(),
    ['back', 'closeTab', 'forward', 'reopenTab', 'scrollBottom', 'scrollTop'],
  );
});

test('getAction は既知の ID を返し、未知の ID には null を返す', () => {
  assert.equal(getAction('back').label, '戻る');
  assert.equal(getAction('nope'), null);
});
