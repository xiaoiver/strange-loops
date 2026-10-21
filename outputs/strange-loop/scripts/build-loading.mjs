import { build } from 'esbuild';
import { readFile, writeFile } from 'node:fs/promises';

// Keep the loader inline so it works before (or without) the main bundle.
const root = new URL('../', import.meta.url);
const result = await build({ entryPoints: [new URL('src/loading.js', root).pathname], bundle: true, minify: true, format: 'iife', write: false });
const file = new URL('index.html', root);
const html = await readFile(file, 'utf8');
await writeFile(file, html.replace(/(<script id="loading-bootstrap">)[\s\S]*?(<\/script>)/, (_, open, close) => `${open}\n${result.outputFiles[0].text.trim()}\n  ${close}`));
