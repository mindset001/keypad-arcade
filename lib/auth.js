import { SignJWT, jwtVerify } from 'jose';
import bcrypt from 'bcryptjs';

export const COOKIE = 'ka_session';
export const NAME_RE = /^[A-Za-z0-9_]{2,12}$/;
const MAX_AGE = 60 * 60 * 24 * 30; // 30 days

function secret(){
  const s = process.env.AUTH_SECRET;
  if(!s || s.length < 16){ const e = new Error('AUTH_SECRET must be set (16+ characters)'); e.code = 'NO_DB'; throw e; }
  return new TextEncoder().encode(s);
}

export const hashPassword = pw => bcrypt.hash(pw, 10);
export const checkPassword = (pw, hash) => bcrypt.compare(pw, hash);
// compared against when the name doesn't exist, so "no such player" costs the same time as "wrong password"
export const DUMMY_HASH = bcrypt.hashSync('not-a-real-password', 10);

export async function signSession(user){
  return new SignJWT({ name:user.name }).setProtectedHeader({ alg:'HS256' })
    .setSubject(String(user._id)).setIssuedAt().setExpirationTime(`${MAX_AGE}s`).sign(secret());
}

/* -> { id, name } or null */
export async function readSession(request){
  const token = request.cookies.get(COOKIE)?.value;
  if(!token) return null;
  try{ const { payload } = await jwtVerify(token, secret()); return { id:payload.sub, name:payload.name }; }
  catch{ return null; }
}

export function setSessionCookie(res, token){
  res.cookies.set(COOKIE, token, { httpOnly:true, sameSite:'lax', secure:process.env.NODE_ENV === 'production', path:'/', maxAge:MAX_AGE });
}
export function clearSessionCookie(res){
  res.cookies.set(COOKIE, '', { httpOnly:true, sameSite:'lax', secure:process.env.NODE_ENV === 'production', path:'/', maxAge:0 });
}
