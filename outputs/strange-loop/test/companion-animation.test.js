import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { AnimationMixer, Quaternion, Vector3 } from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { playCompanionAnimation as play } from '../src/companion-animation.js';
import { syncLocomotionToDistance, walkProgress } from '../src/companion-locomotion.js';

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
  return { root:gltf.scene, mixer, actions, arms, walkCycleDistance:metadata.walk_cycle_distance*.6, jogCycleDistance:metadata.jog_cycle_distance*.6, metadata, current: null, clipAge: 0 };
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

test('the retargeted library walk keeps support toes planted and closes its loop', async()=>{
  const actor=await achilles();play(actor,'Walk');
  const duration=actor.actions.Walk.getClip().duration;
  assert.ok(Math.abs(duration-4/3)<1e-5);
  assert.equal(actor.metadata.walk_source_clip,'Walk_Formal_Loop');
  assert.equal(actor.metadata.walk_license,'CC0-1.0');
  assert.ok(actor.walkCycleDistance>1.1&&actor.walkCycleDistance<1.2);
  // During toe support the ankle rolls forward; test the toe, not a fixed ankle.
  for(const [name,frames] of [['ball_l_67',[8,12,16,20]],['ball_r_74',[28,32,36,40]]]){
    const toe=actor.root.getObjectByName(name),points=[];
    for(const frame of frames){
      const t=frame/40;actor.mixer.setTime(t*duration);actor.root.updateMatrixWorld(true);
      const position=toe.getWorldPosition(new Vector3());position.z+=actor.walkCycleDistance/.6*t;points.push(position);
    }
    for(const point of points)assert.ok(point.distanceTo(points[0])<.025,`${name} support slides ${point.distanceTo(points[0])}`);
  }
  const bones=[];actor.root.traverse(node=>{if(node.isBone)bones.push(node);});
  actor.mixer.setTime(0);actor.root.updateMatrixWorld(true);
  const first=bones.map(bone=>({position:bone.position.clone(),rotation:bone.quaternion.clone()}));
  actor.mixer.setTime(duration-1e-6);actor.root.updateMatrixWorld(true);
  bones.forEach((bone,index)=>{
    assert.ok(bone.position.distanceTo(first[index].position)<.001,`${bone.name} position seam`);
    assert.ok(bone.quaternion.angleTo(first[index].rotation)<.001,`${bone.name} rotation seam`);
  });
  // Translation belongs to the scene route, never to a second root-motion track.
  const root=actor.root.getObjectByName('root_87'),origin=root.position.clone();
  for(let frame=0;frame<40;frame++){
    actor.mixer.setTime(frame/30);assert.ok(root.position.distanceTo(origin)<1e-6,'root motion was not removed');
  }
});

test('changing pace advances the gait by distance, with no foot cycling during a wait', async()=>{
  const actor=await achilles();play(actor,'Walk');
  let travelled=0,expectedTime=0;
  for(let frame=0;frame<160;frame++){
    const dt=1/60,distance=frame<20?0:frame<60?.006:.012;
    const before=actor.actions.Walk.time;
    syncLocomotionToDistance(actor,distance,dt);actor.mixer.update(dt);
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

test('a distance-driven stop preserves the already-running idle without a second fade',async()=>{
 for(const mode of ['Walk','Jog']){
  const actor=await achilles();play(actor,mode);
  syncLocomotionToDistance(actor,0,1/60);actor.mixer.update(.5);
  const time=actor.actions.Idle.time,pose=actor.arms.map(bone=>bone.quaternion.clone());
  play(actor,'Idle');actor.mixer.update(0);
  assert.equal(actor.actions.Idle.time,time,mode+' restarted idle at the stop');
  assert.equal(actor.actions.Idle.getEffectiveWeight(),1);
  assert.equal(actor.actions[mode].getEffectiveWeight(),0);
  actor.arms.forEach((bone,i)=>assert.ok(bone.quaternion.angleTo(pose[i])<.001,mode+' flashed rest pose'));
 }
});

test('the jogging clip loops continuously, has no root drift and follows actual passage distance',async()=>{
 const actor=await achilles();play(actor,'Jog');
 assert.equal(actor.metadata.jog_source_clip,'Jog_Fwd_Loop');
 assert.equal(actor.metadata.jog_license,'CC0-1.0');
 const action=actor.actions.Jog,duration=action.getClip().duration;
 assert.ok(Math.abs(duration-28/30)<1e-5);
 for(const [name,frames] of [['ball_l_67',[3,4,5]],['ball_r_74',[17,18,19]]]){
  const toe=actor.root.getObjectByName(name),points=[];
  for(const frame of frames){
   const t=frame/28;actor.mixer.setTime(t*duration);actor.root.updateMatrixWorld(true);
   const point=toe.getWorldPosition(new Vector3());point.z+=actor.jogCycleDistance/.6*t;points.push(point);
  }
  for(const point of points)assert.ok(point.distanceTo(points[0])<.008,name+' jogging support slide');
 }
 const bones=[];actor.root.traverse(node=>{if(node.isBone)bones.push(node);});
 actor.mixer.setTime(0);
 const first=bones.map(bone=>({position:bone.position.clone(),rotation:bone.quaternion.clone()}));
 actor.mixer.setTime(duration-1e-6);
 bones.forEach((bone,i)=>{
  assert.ok(bone.position.distanceTo(first[i].position)<.001,bone.name+' jog position seam');
  assert.ok(bone.quaternion.angleTo(first[i].rotation)<.001,bone.name+' jog rotation seam');
 });
 action.reset();actor.mixer.setTime(0);
 const root=actor.root.getObjectByName('root_87'),origin=root.position.clone();
 let travelled=0,expected=0;
 for(let frame=0;frame<240;frame++){
  const dt=1/60,distance=frame>=100&&frame<130?0:frame<60?.018:.03;
  const before=action.time;syncLocomotionToDistance(actor,distance,dt);actor.mixer.update(dt);
  travelled+=distance;expected+=distance*duration/actor.jogCycleDistance;
  if(!distance)assert.equal(action.time,before,'jogs in place while waiting');
  assert.ok(root.position.distanceTo(origin)<1e-6,'jog root drift');
 }
 assert.ok(travelled>2*actor.jogCycleDistance,'multiple jogging loops were exercised');
 assert.ok(action.isRunning(),'jog stopped after its first loop');
 assert.ok(Math.abs(action.time-expected%duration)<1e-6,'jog phase differs from actual travelled distance');
});


test('jog knees stay forward and soles never invert between keys or during idle blends',async()=>{
 const actor=await achilles();actor.root.updateMatrixWorld(true);
 const legs=[['thigh_l_71','calf_l_69','foot_l_68','ball_l_67'],['thigh_r_78','calf_r_76','foot_r_75','ball_r_74']]
  .map(names=>names.map(name=>actor.root.getObjectByName(name)));
 const rest=new Map(legs.flat().map(bone=>[bone,bone.getWorldQuaternion(new Quaternion()).invert()]));
 const duration=actor.actions.Jog.getClip().duration;
 actor.actions.Jog.play();actor.actions.Idle.play();
 // The original regression flipped knees between baked keys, even though loop
 // closure and planted-toe checks passed. Exercise exported quaternion blends.
 for(const weight of [0,.25,.5,.75,1]){
  actor.actions.Jog.setEffectiveWeight(weight);actor.actions.Idle.setEffectiveWeight(1-weight);
  const previous=new Map();
  for(let step=0;step<=224;step++){
   actor.actions.Jog.time=duration*step/224;actor.actions.Idle.time=.3;
   actor.mixer.update(0);actor.root.updateMatrixWorld(true);
   for(const [hip,knee,foot,toe] of legs){
    const h=hip.getWorldPosition(new Vector3()),k=knee.getWorldPosition(new Vector3()),a=foot.getWorldPosition(new Vector3());
    const axis=a.sub(h).normalize(),bend=k.sub(h);bend.addScaledVector(axis,-bend.dot(axis));
    assert.ok(bend.z>-.005,`${knee.name} bends backwards at phase ${step}/224, blend ${weight}`);
    for(const bone of [foot,toe]){
     const q=bone.getWorldQuaternion(new Quaternion()),delta=q.clone().multiply(rest.get(bone));
     const up=new Vector3(0,1,0).applyQuaternion(delta),forward=new Vector3(0,0,1).applyQuaternion(delta);
     assert.ok(up.y>.15,`${bone.name} sole inverted at phase ${step}/224, blend ${weight}`);
     assert.ok(forward.z>.1,`${bone.name} toe points backwards at phase ${step}/224, blend ${weight}`);
     if(previous.has(bone))assert.ok(q.angleTo(previous.get(bone))<.15,`${bone.name} jumps between keys`);
     previous.set(bone,q);
    }
   }
  }
 }
});
