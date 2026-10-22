/* Table Tennis: you (left paddle) against the computer, first to 7 points. */
export function createTennis({ ctx, sfx, pad, INK }){
  const W = 128, H = 88, TOP = 6, BOT = H - 2, PH = 14, PX = 6, CX = W - 8, BS = 3, WIN = 7;
  class Tennis{
    constructor(o){
      this.level = o.level; this.you = 0; this.cpu = 0; this.t = 0; this.done = false; this.won = false;
      this.held = { up:false, down:false }; this.target = null; this.hold = 0;
      this.py = (TOP + BOT) / 2; this.cy = this.py; this.aim = 0; this.aimT = 0;
      this.serveTo = 1; this.reset(1);
    }
    /* put the ball in the middle and serve it toward `dir` (1 = at the computer) after a short pause */
    reset(dir){
      this.serveT = .8; this.hits = 0;
      this.b = { x:W / 2, y:(TOP + BOT) / 2, vx:0, vy:0 }; this.dir = dir;
    }
    get cpuSpeed(){ return 26 + this.level * 6; }              // how fast the computer's paddle can move
    get baseSpeed(){ return 62 + this.level * 5; }
    key(a){ if(a in this.held){ this.held[a] = true; this.target = null; } }
    keyUp(a){ if(a in this.held) this.held[a] = false; }
    /* touch drag / mouse: glide the paddle to a height (in game pixels); it still can't teleport, so it stays fair */
    aimTo(y){ if(!this.done) this.target = Math.max(TOP + PH / 2, Math.min(BOT - PH / 2, y)); }
    launch(){
      const sp = this.baseSpeed, ang = (Math.random() - .5) * .7;
      this.b.vx = Math.cos(ang) * sp * this.dir; this.b.vy = Math.sin(ang) * sp;
    }
    paddleHit(p, py, side){
      const b = this.b, off = Math.max(-1, Math.min(1, (b.y - py) / (PH / 2 + 1)));
      const sp = Math.min(150, this.baseSpeed + this.hits * 4), ang = off * .95;
      b.vx = Math.cos(ang) * sp * side; b.vy = Math.sin(ang) * sp; this.hits++; sfx.land();
    }
    point(toYou){
      if(toYou) this.you++; else this.cpu++;
      toYou ? sfx.bonus() : sfx.die();
      if(this.you >= WIN || this.cpu >= WIN){
        this.done = true; this.won = this.you > this.cpu;
        this.onOver(this.score); return;
      }
      this.reset(toYou ? -1 : 1);                               // the player who lost the point is served to
    }
    /* what the leaderboard records: points won, a bonus for the match, all multiplied by the level */
    get score(){ return (this.you * 10 + (this.won ? 50 + (this.you - this.cpu) * 5 : 0)) * this.level; }
    update(dt){
      if(this.done) return;
      this.t += dt;
      const dir = (this.held.down ? 1 : 0) - (this.held.up ? 1 : 0);
      // held keys speed up the longer they are held (a tap nudges, a hold sweeps); a drag target glides at a fixed fast speed
      this.hold = dir ? Math.min(1, this.hold + dt / .35) : 0;
      let move = dir * (70 + 70 * this.hold) * dt;
      if(!dir && this.target !== null){ const d = this.target - this.py, m = 210 * dt; move = Math.max(-m, Math.min(m, d)); if(Math.abs(d) < .3) this.target = null; }
      this.py = Math.max(TOP + PH / 2, Math.min(BOT - PH / 2, this.py + move));
      const b = this.b;
      if(this.serveT > 0){ this.serveT -= dt; if(this.serveT <= 0) this.launch(); this.chase(dt, (TOP + BOT) / 2); return; }
      b.x += b.vx * dt; b.y += b.vy * dt;
      if(b.y < TOP){ b.y = TOP; b.vy = Math.abs(b.vy); sfx.click(); }
      if(b.y > BOT - BS){ b.y = BOT - BS; b.vy = -Math.abs(b.vy); sfx.click(); }
      // the computer reads the ball only while it is coming, and aims a little off by an amount that shrinks with the level
      if(b.vx > 0){ this.aimT -= dt; if(this.aimT <= 0){ this.aimT = .35; this.aim = (Math.random() - .5) * (PH * (1.7 - this.level * .14)); } this.chase(dt, b.y + this.aim); }
      else this.chase(dt, (TOP + BOT) / 2 + (b.y - (TOP + BOT) / 2) * .25);
      if(b.vx < 0 && b.x <= PX + 2 && b.x >= PX - 3 && Math.abs(b.y + BS / 2 - this.py) <= PH / 2 + 1.5){ b.x = PX + 2; this.paddleHit(this.py, this.py, 1); }
      else if(b.vx > 0 && b.x + BS >= CX && b.x + BS <= CX + 4 && Math.abs(b.y + BS / 2 - this.cy) <= PH / 2 + 1.5){ b.x = CX - BS; this.paddleHit(this.cy, this.cy, -1); }
      if(b.x < -BS) this.point(false); else if(b.x > W) this.point(true);
    }
    chase(dt, y){
      const d = y - this.cy, m = this.cpuSpeed * dt;
      this.cy = Math.max(TOP + PH / 2, Math.min(BOT - PH / 2, this.cy + Math.max(-m, Math.min(m, d))));
    }
    hud(){ return [`${this.you}-${this.cpu}`, `Lv ${this.level}`]; }
    draw(){
      ctx.clearRect(0, 0, W, H); ctx.fillStyle = INK;
      ctx.fillRect(0, TOP - 2, W, 1); ctx.fillRect(0, BOT + 1, W, 1);                       // table edges
      for(let y = TOP; y < BOT; y += 4) ctx.fillRect(W / 2 - 1, y, 1, 2);                     // net
      ctx.fillRect(PX - 1, Math.round(this.py - PH / 2), 2, PH);
      ctx.fillRect(CX + 1, Math.round(this.cy - PH / 2), 2, PH);
      if(this.serveT <= 0 || Math.floor(this.t * 8) % 2) ctx.fillRect(Math.round(this.b.x), Math.round(this.b.y), BS, BS);
    }
  }
  return Tennis;
}
