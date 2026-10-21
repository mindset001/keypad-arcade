import { NextResponse } from 'next/server';
import { readSession } from '@/lib/auth';
import { connectDB } from '@/lib/db';
import User from '@/models/User';

/* Who am I? Always answers 200:
     { user:{ name, theme } }  logged in
     { user:null }             not logged in (no cookie, bad cookie, or the account no longer exists)
     { user:null, unavailable:true }  there IS a cookie but the server can't check it right now
   so the game can say "server unavailable" instead of quietly acting logged out. */
export async function GET(request){
  let s = null;
  try{ s = await readSession(request); }catch{ return NextResponse.json({ user:null, unavailable:true }); } // missing AUTH_SECRET
  if(!s) return NextResponse.json({ user:null });
  try{
    await connectDB();
    const u = await User.findById(s.id).select('name theme').lean();
    return NextResponse.json({ user: u ? { name:u.name, theme:u.theme } : null });
  }catch{ return NextResponse.json({ user:null, unavailable:true }); }
}
