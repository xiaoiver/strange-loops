import * as THREE from 'three';
import {
  BACKLIGHT_Z,
  CUTOUT_STUDIES,
  MARK_Z,
  PLUG_CLOSED_Z,
  PLUG_DEPTH,
  PLUG_OPEN_Z,
  WALL,
  WORDMARK_Z,
  oriented,
} from './cutout-studies.js';

function addContour(path, points, ccw) {
  oriented(points, ccw).forEach(([x, y], index) => path[index ? 'lineTo' : 'moveTo'](x, y));
  path.closePath();
  return path;
}

function shapeFrom(points, holes = []) {
  const shape = addContour(new THREE.Shape(), points, true);
  for (const hole of holes) shape.holes.push(addContour(new THREE.Path(), hole, false));
  return shape;
}

export function createNegativeSpaceWall({ concrete, ink, wordmark }) {
  const root = new THREE.Group();
  root.name = 'negative-space-wall-root';
  const holes = CUTOUT_STUDIES.flatMap((study) => study.holes);
  const wall = new THREE.Mesh(
    new THREE.ExtrudeGeometry(shapeFrom([
      [-WALL.w / 2, -WALL.h / 2], [WALL.w / 2, -WALL.h / 2], [WALL.w / 2, WALL.h / 2], [-WALL.w / 2, WALL.h / 2],
    ], holes), { depth: WALL.d, bevelEnabled: false }),
    concrete,
  );
  wall.name = 'negative-space-wall';
  wall.position.z = WALL.z;
  wall.castShadow = wall.receiveShadow = true;
  root.add(wall);

  const backlight = new THREE.Mesh(
    new THREE.PlaneGeometry(WALL.w - 0.24, WALL.h - 0.24),
    new THREE.MeshBasicMaterial({ color: 0xf4f1ea }),
  );
  backlight.name = 'ns-backlight';
  backlight.position.z = BACKLIGHT_Z;
  backlight.userData.role = 'light';
  root.add(backlight);

  const plugs = [];
  const markGroups = [];
  const pickables = [wall, backlight];
  for (const study of CUTOUT_STUDIES) {
    for (const hole of study.holes) {
      const plug = new THREE.Mesh(
        new THREE.ExtrudeGeometry(shapeFrom(hole), { depth: PLUG_DEPTH, bevelEnabled: false }),
        concrete,
      );
      plug.name = `ns-plug-${study.id}`;
      plug.position.z = PLUG_CLOSED_Z;
      plug.userData.study = study.id;
      plug.userData.role = 'plug';
      plug.userData.closedZ = PLUG_CLOSED_Z;
      plug.userData.openZ = PLUG_OPEN_Z;
      plug.castShadow = plug.receiveShadow = true;
      plugs.push(plug);
      pickables.push(plug);
      root.add(plug);
    }
    const marks = new THREE.Group();
    marks.name = `ns-mark-${study.id}`;
    for (const points of study.marks) {
      const pierced = (study.pierced ?? []).includes(points);
      const mesh = new THREE.Mesh(
        new THREE.ExtrudeGeometry(shapeFrom(points, pierced ? study.holes : []), { depth: 0.04, bevelEnabled: false }),
        ink,
      );
      mesh.position.z = MARK_Z;
      mesh.userData.study = study.id;
      mesh.userData.role = 'mark';
      mesh.castShadow = mesh.receiveShadow = true;
      marks.add(mesh);
      pickables.push(mesh);
    }
    if (study.wordmark) {
      const { width, height } = study.wordmark;
      const logoGeometry = new THREE.ShapeGeometry(shapeFrom([
        [-width / 2, -height / 2], [width / 2, -height / 2], [width / 2, height / 2], [-width / 2, height / 2],
      ], study.holes));
      const uv = logoGeometry.attributes.uv;
      const position = logoGeometry.attributes.position;
      for (let i = 0; i < position.count; i++) {
        uv.setXY(i, (position.getX(i) + width / 2) / width, (position.getY(i) + height / 2) / height);
      }
      const logo = new THREE.Mesh(logoGeometry, wordmark);
      logo.name = 'fedex-wordmark';
      logo.position.z = WORDMARK_Z;
      logo.userData.study = study.id;
      logo.userData.role = 'mark';
      marks.add(logo);
      pickables.push(logo);
    }
    markGroups.push(marks);
    root.add(marks);
  }
  return { root, wall, backlight, plugs, markGroups, pickables };
}
