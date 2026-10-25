import { MathUtils, Quaternion, Vector3 } from 'three';

// Explicit mapping for the shipped POLLO28 rig. Never match an arbitrary mesh
// or auxiliary bone by a broad "head" prefix. Tortoise keeps its authored clips.
const BONES = [['neck_01_59', .2], ['neck_02_58', .25], ['head_57', .55]];
const YAW_LIMIT = MathUtils.degToRad(28), PITCH_LIMIT = MathUtils.degToRad(12);

export function createCompanionGaze(root, id) {
  if (id !== 'achilles') return null;
  const bones = BONES.map(([name, share]) => ({bone: root.getObjectByName(name), share}));
  if (bones.some(entry => !entry.bone?.isBone)) return null;
  return {
    root, bones: bones.map(entry => ({...entry, base: entry.bone.quaternion.clone()})),
    yaw: 0, pitch: 0, applied: false,
    position: new Vector3(), direction: new Vector3(), world: new Quaternion(),
    parent: new Quaternion(), delta: new Quaternion(), local: new Quaternion(), inverse: new Quaternion(),
    up: new Vector3(0, 1, 0), right: new Vector3(1, 0, 0),
  };
}

// Undo the procedural layer before the mixer samples the authored animation.
// This also makes unkeyed bones safe: no offset is fed back into the next frame.
export function restoreCompanionGaze(gaze) {
  if (!gaze?.applied) return;
  for (const {bone, base} of gaze.bones) bone.quaternion.copy(base);
  gaze.applied = false;
}

export function applyCompanionGaze(gaze, target, dt, {enabled = true, reduced = false} = {}) {
  if (!gaze) return;
  restoreCompanionGaze(gaze);
  for (const {bone, base} of gaze.bones) base.copy(bone.quaternion);
  let yaw = 0, pitch = 0;
  gaze.root.updateWorldMatrix(true, true);
  if (enabled && target && !reduced) {
    gaze.bones.at(-1).bone.getWorldPosition(gaze.position);
    gaze.root.getWorldQuaternion(gaze.world);
    gaze.inverse.copy(gaze.world).invert();
    gaze.direction.subVectors(target, gaze.position).applyQuaternion(gaze.inverse);
    const rawYaw = Math.atan2(gaze.direction.x, gaze.direction.z);
    // A target behind the actor belongs to the body's turn, not a twisted neck.
    if (Math.abs(rawYaw) < Math.PI * .65 && gaze.direction.lengthSq() > 1e-8) {
      yaw = MathUtils.clamp(rawYaw, -YAW_LIMIT, YAW_LIMIT);
      pitch = MathUtils.clamp(-Math.atan2(gaze.direction.y, Math.hypot(gaze.direction.x, gaze.direction.z)), -PITCH_LIMIT, PITCH_LIMIT);
    }
  }
  const alpha = reduced ? 1 : 1 - Math.exp(-Math.max(0, dt) * 7);
  gaze.yaw += (yaw - gaze.yaw) * alpha;
  gaze.pitch += (pitch - gaze.pitch) * alpha;
  if (Math.abs(gaze.yaw) + Math.abs(gaze.pitch) < 1e-7) return;
  gaze.root.getWorldQuaternion(gaze.world);
  gaze.inverse.copy(gaze.world).invert();
  for (const {bone, base, share} of gaze.bones) {
    bone.parent.getWorldQuaternion(gaze.parent);
    gaze.delta.setFromAxisAngle(gaze.up, gaze.yaw * share);
    gaze.local.setFromAxisAngle(gaze.right, gaze.pitch * share);
    gaze.delta.multiply(gaze.local);
    // Actor-space delta -> world -> this bone's parent-local coordinates.
    gaze.local.copy(gaze.parent).invert().multiply(gaze.world).multiply(gaze.delta)
      .multiply(gaze.inverse).multiply(gaze.parent);
    bone.quaternion.copy(gaze.local).multiply(base);
    bone.updateWorldMatrix(false, true);
  }
  gaze.applied = true;
}

export function companionBodyYaw(currentYaw, targetYaw, hasGaze) {
  const difference = Math.atan2(Math.sin(targetYaw - currentYaw), Math.cos(targetYaw - currentYaw));
  return currentYaw + difference - (hasGaze ? MathUtils.clamp(difference, -.25, .25) : 0);
}
