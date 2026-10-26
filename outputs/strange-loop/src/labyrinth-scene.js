import * as THREE from 'three';
import { traceProfile } from './rubin-contour.js';
import { LOBSTER_POSTERS } from './gallery-art.js';
import { applySoftShadows } from './soft-shadows.js';
import { MAX_DEPTH } from './labyrinth-system.js';
import { createFairFacedConcrete } from './fair-faced-concrete.js';
import { cloneWithHooks } from './shader-hooks.js';
import { createExhibitFade } from './exhibit-fade.js';

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
  const paper = new THREE.MeshStandardMaterial({ color: 0xe2e3de, roughness:.9 });
  const ink = new THREE.MeshStandardMaterial({ color: 0x41463f, roughness:.84 });
  const shell=createFairFacedConcrete({space:'local'});
  for (const material of [paper,ink,shell]) { material.shadowSide=THREE.DoubleSide; applySoftShadows(material, mobile()); }
  const echoMaterial=cloneWithHooks(shell),enclosureShell=cloneWithHooks(shell),enclosureInk=ink.clone();
  const geometries=[], materials=[paper,ink,shell,echoMaterial,enclosureShell,enclosureInk], textures=[];
  function mesh(parent,geometry,material,position) {
    geometries.push(geometry);
    const object=new THREE.Mesh(geometry,material); object.position.set(...position);
    object.castShadow=object.receiveShadow=true; parent.add(object); return object;
  }
  const box=(parent,w,h,d,mat,x,y,z)=>mesh(parent,new THREE.BoxGeometry(w,h,d),mat,[x,y,z]);
  function table(parent) {
    const stand=new THREE.Group();stand.name='suspended-parent-table';parent.add(stand);
    const structure=new THREE.Group();structure.name='parent-table-structure';stand.add(structure);
    // The original tabletop's aperture becomes a skylight as its scale changes.
    for(const z of [-1.75,1.75])box(structure,4.3,.14,.6,paper,0,.96,z);
    for(const x of [-1.925,1.925])box(structure,.45,.14,2.9,paper,x,.96,0);
    for(const x of [-1.8,1.8])for(const z of [-1.7,1.7])box(structure,.09,.9,.09,ink,x,.45,z);
    return stand;
  }
  const outerTable=table(group);outerTable.position.set(MODEL_ORIGIN[0],-3.8,-10);
  const tableStructure=outerTable.getObjectByName('parent-table-structure'),fadeTable=createExhibitFade(tableStructure,{lift:0,shrink:0});
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
  let childHinge,leafFrame,parentEnclosure,fadeEnclosure;
  const posterMaterials=LOBSTER_POSTERS.map(art=>{
    const material=new THREE.MeshStandardMaterial({color:0xf4f4ed,roughness:1});materials.push(material);
    new THREE.TextureLoader().load(art.file,texture=>{
      texture.colorSpace=THREE.SRGBColorSpace;textures.push(texture);material.map=texture;material.needsUpdate=true;invalidate();
    },undefined,()=>{});
    return material;
  });
  function buildRoom(parent,depth,position) {
    const room=new THREE.Group();room.name=`nested-gallery-${depth}`;room.position.set(...position);parent.add(room);rooms[depth]=room;
    if(depth<MAX_DEPTH)box(room,14,.18,14,shell,0,-.09,0);
    else {
      // The final floor is an open outline too. Folded upright, it must not
      // obscure the empty frame with a solid wall; the parent floor stays below.
      for(const side of [-1,1])box(room,.22,.18,14,shell,side*6.89,-.09,0);
      for(const side of [-1,1])box(room,13.56,.18,.22,shell,0,-.09,side*6.89);
    }
    if(depth<MAX_DEPTH){
      // Only the enclosing room carries the earlier exhibits. The last room is
      // empty: the same architectural language ends without another miniature.
      parentEnclosure=new THREE.Group();parentEnclosure.name='parent-room-enclosure';room.add(parentEnclosure);
      box(parentEnclosure,14,5.7,.16,enclosureShell,0,2.85,-6.8);
      box(parentEnclosure,.16,5.7,14,enclosureShell,-7,2.85,0);
      box(parentEnclosure,.16,1.1,14,enclosureShell,7,.55,0);
      const contour=new THREE.Group();contour.position.set(3.7,.02,-4.7);contour.scale.setScalar(.39);parentEnclosure.add(contour);
      for(const sign of [-1,1]){
        const shape=traceProfile(new THREE.Shape(),sign);shape.lineTo(sign*5.2,0);shape.lineTo(sign*5.2,6);shape.closePath();
        mesh(contour,new THREE.ExtrudeGeometry(shape,{depth:.25,bevelEnabled:false,curveSegments:14}),enclosureInk,[0,0,0]);
      }
      for(const [index,art] of LOBSTER_POSTERS.entries()){
        const height=2.45,width=height*art.width/art.height;
        const poster=mesh(parentEnclosure,new THREE.PlaneGeometry(width,height),posterMaterials[index],[-6.89,2.8,1.1+index*2.25]);
        poster.rotation.y=Math.PI/2;
      }
      fadeEnclosure=createExhibitFade(parentEnclosure,{lift:0,shrink:0});
      // The child's front edge is the hinge. Its entire floor stays above the parent floor.
      childHinge=new THREE.Group();childHinge.name='folding-gallery-hinge';room.add(childHinge);
      buildRoom(childHinge,depth+1,[0,0,-7]);
    } else {
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
  let visible=false,depth=0,level=0,anim=null,manual=0,passageProgress=0,drift=0;
  function applyLayout(value,bob=0){
    drift=bob;
    level=value;const layout=foldLayout(value);
    rooms[1].scale.setScalar(layout.roomScale);rooms[1].position.y=layout.roomY+bob;
    outerTable.scale.setScalar(layout.tableScale);outerTable.position.y=layout.tableY;
    childHinge.position.set(layout.childX,layout.childY,layout.childZ);
    childHinge.scale.setScalar(layout.childScale);childHinge.rotation.x=layout.childAngle;
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
    fadeEnclosure(1-quiet);fadeTable(1-quiet);
    tableStructure.traverse(object=>{if(object.isMesh)object.castShadow=layout.second<.02;});
    parentEnclosure.traverse(object=>{if(object.isMesh)object.castShadow=layout.second<.02;});
    leafFrame.position.set(-.8,mobile()?4.95:4.5,-1.1);
    leafFrame.scale.setScalar(mobile()?.56:1);
    group.updateMatrixWorld(true);refreshShadows();
  }
  function pose(value=depth){
    if(value===0)return {position:new THREE.Vector3(7.6,.7,-3.4),look:new THREE.Vector3(MODEL_ORIGIN[0],-2.18,-10)};
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
      if(!reduced.matches){
        times[depth]+=dt;
        const target=depth===0?Math.sin(times[0]*.45)*.045:0;
        applyLayout(level,THREE.MathUtils.lerp(drift,target,1-Math.exp(-dt*3)));
        refreshShadows();
      }
      return true;
    },
    drag(delta){manual=THREE.MathUtils.clamp(manual+delta,-.7,.7);},
    dispose(){scene.remove(group,sun,sun.target);sun.shadow.map?.dispose();for(const g of geometries)g.dispose();for(const m of materials)m.dispose();for(const t of textures)t.dispose();},
  };
}
