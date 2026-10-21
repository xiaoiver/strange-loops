import { PILE_FLOOR } from './letter-pile-config.js';

// Keep the foot of the mound in place; lift the upper third into a loose cloud.
// The physics worker takes over these exact poses once the room has appeared.
export function pileArrival(rest){
  const poses=new Float32Array(rest);
  const upper=Array.from({length:poses.length/7},(_,i)=>i).sort((a,b)=>poses[b*7+1]-poses[a*7+1]).slice(0,Math.ceil(poses.length/21));
  for(const i of upper){
    const y=i*7+1;
    poses[y]+=1.8+(poses[y]-PILE_FLOOR)*.25;
  }
  return poses;
}
