/* =====================================================================
   Keypad Arcade — Snake Xenzia + Rapid Roll in a Nokia-style shell.
   Sections: storage · auth · sound · screens · list view · snake ·
             rapid roll · game loop · input · boot
   NOTE: the login is a demo. Accounts live in this browser's
   localStorage with SHA-256 hashed passwords; it is not real security.
   ===================================================================== */

/* Mounts the arcade onto the already-rendered markup. Returns a cleanup
   function so React strict mode / navigation can unmount without leaks. */
export function initArcade(){
  const ac = new AbortController(), signal = ac.signal;
  const $ = s => document.querySelector(s);
  const lcd = $('#lcd'), phone = $('#phone');

  /* ---------- storage (falls back to memory if localStorage is blocked) ---------- */

  const mem = {};
  const store = {
    get(k, d){ try{ const v = localStorage.getItem(k); if(v !== null) return JSON.parse(v); }catch(e){} return k in mem ? mem[k] : d; },
    set(k, v){ mem[k] = v; try{ localStorage.setItem(k, JSON.stringify(v)); }catch(e){} },
    del(k){ delete mem[k]; try{ localStorage.removeItem(k); }catch(e){} }
  };

  /* ---------- auth ---------- */
  async function hash(s){
    try{
      const b = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(s));
      return [...new Uint8Array(b)].map(x => x.toString(16).padStart(2,'0')).join('');
    }catch(e){ let h = 5381; for(const c of s) h = ((h << 5) + h + c.charCodeAt(0)) | 0; return 'x' + (h >>> 0).toString(16); }
  }
  let user = null; // { name, guest }
  const loginMsg = t => { $('#loginMsg').textContent = t; sfx.err(); };

  async function doLogin(){
    const n = $('#user').value.trim(), p = $('#pass').value;
    if(!n || !p) return loginMsg('Enter a name and a password.');
    const u = store.get('ka_users', {})[n.toLowerCase()];
    if(!u) return loginMsg(`No player called ${n}. Tap New player.`);
    if(await hash(n.toLowerCase() + ':' + p) !== u.hash) return loginMsg('Wrong password. Try again.');
    signIn(u.name, false);
  }
  async function doCreate(){
    const n = $('#user').value.trim(), p = $('#pass').value;
    if(!n || !p) return loginMsg('Pick a name and a password first.');
    if(!/^[A-Za-z0-9_]{2,12}$/.test(n)) return loginMsg('Name: 2 to 12 letters or numbers.');
    if(n.toLowerCase() === 'guest') return loginMsg('That name is reserved. Pick another.');
    if(p.length < 4) return loginMsg('Password needs 4 or more characters.');
    const users = store.get('ka_users', {});
    if(users[n.toLowerCase()]) return loginMsg('That name is taken. Log in instead.');
    users[n.toLowerCase()] = { name:n, hash: await hash(n.toLowerCase() + ':' + p), at: Date.now() };
    store.set('ka_users', users);
    signIn(n, false);
  }
  function signIn(name, guest){
    user = { name, guest };
    if(!guest) store.set('ka_session', name.toLowerCase()); else store.del('ka_session');
    $('#pass').value = '';
    sfx.ok();
    show('menu');
  }
  function logout(){ user = null; store.del('ka_session'); $('#loginMsg').textContent = 'Logged out. See you soon.'; show('login'); }

  /* ---------- sound (Web Audio beeps) ---------- */
  let actx = null, muted = !!store.get('ka_muted', false);
  function beep(f, d = .05, type = 'square', vol = .045, delay = 0){
    if(muted) return;
    try{
      actx = actx || new (window.AudioContext || window.webkitAudioContext)();
      if(actx.state === 'suspended') actx.resume();
      const t = actx.currentTime + delay, o = actx.createOscillator(), g = actx.createGain();
      o.type = type; o.frequency.setValueAtTime(f, t);
      g.gain.setValueAtTime(vol, t); g.gain.exponentialRampToValueAtTime(.0001, t + d);
      o.connect(g).connect(actx.destination); o.start(t); o.stop(t + d + .02);
    }catch(e){}
  }
  const sfx = {
    key(){ beep(1400, .03, 'square', .025); },
    click(){ beep(1100, .025, 'square', .03); },
    ok(){ beep(880, .06); beep(1320, .08, 'square', .045, .07); },
    err(){ beep(260, .12, 'square', .04); },
    eat(){ beep(740, .04); },
    bonus(){ beep(988, .05); beep(1319, .05, 'square', .045, .06); beep(1760, .07, 'square', .045, .12); },
    land(){ beep(420, .02, 'triangle', .05); },
    die(){ beep(330, .12, 'sawtooth', .05); beep(196, .3, 'sawtooth', .05, .12); },
    over(){ beep(523, .12); beep(392, .12, 'square', .045, .14); beep(262, .3, 'square', .045, .28); }
  };
  function toggleMute(){
    muted = !muted; store.set('ka_muted', muted); $('#barMute').hidden = !muted;
    if(!muted) sfx.ok();
    if(cur === 'menu') menuView.render();
  }

  /* ---------- screens ---------- */
  const screens = {}; let cur = null;
  function show(name, ...args){
    if(cur && screens[cur].leave) screens[cur].leave();
    document.querySelectorAll('.screen').forEach(el => el.hidden = el.dataset.screen !== name);
    cur = name; screens[name].enter && screens[name].enter(...args);
  }
  const setBar = (l, r = '') => { $('#barL').textContent = l; $('#barR').textContent = r; };
  const setSoft = (l, c, r) => { $('#skL').textContent = l || ''; $('#skC').textContent = c || ''; $('#skR').textContent = r || ''; };

  /* backlight: lights up on any key, fades after a few seconds (stays on while playing) */
  let litTimer = 0;
  function wake(){
    lcd.classList.add('lit'); phone.classList.add('lit'); clearTimeout(litTimer);
    if(cur !== 'game') litTimer = setTimeout(() => { lcd.classList.remove('lit'); phone.classList.remove('lit'); }, 6000);
  }

  /* ---------- list view (Nokia style highlighted rows) ---------- */
  class ListView{
    constructor(el){ this.el = el; this.items = []; this.i = 0; }
    set(items, i = 0){ this.items = items; this.i = Math.max(0, Math.min(i, items.length - 1)); this.render(); }
    render(){
      this.el.textContent = '';
      this.items.forEach((it, k) => {
        const li = document.createElement('li');
        const a = document.createElement('span'); a.textContent = typeof it.label === 'function' ? it.label() : it.label; li.appendChild(a);
        if(it.value){ const b = document.createElement('span'); b.textContent = it.value(); li.appendChild(b); }
        if(k === this.i) li.className = 'sel';
        li.addEventListener('click', () => { wake(); this.i = k; this.render(); this.pick(); });
        this.el.appendChild(li);
      });
      const s = this.el.querySelector('.sel');
      if(s){ const top = s.offsetTop, bot = top + s.offsetHeight;
        if(top < this.el.scrollTop) this.el.scrollTop = top;
        else if(bot > this.el.scrollTop + this.el.clientHeight) this.el.scrollTop = bot - this.el.clientHeight; }
    }
    move(d){ this.i = (this.i + d + this.items.length) % this.items.length; sfx.click(); this.render(); }
    pick(){ const it = this.items[this.i]; if(!it) return; if(it.cycle){ it.cycle(1); sfx.click(); this.render(); } else if(it.action){ sfx.click(); it.action(); } }
    key(a){
      if(a === 'up') this.move(-1);
      else if(a === 'down') this.move(1);
      else if(a === 'select') this.pick();
      else if((a === 'left' || a === 'right') && this.items[this.i].cycle){ this.items[this.i].cycle(a === 'left' ? -1 : 1); sfx.click(); this.render(); }
      else return false;
      return true;
    }
  }

  /* ---------- screen: login ---------- */
  screens.login = {
    enter(){ setBar('Welcome'); setSoft('Select', '', ''); },
    key(a){
      const ctrls = ['#user','#pass','#btnLogin','#btnNew','#btnGuest'].map($);
      let i = ctrls.indexOf(document.activeElement);
      if(a === 'up' || a === 'down'){ i = i < 0 ? 0 : (i + (a === 'down' ? 1 : -1) + ctrls.length) % ctrls.length; ctrls[i].focus(); }
      else if(a === 'select'){ if(i >= 2) ctrls[i].click(); else if(i === 0) ctrls[1].focus(); else doLogin(); }
    }
  };
  $('#loginForm').addEventListener('submit', e => { e.preventDefault(); doLogin(); }, { signal });
  $('#btnNew').addEventListener('click', doCreate, { signal });
  $('#btnGuest').addEventListener('click', () => signIn('Guest', true), { signal });

  /* ---------- screen: main menu ---------- */
  const GAMES = { snake:'Snake Xenzia', roll:'Rapid Roll', bounce:'Bounce' };
  const GAME_IDS = Object.keys(GAMES);
  const menuView = new ListView($('#menuList'));
  let menuIndex = 0;
  screens.menu = {
    enter(){
      setBar('Menu', user.name); setSoft('Select', '', '');
      menuView.set([
        { label: GAMES.snake, action: () => show('opts', 'snake') },
        { label: GAMES.roll,  action: () => show('opts', 'roll') },
        { label: GAMES.bounce, action: () => show('opts', 'bounce') },
        { label: 'How to play', action: () => show('help') },
        { label: 'High scores', action: () => show('scores') },
        { label: 'Sound', value: () => muted ? 'Off' : 'On', cycle: () => toggleMute() },
        { label: user.guest ? 'Exit guest' : 'Log out', action: logout }
      ], menuIndex);
    },
    leave(){ menuIndex = menuView.i; },
    key(a){ menuView.key(a); }
  };

  /* ---------- screen: game options ---------- */
  const MAZES = ['No maze','Box','Tunnel','Mill','Rails'];
  const optsView = new ListView($('#optsList'));
  function prefsFor(g){
    const all = store.get('ka_prefs', {}), k = (user ? user.name.toLowerCase() : '') + ':' + g;
    return Object.assign(g === 'snake' ? { level:5, maze:0 } : g === 'bounce' ? { level:1 } : { level:3 }, all[k] || {});
  }
  function savePrefs(g, p){ const all = store.get('ka_prefs', {}); all[(user ? user.name.toLowerCase() : '') + ':' + g] = p; store.set('ka_prefs', all); }
  screens.opts = {
    enter(g){
      this.g = g = g || this.g; const p = prefsFor(g);
      setBar(GAMES[g], ''); setSoft('Select', '', 'Back');
      const items = [
        { label: 'Start game', action: () => show('game', g, p) },
        { label: 'Level', value: () => `◂ ${p.level} ▸`, cycle: d => { const n = g === 'bounce' ? BOUNCE_LEVELS.length : 9; p.level = (p.level - 1 + d + n) % n + 1; savePrefs(g, p); } }
      ];
      if(g === 'snake') items.push({ label: 'Maze', value: () => `◂ ${MAZES[p.maze]} ▸`, cycle: d => { p.maze = (p.maze + d + MAZES.length) % MAZES.length; savePrefs(g, p); } });
      items.push({ label: 'How to play', action: () => show('help', g) });
      items.push({ label: 'High scores', action: () => show('scores', g) });
      optsView.set(items, 0);
    },
    key(a){ if(a === 'back'){ sfx.click(); show('menu'); } else optsView.key(a); }
  };

  /* ---------- high scores ---------- */
  function saveScore(g, score){
    const best = store.get('ka_best', {}), bk = user.name.toLowerCase() + ':' + g, prev = best[bk] || 0;
    if(score <= 0) return { isNew:false, best:prev };
    const all = store.get('ka_scores', {}), list = all[g] || [];
    list.push({ name:user.name, score, at:Date.now() });
    list.sort((a, b) => b.score - a.score || a.at - b.at);
    all[g] = list.slice(0, 50); store.set('ka_scores', all); // keep deeper than the top 10 so each player's own list survives
    if(score > prev){ best[bk] = score; store.set('ka_best', best); }
    return { isNew: score > prev, best: Math.max(prev, score) };
  }
  screens.scores = {
    enter(g){ this.from = cur === 'opts' ? 'opts' : 'menu'; this.g = g || 'snake'; this.mine = false; this.render(); },
    render(){
      setBar(this.mine ? 'My scores' : 'High scores'); setSoft(this.mine ? 'All' : 'Mine', 'Game ◂▸', 'Back');
      $('#scTab').textContent = `◂ ${GAMES[this.g]} ▸`;
      let list = (store.get('ka_scores', {})[this.g]) || [];
      if(this.mine) list = list.filter(r => r.name.toLowerCase() === user.name.toLowerCase());
      list = list.slice(0, 10);
      const ol = $('#scList'); ol.textContent = ''; ol.scrollTop = 0;
      if(!list.length){ const li = document.createElement('li'); li.className = 'empty'; li.textContent = this.mine ? 'You have no scores here yet.' : 'No scores yet. Set the first one.'; ol.appendChild(li); }
      list.forEach((r, i) => {
        const li = document.createElement('li');
        [String(i + 1) + '.', r.name, String(r.score)].forEach(t => { const s = document.createElement('span'); s.textContent = t; li.appendChild(s); });
        ol.appendChild(li);
      });
      const mine = store.get('ka_best', {})[user.name.toLowerCase() + ':' + this.g] || 0;
      $('#scMine').textContent = `Your best: ${mine}`;
    },
    key(a){
      const ol = $('#scList'), row = ol.firstElementChild ? ol.firstElementChild.offsetHeight : 20;
      if(a === 'left' || a === 'right'){ this.g = GAME_IDS[(GAME_IDS.indexOf(this.g) + (a === 'left' ? GAME_IDS.length - 1 : 1)) % GAME_IDS.length]; sfx.click(); this.render(); }
      else if(a === 'select'){ this.mine = !this.mine; sfx.click(); this.render(); }
      else if(a === 'down') ol.scrollTop += row; else if(a === 'up') ol.scrollTop -= row;
      else if(a === 'back'){ sfx.click(); this.from === 'opts' ? show('opts', this.g) : show('menu'); }
    }
  };

  /* ---------- screen: how to play ---------- */
  const HELP = {
    snake:[
      'Eat the food to grow.',
      'Hitting a wall or yourself ends the game. With no maze, the edges wrap around.',
      '◂ ▸ ▲ ▼ turn the snake.',
      'Every 5th food a bug appears for a few seconds. Catch it for a big bonus.',
      'Higher levels are faster and score more.'
    ],
    roll:[
      'The platforms scroll up. Keep the ball alive.',
      '◂ ▸ steer the ball. It falls from one platform to the next.',
      'Spiked platforms and the spikes on the ceiling cost a life.',
      'Land on a heart to win a life back.'
    ],
    bounce:[
      'The ball bounces all by itself. ◂ ▸ steer it.',
      'Hold ▲ for a high bounce, hold ▼ for a low one. On a phone just tap: ▲ or ▼ sets your next bounce.',
      'Collect every ring (O) to open the exit gate, then roll through it.',
      'Spikes, pits and bugs cost a life. A flag is a checkpoint.',
      'Pump (P) makes the ball big: it bounces lower and smashes checker blocks, but cannot fit narrow gaps.',
      'Deflator (D) makes it small again. Hearts give a life, gems give points.'
    ]
  };
  screens.help = {
    enter(g){ this.from = cur === 'opts' ? 'opts' : 'menu'; this.g = g || this.g || 'snake'; setBar('How to play'); setSoft('', 'Game ◂▸', 'Back'); this.render(); },
    render(){
      $('#hlpTab').textContent = `◂ ${GAMES[this.g]} ▸`;
      const ul = $('#hlpText'); ul.textContent = ''; ul.scrollTop = 0;
      HELP[this.g].forEach(t => { const li = document.createElement('li'); li.textContent = t; ul.appendChild(li); });
    },
    key(a){
      const ul = $('#hlpText'), row = ul.firstElementChild ? ul.firstElementChild.offsetHeight : 20;
      if(a === 'left' || a === 'right' || a === 'select'){ this.g = GAME_IDS[(GAME_IDS.indexOf(this.g) + (a === 'left' ? GAME_IDS.length - 1 : 1)) % GAME_IDS.length]; sfx.click(); this.render(); }
      else if(a === 'down') ul.scrollTop += row; else if(a === 'up') ul.scrollTop -= row;
      else if(a === 'back'){ sfx.click(); this.from === 'opts' ? show('opts', this.g) : show('menu'); }
    }
  };

  /* ---------- drawing helpers ---------- */
  const cv = $('#cv'), ctx = cv.getContext('2d');
  const INK = '#22301b';
  function blit(mask, x, y){ for(let r = 0; r < mask.length; r++) for(let c = 0; c < mask[r].length; c++) if(mask[r][c] === '1') ctx.fillRect(x + c, y + r, 1, 1); }
  const pad = (n, w) => String(n).padStart(w, '0');

  /* ---------- game: Snake Xenzia ---------- */
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

  /* ---------- game: Rapid Roll ---------- */
  const RW = 128, RH = 88, SPK = 5, PW = 22, GAP = 17, BR = 2.5;
  const BALL  = ['01110','10111','11111','11111','01110'];
  const HEART = ['01010','11111','01110','00100'];
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

  /* ---------- game: Bounce ---------- */
  /* Tile legend: # wall · B brittle (big ball breaks it) · ^ spike · o ring · * gem · L extra life
     P pump (big ball) · D deflator (small ball) · C checkpoint · e patrolling enemy · S start
     E exit gate (solid until every ring is collected). Rows 9-10 are the floor, row 0 the ceiling. */
  const TILE = 8, BROWS = 11;
  function mkLevel(w, f){
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
  const BOUNCE_LEVELS = [
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

  /* ---------- game screen + loop (fixed timestep) ---------- */
  const STEP = 1 / 120;
  const G = { id:null, opts:null, obj:null, state:'play', raf:0, last:0, acc:0, hud:'' };
  function newGame(){
    G.obj = new ({ snake:Snake, roll:Roll, bounce:Bounce }[G.id])(G.opts);
    G.obj.onOver = endGame; G.state = 'play'; G.acc = 0; $('#ov').hidden = true;
    setSoft('Pause', '', '');
  }
  function loop(t){
    G.raf = requestAnimationFrame(loop);
    const dt = Math.min(.1, (t - G.last) / 1000 || 0); G.last = t;
    if(G.state === 'play'){
      G.acc += dt;
      while(G.acc >= STEP){ G.obj.update(STEP); G.acc -= STEP; if(G.state !== 'play') break; }
    }
    G.obj.draw();
    const [l, r] = G.obj.hud(), s = l + '|' + r;
    if(s !== G.hud){ G.hud = s; setBar(l, r); }
  }
  function overlay(title, text){ $('#ovTitle').textContent = title; $('#ovText').textContent = text; $('#ov').hidden = false; }
  function pauseGame(){
    if(cur !== 'game' || G.state !== 'play') return;
    G.state = 'paused'; overlay('Paused', GAMES[G.id]); setSoft('Resume', '', 'Quit');
    if(G.obj.held){ for(const k in G.obj.held) G.obj.held[k] = false; }
  }
  function resumeGame(){ G.state = 'play'; $('#ov').hidden = true; setSoft('Pause', '', ''); G.last = performance.now(); }
  function endGame(score){
    G.state = 'over'; sfx.over();
    const r = saveScore(G.id, score);
    overlay(G.obj.won ? 'You win!' : 'Game over', `Score ${score}\n${r.isNew ? 'New best!' : 'Best ' + r.best}`);
    setSoft('Again', '', 'Menu');
  }
  screens.game = {
    enter(id, opts){
      G.id = id; G.opts = { ...opts }; G.hud = ''; newGame();
      lcd.classList.add('lit'); phone.classList.add('lit'); clearTimeout(litTimer);
      G.last = performance.now(); cancelAnimationFrame(G.raf); G.raf = requestAnimationFrame(loop);
    },
    leave(){ cancelAnimationFrame(G.raf); $('#ov').hidden = true; wake(); },
    key(a){
      if(G.state === 'play'){
        if(a === 'select' || a === 'pause' || a === 'back') pauseGame();
        else G.obj.key(a);
      } else if(G.state === 'paused'){
        if(a === 'select' || a === 'pause') resumeGame();
        else if(a === 'back') show('opts', G.id);
      } else if(G.state === 'over'){
        if(a === 'select'){ newGame(); G.last = performance.now(); }
        else if(a === 'back') show('opts', G.id);
      }
    },
    keyUp(a){ if(G.obj && G.obj.keyUp) G.obj.keyUp(a); }
  };
  document.addEventListener('visibilitychange', () => { if(document.hidden) pauseGame(); }, { signal });
  window.addEventListener('blur', pauseGame, { signal });

  /* ---------- input ---------- */
  function press(a){ wake(); if(a === 'mute'){ toggleMute(); return; } const s = screens[cur]; s && s.key && s.key(a); }
  function release(a){ const s = screens[cur]; s && s.keyUp && s.keyUp(a); }

  const KEYMAP = {
    ArrowUp:'up', ArrowDown:'down', ArrowLeft:'left', ArrowRight:'right',
    w:'up', s:'down', a:'left', d:'right', W:'up', S:'down', A:'left', D:'right',
    '2':'up', '8':'down', '4':'left', '6':'right', '5':'select',
    Enter:'select', ' ':'select', Escape:'back', Backspace:'back', p:'pause', P:'pause', m:'mute', M:'mute'
  };
  const DIRS = ['up','down','left','right'];
  window.addEventListener('keydown', e => {
    const a = KEYMAP[e.key]; if(!a) return;
    if(cur === 'login'){ if(e.key === 'ArrowUp' || e.key === 'ArrowDown'){ e.preventDefault(); press(a); } return; }
    if(e.target && e.target.tagName === 'INPUT') return;
    e.preventDefault();
    if(e.repeat && !DIRS.includes(a)) return;
    press(a);
  }, { signal });
  window.addEventListener('keyup', e => { const a = KEYMAP[e.key]; if(a) release(a); }, { signal });
  window.addEventListener('blur', () => DIRS.forEach(release), { signal });

  /* on-screen keypad: hold-aware, never steals focus */
  const PADMAP = { sel:'select', c:'back', up:'up', down:'down', '2':'up', '8':'down', '4':'left', '6':'right', '5':'select', '*':'pause', '#':'mute' };
  document.querySelectorAll('.key').forEach(btn => {
    const a = PADMAP[btn.dataset.k];
    let held = false;
    const down = e => {
      e.preventDefault(); btn.classList.add('down'); held = true;
      if(!(cur === 'game' && G.state === 'play')) sfx.key();
      if(a) press(a); else wake();
    };
    const up = () => { if(!held) return; held = false; btn.classList.remove('down'); if(a) release(a); };
    btn.addEventListener('pointerdown', down, { signal });
    ['pointerup','pointerleave','pointercancel'].forEach(t => btn.addEventListener(t, up, { signal }));
    btn.addEventListener('contextmenu', e => e.preventDefault(), { signal });
  });
  $('#skL').addEventListener('click', () => press('select'), { signal });
  $('#skR').addEventListener('click', () => press('back'), { signal });

  /* ---------- boot ---------- */
  (function boot(){
    $('#barMute').hidden = !muted;
    const sess = store.get('ka_session', null), u = sess && store.get('ka_users', {})[sess];
    if(u){ user = { name:u.name, guest:false }; show('menu'); } else show('login');
    wake();
  })();

  return () => {
    ac.abort();
    cancelAnimationFrame(G.raf);
    clearTimeout(litTimer);
    if(actx){ actx.close().catch(() => {}); actx = null; }
  };
}
