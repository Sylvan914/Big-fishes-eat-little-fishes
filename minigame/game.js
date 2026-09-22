/* ============================================================
   game.js —— 抖音小游戏入口
   执行顺序：
     1. 先加载 adapter.js 垫片（提供 window/document/localStorage 等）
     2. 再加载 main.js（游戏内核 + Canvas UI + 触屏）
   ============================================================ */
require('./js/adapter.js');
require('./js/main.js');
