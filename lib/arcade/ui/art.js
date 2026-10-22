/* Pixel art for the game cards (drawn in the LCD's ink colour via currentColor). */
const SVG = body => `<svg viewBox="0 0 48 32" shape-rendering="crispEdges" aria-hidden="true">${body}</svg>`;
export const ART = {
  snake:  SVG('<path fill="currentColor" d="M4 20h24v4H4zM24 8h4v16h-4zM24 8h16v4H24zM36 8h4v4h-4z"/><path fill="#b13a4c" d="M42 20h4v4h-4z"/><path fill="#c8e093" d="M37 9h1v1h-1z"/>'),
  roll:   SVG('<path fill="currentColor" d="M0 0h48v3H0z"/><path fill="currentColor" d="M3 14h16v2H3zM28 22h16v2H28zM10 28h14v2H10z"/><path fill="#a8631a" d="M20 5h6v1h2v4h-2v1h-6v-1h-2V6h2z"/>'),
  bounce: SVG('<path fill="currentColor" d="M0 26h48v6H0zM30 18h3v1h2v2h-2v1h-3v-1h-2v-2h2z"/><path fill="currentColor" d="M8 21h2v1h2v4H6v-4h2zM14 23h2v3h-2z"/><path fill="#b13a4c" d="M18 6h8v2h2v2h2v6h-2v2h-2v2h-8v-2h-2v-2h-2v-6h2V8h2z"/><path fill="#ffd0d7" d="M19 9h3v3h-3z"/>'),
  soccer: SVG('<path fill="currentColor" d="M2 2h44v1H2zM2 29h44v1H2zM2 2h1v28H2zM45 2h1v28h-1zM23 2h2v28h-2zM2 11h8v1H2zM2 20h8v1H2zM9 11h1v10H9zM38 11h8v1h-8zM38 20h8v1h-8zM38 11h1v10h-1z"/><path fill="currentColor" d="M12 13h3v3h-3zM12 20h3v3h-3zM18 16h3v3h-3zM30 10h3v3h-3zM33 20h3v3h-3z"/><path fill="#2f6b4f" d="M26 15h1v3h-1zM25 16h3v1h-3z"/>')
};
ART.tennis = SVG('<path fill="currentColor" d="M2 3h44v1H2zM2 28h44v1H2zM23 5h2v2h-2zM23 10h2v2h-2zM23 15h2v2h-2zM23 20h2v2h-2zM23 25h2v2h-2zM6 11h2v10H6zM40 9h2v10h-2z"/><path fill="#b13a4c" d="M29 14h3v3h-3z"/>');
export const TAGLINES = {
  snake:  'Eat. Grow. Do not crash.',
  roll:   'Keep falling, keep living.',
  bounce: 'The ball that never stops.',
  soccer: 'Five a side. Walls stay in.',
  tennis: 'First to 7. Beat the CPU.'
};
