import { route, body, json, HttpError } from '@/lib/api';
import { NAME_RE, hashPassword, signSession, setSessionCookie } from '@/lib/auth';
import User from '@/models/User';

export const POST = route(async request => {
  const { name, password } = await body(request);
  if(typeof name !== 'string' || !NAME_RE.test(name.trim())) throw new HttpError(400, 'Name: 2 to 12 letters or numbers.');
  if(typeof password !== 'string' || password.length < 6 || password.length > 72) throw new HttpError(400, 'Password needs 6 to 72 characters.');
  const display = name.trim(), lower = display.toLowerCase();
  if(lower === 'guest') throw new HttpError(400, 'That name is reserved. Pick another.');
  await User.init(); // make sure the unique index exists before the first insert
  if(await User.exists({ nameLower:lower })) throw new HttpError(409, 'That name is taken. Log in instead.');
  let user;
  try{ user = await User.create({ name:display, nameLower:lower, passHash:await hashPassword(password) }); }
  catch(e){ if(e.code === 11000) throw new HttpError(409, 'That name is taken. Log in instead.'); throw e; }
  const res = json({ name:user.name }, 201);
  setSessionCookie(res, await signSession(user));
  return res;
});
