/* 24px line icons (Material-style: 2px round strokes). icon(name) returns an <svg> element. */
const S = body => `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false">${body}</svg>`;
const PATHS = {
  back:     '<path d="M15 5l-7 7 7 7"/>',
  close:    '<path d="M6 6l12 12M18 6L6 18"/>',
  chevR:    '<path d="M9 5l7 7-7 7"/>',
  chevL:    '<path d="M15 5l-7 7 7 7"/>',
  chevU:    '<path d="M5 15l7-7 7 7"/>',
  chevD:    '<path d="M5 9l7 7 7-7"/>',
  plus:     '<path d="M12 5v14M5 12h14"/>',
  minus:    '<path d="M5 12h14"/>',
  check:    '<path d="M5 12.5l4.5 4.5L19 7"/>',
  volume:   '<path d="M4 9v6h4l5 4V5L8 9H4z"/><path d="M16.5 8.5a5 5 0 010 7M19 6a8.5 8.5 0 010 12"/>',
  mute:     '<path d="M4 9v6h4l5 4V5L8 9H4z"/><path d="M17 9l5 6M22 9l-5 6"/>',
  tune:     '<path d="M4 7h9M17 7h3M4 17h3M11 17h9"/><circle cx="15" cy="7" r="2"/><circle cx="9" cy="17" r="2"/>',
  trophy:   '<path d="M8 4h8v5a4 4 0 01-8 0V4z"/><path d="M8 6H5a3 3 0 003.5 4M16 6h3a3 3 0 01-3.5 4M12 13v4M8 20h8M10 17h4"/>',
  help:     '<circle cx="12" cy="12" r="9"/><path d="M9.5 9.5a2.5 2.5 0 114 2c-.9.6-1.5 1.1-1.5 2.2M12 17h.01"/>',
  play:     '<path d="M8 5l11 7-11 7V5z" fill="currentColor"/>',
  pause:    '<path d="M8.5 5v14M15.5 5v14" stroke-width="3"/>',
  share:    '<circle cx="6" cy="12" r="2.5"/><circle cx="17.5" cy="6" r="2.5"/><circle cx="17.5" cy="18" r="2.5"/><path d="M8.2 10.8l7-3.6M8.2 13.2l7 3.6"/>',
  person:   '<circle cx="12" cy="8" r="4"/><path d="M4 20a8 8 0 0116 0"/>',
  logout:   '<path d="M10 4H5v16h5M15 8l4 4-4 4M19 12H9"/>',
  eye:      '<path d="M2 12s3.6-7 10-7 10 7 10 7-3.6 7-10 7S2 12 2 12z"/><circle cx="12" cy="12" r="3"/>',
  eyeOff:   '<path d="M2 12s3.6-7 10-7 10 7 10 7-3.6 7-10 7S2 12 2 12z"/><circle cx="12" cy="12" r="3"/><path d="M4 4l16 16"/>',
  replay:   '<path d="M4 4v6h6"/><path d="M5.6 15a8 8 0 100-6"/>',
  table:    '<rect x="4" y="5" width="16" height="14" rx="2"/><path d="M4 10h16M10 10v9"/>',
  ball:     '<circle cx="12" cy="12" r="9"/><path d="M12 7l4 3-1.5 5h-5L8 10l4-3z"/>',
  swipe:    '<path d="M9 11V6a1.5 1.5 0 013 0v5M12 10V8.5a1.5 1.5 0 013 0V12M15 11a1.5 1.5 0 013 0v4a6 6 0 01-6 6h-1a6 6 0 01-5-3l-2-3.5a1.5 1.5 0 012.5-1.5L9 15v-4"/>',
  keypad:   '<rect x="6" y="3" width="12" height="18" rx="3"/><path d="M9.5 8h5M9 12h.01M12 12h.01M15 12h.01M9 15.5h.01M12 15.5h.01M15 15.5h.01"/>',
  touch:    '<rect x="5" y="3" width="14" height="18" rx="3"/><path d="M5 14h14M9 17.5h.01M15 17.5h.01"/>',
  jumpHi:   '<path d="M6 14l6-6 6 6"/><path d="M6 19l6-6 6 6"/>',
  jumpLo:   '<path d="M6 10l6 6 6-6"/>'
};
export function icon(name){
  const t = document.createElement('template');
  t.innerHTML = S(PATHS[name] || '');
  return t.content.firstChild;
}
export const hasIcon = name => name in PATHS;
