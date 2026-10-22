import crypto from 'node:crypto';
import { route, body, json, HttpError } from '@/lib/api';
import { limiter, LIMITS, clientIp } from '@/lib/limits';
import Room from '@/models/Room';
import { ROOM_GAMES, makeCode, validSdp, validName } from '@/lib/rooms';

/* POST { game, name, offer } -> { code, token }. The host opens a room and waits for a friend to answer. */
export const POST = route(async request => {
  const b = await body(request);
  if(!ROOM_GAMES.includes(b.game)) throw new HttpError(400, 'That game has no online play.');
  if(!validName(b.name)) throw new HttpError(400, 'Bad player name.');
  if(!validSdp(b.offer)) throw new HttpError(400, 'Bad connection data.');
  const rl = await limiter.hit(`room:create:${clientIp(request)}`, LIMITS.roomCreatePerIp.limit, LIMITS.roomCreatePerIp.windowSec);
  if(!rl.ok) throw new HttpError(429, 'Too many rooms. Try again later.', { 'Retry-After':String(rl.retryAfter) });
  const token = crypto.randomBytes(16).toString('hex');
  for(let i = 0; i < 8; i++){
    const code = makeCode();
    try{ await Room.create({ code, game:b.game, hostName:b.name, token, offer:b.offer }); return json({ code, token }, 201); }
    catch(e){ if(e.code !== 11000) throw e; }          // that code is taken: try another
  }
  throw new HttpError(503, 'Could not open a room. Try again.');
});
