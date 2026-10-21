/* Bounce: level data (pure) plus the game class. */
/* Tile legend: # wall · B brittle (big ball breaks it) · ^ spike · o ring · * gem · L extra life
   P pump (big ball) · D deflator (small ball) · C checkpoint · e patrolling enemy · S start
   E exit gate (solid until every ring is collected). Rows 9-10 are the floor, row 0 the ceiling. */
export const TILE = 8, BROWS = 11;
export function mkLevel(w, f){
  const g = Array.from({ length:BROWS }, () => Array(w).fill(' '));
  const L = {
    put:(c, x, y) => { g[y][x] = c; },
    fill:(c, x1, x2, y1, y2 = y1) => { for(let y = y1; y <= y2; y++) for(let x = x1; x <= x2; x++) g[y][x] = c; },
    gap:(x1, x2) => L.fill(' ', x1, x2, 9, 10),
    exit:x => { L.fill('E', x, x, 7, 8); L.fill('#', x + 1, x + 1, 0, 10); }
  };
  L.fill('#', 0, w - 1, 0); L.fill('#', 0, w - 1, 9, 10); L.fill('#', 0, 0, 0, 10);
  f(L);
  return g.map(r => r.join(''));
}
export const BOUNCE_LEVELS = [
  /* 1 — first steps */
  mkLevel(56, L => {
    L.put('S', 2, 8);
    [[8,7],[12,6],[16,7],[20,7],[28,6],[32,6],[38,6],[46,7]].forEach(([x, y]) => L.put('o', x, y));
    L.put('^', 24, 8); L.put('o', 24, 6);
    L.fill('#', 30, 30, 7, 8);
    L.gap(38, 39); L.put('*', 44, 4);
    L.put('C', 36, 8);
    L.exit(54);
  }),
  /* 2 — spikes and ledges */
  mkLevel(64, L => {
    L.put('S', 2, 8);
    L.fill('^', 10, 11, 8); L.put('o', 10, 6); L.put('o', 12, 6);
    L.fill('#', 18, 20, 6); L.put('o', 19, 5); L.fill('#', 18, 18, 7, 8);
    L.fill('^', 24, 25, 8); L.put('o', 25, 6);
    L.put('C', 29, 8);
    L.gap(33, 35); L.put('o', 34, 6);
    L.fill('#', 40, 40, 6, 8); L.put('o', 38, 6); L.put('o', 42, 6);
    L.put('L', 45, 4); L.fill('#', 44, 46, 5);
    L.fill('^', 50, 51, 8); L.fill('^', 54, 55, 8); L.put('o', 52, 6); L.put('o', 56, 6);
    L.put('*', 58, 4);
    L.exit(61);
  }),
  /* 3 — pump, breakable wall, deflator, low tunnel */
  mkLevel(64, L => {
    L.put('S', 2, 8);
    L.put('o', 6, 7); L.put('o', 10, 6);
    L.put('P', 16, 7);
    L.put('o', 20, 6);
    L.fill('B', 26, 26, 1, 8);
    L.put('C', 29, 8); L.put('o', 31, 6);
    L.put('D', 34, 7);
    L.fill('#', 36, 46, 1, 7);
    L.put('o', 38, 8); L.put('o', 41, 8); L.put('o', 44, 8);
    L.fill('^', 50, 50, 8); L.gap(53, 54); L.put('o', 53, 6); L.put('*', 57, 6);
    L.exit(61);
  }),
  /* 4 — patrols */
  mkLevel(68, L => {
    L.put('S', 2, 8);
    L.put('e', 12, 8); L.put('o', 12, 5); L.put('o', 9, 6);
    L.put('C', 20, 8);
    L.fill('#', 24, 30, 5); L.put('o', 27, 4); L.put('e', 27, 8); L.put('o', 24, 7);
    L.gap(34, 36); L.put('o', 35, 6);
    L.put('e', 42, 8); L.put('e', 46, 8); L.put('o', 44, 4); L.put('o', 40, 6);
    L.put('C', 50, 8);
    L.fill('^', 54, 55, 8); L.put('o', 55, 6); L.put('L', 58, 6);
    L.put('e', 61, 8); L.put('*', 63, 6);
    L.exit(65);
  }),
  /* 5 — climb */
  mkLevel(72, L => {
    L.put('S', 2, 8);
    L.fill('#', 8, 10, 8); L.put('o', 9, 6);
    L.fill('#', 14, 16, 6); L.put('o', 15, 4);
    L.fill('#', 20, 22, 4); L.put('o', 21, 2);
    L.fill('#', 26, 28, 6); L.put('*', 27, 4);
    L.put('C', 33, 8);
    L.fill('#', 36, 36, 6, 8); L.put('o', 34, 6); L.put('o', 38, 3);
    L.fill('^', 40, 42, 8); L.put('o', 41, 4);
    L.fill('#', 46, 48, 5); L.put('o', 47, 3); L.put('L', 47, 7);
    L.gap(52, 55); L.put('o', 53, 6); L.put('o', 55, 6);
    L.fill('#', 60, 62, 6); L.put('o', 61, 4);
    L.fill('^', 66, 67, 8);
    L.exit(69);
  }),
  /* 6 — the lot */
  mkLevel(84, L => {
    L.put('S', 2, 8);
    L.put('o', 7, 6); L.put('e', 12, 8);
    L.put('P', 17, 7);
    L.fill('B', 22, 22, 1, 8); L.put('o', 25, 6);
    L.put('C', 28, 8);
    L.put('D', 31, 7); L.fill('#', 33, 41, 1, 7); L.put('o', 35, 8); L.put('o', 39, 8);
    L.put('e', 45, 8); L.fill('^', 48, 49, 8); L.put('o', 48, 5);
    L.fill('#', 52, 54, 5); L.put('o', 53, 3); L.put('L', 53, 4);
    L.gap(57, 60); L.put('o', 58, 6);
    L.put('C', 63, 8);
    L.fill('^', 66, 67, 8); L.fill('^', 70, 71, 8); L.put('o', 68, 4); L.put('o', 72, 6);
    L.put('e', 76, 8); L.put('*', 77, 4);
    L.exit(81);
  })
];

export function createBounce({ ctx, sfx, blit, pad, INK, HEART }){
  const BALL_R = { small:3, big:5 };
  const BOUNCE_V = { small:{ low:75, norm:110, high:150 }, big:{ low:65, norm:95, high:125 } };
  const B_GRAV = 300, B_RUN = 52;
  const SPIKE  = ['00011000','00011000','00111100','00111100','01111110','11111111'];
  const RING   = ['0110','1001','1001','1001','1001','0110'];
  const GEM    = ['00100','01110','11111','01110','00100'];
  const PUMP   = ['00011000','00111100','01111110','00011000','00011000','00011000','01111110','11111111'];
  const DEFL   = ['11111111','01111110','00011000','00011000','00011000','01111110','00111100','00011000'];
  const FLAG   = ['11111000','11111100','11111000','10000000','10000000','10000000','10000000','11100000'];
  const POLE   = ['10000000','10000000','10000000','10000000','10000000','10000000','10000000','11100000'];
  const FOE    = ['011110','101101','111111','111111','101101','010010'];
  const FOE2   = ['011110','101101','111111','111111','101101','100001'];
  class Bounce{
    constructor(o){
      this.lives = 3; this.score = 0; this.t = 0; this.done = false; this.won = false;
      this.held = { left:false, right:false, up:false, down:false };
      this.hi = 0; this.lo = 0; // a tap on up/down is remembered briefly and used by the next bounce (touch-friendly)
      this.load(Math.max(0, Math.min(o.level, BOUNCE_LEVELS.length) - 1));
    }
    load(i){
      this.lvl = i; this.map = BOUNCE_LEVELS[i].map(r => r.split('')); this.w = this.map[0].length;
      this.foes = []; this.rings = 0; this.cp = null; this.open = false;
      for(let y = 0; y < BROWS; y++) for(let x = 0; x < this.w; x++){
        const c = this.map[y][x];
        if(c === 'o') this.rings++;
        if(c === 'S'){ this.spawn = { x:x * TILE + 4, y:(y + 1) * TILE - BALL_R.small }; this.map[y][x] = ' '; }
        if(c === 'e'){ this.foes.push({ x:x * TILE + 4, y:(y + 1) * TILE - 3, dir:-1 }); this.map[y][x] = ' '; }
      }
      this.big = false; this.phase = 'play'; this.timer = 0; this.respawn(0);
    }
    get r(){ return this.big ? BALL_R.big : BALL_R.small; }
    respawn(inv = 1.6){
      this.big = false;
      this.ball = { x:this.spawn.x, y:this.spawn.y, vx:0, vy:0 };
      this.inv = inv; this.phase = 'play';
    }
    key(a){
      if(a in this.held) this.held[a] = true;
      if(a === 'up'){ this.hi = .8; this.lo = 0; } else if(a === 'down'){ this.lo = .8; this.hi = 0; }
    }
    keyUp(a){ if(a in this.held) this.held[a] = false; }
    solid(tx, ty){
      if(tx < 0 || tx >= this.w || ty < 0) return true;
      if(ty >= BROWS) return false;
      const c = this.map[ty][tx];
      return c === '#' || (c === 'B' && !this.big) || (c === 'E' && !this.open);
    }
    /* first solid tile overlapping the ball's box, or null */
    hitTile(){
      const b = this.ball, r = this.r, e = .001;
      for(let ty = Math.floor((b.y - r) / TILE); ty <= Math.floor((b.y + r - e) / TILE); ty++)
        for(let tx = Math.floor((b.x - r) / TILE); tx <= Math.floor((b.x + r - e) / TILE); tx++)
          if(this.solid(tx, ty)) return { tx, ty };
      return null;
    }
    hurt(){
      if(this.phase !== 'play' || this.inv > 0) return;
      this.lives--; sfx.die(); this.phase = 'dead'; this.timer = 1;
    }
    update(dt){
      if(this.done) return;
      this.t += dt;
      if(this.phase === 'dead'){
        if((this.timer -= dt) <= 0){ if(this.lives <= 0){ this.done = true; this.onOver(this.score); } else this.respawn(); }
        return;
      }
      if(this.phase === 'clear'){
        if((this.timer -= dt) <= 0){
          if(this.lvl + 1 >= BOUNCE_LEVELS.length){ this.score += this.lives * 100; this.won = true; this.done = true; this.onOver(this.score); }
          else this.load(this.lvl + 1);
        }
        return;
      }
      if(this.inv > 0) this.inv -= dt;
      this.hi = Math.max(0, this.hi - dt); this.lo = Math.max(0, this.lo - dt);
      const b = this.ball, h = this.held, r = this.r, kind = this.big ? 'big' : 'small';

      /* horizontal */
      const dir = (h.right ? 1 : 0) - (h.left ? 1 : 0), want = dir * B_RUN, acc = (dir ? 420 : 260) * dt;
      b.vx += Math.max(-acc, Math.min(acc, want - b.vx));
      b.x += b.vx * dt;
      let hit = this.hitTile();
      if(hit){
        if(b.vx > 0) b.x = hit.tx * TILE - r - .001; else if(b.vx < 0) b.x = (hit.tx + 1) * TILE + r + .001;
        b.vx = 0;
      }
      /* vertical: the ball never stops bouncing */
      b.vy += B_GRAV * dt; b.y += b.vy * dt;
      hit = this.hitTile();
      if(hit){
        if(b.vy > 0){
          b.y = hit.ty * TILE - r - .001;
          const v = BOUNCE_V[kind], hiJ = h.up || this.hi > 0, loJ = h.down || this.lo > 0;
          b.vy = -(hiJ ? v.high : loJ ? v.low : v.norm); this.hi = this.lo = 0; sfx.land();
        } else { b.y = (hit.ty + 1) * TILE + r + .001; b.vy = 0; }
      }
      if(b.y - r > BROWS * TILE + 8){ this.hurt(); return; }

      /* tiles under the ball: brittle blocks, pickups, hazards */
      const r2 = r - 1, tx0 = Math.floor((b.x - r - 1) / TILE), tx1 = Math.floor((b.x + r + 1) / TILE);
      const ty0 = Math.max(0, Math.floor((b.y - r - 1) / TILE)), ty1 = Math.min(BROWS - 1, Math.floor((b.y + r + 1) / TILE));
      for(let ty = ty0; ty <= ty1; ty++) for(let tx = Math.max(0, tx0); tx <= Math.min(this.w - 1, tx1); tx++){
        const c = this.map[ty][tx], cx = tx * TILE + 4, cy = ty * TILE + 4, near = Math.abs(b.x - cx) < 5.5 && Math.abs(b.y - cy) < 5.5;
        if(c === 'B' && this.big){ this.map[ty][tx] = ' '; this.score += 5; sfx.eat(); }
        else if(c === '^'){ if(b.x + r2 > tx * TILE + 1 && b.x - r2 < tx * TILE + 7 && b.y + r2 > ty * TILE + 3 && b.y - r2 < ty * TILE + 8) { this.hurt(); if(this.phase === 'dead') return; } }
        else if(!near) continue;
        else if(c === 'o'){ this.map[ty][tx] = ' '; this.score += 10; sfx.eat(); if(--this.rings === 0){ this.open = true; sfx.bonus(); } }
        else if(c === '*'){ this.map[ty][tx] = ' '; this.score += 50; sfx.bonus(); }
        else if(c === 'L'){ this.map[ty][tx] = ' '; this.lives = Math.min(9, this.lives + 1); sfx.bonus(); }
        else if(c === 'P' && !this.big){ this.big = true; sfx.ok(); }
        else if(c === 'D' && this.big){ this.big = false; sfx.ok(); }
        else if(c === 'C' && !(this.cp && this.cp.tx === tx && this.cp.ty === ty)){
          this.cp = { tx, ty }; this.spawn = { x:cx, y:(ty + 1) * TILE - BALL_R.small }; sfx.ok();
        }
        else if(c === 'E' && this.open){
          this.score += 100 * (this.lvl + 1); this.phase = 'clear'; this.timer = 1.2; sfx.over(); return;
        }
      }

      /* patrols */
      for(const f of this.foes){
        f.x += f.dir * 18 * dt;
        const fx = Math.floor((f.x + f.dir * 3.5) / TILE), fy = Math.floor((f.y - 1) / TILE);
        if(this.solid(fx, fy) || !this.solid(fx, fy + 1)) f.dir = -f.dir;
        if(Math.abs(b.x - f.x) < r2 + 2 && Math.abs(b.y - f.y) < r2 + 2){ this.hurt(); if(this.phase === 'dead') return; }
      }
    }
    hud(){
      return [pad(this.score, 5), this.phase === 'clear' ? `Lv${this.lvl + 1} OK` : `♥${Math.max(0, this.lives)} O${this.rings}`];
    }
    draw(){
      ctx.clearRect(0, 0, 128, 88); ctx.fillStyle = INK;
      const cam = Math.max(0, Math.min(this.w * TILE - 128, Math.round(this.ball.x - 64)));
      for(let ty = 0; ty < BROWS; ty++) for(let tx = Math.max(0, Math.floor(cam / TILE)); tx <= Math.min(this.w - 1, Math.floor((cam + 127) / TILE)); tx++){
        const c = this.map[ty][tx]; if(c === ' ') continue;
        const x = tx * TILE - cam, y = ty * TILE;
        if(c === '#'){ ctx.fillRect(x, y, 8, 8); ctx.clearRect(x + 1, y + 1, 6, 6); ctx.fillRect(x + 3, y + 3, 2, 2); }
        else if(c === 'B'){ for(let i = 0; i < 8; i++) for(let j = 0; j < 8; j++) if((i + j) % 2 === 0) ctx.fillRect(x + j, y + i, 1, 1); }
        else if(c === '^') blit(SPIKE, x, y + 2);
        else if(c === 'o') blit(RING, x + 2, y + 1);
        else if(c === '*') blit(GEM, x + 1, y + 1);
        else if(c === 'L') blit(HEART, x + 1, y + 2);
        else if(c === 'P') blit(PUMP, x, y);
        else if(c === 'D') blit(DEFL, x, y);
        else if(c === 'C') blit(this.cp && this.cp.tx === tx && this.cp.ty === ty ? FLAG : POLE, x, y);
        else if(c === 'E'){
          if(this.open){ ctx.fillRect(x, y, 1, 8); if(Math.floor(this.t * 4) % 2) ctx.fillRect(x + 4, y + 2, 2, 4); }
          else { ctx.fillRect(x, y, 2, 8); ctx.fillRect(x + 3, y, 2, 8); ctx.fillRect(x + 6, y, 2, 8); }
        }
      }
      for(const f of this.foes) blit(Math.floor(this.t * 5) % 2 ? FOE : FOE2, Math.round(f.x - 3 - cam), Math.round(f.y - 3));
      const b = this.ball, r = this.r;
      const blink = (this.phase === 'dead' && Math.floor(this.timer * 10) % 2) || (this.phase === 'clear' && Math.floor(this.timer * 8) % 2) || (this.inv > 0 && Math.floor(this.inv * 10) % 2);
      if(blink) return;
      const bx = Math.round(b.x - cam), by = Math.round(b.y);
      for(let dy = -r; dy < r; dy++) for(let dx = -r; dx < r; dx++) if((dx + .5) * (dx + .5) + (dy + .5) * (dy + .5) <= r * r + .5) ctx.fillRect(bx + dx, by + dy, 1, 1);
      ctx.clearRect(bx - r + 1, by - r + 1, 1, 1); // shine
    }
  }
  return Bounce;
}
