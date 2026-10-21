import { HEART, pad } from '../lib/arcade/draw.js';

/* A do-nothing environment so the games can run without a browser. */
export function makeEnv(){
  const noop = () => {};
  const calls = { overlay:[], hidden:0, sfx:[] };
  return {
    ctx: new Proxy({}, { get: () => noop, set: () => true }),
    sfx: new Proxy({}, { get: (_, name) => () => calls.sfx.push(name) }),
    blit: noop, pad, INK:'#000', HEART,
    overlay: (title, text) => calls.overlay.push([title, text]),
    hideOverlay: () => { calls.hidden++; },
    calls
  };
}

/* Deterministic Math.random for the duration of fn. */
export function seeded(seed, fn){
  let s = seed >>> 0; const orig = Math.random;
  Math.random = () => { s = (Math.imul(s, 1664525) + 1013904223) >>> 0; return s / 2 ** 32; };
  try{ return fn(); } finally { Math.random = orig; }
}

export const STEP = 1 / 120;
export const run = (game, seconds, each) => { for(let i = 0; i < seconds * 120 && !game.done; i++){ if(each) each(i); game.update(STEP); } };
