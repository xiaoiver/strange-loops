import { playCompanionAnimation as play } from './companion-animation.js';
import { syncLocomotionToDistance } from './companion-locomotion.js';
import { restoreCompanionGaze } from './companion-gaze.js';
import { updateCompanionPose } from './companion-rig.js';

// Developer controls change inputs, never reimplement the exhibition's mixer.
export function createCompanionPreview(actor, {paused = false} = {}) {
  let requestedSpeed = 0, speed = 0, distance = 0;
  return {
    actor, paused, manualWeight: null, gazeTarget: null,
    get speed() { return speed; }, get distance() { return distance; },
    setSpeed(value) { requestedSpeed = Math.max(0, Number.isFinite(value) ? value : 0); },
    select(name) {
      if (!actor.actions[name]) return false;
      play(actor, name);
      if (this.paused) this.seek(0);
      return true;
    },
    setManualWeight(value) {
      this.manualWeight = value === null ? null : Math.max(0, Math.min(1, value));
      if (value === null || !['Walk', 'Jog'].includes(actor.current)) return;
      actor.locomotionTransition = null;
      for (const [name, action] of Object.entries(actor.actions)) {
        action.stopFading().setEffectiveWeight(name === actor.current ? this.manualWeight : name === 'Idle' ? 1 - this.manualWeight : 0);
      }
      actor.actions.Idle?.play();
      updateCompanionPose(actor, 0, {target: this.gazeTarget, gaze: false});
    },
    seek(phase) {
      this.paused = true;
      restoreCompanionGaze(actor.gaze);
      const action = actor.actions[actor.current];
      if (!action) return;
      actor.locomotionTransition = null;
      for (const other of Object.values(actor.actions)) other.stopFading().setEffectiveWeight(other === action ? 1 : 0);
      action.enabled = true; action.play(); action.paused = false;
      action.time = Math.max(0, Math.min(1 - 1e-7, phase)) * action.getClip().duration;
      actor.clipAge = action.time;
      updateCompanionPose(actor, 0, {target: this.gazeTarget, gaze: Boolean(this.gazeTarget)});
    },
    reset() {
      const name = actor.current;
      restoreCompanionGaze(actor.gaze); actor.mixer.stopAllAction(); actor.current = null;
      speed = 0; distance = 0; play(actor, name);
      updateCompanionPose(actor, 0);
    },
    update(dt) {
      if (this.paused || dt <= 0) return;
      speed += (requestedSpeed - speed) * (1 - Math.exp(-dt * 6));
      if (Math.abs(speed - requestedSpeed) < 1e-5) speed = requestedSpeed;
      const moving = actor.current === 'Walk' || actor.current === 'Jog';
      if (moving) {
        const delta = speed * dt; distance += delta;
        syncLocomotionToDistance(actor, delta, dt);
        if (this.manualWeight !== null) {
          this.setManualWeight(this.manualWeight);
        }
      }
      updateCompanionPose(actor, dt, {target: this.gazeTarget, gaze: !moving && Boolean(this.gazeTarget)});
    },
  };
}
