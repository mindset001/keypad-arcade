/* Pure helpers for the admin players list (no database, no framework): easy to unit-test. */
export const SORTS = ['newest', 'oldest', 'name', 'active'];
export const PAGE_SIZES = { default:25, max:100 };
export const CSV_LIMIT = 5000;

const int = (v, d) => { const n = Number.parseInt(v, 10); return Number.isFinite(n) ? n : d; };

/* turns the URL's query string into safe, clamped values */
export function parseListQuery(params){
  const get = k => (params && typeof params.get === 'function' ? params.get(k) : null);
  const sort = SORTS.includes(get('sort')) ? get('sort') : 'newest';
  const limit = Math.min(PAGE_SIZES.max, Math.max(1, int(get('limit'), PAGE_SIZES.default)));
  const page = Math.max(1, int(get('page'), 1));
  const search = (get('q') || '').trim().slice(0, 30).toLowerCase();
  return { sort, limit, page, search, csv:get('format') === 'csv' };
}

/* user text must never become regex syntax */
export const escapeRegex = s => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

/* One CSV cell. Quotes values containing , " or newlines, and defuses spreadsheet formulas
   (a cell starting with = + - @ would otherwise run as a formula when opened in Excel/Sheets). */
export function csvCell(v){
  let s = v === null || v === undefined ? '' : String(v);
  if(/^[=+\-@\t\r]/.test(s)) s = "'" + s;
  return /[",\n\r]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s;
}
export const toCsv = (header, rows) => [header, ...rows].map(r => r.map(csvCell).join(',')).join('\r\n') + '\r\n';

/* "5 min ago", "3 days ago"... `now` is injectable so tests don't depend on the clock */
const UNITS = [['yr', 31536000], ['month', 2592000], ['day', 86400], ['hour', 3600], ['min', 60]];
export function timeAgo(date, now = Date.now()){
  if(!date) return 'never';
  const secs = Math.max(0, (now - new Date(date).getTime()) / 1000);
  for(const [unit, size] of UNITS){
    const n = Math.floor(secs / size);
    if(n >= 1) return unit === 'min' || unit === 'yr' ? `${n} ${unit} ago` : `${n} ${unit}${n > 1 ? 's' : ''} ago`;
  }
  return 'just now';
}
