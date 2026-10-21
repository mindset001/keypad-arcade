import test from 'node:test';
import assert from 'node:assert/strict';
import { nameError, passwordError, byteLength, NAME_RE } from '../lib/arcade/validate.js';

test('names: 2-12 letters, numbers or underscore', () => {
  for(const ok of ['ab', 'Ada', 'zed_9', 'A1b2C3d4E5f6', '  Ada  ']) assert.equal(nameError(ok), '', ok);
  for(const bad of ['a', 'abcdefghijklm', 'a b', 'a-b', 'a!', 'émile', '名前', '', '   ', null, undefined, 42]) assert.notEqual(nameError(bad), '', String(bad));
});

test('names: reserved names are refused in any case', () => {
  for(const r of ['guest', 'GUEST', 'Admin', 'ROOT', 'Demlinks', 'system']) assert.match(nameError(r), /reserved/, r);
  assert.equal(nameError('guest2'), '');
});

test('passwords: 6 or more characters', () => {
  assert.equal(passwordError('abcdef'), '');
  assert.match(passwordError('abcde'), /6 or more/);
  assert.match(passwordError(''), /6 or more/);
  assert.match(passwordError(undefined), /6 or more/);
  assert.match(passwordError(123456), /6 or more/);
});

test('passwords: limited by BYTES (bcrypt ignores everything after byte 72)', () => {
  assert.equal(passwordError('a'.repeat(72)), '');
  assert.match(passwordError('a'.repeat(73)), /too long/);
  assert.equal(passwordError('é'.repeat(36)), '');          // 36 chars = 72 bytes
  assert.match(passwordError('é'.repeat(37)), /too long/);    // 37 chars = 74 bytes
  assert.match(passwordError('😀'.repeat(19)), /too long/);   // 19 chars but 76 bytes
  assert.equal(byteLength('😀'), 4);
});

test('spaces inside passwords are kept; the name regex has no flags that skip lines', () => {
  assert.equal(passwordError('pass word 1'), '');
  assert.equal(NAME_RE.test('ab\nc'), false);
});
