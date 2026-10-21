/* Sharing a score. Pure helpers: the browser objects are passed in so tests can fake them. */
export const shareText = (gameName, score) => `I scored ${score} in ${gameName} on Keypad Arcade! Can you beat it?`;

/* Tries the phone's native share sheet, then the clipboard.
   Resolves to 'shared' | 'copied' | 'cancelled' | 'failed'. */
export async function share({ title = 'Keypad Arcade', text, url }, nav = globalThis.navigator){
  if(nav && typeof nav.share === 'function'){
    try{ await nav.share({ title, text, url }); return 'shared'; }
    catch(e){ if(e && e.name === 'AbortError') return 'cancelled'; /* otherwise fall through to copy */ }
  }
  try{
    if(nav && nav.clipboard && typeof nav.clipboard.writeText === 'function'){ await nav.clipboard.writeText(`${text} ${url}`); return 'copied'; }
  }catch(e){}
  return 'failed';
}
