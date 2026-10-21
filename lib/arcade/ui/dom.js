/* Tiny element builder for the touch screens. Text always goes in as text (never HTML), so a player name
   from the server can't inject markup. `html:` is only for our own static icon strings. */
export function h(tag, props, ...kids){
  const el = document.createElement(tag);
  for(const [k, v] of Object.entries(props || {})){
    if(v === false || v === null || v === undefined) continue;
    if(k === 'class') el.className = v;
    else if(k === 'text') el.textContent = v;
    else if(k === 'html') el.innerHTML = v;
    else if(k === 'style') el.style.cssText = v;
    else if(k.length > 2 && k.startsWith('on')) el.addEventListener(k.slice(2).toLowerCase(), v);
    else el.setAttribute(k, v === true ? '' : String(v));
  }
  for(const kid of kids.flat(Infinity)){
    if(kid === null || kid === undefined || kid === false) continue;
    el.append(kid.nodeType ? kid : document.createTextNode(String(kid)));
  }
  return el;
}
export const clear = el => { el.replaceChildren(); return el; };
