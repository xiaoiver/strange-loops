import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { AnimationMixer, Vector3 } from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { playCompanionAnimation as play } from '../src/companion-animation.js';
import { syncWalkToDistance, walkProgress } from '../src/companion-locomotion.js';

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
  const metadata=gltf.scene.getObjectByName('Achilles').userData;
  return { root:gltf.scene, mixer, actions, arms, walkCycleDistance:metadata.walk_cycle_distance*.6, current: null, clipAge: 0 };
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

test('the exported gait plants each support foot while the body travels forward', async()=>{
  const actor=await achilles();play(actor,'Walk');
  const duration=actor.actions.Walk.getClip().duration;
  assert.ok(Math.abs(duration-1.2)<1e-5);
  assert.equal(actor.walkCycleDistance,.63);
  for(const [side,offset] of [['l',0],['r',.5]]){
    const foot=actor.root.getObjectByName(side==='l'?'foot_l_68':'foot_r_75');
    const points=[];
    for(const u of [.16,.22,.30,.38]){
      const t=(u+offset)%1;actor.mixer.setTime(t*duration);actor.root.updateMatrixWorld(true);
      const position=foot.getWorldPosition(new Vector3());position.z+=actor.walkCycleDistance/.6*t;points.push(position);
    }
    for(const point of points)assert.ok(point.distanceTo(points[0])<.002,`${side} support foot slides ${point.distanceTo(points[0])}`);
  }
  actor.mixer.setTime(0);actor.root.updateMatrixWorld(true);
  const first=actor.root.getObjectByName('foot_l_68').getWorldPosition(new Vector3());
  actor.mixer.setTime(duration-1e-6);actor.root.updateMatrixWorld(true);
  assert.ok(first.distanceTo(actor.root.getObjectByName('foot_l_68').getWorldPosition(new Vector3()))<.001,'loop seam');
});

test('changing pace advances the gait by distance, with no foot cycling during a wait', async()=>{
  const actor=await achilles();play(actor,'Walk');
  let travelled=0,expectedTime=0;
  for(let frame=0;frame<100;frame++){
    const dt=1/60,distance=frame<20?0:frame<60?.006:.012;
    const before=actor.actions.Walk.time;
    syncWalkToDistance(actor,distance,dt);actor.mixer.update(dt);
    travelled+=distance;expectedTime+=distance*actor.actions.Walk.getClip().duration/actor.walkCycleDistance;
    if(!distance)assert.equal(actor.actions.Walk.time,before);
  }
  assert.ok(Math.abs(actor.actions.Walk.time-expectedTime%actor.actions.Walk.getClip().duration)<1e-6);
  assert.ok(travelled>actor.walkCycleDistance,'a complete loop was exercised');
});

test('walking eases at both ends and covers the whole route without a speed spike',()=>{
  let previous=walkProgress(0),maximumSpeed=0;
  for(let i=1;i<=1000;i++){
    const next=walkProgress(i/1000);assert.ok(next>=previous);maximumSpeed=Math.max(maximumSpeed,(next-previous)*1000);previous=next;
  }
  assert.equal(walkProgress(0),0);assert.equal(walkProgress(1),1);
  assert.ok(walkProgress(.001)<.00001);assert.ok(1-walkProgress(.999)<.00001);
  assert.ok(maximumSpeed<=1.251);
});
