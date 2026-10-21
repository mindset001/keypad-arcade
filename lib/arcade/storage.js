/* Key/value store on localStorage that falls back to memory when storage is blocked
   (private windows, strict privacy settings). Values are JSON. */
export function createStore(){
  const mem = {};
  return {
    get(k, d){ try{ const v = localStorage.getItem(k); if(v !== null) return JSON.parse(v); }catch(e){} return k in mem ? mem[k] : d; },
    set(k, v){ mem[k] = v; try{ localStorage.setItem(k, JSON.stringify(v)); }catch(e){} },
    del(k){ delete mem[k]; try{ localStorage.removeItem(k); }catch(e){} }
  };
}
