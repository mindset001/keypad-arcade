/* Pure helpers for online rooms: the code alphabet (no 0/O/1/I/L), validation, and size limits. */
export const ROOM_GAMES = ['tennis', 'soccer'];
const ALPHABET = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
export const CODE_LEN = 4;
export const MAX_SDP = 16000;

export function makeCode(rand = Math.random){
  let s = ''; for(let i = 0; i < CODE_LEN; i++) s += ALPHABET[Math.floor(rand() * ALPHABET.length)];
  return s;
}
/* what a person typed -> a clean code, or '' if it cannot be one */
export function cleanCode(v){
  const s = String(v || '').toUpperCase().replace(/[^A-Z0-9]/g, '');
  return s.length === CODE_LEN && [...s].every(c => ALPHABET.includes(c)) ? s : '';
}
export const validSdp = v => typeof v === 'string' && v.length > 20 && v.length <= MAX_SDP && v.startsWith('v=0');
export const validName = v => typeof v === 'string' && /^[A-Za-z0-9_]{2,12}$/.test(v);
