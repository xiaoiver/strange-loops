import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Group, Mesh, BoxGeometry, MeshBasicMaterial } from 'three';
import { createExhibitFade } from '../src/exhibit-fade.js';

test('repeated scene transitions restore opaque and translucent materials without transform drift', () => {
  const root = new Group(); root.position.set(1, 2, 3); root.scale.set(2, 3, 4);
  const opaque = new MeshBasicMaterial();
  const inscription = new MeshBasicMaterial({ transparent: true, opacity: .65, depthWrite: false });
  root.add(new Mesh(new BoxGeometry(), opaque), new Mesh(new BoxGeometry(), [opaque, inscription]));
  const fade = createExhibitFade(root, { anchorY: -3.8 });
  for (let round = 0; round < 3; round++) {
    fade(.5);
    assert.equal(opaque.opacity, .5);
    assert.equal(inscription.opacity, .325);
    assert.equal(opaque.depthWrite, false);
    fade(0); assert.equal(root.visible, false);
    fade(1);
    assert.equal(root.visible, true);
    assert.deepEqual(root.position.toArray(), [1, 2, 3]);
    assert.deepEqual(root.scale.toArray(), [2, 3, 4]);
    assert.equal(opaque.opacity, 1); assert.equal(opaque.transparent, false); assert.equal(opaque.depthWrite, true);
    assert.equal(inscription.opacity, .65); assert.equal(inscription.transparent, true); assert.equal(inscription.depthWrite, false);
  }
});

test('new letters created between visits participate in the next transition', () => {
  const root = new Group(), fade = createExhibitFade(root);
  fade(0);
  const material = new MeshBasicMaterial();
  root.add(new Mesh(new BoxGeometry(), material));
  fade(.25); assert.equal(material.opacity, .25);
  fade(1); assert.equal(material.opacity, 1); assert.equal(material.transparent, false);
});
