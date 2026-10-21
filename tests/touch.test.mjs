import test from 'node:test';
import assert from 'node:assert/strict';
import { CONTROL_MODES, defaultControls, schemeFor, stickDirs, swipeDir } from '../lib/arcade/touch.js';

test('first-visit default: touch on phones/tablets, keypad on computers', () => {
  assert.equal(defaultControls({ coarse:true, width:390 }), 'touch');
  assert.equal(defaultControls({ coarse:true, width:820 }), 'touch');
  assert.equal(defaultControls({ coarse:false, width:1280 }), 'keypad');
  assert.equal(defaultControls({ coarse:false, width:390 }), 'keypad', 'a narrow desktop window is still a computer');
  assert.equal(defaultControls({ coarse:true, width:1400 }), 'keypad', 'a big touch laptop screen keeps the keypad');
  assert.equal(defaultControls(), 'keypad');
  assert.deepEqual(CONTROL_MODES, ['keypad', 'touch']);
});

test('control scheme follows the screen and the game state', () => {
  assert.equal(schemeFor('login'), 'none'); assert.equal(schemeFor(null), 'none');
  for(const s of ['menu', 'opts', 'scores', 'help', 'league']) assert.equal(schemeFor(s, 'snake', 'play'), 'menu', s);
  for(const g of ['snake', 'roll', 'bounce', 'soccer']) assert.equal(schemeFor('game', g, 'play'), g);
  assert.equal(schemeFor('game', 'bounce', 'paused'), 'paused');
  assert.equal(schemeFor('game', 'soccer', 'over'), 'over');
  assert.equal(schemeFor('game', 'unknown', 'play'), 'menu');
});

test('joystick: dead zone, four directions and diagonals', () => {
  const R = 100;
  assert.deepEqual(stickDirs(0, 0, R), []);
  assert.deepEqual(stickDirs(20, -20, R), [], 'a light touch near the centre holds nothing');
  assert.deepEqual(stickDirs(90, 0, R), ['right']);
  assert.deepEqual(stickDirs(-90, 0, R), ['left']);
  assert.deepEqual(stickDirs(0, -90, R), ['up']);
  assert.deepEqual(stickDirs(0, 90, R), ['down']);
  assert.deepEqual(stickDirs(70, -70, R).sort(), ['right', 'up']);
  assert.deepEqual(stickDirs(-70, 70, R).sort(), ['down', 'left']);
  assert.deepEqual(stickDirs(90, 20, R), ['right'], 'mostly sideways with a little drift is just "right"');
  assert.deepEqual(stickDirs(10, 10, 0), [], 'a zero radius never divides by zero');
  assert.deepEqual(stickDirs(500, 0, R), ['right'], 'dragging far outside the ring still works');
});

test('swipe: needs a minimum distance, then the larger axis wins', () => {
  assert.equal(swipeDir(10, 5), null);
  assert.equal(swipeDir(0, 0), null);
  assert.equal(swipeDir(30, 4), 'right'); assert.equal(swipeDir(-30, 4), 'left');
  assert.equal(swipeDir(4, -30), 'up'); assert.equal(swipeDir(4, 30), 'down');
  assert.equal(swipeDir(30, 30), 'right', 'a perfect diagonal picks one direction, never none');
  assert.equal(swipeDir(40, -35, 50), null, 'custom threshold');
});

/* the pre-paint script and defaultControls() must make the same decision */
import { EARLY_SCRIPT } from '../lib/arcade/touch.js';
function runEarly({ stored = {}, coarse = false, width = 1280 } = {}){
  const el = { dataset:{} }, ls = { getItem: k => (k in stored ? JSON.stringify(stored[k]) : null) };
  new Function('document', 'localStorage', 'matchMedia', 'innerWidth', EARLY_SCRIPT)({ currentScript:{ parentElement:el } }, ls, () => ({ matches:coarse }), width);
  return el.dataset;
}

test('early script: agrees with defaultControls for every device shape', () => {
  for(const coarse of [true, false]) for(const width of [320, 390, 820, 900, 901, 1280, 1920])
    assert.equal(runEarly({ coarse, width }).controls, defaultControls({ coarse, width }), `coarse=${coarse} width=${width}`);
});

test('early script: a saved choice wins; colour is applied; junk is ignored', () => {
  assert.equal(runEarly({ stored:{ ka_controls:'keypad' }, coarse:true, width:390 }).controls, 'keypad');
  assert.equal(runEarly({ stored:{ ka_controls:'touch' }, coarse:false, width:1920 }).controls, 'touch');
  assert.equal(runEarly({ stored:{ ka_controls:'hologram' }, coarse:true, width:390 }).controls, 'touch', 'an unknown saved value falls back to the device default');
  assert.equal(runEarly({ stored:{ ka_theme:'red' } }).theme, 'red');
  assert.equal(runEarly({ stored:{ ka_theme:'<script>' } }).theme, undefined, 'only the four known colours are ever applied');
  assert.doesNotThrow(() => new Function('document', 'localStorage', 'matchMedia', 'innerWidth', EARLY_SCRIPT)({ currentScript:{ parentElement:{ dataset:{} } } }, { getItem(){ throw new Error('blocked'); } }, () => ({ matches:false }), 1280), 'blocked storage (private mode) must not break the page');
});
