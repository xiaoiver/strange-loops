import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, readFile, writeFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { buildRelease, verifyRelease, basePath } from '../scripts/site-release.mjs';

test('release is self-contained under the website subpath, with seven language pages and real runtime assets', async t => {
  const directory = await mkdtemp(path.join(tmpdir(), 'geb-release-'));
  t.after(() => rm(directory, { recursive: true, force: true }));
  const manifest = await buildRelease(path.join(directory, 'geb'));
  const release = path.join(directory, 'geb');
  assert.equal((await verifyRelease(release)).source.revision, manifest.source.revision);
  for (const [language, file] of [['zh-CN', 'index.html'], ...['en', 'ja', 'ko', 'fr', 'de', 'es'].map(key => [key, `${key}.html`])]) {
    const html = await readFile(path.join(release, file), 'utf8');
    assert.ok(html.includes(`<html lang="${language}"`));
    assert.ok(html.includes(`<base href="${basePath}">`));
    assert.ok(html.includes('property="og:title"'));
    assert.ok(html.includes('rel="canonical"'));
    for (const lang of ['zh-CN', 'en', 'ja', 'ko', 'fr', 'de', 'es']) assert.ok(html.includes(`hreflang="${lang}"`));
    if (language !== 'zh-CN') assert.ok(html.includes(`rel="canonical" href="https://www.gallerymate.xyz/experiences/geb?lang=${language}"`));
    assert.equal(new URL('assets/sculpture-worker.js', new URL(basePath, 'https://example.test')).pathname, '/experiences/geb/assets/sculpture-worker.js');
  }
  const css = await readFile(path.join(release, 'style.css'), 'utf8');
  assert.ok(!css.includes('fonts.googleapis.com'));
  assert.ok(css.includes('assets/fonts/serif-sc.woff2'));
  assert.equal((await readFile(path.join(release, 'assets/characters/achilles.glb'))).toString('ascii', 0, 4), 'glTF');
  assert.ok(manifest.files.some(file => file.path === 'figure-ground.css'));
  assert.ok(manifest.files.some(file => file.path === 'assets/art/rubin-contour.svg'));
  for (const file of ['assets/art/the-lobster.jpg','assets/art/the-lobster-weisz.jpg']) assert.ok(manifest.files.some(entry => entry.path === file));
  assert.ok(manifest.files.every(file => !file.path.includes('node_modules') && !file.path.startsWith('src/')));
});

test('release verification rejects changed assets, undeclared files and unsafe manifest paths', async t => {
  const directory = await mkdtemp(path.join(tmpdir(), 'geb-integrity-'));
  t.after(() => rm(directory, { recursive: true, force: true }));
  const manifest = await buildRelease(path.join(directory, 'geb'));
  const release = path.join(directory, 'geb'), asset = path.join(release, 'assets/app.js');
  const original = await readFile(asset);
  await writeFile(asset, 'corrupted');
  await assert.rejects(verifyRelease(release), /checksum mismatch/);
  await writeFile(asset, original);
  await writeFile(path.join(release, 'unexpected.txt'), 'not a runtime asset');
  await assert.rejects(verifyRelease(release), /Unexpected release files/);
  await rm(path.join(release, 'unexpected.txt'));
  manifest.files.push({ path: '../outside', bytes: 0, sha256: '0'.repeat(64) });
  await writeFile(path.join(release, 'release.json'), JSON.stringify(manifest));
  await assert.rejects(verifyRelease(release), /Unsafe/);
});
