import { NextResponse } from 'next/server';
import { readSession } from '@/lib/auth';
import { connectDB } from '@/lib/db';
import User from '@/models/User';

/* Who am I? Never errors: no/invalid session, a deleted account or an unreachable database
   all just mean "not logged in" (the game falls back to guest). */
export async function GET(request){
  try{
    const s = await readSession(request);
    if(!s) return NextResponse.json({ user:null });
    await connectDB();
    const u = await User.findById(s.id).select('name theme').lean();
    return NextResponse.json({ user: u ? { name:u.name, theme:u.theme } : null });
  }catch{ return NextResponse.json({ user:null }); }
}
