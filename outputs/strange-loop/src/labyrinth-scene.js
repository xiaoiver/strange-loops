import * as THREE from 'three';
import {applySoftShadows} from './soft-shadows.js';
import {createFairFacedConcrete} from './fair-faced-concrete.js';
import {createMengerArchitecture} from './menger-architecture.js';
import {MODEL_ORIGIN,MODEL_SCALE} from './labyrinth-fold.js';
import {createFractalSpace} from './fractal-space.js';
import {PORTAL_Z,INTERIOR_SCALE,END_INTERIOR_Z,CRUISE_SPEED,createTravelFrame,advanceTravel,cruiseCamera,entryEase,smooth} from './fractal-journey.js';
export {MODEL_ORIGIN,MODEL_SCALE} from './labyrinth-fold.js';
const ease=t=>t*t*(3-2*t);
const mobile=()=>innerWidth<=760;
export const CONTOUR_CROSSING=[[0,1.15,4.2],[0,1.05,1.2],[0,1.0,-.6],[0,.95,-1.8]];

export function passageRail(start,end,returning=false) {
  const portal=CONTOUR_CROSSING.map(p=>{
    const point=new THREE.Vector3(...p);
    const progress=THREE.MathUtils.clamp((point.z-start.z)/(end.z-start.z||1),0,1);
    point.y=THREE.MathUtils.lerp(start.y,end.y,progress);
    return point;
  });
  const points=returning?[start,...portal.reverse(),end]:[start,...portal,end];
  const distinct=points.filter((p,i)=>!i||p.distanceToSquared(points[i-1])>1e-8);
  const curve=new THREE.CatmullRomCurve3(distinct,false,'centripetal');
  curve.arcLengthDivisions=600;
  return curve;
}

export function createLabyrinthScene(scene,reduced,invalidate,onTravel=()=>{}){
  const group=new THREE.Group();group.name='harmonic-labyrinth';group.visible=false;scene.add(group);
  const shell=createFairFacedConcrete({space:'local'});shell.shadowSide=THREE.DoubleSide;applySoftShadows(shell,mobile());
  const parent=new THREE.Group();parent.name='fractal-cube';parent.position.set(...MODEL_ORIGIN);parent.scale.setScalar(MODEL_SCALE);parent.rotation.y=.64;group.add(parent);
  const body=createMengerArchitecture({depth:2,size:14,material:shell,name:'menger-parent'});parent.add(body.group);
  const space=createFractalSpace(parent);
  const sun=new THREE.DirectionalLight(0xf3f3ee,1.45);
  sun.position.set(MODEL_ORIGIN[0]+17,MODEL_ORIGIN[1]+7.5,MODEL_ORIGIN[2]+23.4);sun.target.position.set(...MODEL_ORIGIN);
  Object.assign(sun.shadow.camera,{left:-18,right:18,top:18,bottom:-18,near:1,far:85});
  sun.shadow.mapSize.set(mobile()?1024:2048,mobile()?1024:2048);sun.shadow.normalBias=.004;sun.shadow.bias=-.000015;sun.shadow.camera.name='floor-shadow';
  sun.shadow.autoUpdate=false;sun.castShadow=true;sun.visible=false;scene.add(sun,sun.target);
  let visible=false,progress=0,anim=null,entry=null,cruise=null,playing=false,speed=0,yaw=0,pitch=0,outsideOffset=0,passageProgress=0,fade=0;
  const normalized=new THREE.Vector3(),target=new THREE.Vector3();
  function refreshShadows(){sun.shadow.needsUpdate=true;invalidate();}
  function pose(){return {position:new THREE.Vector3(MODEL_ORIGIN[0]+4.8,MODEL_ORIGIN[1]+2.1,MODEL_ORIGIN[2]+6.6),look:new THREE.Vector3(MODEL_ORIGIN[0],MODEL_ORIGIN[1]-.2,MODEL_ORIGIN[2])};}
  function travelState(){return {moving:playing,entering:anim?.kind==='entry',returning:anim?.kind==='return',inside:space.pass.enabled,reduced:reduced.matches};}
  function notify(){onTravel(travelState());}
  function reset(camera,look){
    progress=0;cruise=null;entry=null;playing=false;speed=0;yaw=0;pitch=0;outsideOffset=0;space.pass.enabled=false;
    const end=pose();camera.position.copy(end.position);look.copy(end.look);camera.up.set(0,1,0);camera.lookAt(look);
    camera.near=.1;camera.updateProjectionMatrix();
    space.sync(camera,null);refreshShadows();
  }
  function entryPose(camera,look){
    const align=smooth(0,.32,progress),z=THREE.MathUtils.lerp(entry.from.z,-6,progress);
    normalized.set(entry.from.x*(1-align),THREE.MathUtils.lerp(entry.from.y,.12,align),z);
    target.lerpVectors(entry.look,new THREE.Vector3(0,.08,z-5),align);
    const inside=z<PORTAL_Z;
    if(inside){
      const worldZ=(z-PORTAL_Z)*INTERIOR_SCALE,frame=cruise||createTravelFrame(worldZ),at=cruiseCamera(frame),blend=smooth(0,12,-worldZ);
      const direction=target.clone().sub(normalized).normalize().lerp(new THREE.Vector3(...at.forward),blend).normalize();
      normalized.set(at.position[0]/INTERIOR_SCALE,at.position[1]/INTERIOR_SCALE,PORTAL_Z+frame.localZ/INTERIOR_SCALE);
      target.copy(normalized).add(direction);
      space.cameraAt(camera,look,normalized.toArray(),target.toArray());space.pass.enabled=visible;space.sync(camera,frame,yaw,pitch,true);
    }else{
      space.cameraAt(camera,look,normalized.toArray(),target.toArray());space.pass.enabled=false;space.sync(camera,null);
    }
  }
  function cruisePose(camera,look){
    const at=cruiseCamera(cruise);
    normalized.set(at.position[0]/INTERIOR_SCALE,at.position[1]/INTERIOR_SCALE,PORTAL_Z+cruise.localZ/INTERIOR_SCALE);
    target.copy(normalized).add(new THREE.Vector3(...at.forward));
    space.cameraAt(camera,look,normalized.toArray(),target.toArray());space.pass.enabled=visible;space.sync(camera,cruise,yaw,pitch,true);
  }
  function setDepth(value,camera,look,onDone,{immediate=false}={}){
    anim=null;fade=0;
    if(value===0){
      playing=false;
      if(immediate||reduced.matches){reset(camera,look);notify();onDone?.();return;}
      anim={kind:'return',age:0,duration:.7,onDone,reset:false};notify();return;
    }
    parent.updateWorldMatrix(true,false);
    camera.near=.005;camera.updateProjectionMatrix();
    entry={from:space.localPoint(camera.position),look:space.localPoint(look)};
    yaw=0;pitch=0;cruise=null;progress=0;
    if(immediate||reduced.matches){progress=1;cruise=createTravelFrame(END_INTERIOR_Z);playing=false;cruisePose(camera,look);notify();onDone?.();return;}
    // A shorter approach avoids the long, almost stationary initial ramp.
    // Its final derivative still hands off at six internal units per second.
    const duration=8,slope=CRUISE_SPEED*duration/((entry.from.z+6)*INTERIOR_SCALE);
    anim={kind:'entry',age:0,duration,slope,onDone};playing=true;entryPose(camera,look);notify();
  }
  return {
    fractalPass:space.pass,travelState,warm:space.warm,
    companionsVisible:()=>visible&&!space.pass.enabled,
    preparePortal(renderer){if(visible&&!space.pass.enabled)space.preparePortal(renderer);},
    setVisible(value){visible=value;group.visible=value;sun.visible=value;anim=null;playing=false;space.pass.enabled=false;fade=0;refreshShadows();notify();},
    beginEntry(camera,look,onDone){
      const start=camera.position.clone(),fromLook=look.clone();reset(camera,look);camera.position.copy(start);look.copy(fromLook);camera.lookAt(look);const end=pose();
      anim={kind:'passage',age:0,fromLook:look.clone(),end,duration:4.2,onDone,rail:passageRail(camera.position.clone(),end.position)};
      passageProgress=0;
    },
    beginExit(camera,look,end,onDone){
      playing=false;space.pass.enabled=false;
      anim={kind:'passage',age:0,fromLook:look.clone(),end,duration:4.2,onDone,rail:passageRail(camera.position.clone(),end.position,true)};passageProgress=0;
    },
    setDepth,outerPose:pose,
    envelopePresence:()=>space.pass.enabled?0:1,returnFade:()=>fade,
    passageProgress:()=>passageProgress,
    toggleTravel(){if(anim?.kind==='return')return;playing=!playing&&!reduced.matches;notify();},
    stepTravel(){if(!cruise)return;playing=false;advanceTravel(cruise,4);space.pass.dirty=true;notify();},
    pause(){playing=false;notify();},
    cancel(){anim=null;playing=false;fade=0;},refreshShadows,
    update(dt,camera,look){
      if(!visible)return false;
      if(reduced.matches&&playing){playing=false;notify();}
      if(anim?.kind==='passage'){
        const a=anim;a.age+=dt;const t=reduced.matches?1:Math.min(1,a.age/a.duration),p=ease(t);passageProgress=p;
        a.rail.getPointAt(p,camera.position);look.lerpVectors(a.fromLook,a.end.look,p);camera.up.set(0,1,0);camera.lookAt(look);space.sync(camera,null);
        if(t===1){anim=null;a.onDone?.();}return true;
      }
      if(anim?.kind==='return'){
        const a=anim;a.age+=dt;const t=reduced.matches?1:Math.min(1,a.age/a.duration);fade=Math.sin(Math.PI*t);
        if(t>=.5&&!a.reset){reset(camera,look);a.reset=true;}
        if(t===1){anim=null;fade=0;notify();a.onDone?.();}return true;
      }
      if(anim?.kind==='entry'){
        const a=anim,wasInside=space.pass.enabled;
        if(reduced.matches){progress=1;entryPose(camera,look);}
        else if(playing){a.age=Math.min(a.duration,a.age+dt);const t=a.duration-a.age<1e-6?1:a.age/a.duration;progress=entryEase(t,a.slope);entryPose(camera,look);}
        else if(space.pass.dirty)entryPose(camera,look);
        if(wasInside!==space.pass.enabled)notify();
        if(progress===1){anim=null;cruise=createTravelFrame(END_INTERIOR_Z);speed=CRUISE_SPEED;notify();a.onDone?.();}
        return true;
      }
      if(cruise){
        if(playing){speed+=(CRUISE_SPEED-speed)*(1-Math.exp(-dt*2));advanceTravel(cruise,speed*dt);}
        if(playing||space.pass.dirty)cruisePose(camera,look);
      }else{const end=pose();end.position.x+=outsideOffset;camera.position.copy(end.position);look.copy(end.look);camera.lookAt(look);space.sync(camera,null);}
      return true;
    },
    drag(delta,vertical=0){if(!cruise&&!anim){outsideOffset=THREE.MathUtils.clamp(outsideOffset+delta,-.5,.5);return;}yaw=THREE.MathUtils.clamp(yaw+delta,-.48,.48);pitch=THREE.MathUtils.clamp(pitch+vertical,-.3,.3);space.pass.dirty=true;},
    move(distance){if(!cruise||anim)return;playing=false;speed=0;advanceTravel(cruise,distance);space.pass.dirty=true;notify();},
    dispose(){scene.remove(group,sun,sun.target);sun.shadow.map?.dispose();space.dispose();body.dispose();shell.dispose();},
  };
}
