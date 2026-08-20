import { ACTIONS } from '../shared/actions.js';
import {
  DEFAULTS,
  PX_MIN,
  PX_MAX,
  WIDTH_MIN,
  WIDTH_MAX,
  defaultSettings,
  loadSettings,
  saveSettings,
} from '../shared/settings.js';
import { createStroke } from '../content/recognizer.js';
import { createSuppressor } from '../content/suppressor.js';

const ROCKER_KEYS = ['rocker:left', 'rocker:right'];
const ROCKER_LABELS = {
  'rocker:left': '右ボタンを押しながら左クリック',
  'rocker:right': '左ボタンを押しながら右クリック',
};
const RIGHT_BUTTON = 2;
const STATUS_LINGER_MS = 3000;
const CONTEXT_MENU_TTL_MS = 500;

const contextMenuSuppressor = createSuppressor({ ttlMs: CONTEXT_MENU_TTL_MS });

// 記録の直後に飛んでくる contextmenu を 1 回だけ抑止する。
// コンテンツスクリプト側と同じ仕組みで、フラグが残留しても TTL で自動解除される。
document.addEventListener(
  'contextmenu',
  (event) => {
    if (!contextMenuSuppressor.consume(performance.now())) return;
    event.preventDefault();
  },
  true,
);

let settings = defaultSettings();
let recorded = '';

init();

async function init() {
  settings = await loadSettings();
  render();
  wireRecorder();
  document.getElementById('save').addEventListener('click', onSave);
  document.getElementById('reset').addEventListener('click', onReset);
  document.getElementById('add-recorded').addEventListener('click', onAddRecorded);
}

function createActionSelect(key) {
  const select = document.createElement('select');
  for (const action of ACTIONS) {
    const option = document.createElement('option');
    option.value = action.id;
    option.textContent = action.label;
    select.append(option);
  }
  // 未設定のキー（既定を消したロッカーなど）は先頭のアクションで埋める。
  const current = settings.bindings[key] ?? ACTIONS[0].id;
  select.value = current;
  settings.bindings[key] = current;
  select.addEventListener('change', () => {
    settings.bindings[key] = select.value;
  });
  return select;
}

function renderStrokeTable() {
  const body = document.querySelector('#stroke-table tbody');
  body.replaceChildren();

  const keys = Object.keys(settings.bindings).filter((key) => !key.startsWith('rocker:'));
  for (const key of keys) {
    const row = document.createElement('tr');

    const keyCell = document.createElement('td');
    keyCell.textContent = key;

    const actionCell = document.createElement('td');
    actionCell.append(createActionSelect(key));

    const removeCell = document.createElement('td');
    const removeButton = document.createElement('button');
    removeButton.type = 'button';
    removeButton.textContent = '削除';
    removeButton.addEventListener('click', () => {
      delete settings.bindings[key];
      render();
    });
    removeCell.append(removeButton);

    row.append(keyCell, actionCell, removeCell);
    body.append(row);
  }
}

function renderRockerTable() {
  const body = document.querySelector('#rocker-table tbody');
  body.replaceChildren();

  for (const key of ROCKER_KEYS) {
    const row = document.createElement('tr');

    const keyCell = document.createElement('td');
    keyCell.textContent = ROCKER_LABELS[key];

    const actionCell = document.createElement('td');
    actionCell.append(createActionSelect(key));

    row.append(keyCell, actionCell);
    body.append(row);
  }
}

function render() {
  renderStrokeTable();
  renderRockerTable();
  document.getElementById('startPx').value = settings.thresholds.startPx;
  document.getElementById('stepPx').value = settings.thresholds.stepPx;
  document.getElementById('trail').checked = settings.overlay.trail;
  document.getElementById('label').checked = settings.overlay.label;
  document.getElementById('color').value = settings.overlay.color;
  document.getElementById('width').value = settings.overlay.width;
}

function wireRecorder() {
  const area = document.getElementById('record-area');
  const result = document.getElementById('record-result');
  const addButton = document.getElementById('add-recorded');
  let stroke = null;

  // ジェスチャは記録枠より大きく描かれるのが普通なので、記録中は document 全体で
  // イベントを拾う。枠の外でボタンを離しても記録が終わらない、という状態を防ぐ。
  function onMove(event) {
    if (!stroke) return;
    stroke.addPoint(event.clientX, event.clientY);
    result.textContent = stroke.directions || '記録中…';
  }

  function onUp(event) {
    if (event.button !== RIGHT_BUTTON || !stroke) return;
    event.preventDefault();
    recorded = stroke.directions;
    stroke = null;
    document.removeEventListener('mousemove', onMove, true);
    document.removeEventListener('mouseup', onUp, true);
    contextMenuSuppressor.arm(performance.now());

    if (!recorded) {
      result.textContent = '認識できませんでした。もう少し大きく動かしてください。';
      return;
    }
    if (settings.bindings[recorded]) {
      result.textContent = `${recorded}（すでに登録されています）`;
      recorded = '';
      return;
    }
    result.textContent = recorded;
    addButton.disabled = false;
  }

  area.addEventListener('mousedown', (event) => {
    if (event.button !== RIGHT_BUTTON) return;
    event.preventDefault();
    const stepPx = Number(document.getElementById('stepPx').value) || settings.thresholds.stepPx;
    stroke = createStroke({ stepPx });
    stroke.addPoint(event.clientX, event.clientY);
    recorded = '';
    result.textContent = '記録中…';
    addButton.disabled = true;
    document.addEventListener('mousemove', onMove, true);
    document.addEventListener('mouseup', onUp, true);
  });
}

function onAddRecorded() {
  if (!recorded || settings.bindings[recorded]) return;
  settings.bindings[recorded] = ACTIONS[0].id;
  recorded = '';
  document.getElementById('record-result').textContent = '';
  document.getElementById('add-recorded').disabled = true;
  render();
}

/**
 * 入力値を検証する。数値でない値も範囲外の値も既定値に戻す。
 * src/shared/settings.js の pickInt と同じ方針にそろえてある。
 */
function pickInRange(value, min, max, fallback) {
  if (!Number.isFinite(value)) return fallback;
  const rounded = Math.round(value);
  return rounded >= min && rounded <= max ? rounded : fallback;
}

function readForm() {
  settings.thresholds.startPx = pickInRange(
    Number(document.getElementById('startPx').value),
    PX_MIN, PX_MAX, DEFAULTS.thresholds.startPx,
  );
  settings.thresholds.stepPx = pickInRange(
    Number(document.getElementById('stepPx').value),
    PX_MIN, PX_MAX, DEFAULTS.thresholds.stepPx,
  );
  settings.overlay.trail = document.getElementById('trail').checked;
  settings.overlay.label = document.getElementById('label').checked;
  settings.overlay.color = document.getElementById('color').value;
  settings.overlay.width = pickInRange(
    Number(document.getElementById('width').value),
    WIDTH_MIN, WIDTH_MAX, DEFAULTS.overlay.width,
  );
}

async function onSave() {
  readForm();
  try {
    await saveSettings(settings);
    render();
    setStatus('保存しました');
  } catch (error) {
    setStatus(`保存に失敗しました: ${error}`);
  }
}

async function onReset() {
  settings = defaultSettings();
  render();
  try {
    await saveSettings(settings);
    setStatus('既定に戻しました');
  } catch (error) {
    setStatus(`保存に失敗しました: ${error}`);
  }
}

function setStatus(text) {
  const element = document.getElementById('status');
  element.textContent = text;
  setTimeout(() => {
    if (element.textContent === text) element.textContent = '';
  }, STATUS_LINGER_MS);
}
