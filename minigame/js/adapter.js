/* ============================================================
   adapter.js —— 抖音小游戏 tt 环境 → 浏览器 API 兼容层
   作用：把原游戏用到的 window / document / canvas / localStorage /
        requestAnimationFrame / performance / 生命周期事件，
        映射到抖音小游戏的 tt.* API，让游戏内核代码尽量不改就能跑。
   说明：本文件只做「环境垫片」，不承载任何游戏业务逻辑。
   ============================================================ */

// 抖音小游戏运行时全局对象（等价于浏览器里的 window / globalThis）
const g = (typeof GameGlobal !== 'undefined') ? GameGlobal
       : (typeof globalThis !== 'undefined') ? globalThis
       : (typeof global !== 'undefined') ? global : {};

/* ---------- 系统信息（屏幕尺寸 / DPR） ---------- */
let sysInfo = {};
try {
  sysInfo = (typeof tt !== 'undefined' && tt.getSystemInfoSync)
    ? tt.getSystemInfoSync()
    : { screenWidth: 375, screenHeight: 667, pixelRatio: 1, windowWidth: 375, windowHeight: 667 };
} catch (e) {
  sysInfo = { screenWidth: 375, screenHeight: 667, pixelRatio: 1, windowWidth: 375, windowHeight: 667 };
}

/* ---------- 主屏 Canvas（第一次 tt.createCanvas() 即屏幕画布） ---------- */
let mainCanvas = null;
try {
  if (typeof tt !== 'undefined' && tt.createCanvas) mainCanvas = tt.createCanvas();
} catch (e) {}

/* ---------- window 对象 ---------- */
const _listeners = {};   // 事件名 -> 回调数组（keydown/keyup 等移动端无意义，仅占位）
function addEvent(name, cb) {
  if (!_listeners[name]) _listeners[name] = [];
  _listeners[name].push(cb);
}

const win = {
  innerWidth: sysInfo.windowWidth || sysInfo.screenWidth || 375,
  innerHeight: sysInfo.windowHeight || sysInfo.screenHeight || 667,
  devicePixelRatio: sysInfo.pixelRatio || 1,
  canvas: mainCanvas,
  addEventListener(name, cb) {
    // 移动端没有键盘，resize/visibilitychange/beforeunload 映射到 tt 生命周期
    if (name === 'resize') {
      if (typeof tt !== 'undefined' && tt.onWindowResize) tt.onWindowResize(cb);
      return;
    }
    if (name === 'beforeunload') {
      if (typeof tt !== 'undefined' && tt.onHide) tt.onHide(cb);
      return;
    }
    if (name === 'keydown' || name === 'keyup') { addEvent(name, cb); return; } // 占位，不触发
    addEvent(name, cb);
  },
  removeEventListener(name, cb) { /* 移动端无需，占位 */ },
};

/* ---------- document 对象（最小实现，仅供 canvas 创建 / 取主画布） ---------- */
const documentShim = {
  createElement(tag) {
    if (tag === 'canvas') {
      // 主画布已经建好；之后的 createElement('canvas') 一律新建离屏画布
      try {
        if (typeof tt !== 'undefined' && tt.createCanvas) return tt.createCanvas();
      } catch (e) {}
      return null;
    }
    return { style: {}, classList: { add() {}, remove() {}, toggle() {} }, setAttribute() {} };
  },
  getElementById(id) {
    // 游戏内核只通过 getElementById('game') 拿主画布；其余 DOM UI 已改为 Canvas 绘制
    if (id === 'game') return mainCanvas;
    return null;
  },
  querySelectorAll() { return []; },
  createTextNode() { return {}; },
  addEventListener(name, cb) {
    if (name === 'visibilitychange') {
      // 切后台时同步一次云端存档
      if (typeof tt !== 'undefined' && tt.onHide) tt.onHide(() => cb({ hidden: true }));
      return;
    }
  },
  hidden: false,
};

/* ---------- localStorage（映射到 tt 存储，同步读写） ---------- */
const localStorageShim = {
  getItem(key) {
    try {
      if (typeof tt !== 'undefined' && tt.getStorageSync) { const v = tt.getStorageSync(key); return (v === '' || v == null) ? null : String(v); }
    } catch (e) {}
    return null;
  },
  setItem(key, value) {
    try {
      if (typeof tt !== 'undefined' && tt.setStorageSync) { tt.setStorageSync(key, value); return; }
    } catch (e) {}
  },
  removeItem(key) {
    try {
      if (typeof tt !== 'undefined' && tt.removeStorageSync) { tt.removeStorageSync(key); return; }
    } catch (e) {}
  },
};

/* ---------- requestAnimationFrame / cancelAnimationFrame ---------- */
const raf = (typeof tt !== 'undefined' && tt.requestAnimationFrame)
  ? tt.requestAnimationFrame.bind(tt)
  : (typeof g.requestAnimationFrame === 'function' ? g.requestAnimationFrame.bind(g)
     : (cb => setTimeout(() => cb(Date.now()), 16)));
const caf = (typeof tt !== 'undefined' && tt.cancelAnimationFrame)
  ? tt.cancelAnimationFrame.bind(tt)
  : (typeof g.cancelAnimationFrame === 'function' ? g.cancelAnimationFrame.bind(g) : clearTimeout);

/* ---------- performance.now ---------- */
const now = (typeof g.performance === 'object' && g.performance && typeof g.performance.now === 'function')
  ? g.performance.now.bind(g.performance)
  : (() => Date.now());

/* ---------- 挂载到全局，供 main.js 使用 ---------- */
g.window = win;
g.document = documentShim;
g.localStorage = localStorageShim;
g.requestAnimationFrame = raf;
g.cancelAnimationFrame = caf;
g.performance = { now };
g.window.AudioContext = undefined;   // 小游戏无 Web Audio，AudioSys 会静默降级
g.window.webkitAudioContext = undefined;
g.Image = (typeof tt !== 'undefined' && tt.createImage) ? tt.createImage : function () {};
g._mainCanvas = mainCanvas;
g._sysInfo = sysInfo;

/* 暴露给 main.js 用的入口（可选） */
if (typeof module !== 'undefined' && module.exports) {
  module.exports = { win, document: documentShim, localStorage: localStorageShim, raf, caf, now, mainCanvas, sysInfo };
}
