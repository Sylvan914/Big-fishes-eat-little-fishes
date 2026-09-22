// 云函数：save —— 玩家存档读写（抖音云开发，云端 + 本地双缓存方案的云端侧）
//
// 部署说明：
//   1. 在抖音云控制台创建云函数 `save`，上传本目录。
//   2. 云数据库创建集合 `player_saves`，权限设为「仅创建者可读写」，
//      玩家只能读写自己的存档，保护数据安全。
//   3. SDK 包名以抖音云实际环境为准：微信云为 `wx-server-sdk`；抖音云开发
//      通常兼容 wx-server-sdk 或提供等价 SDK，部署时按控制台指引替换 require 即可。
const cloud = require('wx-server-sdk');
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV });

const db = cloud.database();
const COLLECTION = 'player_saves';

// 存档字段：openid、nickname、totalEaten、selected、unlocked、frags、fragLog、diy、ts
exports.main = async (event) => {
  const { OPENID } = cloud.getWXContext();
  const action = event.action;

  // 登录：直接返回当前调用者 OpenID（云上下文已鉴权，无需校验 code）
  if (action === 'login') {
    return { openid: OPENID };
  }

  if (!OPENID) return { err: 'no openid' };

  // 读取自己的存档（文档 _id 即 openid）
  if (action === 'get') {
    try {
      const res = await db.collection(COLLECTION).doc(OPENID).get();
      return { data: res.data };
    } catch (e) {
      return { data: null };   // 首次进入，尚无云端存档
    }
  }

  // 写入 / 更新存档（upsert：_id 即 openid，客户端无法伪造他人 openid）
  if (action === 'set') {
    const doc = event.doc || {};
    delete doc.openid;                     // openid 由云上下文决定，不接受客户端传入
    const payload = { ...doc, ts: doc.ts || Date.now() };
    try {
      await db.collection(COLLECTION).doc(OPENID).set({ data: payload });
    } catch (e) {
      // 文档不存在时（部分云平台 set 不自动建文档）兜底 add，_id 固定为 openid
      await db.collection(COLLECTION).add({ data: { _id: OPENID, ...payload } });
    }
    return { ok: true };
  }

  return { err: 'unknown action' };
};
