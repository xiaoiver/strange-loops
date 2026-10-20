import { FontLoader } from 'three/addons/loaders/FontLoader.js';
import fs from 'node:fs';
import {
  buildSculptureGeometry,
  geometryToBin,
  DEFAULT_LETTERS,
  normalizeLetters,
} from '../src/sculpture-build.js';

const letters = normalizeLetters(process.argv[2]) || DEFAULT_LETTERS;
const font = new FontLoader().parse(
  JSON.parse(
    fs.readFileSync(
      new URL('../node_modules/three/examples/fonts/helvetiker_bold.typeface.json', import.meta.url),
    ),
  ),
);
const geometry = buildSculptureGeometry(letters, font);
const data = Buffer.from(geometryToBin(geometry));
fs.writeFileSync(new URL('../assets/sculpture.bin', import.meta.url), data);
console.log(JSON.stringify({ letters, vertices: geometry.attributes.position.count, bytes: data.length }));
geometry.dispose();
