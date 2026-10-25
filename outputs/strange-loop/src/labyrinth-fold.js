// A finite architectural recursion. The camera remains upright while the rooms change.
export const MODEL_ORIGIN = [2.8, -2.45, -10];
export const MODEL_SCALE = .24;
export const ROOM_SCALE = 1.15;
export const CHILD_SCALE = .87;
export const FOLD_DURATION = [0,3.8,4.2];
const mix=(a,b,t)=>a+(b-a)*t;
export const foldEase=t=>{const p=Math.max(0,Math.min(1,t));return p*p*p*(p*(p*6-15)+10);};
export function foldLayout(level){
 const first=Math.max(0,Math.min(1,level)),second=Math.max(0,Math.min(1,level-1));
 return {first,second,roomScale:mix(MODEL_SCALE,ROOM_SCALE,first),roomY:mix(MODEL_ORIGIN[1],-3.78,first),
  tableScale:mix(1,6,first),tableY:mix(-3.8,-2.6,first),
  childScale:mix(.4,CHILD_SCALE,second),childAngle:mix(Math.PI/2,0,second),
  childX:mix(-4.7,0,second),childY:.035,childZ:mix(-6.5,6,second)};
}
