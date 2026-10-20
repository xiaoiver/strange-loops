import { test } from 'node:test';
import assert from 'node:assert/strict';
import { initialLocale, localeUrl } from '../src/locale-url.js';

test('shared language overrides saved preference while unsupported values fall back safely', () => {
  assert.equal(initialLocale('?lang=en', 'zh'), 'en');
  assert.equal(initialLocale('?lang=zh-CN', 'en'), 'zh');
  assert.equal(initialLocale('?lang=fr', 'en'), 'en');
  assert.equal(initialLocale('', null, 'en'), 'en');
  assert.equal(initialLocale('', 'en'), 'en');
  assert.equal(initialLocale('', 'corrupted'), 'zh');
});

test('changing language preserves the subpath, custom sculpture and fragment', () => {
  const next = localeUrl('https://www.gallerymate.xyz/experiences/geb?s=CAT#chapter', 'en');
  assert.equal(next, '/experiences/geb?s=CAT&lang=en#chapter');
  assert.equal(localeUrl(new URL(next, 'https://www.gallerymate.xyz').href, 'zh'), '/experiences/geb?s=CAT&lang=zh#chapter');
});
