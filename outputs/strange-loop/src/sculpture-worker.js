import { FontLoader } from 'three/addons/loaders/FontLoader.js';
import fontData from 'three/examples/fonts/helvetiker_bold.typeface.json';
import {
  buildSculptureGeometry,
  geometryToBin,
  normalizeLetters,
} from './sculpture-build.js';

const font = new FontLoader().parse(fontData);

self.onmessage = (event) => {
  const { id, letters } = event.data || {};
  try {
    const normalized = normalizeLetters(letters);
    if (!normalized) throw new Error('invalid');
    const geometry = buildSculptureGeometry(normalized, font);
    const buffer = geometryToBin(geometry);
    geometry.dispose();
    self.postMessage({ id, ok: true, letters: normalized, buffer }, [buffer]);
  } catch (error) {
    self.postMessage({
      id,
      ok: false,
      error: error?.message || 'failed',
    });
  }
};
