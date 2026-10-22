import { route, body, json, HttpError } from '@/lib/api';
import { limiter, LIMITS, clientIp } from '@/lib/limits';
import Room from '@/models/Room';
import { cleanCode, validSdp, validName } from '@/lib/rooms';

const find = async params => {
  const code = cleanCode((await params).code);
  const room = code ? await Room.findOne({ code }) : null;
  if(!room) throw new HttpError(404, 'No room with that code. Check it, or ask for a new one.');
  return room;
};

/* GET -> what a joining friend needs ({ game, hostName, offer }) and what the host polls for ({ answer, guestName }) */
export const GET = route(async (request, session, ctx) => {
  const rl = await limiter.hit(`room:look:${clientIp(request)}`, LIMITS.roomJoinPerIp.limit, LIMITS.roomJoinPerIp.windowSec);
  if(!rl.ok) throw new HttpError(429, 'Slow down a little.', { 'Retry-After':String(rl.retryAfter) });
  const r = await find(ctx.params);
  return json({ game:r.game, hostName:r.hostName, offer:r.offer, answer:r.answer, guestName:r.guestName });
});

/* POST { name, answer } -> the friend takes the open seat. The first answer wins; later ones get 409. */
export const POST = route(async (request, session, ctx) => {
  const b = await body(request);
  if(!validName(b.name)) throw new HttpError(400, 'Bad player name.');
  if(!validSdp(b.answer)) throw new HttpError(400, 'Bad connection data.');
  const code = cleanCode((await ctx.params).code); if(!code) throw new HttpError(404, 'No room with that code.');
  const r = await Room.findOneAndUpdate({ code, answer:'' }, { $set:{ answer:b.answer, guestName:b.name } }, { new:true });
  if(!r){ throw new HttpError(await Room.exists({ code }) ? 409 : 404, await Room.exists({ code }) ? 'That room is already full.' : 'No room with that code.'); }
  return json({ ok:true }, 201);
});

/* DELETE { token } -> the host closes the room */
export const DELETE = route(async (request, session, ctx) => {
  const b = await body(request), r = await find(ctx.params);
  if(!b.token || b.token !== r.token) throw new HttpError(403, 'Not your room.');
  await Room.deleteOne({ _id:r._id });
  return json({ ok:true });
});
