import { route, body, json, HttpError } from '@/lib/api';
import { checkPassword, signSession, setSessionCookie, DUMMY_HASH } from '@/lib/auth';
import User from '@/models/User';

export const POST = route(async request => {
  const { name, password } = await body(request);
  if(typeof name !== 'string' || typeof password !== 'string' || !name || !password) throw new HttpError(400, 'Enter a name and a password.');
  const user = await User.findOne({ nameLower:name.trim().toLowerCase() }).select('+passHash');
  const ok = await checkPassword(password, user ? user.passHash : DUMMY_HASH);
  if(!user || !ok) throw new HttpError(401, 'Wrong name or password.');
  const res = json({ name:user.name });
  setSessionCookie(res, await signSession(user));
  return res;
});
