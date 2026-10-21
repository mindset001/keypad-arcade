import { route, body, json, HttpError } from '@/lib/api';
import Score, { GAME_IDS } from '@/models/Score';

const MAX_SCORE = 1_000_000, KEEP_PER_PLAYER = 50;

const gameOf = v => { if(!GAME_IDS.includes(v)) throw new HttpError(400, 'Unknown game.'); return v; };

/* GET /api/scores?game=snake[&mine=1] -> top 10 (everyone, or just the signed-in player) + their best */
export const GET = route(async (request, session) => {
  const q = request.nextUrl.searchParams, game = gameOf(q.get('game'));
  const filter = { game };
  if(q.get('mine') === '1'){ if(!session) throw new HttpError(401, 'Log in first.'); filter.user = session.id; }
  const rows = await Score.find(filter).sort({ score:-1, createdAt:1 }).limit(10).select('name score -_id').lean();
  const top = session ? await Score.findOne({ game, user:session.id }).sort({ score:-1 }).select('score').lean() : null;
  return json({ scores:rows, best:top ? top.score : 0 });
});

/* POST { game, score } -> { isNew, best }. Scores are reported by the browser, so this is a
   friendly leaderboard, not a tamper-proof one: values are only range-checked. */
export const POST = route(async (request, session) => {
  const b = await body(request), game = gameOf(b.game), score = b.score;
  if(!Number.isInteger(score) || score < 1 || score > MAX_SCORE) throw new HttpError(400, 'Bad score.');
  const prev = await Score.findOne({ game, user:session.id }).sort({ score:-1 }).select('score').lean();
  await Score.create({ user:session.id, name:session.name, game, score });
  const old = await Score.find({ game, user:session.id }).sort({ score:-1, createdAt:1 }).skip(KEEP_PER_PLAYER).select('_id').lean();
  if(old.length) await Score.deleteMany({ _id:{ $in:old.map(d => d._id) } });
  const before = prev ? prev.score : 0;
  return json({ isNew:score > before, best:Math.max(before, score) }, 201);
}, { auth:true });
