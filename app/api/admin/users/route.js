import { NextResponse } from 'next/server';
import { route, json, HttpError } from '@/lib/api';
import { isAdmin } from '@/lib/admin-guard';
import { parseListQuery, escapeRegex, toCsv, CSV_LIMIT } from '@/lib/admin';
import User from '@/models/User';
import Score from '@/models/Score';

export const dynamic = 'force-dynamic';

const SORT = { newest:{ createdAt:-1 }, oldest:{ createdAt:1 }, name:{ nameLower:1 }, active:{ lastLoginAt:-1, createdAt:-1 } };
const FIELDS = 'name theme role createdAt lastLoginAt'; // explicit allow-list: passHash can never be selected here

/* per-player score totals for just these players (each player keeps at most 50 scores per game) */
async function scoreTotals(ids){
  const rows = await Score.aggregate([
    { $match:{ user:{ $in:ids } } },
    { $group:{ _id:'$user', count:{ $sum:1 }, best:{ $max:'$score' }, last:{ $max:'$createdAt' } } }
  ]);
  return new Map(rows.map(r => [String(r._id), r]));
}

/* GET /api/admin/users?q=&sort=newest|oldest|name|active&page=1&limit=25[&format=csv]
   Admins only. Everyone else (logged out or not an admin) gets the same plain 404 JSON. */
export const GET = route(async (request, session) => {
  if(!(await isAdmin(session))) throw new HttpError(404, 'Not found');
  const q = parseListQuery(request.nextUrl.searchParams);
  const filter = q.search ? { nameLower:{ $regex:escapeRegex(q.search) } } : {};
  const headers = { 'Cache-Control':'no-store' };

  if(q.csv){
    const users = await User.find(filter).select(FIELDS).sort(SORT[q.sort]).limit(CSV_LIMIT).lean();
    const totals = await scoreTotals(users.map(u => u._id));
    const rows = users.map(u => { const t = totals.get(String(u._id)); return [u.name, u.createdAt?.toISOString(), u.lastLoginAt?.toISOString(), u.theme, u.role, t ? t.count : 0, t ? t.best : '']; });
    const body = toCsv(['name', 'joined', 'last_login', 'handset', 'role', 'scores_posted', 'best_score'], rows);
    return new NextResponse(body, { headers:{ ...headers, 'Content-Type':'text/csv; charset=utf-8', 'Content-Disposition':`attachment; filename="players-${new Date().toISOString().slice(0, 10)}.csv"` } });
  }

  const week = new Date(Date.now() - 7 * 864e5);
  const [matching, users, total, newThisWeek, admins, scoresTotal] = await Promise.all([
    User.countDocuments(filter),
    User.find(filter).select(FIELDS).sort(SORT[q.sort]).skip((q.page - 1) * q.limit).limit(q.limit).lean(),
    User.estimatedDocumentCount(),
    User.countDocuments({ createdAt:{ $gte:week } }),
    User.countDocuments({ role:'admin' }),
    Score.estimatedDocumentCount()
  ]);
  const totals = await scoreTotals(users.map(u => u._id));
  return json({
    stats:{ total, newThisWeek, admins, scoresTotal },
    matching, page:q.page, pages:Math.max(1, Math.ceil(matching / q.limit)), limit:q.limit,
    users: users.map(u => { const t = totals.get(String(u._id)); return {
      name:u.name, theme:u.theme, role:u.role, createdAt:u.createdAt, lastLoginAt:u.lastLoginAt || null,
      you:String(u._id) === session.id, scores:{ count:t ? t.count : 0, best:t ? t.best : null }
    }; })
  }, 200, headers);
});
