import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { cp, mkdir, readFile, readdir, rm, rename } from 'node:fs/promises';
import { writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { COPY } from '../src/copy.js';
import { LANGUAGES } from '../src/languages.js';

export const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
export const basePath = '/experiences/geb/';
const origin = 'https://www.gallerymate.xyz';
const digest = data => createHash('sha256').update(data).digest('hex');
const escape = text => text.replaceAll('&', '&amp;').replaceAll('"', '&quot;').replaceAll('<', '&lt;');

async function filesIn(directory, prefix = '') {
  const files = [];
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    const relative = prefix + entry.name;
    if (entry.isSymbolicLink()) throw new Error(`Symlink is not a release asset: ${relative}`);
    if (entry.isDirectory()) files.push(...await filesIn(path.join(directory, entry.name), `${relative}/`));
    else if (entry.isFile()) files.push(relative);
    else throw new Error(`Unsupported release entry: ${relative}`);
  }
  return files.sort();
}

export async function verifyRelease(directory) {
  const actual = await filesIn(directory);
  const manifest = JSON.parse(await readFile(path.join(directory, 'release.json'), 'utf8'));
  if (manifest.schemaVersion !== 1 || manifest.basePath !== basePath || !Array.isArray(manifest.files)) throw new Error('Invalid release manifest');
  const expected = new Set(['release.json']);
  for (const file of manifest.files) {
    if (!/^[A-Za-z0-9][A-Za-z0-9._/-]*$/.test(file.path) || file.path.split('/').some(part => !part || part === '..' || part.startsWith('.')) || expected.has(file.path)) throw new Error('Unsafe or duplicate release path');
    expected.add(file.path);
    const bytes = await readFile(path.join(directory, file.path));
    if (digest(bytes) !== file.sha256 || bytes.length !== file.bytes) throw new Error(`Release checksum mismatch: ${file.path}`);
  }
  if (actual.length !== expected.size || actual.some(file => !expected.has(file))) throw new Error('Unexpected release files');
  for (const required of ['index.html', 'en.html', 'style.css', 'garden.css', 'figure-ground.css', 'assets/app.js', 'assets/sculpture-worker.js', 'assets/letter-pile-worker.js', 'assets/sculpture.bin', 'assets/characters/achilles.glb', 'assets/characters/tortoise.glb', 'assets/draco/draco_decoder.wasm', 'assets/fonts/serif-sc.woff2', 'THIRD_PARTY_NOTICES.md']) {
    if (!expected.has(required)) throw new Error(`Missing runtime asset: ${required}`);
  }
  for (const language of LANGUAGES) if (!expected.has(language === 'zh' ? 'index.html' : `${language}.html`)) throw new Error(`Missing language page: ${language}`);
  return manifest;
}

async function verifyFontCoverage() {
  const manifest = JSON.parse(await readFile(path.join(root, 'assets/fonts/subset.json'), 'utf8'));
  if (digest(await readFile(path.join(root, 'assets/fonts/serif-sc.woff2'))) !== manifest.sha256) throw new Error('Font checksum mismatch');
  const covered = new Set(manifest.codepoints);
  // Japanese and Korean use their own system fonts, not the Chinese subset.
  const sources = ['index.html', 'style.css', 'garden.css', 'figure-ground.css', ...(await filesIn(path.join(root, 'src'))).filter(name => name.endsWith('.js') && !name.startsWith('locales/')).map(name => `src/${name}`)];
  for (const source of sources) for (const char of (await readFile(path.join(root, source), 'utf8')).replace(/<script id="loading-bootstrap">[\s\S]*?<\/script>/, '')) {
    const code = char.codePointAt(0);
    if (code >= 0x3400 && code <= 0x9fff && !covered.has(code)) throw new Error(`Rebuild the font subset: missing ${char} in ${source}`);
  }
}

function page(html, language, hashes) {
  const copy = COPY[language], chinese = language === 'zh';
  const canonical = `${origin}${basePath.slice(0, -1)}${chinese ? '' : `?lang=${language}`}`;
  html = html.replace('<html lang="zh-CN">', `<html lang="${copy.lang}" data-locale="${language}">`)
    .replace(/<title>.*?<\/title>/, `<title>${escape(copy.title)}</title>`)
    .replace(/<meta name="description" content="[^"]*">/, `<meta name="description" content="${escape(copy.description)}">`)
    .replace('<head>', `<head>\n  <base href="${basePath}">`);
  for (const [file, hash] of Object.entries(hashes)) html = html.replace(new RegExp(`${file.replaceAll('.', '\\.')}\\?v=[^"\\s]+`, 'g'), `${file}?v=${hash.slice(0, 12)}`);
  const image = `${origin}${basePath}assets/share-${chinese ? 'zh' : 'en'}.jpg`;
  const ogLocale = { zh: 'zh_CN', en: 'en_US', ja: 'ja_JP', ko: 'ko_KR', fr: 'fr_FR', de: 'de_DE', es: 'es_ES' }[language];
  return html.replace('</head>', `  <link rel="canonical" href="${escape(canonical)}">
${LANGUAGES.map(key => `  <link rel="alternate" hreflang="${COPY[key].lang}" href="${origin}${basePath.slice(0, -1)}?lang=${key}">`).join('\n')}
  <meta property="og:type" content="website">
  <meta property="og:title" content="${escape(copy.title)}">
  <meta property="og:description" content="${escape(copy.description)}">
  <meta property="og:url" content="${escape(canonical)}">
  <meta property="og:locale" content="${ogLocale}">
  <meta property="og:image" content="${image}">
  <meta name="twitter:card" content="summary_large_image">
  <meta name="twitter:image" content="${image}">
</head>`);
}

export async function buildRelease(directory = path.join(root, 'dist/experiences/geb')) {
  await verifyFontCoverage();
  const stage = `${directory}.tmp-${process.pid}`;
  await rm(stage, { recursive: true, force: true });
  await mkdir(stage, { recursive: true });
  try {
    await cp(path.join(root, 'assets'), path.join(stage, 'assets'), { recursive: true });
    for (const file of ['style.css', 'garden.css', 'figure-ground.css']) await cp(path.join(root, file), path.join(stage, file));
    await cp(path.join(root, '../../THIRD_PARTY_NOTICES.md'), path.join(stage, 'THIRD_PARTY_NOTICES.md'));
    for (const [language, file] of [['zh', 'vestibule.jpg'], ['en', 'vestibule-en.jpg']]) await cp(path.join(root, 'docs/screenshots', file), path.join(stage, `assets/share-${language}.jpg`));
    const hashes = {};
    for (const file of ['style.css', 'garden.css', 'figure-ground.css', 'assets/app.js']) hashes[file] = digest(await readFile(path.join(stage, file)));
    const html = await readFile(path.join(root, 'index.html'), 'utf8');
    for (const language of LANGUAGES) await writeFile(path.join(stage, language === 'zh' ? 'index.html' : `${language}.html`), page(html, language, hashes));
    const manifest = {
      schemaVersion: 1, basePath, canonicalOrigin: origin,
      source: {
        repository: 'https://github.com/xiaoiver/strange-loops',
        revision: execFileSync('git', ['rev-parse', 'HEAD'], { cwd: root, encoding: 'utf8' }).trim(),
        dirty: Boolean(execFileSync('git', ['status', '--porcelain', '--', 'outputs/strange-loop', 'THIRD_PARTY_NOTICES.md'], { cwd: path.resolve(root, '../..'), encoding: 'utf8' }).trim()),
      },
      files: [],
    };
    for (const file of await filesIn(stage)) {
      const bytes = await readFile(path.join(stage, file));
      manifest.files.push({ path: file, bytes: bytes.length, sha256: digest(bytes) });
    }
    await writeFile(path.join(stage, 'release.json'), JSON.stringify(manifest, null, 2) + '\n');
    await verifyRelease(stage);
    await rm(directory, { recursive: true, force: true });
    await rename(stage, directory);
    return manifest;
  } catch (error) {
    await rm(stage, { recursive: true, force: true });
    throw error;
  }
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const manifest = await buildRelease();
  console.log(`Verified release: ${manifest.files.length} files, ${manifest.files.reduce((sum, file) => sum + file.bytes, 0)} bytes → dist/experiences/geb`);
}
