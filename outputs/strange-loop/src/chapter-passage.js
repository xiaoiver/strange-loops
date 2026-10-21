// World-space thresholds shared by architecture and the companions' routes.
export const GARDEN_EXIT = Object.freeze({ x:-3.8, z:-1.3, halfWidth:.76, depth:.72 });
export const GALLERY_ENTRY = Object.freeze({ x:-6.9, z:10.4, halfWidth:.9, depth:.9 });
export function exitRoute(start, index) {
  const {x,z,depth}=GARDEN_EXIT;
  return [start, [x+1.35,z+(index===0?-.12:.12)], [x+.15,z], [x-depth-.4,z]];
}
export function entryRoute(index, mobile=false) {
  const {x,z,depth}=GALLERY_ENTRY;
  const end=mobile?(index===0?[-2.5,.9]:[-1.5,1.2]):(index===0?[-3,3.9]:[-1.9,4.3]);
  return [[x-depth+.15,z], [x+.7,z], [-5,7+index*.35], end];
}
// Interpolate by travelled distance, so crossing the threshold does not pause a walk.
export function routeSample(points, progress) {
  const lengths=points.slice(1).map((p,i)=>Math.hypot(p[0]-points[i][0],p[1]-points[i][1]));
  const total=lengths.reduce((a,b)=>a+b,0);
  let distance=Math.max(0,Math.min(1,progress))*total;
  for(let i=0;i<lengths.length;i++) {
    if(distance<=lengths[i]||i===lengths.length-1){
      const t=lengths[i]?Math.min(1,distance/lengths[i]):1,a=points[i],b=points[i+1];
      return {x:a[0]+(b[0]-a[0])*t,z:a[1]+(b[1]-a[1])*t,dx:b[0]-a[0],dz:b[1]-a[1],length:total};
    }
    distance-=lengths[i];
  }
  return {x:points[0][0],z:points[0][1],dx:0,dz:0,length:0};
}
