import { LoopOnce, LoopRepeat } from 'three';

const BLEND_DURATION = .35;

export function playCompanionAnimation(actor, name) {
  if (actor.current === name) return;
  const action = actor.actions[name];
  if (!action) return;
  const previous = actor.actions[actor.current];
  // Distance-driven deceleration has already blended fully into this running
  // Idle. Starting another fade would briefly remove both poses at the stop.
  if (name === 'Idle' && (actor.current === 'Walk' || actor.current === 'Jog') && (actor.walkCycleDistance || actor.jogCycleDistance) &&
      action.isRunning() && action.getEffectiveWeight() > .999) {
    previous?.stopFading().setEffectiveWeight(0);
    action.stopFading().setEffectiveWeight(1).setEffectiveTimeScale(1);
    actor.current = name;
    actor.clipAge = 0;
    return;
  }
  // Equal fade durations keep the total weight at one. A gap blends in the
  // rig's open-arm rest pose, making Look → Idle appear to fold the arms again.
  previous?.fadeOut(BLEND_DURATION);
  const looping = name === 'Walk' || name === 'Jog' || name === 'Idle';
  action.reset().setLoop(looping ? LoopRepeat : LoopOnce, looping ? Infinity : 1);
  action.clampWhenFinished = !looping;
  action.setEffectiveTimeScale(1).setEffectiveWeight(1);
  if (previous) action.fadeIn(BLEND_DURATION);
  // No initial fade: reduced-motion viewers sample once at dt=0 and freeze.
  action.play();
  actor.current = name;
  actor.clipAge = 0;
}
