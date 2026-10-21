import { test } from 'node:test';
import assert from 'node:assert/strict';
import { initialLocale, localeUrl } from '../src/locale-url.js';

test('shared language overrides saved preference while unsupported values fall back safely', () => {
  assert.equal(initialLocale('?lang=en', 'zh'), 'en');
  assert.equal(initialLocale('?lang=zh-CN', 'en'), 'zh');
  assert.equal(initialLocale('?lang=fr', 'en'), 'fr');
  assert.equal(initialLocale('?lang=ja-JP', 'en'), 'ja');
  assert.equal(initialLocale('?lang=ko-KR', 'en'), 'ko');
  assert.equal(initialLocale('?lang=fr-CA', 'en'), 'fr');
  assert.equal(initialLocale('?lang=DE', 'en'), 'de');
  assert.equal(initialLocale('?lang=es-MX', 'en'), 'es');
  assert.equal(initialLocale('?lang=it', 'en'), 'en');
  assert.equal(initialLocale('', null, 'en'), 'en');
  assert.equal(initialLocale('', 'en'), 'en');
  assert.equal(initialLocale('', 'corrupted'), 'zh');
});

test('changing language preserves the subpath, custom sculpture and fragment', () => {
  const next = localeUrl('https://www.gallerymate.xyz/experiences/geb?s=CAT#chapter', 'en');
  assert.equal(next, '/experiences/geb?s=CAT&lang=en#chapter');
  assert.equal(localeUrl(new URL(next, 'https://www.gallerymate.xyz').href, 'zh'), '/experiences/geb?s=CAT&lang=zh#chapter');
  assert.equal(localeUrl(new URL(next, 'https://www.gallerymate.xyz').href, 'ja'), '/experiences/geb?s=CAT&lang=ja#chapter');
});
