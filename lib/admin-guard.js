import { cache } from 'react';
import { cookies } from 'next/headers';
import User from '../models/User.js';
import { verifyToken, COOKIE } from './auth.js';
import { connectDB } from './db.js';

/* Is this logged-in session an admin RIGHT NOW? Checked against the database on every request
   (never baked into the cookie), so removing someone's role takes effect immediately. */
export async function isAdmin(session){
  if(!session) return false;
  const u = await User.findById(session.id).select('role').lean();
  return !!u && u.role === 'admin';
}

/* For the admin PAGE: reads the visitor's cookie. 'admin' | 'denied' (logged out, or not an admin) | 'down' (database
   unreachable). Cached per request so the page and its metadata share one lookup. */
export const adminStatus = cache(async () => {
  let session = null;
  try{ session = await verifyToken((await cookies()).get(COOKIE)?.value); }catch{ return 'denied'; }
  if(!session) return 'denied';
  try{ await connectDB(); return (await isAdmin(session)) ? 'admin' : 'denied'; }
  catch{ return 'down'; }
});
