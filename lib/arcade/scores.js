/* One row per player: their single highest score. Extra (lower) scores are kept in storage but never shown.
   Ties keep the earlier one. Input rows are { name, score, at? }. Pure, so it is unit-tested. */
export function bestPerPlayer(list){
  const best = new Map();
  for(const r of list || []){
    const k = String(r.name).toLowerCase(), cur = best.get(k);
    if(!cur || r.score > cur.score || (r.score === cur.score && (r.at || 0) < (cur.at || 0))) best.set(k, r);
  }
  return [...best.values()].sort((a, b) => b.score - a.score || (a.at || 0) - (b.at || 0));
}
