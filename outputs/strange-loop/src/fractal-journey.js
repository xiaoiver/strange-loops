export const PORTAL_Z=1.505;
export const INTERIOR_SCALE=8;
export const CELL_SIZE=36;
export const CRUISE_SPEED=6;
export const PHASE_RATES=Object.freeze({angle:.47,spin:1.37,scale:.83,bendX:CELL_SIZE*.019,bendY:CELL_SIZE*.013});
export const BEND=Object.freeze({x:2.4,y:1.25,kx:.019,ky:.013});
const TAU=Math.PI*2;
const wrap=value=>((value%TAU)+TAU)%TAU;
export const smooth=(a,b,value)=>{const t=Math.max(0,Math.min(1,(value-a)/(b-a)));return t*t*(3-2*t);};

// An invertible camera rail, shared by playback, reverse and manual scrubbing.
// The interior uses a different metric, not a larger mesh hidden in the cube.
export function sampleJourney(value){
  const p=Math.max(0,Math.min(1,value)),align=smooth(0,.32,p);
  const z=8-14*p;
  return {position:[3.2*(1-align),1.8*(1-align)+.12*align,z],
    target:[0,.08,1.5-14*align],inside:z<PORTAL_Z,progress:p};
}
export function previewResolution(width,height,dpr=1,quality=1){
  const mobile=width<=760,budget=mobile?390000:860000;
  const ratio=Math.min(dpr,mobile?1:1.25,Math.sqrt(budget/(width*height)))*quality;
  return {width:Math.max(1,Math.round(width*ratio)),height:Math.max(1,Math.round(height*ratio))};
}

export function createTravelFrame(worldZ){
  const cell=Math.floor((worldZ+CELL_SIZE/2)/CELL_SIZE);
  const frame={localZ:worldZ-cell*CELL_SIZE,wraps:0};
  for(const [key,rate] of Object.entries(PHASE_RATES))frame[key]=wrap(cell*rate);
  return frame;
}
export const END_INTERIOR_Z=(sampleJourney(1).position[2]-PORTAL_Z)*INTERIOR_SCALE;

// Reuse one small state object forever. Only bounded local coordinates and
// wrapped phases reach the GPU; there is no growing world position or history.
export function advanceTravel(frame,distance){
  const z=frame.localZ-distance,shift=Math.floor((z+CELL_SIZE/2)/CELL_SIZE);
  frame.localZ=z-shift*CELL_SIZE;
  if(shift){
    for(const [key,rate] of Object.entries(PHASE_RATES))frame[key]=wrap(frame[key]+shift*rate);
    frame.wraps=(frame.wraps+Math.abs(shift))%1e9;
  }
  return frame;
}
export function bendAt(frame,z){
  return [BEND.x*Math.sin(z*BEND.kx+frame.bendX),BEND.y*Math.sin(z*BEND.ky+frame.bendY)];
}
export function cruiseCamera(frame){
  const at=bendAt(frame,frame.localZ),ahead=bendAt(frame,frame.localZ-8);
  const v=[ahead[0]-at[0],ahead[1]-at[1],-8],length=Math.hypot(...v);
  return {position:[at[0],at[1]+.96,frame.localZ],forward:v.map(n=>n/length)};
}

// Starts at rest and arrives with a forward tangent, so the entry hands off
// to cruising instead of coming to a halt at the former 14-second endpoint.
export function entryEase(t,terminalSlope=.75){
  const p=Math.max(0,Math.min(1,t));
  if(p===0||p===1)return p;
  return (10-4*terminalSlope)*p**3+(7*terminalSlope-15)*p**4+(6-3*terminalSlope)*p**5;
}
