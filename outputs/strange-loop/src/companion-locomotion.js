// A short ease at either end, with an even travelling pace through the room.
// The integral of this velocity curve is exactly one, regardless of path length.
export function walkProgress(value) {
  const t=Math.max(0,Math.min(1,value)),ramp=.2,peak=1/(1-ramp);
  if(t<ramp)return peak*.5*(t-ramp/Math.PI*Math.sin(Math.PI*t/ramp));
  if(t>1-ramp)return 1-walkProgress(1-t);
  return peak*(t-ramp*.5);
}

export function syncLocomotionToDistance(actor,distance,dt) {
  if(dt<=0)return;
  const name=actor.current==='Jog'?'Jog':'Walk';
  const stride=name==='Jog'?actor.jogCycleDistance:actor.walkCycleDistance;
  const motion=actor.actions[name],idle=actor.actions.Idle;
  if(!motion)return;
  // The tortoise keeps its own walking clip; only its passage cadence speeds up.
  if(!stride){motion.setEffectiveTimeScale(actor.gaitRate??1);return;}
  const seconds=motion.getClip().duration,speed=Math.max(0,distance)/dt;
  motion.setEffectiveTimeScale(speed*seconds/stride);
  const blend=Math.min(1,speed/(stride/seconds*.3));
  const weight=blend*blend*(3-2*blend);
  motion.stopFading().setEffectiveWeight(weight);
  if(idle){idle.enabled=true;idle.play();idle.stopFading().setEffectiveWeight(1-weight);}
}
