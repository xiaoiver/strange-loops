// A short ease at either end, with an even travelling pace through the room.
// The integral of this velocity curve is exactly one, regardless of path length.
export function walkProgress(value) {
  const t=Math.max(0,Math.min(1,value)),ramp=.2,peak=1/(1-ramp);
  if(t<ramp)return peak*.5*(t-ramp/Math.PI*Math.sin(Math.PI*t/ramp));
  if(t>1-ramp)return 1-walkProgress(1-t);
  return peak*(t-ramp*.5);
}

export function syncWalkToDistance(actor,distance,dt) {
  if(!actor.walkCycleDistance||dt<=0)return;
  const walk=actor.actions.Walk,idle=actor.actions.Idle;
  const seconds=walk.getClip().duration,speed=Math.max(0,distance)/dt;
  // Root travel and stance-foot travel cancel, even during acceleration.
  walk.setEffectiveTimeScale(speed*seconds/actor.walkCycleDistance);
  const weight=Math.min(1,speed/(actor.walkCycleDistance/seconds*.55));
  walk.stopFading().setEffectiveWeight(weight);
  if(idle){idle.enabled=true;idle.play();idle.stopFading().setEffectiveWeight(1-weight);}
}
