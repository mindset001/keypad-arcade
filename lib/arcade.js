/* =====================================================================
   Keypad Arcade — Snake Xenzia + Rapid Roll in a Nokia-style shell.
   Sections: storage · auth · sound · screens · list view · snake ·
             rapid roll · game loop · input · boot
   Accounts, scores and league seasons live on the server (MongoDB, see
   app/api). Guests never touch the server: their scores stay in this
   browser's localStorage.
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

  /* ---------- server calls ---------- */
  async function api(path, method = 'GET', data){
    try{
      const r = await fetch('/api' + path, {
        method, credentials:'same-origin',
        headers: data ? { 'Content-Type':'application/json' } : undefined, body: data ? JSON.stringify(data) : undefined
      });
      return { ok:r.ok, status:r.status, data: await r.json().catch(() => ({})) };
    }catch(e){ return { ok:false, status:0, data:{ error:'Offline. Try again, or play as guest.' } }; }
  }

  /* ---------- auth ---------- */
  let user = null; // { name, guest }
  const loginMsg = t => { $('#loginMsg').textContent = t; sfx.err(); };
  let authBusy = false;

  async function auth(kind){ // 'login' | 'register'
    if(authBusy) return;
    const n = $('#user').value.trim(), p = $('#pass').value;
    if(!n || !p) return loginMsg(kind === 'login' ? 'Enter a name and a password.' : 'Pick a name and a password first.');
    if(kind === 'register'){
      if(!/^[A-Za-z0-9_]{2,12}$/.test(n)) return loginMsg('Name: 2 to 12 letters or numbers.');
      if(n.toLowerCase() === 'guest') return loginMsg('That name is reserved. Pick another.');
      if(p.length < 6) return loginMsg('Password needs 6 or more characters.');
    }
    authBusy = true; $('#loginMsg').textContent = 'Connecting...';
    const r = await api('/auth/' + kind, 'POST', { name:n, password:p });
    authBusy = false;
    if(signal.aborted) return;
    if(!r.ok) return loginMsg(r.data.error || 'Could not reach the server.');
    signIn(r.data.name, false);
  }
  function signIn(name, guest){
    user = { name, guest };
    $('#pass').value = '';
    sfx.ok();
    show('menu');
  }
  function logout(){
    if(user && !user.guest) api('/auth/logout', 'POST');
    user = null; $('#loginMsg').textContent = 'Logged out. See you soon.'; show('login');
  }

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
      else if(a === 'select'){ if(i >= 2) ctrls[i].click(); else if(i === 0) ctrls[1].focus(); else auth('login'); }
    }
  };
  $('#loginForm').addEventListener('submit', e => { e.preventDefault(); auth('login'); }, { signal });
  $('#btnNew').addEventListener('click', () => auth('register'), { signal });
  $('#btnGuest').addEventListener('click', () => signIn('Guest', true), { signal });

  /* ---------- screen: main menu ---------- */
  const GAMES = { snake:'Snake Xenzia', roll:'Rapid Roll', bounce:'Bounce', soccer:'Soccer League' };
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
        { label: GAMES.soccer, action: () => show('opts', 'soccer') },
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
    return Object.assign(g === 'snake' ? { level:5, maze:0 } : g === 'bounce' ? { level:1 } : g === 'soccer' ? { level:3, mode:0 } : { level:3 }, all[k] || {});
  }
  function savePrefs(g, p){ const all = store.get('ka_prefs', {}); all[(user ? user.name.toLowerCase() : '') + ':' + g] = p; store.set('ka_prefs', all); }
  screens.opts = {
    enter(g){
      this.g = g = g || this.g; const p = prefsFor(g);
      setBar(GAMES[g], ''); setSoft('Select', '', 'Back');
      const items = [
        { label: 'Start game', action: () => g === 'soccer' && p.mode ? show('league') : show('game', g, p) },
        { label: 'Level', value: () => `◂ ${p.level} ▸`, cycle: d => { const n = g === 'bounce' ? BOUNCE_LEVELS.length : 9; p.level = (p.level - 1 + d + n) % n + 1; savePrefs(g, p); } }
      ];
      if(g === 'soccer') items.splice(1, 0, { label: 'Mode', value: () => `◂ ${['Quick','League'][p.mode]} ▸`, cycle: () => { p.mode = 1 - p.mode; savePrefs(g, p); } });
      if(g === 'snake') items.push({ label: 'Maze', value: () => `◂ ${MAZES[p.maze]} ▸`, cycle: d => { p.maze = (p.maze + d + MAZES.length) % MAZES.length; savePrefs(g, p); } });
      items.push({ label: 'How to play', action: () => show('help', g) });
      items.push({ label: 'High scores', action: () => show('scores', g) });
      optsView.set(items, 0);
    },
    key(a){ if(a === 'back'){ sfx.click(); show('menu'); } else optsView.key(a); }
  };

  /* ---------- high scores ---------- */
  /* Logged-in players post to the server (shared leaderboard); guests, or a failed call,
     fall back to this browser's localStorage. Always resolves to { isNew, best }. */
  async function saveScoreAny(g, score){
    if(!user.guest && score > 0){ const r = await api('/scores', 'POST', { game:g, score }); if(r.ok) return r.data; }
    return saveScore(g, score);
  }
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
    req:0,
    enter(g){ this.from = cur === 'opts' ? 'opts' : 'menu'; this.g = g || 'snake'; this.mine = false; this.render(); },
    render(){
      setBar(this.mine ? 'My scores' : 'High scores'); setSoft(this.mine ? 'All' : 'Mine', 'Game ◂▸', 'Back');
      $('#scTab').textContent = `◂ ${GAMES[this.g]} ▸`;
      if(user.guest){
        let list = (store.get('ka_scores', {})[this.g]) || [];
        if(this.mine) list = list.filter(r => r.name.toLowerCase() === user.name.toLowerCase());
        this.paint(list, store.get('ka_best', {})[user.name.toLowerCase() + ':' + this.g] || 0, 'Guest scores stay on this device.');
        return;
      }
      const token = ++this.req, g = this.g;
      this.paint(null, 0, 'Loading...');
      api(`/scores?game=${g}${this.mine ? '&mine=1' : ''}`).then(r => {
        if(token !== this.req || cur !== 'scores') return;
        if(r.ok) this.paint(r.data.scores, r.data.best);
        else this.paint(null, 0, r.data.error || 'Could not load scores.');
      });
    },
    paint(list, best, note){
      const ol = $('#scList'); ol.textContent = ''; ol.scrollTop = 0;
      if(!list || !list.length){
        const li = document.createElement('li'); li.className = 'empty';
        li.textContent = !list ? (note || '') : this.mine ? 'You have no scores here yet.' : 'No scores yet. Set the first one.'; ol.appendChild(li);
      }
      (list || []).slice(0, 10).forEach((r, i) => {
        const li = document.createElement('li');
        [String(i + 1) + '.', r.name, String(r.score)].forEach(t => { const s = document.createElement('span'); s.textContent = t; li.appendChild(s); });
        ol.appendChild(li);
      });
      $('#scMine').textContent = list && note ? note : `Your best: ${best}`;
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
    soccer:[
      'Two teams of five. Most goals in two halves wins. Walls keep the ball in play.',
      '◂ ▸ ▲ ▼ run. You drive the player with the arrow above them, whoever is nearest the ball.',
      'With the ball, Select: tap to pass, hold then let go to shoot. Hold longer for a harder shot. Face a corner of the goal to aim.',
      'Without the ball, Select: slide tackle.',
      'Quick: one game against the computer. League: play all 5 clubs, 3 points a win.'
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

  /* ---------- game: Soccer League ---------- */
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
        $('#ov').hidden = true; this.kickoff(); return; // after a goal or half time
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

  /* ----- league: 6 clubs, round robin, results saved per player ----- */
  const CLUBS = ['Demlinks', 'Rovers', 'Albion', 'United', 'City', 'Athletic'];
  const CLUB_LVL = [0, 2, 3, 5, 6, 8]; // computer level of each club (index 0 is you)
  const ROUNDS = (() => {
    let a = [0, 1, 2, 3, 4, 5]; const out = [];
    for(let r = 0; r < 5; r++){ out.push([[a[0], a[5]], [a[1], a[4]], [a[2], a[3]]]); a = [a[0], a[5], a[1], a[2], a[3], a[4]]; }
    return out;
  })();
  const ORD = ['', '1st', '2nd', '3rd', '4th', '5th', '6th'];
  const newLeague = () => ({ round:0, rows:CLUBS.map(() => ({ p:0, w:0, d:0, l:0, gf:0, ga:0, pts:0 })) });
  const getLeague = () => store.get('ka_league', {})[user.name.toLowerCase()] || newLeague();
  const putLeague = L => {
    const all = store.get('ka_league', {}); all[user.name.toLowerCase()] = L; store.set('ka_league', all); // local copy (also the guest's only copy)
    if(!user.guest) api('/league', 'PUT', { round:L.round, rows:L.rows });
  };
  const poisson = l => { let k = 0, p = 1; const e = Math.exp(-l); do { k++; p *= Math.random(); } while(p > e); return k - 1; };
  function tally(L, a, b, ga, gb){
    const A = L.rows[a], B = L.rows[b]; A.p++; B.p++; A.gf += ga; A.ga += gb; B.gf += gb; B.ga += ga;
    if(ga > gb){ A.w++; A.pts += 3; B.l++; } else if(ga < gb){ B.w++; B.pts += 3; A.l++; } else { A.d++; B.d++; A.pts++; B.pts++; }
  }
  const standings = L => L.rows.map((r, i) => ({ i, ...r, gd:r.gf - r.ga })).sort((a, b) => b.pts - a.pts || b.gd - a.gd || b.gf - a.gf || a.i - b.i);
  const leagueOpp = L => { const m = ROUNDS[L.round].find(x => x[0] === 0 || x[1] === 0); return m[0] === 0 ? m[1] : m[0]; };
  function leagueRecord(L, gf, ga){
    const opp = leagueOpp(L);
    for(const [a, b] of ROUNDS[L.round]){
      if(a === 0 || b === 0) tally(L, 0, opp, gf, ga);
      else tally(L, a, b, poisson(Math.max(.4, 1.3 + .12 * (CLUB_LVL[a] - CLUB_LVL[b]))), poisson(Math.max(.4, 1.3 + .12 * (CLUB_LVL[b] - CLUB_LVL[a]))));
    }
    L.round++;
  }
  function soccerDone(o){
    const [gf, ga] = o.goals, title = gf > ga ? 'You win!' : gf < ga ? 'You lose' : 'Draw';
    const show2 = text => { if(G.obj === o && G.state === 'over') $('#ovText').textContent = text; };
    if(o.mode === 'league'){
      const L = getLeague(); leagueRecord(L, gf, ga); putLeague(L);
      const head = `${gf} - ${ga} vs ${o.oppName}`;
      if(L.round >= 5){
        const st = standings(L), pos = st.findIndex(r => r.i === 0) + 1, me = st[pos - 1];
        const sc = Math.max(0, me.pts * 10 + me.gd + (pos === 1 ? 50 : 0)), tail = `\n${pos === 1 ? 'CHAMPIONS!' : 'Finished ' + ORD[pos]}\nScore ${sc}`;
        overlay(title, head + tail);
        saveScoreAny('soccer', sc).then(r => show2(head + tail + (r.isNew ? ' New best!' : '')));
      } else overlay(title, head);
      o.afterKey = () => show('league'); setSoft('Table', '', '');
    } else {
      const sc = gf * 10 + (gf > ga ? 30 : gf === ga ? 10 : 0);
      overlay(title, `${gf} - ${ga}\nScore ${sc}\nSaving...`); setSoft('Again', '', 'Menu');
      saveScoreAny('soccer', sc).then(r => show2(`${gf} - ${ga}\nScore ${sc}\n${r.isNew ? 'New best!' : 'Best ' + r.best}`));
    }
  }
  screens.league = {
    ready:true,
    enter(){
      setBar('League'); this.ready = true; this.render();
      if(user.guest) return;
      /* the server copy follows the player across devices; the more advanced of server/local wins */
      const token = this.token = {}; this.ready = false; this.render();
      api('/league').then(r => {
        if(token !== this.token || cur !== 'league') return;
        const local = getLeague(), remote = r.ok && r.data.league;
        if(remote && remote.round > local.round){ const all = store.get('ka_league', {}); all[user.name.toLowerCase()] = remote; store.set('ka_league', all); }
        else if(r.ok && local.round > (remote ? remote.round : -1) && local.round > 0) putLeague(local);
        this.ready = true; this.render();
      });
    },
    render(){
      const L = this.L = getLeague(), over = L.round >= 5, st = standings(L), ol = $('#lgList');
      setSoft(over ? 'New' : 'Play', '', 'Back');
      $('#lgTab').textContent = over ? 'Final · P GD Pts' : `Rnd ${L.round + 1}/5 · P GD Pts`;
      ol.textContent = '';
      st.forEach((r, k) => {
        const li = document.createElement('li'); if(r.i === 0) li.className = 'me';
        [`${k + 1}.`, CLUBS[r.i], `${r.p} ${r.gd > 0 ? '+' : ''}${r.gd} ${r.pts}`].forEach(t => { const s = document.createElement('span'); s.textContent = t; li.appendChild(s); });
        ol.appendChild(li);
      });
      const pos = st.findIndex(r => r.i === 0) + 1;
      if(!this.ready){ $('#lgNext').textContent = 'Loading...'; return; }
      $('#lgNext').textContent = over ? (pos === 1 ? 'Champions! Select: new season' : `Finished ${ORD[pos]}. Select: new season`) : `Next: ${CLUBS[leagueOpp(L)]}`;
    },
    key(a){
      if(a === 'back'){ sfx.click(); show('opts', 'soccer'); }
      else if(a === 'select'){
        if(!this.ready) return;
        const L = this.L;
        if(L.round >= 5){ putLeague(newLeague()); sfx.ok(); this.render(); }
        else { const o = leagueOpp(L); show('game', 'soccer', { mode:1, level:CLUB_LVL[o], oppName:CLUBS[o] }); }
      }
    }
  };

  /* ---------- game screen + loop (fixed timestep) ---------- */
  const STEP = 1 / 120;
  const G = { id:null, opts:null, obj:null, state:'play', raf:0, last:0, acc:0, hud:'' };
  const playSoft = () => G.obj && G.obj.usesSelect ? setSoft('', '', 'Pause') : setSoft('Pause', '', '');
  function newGame(){
    G.obj = new ({ snake:Snake, roll:Roll, bounce:Bounce, soccer:Soccer }[G.id])(G.opts);
    G.obj.onOver = endGame; G.state = 'play'; G.acc = 0; $('#ov').hidden = true;
    playSoft();
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
    if('selT' in G.obj) G.obj.selT = null;
  }
  function resumeGame(){ G.state = 'play'; $('#ov').hidden = true; playSoft(); G.last = performance.now(); }
  function endGame(score){
    G.state = 'over'; sfx.over();
    if(G.obj.isSoccer){ soccerDone(G.obj); return; }
    const obj = G.obj, title = obj.won ? 'You win!' : 'Game over';
    overlay(title, `Score ${score}\nSaving...`); setSoft('Again', '', 'Menu');
    saveScoreAny(G.id, score).then(r => { if(G.obj === obj && G.state === 'over') $('#ovText').textContent = `Score ${score}\n${r.isNew ? 'New best!' : 'Best ' + r.best}`; });
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
        if(a === 'pause' || a === 'back' || (a === 'select' && !G.obj.usesSelect)) pauseGame();
        else G.obj.key(a);
      } else if(G.state === 'paused'){
        if(a === 'select' || a === 'pause') resumeGame();
        else if(a === 'back') show('opts', G.id);
      } else if(G.state === 'over'){
        if(G.obj.afterKey){ if(a === 'select' || a === 'back') G.obj.afterKey(); }
        else if(a === 'select'){ newGame(); G.last = performance.now(); }
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
  const PADMAP = { sel:'select', c:'back', up:'up', down:'down', left:'left', right:'right', '2':'up', '8':'down', '4':'left', '6':'right', '5':'select', '*':'pause', '#':'mute' };
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
  (async function boot(){
    $('#barMute').hidden = !muted;
    show('login'); wake();
    $('#loginMsg').textContent = 'Checking session...';
    const r = await api('/auth/me');
    if(signal.aborted) return;
    if(r.ok && r.data.user && cur === 'login'){ user = { name:r.data.user.name, guest:false }; show('menu'); }
    else if(cur === 'login') $('#loginMsg').textContent = 'Log in, or make a new player.';
  })();

  return () => {
    ac.abort();
    cancelAnimationFrame(G.raf);
    clearTimeout(litTimer);
    if(actx){ actx.close().catch(() => {}); actx = null; }
  };
}
