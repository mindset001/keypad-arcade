/* =====================================================================
   Keypad Arcade: Snake Xenzia, Rapid Roll, Bounce and Soccer League in a
   Nokia-style shell. This file wires the screens, input and game loop;
   the games and helpers live in their own modules:
     games/{snake,roll,bounce,soccer}.js  the four games
     league.js                            Soccer League season logic (pure)
     data.js · draw.js · storage.js · sound.js · api.js
   Accounts, scores and league seasons live on the server (MongoDB, see
   app/api). Guests never touch the server: their scores stay in this
   browser's localStorage.
   ===================================================================== */
import { createStore } from './storage.js';
import { createSound } from './sound.js';
import { api } from './api.js';
import { INK, HEART, pad, makeBlit } from './draw.js';
import { GAMES, GAME_IDS, MAZES, HELP, THEMES, THEME_NAMES } from './data.js';
import { shareText, share } from './share.js';
import { nameError, passwordError } from './validate.js';
import { CONTROL_MODES, CONTROL_NAMES, defaultControls, schemeFor, stickDirs, swipeDir } from './touch.js';
import { createSnake } from './games/snake.js';
import { createRoll } from './games/roll.js';
import { createBounce, BOUNCE_LEVELS } from './games/bounce.js';
import { createSoccer } from './games/soccer.js';
import { CLUBS, CLUB_LVL, ORD, newLeague, standings, leagueOpp, leagueRecord } from './league.js';

/* Mounts the arcade onto the already-rendered markup. Returns a cleanup
   function so React strict mode / navigation can unmount without leaks. */
export function initArcade(){
  const ac = new AbortController(), signal = ac.signal;
  const $ = s => document.querySelector(s);
  const lcd = $('#lcd'), phone = $('#phone');

  const store = createStore();
  const sound = createSound(store), { sfx } = sound;

  /* ---------- handset colour ---------- */
  const desk = phone.closest('.desk');
  let theme = THEMES.includes(store.get('ka_theme')) ? store.get('ka_theme') : THEMES[0];
  function applyTheme(t){ if(!THEMES.includes(t)) return; theme = t; if(desk) desk.dataset.theme = t; store.set('ka_theme', t); }
  /* a colour change that never reached the server is remembered (per player) and pushed at the next login */
  async function pushTheme(){
    const r = await api('/prefs', 'PUT', { theme });
    if(r.status === 401) sessionLost();
    store.set('ka_theme_dirty', r.ok || !user ? '' : user.name.toLowerCase());
  }
  function cycleTheme(d){
    applyTheme(THEMES[(THEMES.indexOf(theme) + d + THEMES.length) % THEMES.length]);
    if(user && !user.guest) pushTheme();
  }
  /* after logging in: the account's colour wins, unless a newer change made here never reached the server */
  function syncTheme(serverTheme){
    if(user && store.get('ka_theme_dirty', '') === user.name.toLowerCase()) pushTheme(); else applyTheme(serverTheme);
  }
  applyTheme(theme);

  /* ---------- controls: the keypad (handset) or touch (full screen + on-screen deck) ----------
     Saved per DEVICE (not on the account): you may want touch on a phone and the keypad on a laptop.
     Until you choose, a phone/tablet starts in touch mode and a computer on the keypad. */
  let controls = store.get('ka_controls');
  if(!CONTROL_MODES.includes(controls)) controls = defaultControls({ coarse:matchMedia('(pointer: coarse)').matches, width:innerWidth });
  if(desk) desk.dataset.controls = controls;
  function cycleControls(d){
    controls = CONTROL_MODES[(CONTROL_MODES.indexOf(controls) + d + CONTROL_MODES.length) % CONTROL_MODES.length];
    store.set('ka_controls', controls); if(desk) desk.dataset.controls = controls; syncDeck();
  }
  /* which on-screen controls belong to the current screen / game state (see globals.css) */
  function syncDeck(){
    phone.dataset.scheme = schemeFor(cur, G.id, G.state);
    /* the game-over buttons mirror the soft keys the screen is offering: "Again" or "Table", "Menu" (or none), and
       Share only when there is a score to share */
    const left = $('#skL').textContent, mid = $('#skC').textContent, right = $('#skR').textContent;
    phone.dataset.share = mid === 'Share' ? '1' : '';
    const ok = phone.querySelector('.g-over .td-ok'), back = phone.querySelector('.g-over .td-back');
    if(ok) ok.textContent = left || 'OK';
    if(back){ back.textContent = right || 'Menu'; back.hidden = !right; }
  }

  /* ---------- auth ---------- */
  let user = null; // { name, guest }
  let sessionEnded = false; // the server told us our login is no longer valid (expired, or logged out in another tab)
  const loginMsg = t => { $('#loginMsg').textContent = t; sfx.err(); };
  let authBusy = false;
  const setAuthBusy = b => { authBusy = b; for(const id of ['#btnLogin', '#btnNew']) $(id).disabled = b; };

  function showPassword(on){
    const b = $('#btnShow'); $('#pass').type = on ? 'text' : 'password';
    // the icon follows aria-pressed in CSS: open eye = "click to show", slashed eye = "click to hide"
    b.setAttribute('aria-pressed', String(on)); b.setAttribute('aria-label', on ? 'Hide password' : 'Show password'); b.title = b.getAttribute('aria-label');
  }

  async function auth(kind){ // 'login' | 'register'
    if(authBusy) return;
    const n = $('#user').value.trim(), p = $('#pass').value;
    if(!n || !p) return loginMsg(kind === 'login' ? 'Enter a name and a password.' : 'Pick a name and a password first.');
    if(kind === 'register'){ const bad = nameError(n) || passwordError(p); if(bad) return loginMsg(bad); }
    setAuthBusy(true); $('#loginMsg').textContent = 'Connecting...';
    const r = await api('/auth/' + kind, 'POST', kind === 'register' ? { name:n, password:p, theme } : { name:n, password:p });
    if(signal.aborted) return;
    setAuthBusy(false);
    if(!r.ok) return loginMsg(r.status === 0 ? 'No connection. Check your network, or play as guest.' : (r.data.error || 'Could not reach the server.'));
    signIn(r.data.name, false, r.data.theme);
  }
  function signIn(name, guest, serverTheme){
    user = { name, guest }; sessionEnded = false;
    $('#pass').value = ''; showPassword(false);
    if(!guest){ syncTheme(serverTheme); flushPending(); }
    sfx.ok();
    show('menu');
  }
  async function logout(){
    const member = user && !user.guest;
    user = null; $('#pass').value = ''; showPassword(false);
    $('#loginMsg').textContent = 'Logged out. See you soon.'; show('login');
    if(member){
      const r = await api('/auth/logout', 'POST');
      if(!r.ok && !signal.aborted && cur === 'login') $('#loginMsg').textContent = 'Logged out here, but the server could not be reached. A reload may sign you back in.';
    }
  }
  function sessionLost(){ if(user && !user.guest) sessionEnded = true; }
  function endSession(){ sessionEnded = false; user = null; $('#loginMsg').textContent = 'Your session ended. Please log in again.'; show('login'); }

  /* scores that could not reach the server wait here (per player) and are retried later */
  const pendingKey = () => 'ka_pending:' + user.name.toLowerCase();
  let flushing = false;
  async function flushPending(){
    if(flushing || !user || user.guest) return;
    flushing = true;
    try{
      const k = pendingKey(), q = store.get(k, []);
      while(q.length && !signal.aborted){
        const r = await api('/scores', 'POST', { game:q[0].g, score:q[0].score });
        if(r.status === 401){ sessionLost(); break; }
        if(!r.ok && (r.status === 0 || r.status === 429 || r.status >= 500)) break; // the network or server, not the score: try again later
        q.shift(); store.set(k, q);                                                     // saved, or a score the server will never accept
      }
    }finally{ flushing = false; }
  }

  function toggleMute(){
    sound.setMuted(!sound.isMuted()); $('#barMute').hidden = !sound.isMuted();
    if(!sound.isMuted()) sfx.ok();
    if(cur === 'menu') menuView.render();
  }

  /* ---------- screens ---------- */
  const screens = {}; let cur = null;
  function show(name, ...args){
    if(cur && screens[cur].leave) screens[cur].leave();
    document.querySelectorAll('.screen').forEach(el => el.hidden = el.dataset.screen !== name);
    cur = name; screens[name].enter && screens[name].enter(...args); syncDeck();
  }
  const setBar = (l, r = '') => { $('#barL').textContent = l; $('#barR').textContent = r; };
  const setSoft = (l, c, r) => { $('#skL').textContent = l || ''; $('#skC').textContent = c || ''; $('#skR').textContent = r || ''; syncDeck(); };

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
      const ctrls = ['#user','#pass','#btnShow','#btnLogin','#btnNew','#btnGuest'].map($);
      let i = ctrls.indexOf(document.activeElement);
      if(a === 'up' || a === 'down'){ i = i < 0 ? 0 : (i + (a === 'down' ? 1 : -1) + ctrls.length) % ctrls.length; ctrls[i].focus(); }
      else if(a === 'select'){ if(i >= 2) ctrls[i].click(); else if(i === 0) ctrls[1].focus(); else auth('login'); }
    }
  };
  $('#loginForm').addEventListener('submit', e => { e.preventDefault(); auth('login'); }, { signal });
  $('#btnNew').addEventListener('click', () => auth('register'), { signal });
  /* a tap/click must not pull focus off the password field (a phone keyboard would close mid-typing);
     activating it from the keyboard/D-pad leaves focus on the button so Down moves on to Log in */
  $('#btnShow').addEventListener('pointerdown', e => e.preventDefault(), { signal });
  $('#btnShow').addEventListener('click', () => showPassword($('#pass').type === 'password'), { signal });
  $('#btnGuest').addEventListener('click', () => signIn('Guest', true), { signal });

  /* ---------- screen: main menu ---------- */
  const menuView = new ListView($('#menuList'));
  let menuIndex = 0;
  screens.menu = {
    enter(){
      if(sessionEnded){ endSession(); return; }
      setBar('Menu', user.name); setSoft('Select', '', '');
      menuView.set([
        { label: GAMES.snake, action: () => show('opts', 'snake') },
        { label: GAMES.roll,  action: () => show('opts', 'roll') },
        { label: GAMES.bounce, action: () => show('opts', 'bounce') },
        { label: GAMES.soccer, action: () => show('opts', 'soccer') },
        { label: 'How to play', action: () => show('help') },
        { label: 'High scores', action: () => show('scores') },
        { label: 'Controls', value: () => CONTROL_NAMES[controls], cycle: d => cycleControls(d) },
        { label: 'Handset', value: () => THEME_NAMES[theme], cycle: d => cycleTheme(d) },
        { label: 'Sound', value: () => sound.isMuted() ? 'Off' : 'On', cycle: () => toggleMute() },
        { label: user.guest ? 'Exit guest' : 'Log out', action: logout }
      ], menuIndex);
    },
    leave(){ menuIndex = menuView.i; },
    key(a){ menuView.key(a); }
  };

  /* ---------- screen: game options ---------- */
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
    if(user.guest || score <= 0) return { ...saveScore(g, score), where:'guest' };
    const r = await api('/scores', 'POST', { game:g, score });
    if(r.ok){ flushPending(); return { ...r.data, where:'server' }; }
    if(r.status === 401) sessionLost();
    if(r.status === 0 || r.status === 401 || r.status === 429 || r.status >= 500){ // not the score's fault: keep it and retry later
      const k = pendingKey(), q = store.get(k, []); q.push({ g, score, at:Date.now() }); store.set(k, q.slice(-20));
    }
    return { ...saveScore(g, score), where:r.status === 401 ? 'expired' : 'offline' };
  }
  /* what to tell the player when the score did NOT reach the server */
  const saveNote = r => r.where === 'expired' ? '\nLog in again to save' : r.where === 'offline' ? '\nOffline. Will retry' : '';
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
        else { if(r.status === 401) sessionLost(); this.paint(null, 0, r.data.error || 'Could not load scores.'); }
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

  /* ---------- games (each lives in games/*.js and gets what it needs from env) ---------- */
  const ctx = $('#cv').getContext('2d'), blit = makeBlit(ctx);
  const env = { ctx, sfx, blit, pad, INK, HEART, overlay, hideOverlay };
  const Snake = createSnake(env), Roll = createRoll(env), Bounce = createBounce(env), Soccer = createSoccer(env);

  /* ----- league: this player's season, kept locally and (when logged in) on the server ----- */
  const getLeague = () => store.get('ka_league', {})[user.name.toLowerCase()] || newLeague();
  const putLeague = L => {
    const all = store.get('ka_league', {}); all[user.name.toLowerCase()] = L; store.set('ka_league', all); // local copy (also the guest's only copy)
    if(!user.guest) api('/league', 'PUT', { round:L.round, rows:L.rows }).then(r => { if(r.status === 401) sessionLost(); });
  };
  function soccerDone(o){
    const [gf, ga] = o.goals, title = gf > ga ? 'You win!' : gf < ga ? 'You lose' : 'Draw';
    const show2 = text => { if(G.obj === o && G.state === 'over') $('#ovText').textContent = text; };
    if(o.mode === 'league'){
      const L = getLeague(); leagueRecord(L, gf, ga); putLeague(L);
      const head = `${gf} - ${ga} vs ${o.oppName}`;
      if(L.round >= 5){
        const st = standings(L), pos = st.findIndex(r => r.i === 0) + 1, me = st[pos - 1];
        const sc = Math.max(0, me.pts * 10 + me.gd + (pos === 1 ? 50 : 0)); offerShare('soccer', sc); const tail = `\n${pos === 1 ? 'CHAMPIONS!' : 'Finished ' + ORD[pos]}\nScore ${sc}`;
        overlay(title, head + tail);
        saveScoreAny('soccer', sc).then(r => show2(head + tail + (r.isNew ? ' New best!' : '') + saveNote(r)));
      } else { G.share = null; overlay(title, head); }
      o.afterKey = () => show('league'); overSoft('Table', '');
    } else {
      const sc = gf * 10 + (gf > ga ? 30 : gf === ga ? 10 : 0);
      offerShare('soccer', sc); overSoft('Again', 'Menu');
      overlay(title, `${gf} - ${ga}\nScore ${sc}\nSaving...`);
      saveScoreAny('soccer', sc).then(r => show2(`${gf} - ${ga}\nScore ${sc}\n${r.isNew ? 'New best!' : 'Best ' + r.best}${saveNote(r)}`));
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
  const G = { id:null, opts:null, obj:null, state:'play', raf:0, last:0, acc:0, hud:'', share:null };
  /* the score the Share key will post: set when a game ends with a score worth sharing */
  const offerShare = (g, score) => { G.share = score > 0 ? { g, score } : null; };
  const overSoft = (left, right) => setSoft(left, G.share ? 'Share' : '', right);
  let toastT = 0;
  function toast(msg){
    setBar(G.obj.hud()[0], msg); clearTimeout(toastT);
    toastT = setTimeout(() => { if(cur === 'game' && G.obj){ const [l, r] = G.obj.hud(); setBar(l, r); } }, 1800);
  }
  async function shareScore(){
    if(!G.share || G.state !== 'over') return;
    const { g, score } = G.share, res = await share({ text:shareText(GAMES[g], score), url:location.origin + '/' });
    if(signal.aborted || cur !== 'game') return;
    const msg = { shared:'Shared!', copied:'Copied!', failed:'Share failed' }[res]; if(msg) toast(msg);
  }
  const playSoft = () => G.obj && G.obj.usesSelect ? setSoft('', '', 'Pause') : setSoft('Pause', '', '');
  function newGame(){
    G.obj = new ({ snake:Snake, roll:Roll, bounce:Bounce, soccer:Soccer }[G.id])(G.opts);
    G.obj.onOver = endGame; G.state = 'play'; G.acc = 0; G.share = null; $('#ov').hidden = true;
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
  function hideOverlay(){ $('#ov').hidden = true; }
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
    offerShare(G.id, score); overSoft('Again', 'Menu');
    overlay(title, `Score ${score}\nSaving...`);
    saveScoreAny(G.id, score).then(r => { if(G.obj === obj && G.state === 'over') $('#ovText').textContent = `Score ${score}\n${r.isNew ? 'New best!' : 'Best ' + r.best}${saveNote(r)}`; });
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
        if(a === 'share') shareScore();
        else if(G.obj.afterKey){ if(a === 'select' || a === 'back') G.obj.afterKey(); }
        else if(a === 'select'){ newGame(); G.last = performance.now(); }
        else if(a === 'back') show('opts', G.id);
      }
    },
    keyUp(a){ if(G.obj && G.obj.keyUp) G.obj.keyUp(a); }
  };
  document.addEventListener('visibilitychange', () => { if(document.hidden) pauseGame(); }, { signal });
  window.addEventListener('blur', pauseGame, { signal });

  /* ---------- input ---------- */
  const DIRS = ['up','down','left','right'];
  /* phone.dataset.pressed = the directions currently held; phone.dataset.last = the last action (inspectable, handy for tests) */
  const heldDirs = new Set();
  const markHeld = () => { phone.dataset.pressed = [...heldDirs].join(' '); };
  function press(a){
    wake(); phone.dataset.last = a;
    if(DIRS.includes(a)){ heldDirs.add(a); markHeld(); }
    if(a === 'mute'){ toggleMute(); return; } const s = screens[cur]; s && s.key && s.key(a);
  }
  function release(a){ if(heldDirs.delete(a)) markHeld(); const s = screens[cur]; s && s.keyUp && s.keyUp(a); }

  const KEYMAP = {
    ArrowUp:'up', ArrowDown:'down', ArrowLeft:'left', ArrowRight:'right',
    w:'up', s:'down', a:'left', d:'right', W:'up', S:'down', A:'left', D:'right',
    '2':'up', '8':'down', '4':'left', '6':'right', '5':'select',
    Enter:'select', ' ':'select', Escape:'back', Backspace:'back', p:'pause', P:'pause', m:'mute', M:'mute', h:'share', H:'share'
  };
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

  /* on-screen keys (keypad AND touch deck): hold-aware, never steal focus */
  const PADMAP = { sel:'select', c:'back', up:'up', down:'down', left:'left', right:'right', '2':'up', '8':'down', '4':'left', '6':'right', '5':'select', '*':'pause', '#':'mute', '0':'share' };
  const buzz = () => { if(controls === 'touch' && !sound.isMuted() && navigator.vibrate) navigator.vibrate(8); }; // a tiny tap on phones, only with sound on
  document.querySelectorAll('.key, .td-btn').forEach(btn => {
    const a = PADMAP[btn.dataset.k], deck = btn.classList.contains('td-btn');
    let held = false;
    const down = e => {
      e.preventDefault(); btn.classList.add('down'); held = true;
      if(deck){ try{ btn.setPointerCapture(e.pointerId); }catch(err){} buzz(); } // a thumb sliding off a held button must not drop it
      if(!(cur === 'game' && G.state === 'play')) sfx.key();
      if(a) press(a); else wake();
    };
    const up = () => { if(!held) return; held = false; btn.classList.remove('down'); if(a) release(a); };
    btn.addEventListener('pointerdown', down, { signal });
    (deck ? ['pointerup', 'pointercancel', 'lostpointercapture'] : ['pointerup', 'pointerleave', 'pointercancel']).forEach(t => btn.addEventListener(t, up, { signal }));
    btn.addEventListener('contextmenu', e => e.preventDefault(), { signal });
  });

  /* touch deck: the soccer joystick (eight directions) */
  const stick = $('#stick'), knob = $('#stickKnob'), stickHeld = new Set();
  let stickPtr = null;
  function stickMove(e){
    const r = stick.getBoundingClientRect(), R = r.width / 2, dx = e.clientX - (r.left + R), dy = e.clientY - (r.top + R), m = Math.hypot(dx, dy) || 1, k = Math.min(1, m / R) * R * .55;
    knob.style.transform = `translate(${dx / m * k}px, ${dy / m * k}px)`;
    const want = new Set(stickDirs(dx, dy, R));
    for(const d of [...stickHeld]) if(!want.has(d)){ stickHeld.delete(d); release(d); }
    for(const d of want) if(!stickHeld.has(d)){ stickHeld.add(d); press(d); }
  }
  const stickEnd = e => {
    if(e.pointerId !== stickPtr) return; stickPtr = null;
    for(const d of [...stickHeld]) release(d); stickHeld.clear(); knob.style.transform = '';
  };
  stick.addEventListener('pointerdown', e => { e.preventDefault(); stickPtr = e.pointerId; try{ stick.setPointerCapture(e.pointerId); }catch(err){} buzz(); stickMove(e); }, { signal });
  stick.addEventListener('pointermove', e => { if(e.pointerId === stickPtr) stickMove(e); }, { signal });
  ['pointerup', 'pointercancel', 'lostpointercapture'].forEach(t => stick.addEventListener(t, stickEnd, { signal }));

  /* touch mode, Snake: swipe anywhere on the screen to turn (a long drag can turn twice) */
  const gameScreen = document.querySelector('.screen[data-screen=game]');
  let swipe = null;
  gameScreen.addEventListener('pointerdown', e => { if(controls === 'touch' && cur === 'game' && G.state === 'play' && G.id === 'snake') swipe = { id:e.pointerId, x:e.clientX, y:e.clientY }; }, { signal });
  gameScreen.addEventListener('pointermove', e => {
    if(!swipe || e.pointerId !== swipe.id) return;
    const d = swipeDir(e.clientX - swipe.x, e.clientY - swipe.y);
    if(d){ press(d); release(d); swipe.x = e.clientX; swipe.y = e.clientY; }
  }, { signal });
  ['pointerup', 'pointercancel'].forEach(t => gameScreen.addEventListener(t, () => { swipe = null; }, { signal }));
  $('#skL').addEventListener('click', () => press('select'), { signal });
  $('#skC').addEventListener('click', () => press('share'), { signal });
  $('#skR').addEventListener('click', () => press('back'), { signal });

  /* ---------- boot ---------- */
  (async function boot(){
    $('#barMute').hidden = !sound.isMuted();
    show('login'); wake();
    $('#loginMsg').textContent = 'Checking session...';
    const r = await api('/auth/me');
    if(signal.aborted) return;
    if(r.ok && r.data.user && cur === 'login'){ user = { name:r.data.user.name, guest:false }; syncTheme(r.data.user.theme); flushPending(); show('menu'); }
    else if(cur === 'login') $('#loginMsg').textContent = r.status === 0 ? 'No connection. You can still play as a guest.'
      : r.ok && r.data.unavailable ? 'Server unavailable. You can still play as a guest.' : 'Log in, or make a new player.';
  })();

  return () => {
    ac.abort();
    cancelAnimationFrame(G.raf);
    clearTimeout(litTimer);
    sound.close(); clearTimeout(toastT);
  };
}
