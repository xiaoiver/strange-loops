import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { AnimationMixer, Quaternion, Vector3 } from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { playCompanionAnimation as play, alignedLocomotionTime } from '../src/companion-animation.js';
import { syncLocomotionToDistance, walkProgress } from '../src/companion-locomotion.js';
import { createCompanionGaze, restoreCompanionGaze, applyCompanionGaze, companionBodyYaw } from '../src/companion-gaze.js';
import { createCompanionActor, updateCompanionPose } from '../src/companion-rig.js';
import { createCompanionPreview } from '../src/companion-preview-controller.js';

async function achilles() {
  // Exercise the shipped rig and clips without needing a GPU or Draco mesh decode.
  // Keep all animation accessors and the original binary buffer intact.
  const raw = await readFile(process.env.ACHILLES_TEST_GLB || new URL('../assets/characters/achilles.glb', import.meta.url));
  const jsonLength = raw.readUInt32LE(12);
  const json = JSON.parse(raw.subarray(20, 20 + jsonLength));
  for (const node of json.nodes) { delete node.mesh; delete node.skin; }
  // Keep joint definitions so GLTFLoader constructs real Bones. Mesh decoding
  // is still unnecessary; deleting skins made bone-only seam loops vacuous.
  delete json.meshes;
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
  return { gltf, root:gltf.scene, mixer, actions, arms, walkCycleDistance:metadata.walk_cycle_distance*.6, jogCycleDistance:metadata.jog_cycle_distance*.6, metadata, current: null, clipAge: 0 };
}

test('distance-driven starts preserve the fade and all scheduled pose weights sum to one', async () => {
  const actor = await achilles(); play(actor, 'Idle'); actor.mixer.update(.4); play(actor, 'Walk');
  let previousWeight = 0;
  for (let frame = 0; frame < 30; frame++) {
    syncLocomotionToDistance(actor, .8 / 60, 1 / 60); actor.mixer.update(1 / 60);
    const weight = actor.actions.Walk.getEffectiveWeight();
    if (!frame) assert.ok(weight < .05, 'distance update skipped the fade');
    assert.ok(weight >= previousWeight - 1e-8); previousWeight = weight;
    const total = Object.values(actor.actions).filter(action => action.isScheduled() && action.enabled).reduce((sum, action) => sum + action.getEffectiveWeight(), 0);
    assert.ok(Math.abs(total - 1) < 1e-6, `pose weight sum ${total}`);
  }
  assert.equal(actor.actions.Walk.getEffectiveWeight(), 1);
});

test('natural walking arms have a visible counter-swing synchronized to the opposite leg', async () => {
  const actor = await achilles();
  assert.equal(actor.metadata.walk_upper_body_source_clip, 'Walk_Loop');
  assert.equal(actor.metadata.walk_upper_body_license, 'CC0-1.0');
  const wrists = ['hand_l_21', 'hand_r_49'].map(name => actor.root.getObjectByName(name));
  const feet = ['foot_l_68', 'foot_r_75'].map(name => actor.root.getObjectByName(name));
  assert.ok(wrists.every(Boolean)); play(actor, 'Walk');
  const samples = [];
  for (let step = 0; step < 80; step++) {
    actor.actions.Walk.time = actor.actions.Walk.getClip().duration * step / 80;
    actor.mixer.update(0); actor.root.updateMatrixWorld(true);
    samples.push({hands:wrists.map(bone => bone.getWorldPosition(new Vector3()).z),feet:feet.map(bone => bone.getWorldPosition(new Vector3()).z)});
  }
  for (let side = 0; side < 2; side++) {
    const hands = samples.map(sample => sample.hands[side]), feet = samples.map(sample => sample.feet[side]);
    const mean = values => values.reduce((sum, value) => sum + value, 0) / values.length;
    const handMean = mean(hands), footMean = mean(feet);
    assert.ok(Math.max(...hands) - Math.min(...hands) > .35, 'arm swing remains too small');
    const covariance = hands.reduce((sum, value, i) => sum + (value - handMean) * (feet[i] - footMean), 0);
    assert.ok(covariance < 0, 'same-side arm and leg should counter-swing');
  }
});

test('walking knees keep a stable forward bend and avoid the near-straight support snap', async () => {
  const actor = await achilles(); play(actor, 'Walk');
  assert.equal(actor.metadata.walk_soft_knee_hip_drop, .025);
  const legs = [['thigh_l_71', 'calf_l_69', 'foot_l_68'], ['thigh_r_78', 'calf_r_76', 'foot_r_75']]
    .map(names => names.map(name => actor.root.getObjectByName(name)));
  const previous = new Map();
  for (let step = 0; step <= 640; step++) {
    actor.actions.Walk.time = actor.actions.Walk.getClip().duration * step / 640;
    actor.mixer.update(0); actor.root.updateMatrixWorld(true);
    for (const [hip, knee, foot] of legs) {
      const h = hip.getWorldPosition(new Vector3()), k = knee.getWorldPosition(new Vector3()), a = foot.getWorldPosition(new Vector3());
      const axis = a.sub(h).normalize(), bend = k.sub(h); bend.addScaledVector(axis, -bend.dot(axis));
      // The former right knee approached 0.0066 model units from straight.
      assert.ok(bend.z > .08, `${knee.name} locks or changes bending plane at ${step}/640`);
      for (const bone of [hip, knee]) {
        const q = bone.getWorldQuaternion(new Quaternion());
        if (previous.has(bone)) assert.ok(q.angleTo(previous.get(bone)) < .011, `${bone.name} snaps at ${step}/640`);
        previous.set(bone, q);
      }
    }
  }
});

test('light jog keeps the trunk upright and limits the pelvis bounce without raising the arms into a T-pose', async () => {
  const actor = await achilles(); play(actor, 'Jog');
  assert.ok(actor.metadata.jog_posture?.includes('upright light jog'));
  const hips = [];
  for (let step = 0; step <= 224; step++) {
    actor.actions.Jog.time = actor.actions.Jog.getClip().duration * step / 224;
    actor.mixer.update(0); actor.root.updateMatrixWorld(true);
    const hip = actor.root.getObjectByName('pelvis_79').getWorldPosition(new Vector3());
    const neck = actor.root.getObjectByName('neck_01_59').getWorldPosition(new Vector3());
    hips.push(hip.y);
    const direction = neck.clone().sub(hip), lean = Math.atan2(direction.z, direction.y) * 180 / Math.PI;
    assert.ok(lean > -3 && lean < 8, `trunk leans ${lean} degrees at ${step}/224`);
    for (const name of ['hand_l_21', 'hand_r_49']) {
      const wrist = actor.root.getObjectByName(name).getWorldPosition(new Vector3());
      assert.ok(wrist.y < neck.y - .15, 'running arm lost its lowered neutral posture');
    }
    for (const [shoulderName, elbowName] of [['upperarm_l_27', 'lowerarm_l_24'], ['upperarm_r_55', 'lowerarm_r_52']]) {
      const shoulder = actor.root.getObjectByName(shoulderName).getWorldPosition(new Vector3());
      const elbow = actor.root.getObjectByName(elbowName).getWorldPosition(new Vector3());
      const arm = elbow.sub(shoulder);
      assert.ok(Math.abs(arm.x) / arm.length() < .62, 'jogging elbow flares too far out');
    }
  }
  assert.ok(Math.max(...hips) - Math.min(...hips) < .12, 'pelvis still has the full-stride running bounce');
});

test('Walk and Jog align support phase and survive an interrupted blend without over-weighting', async () => {
  const actor = await achilles(); play(actor, 'Walk');
  for (const phase of [.1, .35, .6, .85]) {
    actor.actions.Walk.time = actor.actions.Walk.getClip().duration * phase; actor.current = 'Walk';
    const expected = alignedLocomotionTime(actor.actions.Walk, actor.actions.Jog, 'Walk', 'Jog');
    play(actor, 'Jog'); assert.ok(Math.abs(actor.actions.Jog.time - expected) < 1e-8);
    for (let frame = 0; frame < 8; frame++) {syncLocomotionToDistance(actor, 1.2 / 60, 1 / 60); actor.mixer.update(1 / 60);}
    const reverse = alignedLocomotionTime(actor.actions.Jog, actor.actions.Walk, 'Jog', 'Walk');
    play(actor, 'Walk'); assert.ok(Math.abs(actor.actions.Walk.time - reverse) < 1e-8);
    for (let frame = 0; frame < 30; frame++) {
      syncLocomotionToDistance(actor, 1.2 / 60, 1 / 60); actor.mixer.update(1 / 60);
      const total = Object.values(actor.actions).filter(action => action.isScheduled() && action.enabled).reduce((sum, action) => sum + action.getEffectiveWeight(), 0);
      assert.ok(Math.abs(total - 1) < 1e-6, `interrupted pose weight sum ${total}`);
    }
  }
});

test('gaze only layers head and neck, preserves folded arms and never accumulates', async () => {
  const actor = await achilles(); play(actor, 'Idle'); actor.mixer.update(.5);
  actor.gaze = createCompanionGaze(actor.root, 'achilles'); assert.equal(actor.gaze.bones.length, 3);
  const folded = actor.arms.map(bone => bone.quaternion.clone()), head = actor.root.getObjectByName('head_57');
  const target = head.getWorldPosition(new Vector3()).add(new Vector3(3, 1, 5));
  for (let frame = 0; frame < 180; frame++) {
    restoreCompanionGaze(actor.gaze); actor.mixer.update(0); applyCompanionGaze(actor.gaze, target, 1 / 60);
    assert.ok(Math.abs(actor.gaze.yaw) <= 28 * Math.PI / 180 + 1e-6);
    assert.ok(Math.abs(actor.gaze.pitch) <= 12 * Math.PI / 180 + 1e-6);
    actor.arms.forEach((bone, i) => bone.quaternion.toArray().forEach((value, j) => assert.ok(Math.abs(value - folded[i].toArray()[j]) < 1e-7)));
  }
  const settled = head.quaternion.clone();
  for (let frame = 0; frame < 180; frame++) {
    restoreCompanionGaze(actor.gaze); actor.mixer.update(0); applyCompanionGaze(actor.gaze, target, 1 / 60);
  }
  assert.ok(head.quaternion.angleTo(settled) < 1e-5, 'gaze fed back into the next pose');
  applyCompanionGaze(actor.gaze, target, 1 / 60, {reduced:true});
  assert.equal(actor.gaze.yaw, 0); assert.equal(actor.gaze.pitch, 0);
  assert.ok(head.quaternion.angleTo(actor.gaze.bones.at(-1).base) < 1e-6);
  assert.equal(createCompanionGaze(actor.root, 'tortoise'), null);
});

test('shipped feet stay forward and soles stay upright throughout live Walk/Jog crossfades', async () => {
  const actor = await achilles();
  const feet = ['foot_l_68', 'foot_r_75'].map(name => actor.root.getObjectByName(name));
  assert.ok(feet.every(Boolean));
  actor.root.updateMatrixWorld(true);
  const rest = new Map(feet.map(foot => [foot, foot.getWorldQuaternion(new Quaternion()).invert()]));
  for (const from of ['Walk', 'Jog']) for (const phase of [.05, .3, .55, .8]) {
    actor.mixer.stopAllAction(); actor.current = null; play(actor, from);
    actor.actions[from].time = phase * actor.actions[from].getClip().duration;
    actor.mixer.update(0); play(actor, from === 'Walk' ? 'Jog' : 'Walk');
    for (let frame = 0; frame < 30; frame++) {
      syncLocomotionToDistance(actor, 1.2 / 60, 1 / 60); actor.mixer.update(1 / 60); actor.root.updateMatrixWorld(true);
      for (const foot of feet) {
        const rotation = foot.getWorldQuaternion(new Quaternion()).multiply(rest.get(foot));
        const up = new Vector3(0, 1, 0).applyQuaternion(rotation);
        const forward = new Vector3(0, 0, 1).applyQuaternion(rotation);
        // Formal's toe-off approaches vertical; unlike the compact jog, it
        // should not inherit the stricter 0.15 jog-only clearance threshold.
        assert.ok(up.y > 0, `${foot.name} inverted: phase=${phase}, frame=${frame}, ${from}`);
        assert.ok(forward.z > 0, `${foot.name} backwards during ${from} transition`);
      }
    }
  }
});

test('shared pose update preserves reduced-motion idle and returns Look to Idle with gaze active', async () => {
  const fixture = await achilles(), actor = createCompanionActor(fixture.gltf, {id:'achilles', scale:.6});
  assert.ok(actor.gaze, 'shipped GLB has the expected head and neck joints');
  assert.ok(Math.abs(actor.walkCycleDistance - fixture.walkCycleDistance) < 1e-8);
  play(actor, 'Idle'); updateCompanionPose(actor, 0, {reduced:true});
  const folded = fixture.arms.map(bone => bone.quaternion.clone()); play(actor, 'Look');
  for (let frame = 0; frame < 180; frame++) updateCompanionPose(actor, 1 / 60, {gaze:true,target:new Vector3(.5, 1.5, 2)});
  assert.equal(actor.current, 'Idle');
  fixture.arms.forEach((bone, i) => assert.ok(bone.quaternion.angleTo(folded[i]) < .001));
  assert.equal(companionBodyYaw(0, .15, true), 0);
  assert.equal(companionBodyYaw(0, .15, false), .15);
});

test('preview pause, scrub and manual blend preserve production clip phases', async () => {
  const actor = await achilles(), preview = createCompanionPreview(actor, {paused:true});
  assert.equal(preview.select('Walk'), true); preview.setSpeed(.8); preview.update(1);
  assert.equal(actor.actions.Walk.time, 0);
  preview.seek(.35); assert.ok(Math.abs(actor.actions.Walk.time / actor.actions.Walk.getClip().duration - .35) < 1e-8);
  const pausedTime = actor.actions.Walk.time; preview.setManualWeight(.4);
  assert.equal(actor.actions.Walk.getEffectiveWeight(), .4); assert.equal(actor.actions.Idle.getEffectiveWeight(), .6);
  assert.equal(actor.actions.Walk.time, pausedTime);
  preview.setManualWeight(null); preview.paused = false;
  for (let frame = 0; frame < 60; frame++) preview.update(1 / 60);
  assert.ok(preview.distance > 0); assert.notEqual(actor.actions.Walk.time, pausedTime);
  preview.paused = true; const stopped = actor.actions.Walk.time; preview.update(1);
  assert.equal(actor.actions.Walk.time, stopped); assert.equal(preview.select('Missing'), false);
  preview.reset(); assert.equal(actor.actions.Walk.time, 0); assert.equal(preview.distance, 0);
});

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
  assert.ok(bones.length >= 70, 'seam checks must exercise the actual skeleton');
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
 assert.ok(bones.length >= 70, 'jog seam checks must exercise the actual skeleton');
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
