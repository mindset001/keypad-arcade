/* Touch-mode logic that needs no DOM, so it can be unit-tested: which controls to show, how a joystick
   or a swipe turns into directions, and which mode a device starts in. */
export const CONTROL_MODES = ['keypad', 'touch'];
export const CONTROL_NAMES = { keypad:'Keypad', touch:'Touch' };

/* first visit only: phones and tablets start in touch mode, computers on the keypad (a saved choice always wins) */
export const defaultControls = ({ coarse = false, width = 1280 } = {}) => (coarse && width <= 900 ? 'touch' : 'keypad');

/* Which set of on-screen controls to show:
   'none' (login: the form needs the real keyboard) | 'menu' | 'snake' | 'roll' | 'bounce' | 'soccer' | 'tennis' | 'paused' | 'over' */
export function schemeFor(screen, gameId, gameState){
  if(screen === 'login' || !screen) return 'none';
  if(screen !== 'game') return 'menu';
  if(gameState === 'paused') return 'paused';
  if(gameState === 'over') return 'over';
  return ['snake', 'roll', 'bounce', 'soccer', 'tennis'].includes(gameId) ? gameId : 'menu';
}

/* A joystick offset (dx, dy from its centre, radius R) -> the directions held. Eight-way: a diagonal holds two.
   Inside the dead zone nothing is held, so a resting thumb doesn't drift the player. */
export function stickDirs(dx, dy, radius, dead = .38){
  const m = Math.hypot(dx, dy);
  if(!radius || m < radius * dead) return [];
  const out = [], x = dx / m, y = dy / m, cut = .38; // sin(22.5deg): each 45deg sector is split evenly
  if(x > cut) out.push('right'); else if(x < -cut) out.push('left');
  if(y > cut) out.push('down'); else if(y < -cut) out.push('up');
  return out;
}

/* A finger drag (dx, dy in pixels) -> one direction, once it has travelled `min` pixels; the larger axis wins. */
export function swipeDir(dx, dy, min = 24){
  const ax = Math.abs(dx), ay = Math.abs(dy);
  if(Math.max(ax, ay) < min) return null;
  return ax >= ay ? (dx > 0 ? 'right' : 'left') : (dy > 0 ? 'down' : 'up');
}

/* Runs inline in <head> BEFORE first paint (see app/layout.js; it sets data-controls / data-theme on <html>) so a phone never flashes the handset before
   switching to touch layout, and the saved colour is there from the first frame. Order: ?controls= in the link, then
   the saved choice, then the device default. It repeats defaultControls() on purpose (it must be self-contained
   text); tests/touch.test.mjs checks the two always agree. */
export const EARLY_SCRIPT = `(function(){try{
var d=document.documentElement,c=localStorage.getItem('ka_controls'),t=localStorage.getItem('ka_theme'),q=new URLSearchParams(location.search).get('controls');
c=c?JSON.parse(c):null;t=t?JSON.parse(t):null;
if(q==='keypad'||q==='touch'){c=q;}
if(c!=='keypad'&&c!=='touch'){c=(matchMedia('(pointer: coarse)').matches&&innerWidth<=900)?'touch':'keypad';}
d.dataset.controls=c;
if(t==='violet'||t==='blue'||t==='red'||t==='black'){d.dataset.theme=t;}
}catch(e){}})()`;
