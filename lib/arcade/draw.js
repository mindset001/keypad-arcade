/* Shared pixel-drawing helpers. INK must match --ink in globals.css. */
export const INK = '#22301b';
export const HEART = ['01010','11111','01110','00100'];
export const pad = (n, w) => String(n).padStart(w, '0');
/* blit('1'/'0' rows, x, y): paints the 1s with the current fillStyle */
export const makeBlit = ctx => (mask, x, y) => {
  for(let r = 0; r < mask.length; r++) for(let c = 0; c < mask[r].length; c++) if(mask[r][c] === '1') ctx.fillRect(x + c, y + r, 1, 1);
};
