import { test } from 'node:test';
import assert from 'node:assert/strict';
import { isWindows } from '../src/shared/platform.js';

test('userAgentData が Windows なら true を返す', () => {
  assert.equal(isWindows({ userAgentData: { platform: 'Windows' }, platform: 'Win32' }), true);
});

test('userAgentData が macOS なら false を返す', () => {
  assert.equal(isWindows({ userAgentData: { platform: 'macOS' }, platform: 'MacIntel' }), false);
});

test('userAgentData が Linux なら false を返す', () => {
  assert.equal(isWindows({ userAgentData: { platform: 'Linux' }, platform: 'Linux x86_64' }), false);
});

test('userAgentData が ChromeOS なら false を返す', () => {
  assert.equal(isWindows({ userAgentData: { platform: 'Chrome OS' }, platform: 'Linux x86_64' }), false);
});

test('userAgentData が無ければ platform の Win 接頭辞で判定する', () => {
  assert.equal(isWindows({ platform: 'Win32' }), true);
  assert.equal(isWindows({ platform: 'MacIntel' }), false);
});

test('userAgentData.platform が空文字なら platform で判定する', () => {
  assert.equal(isWindows({ userAgentData: { platform: '' }, platform: 'Win32' }), true);
});

test('どちらの情報も無ければ false を返す', () => {
  assert.equal(isWindows({}), false);
});
