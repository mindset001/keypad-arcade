import { SignJWT, jwtVerify } from 'jose';
import bcrypt from 'bcryptjs';

export const COOKIE = 'ka_session';
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

/* `secure` follows the actual connection: https on Vercel, plain http on localhost. (Tying it to
   NODE_ENV broke `next start` over http://localhost in Safari, which rejects Secure cookies there.) */
const isHttps = request => request.nextUrl?.protocol === 'https:' || (request.headers.get('x-forwarded-proto') || '').split(',')[0].trim() === 'https';
const cookieOpts = (request, maxAge) => ({ httpOnly:true, sameSite:'lax', secure:isHttps(request), path:'/', maxAge });
export const setSessionCookie = (res, token, request) => res.cookies.set(COOKIE, token, cookieOpts(request, MAX_AGE));
export const clearSessionCookie = (res, request) => res.cookies.set(COOKIE, '', cookieOpts(request, 0));
