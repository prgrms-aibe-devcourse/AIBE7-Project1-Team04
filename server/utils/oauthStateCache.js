const crypto = require("crypto");

// 카카오 신규 가입자가 이메일 입력 페이지로 넘어가는 동안
// Kakao identity(sub, nickname)를 잠시 보관하는 in-memory state 캐시.
//
// 단일 인스턴스 가정. 다중 인스턴스/스케일아웃 시 Redis 등으로 교체 필요.

const TTL_MS = 10 * 60 * 1000;
const cache = new Map();

function put(payload) {
  const id = crypto.randomBytes(16).toString("hex");
  cache.set(id, { payload, expires: Date.now() + TTL_MS });
  return id;
}

function take(id) {
  if (!id) return null;
  const entry = cache.get(id);
  if (!entry) return null;
  cache.delete(id);
  if (entry.expires < Date.now()) return null;
  return entry.payload;
}

setInterval(() => {
  const now = Date.now();
  for (const [key, value] of cache.entries()) {
    if (value.expires < now) cache.delete(key);
  }
}, 60 * 1000).unref();

module.exports = { put, take };
