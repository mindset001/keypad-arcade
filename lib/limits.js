import { createLimiter, offStore } from './ratelimit.js';
import RateLimit from '../models/RateLimit.js';

/* MongoDB-backed store, so limits hold across serverless instances. */
const mongoStore = {
  async incr(key, windowMs, now){
    const nowD = new Date(now), active = { _id:key, resetAt:{ $gt:nowD } };
    let doc = await RateLimit.findOneAndUpdate(active, { $inc:{ count:1 } }, { new:true }).lean();
    if(!doc){
      try{ doc = await RateLimit.findOneAndUpdate({ _id:key }, { $set:{ count:1, resetAt:new Date(now + windowMs) } }, { upsert:true, new:true }).lean(); }
      catch(e){ if(e.code !== 11000) throw e; doc = await RateLimit.findOneAndUpdate(active, { $inc:{ count:1 } }, { new:true }).lean(); } // lost a race: join the winner's window
    }
    return { count:doc ? doc.count : 1, resetAt:doc ? +doc.resetAt : now + windowMs };
  },
  async get(key, now){ const d = await RateLimit.findOne({ _id:key, resetAt:{ $gt:new Date(now) } }).lean(); return d ? { count:d.count, resetAt:+d.resetAt } : null; },
  async del(key){ await RateLimit.deleteOne({ _id:key }); }
};

/* RATE_LIMIT=off turns limiting off (local testing only; leave it unset in production) */
export const limiter = createLimiter(process.env.RATE_LIMIT === 'off' ? offStore : mongoStore);

export const LIMITS = {
  loginPerName: { limit:8,  windowSec:900 },   // failed logins for one player name, per 15 min
  loginPerIp:   { limit:30, windowSec:900 },   // failed logins from one address, per 15 min
  registerPerIp:{ limit:10, windowSec:3600 },  // new players from one address, per hour
  roomCreatePerIp:{ limit:20, windowSec:3600 }, // online rooms opened from one address, per hour
  roomJoinPerIp:  { limit:60, windowSec:3600 }  // room lookups / joins from one address, per hour
};

/* the caller's address as seen by the platform (Vercel sets x-forwarded-for) */
export const clientIp = request => (request.headers.get('x-forwarded-for') || '').split(',')[0].trim() || request.headers.get('x-real-ip') || 'unknown';
