/* Calls our own /api routes. Never throws: always resolves to { ok, status, data }. */
export async function api(path, method = 'GET', data){
  try{
    const r = await fetch('/api' + path, {
      method, credentials:'same-origin',
      headers: data ? { 'Content-Type':'application/json' } : undefined, body: data ? JSON.stringify(data) : undefined
    });
    return { ok:r.ok, status:r.status, data: await r.json().catch(() => ({})) };
  }catch(e){ return { ok:false, status:0, data:{ error:'Offline. Try again, or play as guest.' } }; }
}
