"use strict";
/* ============================================================
   开局捏鱼，吞遍深海 · 抖音小游戏版
   —— 游戏内核（鱼种/吞噬/碰撞/分数/DIY/皮肤/碎片/云存档）与
      index.html 完全一致；仅把 DOM UI 改为 Canvas 绘制 + 触屏命中，
      并把输入（键盘 → 触屏拖动）、音频（Web Audio → 静默降级）、
      本地存储（localStorage → tt 存储）做平台适配。
   ============================================================ */

const FONT = '"PingFang SC","Microsoft YaHei",sans-serif';

/* ---------- 工具 ---------- */
const TAU = Math.PI * 2;
const rand = (a, b) => a + Math.random() * (b - a);
const randInt = (a, b) => Math.floor(rand(a, b + 1));
const clamp = (v, a, b) => v < a ? a : (v > b ? b : v);
const lerp = (a, b, t) => a + (b - a) * t;
const dist2 = (ax, ay, bx, by) => { const dx = ax - bx, dy = ay - by; return dx * dx + dy * dy; };
const dist = (ax, ay, bx, by) => Math.sqrt(dist2(ax, ay, bx, by));
const pick = arr => arr[Math.floor(Math.random() * arr.length)];

/* ---------- 音效（小游戏无 Web Audio，静默降级；后续可换 tt.createInnerAudioContext 播放音频文件） ---------- */
const AudioSys = {
  ctx: null, muted: false,
  ensure() {}, tone() {}, eat() {}, dash() {}, hurt() {}, over() {}, click() {},
};

/* ---------- 鱼种定义（与 index.html 完全一致） ---------- */
const SPECIES = [
  { id:'blue',   name:'蓝色小鱼', body:'round',  c1:'#3fa7ff', c2:'#2a6df4', belly:'#dff1ff', pattern:null,    sizeMin:10, sizeMax:30, speed:1.5,  value:2,  agg:0,   fragCost:0 },
  { id:'flesh',  name:'肉色小鱼', body:'tall',   c1:'#ffcfa8', c2:'#f5a97f', belly:'#ffe9d6', pattern:null,    sizeMin:15, sizeMax:40, speed:1.4,  value:3,  agg:0,   fragCost:0 },
  { id:'koi',    name:'红色金鲤', body:'koi',    c1:'#ff5a4e', c2:'#ff8a3d', belly:'#ffe0c0', pattern:'band',   sizeMin:25, sizeMax:50, speed:1.0,  value:6,  agg:0,   fragCost:5 },
  { id:'ribbon', name:'黑黄带鱼', body:'eel',    c1:'#2e2e2e', c2:'#171717', belly:'#ffd23f', pattern:'stripe', patColor:'rgba(255,210,63,.95)', sizeMin:40, sizeMax:70, speed:1.2, value:10, agg:0.5, fragCost:8 },
  { id:'yellow', name:'浅黄鱼',   body:'plump',  c1:'#ffe9a8', c2:'#ffd75e', belly:'#fffbe0', pattern:null,    sizeMin:50, sizeMax:80, speed:0.95, value:8,  agg:0,   fragCost:12 },
  { id:'black',  name:'大黑鱼',   body:'long',   c1:'#3a3f46', c2:'#1c1f24', belly:'#8a919a', pattern:null,    eyeScale:0.55, sizeMin:70, sizeMax:100, speed:0.85, value:16, agg:0.6, fragCost:18 },
  { id:'tuna',   name:'蓝金枪鱼', body:'sword',  c1:'#2e6bb8', c2:'#1e4f8f', belly:'#dce9f7', pattern:null,    sizeMin:90, sizeMax:125, speed:1.3,  value:26, agg:0.8, fragCost:25 },
  { id:'shark',  name:'深蓝鲨鱼', body:'shark',  c1:'#1e3a5f', c2:'#14294a', belly:'#cfe0f0', pattern:null,    eye:'#ff2b2b', sizeMin:110, sizeMax:150, speed:1.15, value:45, agg:1,   fragCost:35 },
  { id:'dragon',    name:'龙形海兽', body:'dragon',    c1:'#3fe0c0', c2:'#1a6fb8', belly:'#dfffe8', eye:'#00e8c8', sizeMin:80,  sizeMax:150, speed:1.0,  value:150, agg:0, fragCost:120, eatGate:800,  vip:true, spawn:false, rarity:'传说', glow:'#7ef0ff', fx:'trail' },
  { id:'mechshark', name:'机械鲨鱼', body:'mechshark', c1:'#9fb6c8', c2:'#3a4a5c', belly:'#cfe0ee', eye:'#ff2b2b', sizeMin:70,  sizeMax:150, speed:1.15, value:110, agg:0, fragCost:90,  eatGate:500,  vip:true, spawn:false, rarity:'史诗', glow:'#ff3a3a', fx:'thruster' },
  { id:'jelly',     name:'星空水母', body:'jelly',     c1:'#c9a6ff', c2:'#6a3ad0', belly:'#efe6ff', eye:'#d0b0ff', sizeMin:70,  sizeMax:150, speed:0.85, value:130, agg:0, fragCost:150, eatGate:1000, vip:true, spawn:false, rarity:'传说', glow:'#c08aff', fx:'stardust' },
  { id:'demonray',  name:'恶魔鳐',   body:'demonray',  c1:'#3a2a3e', c2:'#14101c', belly:'#7a2030', eye:'#ff2b2b', sizeMin:80,  sizeMax:150, speed:1.0,  value:120, agg:0, fragCost:90,  eatGate:500,  vip:true, spawn:false, rarity:'史诗', glow:'#ff2b2b', fx:'flame' },
  { id:'turtle',    name:'极光海龟', body:'turtle',    c1:'#5ad8ff', c2:'#1a6fa0', belly:'#d0f4ff', eye:'#3fd0ff', sizeMin:60,  sizeMax:150, speed:0.8,  value:100, agg:0, fragCost:60,  eatGate:300,  vip:true, spawn:false, rarity:'稀有', glow:'#5ad8ff', fx:'ice' },
  { id:'goldking',  name:'黄金鲨王', body:'goldking',  c1:'#ffe08a', c2:'#d6a11e', belly:'#fff3cf', eye:'#ffb300', sizeMin:100, sizeMax:150, speed:1.1,  value:200, agg:0, fragCost:200, eatGate:1500, vip:true, spawn:false, rarity:'传说', glow:'#ffd23f', fx:'halo' },
];

function levelOf(totalEaten) { return Math.min(100, Math.floor((totalEaten || 0) / 30) + 1); }
function titleOf(level) {
  if (level >= 55) return '海洋之王';
  if (level >= 35) return '深渊统领';
  if (level >= 20) return '海洋霸主';
  if (level >= 10) return '深海猎手';
  if (level >= 5) return '见习渔夫';
  return '新手鱼苗';
}
function lockText(sp) {
  const need = Math.max(0, sp.fragCost - Frag.countOf(sp.id));
  let t = '还差 ' + need + ' 片';
  if (sp.vip && Skins.state.totalEaten < sp.eatGate) t += ' · 需 Lv.' + levelOf(sp.eatGate);
  return t;
}

/* ============================================================
   皮肤收集解锁模块（本地存储持久化）
   ============================================================ */
const FRAG_DROP_RATE = 0.75;
const VIP_FRAG_DROP_RATE = 0.08;

/* ---------- 本地存储抽象（tt 存储 / localStorage 双兼容） ----------
   【性能】读写均走同步 tt 接口；存档对象体积小，仅在状态变更时写，
   不在渲染循环里调用，避免每帧 IO。 */
function readLocal(key) {
  try {
    if (typeof tt !== 'undefined' && tt.getStorageSync) return tt.getStorageSync(key) || '';
    return localStorage.getItem(key) || '';
  } catch (e) { return ''; }
}
function writeLocal(key, value) {
  try {
    if (typeof tt !== 'undefined' && tt.setStorageSync) { tt.setStorageSync(key, value); return; }
    localStorage.setItem(key, value);
  } catch (e) {}
}

const Skins = {
  KEY: 'bigfish_skins',
  state: { totalEaten: 0, selected: 'blue', unlocked: [], frags: {}, fragLog: [], diy: [], nickname: '', ts: 0 },

  load() {
    try {
      const d = JSON.parse(readLocal(this.KEY) || '{}');
      this.state.totalEaten = d.totalEaten || 0;
      this.state.selected = d.selected || 'blue';
      this.state.unlocked = Array.isArray(d.unlocked) ? d.unlocked : [];
      this.state.frags = (d.frags && typeof d.frags === 'object') ? d.frags : {};
      this.state.fragLog = Array.isArray(d.fragLog) ? d.fragLog : [];
      this.state.diy = Array.isArray(d.diy) ? d.diy : [];
      this.state.nickname = typeof d.nickname === 'string' ? d.nickname : '';
      this.state.ts = d.ts || 0;
    } catch (e) { this.state = { totalEaten: 0, selected: 'blue', unlocked: [], frags: {}, fragLog: [], diy: [], nickname: '', ts: 0 }; }
    for (const s of SPECIES) {
      if (s.fragCost === 0 && !this.state.unlocked.includes(s.id)) this.state.unlocked.push(s.id);
    }
    if (!resolveSpecies(this.state.selected)) this.state.selected = 'blue';
  },

  save() { writeLocal(this.KEY, JSON.stringify(this.state)); },

  isUnlocked(id) {
    if (id && id.indexOf('diy:') === 0) return true;
    const sp = SPECIES.find(s => s.id === id);
    if (sp && sp.fragCost === 0) return true;
    return this.state.unlocked.includes(id);
  },

  addEat(n = 1) { this.state.totalEaten += n; this.save(); },

  checkUnlocks() {
    const newly = [];
    for (const s of SPECIES) {
      if (s.fragCost === 0 || this.state.unlocked.includes(s.id)) continue;
      if ((this.state.frags[s.id] || 0) < s.fragCost) continue;
      if (s.vip && this.state.totalEaten < (s.eatGate || 0)) continue;
      this.state.unlocked.push(s.id);
      newly.push(s);
    }
    if (newly.length) this.save();
    return newly;
  },

  select(id) {
    if (!this.isUnlocked(id)) return false;
    this.state.selected = id;
    this.save();
    return true;
  },
};

/* ---------- 碎片系统 ---------- */
const Frag = {
  costOf(id) { const sp = SPECIES.find(s => s.id === id); return sp ? sp.fragCost : 0; },
  countOf(id) { return Skins.state.frags[id] || 0; },
  drop(speciesId) {
    if (!SPECIES.some(s => s.id === speciesId)) return { dropped: false, name: '' };
    const dropped = Math.random() < FRAG_DROP_RATE;
    if (dropped) {
      Skins.state.frags[speciesId] = (Skins.state.frags[speciesId] || 0) + 1;
      const sp = SPECIES.find(s => s.id === speciesId);
      Skins.state.fragLog.unshift({ id: speciesId, name: sp.name, t: Date.now() });
      if (Skins.state.fragLog.length > 30) Skins.state.fragLog.length = 30;
    }
    Skins.save();
    return { dropped, name: dropped ? (SPECIES.find(s => s.id === speciesId).name) : '' };
  },
  dropVip() {
    const vipPool = SPECIES.filter(s => s.vip && s.spawn === false);
    if (!vipPool.length) return { dropped: false, name: '' };
    if (Math.random() >= VIP_FRAG_DROP_RATE) return { dropped: false, name: '' };
    const sp = vipPool[Math.floor(Math.random() * vipPool.length)];
    Skins.state.frags[sp.id] = (Skins.state.frags[sp.id] || 0) + 1;
    Skins.state.fragLog.unshift({ id: sp.id, name: sp.name, t: Date.now() });
    if (Skins.state.fragLog.length > 30) Skins.state.fragLog.length = 30;
    Skins.save();
    return { dropped: true, name: sp.name };
  },
};

/* ---------- DIY 自制鱼常量 ---------- */
const DIY_SHAPES = { round:[1.5,0.65], tall:[1.4,0.8], long:[1.9,0.55], plump:[1.15,0.9], eel:[2.2,0.45] };
const DIY_TAILS  = ['fan', 'fork', 'round', 'point'];
const DIY_FINS   = ['sail', 'spike', 'wave', 'none'];
const DIY_EYES   = ['normal', 'big', 'dot', 'star'];
const DIY_PATTERNS = [null, 'band', 'stripe', 'spot', 'tailbar'];
const PALETTE = [
  { name:'碧蓝', c1:'#3fa7ff', c2:'#2a6df4', belly:'#dff1ff' },
  { name:'珊瑚', c1:'#ff8f7a', c2:'#f25a4e', belly:'#ffe0d6' },
  { name:'金鲤', c1:'#ff5a4e', c2:'#ff8a3d', belly:'#ffe0c0' },
  { name:'柠檬', c1:'#ffe9a8', c2:'#ffd75e', belly:'#fffbe0' },
  { name:'薄荷', c1:'#7af0c8', c2:'#2ec98a', belly:'#e2ffef' },
  { name:'紫罗', c1:'#c9a6ff', c2:'#8a5cf0', belly:'#efe6ff' },
  { name:'墨黑', c1:'#3a3f46', c2:'#1c1f24', belly:'#8a919a' },
  { name:'樱粉', c1:'#ffb6d5', c2:'#ff6fa5', belly:'#ffe6f0' },
];

const DIY = {
  list() { return Skins.state.diy; },
  get(uid) { return Skins.state.diy.find(d => d.id === uid); },
  build(params) {
    return {
      id: params.id, name: params.name || '我的小鱼', body: 'diy',
      shape: params.shape || 'round',
      c1: params.c1, c2: params.c2, belly: params.belly,
      pattern: params.pattern || null, patColor: params.patColor || 'rgba(255,255,255,.8)',
      finType: params.finType || 'sail', tailType: params.tailType || 'fan', eyeType: params.eyeType || 'normal',
      sizeMin: 10, sizeMax: 150, speed: 1, value: 0, agg: 0,
    };
  },
  create(params) {
    const uid = 'diy:' + 'd' + Date.now().toString(36) + Math.floor(Math.random() * 1e4).toString(36);
    const fish = this.build({ ...params, id: uid });
    Skins.state.diy.push(fish);
    Skins.save();
    return fish;
  },
  remove(uid) {
    const i = Skins.state.diy.findIndex(d => d.id === uid);
    if (i >= 0) Skins.state.diy.splice(i, 1);
    if (Skins.state.selected === uid) Skins.state.selected = 'blue';
    Skins.save();
  },
};

function resolveSpecies(key) {
  if (key && key.indexOf('diy:') === 0) return DIY.get(key) || null;
  return SPECIES.find(s => s.id === key) || null;
}

function fmtTime(ts) {
  const d = new Date(ts);
  const p = n => (n < 10 ? '0' + n : n);
  return (d.getMonth() + 1) + '-' + p(d.getDate()) + ' ' + p(d.getHours()) + ':' + p(d.getMinutes());
}

/* ============================================================
   抖音云开发云端存档（云端 + 本地双缓存）
   本地已实时保存；回到主页/退出/切后台时防抖同步云端；冲突按时间戳保留最新。
   ============================================================ */
const Cloud = {
  inDouyin: (typeof tt !== 'undefined' && typeof tt.cloud !== 'undefined'),
  openid: null,
  _timer: null,

  login() {
    return new Promise(resolve => {
      if (!this.inDouyin) { this.openid = 'local:' + Math.random().toString(36).slice(2, 10); resolve(this.openid); return; }
      tt.login({
        success: res => {
          tt.cloud.callFunction({
            name: 'save', data: { action: 'login', code: res.code },
            success: r => { this.openid = (r.result && r.result.openid) || 'local:' + Math.random().toString(36).slice(2, 10); resolve(this.openid); },
            fail: () => { this.openid = 'local:' + Math.random().toString(36).slice(2, 10); resolve(this.openid); },
          });
        },
        fail: () => { this.openid = 'local:' + Math.random().toString(36).slice(2, 10); resolve(this.openid); },
      });
    });
  },

  pull() {
    if (!this.inDouyin || !this.openid) return Promise.resolve();
    return new Promise(resolve => {
      tt.cloud.callFunction({
        name: 'save', data: { action: 'get' },
        success: r => {
          const doc = r.result && r.result.data;
          if (doc && (doc.ts || 0) > (Skins.state.ts || 0)) {
            const { ts, openid, ...rest } = doc;
            Object.assign(Skins.state, rest);
            Skins.state.ts = ts || 0;
            Skins.save();
          }
          resolve();
        },
        fail: resolve,
      });
    });
  },

  push() {
    if (!this.inDouyin || !this.openid) return Promise.resolve();
    Skins.state.ts = Date.now();
    Skins.save();
    return new Promise(resolve => {
      tt.cloud.callFunction({
        name: 'save', data: { action: 'set', doc: { ...Skins.state, openid: this.openid, ts: Skins.state.ts } },
        complete: resolve,
      });
    });
  },

  requestSync() {
    if (this._timer) clearTimeout(this._timer);
    this._timer = setTimeout(() => this.syncNow(), 1500);
  },
  syncNow() {
    if (this._timer) { clearTimeout(this._timer); this._timer = null; }
    this.push();
  },
};

/* ---------- 激励视频广告（占位：替换广告位ID即生效，含失败兜底） ---------- */
const Ad = {
  inDouyin: (typeof tt !== 'undefined' && typeof tt.createRewardedVideoAd === 'function'),
  ad: null,
  _onClose: null,
  init() {
    if (!this.inDouyin) return;
    try {
      // TODO: 替换为你在抖音开放平台「流量主」里创建的激励视频广告位 ID
      this.ad = tt.createRewardedVideoAd({ adUnitId: 'adunit-替换为真实广告位ID' });
      if (this.ad.onClose) this.ad.onClose(res => { const cb = this._onClose; this._onClose = null; cb && cb(res); });
      if (this.ad.onError) this.ad.onError(() => {});
      this._load();   // 预加载，缩短首次弹出耗时
    } catch (e) {}
  },
  _load() {
    try { if (this.ad && this.ad.load) { const p = this.ad.load(); if (p && p.catch) p.catch(() => {}); } } catch (e) {}
  },
  // 展示激励视频：完整看完触发 onReward；未看完/无广告/加载失败均 onFail（兜底不崩溃）
  show(onReward, onFail) {
    const fail = () => onFail && onFail();
    if (!this.inDouyin || !this.ad) { fail(); return; }
    this._onClose = res => { if (res && res.isEnded) (onReward && onReward()); else fail(); };
    const attempt = () => {
      try {
        const p = this.ad.show();
        if (p && p.catch) p.catch(() => {
          // show 失败通常是广告未加载：重新 load 后再试一次，仍失败则兜底
          try {
            const lp = this.ad.load();
            const again = () => { const q = this.ad.show(); if (q && q.catch) q.catch(fail); };
            if (lp && lp.then) lp.then(again).catch(fail); else again();
          } catch (e) { fail(); }
        });
      } catch (e) { fail(); }
    };
    attempt();
  },
};

/* ---------- 分享（分享卡片 + 回流参数） ---------- */
const Share = {
  inDouyin: (typeof tt !== 'undefined'),
  init() {
    if (!this.inDouyin) return;
    try {
      // 开启右上角转发菜单
      if (tt.showShareMenu) tt.showShareMenu({ withShareTicket: true });
      // 设置默认分享内容（右上角「···」菜单分享时生效）
      if (tt.onShareAppMessage) tt.onShareAppMessage(() => this._content());
    } catch (e) {}
  },
  _content(extra) {
    return {
      title: '开局捏鱼，吞遍深海——来一起当海洋之王！',
      query: 'from=share' + (extra || ''),
      // imageUrl: 'share.png'   // 分享卡片图（建议 5:4，放到工程根目录后填这里）
    };
  },
  // 主动拉起分享（游戏内按钮触发）
  trigger(extra) {
    if (!this.inDouyin) { showToast('当前环境暂不支持分享'); return; }
    try {
      if (tt.shareAppMessage) tt.shareAppMessage(this._content(extra));
      else showToast('当前版本暂不支持主动分享');
    } catch (e) {}
  },
};

/* ---------- 解锁提示 toast（Canvas 版） ---------- */
let toastMsg = '', toastUntil = 0;
function showToast(msg) { toastMsg = msg; toastUntil = Date.now() + 2600; }
function drawToast() {
  if (!toastMsg || Date.now() > toastUntil) return;
  ctx.save();
  ctx.font = 'bold 14px ' + FONT;
  const tw = ctx.measureText(toastMsg).width;
  const bw = Math.min(W * 0.92, tw + 44), bh = 40;
  const x = W / 2 - bw / 2, y = H * 0.86;
  ctx.fillStyle = 'rgba(10,60,95,.94)';
  roundRect(x, y, bw, bh, 20); ctx.fill();
  ctx.strokeStyle = 'rgba(255,210,63,.65)'; ctx.lineWidth = 1.5;
  roundRect(x, y, bw, bh, 20); ctx.stroke();
  ctx.fillStyle = '#fff'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  ctx.fillText(toastMsg, W / 2, y + bh / 2);
  ctx.restore();
}

/* ---------- Canvas 主画布 + 离屏层 ---------- */
const canvas = (typeof window !== 'undefined' && window._mainCanvas) || document.getElementById('game');
let ctx = canvas.getContext('2d');
let fishLayer = document.createElement('canvas');
let fishCtx = fishLayer.getContext('2d');
let FISH_W = 720, FISH_H = 480;
let W = 0, H = 0, DPR = 1;
// 【性能】远景静态背景离屏缓存：水体/礁石/珊瑚/远景海草只重绘一次，resize 时才重建
let bgLayer = document.createElement('canvas');
let bgCtx = bgLayer.getContext('2d');
function resize() {
  DPR = Math.min((typeof window !== 'undefined' ? window.devicePixelRatio : 1) || 1, 2);
  W = (typeof window !== 'undefined') ? window.innerWidth : 375;
  H = (typeof window !== 'undefined') ? window.innerHeight : 667;
  canvas.width = W * DPR; canvas.height = H * DPR;
  ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
  fishLayer.width = FISH_W * DPR; fishLayer.height = FISH_H * DPR;
  fishCtx.setTransform(DPR, 0, 0, DPR, 0, 0);
  bgLayer.width = W * DPR; bgLayer.height = H * DPR;
  bgCtx.setTransform(DPR, 0, 0, DPR, 0, 0);
}
resize();
if (typeof tt !== 'undefined' && tt.onWindowResize) tt.onWindowResize(() => { resize(); buildBackground(); });

/* ---------- 性能监测与自动降级 ---------- */
const Perf = {
  frames: 0, acc: 0, fps: 60, quality: 0,
  tick(dt) {
    this.frames++; this.acc += dt;
    if (this.acc >= 0.5) {
      this.fps = this.frames / this.acc;
      this.frames = 0; this.acc = 0;
      this.quality = this.fps >= 50 ? 0 : (this.fps >= 35 ? 1 : 2);
    }
  },
  particleScale() { return this.quality === 0 ? 1 : (this.quality === 1 ? 0.6 : 0.3); }
};
// 【性能】全局实体/粒子上限：超出不再生成，避免内存持续上涨
const MAX_PARTICLES = 300;
const MAX_BUBBLES = 120;
const MAX_FISH = 40;

/* ---------- 触屏输入（移动 + 冲刺） ---------- */
const MoveTouch = { active: false, x: 0, y: 0, dashArmed: false };
const Input = {
  keys: {}, mode: 'single',
  reset() { this.keys = {}; },
  playerVector(p) { return { x: 0, y: 0 }; },   // 键盘在移动端不存在，触屏逻辑在 updatePlayer 内联处理
  dashPressed() { return false; },
};

/* ---------- 粒子 ---------- */
const particles = [];
function spawnParticles(x, y, color, n, spread = 3, life = 0.5, size = 3) {
  n = Math.floor(n * Perf.particleScale());
  if (n <= 0) return;
  const room = MAX_PARTICLES - particles.length;
  if (room <= 0) return;
  if (n > room) n = room;
  for (let i = 0; i < n; i++) {
    const a = rand(0, TAU), sp = rand(0.5, spread * 40);
    particles.push({ x, y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp, life: rand(life * 0.5, life), max: life, color, size: rand(size * 0.5, size * 1.6) });
  }
}

/* ---------- 背景气泡 ---------- */
const bubbles = [];
function initBubbles() {
  bubbles.length = 0;
  for (let i = 0; i < 44; i++) bubbles.push({ x: rand(0, W), y: rand(0, H), r: rand(1.5, 7), sp: rand(18, 60), drift: rand(-8, 8), ph: rand(0, TAU) });
}
initBubbles();
function spawnBubbleBurst(x, y) {
  for (let i = 0; i < 10; i++) {
    if (bubbles.length >= MAX_BUBBLES) break;
    bubbles.push({ x: x + rand(-14, 14), y: y + rand(-8, 8), r: rand(1.5, 5), sp: rand(50, 110), drift: rand(-18, 18), ph: rand(0, TAU) });
  }
}

/* ---------- 鱼实体 ---------- */
let fishId = 0;
class Fish {
  constructor(species, x, y, size) {
    this.id = fishId++;
    this.species = species;
    this.x = x; this.y = y;
    this.vx = 0; this.vy = 0;
    this.size = size;
    this.dir = 1;
    this.tailPhase = rand(0, TAU);
    this.alive = true;
    this.isPlayer = false; this.playerIndex = -1;
    this.score = 0; this.lives = 3;
    this.invincibleUntil = 0;
    this.dashCooldown = 0; this.dashTimer = 0;
    this.combo = 0; this.comboTime = 0;
    this.kills = 0;
    this.hueShift = rand(-8, 8);
    this.trail = [];
  }
  update(dt) {
    this.tailPhase += dt * (5 + this.vx * 0.02);
    if (this.dashTimer > 0) this.dashTimer -= dt;
    if (this.dashCooldown > 0) this.dashCooldown -= dt;
    if (this.invincibleUntil > 0) this.invincibleUntil -= dt;
    if (this.comboTime > 0) { this.comboTime -= dt; if (this.comboTime <= 0) this.combo = 0; }
    this.trail.push({ x: this.x, y: this.y });
    if (this.trail.length > 8) this.trail.shift();
  }
  aiSpeed() { return lerp(100, 55, clamp((this.size - 8) / 140, 0, 1)) * this.species.speed; }
  aiUpdate(dt) {
    this.vx = this.dir * this.aiSpeed();
    this.vy = 0;
    this.x += this.vx * dt;
  }
}

/* ---------- 玩家移动（触屏拖动：手指方向即游动方向；冲刺按钮/第二指触发冲刺） ---------- */
function updatePlayer(p, dt) {
  let vx = 0, vy = 0;
  if (MoveTouch.active) {
    const dx = MoveTouch.x - p.x, dy = MoveTouch.y - p.y;
    const d = Math.hypot(dx, dy);
    if (d > 10) { vx = dx / d; vy = dy / d; }
  }
  let spd = lerp(230, 185, clamp((p.size - 18) / 120, 0, 1));
  if (p.dashTimer > 0) spd *= 2.2;

  p.vx = vx * spd; p.vy = vy * spd;
  if (vx > 0) p.dir = 1; else if (vx < 0) p.dir = -1;
  p.x += p.vx * dt; p.y += p.vy * dt;
  p.x = clamp(p.x, p.size + 6, W - p.size - 6);
  p.y = clamp(p.y, p.size + 6, H - p.size - 6);

  if (MoveTouch.dashArmed && p.dashCooldown <= 0) {
    MoveTouch.dashArmed = false;
    p.dashTimer = 0.26; p.dashCooldown = 1.4;
    AudioSys.dash();
    spawnParticles(p.x - p.dir * p.size, p.y, '#bff0ff', 8, 1, 0.4, 3);
  }
}

/* ============================================================
   游戏主控（内核逻辑与 index.html 一致；仅 UI 展示改为 Canvas）
   ============================================================ */
const Game = {
  state: 'menu',
  mode: 'single',
  players: [],
  fishes: [],
  time: 0,
  best: { single: 0, double: 0 },
  select: { mode: 'single', picks: [null, null], player: 0 },
  albumTab: 'official',
  diyDraft: { shape: 0, pal: 0, fin: 0, tail: 0, eye: 0, pattern: 0, name: '' },
  nickDraft: '',

  init() {
    Skins.load();
    try {
      const b = JSON.parse(readLocal('bigfish_best') || '{}');
      if (b.single) this.best.single = b.single;
      if (b.double) this.best.double = b.double;
    } catch (e) {}
  },

  start(mode) {
    this.mode = mode;
    Input.mode = mode;
    Input.reset();
    particles.length = 0;
    this.time = 0;
    this.players = [];
    this.fishes = [];
    MoveTouch.active = false; MoveTouch.dashArmed = false;

    const createPlayer = (idx, x, y) => {
      const sid = this.select.picks[idx] || Skins.state.selected || (idx === 0 ? 'blue' : 'yellow');
      const sp = resolveSpecies(sid) || SPECIES[0];
      const p = new Fish(sp, x, y, 18);
      p.isPlayer = true; p.playerIndex = idx;
      return p;
    };

    if (mode === 'single') this.players.push(createPlayer(0, W / 2, H / 2));
    else { this.players.push(createPlayer(0, W / 2 - 120, H / 2)); this.players.push(createPlayer(1, W / 2 + 120, H / 2)); }

    for (let i = 0; i < 22; i++) this.spawnFish(false);
    this.state = 'play';
    UI.screen = 'play';
  },

  pause() { if (this.state !== 'play') return; this.state = 'pause'; UI.screen = 'pause'; },
  resume() { if (this.state !== 'pause') return; this.state = 'play'; UI.screen = 'play'; },
  toMenu() { this.state = 'menu'; UI.screen = 'menu'; UI.scrollY = 0; },

  /* ---- 选鱼 ---- */
  openSelect(mode) {
    this.select.mode = mode;
    this.select.picks = [null, null];
    this.select.player = 0;
    UI.screen = 'select'; UI.scrollY = 0;
  },
  chooseFish(id) {
    if (!Skins.isUnlocked(id)) return;
    this.select.picks[this.select.player] = id;
    if (this.select.mode === 'double' && this.select.player === 0) this.select.player = 1;
  },
  setSelectPlayer(idx) { this.select.player = idx; },
  confirmSelect() {
    const { mode, picks } = this.select;
    if (mode === 'single' && !picks[0]) return;
    if (mode === 'double' && (!picks[0] || !picks[1])) return;
    this.start(mode);
  },

  /* ---- 图鉴 ---- */
  openAlbum() { this.albumTab = 'official'; UI.screen = 'album'; UI.scrollY = 0; },
  closeAlbum() { this.openHome(); },
  setAlbumTab(tab) { this.albumTab = tab; UI.scrollY = 0; },
  selectSkin(id) { if (Skins.select(id)) {} },

  /* ---- 背包 ---- */
  openBackpack() { UI.screen = 'backpack'; UI.scrollY = 0; },
  closeBackpack() { this.openHome(); },

  /* ---- DIY ---- */
  openDiy() { UI.screen = 'diy'; UI.scrollY = 0; },
  closeDiy() { this.openHome(); },
  saveDiy(equip) {
    const d = this.diyDraft;
    const shapeKeys = Object.keys(DIY_SHAPES);
    const name = (d.name || '').trim() || '我的小鱼';
    const p = PALETTE[d.pal];
    const fish = DIY.create({ name, shape: shapeKeys[d.shape], c1: p.c1, c2: p.c2, belly: p.belly, pattern: DIY_PATTERNS[d.pattern], finType: DIY_FINS[d.fin], tailType: DIY_TAILS[d.tail], eyeType: DIY_EYES[d.eye] });
    if (equip) Skins.select(fish.id);
    showToast(equip ? '已保存并装备「' + name + '」' : '已保存「' + name + '」');
  },

  /* ---- 主页 ---- */
  openHome() {
    UI.screen = 'home';
    UI.scrollY = 0;
    Cloud.syncNow();
  },
  goStart() { UI.screen = 'menu'; UI.scrollY = 0; },
  agree() { writeLocal('bigfish_agreed', '1'); this.openHome(); },
  disagree() { showToast('需同意协议后才能进入游戏'); },
  revive() {
    if (this.mode !== 'single') return;
    const p = this.players[0];
    if (!p || p.alive) return;
    p.alive = true;
    p.lives = 1;
    p.invincibleUntil = 2.5;
    p.x = clamp(p.x, p.size + 10, W - p.size - 10);
    p.y = clamp(p.y, p.size + 10, H - p.size - 10);
    this.state = 'play';
    UI.screen = 'play';
    showToast('复活成功');
  },
  fragProgressText() {
    const sp = resolveSpecies(Skins.state.selected) || SPECIES[0];
    if (!sp || sp.fragCost === 0) return '碎片 · 初始皮肤';
    if (Skins.isUnlocked(sp.id)) return '碎片 · 已解锁';
    let txt = '碎片 ' + Frag.countOf(sp.id) + '/' + sp.fragCost;
    if (sp.vip && Skins.state.totalEaten < sp.eatGate) txt += ' · 需 Lv.' + levelOf(sp.eatGate);
    return txt;
  },

  /* ---- 昵称 ---- */
  openNickname() { this.nickDraft = Skins.state.nickname || ''; UI.screen = 'nickname'; UI.scrollY = 0; },
  closeNickname() { this.openHome(); },
  saveNickname() {
    const name = (this.nickDraft || '').trim().slice(0, 12);
    Skins.state.nickname = name;
    Skins.save();
    Cloud.requestSync();
    this.openHome();
    showToast(name ? ('昵称已设为「' + name + '」') : '已清空昵称');
  },

  /* ---- 占位面板 ---- */
  openVipShop() { UI.screen = 'vipshop'; },
  openQuest() { UI.screen = 'quest'; },
  openMail() { UI.screen = 'mail'; },

  spawnFish(fromEdge = true) {
    if (this.fishes.length >= MAX_FISH) return;
    const maxP = Math.max(...this.players.map(p => p.size), 18);
    const spawnable = SPECIES.filter(s => s.spawn !== false);
    let target, species;
    const roll = Math.random();
    if (roll < 0.10) {
      const bigs = spawnable.filter(s => s.sizeMin > maxP * 2);
      species = pick(bigs.length ? bigs : [spawnable[spawnable.length - 1]]);
      target = rand(species.sizeMin, species.sizeMax);
    } else {
      if (roll < 0.60) target = rand(7, maxP * 0.8);
      else if (roll < 0.82) target = rand(maxP * 0.8, maxP * 1.05);
      else target = rand(maxP * 1.05, maxP * 1.5);
      target = clamp(target, 7, 150);
      let candidates = spawnable.filter(s => s.sizeMax >= target * 0.7 && s.sizeMin <= target * 1.6);
      if (!candidates.length) candidates = spawnable;
      species = pick(candidates);
    }
    const size = clamp(target, species.sizeMin, species.sizeMax);
    let x, y, dir;
    if (fromEdge) {
      const fromLeft = Math.random() < 0.5;
      dir = fromLeft ? 1 : -1;
      x = fromLeft ? -size * 2 : W + size * 2;
      y = rand(size + 20, H - size - 20);
    } else {
      dir = Math.random() < 0.5 ? 1 : -1;
      x = rand(size + 10, W - size - 10);
      y = rand(size + 10, H - size - 10);
    }
    const f = new Fish(species, x, y, size);
    f.dir = dir;
    this.fishes.push(f);
  },

  endGame() {
    this.state = 'over';
    UI.screen = 'gameover';
    AudioSys.over();
    let scoreText = '', bestText = '';
    if (this.mode === 'single') {
      const p = this.players[0];
      const isBest = p.score > this.best.single;
      if (isBest) this.best.single = Math.floor(p.score);
      scoreText = `得分 ${Math.floor(p.score)} · 吃掉 ${p.kills} 条鱼`;
      bestText = isBest ? '新纪录！' : `最高纪录 ${this.best.single}`;
    } else {
      const a = this.players[0], b = this.players[1];
      const total = Math.floor(a.score + (b ? b.score : 0));
      const kills = a.kills + (b ? b.kills : 0);
      const isBest = total > this.best.double;
      if (isBest) this.best.double = total;
      scoreText = `总分 ${total} · 吃掉 ${kills} 条鱼`;
      bestText = isBest ? '新纪录！' : `最高纪录 ${this.best.double}`;
    }
    this.goScore = scoreText; this.goBest = bestText;
    writeLocal('bigfish_best', JSON.stringify(this.best));
    Cloud.syncNow();
  },

  update(dt) {
    if (this.state !== 'play') return;
    this.time += dt;
    dt = Math.min(dt, 0.05);
    for (const p of this.players) { p.update(dt); if (p.alive) updatePlayer(p, dt); }
    for (const f of this.fishes) { if (!f.alive) continue; f.update(dt); f.aiUpdate(dt); }
    this.handleEating();
    this.updateParticles(dt);
    this.maintainPopulation();
  },

  handleEating() {
    const alivePlayers = this.players.filter(p => p.alive);
    const allFishes = this.fishes.filter(f => f.alive);
    const CELL = 300;   // 【性能】空间分区：300px 网格分桶，碰撞只查邻近 3x3，避免 O(n²)
    const grid = new Map();
    for (const f of allFishes) {
      const cx = Math.floor(f.x / CELL), cy = Math.floor(f.y / CELL);
      const key = cx + ',' + cy;
      let b = grid.get(key); if (!b) { b = []; grid.set(key, b); }
      b.push(f);
    }
    const bucket = [];
    const nearby = (x, y) => {
      bucket.length = 0;
      const cx = Math.floor(x / CELL), cy = Math.floor(y / CELL);
      for (let gx = cx - 1; gx <= cx + 1; gx++) for (let gy = cy - 1; gy <= cy + 1; gy++) {
        const b = grid.get(gx + ',' + gy); if (b) for (const f of b) bucket.push(f);
      }
    };
    for (const p of alivePlayers) {
      nearby(p.x, p.y);
      for (const f of bucket) {
        if (!f.alive) continue;
        const d = dist(p.x, p.y, f.x, f.y);
        const eatR = p.size + f.size * 0.4;
        if (d < eatR && f.size < p.size * 0.92) this.eatFish(p, f);
        else if (d < p.size * 0.7 + f.size * 0.4 && f.size > p.size * 1.12) this.hurtPlayer(p, f);
      }
    }
    for (const pred of allFishes) {
      if (!pred.alive || pred.species.agg <= 0) continue;
      nearby(pred.x, pred.y);
      for (const f of bucket) {
        if (f === pred || !f.alive) continue;
        if (f.size > pred.size * 0.5) continue;
        if (dist2(pred.x, pred.y, f.x, f.y) < (pred.size + f.size) * (pred.size + f.size) * 0.5) {
          this.removeFish(f);
          if (pred.size < pred.species.sizeMax) pred.size = Math.min(pred.species.sizeMax, pred.size + f.size * 0.02);
          spawnParticles(f.x, f.y, f.species.c2, 4, 0.5, 0.3, 2);
        }
      }
    }
  },

  eatFish(p, f) {
    const value = Math.round(f.species.value * (f.size / 20));
    p.score += value * this.comboMul(p);
    p.kills++; p.combo++; p.comboTime = 2.2;
    p.size = Math.min(150, p.size + f.size * 0.045);
    this.removeFish(f);
    spawnBubbleBurst(f.x, f.y);
    spawnParticles(f.x, f.y, f.species.c2, 10, 0.6, 0.5, 3);
    spawnParticles(f.x, f.y, '#ffffff', 4, 0.4, 0.3, 2);
    AudioSys.eat(p.size);
    Skins.addEat(1);
    const drop = Frag.drop(f.species.id);
    if (drop.dropped) showToast('掉落碎片：「' + drop.name + '」');
    const vip = Frag.dropVip();
    if (vip.dropped) showToast('掉落稀有碎片：「' + vip.name + '」');
    const newly = Skins.checkUnlocks();
    if (newly.length) {
      const names = newly.map(s => s.name).join('、');
      showToast(newly.some(s => s.vip) ? '解锁 VIP 鱼种：' + names : '解锁新皮肤：' + names);
    }
  },

  comboMul(p) { return 1 + Math.min(p.combo, 10) * 0.1; },

  hurtPlayer(p, f) {
    if (p.invincibleUntil > 0) return;
    p.lives--;
    p.invincibleUntil = 2.0;
    const a = Math.atan2(p.y - f.y, p.x - f.x);
    p.x += Math.cos(a) * 50; p.y += Math.sin(a) * 50;
    p.x = clamp(p.x, p.size + 6, W - p.size - 6);
    p.y = clamp(p.y, p.size + 6, H - p.size - 6);
    spawnParticles(p.x, p.y, '#ff5a5a', 14, 1, 0.6, 3);
    AudioSys.hurt();
    if (p.lives <= 0) {
      p.alive = false;
      spawnParticles(p.x, p.y, p.species.c1, 30, 1.2, 1, 5);
      if (this.mode === 'single') this.endGame();
      else if (!this.players.some(pl => pl.alive)) this.endGame();
    }
  },

  removeFish(f) {
    f.alive = false;
    const idx = this.fishes.indexOf(f);
    if (idx >= 0) this.fishes.splice(idx, 1);
  },

  updateParticles(dt) {
    for (let i = particles.length - 1; i >= 0; i--) {
      const pt = particles[i];
      pt.life -= dt; pt.x += pt.vx * dt; pt.y += pt.vy * dt; pt.vx *= 0.94; pt.vy *= 0.94;
      if (pt.life <= 0) particles.splice(i, 1);
    }
  },

  updateBubbles(dt) {
    for (const b of bubbles) {
      b.y -= b.sp * dt;
      b.x += (b.drift + Math.sin(ambientT * 2 + b.ph) * 14) * dt;
      if (b.y < -20) { b.y = H + 20; b.x = rand(0, W); }
      if (b.x < -20) b.x = W + 20;
      if (b.x > W + 20) b.x = -20;
    }
  },

  maintainPopulation() {
    const target = 22;
    for (let i = this.fishes.length - 1; i >= 0; i--) {
      const f = this.fishes[i];
      if (f.x < -f.size * 3 || f.x > W + f.size * 3) this.fishes.splice(i, 1);
    }
    const maxP = Math.max(...this.players.map(p => p.size), 18);
    const edible = this.fishes.filter(f => f.size < maxP * 0.9).length;
    if (this.fishes.length < target || edible < 10) this.spawnFish(true);
  },
};

/* ============================================================
   渲染（与 index.html 完全一致）
   ============================================================ */
let previewLayer = null;   // 【性能】复用离屏层，避免每帧 new canvas 造成 GC 卡顿
function renderSpeciesPreview(canvas, sp, time) {
  time = time || 0;
  const pctx = canvas.getContext('2d');
  const cw = canvas.width, ch = canvas.height;
  pctx.clearRect(0, 0, cw, ch);
  if (!previewLayer) previewLayer = document.createElement('canvas');
  previewLayer.width = cw; previewLayer.height = ch;
  const lctx = previewLayer.getContext('2d');
  const saved = { ctx, fishLayer, fishCtx, FISH_W, FISH_H };
  ctx = pctx; fishLayer = previewLayer; fishCtx = lctx; FISH_W = cw; FISH_H = ch;
  const f = new Fish(sp, cw / 2, ch / 2, 34);
  f.dir = 1; f.hueShift = 0;
  f.tailPhase = time > 0 ? Math.sin(time * 4) * 0.6 : 0.35;
  drawFishBody(f, time);
  ctx = saved.ctx; fishLayer = saved.fishLayer; fishCtx = saved.fishCtx; FISH_W = saved.FISH_W; FISH_H = saved.FISH_H;
}

function drawHomeOrbit(canvas, time) {
  const cv = canvas.getContext('2d');
  const cx = canvas.width / 2, cy = canvas.height / 2;
  for (let i = 0; i < 6; i++) {
    const a = i / 6 * TAU + time * 0.7;
    const rr = canvas.width * (0.34 + 0.06 * Math.sin(time * 1.5 + i));
    const px = cx + Math.cos(a) * rr, py = cy + Math.sin(a) * rr * 0.6;
    const tw = 0.5 + 0.5 * Math.sin(time * 2 + i * 1.7);
    cv.fillStyle = 'rgba(150,230,255,' + (0.2 + tw * 0.3) + ')';
    cv.beginPath(); cv.arc(px, py, 2 + tw * 2, 0, TAU); cv.fill();
  }
}

function drawFishBody(f, time) {
  const sp = f.species;
  const s = f.size;
  const mainCtx = ctx;
  ctx = fishCtx;
  fishCtx.clearRect(0, 0, FISH_W, FISH_H);
  ctx.save();
  ctx.translate(FISH_W / 2, FISH_H / 2);
  if (f.dir < 0) ctx.scale(-1, 1);
  if (f.isPlayer && f.invincibleUntil > 0 && Math.floor(time * 12) % 2 === 0) ctx.globalAlpha = 0.45;
  const wag = Math.sin(f.tailPhase) * 0.5;

  if (sp.vip) {
    drawVipBody(sp, s, f, time, wag);
    ctx.restore();
    ctx = mainCtx;
    mainCtx.drawImage(fishLayer, f.x - FISH_W / 2, f.y - FISH_H / 2, FISH_W, FISH_H);
    drawPlayerLabel(f);
    return;
  }

  let Lr, Hr;
  if (sp.body === 'diy') { const pr = DIY_SHAPES[sp.shape] || DIY_SHAPES.round; Lr = pr[0]; Hr = pr[1]; }
  else if (sp.body === 'eel') { Lr = 2.2; Hr = 0.45; }
  else if (sp.body === 'tall') { Lr = 1.4; Hr = 0.8; }
  else if (sp.body === 'shark') { Lr = 1.4; Hr = 0.75; }
  else if (sp.body === 'sword') { Lr = 1.9; Hr = 0.6; }
  else if (sp.body === 'long') { Lr = 1.35; Hr = 0.78; }
  else if (sp.body === 'koi') { Lr = 1.7; Hr = 0.58; }
  else if (sp.body === 'plump') { Lr = 1.15; Hr = 0.9; }
  else { Lr = 1.5; Hr = 0.65; }
  const bodyL = Lr * s, bodyH = Hr * s;

  const tailX = -bodyL * 0.88;
  const tailW = s * 1.1;
  ctx.fillStyle = shade(sp.c2, f.hueShift);
  if (sp.tailType) { drawDiyTail(sp.tailType, tailX, tailW, s, wag); }
  else if (sp.body === 'eel') {
    ctx.beginPath(); ctx.moveTo(tailX, 0); ctx.lineTo(tailX - s * 1.5, -tailW * 0.5 + wag * 6); ctx.lineTo(tailX - s * 1.5, tailW * 0.5 + wag * 6); ctx.closePath(); ctx.fill();
  } else if (sp.body === 'koi') {
    ctx.beginPath();
    ctx.moveTo(tailX, 0);
    ctx.quadraticCurveTo(tailX - s * 0.5, -tailW * 0.5 + wag * 3, tailX - s * 1.05, -tailW * 0.95 + wag * 6);
    ctx.quadraticCurveTo(tailX - s * 0.35, -tailW * 0.12 + wag * 2, tailX - s * 0.25, wag * 1);
    ctx.quadraticCurveTo(tailX - s * 0.35, tailW * 0.12 + wag * 2, tailX - s * 1.05, tailW * 0.95 + wag * 6);
    ctx.quadraticCurveTo(tailX - s * 0.5, tailW * 0.5 + wag * 3, tailX, 0);
    ctx.closePath(); ctx.fill();
  } else {
    ctx.beginPath();
    ctx.moveTo(tailX, 0);
    ctx.lineTo(tailX - s * 0.85, -tailW * 0.55 + wag * 5);
    ctx.lineTo(tailX - s * 0.6, wag * 2);
    ctx.lineTo(tailX - s * 0.85, tailW * 0.55 + wag * 5);
    ctx.closePath(); ctx.fill();
  }

  const bodyGrad = ctx.createLinearGradient(0, -bodyH, 0, bodyH);
  bodyGrad.addColorStop(0, shade(sp.c2, f.hueShift));
  bodyGrad.addColorStop(0.45, shade(sp.c1, f.hueShift));
  bodyGrad.addColorStop(1, shade(sp.belly, f.hueShift));
  ctx.fillStyle = bodyGrad;

  if (sp.body === 'tall') {
    ctx.beginPath();
    ctx.moveTo(0, -bodyH);
    ctx.quadraticCurveTo(bodyL, -bodyH * 0.5, bodyL * 0.72, 0);
    ctx.quadraticCurveTo(bodyL, bodyH * 0.5, 0, bodyH);
    ctx.quadraticCurveTo(-bodyL, bodyH * 0.5, -bodyL * 0.72, 0);
    ctx.quadraticCurveTo(-bodyL, -bodyH * 0.5, 0, -bodyH);
    ctx.closePath(); ctx.fill();
    ctx.fillStyle = shade(sp.c2, f.hueShift + 10);
    ctx.beginPath(); ctx.moveTo(-bodyL * 0.1, -bodyH * 0.8); ctx.lineTo(0, -bodyH * 1.5); ctx.lineTo(bodyL * 0.22, -bodyH * 0.8); ctx.closePath(); ctx.fill();
    ctx.beginPath(); ctx.moveTo(-bodyL * 0.1, bodyH * 0.8); ctx.lineTo(0, bodyH * 1.42); ctx.lineTo(bodyL * 0.22, bodyH * 0.8); ctx.closePath(); ctx.fill();
  } else if (sp.body === 'eel') {
    ellipse(0, 0, bodyL, bodyH); ctx.fill();
    ctx.fillStyle = shade(sp.c2, f.hueShift + 3);
    ctx.beginPath();
    ctx.moveTo(bodyL * 0.85, -bodyH * 0.15);
    ctx.quadraticCurveTo(bodyL * 0.3, -bodyH * 0.7, -bodyL * 0.4, -bodyH * 0.8);
    ctx.quadraticCurveTo(-bodyL * 0.85, -bodyH * 0.75, -bodyL * 0.95, -bodyH * 0.25);
    ctx.lineTo(-bodyL * 0.9, -bodyH * 0.02);
    ctx.quadraticCurveTo(-bodyL * 0.5, -bodyH * 0.3, bodyL * 0.2, -bodyH * 0.35);
    ctx.quadraticCurveTo(bodyL * 0.6, -bodyH * 0.3, bodyL * 0.8, 0);
    ctx.closePath(); ctx.fill();
  } else if (sp.body === 'shark') {
    ctx.beginPath(); ctx.moveTo(bodyL, 0); ctx.quadraticCurveTo(0, -bodyH, -bodyL, 0); ctx.quadraticCurveTo(0, bodyH, bodyL, 0); ctx.closePath(); ctx.fill();
    ctx.fillStyle = shade(sp.c2, f.hueShift - 5);
    ctx.beginPath(); ctx.moveTo(-bodyL * 0.15, -bodyH * 0.75); ctx.lineTo(bodyL * 0.05, -bodyH * 1.7); ctx.lineTo(bodyL * 0.45, -bodyH * 0.65); ctx.closePath(); ctx.fill();
    ctx.beginPath(); ctx.moveTo(bodyL * 0.05, bodyH * 0.45); ctx.lineTo(-bodyL * 0.25, bodyH * 1.35); ctx.lineTo(bodyL * 0.3, bodyH * 0.75); ctx.closePath(); ctx.fill();
  } else if (sp.body === 'sword') {
    ctx.beginPath(); ctx.moveTo(bodyL, 0); ctx.quadraticCurveTo(bodyL * 0.3, -bodyH, -bodyL, 0); ctx.quadraticCurveTo(bodyL * 0.3, bodyH, bodyL, 0); ctx.closePath(); ctx.fill();
    ctx.fillStyle = shade(sp.c2, f.hueShift - 5);
    ctx.beginPath(); ctx.moveTo(-bodyL * 0.2, -bodyH * 0.7); ctx.lineTo(bodyL * 0.0, -bodyH * 1.6); ctx.lineTo(bodyL * 0.3, -bodyH * 0.6); ctx.closePath(); ctx.fill();
  } else if (sp.body === 'long') {
    ctx.beginPath();
    ctx.moveTo(bodyL, -bodyH * 0.15);
    ctx.quadraticCurveTo(bodyL * 0.85, -bodyH * 0.6, bodyL * 0.5, -bodyH * 0.85);
    ctx.quadraticCurveTo(-bodyL * 0.1, -bodyH * 1.0, -bodyL * 0.6, -bodyH * 0.75);
    ctx.quadraticCurveTo(-bodyL * 0.95, -bodyH * 0.7, -bodyL * 0.95, -bodyH * 0.25);
    ctx.quadraticCurveTo(-bodyL * 1.05, 0, -bodyL * 0.9, bodyH * 0.25);
    ctx.quadraticCurveTo(-bodyL * 0.9, bodyH * 0.6, -bodyL * 0.55, bodyH * 0.85);
    ctx.quadraticCurveTo(0, bodyH * 1.05, bodyL * 0.5, bodyH * 0.85);
    ctx.quadraticCurveTo(bodyL * 0.85, bodyH * 0.6, bodyL, bodyH * 0.15);
    ctx.closePath(); ctx.fill();
    ctx.fillStyle = shade(sp.c2, f.hueShift + 5);
    ctx.beginPath(); ctx.moveTo(-bodyL * 0.5, -bodyH * 0.6); ctx.quadraticCurveTo(0, -bodyH * 1.2, bodyL * 0.6, -bodyH * 0.55); ctx.closePath(); ctx.fill();
    ctx.beginPath(); ctx.ellipse(0, bodyH * 0.7, s * 0.32, s * 0.17, 0.5, 0, TAU); ctx.fill();
  } else if (sp.body === 'plump') {
    ellipse(0, 0, bodyL, bodyH); ctx.fill();
    ctx.fillStyle = shade(sp.c2, f.hueShift + 5);
    ctx.beginPath(); ctx.moveTo(-bodyL * 0.2, -bodyH * 0.68); ctx.quadraticCurveTo(0, -bodyH * 1.12, bodyL * 0.3, -bodyH * 0.62); ctx.closePath(); ctx.fill();
    ctx.beginPath(); ctx.ellipse(-bodyL * 0.15, bodyH * 0.55, s * 0.25, s * 0.14, 0.5, 0, TAU); ctx.fill();
  } else if (sp.body === 'koi') {
    ellipse(0, 0, bodyL, bodyH); ctx.fill();
    ctx.fillStyle = shade(sp.c2, f.hueShift + 5);
    ctx.beginPath(); ctx.moveTo(-bodyL * 0.4, -bodyH * 0.75); ctx.quadraticCurveTo(0, -bodyH * 1.4, bodyL * 0.4, -bodyH * 0.7); ctx.lineTo(bodyL * 0.22, -bodyH * 0.6); ctx.quadraticCurveTo(0, -bodyH * 0.95, -bodyL * 0.25, -bodyH * 0.6); ctx.closePath(); ctx.fill();
    ctx.beginPath(); ctx.ellipse(-bodyL * 0.15, bodyH * 0.55, s * 0.3, s * 0.16, 0.6, 0, TAU); ctx.fill();
    ctx.strokeStyle = shade(sp.c2, f.hueShift);
    ctx.lineWidth = Math.max(1, s * 0.05);
    ctx.beginPath(); ctx.moveTo(bodyL * 0.68, bodyH * 0.02); ctx.quadraticCurveTo(bodyL * 0.86, bodyH * 0.22, bodyL * 0.92, bodyH * 0.38); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(bodyL * 0.68, -bodyH * 0.04); ctx.quadraticCurveTo(bodyL * 0.84, -bodyH * 0.18, bodyL * 0.9, -bodyH * 0.32); ctx.stroke();
  } else if (sp.body === 'diy') {
    ellipse(0, 0, bodyL, bodyH); ctx.fill();
  } else {
    ellipse(0, 0, bodyL, bodyH); ctx.fill();
    ctx.fillStyle = shade(sp.c2, f.hueShift + 6);
    ctx.beginPath(); ctx.moveTo(-bodyL * 0.2, -bodyH * 0.68); ctx.lineTo(0, -bodyH * 1.3); ctx.lineTo(bodyL * 0.28, -bodyH * 0.68); ctx.closePath(); ctx.fill();
    ctx.fillStyle = shade(sp.c2, f.hueShift + 8);
    ctx.beginPath(); ctx.ellipse(-bodyL * 0.05, bodyH * 0.7, s * 0.28, s * 0.15, 0.6, 0, TAU); ctx.fill();
    ctx.beginPath(); ctx.moveTo(-bodyL * 0.12, bodyH * 0.55); ctx.lineTo(-bodyL * 0.3, bodyH * 1.0); ctx.lineTo(-bodyL * 0.0, bodyH * 0.72); ctx.closePath(); ctx.fill();
  }

  if (sp.body === 'diy' && sp.finType && sp.finType !== 'none') drawDiyFin(sp.finType, bodyL, bodyH, s, f);

  ctx.save(); clipBodyShape(sp, bodyL, bodyH);
  ctx.fillStyle = 'rgba(255,255,255,.25)';
  ctx.beginPath(); ctx.ellipse(-bodyL * 0.18, -bodyH * 0.5, bodyL * 0.34, bodyH * 0.2, -0.08, 0, TAU); ctx.fill();
  ctx.restore();

  if (sp.pattern === 'band') {
    ctx.save(); clipBodyShape(sp, bodyL, bodyH); ctx.fillStyle = 'rgba(255,255,255,.85)';
    const bw = s * 0.4; ctx.fillRect(bodyL * 0.1, -bodyH * 1.4, bw, bodyH * 2.8); ctx.fillRect(-bodyL * 0.5, -bodyH * 1.4, bw, bodyH * 2.8); ctx.restore();
  } else if (sp.pattern === 'stripe') {
    ctx.save(); clipBodyShape(sp, bodyL, bodyH); ctx.fillStyle = sp.patColor || 'rgba(255,255,255,.8)';
    ctx.fillRect(-bodyL * 1.2, -bodyH * 0.15, bodyL * 2.4, bodyH * 0.3); ctx.restore();
  } else if (sp.pattern === 'spot') {
    ctx.save(); clipBodyShape(sp, bodyL, bodyH); ctx.fillStyle = 'rgba(60,40,20,.35)';
    for (let i = 0; i < 5; i++) { const sx = rand(-bodyL, bodyL), sy = rand(-bodyH, bodyH); ctx.beginPath(); ctx.arc(sx, sy, s * 0.14, 0, TAU); ctx.fill(); }
    ctx.restore();
  } else if (sp.pattern === 'tailbar') {
    ctx.fillStyle = shade(sp.c1, f.hueShift + 30);
    ctx.beginPath(); ctx.moveTo(-bodyL * 0.55, -bodyH * 0.6); ctx.lineTo(-bodyL * 0.9, -bodyH * 0.6); ctx.lineTo(-bodyL * 0.9, bodyH * 0.6); ctx.lineTo(-bodyL * 0.55, bodyH * 0.6); ctx.closePath(); ctx.fill();
  }

  const mouthX = bodyL * 0.92;
  const hx = mouthX - s * 0.06, hy = bodyH * 0.02;
  const ux = mouthX + s * 0.16, uy = -bodyH * 0.18;
  const lx = mouthX + s * 0.16, ly = bodyH * 0.24;

  ctx.save();
  ctx.globalAlpha = 1;
  ctx.globalCompositeOperation = 'destination-out';
  ctx.beginPath();
  if (sp.body === 'sword') { ctx.moveTo(bodyL * 1.20, -bodyH * 0.04); ctx.lineTo(bodyL * 0.50, bodyH * 0.02); ctx.lineTo(bodyL * 1.02, bodyH * 0.16); }
  else { ctx.moveTo(hx, hy); ctx.lineTo(ux, uy); ctx.lineTo(lx, ly); }
  ctx.closePath(); ctx.fill();
  ctx.restore();

  if (sp.body === 'sword') {
    const cx = bodyL * 0.50, cy = bodyH * 0.02, bx = bodyL * 1.20, by = -bodyH * 0.04, jx = bodyL * 1.02, jy = bodyH * 0.16;
    ctx.fillStyle = shade(sp.c2, -22);
    ctx.beginPath(); ctx.moveTo(cx, cy - bodyH * 0.14); ctx.lineTo(bx, by); ctx.lineTo(cx, cy); ctx.closePath(); ctx.fill();
    ctx.beginPath(); ctx.moveTo(cx, cy + bodyH * 0.14); ctx.lineTo(jx, jy); ctx.lineTo(cx, cy); ctx.closePath(); ctx.fill();
  } else if (sp.body === 'shark') {
    ctx.strokeStyle = shade(sp.c2, -25); ctx.lineWidth = Math.max(1.3, s * 0.09); ctx.lineCap = 'round';
    ctx.beginPath(); ctx.moveTo(hx, hy); ctx.lineTo(ux, uy); ctx.moveTo(hx, hy); ctx.lineTo(lx, ly); ctx.stroke();
    ctx.fillStyle = '#fff';
    for (let i = 0; i < 6; i++) {
      const t = i / 5, tx = hx + (ux - hx) * t, ty = hy + (uy - hy) * t;
      ctx.beginPath(); ctx.moveTo(tx, ty); ctx.lineTo(tx + s * 0.045, ty); ctx.lineTo(tx + s * 0.022, ty + s * 0.16); ctx.closePath(); ctx.fill();
    }
    ctx.lineCap = 'butt';
  } else if (sp.id === 'black') {
    ctx.strokeStyle = shade(sp.c2, -25); ctx.lineWidth = s * 0.10; ctx.lineCap = 'round';
    ctx.beginPath(); ctx.moveTo(hx, hy); ctx.lineTo(ux, uy); ctx.moveTo(hx, hy); ctx.lineTo(lx, ly); ctx.stroke(); ctx.lineCap = 'butt';
  } else {
    ctx.strokeStyle = shade(sp.c2, -30); ctx.lineWidth = Math.max(1.3, s * 0.09); ctx.lineCap = 'round';
    ctx.beginPath(); ctx.moveTo(hx, hy); ctx.lineTo(ux, uy); ctx.moveTo(hx, hy); ctx.lineTo(lx, ly); ctx.stroke(); ctx.lineCap = 'butt';
  }

  const eScale = sp.eyeScale || 1;
  const eyeX = bodyL * 0.5, eyeY = -bodyH * 0.12;
  const eyeR = s * 0.2 * eScale;
  if (sp.eyeType) { drawDiyEye(sp.eyeType, eyeX, eyeY, eyeR, s); }
  else if (sp.eye) {
    ctx.fillStyle = sp.eye; ctx.beginPath(); ctx.arc(eyeX, eyeY, eyeR, 0, TAU); ctx.fill();
    ctx.fillStyle = '#12020a'; ctx.beginPath(); ctx.ellipse(eyeX, eyeY, eyeR * 0.18, eyeR * 0.62, 0, 0, TAU); ctx.fill();
    ctx.fillStyle = 'rgba(255,255,255,.85)'; ctx.beginPath(); ctx.arc(eyeX - eyeR * 0.3, eyeY - eyeR * 0.3, eyeR * 0.18, 0, TAU); ctx.fill();
  } else {
    ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.arc(eyeX, eyeY, eyeR, 0, TAU); ctx.fill();
    ctx.fillStyle = '#111'; ctx.beginPath(); ctx.arc(eyeX + s * 0.05 * eScale, eyeY, s * 0.11 * eScale, 0, TAU); ctx.fill();
    ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.arc(eyeX + s * 0.07 * eScale, eyeY - s * 0.04 * eScale, s * 0.04 * eScale, 0, TAU); ctx.fill();
  }

  ctx.restore();
  ctx = mainCtx;
  mainCtx.drawImage(fishLayer, f.x - FISH_W / 2, f.y - FISH_H / 2, FISH_W, FISH_H);
  drawPlayerLabel(f);
}

function drawPlayerLabel(f) {
  if (!f.isPlayer) return;
  ctx.save();
  ctx.translate(f.x, f.y - f.size - 22);
  ctx.fillStyle = f.playerIndex === 0 ? '#ffd23f' : '#24c26d';
  ctx.font = 'bold 16px ' + FONT;
  ctx.textAlign = 'center';
  ctx.fillText(f.playerIndex === 0 ? 'P1' : 'P2', 0, 0);
  if (f.dashCooldown > 0) {
    ctx.fillStyle = 'rgba(255,255,255,.35)'; ctx.fillRect(-16, 6, 32, 3);
    ctx.fillStyle = '#fff'; ctx.fillRect(-16, 6, 32 * (1 - f.dashCooldown / 1.4), 3);
  }
  ctx.restore();
}

function drawDiyTail(type, tailX, tailW, s, wag) {
  ctx.beginPath();
  if (type === 'fan') { ctx.moveTo(tailX, 0); ctx.quadraticCurveTo(tailX - s * 1.1, -tailW * 0.7 + wag * 5, tailX - s * 1.3, 0); ctx.quadraticCurveTo(tailX - s * 1.1, tailW * 0.7 + wag * 5, tailX, 0); }
  else if (type === 'fork') { ctx.moveTo(tailX, 0); ctx.lineTo(tailX - s * 1.2, -tailW * 0.6 + wag * 5); ctx.lineTo(tailX - s * 0.7, 0); ctx.lineTo(tailX - s * 1.2, tailW * 0.6 + wag * 5); }
  else if (type === 'round') { ctx.moveTo(tailX, 0); ctx.quadraticCurveTo(tailX - s * 0.6, -tailW * 0.55 + wag * 4, tailX - s * 0.8, 0); ctx.quadraticCurveTo(tailX - s * 0.6, tailW * 0.55 + wag * 4, tailX, 0); }
  else { ctx.moveTo(tailX, 0); ctx.lineTo(tailX - s * 1.1, -tailW * 0.45 + wag * 5); ctx.lineTo(tailX - s * 1.1, tailW * 0.45 + wag * 5); }
  ctx.closePath(); ctx.fill();
}
function drawDiyFin(type, bodyL, bodyH, s, f) {
  ctx.fillStyle = shade(f.species.c2, f.hueShift + 6);
  if (type === 'sail') { ctx.beginPath(); ctx.moveTo(-bodyL * 0.25, -bodyH * 0.7); ctx.quadraticCurveTo(0, -bodyH * 1.5, bodyL * 0.3, -bodyH * 0.62); ctx.closePath(); ctx.fill(); }
  else if (type === 'spike') { ctx.beginPath(); ctx.moveTo(-bodyL * 0.3, -bodyH * 0.6); ctx.lineTo(-bodyL * 0.05, -bodyH * 1.25); ctx.lineTo(0, -bodyH * 0.6); ctx.lineTo(bodyL * 0.2, -bodyH * 1.1); ctx.lineTo(bodyL * 0.35, -bodyH * 0.6); ctx.closePath(); ctx.fill(); }
  else if (type === 'wave') { ctx.beginPath(); ctx.moveTo(-bodyL * 0.35, -bodyH * 0.62); ctx.quadraticCurveTo(-bodyL * 0.2, -bodyH * 1.05, -bodyL * 0.05, -bodyH * 0.7); ctx.quadraticCurveTo(bodyL * 0.1, -bodyH * 1.15, bodyL * 0.3, -bodyH * 0.62); ctx.closePath(); ctx.fill(); }
  ctx.beginPath(); ctx.ellipse(-bodyL * 0.1, bodyH * 0.62, s * 0.28, s * 0.15, 0.6, 0, TAU); ctx.fill();
}
function drawDiyEye(type, eyeX, eyeY, eyeR, s) {
  if (type === 'big') { ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.arc(eyeX, eyeY, eyeR * 1.35, 0, TAU); ctx.fill(); ctx.fillStyle = '#111'; ctx.beginPath(); ctx.arc(eyeX + s * 0.05, eyeY, s * 0.14, 0, TAU); ctx.fill(); ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.arc(eyeX + s * 0.07, eyeY - s * 0.05, s * 0.05, 0, TAU); ctx.fill(); }
  else if (type === 'dot') { ctx.fillStyle = '#111'; ctx.beginPath(); ctx.arc(eyeX, eyeY, s * 0.09, 0, TAU); ctx.fill(); }
  else if (type === 'star') { ctx.fillStyle = '#ffd23f'; drawStar(eyeX, eyeY, eyeR * 1.1, eyeR * 0.45, 5); ctx.fill(); }
  else { ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.arc(eyeX, eyeY, eyeR, 0, TAU); ctx.fill(); ctx.fillStyle = '#111'; ctx.beginPath(); ctx.arc(eyeX + s * 0.05, eyeY, s * 0.11, 0, TAU); ctx.fill(); ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.arc(eyeX + s * 0.07, eyeY - s * 0.04, s * 0.04, 0, TAU); ctx.fill(); }
}
function drawStar(cx, cy, outer, inner, points) {
  ctx.beginPath();
  for (let i = 0; i < points * 2; i++) { const r = i % 2 === 0 ? outer : inner; const a = -Math.PI / 2 + i * Math.PI / points; const x = cx + Math.cos(a) * r, y = cy + Math.sin(a) * r; if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y); }
  ctx.closePath();
}

function shade(hex, amt) { const c = hexToRgb(hex); const r = clamp(c.r + amt, 0, 255), g = clamp(c.g + amt, 0, 255), b = clamp(c.b + amt, 0, 255); return `rgb(${r},${g},${b})`; }
function hexToRgb(hex) { const h = hex.replace('#', ''); return { r: parseInt(h.substring(0, 2), 16), g: parseInt(h.substring(2, 4), 16), b: parseInt(h.substring(4, 6), 16) }; }
function ellipse(x, y, rx, ry) { ctx.beginPath(); ctx.ellipse(x, y, rx, ry, 0, 0, TAU); }
function clipBodyShape(sp, bodyL, bodyH) {
  if (sp.body === 'shark') { ctx.beginPath(); ctx.moveTo(bodyL, 0); ctx.quadraticCurveTo(0, -bodyH, -bodyL, 0); ctx.quadraticCurveTo(0, bodyH, bodyL, 0); }
  else if (sp.body === 'sword') { ctx.beginPath(); ctx.moveTo(bodyL, 0); ctx.quadraticCurveTo(bodyL * 0.3, -bodyH, -bodyL, 0); ctx.quadraticCurveTo(bodyL * 0.3, bodyH, bodyL, 0); }
  else ellipse(0, 0, bodyL, bodyH);
  ctx.clip();
}

/* ============================================================
   VIP 高阶鱼种渲染（与 index.html 一致）
   ============================================================ */
function drawVipBody(sp, s, f, time, wag) {
  switch (sp.body) {
    case 'dragon': drawDragon(sp, s, f, time, wag); break;
    case 'mechshark': drawMechShark(sp, s, f, time, wag); break;
    case 'jelly': drawJelly(sp, s, f, time, wag); break;
    case 'demonray': drawDemonRay(sp, s, f, time, wag); break;
    case 'turtle': drawTurtle(sp, s, f, time, wag); break;
    case 'goldking': drawGoldKing(sp, s, f, time, wag); break;
  }
  // 【性能】低画质（FPS<35）关闭 VIP 高阶光效，仅保留基础模型
  if (Perf.quality === 2) return;
  switch (sp.fx) {
    case 'trail': fxTrail(sp, s, f, time); break;
    case 'thruster': fxThruster(sp, s, f, time); break;
    case 'stardust': fxStardust(sp, s, f, time); break;
    case 'flame': fxFlame(sp, s, f, time); break;
    case 'ice': fxIce(sp, s, f, time); break;
    case 'halo': fxHalo(sp, s, f, time); break;
  }
}
function vipEye(x, y, r, color) {
  ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.arc(x, y, r, 0, TAU); ctx.fill();
  ctx.fillStyle = color || '#111'; ctx.beginPath(); ctx.arc(x + r * 0.25, y, r * 0.55, 0, TAU); ctx.fill();
  ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.arc(x + r * 0.35, y - r * 0.2, r * 0.2, 0, TAU); ctx.fill();
}
function drawDragon(sp, s, f, time, wag) {
  const L = 2.2 * s, H = 0.46 * s, ph = time * 2.6;
  ctx.save();
  const grad = ctx.createLinearGradient(0, -H, 0, H);
  grad.addColorStop(0, shade(sp.c2, f.hueShift)); grad.addColorStop(0.45, shade(sp.c1, f.hueShift)); grad.addColorStop(1, shade(sp.belly, f.hueShift));
  ctx.fillStyle = grad;
  const seg = 9;
  for (let i = 0; i < seg; i++) {
    const t = i / (seg - 1);
    const px = L * (1 - t * 1.7) - L * 0.12;
    const py = Math.sin(t * Math.PI * 1.8 + ph) * H * 0.8 * t;
    const ang = Math.cos(t * Math.PI * 1.8 + ph) * 0.45 * t;
    ctx.beginPath(); ctx.ellipse(px, py, L * (0.17 + 0.13 * (1 - t)), H * (1 - t * 0.5), ang, 0, TAU); ctx.fill();
  }
  ctx.restore();
  ctx.fillStyle = shade(sp.c2, f.hueShift - 14);
  for (let i = 0; i < 6; i++) {
    const t = 0.12 + i * 0.14;
    const px = L * (1 - t * 1.7) - L * 0.12;
    const py = Math.sin(t * Math.PI * 1.8 + ph) * H * 0.8 * t - H * 0.7;
    ctx.beginPath(); ctx.moveTo(px - s * 0.08, py); ctx.lineTo(px, py - s * 0.3); ctx.lineTo(px + s * 0.08, py); ctx.closePath(); ctx.fill();
  }
  ctx.fillStyle = shade(sp.c1, f.hueShift + 6);
  ctx.beginPath(); ctx.moveTo(L, 0); ctx.quadraticCurveTo(L * 0.6, -H * 1.5, L * 0.22, -H * 0.6); ctx.quadraticCurveTo(L * 0.4, 0, L * 0.22, H * 0.6); ctx.quadraticCurveTo(L * 0.6, H * 1.5, L, 0); ctx.closePath(); ctx.fill();
  ctx.strokeStyle = shade(sp.c2, f.hueShift - 10); ctx.lineWidth = Math.max(1.5, s * 0.08); ctx.lineCap = 'round';
  ctx.beginPath(); ctx.moveTo(L * 0.5, -H * 0.7); ctx.lineTo(L * 0.58, -H * 1.7); ctx.lineTo(L * 0.7, -H * 1.15); ctx.stroke();
  ctx.beginPath(); ctx.moveTo(L * 0.58, -H * 1.7); ctx.lineTo(L * 0.62, -H * 2.0); ctx.stroke(); ctx.lineCap = 'butt';
  ctx.strokeStyle = shade(sp.c2, f.hueShift + 8); ctx.lineWidth = Math.max(1, s * 0.05);
  ctx.beginPath(); ctx.moveTo(L * 0.95, -H * 0.1); ctx.quadraticCurveTo(L * 1.3, H * 0.5 + Math.sin(time * 4) * H * 0.3, L * 1.45, H * 0.9 + Math.sin(time * 4) * H * 0.5); ctx.stroke();
  ctx.beginPath(); ctx.moveTo(L * 0.95, H * 0.05); ctx.quadraticCurveTo(L * 1.3, -H * 0.4 + Math.cos(time * 4) * H * 0.3, L * 1.45, -H * 0.8 + Math.cos(time * 4) * H * 0.5); ctx.stroke();
  vipEye(L * 0.72, -H * 0.35, s * 0.2, sp.eye);
}
function drawMechShark(sp, s, f, time, wag) {
  const L = 1.5 * s, H = 0.72 * s;
  const grad = ctx.createLinearGradient(0, -H, 0, H);
  grad.addColorStop(0, shade(sp.c2, f.hueShift)); grad.addColorStop(0.5, shade(sp.c1, f.hueShift)); grad.addColorStop(1, shade(sp.belly, f.hueShift));
  ctx.fillStyle = grad;
  ctx.beginPath(); ctx.moveTo(L, 0); ctx.quadraticCurveTo(0, -H, -L, 0); ctx.quadraticCurveTo(0, H, L, 0); ctx.closePath(); ctx.fill();
  ctx.fillStyle = shade(sp.c2, f.hueShift - 8);
  ctx.beginPath(); ctx.moveTo(-L * 0.15, -H * 0.7); ctx.lineTo(L * 0.05, -H * 1.75); ctx.lineTo(L * 0.48, -H * 0.6); ctx.closePath(); ctx.fill();
  ctx.beginPath(); ctx.moveTo(L * 0.05, H * 0.5); ctx.lineTo(-L * 0.3, H * 1.4); ctx.lineTo(L * 0.32, H * 0.8); ctx.closePath(); ctx.fill();
  ctx.strokeStyle = 'rgba(20,30,40,.55)'; ctx.lineWidth = Math.max(1, s * 0.035);
  ctx.beginPath(); ctx.moveTo(-L * 0.1, -H * 0.55); ctx.quadraticCurveTo(0, -H * 0.15, -L * 0.1, H * 0.55); ctx.moveTo(L * 0.25, -H * 0.5); ctx.quadraticCurveTo(L * 0.35, 0, L * 0.25, H * 0.5); ctx.stroke();
  ctx.fillStyle = 'rgba(230,240,250,.7)';
  for (let i = 0; i < 4; i++) { const t = -0.4 + i * 0.25; ctx.beginPath(); ctx.arc(L * t, -H * 0.28, Math.max(1, s * 0.035), 0, TAU); ctx.fill(); ctx.beginPath(); ctx.arc(L * t, H * 0.28, Math.max(1, s * 0.035), 0, TAU); ctx.fill(); }
  const ex = L * 0.5, ey = -H * 0.1, er = s * 0.22;
  ctx.fillStyle = sp.eye;
  ctx.beginPath(); ctx.ellipse(ex, ey, er * 0.9, er * 0.28, 0, 0, TAU); ctx.fill();
  ctx.fillStyle = 'rgba(255,255,255,.85)'; ctx.beginPath(); ctx.ellipse(ex + er * 0.5, ey, er * 0.22, er * 0.12, 0, 0, TAU); ctx.fill();
}
function drawJelly(sp, s, f, time, wag) {
  const L = 1.35 * s, H = 0.8 * s;
  ctx.save(); ctx.globalAlpha = 0.82;
  const grad = ctx.createLinearGradient(0, -H, 0, H);
  grad.addColorStop(0, shade(sp.c2, f.hueShift)); grad.addColorStop(0.55, shade(sp.c1, f.hueShift)); grad.addColorStop(1, shade(sp.belly, f.hueShift));
  ctx.fillStyle = grad;
  ctx.beginPath(); ctx.moveTo(L, 0); ctx.quadraticCurveTo(L * 0.7, -H * 1.5, -L * 0.5, -H * 0.9); ctx.quadraticCurveTo(-L * 0.9, -H * 0.55, -L * 0.8, H * 0.1); ctx.quadraticCurveTo(-L * 0.7, H * 0.7, -L * 0.1, H * 0.75); ctx.quadraticCurveTo(L * 0.5, H * 0.7, L, 0); ctx.closePath(); ctx.fill();
  ctx.restore();
  ctx.save(); ctx.globalAlpha = 0.9;
  for (let i = 0; i < 7; i++) {
    const px = L * (0.5 - (i % 4) * 0.22);
    const py = -H * (0.4 + (i % 3) * 0.3) + Math.sin(time * 2 + i) * H * 0.06;
    const tw = 0.5 + 0.5 * Math.sin(time * 3 + i * 1.7);
    ctx.fillStyle = 'rgba(255,255,255,' + (0.25 + tw * 0.4) + ')';
    ctx.beginPath(); ctx.arc(px, py, Math.max(1, s * 0.05), 0, TAU); ctx.fill();
  }
  ctx.restore();
  ctx.strokeStyle = shade(sp.c1, f.hueShift + 10); ctx.lineWidth = Math.max(1, s * 0.045); ctx.lineCap = 'round';
  for (let i = 0; i < 5; i++) {
    const tx = L * (0.7 - i * 0.35); const wob = Math.sin(time * 3 + i * 1.2) * H * 0.35;
    ctx.beginPath(); ctx.moveTo(tx, H * 0.5); ctx.quadraticCurveTo(tx - H * 0.2, H * 0.9 + wob, tx - H * 0.4, H * 1.5 + wob * 1.5); ctx.stroke();
  }
  ctx.lineCap = 'butt';
  vipEye(L * 0.55, -H * 0.35, s * 0.18, sp.eye);
}
function drawDemonRay(sp, s, f, time, wag) {
  const L = 1.9 * s, H = 0.85 * s;
  const grad = ctx.createLinearGradient(0, -H, 0, H);
  grad.addColorStop(0, shade(sp.c1, f.hueShift)); grad.addColorStop(0.5, shade(sp.c2, f.hueShift)); grad.addColorStop(1, shade(sp.belly, f.hueShift));
  ctx.fillStyle = grad;
  ctx.beginPath(); ctx.moveTo(L, 0); ctx.quadraticCurveTo(L * 0.5, -H * 1.4, -L * 0.6, -H * 1.25); ctx.quadraticCurveTo(-L * 1.05, -H * 0.3, -L * 0.7, 0); ctx.quadraticCurveTo(-L * 1.05, H * 0.3, -L * 0.6, H * 1.25); ctx.quadraticCurveTo(L * 0.5, H * 1.4, L, 0); ctx.closePath(); ctx.fill();
  ctx.fillStyle = shade(sp.c2, f.hueShift - 8);
  ctx.beginPath(); ctx.moveTo(L * 0.55, -H * 0.5); ctx.lineTo(L * 0.72, -H * 1.5); ctx.lineTo(L * 0.85, -H * 0.45); ctx.closePath(); ctx.fill();
  ctx.beginPath(); ctx.moveTo(L * 0.6, -H * 0.35); ctx.lineTo(L * 0.8, -H * 1.15); ctx.lineTo(L * 0.95, -H * 0.3); ctx.closePath(); ctx.fill();
  ctx.strokeStyle = sp.eye; ctx.lineWidth = Math.max(1, s * 0.045);
  ctx.beginPath(); ctx.moveTo(L * 0.7, 0); ctx.quadraticCurveTo(L * 0.3, -H * 0.5, L * 0.1, -H * 1.0); ctx.stroke();
  ctx.beginPath(); ctx.moveTo(L * 0.7, 0); ctx.quadraticCurveTo(L * 0.3, H * 0.5, L * 0.1, H * 1.0); ctx.stroke();
  ctx.strokeStyle = shade(sp.c2, f.hueShift - 5); ctx.lineWidth = Math.max(1.2, s * 0.05); ctx.lineCap = 'round';
  ctx.beginPath(); ctx.moveTo(-L * 0.85, 0); ctx.quadraticCurveTo(-L * 1.2, Math.sin(time * 4) * H * 0.3, -L * 1.5, Math.sin(time * 4 + 1) * H * 0.5); ctx.stroke(); ctx.lineCap = 'butt';
  vipEye(L * 0.55, -H * 0.25, s * 0.16, sp.eye);
}
function drawTurtle(sp, s, f, time, wag) {
  const L = 1.5 * s, H = 0.8 * s;
  ctx.fillStyle = shade(sp.c1, f.hueShift + 4);
  ctx.beginPath(); ctx.ellipse(L * 0.75, 0, s * 0.34, s * 0.26, 0, 0, TAU); ctx.fill();
  const fl = Math.sin(time * 3) * H * 0.3;
  ctx.fillStyle = shade(sp.c2, f.hueShift - 4);
  ctx.beginPath(); ctx.ellipse(-L * 0.1, H * 0.85, s * 0.4, s * 0.18, 0.5 + fl * 0.3, 0, TAU); ctx.fill();
  ctx.beginPath(); ctx.ellipse(-L * 0.55, H * 0.85, s * 0.35, s * 0.16, 0.5 - fl * 0.3, 0, TAU); ctx.fill();
  const grad = ctx.createLinearGradient(0, -H, 0, H);
  grad.addColorStop(0, shade(sp.c2, f.hueShift)); grad.addColorStop(0.6, shade(sp.c1, f.hueShift)); grad.addColorStop(1, shade(sp.belly, f.hueShift));
  ctx.fillStyle = grad;
  ctx.beginPath(); ctx.moveTo(-L * 0.7, H * 0.4); ctx.quadraticCurveTo(-L * 0.8, -H * 1.1, 0, -H * 1.1); ctx.quadraticCurveTo(L * 0.8, -H * 1.1, L * 0.7, H * 0.4); ctx.quadraticCurveTo(0, H * 0.7, -L * 0.7, H * 0.4); ctx.closePath(); ctx.fill();
  ctx.save();
  ctx.beginPath(); ctx.moveTo(-L * 0.7, H * 0.4); ctx.quadraticCurveTo(-L * 0.8, -H * 1.1, 0, -H * 1.1); ctx.quadraticCurveTo(L * 0.8, -H * 1.1, L * 0.7, H * 0.4); ctx.quadraticCurveTo(0, H * 0.7, -L * 0.7, H * 0.4); ctx.closePath(); ctx.clip();
  const sweep = ((time * 1.2 % 2) - 1) * L * 2.2;
  const ag = ctx.createLinearGradient(sweep - L, 0, sweep + L, 0);
  ag.addColorStop(0, 'rgba(90,216,255,0)'); ag.addColorStop(0.5, 'rgba(140,255,220,.85)'); ag.addColorStop(1, 'rgba(200,120,255,0)');
  ctx.fillStyle = ag; ctx.fillRect(-L * 2, -H * 2, L * 4, H * 4);
  ctx.restore();
  ctx.fillStyle = 'rgba(160,240,255,.8)';
  ctx.beginPath(); ctx.moveTo(-L * 0.1, -H * 0.95); ctx.lineTo(L * 0.02, -H * 1.5); ctx.lineTo(L * 0.16, -H * 0.95); ctx.closePath(); ctx.fill();
  vipEye(L * 0.82, -H * 0.15, s * 0.16, sp.eye);
}
function drawGoldKing(sp, s, f, time, wag) {
  const L = 1.55 * s, H = 0.72 * s;
  const grad = ctx.createLinearGradient(0, -H, 0, H);
  grad.addColorStop(0, shade(sp.c2, f.hueShift)); grad.addColorStop(0.45, shade(sp.c1, f.hueShift)); grad.addColorStop(1, shade(sp.belly, f.hueShift));
  ctx.fillStyle = grad;
  ctx.beginPath(); ctx.moveTo(L, 0); ctx.quadraticCurveTo(0, -H, -L, 0); ctx.quadraticCurveTo(0, H, L, 0); ctx.closePath(); ctx.fill();
  ctx.fillStyle = shade(sp.c2, f.hueShift - 10);
  ctx.beginPath(); ctx.moveTo(-L * 0.15, -H * 0.72); ctx.lineTo(L * 0.05, -H * 1.75); ctx.lineTo(L * 0.48, -H * 0.62); ctx.closePath(); ctx.fill();
  ctx.beginPath(); ctx.moveTo(L * 0.05, H * 0.5); ctx.lineTo(-L * 0.3, H * 1.4); ctx.lineTo(L * 0.32, H * 0.8); ctx.closePath(); ctx.fill();
  ctx.save();
  ctx.beginPath(); ctx.moveTo(L, 0); ctx.quadraticCurveTo(0, -H, -L, 0); ctx.quadraticCurveTo(0, H, L, 0); ctx.closePath(); ctx.clip();
  const hg = ctx.createLinearGradient(0, -H, 0, H * 0.2); hg.addColorStop(0, 'rgba(255,255,255,.75)'); hg.addColorStop(1, 'rgba(255,255,255,0)');
  ctx.fillStyle = hg; ctx.fillRect(-L, -H, L * 2, H * 1.4);
  ctx.restore();
  ctx.fillStyle = '#ffe08a';
  ctx.beginPath(); ctx.moveTo(L * 0.28, -H * 0.9); ctx.lineTo(L * 0.28, -H * 1.7); ctx.lineTo(L * 0.42, -H * 1.15); ctx.lineTo(L * 0.55, -H * 1.8); ctx.lineTo(L * 0.68, -H * 1.1); ctx.lineTo(L * 0.8, -H * 0.85); ctx.closePath(); ctx.fill();
  ctx.fillStyle = '#ff2b4a'; ctx.beginPath(); ctx.arc(L * 0.55, -H * 1.25, s * 0.07, 0, TAU); ctx.fill();
  vipEye(L * 0.5, -H * 0.14, s * 0.19, sp.eye);
}

/* 专属特效层（time + 固定相位驱动，避免每帧随机闪烁） */
function fxTrail(sp, s, f, time) {
  const L = 1.5 * s, H = 0.65 * s;
  for (let i = 1; i <= 4; i++) {
    const a = 0.28 * (1 - i / 5); const ox = -L * 0.3 * i - Math.sin(time * 5) * s * 0.1;
    ctx.save(); ctx.globalAlpha = a; ctx.fillStyle = sp.glow;
    ctx.beginPath(); ctx.ellipse(-L * 0.6 + ox * 0.3, 0, L * 0.55 * (1 - i * 0.12), H * (1 - i * 0.12), 0, 0, TAU); ctx.fill();
    ctx.restore();
  }
}
function fxThruster(sp, s, f, time) {
  const L = 1.5 * s, H = 0.72 * s; const flick = 0.75 + 0.25 * Math.sin(time * 22);
  ctx.save();
  const g = ctx.createLinearGradient(-L * 0.85, 0, -L * 1.6, 0);
  g.addColorStop(0, 'rgba(255,255,255,.9)'); g.addColorStop(0.3, 'rgba(255,150,60,.9)'); g.addColorStop(1, 'rgba(255,40,40,0)');
  ctx.fillStyle = g;
  ctx.beginPath(); ctx.moveTo(-L * 0.85, -H * 0.35 * flick); ctx.lineTo(-L * 1.6, 0); ctx.lineTo(-L * 0.85, H * 0.35 * flick); ctx.closePath(); ctx.fill();
  ctx.restore();
}
function fxStardust(sp, s, f, time) {
  const R = s * 1.15;
  for (let i = 0; i < 8; i++) {
    const a = i / 8 * TAU + time * 0.9; const rr = R * (0.6 + 0.4 * Math.sin(time * 2 + i * 1.3));
    const px = Math.cos(a) * rr, py = Math.sin(a) * rr * 0.7; const tw = 0.5 + 0.5 * Math.sin(time * 4 + i * 2.1);
    ctx.save(); ctx.globalAlpha = 0.4 + tw * 0.5; ctx.fillStyle = sp.glow;
    ctx.beginPath(); ctx.arc(px, py, Math.max(1, s * 0.05 * (0.5 + tw)), 0, TAU); ctx.fill();
    ctx.restore();
  }
}
function fxFlame(sp, s, f, time) {
  const L = 1.5 * s, H = 0.72 * s;
  for (let i = 0; i < 6; i++) {
    const t = (i / 6) * 2 - 1; const px = L * t;
    const lift = (time * 1.6 + i * 0.35) % 1; const py = H * (0.6 + lift * 0.9);
    const sz = s * (0.12 + 0.1 * Math.sin(time * 6 + i)) * (1 - lift * 0.6);
    ctx.save(); ctx.globalAlpha = 0.5 * (1 - lift); ctx.fillStyle = lift < 0.5 ? '#ff8a3a' : '#ff2b2b';
    ctx.beginPath(); ctx.arc(px, py, Math.max(0.5, sz), 0, TAU); ctx.fill();
    ctx.restore();
  }
}
function fxIce(sp, s, f, time) {
  for (let i = 0; i < 7; i++) {
    const a = i / 7 * TAU + time * 0.5; const rr = s * (0.7 + 0.5 * Math.sin(time * 1.8 + i * 2.4));
    const px = Math.cos(a) * rr, py = Math.sin(a) * rr * 0.7 - s * 0.2; const tw = 0.5 + 0.5 * Math.sin(time * 3 + i * 1.9);
    ctx.save(); ctx.globalAlpha = 0.4 + tw * 0.5; ctx.strokeStyle = '#d6f4ff'; ctx.fillStyle = 'rgba(214,244,255,.9)'; ctx.lineWidth = Math.max(1, s * 0.02);
    const cs = Math.max(1.5, s * 0.09 * (0.6 + tw * 0.4));
    ctx.beginPath();
    for (let k = 0; k < 6; k++) { const ang = k / 6 * TAU; const x1 = Math.cos(ang) * cs, y1 = Math.sin(ang) * cs; if (k === 0) ctx.moveTo(px + x1, py + y1); else ctx.lineTo(px + x1, py + y1); }
    ctx.closePath(); ctx.fill();
    ctx.restore();
  }
}
function fxHalo(sp, s, f, time) {
  const L = 1.55 * s;
  for (let i = 0; i < 3; i++) {
    const rr = s * (0.9 + i * 0.18) + Math.sin(time * 2 + i) * s * 0.04;
    ctx.save(); ctx.globalAlpha = 0.5 - i * 0.13; ctx.strokeStyle = sp.glow; ctx.lineWidth = Math.max(1, s * 0.05 * (1 - i * 0.25));
    ctx.beginPath(); ctx.arc(-L * 0.4, 0, rr, 0, TAU); ctx.stroke();
    ctx.restore();
  }
}

/* ---------- 海底氛围元素 ---------- */
const corals = [
  { fx: 0.10, fy: 0.93, s: 0.05, c: 'rgba(42,150,158,.26)' },
  { fx: 0.34, fy: 0.96, s: 0.04, c: 'rgba(36,140,150,.22)' },
  { fx: 0.66, fy: 0.94, s: 0.045, c: 'rgba(40,148,155,.24)' },
  { fx: 0.86, fy: 0.95, s: 0.05, c: 'rgba(44,152,160,.26)' },
];
const seaweed = [];
(function initSeaweed() {
  for (let i = 0; i < 16; i++) seaweed.push({ fx: (i + 0.5) / 16 + rand(-0.015, 0.015), hf: rand(0.12, 0.3), ph: rand(0, TAU), front: i % 2 === 1, w: rand(6, 14) });
})();
function drawDistantReef() {
  const mounds = [
    { fx: 0.05, w: 0.30, h: 0.12, c: 'rgba(20,100,135,.30)' },
    { fx: 0.48, w: 0.34, h: 0.16, c: 'rgba(16,88,122,.26)' },
    { fx: 0.90, w: 0.28, h: 0.11, c: 'rgba(22,104,140,.28)' },
  ];
  for (const m of mounds) {
    const x = m.fx * W, y = H; const r = m.w * W;
    const grad = ctx.createRadialGradient(x, y, r * 0.1, x, y, r);
    grad.addColorStop(0, m.c); grad.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = grad; ctx.fillRect(x - r, y - m.h * H * 2, r * 2, m.h * H * 2);
  }
  for (const c of corals) {
    const x = c.fx * W, y = c.fy * H, s = c.s * Math.min(W, H);
    ctx.fillStyle = c.c;
    for (let i = -2; i <= 2; i++) {
      const ang = -Math.PI / 2 + i * 0.42; const r = s * (1.15 - Math.abs(i) * 0.2);
      ctx.beginPath(); ctx.arc(x + Math.cos(ang) * r * 0.55, y - Math.sin(ang) * r * 0.35, r * 0.55, 0, TAU); ctx.fill();
    }
  }
}
function drawBlade(x, baseY, len, sway, width, color) {
  ctx.fillStyle = color;
  const tipX = x + sway, tipY = baseY - len, cy = baseY - len * 0.55;
  ctx.beginPath(); ctx.moveTo(x - width * 0.5, baseY); ctx.quadraticCurveTo(x - width * 0.5 + sway * 0.4, cy, tipX, tipY); ctx.quadraticCurveTo(x + width * 0.5 + sway * 0.4, cy, x + width * 0.5, baseY); ctx.closePath(); ctx.fill();
}
function drawSeaweed(layer) {
  for (const s of seaweed) {
    const isFront = layer === 'front'; if (s.front !== isFront) continue;
    const x = s.fx * W, baseY = H, len = s.hf * H; const t = ambientT * 0.8 + s.ph; const sway = Math.sin(t) * len * 0.16;
    if (isFront) {
      drawBlade(x, baseY, len, sway, s.w, 'rgba(20,118,128,.82)');
      drawBlade(x, baseY, len * 0.7, sway * 0.7, s.w * 0.68, 'rgba(26,150,148,.72)');
      drawBlade(x + s.w * 0.6, baseY, len * 0.5, -sway * 0.6, s.w * 0.58, 'rgba(16,102,116,.8)');
    } else {
      drawBlade(x, baseY, len * 0.82, sway, s.w * 0.9, 'rgba(80,196,196,.30)');
    }
  }
}
function drawBubbles() {
  for (const b of bubbles) {
    ctx.fillStyle = 'rgba(255,255,255,.14)'; ctx.beginPath(); ctx.arc(b.x, b.y, b.r, 0, TAU); ctx.fill();
    ctx.strokeStyle = 'rgba(255,255,255,.42)'; ctx.lineWidth = 1; ctx.stroke();
    ctx.fillStyle = 'rgba(255,255,255,.6)'; ctx.beginPath(); ctx.arc(b.x - b.r * 0.32, b.y - b.r * 0.32, b.r * 0.3, 0, TAU); ctx.fill();
  }
}
function drawTrail(f) {
  const tr = f.trail; if (!tr || tr.length < 2) return;
  const q = Perf.quality; const step = q === 0 ? 1 : (q === 1 ? 2 : 0);
  if (step === 0) return;
  const alphaMul = q === 1 ? 0.6 : 1;
  for (let i = 0; i < tr.length; i += step) {
    const p = tr[i], k = i / tr.length;
    ctx.globalAlpha = k * k * 0.2 * alphaMul; ctx.fillStyle = f.species.c1;
    ctx.beginPath(); ctx.arc(p.x, p.y, f.size * 0.45 * k, 0, TAU); ctx.fill();
  }
  ctx.globalAlpha = 1;
}
function buildBackground() {
  if (!bgCtx || W === 0 || H === 0) return;
  const savedCtx = ctx; ctx = bgCtx;
  ctx.clearRect(0, 0, W, H);
  // 深海垂直渐变：顶部透光青蓝 → 中层深蓝 → 底部近黑，拉开纵深
  const g = ctx.createLinearGradient(0, 0, 0, H);
  g.addColorStop(0, '#2a8fb8');
  g.addColorStop(0.18, '#0e5a86');
  g.addColorStop(0.45, '#0a4370');
  g.addColorStop(0.72, '#072f56');
  g.addColorStop(0.9, '#041d3c');
  g.addColorStop(1, '#020d1c');
  ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
  // 顶部透光带（丁达尔光源的底色，动态光柱在 drawBackground 里叠加）
  const glow = ctx.createRadialGradient(W * 0.5, -H * 0.1, 0, W * 0.5, -H * 0.1, H * 0.95);
  glow.addColorStop(0, 'rgba(160,230,255,.20)');
  glow.addColorStop(1, 'rgba(160,230,255,0)');
  ctx.fillStyle = glow; ctx.fillRect(0, 0, W, H);
  drawDistantReef(); drawSeaweed('back');
  ctx = savedCtx;
}
/* ---------- 丁达尔光束（从海面射入的 god rays） ---------- */
// 光柱参数：fx 基准横向位置、w 宽度、sp 摆动频率、ph 相位、a 透明度
const GOD_RAYS = [
  { fx: 0.16, w: 0.20, sp: 0.05, ph: 0.0, a: 0.15 },
  { fx: 0.40, w: 0.26, sp: 0.04, ph: 1.7, a: 0.12 },
  { fx: 0.66, w: 0.16, sp: 0.06, ph: 3.1, a: 0.14 },
  { fx: 0.88, w: 0.22, sp: 0.04, ph: 4.4, a: 0.10 },
];
function drawGodRays(t) {
  ctx.save();
  for (const r of GOD_RAYS) {
    const sway = Math.sin(t * r.sp + r.ph) * W * 0.03;      // 轻微左右摆动
    const cx = r.fx * W + sway;
    const topW = r.w * W * 0.5;
    const botW = r.w * W * 1.5;
    const g = ctx.createLinearGradient(0, 0, 0, H * 0.85);
    g.addColorStop(0, 'rgba(200,240,255,' + r.a + ')');
    g.addColorStop(0.7, 'rgba(150,220,255,' + (r.a * 0.4) + ')');
    g.addColorStop(1, 'rgba(150,220,255,0)');
    ctx.fillStyle = g;
    // 上窄下宽的锥形光柱
    ctx.beginPath();
    ctx.moveTo(cx - topW, 0);
    ctx.lineTo(cx + topW, 0);
    ctx.lineTo(cx + botW, H * 0.85);
    ctx.lineTo(cx - botW, H * 0.85);
    ctx.closePath();
    ctx.fill();
  }
  ctx.restore();
}

/* ---------- 视差滚动工具 ---------- */
// 把基准 x（0..span）随时间向左滚动 speed 像素/秒并循环；speed 越大视觉越“近”
function scrollX(x, t, speed, span) {
  return ((x - t * speed) % span + span) % span;
}
const PARALLAX_SPAN = 1.6;   // 装饰元素横向分布范围（相对 W 的倍数），保证循环无缝

/* ---------- 中景礁石 / 岩石剪影（视差慢速漂移） ---------- */
const PARALLAX_ROCKS = [
  { fx: 0.08, fy: 0.90, s: 0.34, sp: 7,  ph: 0.0 },
  { fx: 0.36, fy: 0.94, s: 0.26, sp: 9,  ph: 2.1 },
  { fx: 0.62, fy: 0.88, s: 0.40, sp: 6,  ph: 4.0 },
  { fx: 0.86, fy: 0.92, s: 0.30, sp: 8,  ph: 5.2 },
];
function drawParallaxRocks(t) {
  const span = W * PARALLAX_SPAN;
  ctx.save();
  for (const r of PARALLAX_ROCKS) {
    const x = scrollX(r.fx * span, t, r.sp, span) - W * 0.3;
    const y = r.fy * H;
    const s = r.s * Math.min(W, H);
    // 岩石剪影：不规则多边形，深蓝半透明
    const grad = ctx.createLinearGradient(0, y - s, 0, y);
    grad.addColorStop(0, 'rgba(14,52,82,.34)');
    grad.addColorStop(1, 'rgba(6,26,48,.5)');
    ctx.fillStyle = grad;
    ctx.beginPath();
    ctx.moveTo(x - s, y);
    ctx.quadraticCurveTo(x - s * 0.8, y - s * 0.7, x - s * 0.3, y - s * 0.9);
    ctx.quadraticCurveTo(x, y - s * 1.1, x + s * 0.3, y - s * 0.85);
    ctx.quadraticCurveTo(x + s * 0.7, y - s * 0.6, x + s, y);
    ctx.closePath();
    ctx.fill();
  }
  ctx.restore();
}

/* ---------- 远处小鱼群（中景，视差漂移） ---------- */
const FISH_SHOALS = [
  { y: 0.22, n: 9,  sp: 16, amp: 0.04, ph: 0.0, sc: 3.4, a: 0.42 },
  { y: 0.56, n: 12, sp: 11, amp: 0.06, ph: 2.2, sc: 2.8, a: 0.36 },
  { y: 0.38, n: 7,  sp: 21, amp: 0.03, ph: 4.0, sc: 2.4, a: 0.30 },
];
function drawFishShoals(t) {
  const span = W * PARALLAX_SPAN;
  ctx.save();
  for (const s of FISH_SHOALS) {
    ctx.fillStyle = 'rgba(120,210,240,' + s.a + ')';
    for (let i = 0; i < s.n; i++) {
      const x = scrollX(i * span / s.n + s.ph * 40, t, s.sp, span) - W * 0.3;
      const y = s.y * H + Math.sin(t * 1.4 + i * 0.8 + s.ph) * s.amp * H;
      const sc = s.sc;
      // 小鱼剪影：椭圆身体 + 三角尾
      ctx.beginPath(); ctx.ellipse(x, y, sc * 2.2, sc * 0.9, 0, 0, TAU); ctx.fill();
      ctx.beginPath(); ctx.moveTo(x - sc * 2.2, y); ctx.lineTo(x - sc * 3.6, y - sc * 1.1); ctx.lineTo(x - sc * 3.6, y + sc * 1.1); ctx.closePath(); ctx.fill();
    }
  }
  ctx.restore();
}

/* ---------- 水母剪影（中景，缓慢漂移 + 上下浮动） ---------- */
const JELLYFISH = [
  { fx: 0.18, fy: 0.30, s: 0.09, sp: 6,  ph: 0.0 },
  { fx: 0.55, fy: 0.20, s: 0.13, sp: 5,  ph: 2.4 },
  { fx: 0.82, fy: 0.34, s: 0.07, sp: 7,  ph: 4.6 },
];
function drawJellyfish(x, y, s, t) {
  ctx.save();
  const bob = Math.sin(t * 0.7 + s * 20) * s * 0.6;   // 上下呼吸感
  y += bob;
  const col = 'rgba(140,210,245,0.30)';
  // 半透明伞盖 + 伞底厚边
  ctx.fillStyle = col;
  ctx.beginPath(); ctx.arc(x, y, s, Math.PI, 0); ctx.closePath(); ctx.fill();
  ctx.beginPath(); ctx.ellipse(x, y, s, s * 0.22, 0, 0, TAU); ctx.fill();
  // 触须
  ctx.strokeStyle = col; ctx.lineWidth = Math.max(1, s * 0.07); ctx.lineCap = 'round';
  for (let i = -2; i <= 2; i++) {
    const tx = x + i * s * 0.32;
    const sw = Math.sin(t * 1.3 + i * 1.1) * s * 0.22;
    ctx.beginPath();
    ctx.moveTo(tx, y);
    ctx.quadraticCurveTo(tx + sw, y + s * 0.9, tx + sw * 1.6, y + s * 1.7 + (i % 2) * s * 0.4);
    ctx.stroke();
  }
  ctx.restore();
}
function drawJellyfishLayer(t) {
  const span = W * PARALLAX_SPAN;
  for (const j of JELLYFISH) {
    const x = scrollX(j.fx * span, t, j.sp, span) - W * 0.3;
    drawJellyfish(x, j.fy * H, j.s * Math.min(W, H), t + j.ph);
  }
}
/* ---------- 对局动态深海背景（远/中/近分层 + 视差） ---------- */
function drawBackground() {
  // 远景：静态渐变水体 + 礁石珊瑚 + 远景海草（离屏缓存，零每帧开销）
  ctx.drawImage(bgLayer, 0, 0, W, H);
  // 远景动态：丁达尔光束
  drawGodRays(ambientT);
  // 中景动态：礁石剪影 / 小鱼群 / 水母，以不同速度滚动形成视差
  drawParallaxRocks(ambientT);
  if (Perf.quality < 2) drawFishShoals(ambientT);
  drawJellyfishLayer(ambientT);
}

/* ---------- 主页深海海报背景（更精致、聚焦角色区） ---------- */
function drawHomeBackground() {
  const t = ambientT;
  // 深海渐变底 + 远景
  ctx.drawImage(bgLayer, 0, 0, W, H);
  ctx.save();
  // 海报感丁达尔光束（集中在角色区上方，更强对比）
  const rays = [
    { fx: 0.30, w: 0.34, sp: 0.04, ph: 0.0, a: 0.20 },
    { fx: 0.58, w: 0.26, sp: 0.05, ph: 2.0, a: 0.14 },
  ];
  for (const r of rays) {
    const sway = Math.sin(t * r.sp + r.ph) * W * 0.02;
    const cx = r.fx * W + sway, topW = r.w * W * 0.4, botW = r.w * W * 1.6;
    const g = ctx.createLinearGradient(0, 0, 0, H * 0.9);
    g.addColorStop(0, 'rgba(220,246,255,' + r.a + ')');
    g.addColorStop(1, 'rgba(160,225,255,0)');
    ctx.fillStyle = g;
    ctx.beginPath(); ctx.moveTo(cx - topW, 0); ctx.lineTo(cx + topW, 0); ctx.lineTo(cx + botW, H * 0.9); ctx.lineTo(cx - botW, H * 0.9); ctx.closePath(); ctx.fill();
  }
  // 角色区（左列）背后的柔光焦点
  const focal = ctx.createRadialGradient(W * 0.3, H * 0.42, 0, W * 0.3, H * 0.42, W * 0.55);
  focal.addColorStop(0, 'rgba(90,200,255,.16)');
  focal.addColorStop(1, 'rgba(90,200,255,0)');
  ctx.fillStyle = focal; ctx.fillRect(0, 0, W, H);
  ctx.restore();
  // 漂浮浮游生物光点
  drawHomeMotes(t);
  // 边缘暗角，突出中央内容
  const vig = ctx.createRadialGradient(W * 0.5, H * 0.5, H * 0.35, W * 0.5, H * 0.5, H * 0.9);
  vig.addColorStop(0, 'rgba(2,10,24,0)');
  vig.addColorStop(1, 'rgba(2,10,24,.5)');
  ctx.fillStyle = vig; ctx.fillRect(0, 0, W, H);
  // 中景水母 + 小鱼群增强层次
  if (Perf.quality < 2) { drawFishShoals(t); drawJellyfishLayer(t); }
}

/* 主页漂浮光点（浮游生物 / 尘埃，缓慢上升，数量受控） */
const HOME_MOTES = [];
(function initHomeMotes() {
  for (let i = 0; i < 26; i++) HOME_MOTES.push({ x: rand(0, W), y: rand(0, H), r: rand(0.6, 2.4), sp: rand(6, 18), ph: rand(0, TAU) });
})();
function drawHomeMotes(t) {
  ctx.save();
  for (const m of HOME_MOTES) {
    const y = ((m.y - t * m.sp) % H + H) % H;
    let x = (m.x + Math.sin(t * 0.5 + m.ph) * 18) % W;
    if (x < 0) x += W;
    ctx.fillStyle = 'rgba(190,235,255,.35)';
    ctx.beginPath(); ctx.arc(x, y, m.r, 0, TAU); ctx.fill();
  }
  ctx.restore();
}
function drawScene() {
  const drawList = [...Game.fishes.filter(f => f.alive), ...Game.players.filter(p => p.alive)];
  drawList.sort((a, b) => a.size - b.size);
  const margin = 80;   // 【性能】屏幕外剔除：移出视野的鱼不绘制
  for (const f of drawList) {
    if (f.x < -margin || f.x > W + margin || f.y < -margin || f.y > H + margin) continue;
    drawTrail(f); drawFishBody(f, Game.time);
  }
  for (const pt of particles) {
    ctx.globalAlpha = clamp(pt.life / pt.max, 0, 1); ctx.fillStyle = pt.color;
    ctx.beginPath(); ctx.arc(pt.x, pt.y, pt.size, 0, TAU); ctx.fill();
  }
  ctx.globalAlpha = 1;
  drawSeaweed('front');
}
function drawHUD() {
  if (Game.state === 'menu') return;
  const pad = 16; const players = Game.players;
  if (Game.mode === 'single') drawPlayerHUD(players[0], pad, pad, '#7fd7ff', true);
  else {
    drawPlayerHUD(players[0], pad, pad, '#ffd23f', false);
    if (players[1]) drawPlayerHUD(players[1], W - 236 - pad, pad, '#24c26d', false);
    const total = Math.floor(players[0].score + (players[1] ? players[1].score : 0));
    ctx.save(); ctx.fillStyle = 'rgba(10,55,90,.5)'; roundRect(W / 2 - 90, pad, 180, 42, 14); ctx.fill();
    ctx.strokeStyle = 'rgba(150,220,255,.28)'; ctx.lineWidth = 1.5; roundRect(W / 2 - 90, pad, 180, 42, 14); ctx.stroke();
    ctx.fillStyle = '#ffd23f'; ctx.font = 'bold 22px ' + FONT; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillText('总分 ' + total, W / 2, pad + 21); ctx.restore();
  }
  const p0 = players[0];
  if (p0 && p0.combo >= 2 && p0.comboTime > 0) {
    ctx.save(); ctx.fillStyle = '#ff7a1a'; ctx.font = '900 34px ' + FONT; ctx.textAlign = 'center';
    ctx.fillText(`${p0.combo} 连击 x${Game.comboMul(p0).toFixed(1)}`, W / 2, Game.mode === 'single' ? 52 : 86); ctx.restore();
  }
  for (const p of players) {
    if (!p.alive) continue;
    let threat = null, td = 1e9;
    for (const f of Game.fishes) {
      if (!f.alive || f.size <= p.size * 1.15) continue;
      const d = dist2(p.x, p.y, f.x, f.y);
      if (d < td && d < 620 * 620) { td = d; threat = f; }
    }
    if (threat) {
      const a = Math.atan2(threat.y - p.y, threat.x - p.x); const r = 78;
      const col = p.playerIndex === 0 ? '#ffd23f' : '#24c26d';
      ctx.save(); ctx.globalAlpha = 0.55 + Math.sin(Game.time * 6) * 0.3; ctx.fillStyle = '#ff5a5a';
      ctx.beginPath(); ctx.arc(p.x + Math.cos(a) * r, p.y + Math.sin(a) * r, 11, 0, TAU); ctx.fill();
      ctx.globalAlpha = 1; ctx.fillStyle = col; ctx.font = 'bold 14px ' + FONT; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.fillText('!', p.x + Math.cos(a) * r, p.y + Math.sin(a) * r); ctx.restore();
    }
  }
}
function drawPlayerHUD(p, x, y, color, showScore) {
  ctx.save(); ctx.textBaseline = 'top';
  ctx.fillStyle = 'rgba(3,18,32,.7)'; roundRect(x, y, 220, 92, 16); ctx.fill();
  ctx.strokeStyle = 'rgba(0,229,255,.5)'; ctx.lineWidth = 2; roundRect(x, y, 220, 92, 16); ctx.stroke();
  const nameColor = color || '#7fd7ff';
  ctx.font = '900 22px ' + FONT; ctx.fillStyle = nameColor; ctx.textAlign = 'left';
  ctx.fillText(p.playerIndex === 0 ? 'P1' : 'P2', x + 14, y + 9);
  for (let i = 0; i < 3; i++) {
    const hx = x + 56 + i * 26, hy = y + 20;
    if (i < p.lives) { ctx.fillStyle = '#ff3b30'; heart(hx, hy, 11); ctx.fill(); }
    else { ctx.strokeStyle = 'rgba(255,255,255,.32)'; ctx.lineWidth = 2; heart(hx, hy, 11); ctx.stroke(); }
  }
  if (showScore) {
    ctx.textAlign = 'right'; ctx.font = '900 22px ' + FONT; ctx.fillStyle = '#ff8c1a';
    ctx.fillText(Math.floor(p.score), x + 206, y + 8);
    ctx.font = '800 11px ' + FONT; ctx.fillStyle = '#ffe6c4'; ctx.fillText('SCORE', x + 206, y + 32);
  }
  const lv = Math.floor((p.size - 10) / 14) + 1;
  ctx.textAlign = 'left'; ctx.font = '900 14px ' + FONT; ctx.fillStyle = '#dff6ff'; ctx.fillText('Lv ' + lv, x + 14, y + 46);
  ctx.fillStyle = 'rgba(255,255,255,.15)'; roundRect(x + 14, y + 66, 192, 15, 7); ctx.fill();
  const growth = clamp((p.size - 10) / 140, 0, 1);
  const gg = ctx.createLinearGradient(x + 14, 0, x + 206, 0);
  gg.addColorStop(0, '#00e5ff'); gg.addColorStop(0.6, '#24c26d'); gg.addColorStop(1, '#ff7a1a');
  ctx.fillStyle = gg;
  if (growth > 0) roundRect(x + 14, y + 66, 192 * growth, 15, 7); ctx.fill();
  ctx.restore();
}
function heart(x, y, r) {
  ctx.beginPath(); ctx.moveTo(x, y + r * 0.3);
  ctx.bezierCurveTo(x, y - r * 0.4, x - r, y - r * 0.4, x - r, y + r * 0.2);
  ctx.bezierCurveTo(x - r, y + r * 0.8, x, y + r * 1.3, x, y + r * 1.6);
  ctx.bezierCurveTo(x, y + r * 1.3, x + r, y + r * 0.8, x + r, y + r * 0.2);
  ctx.bezierCurveTo(x + r, y - r * 0.4, x, y - r * 0.4, x, y + r * 0.3);
  ctx.closePath();
}
function roundRect(x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y); ctx.arcTo(x + w, y, x + w, y + h, r); ctx.arcTo(x + w, y + h, x, y + h, r); ctx.arcTo(x, y + h, x, y, r); ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

/* ============================================================
   Canvas UI 层（替代 index.html 里的 DOM 界面）
   UI.screen: home/menu/select/album/backpack/diy/nickname/
              vipshop/quest/mail/agreement/pause/gameover/keyboard/play
   ============================================================ */
const UI = {
  screen: 'home',
  buttons: [],
  scrollY: 0,
  scrollMax: 0,
  scrollable: false,
  pendingInput: null,   // tt.showKeyboard 回调
  kb: null,             // Canvas 键盘回退状态
};

// 预览图缓存：【性能】每张鱼卡只渲染一次离屏预览，避免每帧重绘 14+ 张
const previewCache = {};
function previewOf(sp) {
  const key = sp.id;
  if (!previewCache[key]) {
    const cv = document.createElement('canvas');
    cv.width = 240; cv.height = 176;
    renderSpeciesPreview(cv, sp);
    previewCache[key] = cv;
  }
  return previewCache[key];
}

// 主页角色画布（待机游动 + 环绕粒子，独立离屏，30fps 更新）
const homeCharCv = document.createElement('canvas');
homeCharCv.width = 240; homeCharCv.height = 176;

function text(s, x, y, size, color, weight, align) {
  ctx.fillStyle = color || '#eaf6ff';
  ctx.font = (weight || 'bold') + ' ' + size + 'px ' + FONT;
  ctx.textAlign = align || 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(s, x, y);
}
function drawTitle(s, y, size) {
  const g = ctx.createLinearGradient(0, y - size, 0, y);
  g.addColorStop(0, '#ffffff'); g.addColorStop(0.3, '#ffe0b0'); g.addColorStop(0.6, '#ff8a1a'); g.addColorStop(1, '#00e5ff');
  ctx.fillStyle = g;
  ctx.font = '900 ' + size + 'px ' + FONT;
  ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  ctx.fillText(s, W / 2, y);
}
function drawButtonShape(b) {
  const r = Math.min(14, b.h * 0.28);
  if (b.disabled) ctx.globalAlpha = 0.4;
  ctx.fillStyle = 'rgba(0,0,0,.32)';
  roundRect(b.x, b.y + Math.max(3, b.h * 0.08), b.w, b.h, r); ctx.fill();
  let grad = null;
  if (b.gold) grad = ['#ffc46b', '#ff8a1a', '#ff4d00'];
  else if (b.green) grad = ['#3ee08a', '#0fb56a'];
  else if (!b.ghost) grad = ['#00e5ff', '#0a6be8', '#5a2dff'];
  if (grad) { const g = ctx.createLinearGradient(b.x, b.y, b.x, b.y + b.h); grad.forEach((c, i) => g.addColorStop(i / (grad.length - 1), c)); ctx.fillStyle = g; }
  else ctx.fillStyle = 'rgba(255,255,255,.10)';
  roundRect(b.x, b.y, b.w, b.h, r); ctx.fill();
  if (b.ghost) { ctx.strokeStyle = 'rgba(255,255,255,.35)'; ctx.lineWidth = 1.5; roundRect(b.x, b.y, b.w, b.h, r); ctx.stroke(); }
  ctx.fillStyle = '#fff'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  if (b.sub) {
    ctx.font = 'bold ' + b.size + 'px ' + FONT; ctx.fillText(b.label, b.x + b.w / 2, b.y + b.h / 2 - b.size * 0.3);
    ctx.font = '600 ' + Math.round(b.size * 0.45) + 'px ' + FONT; ctx.fillStyle = 'rgba(255,255,255,.82)'; ctx.fillText(b.sub, b.x + b.w / 2, b.y + b.h / 2 + b.size * 0.5);
  } else {
    ctx.font = 'bold ' + b.size + 'px ' + FONT; ctx.fillText(b.label, b.x + b.w / 2, b.y + b.h / 2);
  }
  if (b.disabled) ctx.globalAlpha = 1;
}
function addButton(x, y, w, h, label, o) {
  o = o || {};
  const b = { x, y, w, h, label, onClick: o.onClick, size: o.size || 18, gold: !!o.gold, green: !!o.green, ghost: !!o.ghost, disabled: !!o.disabled, sub: o.sub };
  UI.buttons.push(b);
  drawButtonShape(b);
}
function drawChip(x, y, s, color) {
  ctx.font = 'bold ' + s + 'px ' + FONT;
  const tw = ctx.measureText(textMeasure(s)).width;
  void tw;
}
function chip(s, x, y, size, color) {
  ctx.font = 'bold ' + size + 'px ' + FONT;
  const tw = ctx.measureText(s).width;
  const w = tw + 24, h = size + 14;
  ctx.fillStyle = 'rgba(8,50,82,.5)'; roundRect(x - w / 2, y - h / 2, w, h, h / 2); ctx.fill();
  ctx.strokeStyle = 'rgba(150,220,255,.25)'; ctx.lineWidth = 1; roundRect(x - w / 2, y - h / 2, w, h, h / 2); ctx.stroke();
  text(s, x, y, size, color || '#bfe9f7', 'bold', 'center');
}
function textMeasure(s) { return s; }

/* ---- 鱼卡片（选鱼 / 图鉴 共用） ---- */
function drawFishCard(id, x, y, w, h, badge) {
  const sp = resolveSpecies(id) || SPECIES[0];
  const unlocked = Skins.isUnlocked(id);
  const selected = unlocked && Skins.state.selected === id;
  const r = 14;
  ctx.fillStyle = unlocked ? 'rgba(8,50,82,.85)' : 'rgba(8,50,82,.45)';
  roundRect(x, y, w, h, r); ctx.fill();
  ctx.strokeStyle = selected ? '#ffd23f' : (sp.vip && unlocked ? 'rgba(255,200,80,.7)' : 'rgba(150,220,255,.3)');
  ctx.lineWidth = selected ? 2.5 : 1.5; roundRect(x, y, w, h, r); ctx.stroke();
  const pv = previewOf(sp);
  const ph = h * 0.44;
  if (unlocked) ctx.drawImage(pv, x + 4, y + 6, w - 8, ph);
  else {
    ctx.save(); ctx.globalAlpha = 0.18; ctx.drawImage(pv, x + 4, y + 6, w - 8, ph); ctx.restore();
    ctx.fillStyle = 'rgba(2,10,20,.55)'; roundRect(x + 4, y + 6, w - 8, ph, 8); ctx.fill();
    if (sp.vip) {
      const cx = x + w / 2, cy = y + 6 + ph / 2;
      ctx.fillStyle = 'rgba(255,210,63,.95)'; ctx.beginPath(); ctx.arc(cx, cy, 16, 0, TAU); ctx.fill();
      ctx.fillStyle = '#5a2d00'; ctx.font = '900 16px ' + FONT; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText('封', cx, cy + 1);
    }
  }
  text(sp.name, x + w / 2, y + 6 + ph + 14, Math.max(11, w * 0.13), '#f2fbff');
  const tag = fishTag(sp, unlocked, id);
  text(tag, x + w / 2, y + 6 + ph + 30, Math.max(9, w * 0.105), sp.vip ? '#ffd23f' : '#a9d8ee');
  if (!unlocked && sp.fragCost > 0) {
    const pw = w - 12, px = x + 6, py = y + h - 10;
    ctx.fillStyle = 'rgba(255,255,255,.14)'; roundRect(px, py, pw, 5, 3); ctx.fill();
    const prog = Math.min(1, Frag.countOf(id) / Math.max(1, sp.fragCost));
    ctx.fillStyle = '#3ee08a'; if (prog > 0) roundRect(px, py, pw * prog, 5, 3); ctx.fill();
  }
  if (badge) {
    ctx.fillStyle = 'rgba(10,60,95,.9)'; roundRect(x + w - 34, y - 8, 38, 18, 9); ctx.fill();
    ctx.fillStyle = '#ffd23f'; ctx.font = '900 10px ' + FONT; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText(badge, x + w - 15, y + 2);
  }
  if (unlocked) addButton(x, y, w, h, '', { onClick: () => cardClick(id) });
}
function fishTag(sp, unlocked, id) {
  if (!unlocked) return (sp.vip ? sp.rarity + ' · ' : '') + lockText(sp);
  if (sp.vip) return sp.rarity + ' · VIP';
  if (id.indexOf('diy:') === 0) return '自制鱼';
  return sp.sizeMax <= 40 ? '小型' : (sp.sizeMax <= 80 ? '中型' : (sp.sizeMax <= 125 ? '大型' : '顶级'));
}
function cardClick(id) {
  // 由当前界面决定点击行为
  if (UI.screen === 'select') Game.chooseFish(id);
  else if (UI.screen === 'album') Game.selectSkin(id);
  else if (UI.screen === 'diy') { Skins.select(id); }
}

/* ---- 文本输入（昵称 / DIY 名称） ---- */
function promptText(value, maxLen, onDone) {
  if (typeof tt !== 'undefined' && tt.showKeyboard) {
    UI.pendingInput = onDone;
    tt.showKeyboard({ defaultValue: value || '', maxLength: maxLen || 12, multiple: false, confirmType: 'done' });
  } else {
    UI.kb = { value: value || '', maxLen: maxLen || 12, onDone };
    UI.screen = 'keyboard';
  }
}

/* ---- 各界面绘制 ---- */
function drawDim(a) {
  ctx.fillStyle = 'rgba(2,14,28,' + (a == null ? 0.72 : a) + ')';
  ctx.fillRect(0, 0, W, H);
}
function drawBackButton() { addButton(14, 14, 84, 40, '返回', { size: 15, ghost: true, onClick: () => Game.openHome() }); }

function drawHomeScreen() {
  const cx = W / 2;
  drawTitle('开局捏鱼，吞遍深海', 46, 28);
  text('吃掉小鱼 · 躲避大鱼 · 成长为海洋之王', cx, 80, 13, '#ffe6c4', 'bold');

  const icons = [
    ['背包', '常规', () => Game.openBackpack()],
    ['图鉴', '常规', () => Game.openAlbum()],
    ['DIY', '常规', () => Game.openDiy()],
    ['VIP', 'gold', () => Game.openVipShop()],
    ['任务', '常规', () => Game.openQuest()],
    ['邮件', '常规', () => Game.openMail()],
  ];
  const iw = Math.min(52, (W - 30) / 6 - 5);
  const gap = 5, total = icons.length * iw + (icons.length - 1) * gap;
  let ix = cx - total / 2, iy = 96;
  for (const [lb, style, cb] of icons) {
    addButton(ix, iy, iw, iw, lb, { size: 12, gold: style === 'gold', onClick: cb });
    ix += iw + gap;
  }

  const charW = Math.min(150, W * 0.42), charH = charW * 0.73;
  const charX = 16, charY = iy + iw + 16;
  // 角色画布
  ctx.save();
  ctx.fillStyle = 'rgba(12,70,110,.5)'; roundRect(charX, charY, charW, charH, 16); ctx.fill();
  ctx.strokeStyle = 'rgba(150,220,255,.35)'; ctx.lineWidth = 1; roundRect(charX, charY, charW, charH, 16); ctx.stroke();
  ctx.restore();
  ctx.save();
  ctx.beginPath(); roundRect(charX, charY, charW, charH, 16); ctx.clip();
  ctx.drawImage(homeCharCv, charX, charY, charW, charH);
  ctx.restore();
  // 昵称按钮
  const nick = Skins.state.nickname || '未命名小鱼';
  addButton(charX, charY + charH + 8, charW, 34, nick + ' ✎', { size: 13, ghost: true, onClick: () => Game.openNickname() });
  // Lv 称号
  const lv = levelOf(Skins.state.totalEaten);
  chip('Lv.' + lv + ' · ' + titleOf(lv), charX + charW / 2, charY + charH + 52, 11, '#ffd23f');

  // 右侧超大开始按钮
  const startX = charX + charW + 14, startY = charY + 8;
  const startW = W - startX - 16, startH = charH + 26;
  addButton(startX, startY, startW, startH, '开始游戏', { size: 26, gold: true, onClick: () => Game.goStart() });

  // 底部信息栏
  const sp = resolveSpecies(Skins.state.selected) || SPECIES[0];
  const footY = Math.max(charY + charH + 82, startY + startH + 26);
  const infos = ['出战：' + sp.name, Game.fragProgressText(), '累计吞噬 ' + Skins.state.totalEaten + ' 条'];
  let fx = cx - 190;
  for (const s of infos) {
    ctx.font = 'bold 11px ' + FONT;
    const tw = ctx.measureText(s).width + 24;
    const h = 26;
    ctx.fillStyle = 'rgba(8,50,82,.5)'; roundRect(fx, footY, tw, h, h / 2); ctx.fill();
    ctx.strokeStyle = 'rgba(150,220,255,.25)'; roundRect(fx, footY, tw, h, h / 2); ctx.stroke();
    text(s, fx + tw / 2, footY + h / 2, 11, '#bfe9f7');
    fx += tw + 8;
  }
}

function drawMenuScreen() {
  const cx = W / 2;
  drawTitle('开局捏鱼，吞遍深海', 54, 30);
  text('吃掉小鱼 · 躲避大鱼 · 成长为海洋之王', cx, 88, 13, '#ffe6c4', 'bold');
  addButton(cx - 120, 120, 240, 56, '单人模式', { size: 20, onClick: () => Game.openSelect('single') });
  addButton(cx - 120, 184, 240, 56, '双人模式', { size: 20, green: true, onClick: () => Game.openSelect('double') });
  addButton(cx - 90, 250, 180, 40, '皮肤图鉴', { size: 14, ghost: true, onClick: () => Game.openAlbum() });
  // 规则说明
  const ry = 306;
  ctx.fillStyle = 'rgba(8,50,82,.58)'; roundRect(cx - 170, ry, 340, 84, 16); ctx.fill();
  ctx.strokeStyle = 'rgba(150,220,255,.3)'; roundRect(cx - 170, ry, 340, 84, 16); ctx.stroke();
  text('操作说明', cx, ry + 18, 14, '#8fe4ff');
  text('拖动屏幕移动 · 点「冲刺」加速 · 吃掉比你小的鱼', cx, ry + 44, 12, '#dff4ff');
  text('被更大的鱼咬到会掉一条命（共 3 条）', cx, ry + 62, 12, '#bfe9f7');
  // 图例（可繁殖鱼种）
  const legend = SPECIES.filter(s => s.spawn !== false);
  let lx = cx - (legend.length * 54) / 2;
  const ly = ry + 104;
  for (const s of legend) {
    ctx.fillStyle = s.c1; ctx.beginPath(); ctx.arc(lx + 9, ly, 6, 0, TAU); ctx.fill();
    text(s.name, lx + 22, ly, 10, '#dff4ff', 'bold', 'left');
    lx += 54;
  }
  text('从图鉴/DIY 选好鱼后再出发，体验更好', cx, ly + 34, 11, '#cfeaf7', 'normal');
}

function drawSelectScreen() {
  const cx = W / 2;
  drawTitle('选择你的鱼', 46, 26);
  const { mode, picks, player } = Game.select;
  const subtitle = mode === 'single' ? '挑一条你喜欢的鱼，点「开始游戏」出发' : `玩家 ${player + 1} · 点击鱼卡为当前玩家选择`;
  text(subtitle, cx, 60, 12, '#ffe6c4');
  if (mode === 'double') {
    addButton(cx - 120, 74, 118, 34, 'P1 选择', { size: 13, ghost: player === 0, onClick: () => Game.setSelectPlayer(0) });
    addButton(cx + 2, 74, 118, 34, 'P2 选择', { size: 13, ghost: player === 1, onClick: () => Game.setSelectPlayer(1) });
  }
  const topY = mode === 'double' ? 120 : 86;
  const cardW = Math.min(84, (W - 30) / 4), cardH = cardW * 1.45;
  const gx = (W - cardW * 4) / 5;
  let cx0 = gx, cy0 = topY;
  const all = [...SPECIES, ...DIY.list()];
  let col = 0;
  for (const s of all) {
    let badge = '';
    if (picks[0] === s.id && picks[1] === s.id) badge = 'P1·P2';
    else if (picks[0] === s.id) badge = 'P1';
    else if (picks[1] === s.id) badge = 'P2';
    drawFishCard(s.id, cx0, cy0, cardW, cardH, badge);
    col++; cx0 += cardW + gx;
    if (col >= 4) { col = 0; cx0 = gx; cy0 += cardH + 10; }
  }
  const ok = mode === 'single' ? !!picks[0] : !!(picks[0] && picks[1]);
  addButton(cx - 130, H - 104, 126, 52, '开始游戏', { size: 17, disabled: !ok, onClick: () => Game.confirmSelect() });
  addButton(cx + 4, H - 104, 126, 52, '返回菜单', { size: 17, ghost: true, onClick: () => Game.toMenu() });
}

function drawAlbumScreen() {
  const cx = W / 2;
  drawTitle('皮肤图鉴', 46, 26);
  const tab = Game.albumTab;
  const subtitle = tab === 'official' ? '已累计吞噬 ' + Skins.state.totalEaten + ' 条 · 点击已解锁皮肤装备' : '点击 DIY 鱼装备，支持删除';
  text(subtitle, cx, 58, 12, '#ffe6c4');
  addButton(cx - 100, 72, 96, 34, '官方鱼种', { size: 13, ghost: tab !== 'official', onClick: () => Game.setAlbumTab('official') });
  addButton(cx + 4, 72, 96, 34, '我的DIY', { size: 13, ghost: tab !== 'diy', onClick: () => Game.setAlbumTab('diy') });

  const cardW = Math.min(84, (W - 30) / 4), cardH = cardW * 1.45;
  const gx = (W - cardW * 4) / 5;
  let cx0 = gx, cy0 = 118 - UI.scrollY;
  let maxY = cy0;
  const items = tab === 'official' ? SPECIES : DIY.list();
  if (tab === 'diy' && !items.length) text('还没有 DIY 鱼，去 DIY 面板创作一只吧', cx, cy0 + 20, 12, '#cfeaf7');
  let col = 0;
  for (const s of items) {
    const selected = Skins.state.selected === s.id;
    drawFishCard(s.id, cx0, cy0, cardW, cardH, Skins.isUnlocked(s.id) && selected ? '使用中' : (Skins.isUnlocked(s.id) ? '' : '未解锁'));
    if (tab === 'diy') {
      // DIY 卡片右下角删除按钮
      addButton(cx0 + cardW - 24, cy0 + cardH - 26, 20, 20, '×', { size: 11, ghost: true, onClick: () => { DIY.remove(s.id); } });
    }
    col++; cx0 += cardW + gx;
    if (col >= 4) { col = 0; cx0 = gx; cy0 += cardH + 10; }
    maxY = Math.max(maxY, cy0 + cardH + 10);
  }
  UI.scrollMax = Math.max(0, maxY - (H - 90));
  UI.scrollable = UI.scrollMax > 0;
  addButton(cx - 60, H - 70, 120, 44, '返回主页', { size: 15, ghost: true, onClick: () => Game.closeAlbum() });
}

function drawBackpackScreen() {
  const cx = W / 2;
  drawTitle('鱼背包', 46, 26);
  text('已累计吞噬 ' + Skins.state.totalEaten + ' 条 · 吞噬掉落对应鱼种碎片', cx, 58, 12, '#ffe6c4');

  const cardW = Math.min(104, (W - 30) / 3), cardH = 86;
  const gx = (W - cardW * 3) / 4;
  let cx0 = gx, cy0 = 80 - UI.scrollY;
  let maxY = cy0, col = 0;
  for (const s of SPECIES) {
    const c = Frag.countOf(s.id), cost = s.fragCost, unlocked = Skins.isUnlocked(s.id);
    ctx.fillStyle = 'rgba(8,50,82,.6)'; roundRect(cx0, cy0, cardW, cardH, 12); ctx.fill();
    ctx.strokeStyle = s.vip ? 'rgba(255,200,80,.55)' : 'rgba(150,220,255,.28)'; ctx.lineWidth = 1.5; roundRect(cx0, cy0, cardW, cardH, 12); ctx.stroke();
    text(s.vip ? (s.rarity + ' · ' + s.name) : s.name, cx0 + cardW / 2, cy0 + 16, 11, s.vip ? '#ffd23f' : '#f2fbff');
    let cnt = '';
    if (cost === 0) cnt = '初始皮肤';
    else if (unlocked) cnt = '已解锁';
    else { cnt = c + ' / ' + cost; if (s.vip && Skins.state.totalEaten < s.eatGate) cnt += ' · Lv.' + levelOf(s.eatGate); }
    text(cnt, cx0 + cardW / 2, cy0 + 38, 11, '#ffd23f');
    const pw = cardW - 20, px = cx0 + 10, py = cy0 + 56;
    ctx.fillStyle = 'rgba(255,255,255,.14)'; roundRect(px, py, pw, 8, 4); ctx.fill();
    const prog = cost === 0 ? 1 : Math.min(1, c / cost);
    ctx.fillStyle = '#3ee08a'; if (prog > 0) roundRect(px, py, pw * prog, 8, 4); ctx.fill();
    col++; cx0 += cardW + gx;
    if (col >= 3) { col = 0; cx0 = gx; cy0 += cardH + 10; }
    maxY = Math.max(maxY, cy0 + cardH + 10);
  }
  // 获取记录
  const logY = maxY + 6;
  text('碎片获取记录', cx, logY, 12, '#8fe4ff');
  const log = Skins.state.fragLog;
  let ly = logY + 18;
  if (!log.length) text('暂无获取记录', cx, ly, 11, '#cfeaf7');
  for (const r of log.slice(0, 10)) { text('获得「' + r.name + '」碎片 ×1 · ' + fmtTime(r.t), cx, ly, 10, '#cfeaf7'); ly += 16; }
  maxY = ly + 8;
  UI.scrollMax = Math.max(0, maxY - (H - 90));
  UI.scrollable = UI.scrollMax > 0;
  addButton(cx - 60, H - 70, 120, 44, '返回主页', { size: 15, ghost: true, onClick: () => Game.closeBackpack() });
}

function drawDiyScreen() {
  const cx = W / 2;
  drawTitle('DIY 自制鱼', 46, 26);
  const d = Game.diyDraft;
  const shapeKeys = Object.keys(DIY_SHAPES);
  const p = PALETTE[d.pal];
  const sp = DIY.build({ name: '预览', shape: shapeKeys[d.shape], c1: p.c1, c2: p.c2, belly: p.belly, pattern: DIY_PATTERNS[d.pattern], finType: DIY_FINS[d.fin], tailType: DIY_TAILS[d.tail], eyeType: DIY_EYES[d.eye] });

  // 预览区
  const pvX = cx - 80, pvY = 56 - UI.scrollY, pvW = 160, pvH = 116;
  ctx.fillStyle = 'rgba(20,90,130,.4)'; roundRect(pvX, pvY, pvW, pvH, 14); ctx.fill();
  ctx.strokeStyle = 'rgba(150,220,255,.3)'; roundRect(pvX, pvY, pvW, pvH, 14); ctx.stroke();
  renderSpeciesPreview(diyPreviewCv, sp);
  ctx.drawImage(diyPreviewCv, pvX + 4, pvY + 4, pvW - 8, pvH - 8);

  let y = pvY + pvH + 8;
  // 体型
  y = optRow('体型', ['圆身', '高体', '长条', '圆胖', '带状'], d.shape, v => { d.shape = v; }, y);
  // 配色
  y = optRow('配色', PALETTE.map(pp => pp.name), d.pal, v => { d.pal = v; }, y);
  // 鱼鳍
  y = optRow('鱼鳍', ['帆鳍', '尖鳍', '波浪', '无'], d.fin, v => { d.fin = v; }, y);
  // 鱼尾
  y = optRow('鱼尾', ['扇尾', '叉尾', '圆尾', '尖尾'], d.tail, v => { d.tail = v; }, y);
  // 鱼眼
  y = optRow('鱼眼', ['普通', '大眼', '点眼', '星眼'], d.eye, v => { d.eye = v; }, y);
  // 花纹
  y = optRow('花纹', ['无', '环带', '条纹', '斑点', '尾斑'], d.pattern, v => { d.pattern = v; }, y);

  // 名称 + 保存
  addButton(cx - 150, y, 210, 34, '命名：' + (d.name || '我的小鱼'), { size: 13, ghost: true, onClick: () => promptText(d.name, 10, v => { d.name = v; }) });
  addButton(cx + 64, y, 86, 34, '编辑', { size: 13, ghost: true, onClick: () => promptText(d.name, 10, v => { d.name = v; }) });
  y += 42;
  addButton(cx - 130, y, 126, 46, '保存', { size: 16, onClick: () => Game.saveDiy(false) });
  addButton(cx + 4, y, 126, 46, '保存并装备', { size: 15, green: true, onClick: () => Game.saveDiy(true) });
  y += 56;
  text('已保存的DIY鱼（点击装备）', cx, y, 12, '#8fe4ff');
  y += 20;
  if (!DIY.list().length) text('还没有 DIY 鱼', cx, y, 11, '#cfeaf7');
  for (const f of DIY.list()) {
    const itemH = 52;
    ctx.fillStyle = 'rgba(8,50,82,.6)'; roundRect(cx - 170, y, 340, itemH, 12); ctx.fill();
    ctx.strokeStyle = 'rgba(150,220,255,.28)'; roundRect(cx - 170, y, 340, itemH, 12); ctx.stroke();
    const pvc = previewOf(f);
    ctx.drawImage(pvc, cx - 160, y + 6, 60, 40);
    text(f.name + (Skins.state.selected === f.id ? '（使用中）' : ''), cx - 60, y + itemH / 2, 13, '#f2fbff', 'bold', 'left');
    addButton(cx + 118, y + 8, 50, 36, '装备', { size: 12, ghost: true, onClick: () => { Skins.select(f.id); } });
    addButton(cx + 172, y + 8, 50, 36, '删除', { size: 12, ghost: true, onClick: () => { DIY.remove(f.id); } });
    y += itemH + 8;
  }
  y += 8;
  UI.scrollMax = Math.max(0, y - (H - 90));
  UI.scrollable = UI.scrollMax > 0;
  addButton(cx - 60, H - 70, 120, 44, '返回主页', { size: 15, ghost: true, onClick: () => Game.closeDiy() });
}
function optRow(label, opts, value, onPick, y) {
  const cx = W / 2;
  text(label, cx, y + 8, 11, '#a9d8ee', 'bold', 'center');
  const bw = Math.min(64, (W - 30) / 5);
  const total = opts.length * bw;
  let x = cx - total / 2;
  for (let i = 0; i < opts.length; i++) {
    addButton(x, y + 18, bw - 4, 30, opts[i], { size: 11, ghost: i !== value, onClick: () => { onPick(i); } });
    x += bw;
  }
  return y + 52;
}

function drawNicknameScreen() {
  const cx = W / 2;
  drawTitle('设置昵称', 46, 90);
  text('给海洋之王起个响亮的名字', cx, 126, 13, '#ffe6c4');
  const cur = Game.nickDraft || '';
  addButton(cx - 150, 160, 300, 50, cur || '点击输入昵称', { size: 16, ghost: true, onClick: () => promptText(cur, 12, v => { Game.nickDraft = v; }) });
  addButton(cx - 130, 240, 126, 50, '保存', { size: 17, onClick: () => Game.saveNickname() });
  addButton(cx + 4, 240, 126, 50, '返回', { size: 17, ghost: true, onClick: () => Game.closeNickname() });
}

function drawPlaceholderScreen(title, sub, desc) {
  const cx = W / 2;
  drawTitle(title, 46, 120);
  text(sub, cx, 160, 13, '#ffe6c4');
  ctx.fillStyle = 'rgba(120,80,10,.18)'; roundRect(cx - 160, 190, 320, 90, 12); ctx.fill();
  ctx.strokeStyle = 'rgba(255,210,63,.25)'; roundRect(cx - 160, 190, 320, 90, 12); ctx.stroke();
  text(desc, cx, 235, 13, '#ffe9b0', 'normal');
  addButton(cx - 60, 320, 120, 46, '返回', { size: 16, ghost: true, onClick: () => Game.openHome() });
}

/* ---- 用户协议 + 隐私政策（首次进入弹窗，同意后本地记录不再弹出） ---- */
const AGREEMENT_TEXT = [
  '欢迎游玩《开局捏鱼，吞遍深海》！',
  '',
  '一、用户协议',
  '1. 本游戏为休闲娱乐产品，玩家应遵守法律法规，文明游戏。',
  '2. 游戏内昵称、皮肤、碎片等均为虚拟数据，仅用于本游戏体验。',
  '3. 请勿利用本游戏从事任何违法违规或侵害他人权益的行为。',
  '',
  '二、隐私政策',
  '1. 我们仅收集：您设置的昵称、游戏进度与成就数据（累计吞噬、已解锁鱼种、碎片等）。',
  '2. 上述数据默认仅保存在您的设备本地；若开启云端同步，将加密存储于抖音云开发环境。',
  '3. 我们不会收集您的手机号、通讯录、位置等敏感个人信息。',
  '4. 您可随时清除小程序缓存以删除本地数据。',
  '',
  '点击「同意并继续」即表示您已阅读并同意上述协议与政策。',
];
function wrapAgreementText() {
  ctx.font = '13px ' + FONT;
  const maxW = W - 88, lines = [];
  for (const raw of AGREEMENT_TEXT) {
    if (raw === '') { lines.push(''); continue; }
    let cur = '';
    for (const ch of raw) {
      if (ctx.measureText(cur + ch).width > maxW) { lines.push(cur); cur = ch; }
      else cur += ch;
    }
    if (cur) lines.push(cur);
  }
  return lines;
}
function drawAgreementScreen() {
  const cx = W / 2;
  drawTitle('用户协议与隐私政策', 40, 106);
  const panelX = 24, panelY = 148, panelW = W - 48, panelH = H - 300;
  ctx.save();
  ctx.fillStyle = 'rgba(8,50,82,.85)';
  roundRect(panelX, panelY, panelW, panelH, 14); ctx.fill();
  ctx.strokeStyle = 'rgba(150,220,255,.3)'; ctx.lineWidth = 1;
  roundRect(panelX, panelY, panelW, panelH, 14); ctx.stroke();
  // 文字区域裁剪 + 滚动
  ctx.beginPath(); roundRect(panelX + 10, panelY + 8, panelW - 20, panelH - 16, 10); ctx.clip();
  const lines = wrapAgreementText();
  const lineH = 22;
  const contentH = lines.length * lineH;
  UI.scrollable = true; UI.scrollMax = Math.max(0, contentH - (panelH - 24));
  ctx.textAlign = 'left'; ctx.textBaseline = 'middle';
  ctx.font = '13px ' + FONT;
  for (let i = 0; i < lines.length; i++) {
    const ly = panelY + 18 + i * lineH - UI.scrollY;
    if (ly < panelY - lineH || ly > panelY + panelH + lineH) continue;   // 视口外剔除
    const s = lines[i];
    ctx.fillStyle = (s.indexOf('一、') === 0 || s.indexOf('二、') === 0) ? '#8fe4ff' : '#cfe9f7';
    ctx.fillText(s, panelX + 16, ly);
  }
  ctx.restore();
  // 底部按钮
  const by = H - 128;
  addButton(cx - 130, by, 260, 50, '同意并继续', { size: 17, onClick: () => Game.agree() });
  addButton(cx - 130, by + 62, 260, 40, '不同意', { size: 14, ghost: true, onClick: () => Game.disagree() });
}

function drawPauseScreen() {
  drawDim(0.55);
  drawTitle('已暂停', 40, H / 2 - 70);
  addButton(W / 2 - 120, H / 2 - 20, 240, 52, '继续', { size: 18, onClick: () => Game.resume() });
  addButton(W / 2 - 120, H / 2 + 44, 240, 52, '返回菜单', { size: 18, ghost: true, onClick: () => Game.toMenu() });
}

function drawGameoverScreen() {
  drawDim(0.55);
  drawTitle('游戏结束', 40, H / 2 - 110);
  text(Game.goScore || '', W / 2, H / 2 - 50, 16, '#ffe6c4');
  text(Game.goBest || '', W / 2, H / 2 - 22, 16, '#ffe6c4');
  let by = H / 2 + 22;
  addButton(W / 2 - 120, by, 240, 50, '再来一局', { size: 18, onClick: () => Game.start(Game.mode) });
  by += 58;
  // 激励视频复活：仅单机模式；广告失败/未看完不复活（兜底提示）
  if (Game.mode === 'single') {
    addButton(W / 2 - 120, by, 240, 50, '看广告复活', { size: 17, gold: true, onClick: () => Ad.show(() => Game.revive(), () => showToast('广告暂不可用，稍后再试')) });
    by += 58;
  }
  addButton(W / 2 - 120, by, 240, 50, '返回菜单', { size: 17, ghost: true, onClick: () => Game.toMenu() });
  by += 54;
  addButton(W / 2 - 120, by, 240, 40, '分享游戏', { size: 14, ghost: true, onClick: () => Share.trigger() });
}

/* 键盘回退（仅无 tt.showKeyboard 环境使用，仅支持英文字母/数字） */
function drawKeyboardScreen() {
  const kb = UI.kb;
  drawDim(0.85);
  drawTitle('输入', 40, 60);
  ctx.fillStyle = 'rgba(8,50,82,.8)'; roundRect(20, 90, W - 40, 52, 12); ctx.fill();
  ctx.strokeStyle = 'rgba(150,220,255,.35)'; roundRect(20, 90, W - 40, 52, 12); ctx.stroke();
  text(kb.value || ' ', W / 2, 116, 18, '#fff');
  const rows = ['QWERTYUIOP', 'ASDFGHJKL', 'ZXCVBNM', '1234567890'];
  const kw = (W - 40 - 9 * 4) / 10;
  let ky = 156;
  for (const row of rows) {
    let kx = 20;
    for (const ch of row) { addButton(kx, ky, kw, 34, ch, { size: 14, ghost: true, onClick: () => { if (kb.value.length < kb.maxLen) kb.value += ch; } }); kx += kw + 4; }
    ky += 40;
  }
  addButton(20, ky, (W - 48) / 2, 40, '⌫', { size: 16, ghost: true, onClick: () => { kb.value = kb.value.slice(0, -1); } });
  addButton(28 + (W - 48) / 2, ky, (W - 48) / 2, 40, '确定', { size: 16, onClick: () => { const onDone = kb.onDone; UI.kb = null; UI.screen = 'nickname'; onDone(kb.value); } });
}

/* ---- 运行中按钮（暂停 / 冲刺） ---- */
function drawPlayControls() {
  addButton(W - 88, 14, 74, 40, '暂停', { size: 14, ghost: true, onClick: () => Game.pause() });
  addButton(W - 104, H - 104, 88, 88, '冲刺', { size: 18, gold: true, onClick: () => { MoveTouch.dashArmed = true; } });
}

/* ---- UI 总入口 ---- */
function drawUI() {
  UI.buttons = [];
  UI.scrollable = false;
  switch (UI.screen) {
    case 'home': drawHomeScreen(); break;
    case 'menu': drawMenuScreen(); break;
    case 'select': drawSelectScreen(); break;
    case 'album': drawAlbumScreen(); break;
    case 'backpack': drawBackpackScreen(); break;
    case 'diy': drawDiyScreen(); break;
    case 'nickname': drawNicknameScreen(); break;
    case 'vipshop': drawPlaceholderScreen('VIP 商城', '兑换稀有高阶鱼种 · 敬请期待', '这里将上架龙形海兽、机械鲨鱼、星空水母等传说鱼种的碎片礼包与专属道具。'); break;
    case 'quest': drawPlaceholderScreen('任务', '完成每日任务领碎片 · 敬请期待', '每日吞噬、连击、解锁等任务将在这里派发奖励。'); break;
    case 'mail': drawPlaceholderScreen('邮件', '系统奖励与通知 · 敬请期待', '活动奖励、补偿与公告将通过邮件送达。'); break;
    case 'agreement': drawAgreementScreen(); break;
    case 'pause': drawPauseScreen(); break;
    case 'gameover': drawGameoverScreen(); break;
    case 'keyboard': drawKeyboardScreen(); break;
    case 'play': drawPlayControls(); break;
  }
}

// DIY 预览离屏画布
const diyPreviewCv = document.createElement('canvas');
diyPreviewCv.width = 240; diyPreviewCv.height = 176;

/* ---------- 触屏命中 ---------- */
function hitButton(x, y) {
  for (let i = UI.buttons.length - 1; i >= 0; i--) {
    const b = UI.buttons[i];
    if (b.disabled) continue;
    if (x >= b.x && x <= b.x + b.w && y >= b.y && y <= b.y + b.h) {
      if (b.onClick) b.onClick();
      return true;
    }
  }
  return false;
}
function touchPoint(e) {
  const t = (e.touches && e.touches[0]) || (e.changedTouches && e.changedTouches[0]);
  return t ? { x: (t.clientX != null ? t.clientX : t.pageX) || 0, y: (t.clientY != null ? t.clientY : t.pageY) || 0, id: t.identifier != null ? t.identifier : 0 } : { x: 0, y: 0, id: 0 };
}

let touch = { active: false, sx: 0, sy: 0, scrollY0: 0, scrolled: false };
const playTouches = [];

if (typeof tt !== 'undefined') {
  tt.onTouchStart(e => {
    const p = touchPoint(e);
    if (UI.screen === 'play') {
      if (hitButton(p.x, p.y)) return;   // 命中暂停/冲刺按钮
      playTouches.push(p.id);
      if (playTouches.length === 1) { MoveTouch.active = true; MoveTouch.x = p.x; MoveTouch.y = p.y; }
      else MoveTouch.dashArmed = true;
      return;
    }
    touch.active = true; touch.sx = p.x; touch.sy = p.y; touch.scrolled = false; touch.scrollY0 = UI.scrollY;
  });
  tt.onTouchMove(e => {
    const p = touchPoint(e);
    if (UI.screen === 'play') {
      if (MoveTouch.active) { MoveTouch.x = p.x; MoveTouch.y = p.y; }
      return;
    }
    if (!touch.active) return;
    const dy = p.y - touch.sy;
    if (Math.abs(dy) > 8 && UI.scrollable) { touch.scrolled = true; UI.scrollY = clamp(touch.scrollY0 - dy, 0, UI.scrollMax); }
  });
  tt.onTouchEnd(e => {
    const p = touchPoint(e);
    if (UI.screen === 'play') {
      playTouches.length = 0; MoveTouch.active = false;
      return;
    }
    if (!touch.active) return;
    touch.active = false;
    if (touch.scrolled) return;
    hitButton(p.x, p.y);
  });
  tt.onTouchCancel(e => {
    if (UI.screen === 'play') { playTouches.length = 0; MoveTouch.active = false; }
    touch.active = false;
  });
}

/* ---------- 系统键盘回调 ---------- */
if (typeof tt !== 'undefined' && tt.onKeyboardConfirm) {
  tt.onKeyboardConfirm(res => {
    if (typeof tt.hideKeyboard === 'function') tt.hideKeyboard();
    if (UI.pendingInput) { const cb = UI.pendingInput; UI.pendingInput = null; cb((res && res.value) || ''); }
  });
}

/* ---------- 主页角色待机动画（30fps 更新） ---------- */
let homeAnimT = 0;
function renderHomeChar(time) {
  const sp = resolveSpecies(Skins.state.selected) || SPECIES[0];
  renderSpeciesPreview(homeCharCv, sp, time || 0);
  drawHomeOrbit(homeCharCv, time || 0);
}

/* ============================================================
   主循环
   ============================================================ */
let lastT = (typeof performance !== 'undefined' && performance.now) ? performance.now() : Date.now();
let ambientT = 0;
function loop(now) {
  const dt = (now - lastT) / 1000;
  lastT = now;
  const adt = Math.min(dt, 0.05);
  ambientT += adt;
  Perf.tick(adt);
  Game.updateBubbles(adt);

  // 主页待机游动：独立降频 30fps，不与对局渲染抢资源
  if (UI.screen === 'home') {
    homeAnimT += adt;
    if (Math.floor(homeAnimT * 30) > Math.floor((homeAnimT - adt) * 30)) renderHomeChar(homeAnimT);
  }

  if (UI.screen === 'home') drawHomeBackground();
  else drawBackground();
  drawBubbles();

  if (Game.state === 'play' || Game.state === 'pause') {
    if (Game.state === 'play') Game.update(dt);
    drawScene();
    drawHUD();
    drawPlayControls();
  } else if (UI.screen !== 'play') {
    drawDim(UI.screen === 'home' ? 0.32 : 0.72);
    drawUI();
  }

  drawToast();
  requestAnimationFrame(loop);
}

/* ---------- 启动 ---------- */
Game.init();
Ad.init();
Share.init();
buildBackground();
renderHomeChar(0);
if (readLocal('bigfish_agreed') === '1') Game.openHome();
else UI.screen = 'agreement';
requestAnimationFrame(loop);

// 抖音云端存档：异步登录 + 拉取（不阻塞本地进入，无 tt 环境静默降级）
Cloud.login().then(() => Cloud.pull());
