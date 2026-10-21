import test from 'node:test';
import assert from 'node:assert/strict';
import { shareText, share } from '../lib/arcade/share.js';

test('shareText names the score and the game', () => {
  assert.equal(shareText('Bounce', 120), 'I scored 120 in Bounce on Keypad Arcade! Can you beat it?');
});

const payload = { text:'hi', url:'https://x.test/' };

test('uses the native share sheet when there is one', async () => {
  let got; const nav = { share: async d => { got = d; } };
  assert.equal(await share(payload, nav), 'shared');
  assert.equal(got.text, 'hi'); assert.equal(got.url, 'https://x.test/'); assert.equal(got.title, 'Keypad Arcade');
});

test('cancelling the share sheet is not an error and does not copy', async () => {
  let copied = false;
  const nav = { share: async () => { const e = new Error('x'); e.name = 'AbortError'; throw e; }, clipboard:{ writeText: async () => { copied = true; } } };
  assert.equal(await share(payload, nav), 'cancelled'); assert.equal(copied, false);
});

test('falls back to the clipboard (text + link) when sharing is missing or fails', async () => {
  let text;
  const clip = { writeText: async t => { text = t; } };
  assert.equal(await share(payload, { clipboard:clip }), 'copied'); assert.equal(text, 'hi https://x.test/');
  text = null;
  assert.equal(await share(payload, { share: async () => { throw new Error('boom'); }, clipboard:clip }), 'copied'); assert.equal(text, 'hi https://x.test/');
});

test('reports failure when nothing works', async () => {
  assert.equal(await share(payload, {}), 'failed');
  assert.equal(await share(payload, { clipboard:{ writeText: async () => { throw new Error('denied'); } } }), 'failed');
  assert.equal(await share(payload, undefined), 'failed');
});
