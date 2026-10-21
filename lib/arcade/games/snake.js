/* Snake Xenzia. createSnake(env) returns the class; env supplies canvas, sound and drawing helpers. */
export function createSnake({ ctx, sfx, blit, pad, INK }){
  const COLS = 32, ROWS = 22, CELL = 4;
  const SNAKE_SPEED = [0, .25, .21, .175, .145, .12, .1, .082, .066, .052]; // seconds per step, by level
  const FOOD = ['010','101','010'];
  const BUG  = ['1001','0110','1111','1001'];
  function wallsFor(m){
    const s = new Set(), add = (x, y) => s.add(y * COLS + x);
    const border = gaps => {
      for(let x = 0; x < COLS; x++) if(!(gaps && x >= 13 && x <= 18)){ add(x, 0); add(x, ROWS - 1); }
      for(let y = 0; y < ROWS; y++) if(!(gaps && y >= 8 && y <= 13)){ add(0, y); add(COLS - 1, y); }
    };
    if(m === 1) border(false);
    if(m === 2){ border(true); for(let x = 8; x <= 23; x++){ add(x, 6); add(x, 15); } }
    if(m === 3){ border(false); for(let y = 3; y <= 8; y++) add(8, y); for(let y = 13; y <= 18; y++) add(23, y); for(let x = 14; x <= 25; x++) add(x, 5); for(let x = 6; x <= 17; x++) add(x, 16); }
    if(m === 4){ for(let x = 4; x <= 27; x++){ add(x, 6); add(x, 15); } }
    return s;
  }
  class Snake{
    constructor(o){
      this.level = o.level; this.maze = o.maze; this.walls = wallsFor(o.maze);
      this.body = []; for(let i = 0; i < 5; i++) this.body.push({ x:10 - i, y:11 });
      this.dir = { x:1, y:0 }; this.q = []; this.t = 0; this.iv = SNAKE_SPEED[this.level];
      this.score = 0; this.eaten = 0; this.bug = null; this.food = null; this.dead = false; this.deathT = 0; this.done = false;
      this.food = this.free();
    }
    taken(x, y){
      return this.walls.has(y * COLS + x) || this.body.some(s => s.x === x && s.y === y)
        || (this.food && this.food.x === x && this.food.y === y) || (this.bug && this.bug.x === x && this.bug.y === y);
    }
    free(){ for(let n = 0; n < 3000; n++){ const x = Math.random() * COLS | 0, y = Math.random() * ROWS | 0; if(!this.taken(x, y)) return { x, y }; } return { x:1, y:1 }; }
    key(a){
      const D = { up:{x:0,y:-1}, down:{x:0,y:1}, left:{x:-1,y:0}, right:{x:1,y:0} }[a]; if(!D) return;
      const last = this.q.length ? this.q[this.q.length - 1] : this.dir;
      if((D.x === last.x && D.y === last.y) || (D.x === -last.x && D.y === -last.y)) return; // no 180° turns
      if(this.q.length < 3) this.q.push(D);
    }
    update(dt){
      if(this.done) return;
      if(this.dead){ this.deathT += dt; if(this.deathT > 1.2){ this.done = true; this.onOver(this.score); } return; }
      if(this.bug && (this.bug.ttl -= dt) <= 0) this.bug = null;
      this.t += dt;
      while(this.t >= this.iv){ this.t -= this.iv; this.step(); if(this.dead) break; }
    }
    step(){
      if(this.q.length) this.dir = this.q.shift();
      const h = this.body[0], x = (h.x + this.dir.x + COLS) % COLS, y = (h.y + this.dir.y + ROWS) % ROWS;
      const eat = this.food && this.food.x === x && this.food.y === y;
      const hitSelf = this.body.some((s, i) => s.x === x && s.y === y && !(i === this.body.length - 1 && !eat));
      if(this.walls.has(y * COLS + x) || hitSelf){ this.dead = true; sfx.die(); return; }
      this.body.unshift({ x, y });
      if(eat){
        this.score += this.level; this.eaten++; sfx.eat(); this.food = null;
        if(this.eaten % 5 === 0){ this.bug = null; const p = this.free(); this.bug = { ...p, ttl:6 }; }
        this.food = this.free();
      } else this.body.pop();
      if(this.bug && this.bug.x === x && this.bug.y === y){ this.score += this.level * 5 + Math.ceil(this.bug.ttl) * this.level; this.bug = null; sfx.bonus(); }
    }
    hud(){ return [pad(this.score, 4), this.bug ? `Bug ${Math.ceil(this.bug.ttl)}` : `Lv ${this.level}`]; }
    draw(){
      ctx.clearRect(0, 0, 128, 88); ctx.fillStyle = INK;
      for(const k of this.walls){ const x = (k % COLS) * CELL, y = ((k / COLS) | 0) * CELL; ctx.fillRect(x, y, 4, 4); ctx.clearRect(x + 1, y + 1, 2, 2); }
      if(this.food) blit(FOOD, this.food.x * CELL, this.food.y * CELL);
      if(this.bug && !(this.bug.ttl < 2 && Math.floor(this.bug.ttl * 6) % 2)) blit(BUG, this.bug.x * CELL, this.bug.y * CELL);
      if(this.dead && Math.floor(this.deathT * 8) % 2) return;
      const b = this.body;
      for(let i = 0; i < b.length; i++){
        const s = b[i], x = s.x * CELL, y = s.y * CELL; ctx.fillRect(x, y, 3, 3);
        if(i > 0){ const p = b[i - 1];
          if(p.y === s.y && p.x === s.x + 1) ctx.fillRect(x + 3, y, 1, 3);
          if(p.y === s.y && p.x === s.x - 1) ctx.fillRect(x - 1, y, 1, 3);
          if(p.x === s.x && p.y === s.y + 1) ctx.fillRect(x, y + 3, 3, 1);
          if(p.x === s.x && p.y === s.y - 1) ctx.fillRect(x, y - 1, 3, 1);
        }
      }
      ctx.clearRect(b[0].x * CELL + 1, b[0].y * CELL + 1, 1, 1); // eye
    }
  }

  return Snake;
}
