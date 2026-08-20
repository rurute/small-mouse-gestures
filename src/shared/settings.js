import { ACTION_IDS } from './actions.js';

const STORAGE_KEY = 'settings';

export const DEFAULTS = Object.freeze({
  version: 1,
  bindings: Object.freeze({
    L: 'back',
    R: 'forward',
    U: 'scrollTop',
    D: 'scrollBottom',
    DR: 'closeTab',
    DL: 'reopenTab',
    'rocker:left': 'back',
    'rocker:right': 'forward',
  }),
  thresholds: Object.freeze({ startPx: 12, stepPx: 16 }),
  overlay: Object.freeze({ trail: true, label: true, color: '#4a9eff', width: 3 }),
});

export const PX_MIN = 1;
export const PX_MAX = 200;
export const WIDTH_MIN = 1;
export const WIDTH_MAX = 20;

/** DEFAULTS の変更可能な複製を返す。 */
export function defaultSettings() {
  return structuredClone(DEFAULTS);
}

function isPlainObject(value) {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function pickInt(value, min, max, fallback) {
  if (typeof value !== 'number' || !Number.isFinite(value)) return fallback;
  const rounded = Math.round(value);
  return rounded >= min && rounded <= max ? rounded : fallback;
}

function pickBoolean(value, fallback) {
  return typeof value === 'boolean' ? value : fallback;
}

function pickColor(value, fallback) {
  return typeof value === 'string' && /^#[0-9a-fA-F]{6}$/.test(value) ? value : fallback;
}

/** 未知のアクション ID を持つバインディングを落とす。 */
function sanitizeBindings(bindings) {
  if (bindings === undefined) return structuredClone(DEFAULTS.bindings);
  if (!isPlainObject(bindings)) return structuredClone(DEFAULTS.bindings);

  const result = {};
  for (const [key, actionId] of Object.entries(bindings)) {
    if (ACTION_IDS.includes(actionId)) {
      result[key] = actionId;
    } else {
      console.warn(`[small-mouse-gestures] 未知のアクション ID のため無視します: ${key} → ${actionId}`);
    }
  }
  return result;
}

/**
 * 保存値を既定値とマージする。純粋関数（入力を変更しない）。
 * 未知のトップレベルキーは前方互換のため保持する。
 */
export function mergeSettings(stored) {
  if (!isPlainObject(stored)) return defaultSettings();

  const thresholds = isPlainObject(stored.thresholds) ? stored.thresholds : {};
  const overlay = isPlainObject(stored.overlay) ? stored.overlay : {};

  return {
    ...structuredClone(stored),
    version: DEFAULTS.version,
    bindings: sanitizeBindings(stored.bindings),
    thresholds: {
      startPx: pickInt(thresholds.startPx, PX_MIN, PX_MAX, DEFAULTS.thresholds.startPx),
      stepPx: pickInt(thresholds.stepPx, PX_MIN, PX_MAX, DEFAULTS.thresholds.stepPx),
    },
    overlay: {
      trail: pickBoolean(overlay.trail, DEFAULTS.overlay.trail),
      label: pickBoolean(overlay.label, DEFAULTS.overlay.label),
      color: pickColor(overlay.color, DEFAULTS.overlay.color),
      width: pickInt(overlay.width, WIDTH_MIN, WIDTH_MAX, DEFAULTS.overlay.width),
    },
  };
}

/** 読み込みに失敗しても既定値で動作を継続する。 */
export async function loadSettings() {
  try {
    const raw = await chrome.storage.sync.get(STORAGE_KEY);
    return mergeSettings(raw?.[STORAGE_KEY]);
  } catch (error) {
    console.warn('[small-mouse-gestures] 設定の読み込みに失敗。既定値で動作します。', error);
    return defaultSettings();
  }
}

export async function saveSettings(settings) {
  await chrome.storage.sync.set({ [STORAGE_KEY]: settings });
}

/** 設定変更を購読する。オプションページでの変更が即座に反映される。 */
export function subscribeSettings(callback) {
  chrome.storage.onChanged.addListener((changes, areaName) => {
    if (areaName !== 'sync' || !changes[STORAGE_KEY]) return;
    callback(mergeSettings(changes[STORAGE_KEY].newValue));
  });
}
