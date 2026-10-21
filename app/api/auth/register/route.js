import { route, body, json, HttpError } from '@/lib/api';
import { hashPassword, signSession, setSessionCookie } from '@/lib/auth';
import { limiter, LIMITS, clientIp } from '@/lib/limits';
import { nameError, passwordError } from '@/lib/arcade/validate';
import { THEMES } from '@/lib/arcade/data';
import User from '@/models/User';

export const POST = route(async request => {
  const rl = await limiter.hit(`register:ip:${clientIp(request)}`, LIMITS.registerPerIp.limit, LIMITS.registerPerIp.windowSec);
  if(!rl.ok) throw new HttpError(429, 'Too many new players from here. Try again later.', { 'Retry-After':String(rl.retryAfter) });

  const { name, password, theme } = await body(request);
  const bad = nameError(name) || passwordError(password);
  if(bad) throw new HttpError(400, bad);
  const display = name.trim(), lower = display.toLowerCase();

  await User.init(); // make sure the unique index exists before the first insert
  if(await User.exists({ nameLower:lower })) throw new HttpError(409, 'That name is taken. Log in instead.');
  let user;
  try{ user = await User.create({ name:display, nameLower:lower, passHash:await hashPassword(password), theme:THEMES.includes(theme) ? theme : THEMES[0] }); }
  catch(e){ if(e.code === 11000) throw new HttpError(409, 'That name is taken. Log in instead.'); throw e; }
  const res = json({ name:user.name, theme:user.theme }, 201);
  setSessionCookie(res, await signSession(user), request);
  return res;
});
