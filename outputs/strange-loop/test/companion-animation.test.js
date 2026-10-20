import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { AnimationMixer } from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { playCompanionAnimation as play } from '../src/companion-animation.js';

async function achilles() {
  // Exercise the shipped rig and clips without needing a GPU or Draco mesh decode.
  // Keep all animation accessors and the original binary buffer intact.
  const raw = await readFile(new URL('../assets/characters/achilles.glb', import.meta.url));
  const jsonLength = raw.readUInt32LE(12);
  const json = JSON.parse(raw.subarray(20, 20 + jsonLength));
  for (const node of json.nodes) { delete node.mesh; delete node.skin; }
  delete json.meshes; delete json.skins;
  delete json.extensionsRequired; delete json.extensionsUsed;
  let chunk = Buffer.from(JSON.stringify(json));
  chunk = Buffer.concat([chunk, Buffer.alloc((4 - chunk.length % 4) % 4, 32)]);
  const binary = raw.subarray(20 + jsonLength), header = Buffer.alloc(20);
  header.writeUInt32LE(0x46546c67); header.writeUInt32LE(2, 4);
  header.writeUInt32LE(20 + chunk.length + binary.length, 8);
  header.writeUInt32LE(chunk.length, 12); header.writeUInt32LE(0x4e4f534a, 16);
  const data = Buffer.concat([header, chunk, binary]);
  const gltf = await new GLTFLoader().parseAsync(data.buffer.slice(data.byteOffset, data.byteOffset + data.byteLength), '');
  const mixer = new AnimationMixer(gltf.scene);
  const actions = Object.fromEntries(gltf.animations.map(clip => [clip.name.split('_').at(-1), mixer.clipAction(clip)]));
  const arms = ['upperarm_l_27', 'lowerarm_l_24', 'upperarm_r_55', 'lowerarm_r_52']
    .map(name => gltf.scene.getObjectByName(name));
  // Fail clearly if the exported skeleton is replaced or renamed.
  assert.ok(arms.every(Boolean));
  return { mixer, actions, arms, current: null, clipAge: 0 };
}

test('Look → Idle keeps the shipped mannequin’s arms folded throughout the blend', async () => {
  const actor = await achilles();
  play(actor, 'Walk'); actor.mixer.update(1);
  play(actor, 'Look'); actor.mixer.update(actor.actions.Look.getClip().duration);
  const folded = actor.arms.map(arm => arm.quaternion.clone());
  play(actor, 'Idle');
  let maxDeviation = 0;
  for (let frame = 0; frame < 60; frame++) {
    actor.mixer.update(1 / 120);
    actor.arms.forEach((arm, index) => {
      maxDeviation = Math.max(maxDeviation, arm.quaternion.angleTo(folded[index]));
    });
  }
  assert.ok(maxDeviation < .001, `arms reopened by ${(maxDeviation * 180 / Math.PI).toFixed(2)}°`);
});

test('reduced-motion Idle is fully posed on its first zero-delta update', async () => {
  const actor = await achilles();
  play(actor, 'Idle'); actor.mixer.update(0);
  const first = actor.arms.map(arm => arm.quaternion.clone());
  actor.mixer.update(1);
  actor.arms.forEach((arm, index) => assert.ok(arm.quaternion.angleTo(first[index]) < .001));
});

test('repeated Look requests do not rewind the current gesture', async () => {
  const actor = await achilles();
  play(actor, 'Look'); actor.mixer.update(.6); actor.clipAge = .6;
  play(actor, 'Look');
  assert.equal(actor.actions.Look.time, .6);
  assert.equal(actor.clipAge, .6);
});
