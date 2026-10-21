/* Soccer League season logic: six clubs, round robin, no DOM. Club 0 is the player. */
export const CLUBS = ['Demlinks', 'Rovers', 'Albion', 'United', 'City', 'Athletic'];
export const CLUB_LVL = [0, 2, 3, 5, 6, 8]; // computer level of each club (index 0 is you)
export const ROUNDS = (() => {
  let a = [0, 1, 2, 3, 4, 5]; const out = [];
  for(let r = 0; r < 5; r++){ out.push([[a[0], a[5]], [a[1], a[4]], [a[2], a[3]]]); a = [a[0], a[5], a[1], a[2], a[3], a[4]]; }
  return out;
})();
export const ORD = ['', '1st', '2nd', '3rd', '4th', '5th', '6th'];
export const newLeague = () => ({ round:0, rows:CLUBS.map(() => ({ p:0, w:0, d:0, l:0, gf:0, ga:0, pts:0 })) });
export const poisson = l => { let k = 0, p = 1; const e = Math.exp(-l); do { k++; p *= Math.random(); } while(p > e); return k - 1; };
export function tally(L, a, b, ga, gb){
  const A = L.rows[a], B = L.rows[b]; A.p++; B.p++; A.gf += ga; A.ga += gb; B.gf += gb; B.ga += ga;
  if(ga > gb){ A.w++; A.pts += 3; B.l++; } else if(ga < gb){ B.w++; B.pts += 3; A.l++; } else { A.d++; B.d++; A.pts++; B.pts++; }
}
export const standings = L => L.rows.map((r, i) => ({ i, ...r, gd:r.gf - r.ga })).sort((a, b) => b.pts - a.pts || b.gd - a.gd || b.gf - a.gf || a.i - b.i);
export const leagueOpp = L => { const m = ROUNDS[L.round].find(x => x[0] === 0 || x[1] === 0); return m[0] === 0 ? m[1] : m[0]; };
export function leagueRecord(L, gf, ga){
  const opp = leagueOpp(L);
  for(const [a, b] of ROUNDS[L.round]){
    if(a === 0 || b === 0) tally(L, 0, opp, gf, ga);
    else tally(L, a, b, poisson(Math.max(.4, 1.3 + .12 * (CLUB_LVL[a] - CLUB_LVL[b]))), poisson(Math.max(.4, 1.3 + .12 * (CLUB_LVL[b] - CLUB_LVL[a]))));
  }
  L.round++;
}
