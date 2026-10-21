import { route, body, json, HttpError } from '@/lib/api';
import League from '@/models/League';

const COUNT = 6; // clubs in the table
const int = (v, max) => Number.isInteger(v) && v >= 0 && v <= max;

export const GET = route(async (request, session) => {
  const doc = await League.findOne({ user:session.id }).select('round rows -_id').lean();
  return json({ league:doc || null });
}, { auth:true });

/* PUT { round, rows } -> saves this player's season. The browser plays and simulates the
   matches, so the server only checks the shape and bounds. */
export const PUT = route(async (request, session) => {
  const { round, rows } = await body(request);
  const ok = int(round, 5) && Array.isArray(rows) && rows.length === COUNT &&
    rows.every(r => r && ['p', 'w', 'd', 'l', 'gf', 'ga'].every(k => int(r[k], 200)) && int(r.pts, 600));
  if(!ok) throw new HttpError(400, 'Bad league data.');
  const clean = rows.map(({ p, w, d, l, gf, ga, pts }) => ({ p, w, d, l, gf, ga, pts }));
  await League.findOneAndUpdate({ user:session.id }, { round, rows:clean }, { upsert:true, runValidators:true });
  return json({ ok:true });
}, { auth:true });
