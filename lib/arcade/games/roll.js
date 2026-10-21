/* Rapid Roll. */
export function createRoll({ ctx, sfx, blit, pad, INK, HEART }){
  const RW = 128, RH = 88, SPK = 5, PW = 22, GAP = 17, BR = 2.5;
  const BALL  = ['01110','10111','11111','11111','01110'];
  class Roll{
    constructor(o){
      this.level = o.level; this.lives = 3; this.score = 0; this.dist = 0; this.t = 0;
      this.plats = []; this.held = { left:false, right:false }; this.freeze = 0; this.inv = 0; this.done = false;
      for(let y = 28; y < RH + GAP; y += GAP) this.addPlat(y, true);
      const p = this.plats[1];
      this.ball = { x:p.x + PW / 2, y:p.y - BR, vy:0, on:p };
    }
    addPlat(y, safe){
      const last = this.plats[this.plats.length - 1];
      const x = 2 + Math.random() * (RW - PW - 4);
      const spiked = !safe && !(last && last.spiked) && Math.random() < Math.min(.28, .12 + this.t * .003);
      const heart = !safe && !spiked && this.lives < 9 && Math.random() < .05;
      this.plats.push({ x, y, py:y, spiked, heart });
    }
    get speed(){ return 12 + this.level * 3 + Math.min(32, this.t * .35); }
    key(a){ if(a in this.held) this.held[a] = true; }
    keyUp(a){ if(a in this.held) this.held[a] = false; }
    hit(){ this.lives--; sfx.die(); this.freeze = 1; }
    respawn(){
      let p = this.plats.filter(q => !q.spiked && q.y > 30 && q.y < 72).sort((a, b) => Math.abs(a.y - 50) - Math.abs(b.y - 50))[0];
      if(!p){ p = { x:RW / 2 - PW / 2, y:50, py:50, spiked:false, heart:false }; this.plats.push(p); this.plats.sort((a, b) => a.y - b.y); }
      Object.assign(this.ball, { x:p.x + PW / 2, y:p.y - BR, vy:0, on:p }); this.inv = 1.6;
    }
    update(dt){
      if(this.done) return;
      if(this.freeze > 0){
        this.freeze -= dt;
        if(this.freeze <= 0){ if(this.lives <= 0){ this.done = true; this.onOver(this.score); return; } this.respawn(); }
        return;
      }
      this.t += dt; if(this.inv > 0) this.inv -= dt;
      const v = this.speed;
      for(const p of this.plats){ p.py = p.y; p.y -= v * dt; }
      this.plats = this.plats.filter(p => p.y > -6);
      let bottom = this.plats.reduce((m, p) => Math.max(m, p.y), -Infinity);
      while(bottom <= RH){ this.addPlat(bottom + GAP, false); bottom += GAP; }
      this.dist += v * dt; this.score = Math.floor(this.dist / 8) * this.level;

      const b = this.ball, dir = (this.held.right ? 1 : 0) - (this.held.left ? 1 : 0);
      b.x = Math.max(BR, Math.min(RW - BR, b.x + dir * 60 * dt));
      if(b.on){
        const p = b.on;
        if(!this.plats.includes(p) || b.x < p.x - 1 || b.x > p.x + PW + 1){ b.on = null; b.vy = 12; }
        else{
          b.y = p.y - BR;
          if(p.heart && Math.abs(b.x - (p.x + PW / 2)) < 5){ p.heart = false; this.lives = Math.min(9, this.lives + 1); sfx.bonus(); }
        }
      }
      if(!b.on){
        const prevBottom = b.y + BR;
        b.vy = Math.min(95, b.vy + 240 * dt); b.y += b.vy * dt;
        const nb = b.y + BR;
        for(const p of this.plats){
          if(prevBottom <= p.py + .01 && nb >= p.y && b.x >= p.x - 1 && b.x <= p.x + PW + 1){
            if(p.spiked && this.inv <= 0){ this.hit(); return; }
            b.on = p; b.vy = 0; b.y = p.y - BR; sfx.land(); break;
          }
        }
      }
      if(b.y - BR <= SPK){ if(this.inv > 0){ b.on = null; b.vy = 20; b.y = SPK + BR + .5; } else { this.hit(); return; } }
      if(b.y - BR > RH){ this.hit(); return; }
    }
    hud(){ return [pad(this.score, 5), `♥×${Math.max(0, this.lives)}`]; }
    draw(){
      ctx.clearRect(0, 0, RW, RH); ctx.fillStyle = INK;
      const ins = [0, 0, 1, 1, 2];
      for(let x = 0; x < RW; x += 6) for(let r = 0; r < 5; r++) ctx.fillRect(x + ins[r], r, 6 - 2 * ins[r], 1);
      for(const p of this.plats){
        const x = Math.round(p.x), y = Math.round(p.y);
        if(p.spiked){
          ctx.fillRect(x, y, PW, 3);
          for(let i = 1; i + 3 <= PW; i += 4){ ctx.fillRect(x + i + 1, y - 3, 1, 1); ctx.fillRect(x + i, y - 2, 3, 2); }
        } else {
          ctx.fillRect(x, y, PW, 1); ctx.fillRect(x, y + 2, PW, 1);
          for(let i = 0; i < PW; i += 3) ctx.fillRect(x + i, y + 1, 1, 1);
          if(p.heart && Math.floor(this.t * 4) % 2) blit(HEART, Math.round(p.x + PW / 2 - 2), y - 5);
          else if(p.heart) blit(HEART, Math.round(p.x + PW / 2 - 2), y - 5);
        }
      }
      const b = this.ball;
      const blink = (this.freeze > 0 && Math.floor(this.freeze * 10) % 2) || (this.inv > 0 && Math.floor(this.inv * 10) % 2);
      if(!blink) blit(BALL, Math.round(b.x) - 2, Math.round(b.y) - 2);
    }
  }

  return Roll;
}
