import { MathUtils } from 'three';

// Remember the original surface settings, including translucent floor inscriptions.
export function createExhibitFade(root, { lift = .16, shrink = .025, anchorY = 0 } = {}) {
  const origin = root.position.clone(), scale = root.scale.clone(), originals = new WeakMap();
  return amount => {
    const p = MathUtils.clamp(amount, 0, 1), size = 1 - shrink * (1 - p);
    root.visible = p > 0;
    root.scale.copy(scale).multiplyScalar(size);
    root.position.copy(origin);
    root.position.y += anchorY * (1 - size) + lift * (1 - p);
    const visited = new Set();
    root.traverse(object => {
      if (!object.isMesh) return;
      for (const material of Array.isArray(object.material) ? object.material : [object.material]) {
        if (visited.has(material)) continue;
        visited.add(material);
        if (!originals.has(material)) originals.set(material, {
          opacity: material.opacity, transparent: material.transparent, depthWrite: material.depthWrite,
        });
        const initial = originals.get(material), fading = p < 1;
        const transparent = fading || initial.transparent;
        if (material.transparent !== transparent) { material.transparent = transparent; material.needsUpdate = true; }
        material.opacity = initial.opacity * p;
        material.depthWrite = fading ? false : initial.depthWrite;
      }
    });
  };
}
