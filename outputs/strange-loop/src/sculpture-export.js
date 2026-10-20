import * as THREE from 'three';
import { STLExporter } from 'three/addons/exporters/STLExporter.js';

const stlExporter = new STLExporter();

function fileStem(letters) {
  const safe = String(letters || 'GEB').toUpperCase().replace(/[^A-Z]/g, '').slice(0, 3) || 'GEB';
  return `strange-loop-${safe}`;
}

/** Temporary mesh with identity transform so exporters write object-local geometry. */
function localMesh(source) {
  const geometry = source?.isMesh ? source.geometry : source?.geometry;
  if (!geometry?.getAttribute?.('position')) throw new Error('no-geometry');
  const mesh = new THREE.Mesh(geometry);
  mesh.updateMatrixWorld(true);
  return mesh;
}

function triggerDownload(blob, filename) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.rel = 'noopener';
  document.body.append(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 2500);
}

export function canExportSculpture(mesh) {
  return !!(mesh?.isMesh && mesh.geometry?.getAttribute?.('position'));
}

/** Binary STL of the live mesh geometry in local space. */
export function downloadSculptureSTL(mesh, letters) {
  const temp = localMesh(mesh);
  const data = stlExporter.parse(temp, { binary: true });
  const blob = new Blob([data], { type: 'model/stl' });
  triggerDownload(blob, `${fileStem(letters)}.stl`);
}
