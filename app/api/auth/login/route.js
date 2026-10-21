import { route, body, json, HttpError } from '@/lib/api';
import { checkPassword, signSession, setSessionCookie, DUMMY_HASH } from '@/lib/auth';
import { limiter, LIMITS, clientIp } from '@/lib/limits';
import { byteLength, PASSWORD_MAX_BYTES } from '@/lib/arcade/validate';
import User from '@/models/User';

const TOO_MANY = 'Too many attempts. Wait a few minutes and try again.';

export const POST = route(async request => {
  const { name, password } = await body(request);
  if(typeof name !== 'string' || typeof password !== 'string' || !name.trim() || !password) throw new HttpError(400, 'Enter a name and a password.');
  const lower = name.trim().toLowerCase(), nameKey = `login:name:${lower}`, ipKey = `login:ip:${clientIp(request)}`;

  /* already locked out? (only failed attempts count, so a correct login is never the thing that locks you) */
  const [byName, byIp] = await Promise.all([limiter.blocked(nameKey, LIMITS.loginPerName.limit), limiter.blocked(ipKey, LIMITS.loginPerIp.limit)]);
  if(byName.blocked || byIp.blocked) throw new HttpError(429, TOO_MANY, { 'Retry-After':String(Math.max(byName.retryAfter, byIp.retryAfter)) });

  const user = await User.findOne({ nameLower:lower }).select('+passHash');
  // a password longer than we ever accept can't be right; it is also never handed to bcrypt (which would cut it at 72 bytes)
  const ok = byteLength(password) <= PASSWORD_MAX_BYTES && await checkPassword(password, user ? user.passHash : DUMMY_HASH);
  if(!user || !ok){
    await Promise.all([limiter.hit(nameKey, LIMITS.loginPerName.limit, LIMITS.loginPerName.windowSec), limiter.hit(ipKey, LIMITS.loginPerIp.limit, LIMITS.loginPerIp.windowSec)]);
    throw new HttpError(401, 'Wrong name or password.');
  }
  await limiter.clear(nameKey);
  await User.updateOne({ _id:user._id }, { lastLoginAt:new Date() });
  const res = json({ name:user.name, theme:user.theme });
  setSessionCookie(res, await signSession(user), request);
  return res;
});
