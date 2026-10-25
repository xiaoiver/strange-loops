import { LoopOnce, LoopRepeat } from 'three';

const BLEND_DURATION = .35;
const locomotion = name => name === 'Walk' || name === 'Jog';
// Mid-support landmarks measured on the shipped Formal / Jog clips (see tests).
const LEFT_SUPPORT = {Walk: .35, Jog: 4 / 28};

export function alignedLocomotionTime(previous, next, from, to) {
  const phase = previous.time / previous.getClip().duration;
  return ((phase - LEFT_SUPPORT[from] + LEFT_SUPPORT[to] + 1) % 1) * next.getClip().duration;
}

export function playCompanionAnimation(actor, name) {
  if (actor.current === name) return;
  const action = actor.actions[name];
  if (!action) return;
  const previous = actor.actions[actor.current];
  if (locomotion(name) && (name === 'Jog' ? actor.jogCycleDistance : actor.walkCycleDistance)) {
    const time = locomotion(actor.current) && previous ? alignedLocomotionTime(previous, action, actor.current, name) : 0;
    const weights = Object.fromEntries(Object.entries(actor.actions).map(([key, value]) =>
      [key, value.enabled && value.isScheduled() ? value.getEffectiveWeight() : 0]));
    const total = Object.values(weights).reduce((sum, value) => sum + value, 0);
    for (const key of Object.keys(weights)) weights[key] = total > 0 ? weights[key] / total : key === name ? 1 : 0;
    for (const value of Object.values(actor.actions)) value.stopFading();
    action.reset().setLoop(LoopRepeat, Infinity).setEffectiveTimeScale(1).setEffectiveWeight(weights[name]);
    action.time = time; action.clampWhenFinished = false; action.play();
    actor.locomotionTransition = previous ? {elapsed: 0, duration: BLEND_DURATION, weights} : null;
    actor.current = name; actor.clipAge = 0;
    return;
  }
  actor.locomotionTransition = null;
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
  for (const value of Object.values(actor.actions)) if (value !== action && value.isScheduled()) value.fadeOut(BLEND_DURATION);
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
