import * as THREE from 'three';
import { TextGeometry } from 'three/addons/geometries/TextGeometry.js';
import { toCreasedNormals } from 'three/addons/utils/BufferGeometryUtils.js';
import { Brush, Evaluator, INTERSECTION } from 'three-bvh-csg';

export const DEFAULT_LETTERS = 'GEB';
const MIN_VERTICES = 24;

/** @param {unknown} input */
export function normalizeLetters(input) {
  const cleaned = String(input ?? '')
    .toUpperCase()
    .replace(/[^A-Z]/g, '')
    .slice(0, 3);
  return cleaned.length === 3 ? cleaned : null;
}

/**
 * @param {string} letters three A–Z letters
 * @param {import('three/examples/jsm/loaders/FontLoader.js').Font} font
 * @returns {THREE.BufferGeometry}
 */
export function buildSculptureGeometry(letters, font) {
  const normalized = normalizeLetters(letters);
  if (!normalized) throw new Error('invalid');
  const [front, side, top] = normalized;

  function glyph(letter, axis) {
    const geometry = new TextGeometry(letter, {
      font,
      size: 3,
      depth: 4,
      curveSegments: 16,
      bevelEnabled: false,
    });
    geometry.computeBoundingBox();
    const box = geometry.boundingBox;
    const size = box.getSize(new THREE.Vector3());
    if (size.x < 1e-4 || size.y < 1e-4) {
      geometry.dispose();
      throw new Error('empty-glyph');
    }
    geometry.translate(-box.min.x, -box.min.y, -box.min.z);
    geometry.scale(3.5 / size.x, 3.5 / size.y, 1);
    geometry.translate(-1.75, -1.75, -2);
    if (axis === 'x') geometry.rotateY(Math.PI / 2);
    if (axis === 'y') geometry.rotateX(-Math.PI / 2);
    const mesh = new Brush(geometry, new THREE.MeshStandardMaterial());
    mesh.updateMatrixWorld();
    return mesh;
  }

  const evaluator = new Evaluator();
  evaluator.useGroups = false;
  evaluator.attributes = ['position', 'normal'];
  const result = evaluator.evaluate(
    evaluator.evaluate(glyph(front, 'z'), glyph(side, 'x'), INTERSECTION),
    glyph(top, 'y'),
    INTERSECTION,
  );
  const count = result.geometry?.attributes?.position?.count ?? 0;
  if (count < MIN_VERTICES) {
    result.geometry?.dispose?.();
    throw new Error('empty');
  }
  result.geometry = toCreasedNormals(result.geometry, Math.PI / 6);
  return result.geometry;
}

/** @param {THREE.BufferGeometry} geometry */
export function geometryToBin(geometry) {
  const position = geometry.attributes.position.array;
  const normal = geometry.attributes.normal.array;
  const n = geometry.attributes.position.count;
  const data = new ArrayBuffer(4 + n * 12);
  const view = new DataView(data);
  view.setUint32(0, n, true);
  for (let i = 0; i < n * 3; i++) {
    view.setInt16(4 + i * 2, Math.round(position[i] * 8192), true);
    view.setInt16(
      4 + n * 6 + i * 2,
      Math.round(Math.max(-1, Math.min(1, normal[i])) * 32767),
      true,
    );
  }
  return data;
}

/** @param {ArrayBuffer} modelData */
export function binToGeometry(modelData) {
  const count = new DataView(modelData).getUint32(0, true);
  const quantized = new Int16Array(modelData, 4, count * 3);
  const positions = new Float32Array(count * 3);
  for (let i = 0; i < positions.length; i++) positions[i] = quantized[i] / 8192;
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  geometry.setAttribute(
    'normal',
    new THREE.Int16BufferAttribute(new Int16Array(modelData, 4 + count * 6, count * 3), 3, true),
  );
  return geometry;
}
