import { LoopOnce, LoopRepeat } from 'three';

const BLEND_DURATION = .35;

export function playCompanionAnimation(actor, name) {
  if (actor.current === name) return;
  const action = actor.actions[name];
  if (!action) return;
  const previous = actor.actions[actor.current];
  // Equal fade durations keep the total weight at one. A gap blends in the
  // rig's open-arm rest pose, making Look → Idle appear to fold the arms again.
  previous?.fadeOut(BLEND_DURATION);
  const looping = name === 'Walk' || name === 'Idle';
  action.reset().setLoop(looping ? LoopRepeat : LoopOnce, looping ? Infinity : 1);
  action.clampWhenFinished = !looping;
  action.setEffectiveWeight(1);
  if (previous) action.fadeIn(BLEND_DURATION);
  // No initial fade: reduced-motion viewers sample once at dt=0 and freeze.
  action.play();
  actor.current = name;
  actor.clipAge = 0;
}
