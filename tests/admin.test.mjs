import test from 'node:test';
import assert from 'node:assert/strict';
import { parseListQuery, escapeRegex, csvCell, toCsv, timeAgo, PAGE_SIZES } from '../lib/admin.js';

const q = s => parseListQuery(new URLSearchParams(s));

test('list query: sensible defaults', () => {
  assert.deepEqual(q(''), { sort:'newest', limit:PAGE_SIZES.default, page:1, search:'', csv:false });
});

test('list query: clamps page and size, ignores junk', () => {
  assert.equal(q('limit=100000').limit, PAGE_SIZES.max);
  assert.equal(q('limit=0').limit, 1);
  assert.equal(q('limit=abc').limit, PAGE_SIZES.default);
  assert.equal(q('page=-4').page, 1);
  assert.equal(q('page=7').page, 7);
  assert.equal(q('page=NaN').page, 1);
});

test('list query: only known sorts are accepted', () => {
  for(const s of ['newest', 'oldest', 'name', 'active']) assert.equal(q('sort=' + s).sort, s);
  assert.equal(q('sort=passHash').sort, 'newest');
  assert.equal(q('sort=$where').sort, 'newest');
});

test('list query: search is trimmed, lower-cased and length-limited; csv flag', () => {
  assert.equal(q('q=%20ADa%20').search, 'ada');
  assert.equal(q('q=' + 'x'.repeat(100)).search.length, 30);
  assert.equal(q('format=csv').csv, true);
  assert.equal(q('format=json').csv, false);
  assert.equal(parseListQuery(null).sort, 'newest');
});

test('escapeRegex: search text can never become regex syntax', () => {
  const nasty = '.*+?^${}()|[]\\';
  const re = new RegExp(escapeRegex(nasty));
  assert.ok(re.test('xx' + nasty + 'yy'));
  assert.equal(new RegExp(escapeRegex('a.c')).test('abc'), false);
  assert.equal(new RegExp(escapeRegex('.*')).test('anything'), false);
});

test('csv: quoting, escaping and formula protection', () => {
  assert.equal(csvCell('plain'), 'plain');
  assert.equal(csvCell('a,b'), '"a,b"');
  assert.equal(csvCell('say "hi"'), '"say ""hi"""');
  assert.equal(csvCell('line\nbreak'), '"line\nbreak"');
  assert.equal(csvCell(null), ''); assert.equal(csvCell(undefined), ''); assert.equal(csvCell(0), '0');
  for(const f of ['=1+1', '+1', '-1', '@SUM(A1)']) assert.ok(csvCell(f).startsWith("'"), f);
  assert.equal(toCsv(['a', 'b'], [['1', 'x,y'], ['2', '']]), 'a,b\r\n1,"x,y"\r\n2,\r\n');
});

test('timeAgo: plain-English ages, with a fixed clock', () => {
  const now = Date.UTC(2026, 9, 21, 12, 0, 0), ago = ms => new Date(now - ms);
  assert.equal(timeAgo(null, now), 'never'); assert.equal(timeAgo(undefined, now), 'never');
  assert.equal(timeAgo(ago(20e3), now), 'just now');
  assert.equal(timeAgo(ago(5 * 60e3), now), '5 min ago');
  assert.equal(timeAgo(ago(3600e3), now), '1 hour ago');
  assert.equal(timeAgo(ago(5 * 3600e3), now), '5 hours ago');
  assert.equal(timeAgo(ago(86400e3), now), '1 day ago');
  assert.equal(timeAgo(ago(9 * 86400e3), now), '9 days ago');
  assert.equal(timeAgo(ago(75 * 86400e3), now), '2 months ago');
  assert.equal(timeAgo(ago(800 * 86400e3), now), '2 yr ago');
  assert.equal(timeAgo(new Date(now + 5e3), now), 'just now', 'a clock a few seconds ahead never shows a negative age');
});
