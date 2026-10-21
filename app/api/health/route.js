import { NextResponse } from 'next/server';
import { connectDB } from '@/lib/db';

/* GET /api/health: why is the server unavailable? Reports which settings exist and whether
   MongoDB answers, with a short reason. It never returns the connection string, the password,
   the secret or the raw driver message (which can contain host names). Safe to leave in place. */
export const dynamic = 'force-dynamic';

function explain(e){
  const text = `${e?.name || ''} ${e?.codeName || ''} ${e?.message || ''}`;
  if(/bad auth|Authentication failed|AuthenticationFailed|auth failed/i.test(text)) return 'authentication failed: the database user or password in MONGODB_URI is wrong (did you change the password in Atlas but not here?)';
  if(/ENOTFOUND|querySrv|EBADNAME|getaddrinfo/i.test(text)) return 'host not found: check the cluster address in MONGODB_URI';
  if(/ServerSelection|timed out|ETIMEDOUT|ECONNREFUSED|MongoNetwork/i.test(text)) return 'could not reach the database: in Atlas open Network Access and allow this server (Vercel needs 0.0.0.0/0), or check the host';
  if(/Invalid scheme|Invalid connection string|MongoParseError|URI/i.test(text)) return 'MONGODB_URI is not a valid connection string (it must start with mongodb:// or mongodb+srv://)';
  return `unexpected error (${e?.name || 'unknown'}); see the function logs`;
}

export async function GET(){
  const uri = process.env.MONGODB_URI || '', secret = process.env.AUTH_SECRET || '';
  const out = {
    env: {
      MONGODB_URI: uri ? (/^mongodb(\+srv)?:\/\//.test(uri) ? 'set' : 'set but malformed') : 'MISSING',
      AUTH_SECRET: secret.length >= 16 ? 'set' : secret ? 'too short (need 16+ characters)' : 'MISSING'
    },
    db: 'not tried'
  };
  if(!uri){ out.reason = 'MONGODB_URI is not set on this deployment. Add it in Vercel (Settings > Environment Variables) and redeploy.'; }
  else {
    // out.database: accounts live in ONE database, so a mismatch between deployments explains "my account isn't there"
    try{ const c = await connectDB(); await c.connection.db.admin().ping(); out.db = 'ok'; out.database = c.connection.name; }
    catch(e){ out.db = 'failed'; out.reason = explain(e); console.error('[health]', e?.name, e?.codeName || ''); }
  }
  if(out.env.AUTH_SECRET !== 'set') out.reason = [out.reason, 'AUTH_SECRET must be set (16+ characters) or nobody can log in.'].filter(Boolean).join(' ');
  const healthy = out.db === 'ok' && out.env.AUTH_SECRET === 'set';
  return NextResponse.json({ healthy, ...out }, { status: healthy ? 200 : 503, headers:{ 'Cache-Control':'no-store' } });
}
