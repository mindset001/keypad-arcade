/* Attempt limiting with a swappable store (Mongo in production, a Map in tests). Pure logic:
   a "window" starts on the first hit and the counter resets when it ends. */
export function createLimiter(store){
  return {
    /* counts one attempt. ok is false once the count passes `limit` within the window */
    async hit(key, limit, windowSec, now = Date.now()){
      const { count, resetAt } = await store.incr(key, windowSec * 1000, now);
      return { ok:count <= limit, count, retryAfter:Math.max(1, Math.ceil((resetAt - now) / 1000)) };
    },
    /* is this key already at its limit? (does not count) */
    async blocked(key, limit, now = Date.now()){
      const e = await store.get(key, now);
      return e && e.count >= limit ? { blocked:true, retryAfter:Math.max(1, Math.ceil((e.resetAt - now) / 1000)) } : { blocked:false, retryAfter:0 };
    },
    clear: key => store.del(key)
  };
}

export function memoryStore(){
  const m = new Map();
  return {
    async incr(key, windowMs, now){
      let e = m.get(key);
      if(!e || e.resetAt <= now){ e = { count:0, resetAt:now + windowMs }; m.set(key, e); }
      e.count++; return { ...e };
    },
    async get(key, now){ const e = m.get(key); return e && e.resetAt > now ? { ...e } : null; },
    async del(key){ m.delete(key); }
  };
}

/* a store that never limits anything (RATE_LIMIT=off, for local testing) */
export const offStore = {
  async incr(key, windowMs, now){ return { count:1, resetAt:now + windowMs }; },
  async get(){ return null; },
  async del(){}
};
