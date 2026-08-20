import { ACTIONS } from '../shared/actions.js';
import {
  DEFAULTS,
  WIDTH_MIN,
  WIDTH_MAX,
  defaultSettings,
  loadSettings,
  saveSettings,
} from '../shared/settings.js';
import { createStroke } from '../content/recognizer.js';
import { createSuppressor } from '../content/suppressor.js';
import { describeGesture } from './gesture-symbol.js';

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

const SVG_NS = 'http://www.w3.org/2000/svg';

function createPath(points) {
  const path = document.createElementNS(SVG_NS, 'path');
  const d = points.map(([x, y], index) => `${index === 0 ? 'M' : 'L'}${x} ${y}`).join(' ');
  path.setAttribute('d', d);
  return path;
}

/**
 * ジェスチャを軌跡の形で描く。描けないキー（ロッカーなど）には null を返す。
 * 線の色は currentColor で親の CSS に委ねる。
 */
function createGlyph(key, size) {
  const shape = describeGesture(key);
  if (!shape) return null;

  const svg = document.createElementNS(SVG_NS, 'svg');
  svg.setAttribute('width', String(size));
  svg.setAttribute('height', String(size));
  svg.setAttribute('viewBox', '0 0 24 24');
  svg.setAttribute('aria-hidden', 'true');
  svg.classList.add('glyph');

  const group = document.createElementNS(SVG_NS, 'g');
  group.setAttribute('fill', 'none');
  group.setAttribute('stroke', 'currentColor');
  group.setAttribute('stroke-width', '2.2');
  group.setAttribute('stroke-linecap', 'round');
  group.setAttribute('stroke-linejoin', 'round');
  group.append(createPath(shape.points), createPath(shape.head));

  svg.append(group);
  return svg;
}

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

/**
 * アクションのプルダウン。
 *
 * ロッカーは枠が固定でストロークのように削除できないため、「割り当てなし」を
 * 選べるようにする（allowNone）。割り当てなしにすると拡張は一切手を出さず、
 * 右ボタンを押しながらの左クリックはページ本来のクリックとして通る。
 */
function createActionSelect(key, { allowNone = false } = {}) {
  const select = document.createElement('select');

  if (allowNone) {
    const none = document.createElement('option');
    none.value = '';
    none.textContent = '割り当てなし';
    select.append(none);
  }

  for (const action of ACTIONS) {
    const option = document.createElement('option');
    option.value = action.id;
    option.textContent = action.label;
    select.append(option);
  }

  const current = settings.bindings[key] ?? (allowNone ? '' : ACTIONS[0].id);
  select.value = current;
  // 割り当てなしを選べない枠だけ、未設定のときに既定で埋める。
  if (!allowNone) settings.bindings[key] = current;

  select.addEventListener('change', () => {
    if (select.value === '') delete settings.bindings[key];
    else settings.bindings[key] = select.value;
  });
  return select;
}

function renderStrokeList() {
  const list = document.getElementById('stroke-list');
  list.replaceChildren();

  const keys = Object.keys(settings.bindings).filter((key) => !key.startsWith('rocker:'));
  for (const key of keys) {
    const tile = document.createElement('div');
    tile.className = 'tile';

    const glyphBox = document.createElement('div');
    glyphBox.className = 'tile-glyph';
    const glyph = createGlyph(key, 30);
    if (glyph) glyphBox.append(glyph);

    const body = document.createElement('div');
    body.className = 'tile-body';
    const keyLabel = document.createElement('code');
    keyLabel.className = 'tile-key';
    keyLabel.textContent = key;
    body.append(keyLabel, createActionSelect(key));

    const removeButton = document.createElement('button');
    removeButton.type = 'button';
    removeButton.className = 'button button-ghost button-small tile-remove';
    removeButton.textContent = '削除';
    removeButton.addEventListener('click', () => {
      delete settings.bindings[key];
      render();
    });

    tile.append(glyphBox, body, removeButton);
    list.append(tile);
  }
}

function renderRockerList() {
  const list = document.getElementById('rocker-list');
  list.replaceChildren();

  for (const key of ROCKER_KEYS) {
    const row = document.createElement('div');
    row.className = 'row';

    const label = document.createElement('div');
    label.className = 'row-label';
    label.textContent = ROCKER_LABELS[key];

    row.append(label, createActionSelect(key, { allowNone: true }));
    list.append(row);
  }
}

function render() {
  renderStrokeList();
  renderRockerList();
  document.getElementById('trail').checked = settings.overlay.trail;
  document.getElementById('label').checked = settings.overlay.label;
  document.getElementById('color').value = settings.overlay.color;
  document.getElementById('width').value = settings.overlay.width;
}

/**
 * 記録枠の結果表示。ジェスチャとして描けるものは軌跡と方向文字列で見せ、
 * 案内文やエラーは注記として添える。
 */
function setRecordResult(gestureKey, message) {
  const result = document.getElementById('record-result');
  result.replaceChildren();

  const glyph = createGlyph(gestureKey, 34);
  if (glyph) {
    const code = document.createElement('code');
    code.textContent = gestureKey;
    result.append(glyph, code);
  }

  if (message) {
    const note = document.createElement('span');
    note.textContent = message;
    result.append(note);
  }
}

function wireRecorder() {
  const area = document.getElementById('record-area');
  const addButton = document.getElementById('add-recorded');
  let stroke = null;

  // ジェスチャは記録枠より大きく描かれるのが普通なので、記録中は document 全体で
  // イベントを拾う。枠の外でボタンを離しても記録が終わらない、という状態を防ぐ。
  function onMove(event) {
    if (!stroke) return;
    stroke.addPoint(event.clientX, event.clientY);
    setRecordResult(stroke.directions, stroke.directions ? '' : '記録中…');
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
      setRecordResult('', '認識できませんでした。もう少し大きく動かしてください。');
      return;
    }
    if (settings.bindings[recorded]) {
      setRecordResult(recorded, '（すでに登録されています）');
      recorded = '';
      return;
    }
    setRecordResult(recorded, '');
    addButton.disabled = false;
  }

  area.addEventListener('mousedown', (event) => {
    if (event.button !== RIGHT_BUTTON) return;
    event.preventDefault();
    stroke = createStroke();
    stroke.addPoint(event.clientX, event.clientY);
    recorded = '';
    setRecordResult('', '記録中…');
    addButton.disabled = true;
    document.addEventListener('mousemove', onMove, true);
    document.addEventListener('mouseup', onUp, true);
  });
}

function onAddRecorded() {
  if (!recorded || settings.bindings[recorded]) return;
  settings.bindings[recorded] = ACTIONS[0].id;
  recorded = '';
  setRecordResult('', '');
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
