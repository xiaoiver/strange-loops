import { AnimationMixer, Group } from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { DRACOLoader } from 'three/addons/loaders/DRACOLoader.js';
import { playCompanionAnimation as play } from './companion-animation.js';
import { createCompanionGaze, restoreCompanionGaze, applyCompanionGaze } from './companion-gaze.js';

export const COMPANION_ASSETS = Object.freeze({achilles: 'upright-jog-soft-knees2', tortoise: 'tripo2'});

export async function loadCompanionAssets(ids) {
  const loader = new GLTFLoader(), draco = new DRACOLoader();
  draco.setDecoderPath('assets/draco/'); loader.setDRACOLoader(draco);
  try {
    return await Promise.all(ids.map(id => loader.loadAsync(`assets/characters/${id}.glb?v=${COMPANION_ASSETS[id]}`)));
  } finally { draco.dispose(); }
}

export function createCompanionActor(gltf, {id, scale = 1}) {
  const root = new Group(); root.name = `companion-${id}`;
  root.add(gltf.scene); root.scale.setScalar(scale);
  const mixer = new AnimationMixer(gltf.scene), actions = {};
  for (const clip of gltf.animations) actions[clip.name.split('_').at(-1)] = mixer.clipAction(clip);
  let walkCycleDistance, jogCycleDistance;
  gltf.scene.traverse(node => {
    if (node.userData.walk_cycle_distance > 0 && Number.isFinite(node.userData.walk_cycle_distance)) walkCycleDistance = node.userData.walk_cycle_distance * scale;
    if (node.userData.jog_cycle_distance > 0 && Number.isFinite(node.userData.jog_cycle_distance)) jogCycleDistance = node.userData.jog_cycle_distance * scale;
  });
  return {id, root, mixer, actions, walkCycleDistance, jogCycleDistance,
    gaze: createCompanionGaze(root, id), clipAge: 0, current: null, gaitRate: 1};
}

// The exhibition and the developer preview use exactly the same pose ordering.
export function updateCompanionPose(actor, dt, {target, gaze = false, reduced = false} = {}) {
  restoreCompanionGaze(actor.gaze);
  actor.mixer.update(reduced ? 0 : dt);
  if (!reduced) actor.clipAge += dt;
  applyCompanionGaze(actor.gaze, target, dt, {enabled: gaze, reduced});
  if (!reduced && actor.current === 'Look' && actor.clipAge >= actor.actions.Look.getClip().duration) play(actor, 'Idle');
}
