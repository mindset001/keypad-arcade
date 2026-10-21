import mongoose from 'mongoose';

/* One shared connection per server process. Next.js dev reloads modules often, so the
   handle is parked on globalThis instead of module scope. Nothing connects at import
   time, so `next build` works without a database. */
const cache = globalThis._kaMongoose || (globalThis._kaMongoose = { conn:null, promise:null });

export async function connectDB(){
  const uri = process.env.MONGODB_URI;
  if(!uri){ const e = new Error('MONGODB_URI is not set'); e.code = 'NO_DB'; throw e; }
  if(cache.conn) return cache.conn;
  cache.promise ||= mongoose.connect(uri, { bufferCommands:false, serverSelectionTimeoutMS:5000 });
  try{ cache.conn = await cache.promise; }
  catch(e){ cache.promise = null; throw e; }
  return cache.conn;
}
