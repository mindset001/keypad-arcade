'use client';

import { useEffect, useRef } from 'react';

/* The hero handset: a CSS-3D phone (stacked slabs give it thickness) that follows the
   pointer, with a live LCD cycling through small procedural demos of the five games.
   Purely decorative, so it is aria-hidden and honours prefers-reduced-motion. */

const INK = '#22301b';
const W = 128, H = 96;
const SLABS = 12;

/* ---------- LCD demo scenes: each returns draw(ctx, t) ---------- */
function snakeScene(){
  const path = [], x0 = 3, y0 = 3, x1 = 28, y1 = 20;
  for(let x = x0; x <= x1; x++) path.push([x, y0]);
  for(let y = y0 + 1; y <= y1; y++) path.push([x1, y]);
  for(let x = x1 - 1; x >= x0; x--) path.push([x, y1]);
  for(let y = y1 - 1; y > y0; y--) path.push([x0, y]);
  const N = path.length, foods = [9, 31, 55, 77].map(i => i % N);
  return (c, t) => {
    const head = Math.floor(t * 11) % N;
    c.fillRect(0, 0, W, 2); c.fillRect(0, H - 2, W, 2); c.fillRect(0, 0, 2, H); c.fillRect(W - 2, 0, 2, H);
    for(const f of foods){
      if((f - head + N) % N < N - 8){ const [x, y] = path[f]; c.fillRect(x * 4 + 1, y * 4, 1, 1); c.fillRect(x * 4, y * 4 + 1, 3, 1); c.fillRect(x * 4 + 1, y * 4 + 2, 1, 1); }
    }
    for(let i = 0; i < 13; i++){ const [x, y] = path[(head - i + N) % N]; c.fillRect(x * 4, y * 4, 3, 3); }
  };
}

function bounceScene(){
  return (c, t) => {
    const off = t * 38, floor = 78;
    for(let x = -(off % 16); x < W; x += 16){ c.fillRect(x, floor, 16, 1); c.fillRect(x + 7, floor + 1, 1, 8); c.fillRect(x, floor + 9, 16, 1); c.fillRect(x + 15, floor + 10, 1, 8); }
    c.fillRect(0, floor + 18, W, 1);
    for(let k = 0; k < 3; k++){ // spikes
      const x = ((k * 70 + 120 - off) % 210 + 210) % 210 - 20;
      for(let i = 0; i < 2; i++){ const sx = x + i * 8; c.fillRect(sx + 3, floor - 5, 2, 2); c.fillRect(sx + 2, floor - 3, 4, 2); c.fillRect(sx + 1, floor - 1, 6, 1); }
    }
    for(let k = 0; k < 4; k++){ // rings
      const x = ((k * 56 + 90 - off) % 224 + 224) % 224 - 20, y = 40 + (k % 2) * 14;
      c.fillRect(x + 1, y, 2, 1); c.fillRect(x, y + 1, 1, 4); c.fillRect(x + 3, y + 1, 1, 4); c.fillRect(x + 1, y + 5, 2, 1);
    }
    const by = floor - 3 - Math.abs(Math.sin(t * 3.4)) * 30;
    for(let dy = -3; dy < 3; dy++) for(let dx = -3; dx < 3; dx++) if((dx + .5) ** 2 + (dy + .5) ** 2 <= 9.5) c.fillRect(36 + dx, Math.round(by) + dy, 1, 1);
  };
}

function rollScene(){
  let plats = null, ball, last = 0, wait = 0;
  const init = () => {
    plats = Array.from({ length: 6 }, (_, i) => ({ x: 8 + ((i * 53) % 90), y: 18 + i * 18, py: 18 + i * 18 }));
    ball = { x: plats[1].x + 13, y: plats[1].y - 3, vy: 0, on: plats[1] };
  };
  return (c, t) => {
    if(!plats) init();
    const dt = Math.min(.05, Math.max(0, t - last)); last = t;
    for(const p of plats){ p.py = p.y; p.y -= 16 * dt; if(p.y < -4){ p.y += 108; p.x = 6 + Math.random() * 92; p.py = p.y; } }
    if(ball.on){
      if(ball.x < ball.on.x || ball.x > ball.on.x + 26 || ball.on.y < 12){ ball.on = null; ball.vy = 10; }
      else {
        ball.y = ball.on.y - 3; wait += dt;
        if(wait > .7){ const next = plats.filter(p => p.y > ball.y + 8).sort((a, b) => a.y - b.y)[0]; if(next) ball.x += Math.sign(next.x + 13 - ball.x) * 40 * dt; }
      }
    }
    if(!ball.on){
      ball.vy += 220 * dt; ball.y += ball.vy * dt; wait = 0;
      const next = plats.filter(p => p.y > ball.y).sort((a, b) => a.y - b.y)[0];
      if(next) ball.x += Math.max(-22 * dt, Math.min(22 * dt, next.x + 13 - ball.x));
      for(const p of plats) if(ball.vy >= 0 && ball.y + 3 >= p.y && ball.y + 3 - ball.vy * dt <= p.py + 1 && ball.x > p.x && ball.x < p.x + 26){ ball.on = p; ball.y = p.y - 3; ball.vy = 0; break; }
      if(ball.y > H + 6 || ball.y < 4){ const p = plats.find(q => q.y > 10 && q.y < 40) || plats[0]; Object.assign(ball, { x:p.x + 13, y:p.y - 3, vy:0, on:p }); }
    }
    for(let x = 0; x < W; x += 6) for(let r = 0; r < 4; r++){ const ins = [0, 0, 1, 2][r]; c.fillRect(x + ins, r, 6 - 2 * ins, 1); }
    for(const p of plats){ const x = Math.round(p.x), y = Math.round(p.y); c.fillRect(x, y, 26, 1); c.fillRect(x, y + 2, 26, 1); for(let i = 0; i < 26; i += 3) c.fillRect(x + i, y + 1, 1, 1); }
    for(let dy = -3; dy < 3; dy++) for(let dx = -3; dx < 3; dx++) if((dx + .5) ** 2 + (dy + .5) ** 2 <= 9.5) c.fillRect(Math.round(ball.x) + dx, Math.round(ball.y) + dy, 1, 1);
  };
}

function soccerScene(){
  const A = [[14, 48], [38, 48], [62, 26], [62, 70], [84, 48]];
  return (c, t) => {
    c.fillRect(2, 3, 124, 1); c.fillRect(2, 92, 124, 1); c.fillRect(2, 3, 1, 90); c.fillRect(125, 3, 1, 90); c.fillRect(64, 3, 1, 90);
    for(let i = 0; i < 24; i++){ const a = i / 24 * 6.2832; c.fillRect(Math.round(64 + Math.cos(a) * 12), Math.round(48 + Math.sin(a) * 12), 1, 1); }
    c.fillRect(2, 30, 18, 1); c.fillRect(2, 66, 18, 1); c.fillRect(19, 30, 1, 37); c.fillRect(108, 30, 18, 1); c.fillRect(108, 66, 18, 1); c.fillRect(108, 30, 1, 37);
    const pos = (b, i, flip) => { const x = b[0] + Math.sin(t * 1.3 + i * 1.7) * 5, y = b[1] + Math.cos(t * 1.1 + i * 2.1) * 5; return [flip ? 128 - x : x, y]; };
    const a = A.map((b, i) => pos(b, i, false));
    for(const [x, y] of a) c.fillRect(Math.round(x) - 1, Math.round(y) - 1, 3, 3);
    A.forEach((b, i) => { const [x, y] = pos(b, i + 7, true); c.fillRect(Math.round(x) - 1, Math.round(y) - 1, 3, 3); c.clearRect(Math.round(x), Math.round(y), 1, 1); });
    const k = t / .9, i = Math.floor(k) % 5, f = k % 1, from = a[i], to = a[(i + 1) % 5];
    const bx = from[0] + (to[0] - from[0]) * f, by = from[1] + (to[1] - from[1]) * f;
    c.fillRect(Math.round(bx), Math.round(by) - 1, 1, 3); c.fillRect(Math.round(bx) - 1, Math.round(by), 3, 1);
  };
}

function tennisScene(){
  return (c, t) => {
    c.fillRect(0, 4, W, 1); c.fillRect(0, H - 5, W, 1);
    for(let y = 6; y < H - 6; y += 4) c.fillRect(63, y, 1, 2);
    const k = (t * .55) % 1, tri = k < .5 ? k * 2 : 2 - k * 2;                 // the ball crosses and comes back
    const bx = 12 + tri * (W - 26), by = 48 + Math.sin(t * 2.6) * 30;
    const follow = (y, lag) => Math.max(16, Math.min(H - 16, 48 + Math.sin(t * 2.6 - lag) * 30));
    c.fillRect(8, Math.round(follow(0, .35) - 8), 2, 16); c.fillRect(W - 10, Math.round(follow(0, .7) - 8), 2, 16);
    c.fillRect(Math.round(bx), Math.round(by), 3, 3);
  };
}

const SCENES = [
  { name:'Snake Xenzia', make:snakeScene },
  { name:'Rapid Roll', make:rollScene },
  { name:'Bounce', make:bounceScene },
  { name:'Soccer League', make:soccerScene },
  { name:'Table Tennis', make:tennisScene }
];
const SCENE_SECONDS = 6;

const KEYS = [['1', ''], ['2', 'abc'], ['3', 'def'], ['4', 'ghi'], ['5', 'jkl'], ['6', 'mno'], ['7', 'pqrs'], ['8', 'tuv'], ['9', 'wxyz'], ['*', ''], ['0', ''], ['#', '']];

/* little pixel props floating in front of the handset, each at its own depth */
const Chip = ({ z, x, y, delay, children }) => (
  <div className="lp-chip" style={{ '--z': `${z}px`, '--x': x, '--y': y, '--d': `${delay}s` }}>{children}</div>
);

export default function Hero(){
  const stage = useRef(null), rig = useRef(null), canvas = useRef(null), title = useRef(null);

  useEffect(() => {
    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const ctx = canvas.current.getContext('2d');
    let raf = 0, alive = true, scene = -1, draw = null, start = performance.now();
    let tx = -16, ty = 7, cx = tx, cy = ty, pointer = null;

    const setScene = i => { const sc = SCENES[i] || SCENES[0]; scene = i; draw = sc.make(); title.current.textContent = sc.name; };
    setScene(0);

    const frame = () => {
      if(!alive || !rig.current || !canvas.current) return;
      // performance.now(), not the rAF timestamp: that can predate `start` and make t negative
      const t = Math.max(0, (performance.now() - start) / 1000), idx = Math.floor(t / SCENE_SECONDS) % SCENES.length || 0;
      if(idx !== scene) setScene(idx);
      ctx.clearRect(0, 0, W, H); ctx.fillStyle = INK; draw(ctx, t % SCENE_SECONDS + (reduce ? 3 : 0));

      if(pointer){ tx = (pointer.x - .5) * 34; ty = -(pointer.y - .5) * 22; }
      else { tx = -16 + Math.sin(t * .55) * 16; ty = 7 + Math.sin(t * .4) * 4; }
      const lift = Math.min(window.scrollY, 600) * .03; // slight extra turn as you scroll away
      cx += (tx + lift - cx) * .08; cy += (ty - cy) * .08;
      rig.current.style.transform = `rotateX(${cy.toFixed(2)}deg) rotateY(${cx.toFixed(2)}deg)`;
      raf = requestAnimationFrame(frame);
    };

    if(reduce){ // one still frame, a fixed pose
      draw(ctx, 3); rig.current.style.transform = 'rotateX(7deg) rotateY(-16deg)';
    } else raf = requestAnimationFrame(frame);

    const move = e => {
      const r = stage.current.getBoundingClientRect();
      pointer = { x:Math.max(0, Math.min(1, (e.clientX - r.left) / r.width)), y:Math.max(0, Math.min(1, (e.clientY - r.top) / r.height)) };
    };
    const el = stage.current, leave = () => { pointer = null; };
    el.addEventListener('pointermove', move); el.addEventListener('pointerleave', leave);
    return () => { alive = false; cancelAnimationFrame(raf); el.removeEventListener('pointermove', move); el.removeEventListener('pointerleave', leave); };
  }, []);

  return (
    <div className="lp-stage" ref={stage} aria-hidden="true">
      <div className="lp-scale">
        <div className="lp-rig" ref={rig}>
          {Array.from({ length: SLABS }, (_, i) => (
            <div key={i} className="lp-slab" style={{ transform:`translateZ(${-(i + 1) * 1.6}px)`, filter:`brightness(${0.55 - i * .02})` }} />
          ))}
          <div className="lp-face">
            <div className="lp-ear" />
            <div className="lp-bezel">
              <div className="lp-lcd">
                <div className="lp-lcd-bar"><span className="lp-sig"><i /><i /><i /><i /></span><span ref={title} /></div>
                <canvas ref={canvas} width={W} height={H} />
              </div>
            </div>
            <div className="lp-ctl">
              <span className="lp-k lp-k-sel">Select</span>
              <div className="lp-dpad"><i className="u">▲</i><i className="l">◀</i><b /><i className="r">▶</i><i className="d">▼</i></div>
              <span className="lp-k lp-k-c">C</span>
            </div>
            <div className="lp-pad">{KEYS.map(([n, s]) => <span key={n} className="lp-k"><em>{n}</em><small>{s}</small></span>)}</div>
          </div>

          <Chip z={95} x="-34%" y="14%" delay={0}><svg viewBox="0 0 12 12" width="44" height="44" shapeRendering="crispEdges"><path fill="#7cf2c1" d="M4 1h4v1h2v2h1v4h-1v2H8v1H4v-1H2V8H1V4h1V2h2z"/><path fill="#d9fff0" d="M4 3h2v2H4z"/></svg></Chip>
          <Chip z={120} x="108%" y="30%" delay={.8}><svg viewBox="0 0 12 12" width="38" height="38" shapeRendering="crispEdges"><path fill="#ff7b8f" d="M2 2h3v1h2V2h3v1h1v3h-1v1h-1v1H8v1H7v1H5v-1H4V9H3V8H2V7H1V3h1z"/></svg></Chip>
          <Chip z={80} x="104%" y="72%" delay={1.6}><svg viewBox="0 0 12 12" width="40" height="40" shapeRendering="crispEdges"><path fill="#ffb86b" d="M4 1h4v1h2v2h1v4h-1v2H8v1H4v-1H2V8H1V4h1V2h2z"/><path fill="#2a1400" d="M5 4h2v1h1v2H7v1H5V7H4V5h1z"/></svg></Chip>
          <Chip z={105} x="-30%" y="74%" delay={2.4}><svg viewBox="0 0 12 12" width="36" height="36" shapeRendering="crispEdges"><path fill="#8fb4ff" d="M4 1h4v1h1v1h1v1h1v4h-1v1H9v1H8v1H4v-1H3V9H2V8H1V4h1V3h1V2h1z"/><path fill="#1c2a55" d="M4 4h4v4H4z"/><path fill="#8fb4ff" d="M5 5h2v2H5z"/></svg></Chip>
        </div>
        <div className="lp-shadow" />
      </div>
    </div>
  );
}
