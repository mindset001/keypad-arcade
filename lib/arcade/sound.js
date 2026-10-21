/* Web Audio beeps. The mute flag is remembered in the store. */
export function createSound(store){
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
  return {
    sfx,
    isMuted: () => muted,
    setMuted(v){ muted = !!v; store.set('ka_muted', muted); },
    close(){ if(actx){ actx.close().catch(() => {}); actx = null; } }
  };
}
