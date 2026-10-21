/* Name and password rules, shared by the game (instant feedback) and the server (the real check),
   so the two can never disagree. Pure: no browser or server APIs except TextEncoder. */
export const NAME_RE = /^[A-Za-z0-9_]{2,12}$/;
export const RESERVED_NAMES = ['guest', 'admin', 'root', 'system', 'demlinks'];
export const PASSWORD_MIN = 6;
export const PASSWORD_MAX_BYTES = 72; // bcrypt only reads the first 72 bytes; anything longer would be silently cut
export const byteLength = s => new TextEncoder().encode(s).length;

/* each returns '' when fine, otherwise a message for the player */
export function nameError(name){
  const n = typeof name === 'string' ? name.trim() : '';
  if(!NAME_RE.test(n)) return 'Name: 2 to 12 letters, numbers or _.';
  if(RESERVED_NAMES.includes(n.toLowerCase())) return 'That name is reserved. Pick another.';
  return '';
}
export function passwordError(pw){
  if(typeof pw !== 'string' || pw.length < PASSWORD_MIN) return `Password needs ${PASSWORD_MIN} or more characters.`;
  if(byteLength(pw) > PASSWORD_MAX_BYTES) return 'Password is too long. Use 72 bytes or fewer.';
  return '';
}
