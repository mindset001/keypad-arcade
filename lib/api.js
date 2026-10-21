import { NextResponse } from 'next/server';
import { connectDB } from './db';
import { readSession } from './auth';

export class HttpError extends Error{
  constructor(status, message){ super(message); this.status = status; }
}
export const json = (data, status = 200) => NextResponse.json(data, { status });

/* Wraps a route handler: connects to Mongo, turns thrown HttpErrors into JSON,
   and reports an unreachable database as 503 instead of a stack trace. */
export function route(handler, { auth = false } = {}){
  return async (request, ctx) => {
    try{
      if(request.method !== 'GET' && !(request.headers.get('content-type') || '').includes('application/json'))
        throw new HttpError(415, 'Send JSON.');
      await connectDB();
      const session = await readSession(request);
      if(auth && !session) throw new HttpError(401, 'Log in first.');
      return await handler(request, session, ctx);
    }catch(e){
      if(e instanceof HttpError) return json({ error:e.message }, e.status);
      console.error('[api]', e);
      const down = e.code === 'NO_DB' || /^Mongo/.test(e.name || '');
      return json({ error: down ? 'Server unavailable. Try again, or play as guest.' : 'Something went wrong.' }, down ? 503 : 500);
    }
  };
}

export async function body(request){
  try{ const b = await request.json(); if(b && typeof b === 'object') return b; }catch{}
  throw new HttpError(400, 'Bad request.');
}
