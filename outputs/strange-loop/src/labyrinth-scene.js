import * as THREE from 'three';
import { applySoftShadows } from './soft-shadows.js';
import { MAX_DEPTH } from './labyrinth-system.js';
import { createFairFacedConcrete } from './fair-faced-concrete.js';
import { cloneWithHooks } from './shader-hooks.js';
import { createExhibitFade } from './exhibit-fade.js';
import { createMengerArchitecture } from './menger-architecture.js';

import {MODEL_ORIGIN,MODEL_SCALE,FOLD_DURATION,foldEase,foldLayout} from './labyrinth-fold.js';
export {MODEL_ORIGIN,MODEL_SCALE} from './labyrinth-fold.js';
const ease = t => t*t*(3-2*t);
const mobile = () => innerWidth <= 760;
// The eye crosses the actual opening at x=0 without dipping toward the floor.
export const CONTOUR_CROSSING = [[0,1.15,4.2], [0,1.05,1.2], [0,1.0,-.6], [0,.95,-1.8]];

// Arc-length sampling keeps speed independent of the distance between control points.
// Four centered points leave a straight, safe stretch through the narrow profile opening.
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

export function createLabyrinthScene(scene, reduced, invalidate) {
  const group = new THREE.Group(); group.name = 'harmonic-labyrinth'; group.visible = false; scene.add(group);
  const shell=createFairFacedConcrete({space:'local'});
  for (const material of [shell]) { material.shadowSide=THREE.DoubleSide; applySoftShadows(material, mobile()); }
  const echoMaterial=cloneWithHooks(shell),enclosureShell=cloneWithHooks(shell),childShell=cloneWithHooks(shell),floorShell=cloneWithHooks(shell);
  const geometries=[], materials=[shell,echoMaterial,enclosureShell,childShell,floorShell];
  function mesh(parent,geometry,material,position) {
    geometries.push(geometry);
    const object=new THREE.Mesh(geometry,material); object.position.set(...position);
    object.castShadow=object.receiveShadow=true; parent.add(object); return object;
  }
  const box=(parent,w,h,d,mat,x,y,z)=>mesh(parent,new THREE.BoxGeometry(w,h,d),mat,[x,y,z]);
  const rooms=[null],times=[0,0,0];
  const echoes=new THREE.Group();echoes.name='suspended-galleries';group.add(echoes);
  const ribs=[];
  // Architectural repetitions extend outside the ordinary floor and turn through
  // impossible orientations. They belong to the first nested level's clock.
  for(const [index,[x,y,z,angle,tilt]] of [
    [10.2,1.4,-13.8,.38,.2],[-1.7,5.2,-18.8,-.28,.6],[-6.4,2.8,-22.5,1.25,-.25],
  ].entries()){
    const rib=new THREE.Group();rib.name=`suspended-gallery-${index}`;
    rib.position.set(x,y,z);rib.rotation.set(tilt,index===0?.3:-.12,angle);echoes.add(rib);
    const w=index===1?16:12,h=10;
    for(const side of [-1,1])box(rib,.25,h,.65,echoMaterial,side*w/2,0,0);
    for(const side of [-1,1])box(rib,w,.25,.65,echoMaterial,0,side*h/2,0);
    // A second offset edge reads as room depth rather than a flat picture frame.
    box(rib,w,.18,.18,echoMaterial,0,h/2,-3.8);
    for(const side of [-1,1])box(rib,.18,.18,3.8,echoMaterial,side*w/2,h/2,-1.9);
    ribs.push({object:rib,y,angle,tilt});
  }
  let childHinge,leafFrame,parentEnclosure,fadeEnclosure,body,childBody,fadeChildBody,parentFloor,fadeFloor;
  function buildRoom(parent,depth,position) {
    const room=new THREE.Group();room.name=`nested-gallery-${depth}`;room.position.set(...position);parent.add(room);rooms[depth]=room;
    if(depth<MAX_DEPTH){
      parentFloor=box(room,14,.18,14,floorShell,0,-.09,0);
      fadeFloor=createExhibitFade(parentFloor,{lift:0,shrink:0});
    }
    else {
      // The final floor is an open outline too. Folded upright, it must not
      // obscure the empty frame with a solid wall; the parent floor stays below.
      for(const side of [-1,1])box(room,.22,.18,14,shell,side*6.89,-.09,0);
      for(const side of [-1,1])box(room,13.56,.18,.22,shell,0,-.09,side*6.89);
    }
    if(depth<MAX_DEPTH){
      parentEnclosure=new THREE.Group();parentEnclosure.name='parent-room-enclosure';room.add(parentEnclosure);
      body=createMengerArchitecture({depth:2,size:14,material:enclosureShell,name:'menger-parent'});
      body.group.rotation.y=.64;parentEnclosure.add(body.group);
      fadeEnclosure=createExhibitFade(parentEnclosure,{lift:0,shrink:0});
      // The child's front edge is the hinge. Its entire floor stays above the parent floor.
      childHinge=new THREE.Group();childHinge.name='folding-gallery-hinge';room.add(childHinge);
      buildRoom(childHinge,depth+1,[0,0,-7]);
    } else {
      childBody=createMengerArchitecture({depth:1,size:3.2,material:childShell,name:'menger-child'});
      childBody.group.position.set(-.8,4.5,-2.1);childBody.group.rotation.y=.64;room.add(childBody.group);
      fadeChildBody=createExhibitFade(childBody.group,{lift:0,shrink:0});
      // A real aperture, never a picture or an opaque white panel. Its concrete
      // reveals frame the scene background; no smaller room exists behind it.
      leafFrame=new THREE.Group();leafFrame.name='recursion-leaf';leafFrame.rotation.y=.64;room.add(leafFrame);
      for(const side of [-1,1])box(leafFrame,.18,2.3,.85,shell,side*1.01,0,0);
      for(const side of [-1,1])box(leafFrame,2.2,.18,.85,shell,0,side*1.06,0);
    }
    return room;
  }
  buildRoom(group,1,MODEL_ORIGIN);
  const sun=new THREE.DirectionalLight(0xf3f3ee,1.05);sun.position.set(10,16,2);sun.target.position.set(2.8,-3.78,-10);
  Object.assign(sun.shadow.camera,{left:-22,right:22,top:22,bottom:-22,near:1,far:65});
  sun.shadow.mapSize.set(mobile()?1024:2048,mobile()?1024:2048);sun.shadow.normalBias=.008;sun.shadow.camera.name='floor-shadow';
  sun.shadow.autoUpdate=false;sun.castShadow=true;sun.visible=false;scene.add(sun,sun.target);
  let visible=false,depth=0,level=0,anim=null,manual=0,passageProgress=0,drift=0,widthMode=mobile();
  function applyLayout(value,bob=0){
    drift=bob;widthMode=mobile();
    level=value;const layout=foldLayout(value);
    rooms[1].scale.setScalar(layout.roomScale);rooms[1].position.y=layout.roomY+bob;
    fadeFloor(foldEase(layout.first));
    parentFloor.castShadow=layout.first>.98;
    childHinge.position.set(layout.childX,layout.childY,layout.childZ);
    childHinge.scale.setScalar(layout.childScale);childHinge.rotation.x=layout.childAngle;
    body.group.position.set(-.8,THREE.MathUtils.lerp(4.3,4.5,layout.first),-1.1);
    body.group.rotation.y=THREE.MathUtils.lerp(.32,.64,foldEase(layout.first));
    body.group.scale.setScalar(THREE.MathUtils.lerp(.6,1,foldEase(layout.first)));
    body.update(foldEase(layout.first),times[1]);childBody.update(0);
    for(const [index,rib] of ribs.entries()){
      rib.object.position.y=rib.y+Math.sin(times[1]*.23+index)*.35;
      rib.object.rotation.z=rib.angle+Math.sin(times[1]*.17+index)*.075;
      rib.object.rotation.x=rib.tilt+Math.sin(times[1]*.13+index)*.04;
    }
    const quiet=foldEase(layout.second),presence=foldEase(layout.first)*(1-quiet);
    echoes.visible=presence>.001;echoes.scale.setScalar(.85+.15*presence);echoes.position.y=(1-presence)*3;
    echoMaterial.opacity=presence;
    const translucent=presence<1;
    if(echoMaterial.transparent!==translucent){echoMaterial.transparent=translucent;echoMaterial.needsUpdate=true;}
    echoMaterial.depthWrite=!translucent;
    echoes.traverse(object=>{if(object.isMesh)object.castShadow=presence>.98;});
    // The enclosing walls dissolve only as the last room unfolds. Parent
    // architecture stays in memory and returns on the same clock when folding back.
    fadeEnclosure(1-quiet);
    const childPresence=1-foldEase((layout.second-.35)/.65);
    fadeChildBody(childPresence);
    childBody.group.scale.setScalar(mobile()?.7:1);
    childBody.group.position.set(-.8,4.5,mobile()?-3.6:-2.1);
    childBody.group.traverse(object=>{if(object.isMesh)object.castShadow=childPresence>.98;});
    parentEnclosure.traverse(object=>{if(object.isMesh)object.castShadow=layout.second<.02;});
    const reveal=foldEase((layout.second-.3)/.7);
    leafFrame.visible=reveal>0;
    leafFrame.position.set(-.8,mobile()?4.95:4.5,-1.1);
    leafFrame.scale.setScalar((mobile()?.56:1)*reveal);
    group.updateMatrixWorld(true);refreshShadows();
  }
  function pose(value=depth){
    if(value===0)return {position:new THREE.Vector3(7.6,.7,-3.4),look:new THREE.Vector3(MODEL_ORIGIN[0],mobile()?-1.3:-2.18,-10)};
    const travel=value===1?2.4:4.5,yaw=Math.atan2(4.8,6.6),pitch=(mobile()?7:3)*Math.PI/180;
    const position=new THREE.Vector3(7.6-Math.sin(yaw)*travel,.7,-3.4-Math.cos(yaw)*travel);
    const direction=new THREE.Vector3(-Math.sin(yaw)*Math.cos(pitch),Math.sin(pitch),-Math.cos(yaw)*Math.cos(pitch));
    return {position,look:position.clone().addScaledVector(direction,10)};
  }
  function start(camera,look,end,duration,onDone,kind='passage'){
    anim={age:0,from:camera.position.clone(),fromLook:look.clone(),end,duration,onDone,kind,fromLevel:level,fromDrift:drift};manual=0;
  }
  function refreshShadows(){sun.shadow.needsUpdate=true;invalidate();}
  function layerGaze(a,p,camera,look){
    const v=a.fromLook.clone().sub(a.from).normalize(),w=a.end.look.clone().sub(a.end.position).normalize();
    const yaw=Math.atan2(v.x,v.z),delta=THREE.MathUtils.euclideanModulo(Math.atan2(w.x,w.z)-yaw+Math.PI,Math.PI*2)-Math.PI;
    const pitch=THREE.MathUtils.lerp(Math.asin(v.y),Math.asin(w.y),p),angle=yaw+delta*p;
    look.copy(camera.position).addScaledVector(new THREE.Vector3(Math.sin(angle)*Math.cos(pitch),Math.sin(pitch),Math.cos(angle)*Math.cos(pitch)),THREE.MathUtils.lerp(a.from.distanceTo(a.fromLook),10,p));
  }
  function setDepth(value,camera,look,onDone,{immediate=false}={}){
    const previous=depth;manual=0;
    if(immediate){
      depth=value;anim=null;applyLayout(depth);const end=pose();
      camera.position.copy(end.position);look.copy(end.look);camera.up.set(0,1,0);camera.lookAt(look);onDone?.();return;
    }
    // A restored deep visit or a chapter exit still unfolds one room at a time.
    // Each hinge settles before the next scale change starts, in either direction.
    const next=Math.abs(value-level)>1.00001?(value>level?Math.floor(level)+1:Math.ceil(level)-1):value;
    depth=next;
    start(camera,look,pose(),FOLD_DURATION[Math.max(previous,next)]||3.8,
      next===value?onDone:()=>setDepth(value,camera,look,onDone),'fold');
  }
  applyLayout(0);
  return {
    setVisible(value){visible=value;group.visible=value;sun.visible=value;anim=null;manual=0;refreshShadows();},
    beginEntry(camera,look,onDone){
      depth=0;applyLayout(0);const end=pose(0);start(camera,look,end,4.2,onDone);
      anim.rail=passageRail(camera.position.clone(),end.position);passageProgress=0;
    },
    beginExit(camera,look,end,onDone){
      start(camera,look,end,4.2,onDone);anim.rail=passageRail(camera.position.clone(),end.position,true);passageProgress=0;
    },
    setDepth,
    outerPose:()=>pose(0),
    envelopePresence:()=>1-foldEase(Math.min(1,level)),
    passageProgress:()=>passageProgress,
    cancel(){anim=null;},
    refreshShadows,
    update(dt,camera,look){
      if(!visible)return false;
      if(anim){
        const a=anim;a.age+=dt;const t=reduced.matches?1:Math.min(1,a.age/a.duration),p=a.kind==='fold'?foldEase(t):ease(t);
        if(a.rail){passageProgress=p;a.rail.getPointAt(p,camera.position);look.lerpVectors(a.fromLook,a.end.look,p);}
        else {applyLayout(THREE.MathUtils.lerp(a.fromLevel,depth,p),a.fromDrift*(1-p));camera.position.lerpVectors(a.from,a.end.position,p);layerGaze(a,p,camera,look);}
        camera.up.set(0,1,0);camera.lookAt(look);camera.near=.1;camera.updateProjectionMatrix();
        if(t===1){anim=null;a.onDone?.();}return true;
      }
      const end=pose();end.position.x+=manual;camera.position.copy(end.position);look.copy(end.look);camera.up.set(0,1,0);camera.lookAt(look);camera.near=.1;
      if(reduced.matches&&widthMode!==mobile())applyLayout(level,drift);
      if(!reduced.matches){
        times[depth]+=dt;
        const target=depth===0?Math.sin(times[0]*.45)*.045:0;
        applyLayout(level,THREE.MathUtils.lerp(drift,target,1-Math.exp(-dt*3)));
        refreshShadows();
      }
      return true;
    },
    drag(delta){manual=THREE.MathUtils.clamp(manual+delta,-.7,.7);},
    dispose(){scene.remove(group,sun,sun.target);sun.shadow.map?.dispose();for(const g of geometries)g.dispose();for(const m of materials)m.dispose();body.dispose();childBody.dispose();},
  };
}
