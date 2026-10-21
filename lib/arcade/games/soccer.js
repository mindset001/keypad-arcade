/* Soccer League match. Needs overlay()/hideOverlay() from the host for GOAL! and half-time banners. */
export function createSoccer({ ctx, sfx, blit, pad, INK, overlay, hideOverlay }){
  /* Top-down 5-a-side with walls (no throw-ins). You drive the player nearest the ball;
     Select with the ball: tap = pass, hold + release = shoot; without it: slide tackle. */
  const FW = 256, PL = 8, PR = 248, PT = 3, PB = 85, GY0 = 32, GY1 = 56, GYC = 44;
  const SK_A = ['01110','01110','11111','01110','01010','11011'];
  const SK_B = ['01110','01010','11111','01010','01010','11011'];
  const SK_BALL = ['010','111','010'], SK_MARK = ['111','010'];
  const FORM = [{ x:12, y:44, gk:true }, { x:50, y:44 }, { x:92, y:22 }, { x:92, y:66 }, { x:122, y:44 }];
  const hyp = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);
  class Soccer{
    constructor(o){
      this.isSoccer = true; this.usesSelect = true;
      this.mode = o.mode === 1 ? 'league' : 'quick'; this.lvl = o.level; this.oppName = o.oppName || 'CPU';
      this.goals = [0, 0]; this.time = 0; this.len = 120; this.half = 1; this.t = 0; this.done = false;
      this.held = { left:false, right:false, up:false, down:false }; this.selT = null;
      this.players = [];
      for(const team of [0, 1]) for(const f of FORM)
        this.players.push({ team, gk:!!f.gk, role:f.gk ? 'gk' : f.x > 100 ? 'fwd' : f.x > 60 ? 'mid' : 'back', bx:team ? FW - f.x : f.x, by:f.y, x:0, y:0, fx:team ? -1 : 1, fy:0, cd:0, stun:0, lunge:0, lcd:0, shootCd:0, hold:0 });
      this.ball = { x:FW / 2, y:GYC, vx:0, vy:0, owner:null };
      this.kickoff();
    }
    goalX(team){ return team ? PL : PR; }
    kickoff(){
      for(const p of this.players){ p.x = p.bx; p.y = p.by; p.fx = p.team ? -1 : 1; p.fy = 0; p.cd = p.stun = p.lunge = p.lcd = p.shootCd = p.hold = 0; }
      Object.assign(this.ball, { x:FW / 2, y:GYC, vx:0, vy:0, owner:null });
      this.ctl = this.players[4]; this.selT = null; this.phase = 'kickoff'; this.timer = .9;
    }
    key(a){
      if(a in this.held) this.held[a] = true;
      if(a === 'select' && this.phase === 'play'){
        const o = this.ball.owner;
        if(o && o.team === 0 && !o.gk) this.selT = 0; else if(this.ctl) this.lunge(this.ctl);
      }
    }
    keyUp(a){
      if(a in this.held) this.held[a] = false;
      if(a === 'select' && this.selT !== null){
        const t = this.selT, o = this.ball.owner; this.selT = null;
        if(o && o === this.ctl){ if(t >= .25) this.shoot(o, Math.min(1, (t - .25) / .6)); else this.pass(o); }
      }
    }
    /* ----- actions ----- */
    kick(p, tx, ty, sp){
      const d = Math.hypot(tx - p.x, ty - p.y) || 1, b = this.ball, ux = (tx - p.x) / d, uy = (ty - p.y) / d;
      b.owner = null; b.vx = ux * sp; b.vy = uy * sp; b.x = p.x + ux * 4; b.y = p.y + uy * 4;
      p.cd = .35; p.hold = 0; sfx.click();
    }
    shoot(p, power, aimY){
      const ad = p.team ? -1 : 1;
      if(aimY !== undefined || p.fx * ad > .2) this.kick(p, this.goalX(p.team), aimY !== undefined ? aimY : GYC + p.fy * 12, 120 + power * 100);
      else this.kick(p, p.x + p.fx * 60, p.y + p.fy * 60, 120 + power * 100);
    }
    pass(p){
      const ad = p.team ? -1 : 1, fx = p.fx || ad, fy = p.fy; let best = null, bs = -1e9;
      for(const q of this.players) if(q.team === p.team && q !== p && !q.gk){
        const dx = q.x - p.x, dy = q.y - p.y, d = Math.hypot(dx, dy) || 1, cos = (dx * fx + dy * fy) / d;
        if(cos < .45 || d < 8 || d > 90) continue;
        const sc = cos * 70 - d * .3; if(sc > bs){ bs = sc; best = q; }
      }
      if(best) this.kick(p, best.x, best.y, Math.min(200, 40 + hyp(p, best) * 2));
      else this.kick(p, p.x + fx * 50, p.y + fy * 50, 110);
    }
    aiPass(p){
      const ad = p.team ? -1 : 1; let best = null, bp = 4;
      for(const q of this.players) if(q.team === p.team && q !== p && !q.gk){
        const d = hyp(p, q), prog = (q.x - p.x) * ad;
        if(d < 100 && d > 8 && prog > bp){ bp = prog; best = q; }
      }
      if(!best) return false;
      this.kick(p, best.x, best.y, Math.min(200, 40 + hyp(p, best) * 2)); return true;
    }
    lunge(p){
      if(p.lunge > 0 || p.lcd > 0 || p.stun > 0) return;
      p.lunge = .22; p.lcd = .7; sfx.click();
    }
    move(p, dx, dy, sp, dt){
      if(p.stun > 0) return;
      if(p.lunge > 0){ p.x += p.fx * 88 * dt; p.y += p.fy * 88 * dt; }
      else if(dx || dy){ const n = Math.hypot(dx, dy); dx /= n; dy /= n; p.fx = dx; p.fy = dy; p.x += dx * sp * dt; p.y += dy * sp * dt; }
      p.x = Math.max(PL + 2, Math.min(PR - 2, p.x)); p.y = Math.max(PT + 3, Math.min(PB - 3, p.y));
    }
    toward(p, tx, ty, sp, dt){
      const d = Math.hypot(tx - p.x, ty - p.y); if(d < 1.5) return;
      this.move(p, (tx - p.x) / d, (ty - p.y) / d, sp, dt);
    }
    /* ----- computer players ----- */
    ai(p, dt, chaser){
      if(p.stun > 0) return;
      const b = this.ball, owner = b.owner, ad = p.team ? -1 : 1, lvl = p.team ? this.lvl : 4;
      if(p.gk){
        if(owner === p){ if((p.hold += dt) > .7 && !this.aiPass(p)) this.kick(p, p.x + ad * 80, GYC + (Math.random() - .5) * 40, 150); return; }
        const rush = !owner && Math.abs(b.x - p.bx) < 26 && Math.hypot(b.vx, b.vy) < 60;
        let ty = b.y;
        if(!rush && !owner && (b.x - p.bx) * b.vx < 0 && Math.abs(b.vx) > 20) ty = b.y + b.vy / b.vx * (p.bx - b.x); // where the shot is heading
        ty = Math.max(GY0 + 3, Math.min(GY1 - 3, ty));
        this.toward(p, rush ? b.x : p.bx, rush ? b.y : ty, 26 + 3 * lvl, dt); return;
      }
      const sp = p.team ? 30 + 2 * lvl : 36, mate = owner && owner.team === p.team;
      if(owner === p){
        const gx = this.goalX(p.team), dg = Math.abs(gx - p.x);
        let opp = null; for(const q of this.players) if(q.team !== p.team && !q.gk && (!opp || hyp(p, q) < hyp(p, opp))) opp = q;
        let ty = dg < 50 ? GYC : p.y;
        if(opp && hyp(p, opp) < 16 && (opp.x - p.x) * ad > -2) ty = p.y + (p.y > opp.y ? 1 : -1) * 20;
        if(p.shootCd <= 0 && dg < 56 && Math.random() < (1.5 + .1 * lvl) * dt){
          const gk = this.players.find(q => q.gk && q.team !== p.team);
          this.shoot(p, .5 + Math.random() * .5, gk.y > GYC ? GY0 + 4 : GY1 - 4); p.shootCd = 1; return;
        }
        if(opp && hyp(p, opp) < 10 && Math.random() < 1.2 * dt && this.aiPass(p)) return;
        this.toward(p, gx, ty, sp - 3, dt); return;
      }
      if(p === chaser && !mate){
        const tgt = owner || { x:b.x + b.vx * .2, y:b.y + b.vy * .2 };
        if(owner && hyp(p, owner) < 14 && p.lcd <= 0 && Math.random() < (.9 + .45 * lvl) * dt){
          const d = hyp(p, owner) || 1; p.fx = (owner.x - p.x) / d; p.fy = (owner.y - p.y) / d; this.lunge(p);
        }
        this.toward(p, tgt.x, tgt.y, sp, dt); return;
      }
      if(owner && !mate && p.role !== 'fwd'){ // stand between the ball carrier and our goal
        const og = p.team ? PR : PL;
        if(Math.abs(owner.x - og) < 150){ this.toward(p, owner.x + (og - owner.x) * .35, owner.y + (GYC - owner.y) * .35, sp, dt); return; }
      }
      const deep = p.role === 'back';
      const hx = p.bx + (b.x - FW / 2) * (deep ? .25 : .4) + (mate ? ad * 18 : 0);
      this.toward(p, Math.max(PL + 8, Math.min(PR - 8, hx)), p.by, sp, dt);
    }
    /* ----- step ----- */
    update(dt){
      if(this.done) return;
      this.t += dt;
      if(this.phase !== 'play'){
        if((this.timer -= dt) > 0) return;
        if(this.phase === 'end'){ this.done = true; this.onOver(0); return; }
        if(this.phase === 'kickoff'){ this.phase = 'play'; return; }
        hideOverlay(); this.kickoff(); return; // after a goal or half time
      }
      this.time += dt;
      if(this.half === 1 && this.time >= this.len / 2){
        this.half = 2; this.phase = 'half'; this.timer = 1.8; this.selT = null; overlay('Half time', `${this.goals[0]} - ${this.goals[1]}`); sfx.ok(); return;
      }
      if(this.time >= this.len){ this.phase = 'end'; this.timer = 1.2; this.selT = null; sfx.over(); return; }

      const b = this.ball, ps = this.players, h = this.held, dB = p => hyp(p, b);
      for(const p of ps){ p.cd -= dt; p.stun -= dt; p.lunge -= dt; p.lcd -= dt; p.shootCd -= dt; }

      /* the human drives whoever has the ball, else the nearest team-mate */
      const own = b.owner && b.owner.team === 0 && !b.owner.gk ? b.owner : null;
      if(own) this.ctl = own;
      else {
        let best = null; for(const p of ps) if(p.team === 0 && !p.gk && (!best || dB(p) < dB(best))) best = p;
        if(!this.ctl || dB(best) + 6 < dB(this.ctl)) this.ctl = best;
      }
      if(this.selT !== null){ if(b.owner !== this.ctl) this.selT = null; else this.selT += dt; }
      const c = this.ctl;
      this.move(c, (h.right ? 1 : 0) - (h.left ? 1 : 0), (h.down ? 1 : 0) - (h.up ? 1 : 0), b.owner === c ? 36 : 40, dt);

      const chase = [null, null];
      for(const t of [0, 1]) for(const p of ps) if(p.team === t && !p.gk && p !== c && (!chase[t] || dB(p) < dB(chase[t]))) chase[t] = p;
      for(const p of ps) if(p !== c) this.ai(p, dt, chase[p.team]);

      /* slide tackles */
      for(const p of ps) if(p.lunge > 0 && b.owner && b.owner.team !== p.team && hyp(p, b.owner) < 6.5){
        b.owner.stun = .5; b.owner.cd = .4; b.owner = p; p.lunge = 0; p.hold = 0; sfx.eat();
      }

      /* ball */
      if(b.owner){ const o = b.owner; b.x = o.x + o.fx * 3.5; b.y = o.y + o.fy * 3.5; b.vx = b.vy = 0; }
      else {
        const f = Math.exp(-1.5 * dt); b.vx *= f; b.vy *= f; b.x += b.vx * dt; b.y += b.vy * dt;
        if(b.y < PT + 1){ b.y = PT + 1; b.vy = Math.abs(b.vy) * .8; }
        if(b.y > PB - 1){ b.y = PB - 1; b.vy = -Math.abs(b.vy) * .8; }
        const mouth = b.y > GY0 && b.y < GY1;
        if(b.x < PL && !mouth){ b.x = PL; b.vx = Math.abs(b.vx) * .6; }
        if(b.x > PR && !mouth){ b.x = PR; b.vx = -Math.abs(b.vx) * .6; }
        if(b.x < 2){ b.x = 2; b.vx = Math.abs(b.vx) * .3; }
        if(b.x > FW - 2){ b.x = FW - 2; b.vx = -Math.abs(b.vx) * .3; }
        /* pick-ups: slow balls are trapped, hard shots bounce off the keeper */
        const sp = Math.hypot(b.vx, b.vy); let best = null, bd = 1e9;
        for(const p of ps){
          if(p.cd > 0 || p.stun > 0) continue;
          const d = dB(p); if(d < (p.gk ? 7 : 4) && d < bd){ bd = d; best = p; }
        }
        if(best){
          if(sp < (best.gk ? 200 : 140)){ b.owner = best; best.hold = 0; }
          else if(best.gk){ b.vx = (b.x > FW / 2 ? -1 : 1) * Math.abs(b.vx) * .5; best.cd = .3; sfx.land(); }
        }
      }

      /* goals */
      if(b.y > GY0 && b.y < GY1 && (b.x < PL - 1 || b.x > PR + 1)){
        const t = b.x < PL ? 1 : 0; this.goals[t]++; this.phase = 'goal'; this.timer = 1.8; this.selT = null;
        sfx.bonus(); overlay('GOAL!', `${this.goals[0]} - ${this.goals[1]}`);
      }
    }
    hud(){
      const t = Math.min(this.len, Math.floor(this.time));
      return [`${this.goals[0]}-${this.goals[1]}`, `${Math.floor(t / 60)}:${pad(t % 60, 2)}`];
    }
    draw(){
      ctx.clearRect(0, 0, 128, 88); ctx.fillStyle = INK;
      const b = this.ball, cam = Math.max(0, Math.min(FW - 128, Math.round(b.x - 64))), X = x => Math.round(x - cam);
      /* pitch */
      ctx.fillRect(X(PL), PT, PR - PL + 1, 1); ctx.fillRect(X(PL), PB, PR - PL + 1, 1);
      for(const e of [PL, PR]){ ctx.fillRect(X(e), PT, 1, GY0 - PT); ctx.fillRect(X(e), GY1, 1, PB - GY1 + 1); }
      for(let y = PT; y < PB; y += 3) ctx.fillRect(X(FW / 2), y, 1, 2);
      for(let i = 0; i < 28; i++){ const a = i / 28 * 6.2832; ctx.fillRect(X(FW / 2 + Math.cos(a) * 11), Math.round(GYC + Math.sin(a) * 11), 1, 1); }
      for(const s of [-1, 1]){ /* goals + penalty areas */
        const e = s < 0 ? PL : PR, bx = e + s * -20;
        ctx.fillRect(X(Math.min(e, e + s * 6)), GY0, 7, 1); ctx.fillRect(X(Math.min(e, e + s * 6)), GY1, 7, 1); ctx.fillRect(X(e + s * 6), GY0, 1, GY1 - GY0 + 1);
        ctx.fillRect(X(Math.min(e, bx)), 26, 21, 1); ctx.fillRect(X(Math.min(e, bx)), 62, 21, 1); ctx.fillRect(X(bx), 26, 1, 37);
      }
      /* players, ball, power bar */
      for(const p of this.players){
        if(p.stun > 0 && Math.floor(this.t * 12) % 2) continue;
        blit(p.team ? SK_B : SK_A, X(p.x) - 2, Math.round(p.y) - 3);
      }
      const c = this.ctl;
      if(this.phase !== 'end') blit(SK_MARK, X(c.x) - 1, Math.round(c.y) - 8);
      if(this.selT !== null){
        const pw = Math.max(0, Math.min(1, (this.selT - .25) / .6)), bx = X(c.x) - 6, by = Math.round(c.y) + 4;
        ctx.fillRect(bx, by, 12, 3); ctx.clearRect(bx + 1, by + 1, 10, 1); ctx.fillRect(bx + 1, by + 1, Math.round(10 * pw), 1);
      }
      blit(SK_BALL, X(b.x) - 1, Math.round(b.y) - 1);
    }
  }

  return Soccer;
}
