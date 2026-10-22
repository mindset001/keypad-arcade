/* The touch app shell: everything in touch mode except the game screen itself (which is the same canvas,
   framed). Menus, options, scores, help, league, login and settings are real touch UI, not the pixel LCD.

   It owns no game rules or data: it asks the engine (the `app` object built in index.js) for scores, the
   league, preferences and sign-in, so touch and keypad modes always agree. */
import { h } from './dom.js';
import { icon } from './icons.js';
import { ART, TAGLINES } from './art.js';

const SWATCH = { violet:'#5560a8', blue:'#4a86d6', red:'#d64a5f', black:'#51545f' };

export function createTouchUI(app){
  const { bar, main, host } = app;
  let view = '', sheet = null, dialog = null, toastEl = null, toastTimer = 0, token = 0;
  let scoresState = { g:'snake', mine:false }, helpState = { g:'snake' };

  const guest = () => { const u = app.user(); return !u || u.guest; };
  const clickSound = () => app.sfx.click();

  /* ---------- small building blocks ---------- */
  const btn = (cls, kids, onclick, extra) => h('button', { type:'button', class:`ts-btn ${cls} ts-press`, onclick, ...(extra || {}) }, ...[].concat(kids));
  const row = (label, control) => h('div', { class:'ts-row' }, h('span', { class:'ts-row-label', text:label }), control);
  const segmented = (options, current, onChange) => {
    const el = h('div', { class:'ts-seg', role:'group' });
    options.forEach(([value, label, ic]) => el.append(h('button', {
      type:'button', class:'ts-seg-opt ts-press', 'aria-pressed':String(String(value) === String(current)), 'data-value':value,
      onclick: () => { el.querySelectorAll('.ts-seg-opt').forEach(b => b.setAttribute('aria-pressed', String(b.dataset.value === String(value)))); clickSound(); onChange(value); }
    }, ic ? icon(ic) : null, label)));
    return el;
  };
  const chips = (labels, current, onChange) => {
    const el = h('div', { class:'ts-chips', role:'group' });
    labels.forEach((label, i) => el.append(h('button', {
      type:'button', class:'ts-chip ts-press', 'aria-pressed':String(i === current),
      onclick: () => { el.querySelectorAll('.ts-chip').forEach((b, j) => b.setAttribute('aria-pressed', String(i === j))); clickSound(); onChange(i); }
    }, label)));
    return el;
  };
  const stepper = (valueEl, minus, plus) => h('div', { class:'ts-step' },
    h('button', { type:'button', class:'ts-step-btn ts-press', 'aria-label':'Lower', onclick: () => { clickSound(); minus(); } }, icon('minus')), valueEl,
    h('button', { type:'button', class:'ts-step-btn ts-press', 'aria-label':'Higher', onclick: () => { clickSound(); plus(); } }, icon('plus')));

  /* ---------- the app bar ---------- */
  function refreshSound(){
    bar.sound.replaceChildren(icon(app.muted() ? 'mute' : 'volume'));
    bar.sound.setAttribute('aria-label', app.muted() ? 'Sound is off. Turn on' : 'Sound is on. Turn off');
  }
  function chrome({ title, logo = false, back = false, pause = false, settings = true, sound = true }){
    bar.title.textContent = title; bar.logo.hidden = !logo;
    bar.back.hidden = !back; bar.pause.hidden = !pause; bar.settings.hidden = !settings; bar.sound.hidden = !sound;
    refreshSound();
  }

  /* ---------- sheets, dialogs, toast ---------- */
  function closeSheet(){
    if(!sheet) return; const s = sheet; sheet = null;
    s.scrim.classList.add('out'); s.el.classList.add('out');
    setTimeout(() => { s.scrim.remove(); s.el.remove(); }, 190);
  }
  function openSheet(label, ...content){
    if(sheet){ sheet.scrim.remove(); sheet.el.remove(); sheet = null; }
    const scrim = h('div', { class:'ts-scrim', onclick: () => closeSheet() });
    const el = h('div', { class:'ts-sheet', role:'dialog', 'aria-modal':'true', 'aria-label':label, tabindex:'-1' }, h('div', { class:'ts-grab', 'aria-hidden':'true' }), ...content);
    host.append(scrim, el); sheet = { scrim, el }; el.focus({ preventScroll:true });
    return el;
  }
  const sheetHead = (title, sub, artKey) => h('div', { class:'ts-sheet-head' },
    artKey ? h('div', { class:'ts-art ts-art-sm', html:ART[artKey] }) : null,
    h('div', { class:'ts-sheet-titles' }, h('h2', { text:title }), sub ? h('p', { text:sub }) : null),
    h('button', { type:'button', class:'ts-ib ts-press', 'aria-label':'Close', onclick: () => closeSheet() }, icon('close')));

  function toast(msg){
    clearTimeout(toastTimer); toastEl && toastEl.remove();
    toastEl = h('div', { class:'ts-toast', role:'status', text:msg }); host.append(toastEl);
    toastTimer = setTimeout(() => { toastEl && toastEl.remove(); toastEl = null; }, 2200);
  }

  /* pause and game-over: real dialogs over the game (the LCD's own pixel banner is hidden in touch mode) */
  function removeDialog(){ if(dialog){ dialog.scrim.remove(); dialog.el.remove(); dialog = null; } }
  function syncDialog(s){
    const kind = s.cur === 'game' && (s.scheme === 'paused' || s.scheme === 'over') ? s.scheme : '';
    if(!kind){ removeDialog(); return; }
    const lines = kind === 'over' ? (s.ov.text || '').split('\n').filter(Boolean) : [];
    const sig = [kind, s.ov.title, lines.join('|'), s.soft.l, s.soft.c, s.soft.r].join('~');
    if(dialog && dialog.sig === sig) return;           // nothing changed: keep focus and animation
    removeDialog();
    const scrim = h('div', { class:'ts-scrim ts-scrim-dim' });
    const body = kind === 'paused'
      ? [h('h2', { class:'ts-dlg-title', text:'Paused' }), h('p', { class:'ts-dlg-sub', text:app.GAMES[s.gameId] }),
         h('div', { class:'ts-dlg-actions' }, btn('ts-btn-primary', [icon('play'), 'Resume'], () => app.press('select'), { 'data-act':'resume' }), btn('ts-btn-tonal', [icon('home'), 'Quit'], () => app.press('back'), { 'data-act':'quit' }))]
      : [h('h2', { class:'ts-dlg-title', text:s.ov.title || 'Game over' }),
         h('div', { class:'ts-dlg-lines' }, lines.map(l => h('p', { text:l }))),
         h('div', { class:'ts-dlg-actions' },
           btn('ts-btn-primary', [icon('replay'), s.soft.l || 'OK'], () => app.press('select'), { 'data-act':'again' }),
           s.soft.c === 'Share' ? btn('ts-btn-tonal', [icon('share'), 'Share'], () => app.press('share'), { 'data-act':'share' }) : null,
           s.soft.r ? btn('ts-btn-text', s.soft.r, () => app.press('back'), { 'data-act':'menu' }) : null)];
    const el = h('div', { class:`ts-dialog ts-dialog-${kind}`, role:'dialog', 'aria-modal':'true', 'aria-label':kind === 'paused' ? 'Paused' : 'Game over' }, ...body);
    host.append(scrim, el); dialog = { scrim, el, sig };
    const first = el.querySelector('button'); first && first.focus({ preventScroll:true });
  }

  /* ---------- HOME ---------- */
  function homeView(){
    chrome({ title:'Keypad Arcade', logo:true });
    const u = app.user();
    const hello = h('div', { class:'ts-hello' },
      h('div', { class:'ts-avatar', 'aria-hidden':'true', text: guest() ? '?' : u.name[0].toUpperCase() }),
      h('div', { class:'ts-hello-text' },
        h('p', { class:'ts-hi', text: guest() ? 'Playing as guest' : `Hi, ${u.name}` }),
        h('p', { class:'ts-sub', text: guest() ? 'Scores stay on this device' : 'Your scores are saved to your account' })),
      guest() ? btn('ts-chip', [icon('person'), 'Sign in'], () => app.go('login'), { 'data-act':'signin' }) : null);
    const cards = app.GAME_IDS.map(g => h('button', { type:'button', class:'ts-card ts-press', 'data-g':g, onclick: () => openGameSheet(g) },
      h('div', { class:'ts-art', html:ART[g] }),
      h('div', { class:'ts-card-body' }, h('b', { text:app.GAMES[g] }), h('small', { text:TAGLINES[g] })),
      h('span', { class:'ts-best', 'data-best':g, text:' ' })));
    main.replaceChildren(h('section', { class:'ts-view ts-home' },
      hello,
      h('h2', { class:'ts-h', text:'Games' }),
      h('div', { class:'ts-grid' }, cards),
      h('div', { class:'ts-quick' },
        btn('ts-btn-tonal', [icon('trophy'), 'High scores'], () => app.go('scores'), { 'data-act':'scores' }),
        btn('ts-btn-tonal', [icon('help'), 'How to play'], () => app.go('help'), { 'data-act':'help' })),
      row('Controls', segmented(app.CONTROL_MODES.map(m => [m, app.CONTROL_NAMES[m], m]), app.controls(), m => app.setControls(m))),
      h('p', { class:'ts-foot', text:'Made by Demlinks' })));
    const mine = ++token;
    Promise.all(app.GAME_IDS.map(g => app.scoreData(g, false).then(d => [g, d.best || 0]))).then(all => {
      if(mine !== token || view !== 'menu') return;
      for(const [g, best] of all){ const el = main.querySelector(`[data-best="${g}"]`); if(el){ el.textContent = best > 0 ? `Best ${best}` : 'No score yet'; el.classList.toggle('has', best > 0); } }
    });
  }

  /* ---------- GAME OPTIONS (bottom sheet) ---------- */
  function openGameSheet(g){
    const p = app.prefsFor(g), maxLevel = g === 'bounce' ? app.BOUNCE_LEVELS : 9;
    const levelVal = h('b', { class:'ts-step-val', text:String(p.level) });
    const setLevel = d => { p.level = (p.level - 1 + d + maxLevel) % maxLevel + 1; levelVal.textContent = String(p.level); app.savePrefs(g, p); };
    const play = btn('ts-btn-primary ts-btn-lg', [icon('play'), 'Play'], () => { closeSheet(); app.play(g, p); }, { 'data-act':'play' });
    const label = () => { play.replaceChildren(icon(g === 'soccer' && p.mode ? 'table' : 'play'), g === 'soccer' && p.mode ? 'Open the league' : 'Play'); };
    const rows = [row(g === 'bounce' ? 'Start level' : 'Level', stepper(levelVal, () => setLevel(-1), () => setLevel(1)))];
    if(g === 'soccer') rows.push(row('Mode', segmented([['0', 'Quick match'], ['1', 'League']], String(p.mode || 0), v => { p.mode = Number(v); app.savePrefs(g, p); label(); })));
    if(g === 'snake') rows.push(h('div', { class:'ts-row ts-row-stack' }, h('span', { class:'ts-row-label', text:'Maze' }), chips(app.MAZES, p.maze || 0, i => { p.maze = i; app.savePrefs(g, p); })));
    label();
    openSheet(app.GAMES[g],
      sheetHead(app.GAMES[g], TAGLINES[g], g),
      h('div', { class:'ts-rows' }, ...rows),
      play,
      g === 'tennis' || g === 'soccer' ? btn('ts-btn-tonal', [icon('person'), 'Play a friend online'], () => { closeSheet(); app.openOnline(g); }, { 'data-act':'online' }) : null,
      h('div', { class:'ts-quick' },
        btn('ts-btn-tonal', [icon('trophy'), 'High scores'], () => { closeSheet(); app.go('scores', g); }),
        btn('ts-btn-tonal', [icon('help'), 'How to play'], () => { closeSheet(); app.go('help', g); })));
  }

  /* ---------- SCORES ---------- */
  function scoresView(g){
    if(g) scoresState.g = g; else if(!scoresState.g) scoresState.g = 'snake';
    scoresState.mine = false;
    chrome({ title:'High scores', back:true });
    renderScores();
  }
  function renderScores(){
    const { g, mine } = scoresState, mineToken = ++token;
    const body = h('div', { class:'ts-scores-body' }, h('div', { class:'ts-skel' }), h('div', { class:'ts-skel' }), h('div', { class:'ts-skel' }));
    main.replaceChildren(h('section', { class:'ts-view' },
      chips(app.GAME_IDS.map(x => app.GAMES[x]), app.GAME_IDS.indexOf(g), i => { scoresState.g = app.GAME_IDS[i]; renderScores(); }),
      segmented([['all', 'Everyone', 'trophy'], ['mine', 'Just me', 'person']], mine ? 'mine' : 'all', v => { scoresState.mine = v === 'mine'; renderScores(); }),
      body));
    app.scoreData(g, mine).then(d => {
      if(mineToken !== token || view !== 'scores') return;
      const rows = (d.list || []).slice(0, 10);
      body.replaceChildren(
        h('div', { class:'ts-bestcard' }, h('span', { text:'Your best' }), h('b', { text:String(d.best || 0) })),
        rows.length ? h('ol', { class:'ts-rank' }, rows.map((r, i) => h('li', { class:i < 3 ? `top${i + 1}` : '' }, h('span', { class:'ts-pos', text:String(i + 1) }), h('span', { class:'ts-name', text:r.name }), h('b', { class:'ts-pts', text:String(r.score) }))))
                    : h('p', { class:'ts-empty', text: d.list ? (mine ? 'You have no scores here yet.' : 'No scores yet. Set the first one!') : (d.note || '') }),
        d.list && d.note ? h('p', { class:'ts-note', text:d.note }) : null);
    });
  }

  /* ---------- HOW TO PLAY ---------- */
  function helpView(g){
    if(g) helpState.g = g;
    chrome({ title:'How to play', back:true });
    const draw = () => {
      main.replaceChildren(h('section', { class:'ts-view' },
        chips(app.GAME_IDS.map(x => app.GAMES[x]), app.GAME_IDS.indexOf(helpState.g), i => { helpState.g = app.GAME_IDS[i]; draw(); }),
        h('div', { class:'ts-help' },
          h('div', { class:'ts-art', html:ART[helpState.g] }),
          h('h2', { text:app.GAMES[helpState.g] }),
          h('ul', {}, app.HELP[helpState.g].map(t => h('li', { text:t }))))));
    };
    draw();
  }

  /* ---------- LEAGUE ---------- */
  function leagueView(){
    chrome({ title:'Soccer League', back:true });
    const mine = ++token;
    const draw = ready => {
      const s = app.league.snapshot();
      main.replaceChildren(h('section', { class:'ts-view' },
        h('div', { class:'ts-fixture' },
          h('p', { class:'ts-fx-round', text: s.over ? 'Season complete' : `Round ${s.round + 1} of 5` }),
          h('p', { class:'ts-fx-teams', text: s.over ? (s.pos === 1 ? 'Champions!' : `Finished ${app.ORD[s.pos]}`) : `Demlinks  vs  ${s.oppName}` }),
          btn('ts-btn-primary ts-btn-lg', [icon(s.over ? 'replay' : 'play'), s.over ? 'New season' : 'Play the match'],
            () => { if(!ready) return; clickSound(); if(s.over){ app.league.reset(); draw(true); } else app.league.play(); },
            { 'data-act':'league-play', disabled:!ready })),
        h('div', { class:'ts-table', role:'table', 'aria-label':'League table' },
          h('div', { class:'ts-tr ts-th', role:'row' }, h('span', { text:'#' }), h('span', { text:'Club' }), h('span', { text:'P' }), h('span', { text:'GD' }), h('span', { text:'Pts' })),
          s.st.map((r, k) => h('div', { class:`ts-tr${r.i === 0 ? ' me' : ''}`, role:'row' },
            h('span', { text:String(k + 1) }), h('span', { class:'ts-club', text:app.CLUBS[r.i] }), h('span', { text:String(r.p) }), h('span', { text:`${r.gd > 0 ? '+' : ''}${r.gd}` }), h('b', { text:String(r.pts) }))))));
    };
    draw(guest());
    if(!guest()) app.league.sync().then(() => { if(mine === token && view === 'league') draw(true); });
  }

  /* ---------- LOGIN ---------- */
  function loginView(){
    chrome({ title:'Welcome', logo:true, settings:true });
    let shown = false, busy = false;
    const msg = h('p', { class:'ts-error', role:'status', 'aria-live':'polite', text:'' });
    const name = h('input', { id:'tsUser', class:'ts-input', placeholder:' ', maxlength:'12', autocomplete:'username', autocapitalize:'off', spellcheck:'false', 'aria-label':'Player name' });
    const pass = h('input', { id:'tsPass', class:'ts-input', type:'password', placeholder:' ', maxlength:'72', autocomplete:'current-password', 'aria-label':'Password' });
    const eye = h('button', { type:'button', class:'ts-ib ts-press ts-eye', 'aria-pressed':'false', 'aria-label':'Show password', onclick: () => {
      shown = !shown; pass.type = shown ? 'text' : 'password'; eye.setAttribute('aria-pressed', String(shown)); eye.setAttribute('aria-label', shown ? 'Hide password' : 'Show password'); eye.replaceChildren(icon(shown ? 'eyeOff' : 'eye'));
    } }, icon('eye'));
    const submit = async kind => {
      if(busy) return; busy = true; msg.textContent = 'Connecting...'; msg.classList.remove('bad'); form.classList.add('busy');
      const r = await app.authRequest(kind, name.value.trim(), pass.value);
      busy = false; form.classList.remove('busy');
      if(r.ok) return;                                  // signed in: the engine has already moved to the home screen
      msg.textContent = r.msg || 'Something went wrong.'; msg.classList.add('bad'); form.classList.remove('shake'); void form.offsetWidth; form.classList.add('shake');
    };
    const field = (label, input, trailing) => h('label', { class:'ts-field' }, input, h('span', { class:'ts-field-label', text:label }), trailing);
    const form = h('form', { class:'ts-card-form', novalidate:true, onsubmit: e => { e.preventDefault(); submit('login'); } },
      field('Player name', name), field('Password', pass, eye), msg,
      h('div', { class:'ts-form-actions' },
        h('button', { type:'submit', class:'ts-btn ts-btn-primary ts-press', 'data-act':'login' }, 'Log in'),
        btn('ts-btn-tonal', 'Create player', () => submit('register'), { 'data-act':'register' })));
    main.replaceChildren(h('section', { class:'ts-view ts-login' },
      h('div', { class:'ts-login-hero' }, h('div', { class:'ts-logo-big', 'aria-hidden':'true', html:ART.snake }), h('h1', { text:'Keypad Arcade' }), h('p', { text:'Log in to keep your scores, or just play.' })),
      form,
      btn('ts-btn-text', 'Play as guest', () => app.guest(), { 'data-act':'guest' }),
      app.sessionNote() ? h('p', { class:'ts-note', text:app.sessionNote() }) : null));
  }

  /* ---------- SETTINGS (bottom sheet) ---------- */
  function openSettings(){
    const u = app.user();
    const swatches = h('div', { class:'ts-swatches', role:'group', 'aria-label':'Handset colour' }, app.THEMES.map(t => h('button', {
      type:'button', class:'ts-swatch ts-press', 'aria-pressed':String(app.theme() === t), 'aria-label':app.THEME_NAMES[t], 'data-theme-option':t, style:`--c:${SWATCH[t]}`,
      onclick: () => { clickSound(); app.setTheme(t); swatches.querySelectorAll('.ts-swatch').forEach(b => b.setAttribute('aria-pressed', String(b.dataset.themeOption === t))); }
    }, icon('check'), h('span', { text:app.THEME_NAMES[t] }))));
    const sw = h('button', { type:'button', class:'ts-switch ts-press', role:'switch', 'aria-checked':String(!app.muted()), 'aria-label':'Sound', onclick: () => { app.toggleMute(); sw.setAttribute('aria-checked', String(!app.muted())); refreshSound(); } }, h('i'));
    openSheet('Settings',
      h('div', { class:'ts-sheet-head' }, h('div', { class:'ts-sheet-titles' }, h('h2', { text:'Settings' })), h('button', { type:'button', class:'ts-ib ts-press', 'aria-label':'Close', onclick: () => closeSheet() }, icon('close'))),
      h('div', { class:'ts-rows' },
        h('div', { class:'ts-row ts-row-stack' }, h('span', { class:'ts-row-label', text:'Controls' }), segmented(app.CONTROL_MODES.map(m => [m, app.CONTROL_NAMES[m], m]), app.controls(), m => { app.setControls(m); })),
        h('div', { class:'ts-row ts-row-stack' }, h('span', { class:'ts-row-label', text:'Handset colour' }), swatches),
        row('Sound', sw),
        guest() ? null : h('div', { class:'ts-row' }, h('span', { class:'ts-row-label', text:`Signed in as ${u.name}` }))),
      btn('ts-btn-tonal', [icon(guest() ? 'person' : 'logout'), guest() ? 'Sign in or create a player' : 'Log out'], () => { closeSheet(); guest() ? app.go('login') : app.logout(); }, { 'data-act':'account' }));
  }

  /* ---------- wiring ---------- */
  const opt = { signal:app.signal }; // tied to the engine's cleanup, so a remount (React dev mode mounts twice) never leaves stale handlers behind
  bar.back.addEventListener('click', () => { clickSound(); back(); }, opt);
  bar.pause.addEventListener('click', () => app.press('pause'), opt);
  bar.sound.addEventListener('click', () => { app.toggleMute(); refreshSound(); }, opt);
  bar.settings.addEventListener('click', () => { clickSound(); openSettings(); }, opt);
  /* a soft ripple from where the finger lands, on anything marked .ts-press */
  app.root.addEventListener('pointerdown', e => {
    const t = e.target.closest && e.target.closest('.ts-press'); if(!t) return;
    const r = t.getBoundingClientRect(); t.style.setProperty('--rx', `${e.clientX - r.left}px`); t.style.setProperty('--ry', `${e.clientY - r.top}px`);
    t.classList.remove('rip'); void t.offsetWidth; t.classList.add('rip');
  }, { signal:app.signal });

  function enter(name, ...a){
    closeSheet(); removeDialog(); view = name;
    ({ login:loginView, menu:homeView, scores:scoresView, help:helpView, league:leagueView, opts:g => { homeView(); view = 'menu'; openGameSheet(g); } }[name] || homeView)(...a);
    main.scrollTop = 0;
  }
  /* the Android back gesture / Esc / the app bar arrow */
  function back(){
    if(sheet){ closeSheet(); return true; }
    const s = app.snapshot();
    if(s.cur === 'game'){ app.press(s.scheme === 'paused' ? 'select' : 'back'); return true; } // back on the Paused dialog dismisses it (= resume); mid-game it pauses; on game over it goes to the menu
    if(view === 'league'){ app.go('opts', 'soccer'); return true; }
    if(view === 'scores' || view === 'help'){ app.go('menu'); return true; }
    return false;
  }
  /* called whenever the screen or the game state changes */
  function sync(){
    const s = app.snapshot();
    if(s.cur === 'game') chrome({ title:app.GAMES[s.gameId] || '', back:true, pause:s.scheme !== 'paused' && s.scheme !== 'over', settings:false });
    syncDialog(s);
  }
  /* leaving touch mode: nothing from the touch app may be left behind to pop up again later */
  function dismiss(){ if(sheet){ sheet.scrim.remove(); sheet.el.remove(); sheet = null; } removeDialog(); clearTimeout(toastTimer); toastEl && toastEl.remove(); toastEl = null; }
  return { enter, back, sync, toast, dismiss, refreshSound, openSettings, isSheetOpen: () => !!sheet };
}
