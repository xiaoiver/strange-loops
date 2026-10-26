import {build} from 'esbuild';
import {readFile,writeFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {fileURLToPath} from 'node:url';
import path from 'node:path';

const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
await build({entryPoints:[path.join(root,'dev/fractal-preview-source.js')],bundle:true,minify:true,outfile:path.join(root,'dev/fractal-preview.js')});
let html=await readFile(path.join(root,'fractal-preview.html'),'utf8');
for(const file of ['dev/fractal-preview.js','dev/fractal-preview.css']){
  const bytes=await readFile(path.join(root,file));
  const hash=createHash('sha256').update(bytes).digest('hex').slice(0,12);
  html=html.replace(new RegExp(`${file.replaceAll('.','\\.')}\\??[^"\\s]*`,'g'),`${file}?v=${hash}`);
}
await writeFile(path.join(root,'fractal-preview.html'),html);
console.log('Built fractal preview with content-versioned script and stylesheet.');
