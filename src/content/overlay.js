const CANVAS_ID = 'mouse-gestures-overlay';
const LABEL_ID = 'mouse-gestures-label';
const LABEL_LINGER_MS = 600;
const ERROR_LINGER_MS = 1600;
const MAX_Z_INDEX = '2147483647';

/**
 * 軌跡と認識結果ラベルの描画。
 * ページのレイアウトにも操作にも干渉しないよう、
 * pointer-events: none の固定配置 Canvas を documentElement に載せる。
 */
export function createOverlay(options) {
  let config = { ...options };
  let canvas = null;
  let context = null;
  let labelElement = null;
  let points = [];
  let frameHandle = 0;
  let hideTimer = 0;

  function ensureDom() {
    if (canvas) return;

    canvas = document.createElement('canvas');
    canvas.id = CANVAS_ID;
    Object.assign(canvas.style, {
      position: 'fixed',
      left: '0',
      top: '0',
      width: '100%',
      height: '100%',
      pointerEvents: 'none',
      zIndex: MAX_Z_INDEX,
      background: 'transparent',
    });

    labelElement = document.createElement('div');
    labelElement.id = LABEL_ID;
    Object.assign(labelElement.style, {
      position: 'fixed',
      left: '50%',
      bottom: '32px',
      transform: 'translateX(-50%)',
      padding: '6px 14px',
      borderRadius: '6px',
      background: 'rgba(0, 0, 0, 0.78)',
      color: '#ffffff',
      font: '14px/1.4 system-ui, sans-serif',
      pointerEvents: 'none',
      zIndex: MAX_Z_INDEX,
      whiteSpace: 'nowrap',
      display: 'none',
    });

    // document_start では body がまだ存在しない可能性があるため documentElement に載せる。
    document.documentElement.append(canvas, labelElement);
    context = canvas.getContext('2d');
  }

  function resize() {
    const ratio = window.devicePixelRatio || 1;
    canvas.width = Math.floor(window.innerWidth * ratio);
    canvas.height = Math.floor(window.innerHeight * ratio);
    context.setTransform(ratio, 0, 0, ratio, 0, 0);
  }

  function clearCanvas() {
    if (context) context.clearRect(0, 0, window.innerWidth, window.innerHeight);
  }

  function draw() {
    if (!context || !config.trail) return;
    clearCanvas();
    if (points.length < 2) return;

    context.beginPath();
    context.moveTo(points[0].x, points[0].y);
    for (let index = 1; index < points.length; index += 1) {
      context.lineTo(points[index].x, points[index].y);
    }
    context.strokeStyle = config.color;
    context.lineWidth = config.width;
    context.lineCap = 'round';
    context.lineJoin = 'round';
    context.stroke();
  }

  function scheduleDraw() {
    if (frameHandle) return;
    frameHandle = requestAnimationFrame(() => {
      frameHandle = 0;
      draw();
    });
  }

  function showLabel(text, lingerMs) {
    if (!labelElement) return;
    clearTimeout(hideTimer);
    labelElement.textContent = text;
    labelElement.style.display = text ? 'block' : 'none';
    if (text && lingerMs) {
      hideTimer = setTimeout(() => {
        labelElement.style.display = 'none';
      }, lingerMs);
    }
  }

  return {
    start(x, y) {
      ensureDom();
      resize();
      points = [{ x, y }];
      showLabel('', 0);
      scheduleDraw();
    },

    addPoint(x, y) {
      points.push({ x, y });
      scheduleDraw();
    },

    setLabel(text) {
      if (!config.label) return;
      showLabel(text, 0);
    },

    end() {
      points = [];
      if (frameHandle) {
        cancelAnimationFrame(frameHandle);
        frameHandle = 0;
      }
      clearCanvas();
      // ラベルは少しだけ残し、何が実行されたか読めるようにする。
      if (labelElement && labelElement.style.display === 'block') {
        showLabel(labelElement.textContent, LABEL_LINGER_MS);
      }
    },

    flashError(text) {
      ensureDom();
      showLabel(text, ERROR_LINGER_MS);
    },

    update(next) {
      config = { ...config, ...next };
    },
  };
}
