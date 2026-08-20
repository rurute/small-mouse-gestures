import { test } from 'node:test';
import assert from 'node:assert/strict';
import { ACTIONS } from '../src/shared/actions.js';
import { CONTENT_ACTIONS } from '../src/content/actions-content.js';

const contentActionIds = ACTIONS.filter((action) => action.where === 'content').map((a) => a.id);

test('where が content のアクションはすべて実装がある', () => {
  for (const id of contentActionIds) {
    assert.equal(typeof CONTENT_ACTIONS[id], 'function', `${id} の実装がない`);
  }
});

test('CONTENT_ACTIONS に定義外のアクションが混ざっていない', () => {
  assert.deepEqual(Object.keys(CONTENT_ACTIONS).sort(), [...contentActionIds].sort());
});
