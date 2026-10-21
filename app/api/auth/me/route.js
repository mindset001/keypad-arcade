import { NextResponse } from 'next/server';
import { readSession } from '@/lib/auth';

/* Who am I? Never errors: no/invalid session or missing config just means "not logged in". */
export async function GET(request){
  try{ const s = await readSession(request); return NextResponse.json({ user: s ? { name:s.name } : null }); }
  catch{ return NextResponse.json({ user:null }); }
}
