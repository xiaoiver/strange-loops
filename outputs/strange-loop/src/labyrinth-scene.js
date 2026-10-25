import * as THREE from 'three';
import { traceProfile } from './rubin-contour.js';
import { LOBSTER_POSTERS } from './gallery-art.js';
import { applySoftShadows } from './soft-shadows.js';
import { createFairFacedConcrete } from './fair-faced-concrete.js';
import { MAX_DEPTH } from './labyrinth-system.js';

export const MODEL_ORIGIN = [0, -2.7, -10];
export const MODEL_SCALE = .24;
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
  const pale = new THREE.MeshStandardMaterial({ color: 0xb9bcb6, roughness:.9 });
  const ink = new THREE.MeshStandardMaterial({ color: 0x41463f, roughness:.84 });
  const shell = createFairFacedConcrete();
  for (const material of [paper,pale,ink,shell]) { material.shadowSide=THREE.DoubleSide; applySoftShadows(material, mobile()); }
  const geometries=[], materials=[paper,pale,ink,shell], textures=[];
  function mesh(parent,geometry,material,position) {
    geometries.push(geometry);
    const object=new THREE.Mesh(geometry,material); object.position.set(...position);
    object.castShadow=object.receiveShadow=true; parent.add(object); return object;
  }
  const box=(parent,w,h,d,mat,x,y,z)=>mesh(parent,new THREE.BoxGeometry(w,h,d),mat,[x,y,z]);
  function table(parent,scale=1) {
    const table=new THREE.Group();table.scale.setScalar(scale);parent.add(table);
    box(table,4.3,.14,4.1,paper,0,.96,0);
    for(const x of [-1.8,1.8])for(const z of [-1.7,1.7])box(table,.09,.9,.09,ink,x,.45,z);
    return table;
  }
  // An architectural model sits on a light table, behind the shared contour.
  const outerTable=table(group);outerTable.position.set(0,-3.8,-10);
  const rooms=[null];
  const posterMaterials=LOBSTER_POSTERS.map(art=>{
    const material=new THREE.MeshStandardMaterial({color:0xf4f4ed,roughness:1});materials.push(material);
    new THREE.TextureLoader().load(art.file,texture=>{
      texture.colorSpace=THREE.SRGBColorSpace;textures.push(texture);material.map=texture;material.needsUpdate=true;invalidate();
    },undefined,()=>{});
    return material;
  });
  function buildRoom(parent,depth,position) {
    const room=new THREE.Group();room.name=`nested-gallery-${depth}`;room.position.set(...position);room.scale.setScalar(MODEL_SCALE);parent.add(room);rooms[depth]=room;
    box(room,14,.18,14,shell,0,-.09,0);
    box(room,14,5.7,.16,shell,0,2.85,-6.8);
    box(room,.16,5.7,14,shell,-7,2.85,0);
    // Open front and low right wall let visitors read the model before entering it.
    box(room,.16,1.1,14,shell,7,.55,0);
    const contour=new THREE.Group();contour.position.set(0,0,-3.7);contour.scale.setScalar(.68);room.add(contour);
    for(const sign of [-1,1]){
      const shape=traceProfile(new THREE.Shape(),sign);shape.lineTo(sign*5.2,0);shape.lineTo(sign*5.2,6);shape.closePath();
      mesh(contour,new THREE.ExtrudeGeometry(shape,{depth:.25,bevelEnabled:false,curveSegments:14}),ink,[0,0,0]);
    }
    for(const [index,art] of LOBSTER_POSTERS.entries()){
      const height=2.45,width=height*art.width/art.height;
      const poster=mesh(room,new THREE.PlaneGeometry(width,height),posterMaterials[index],[-6.89,2.8,1.1+index*2.25]);
      poster.rotation.y=Math.PI/2;
    }
    const stand=table(room,.72);stand.position.set(0,0,1);
    if(depth<MAX_DEPTH)buildRoom(room,depth+1,[0,.8,1]);
    else {
      const circle=mesh(room,new THREE.TorusGeometry(.72,.045,10,64),ink,[0,.84,1]);circle.rotation.x=-Math.PI/2;
      const center=mesh(room,new THREE.SphereGeometry(.12,12,8),pale,[0,.88,1]);center.name='recursion-leaf';
    }
    return room;
  }
  buildRoom(group,1,MODEL_ORIGIN);
  group.updateMatrixWorld(true);
  // Smaller rooms have their own light; its shadow volume scales with the room.
  const lights=[];
  for(let depth=1;depth<=MAX_DEPTH;depth++){
    const room=rooms[depth],light=new THREE.DirectionalLight(0xf3f3ee,1.6);
    room.updateWorldMatrix(true,false);
    light.position.copy(room.localToWorld(new THREE.Vector3(3,12,7)));
    light.target.position.copy(room.localToWorld(new THREE.Vector3(0,0,-1)));
    const scale=room.getWorldScale(new THREE.Vector3()).x;
    Object.assign(light.shadow.camera,{left:-10*scale,right:10*scale,top:10*scale,bottom:-10*scale,near:.1*scale,far:35*scale});
    light.shadow.mapSize.set(1024,1024);light.shadow.normalBias=.003*scale;light.shadow.bias=-.00001;
    light.shadow.camera.name='floor-shadow';light.shadow.autoUpdate=false;light.castShadow=true;light.visible=false;
    scene.add(light,light.target);lights.push(light);
  }
  let visible=false,depth=0,anim=null,manual=0,passageProgress=0;
  function pose(level=depth) {
    if(level===0)return {position:new THREE.Vector3(7.6,mobile()?1.8:.7,-3.4),look:new THREE.Vector3(0,-2.18,-10)};
    const room=rooms[level];room.updateWorldMatrix(true,false);
    return {position:room.localToWorld(new THREE.Vector3(mobile()?2.4:5.5,mobile()?9.4:7.2,mobile()?17.5:12)),look:room.localToWorld(new THREE.Vector3(0,1,0))};
  }
  function start(camera,look,points,looks,duration,onDone) {
    anim={age:0,positions:[camera.position.clone(),...points],looks:[look.clone(),...looks],duration,onDone};manual=0;
  }
  function refreshShadows(){for(const light of lights)light.shadow.needsUpdate=true;invalidate();}
  return {
    setVisible(value){visible=value;group.visible=value;for(const light of lights)light.visible=value;anim=null;manual=0;refreshShadows();},
    beginEntry(camera,look,onDone){
      depth=0;const end=pose(0);
      start(camera,look,[end.position],[end.look],4.2,onDone);
      anim.rail=passageRail(camera.position.clone(),end.position);passageProgress=0;
    },
    beginExit(camera,look,end,onDone){
      start(camera,look,[end.position],[end.look],4.2,onDone);
      anim.rail=passageRail(camera.position.clone(),end.position,true);passageProgress=0;
    },
    setDepth(value,camera,look,onDone,{immediate=false}={}){
      depth=value;manual=0;const end=pose();
      if(immediate){anim=null;camera.position.copy(end.position);look.copy(end.look);camera.lookAt(look);onDone?.();return;}
      start(camera,look,[end.position],[end.look],1.8,onDone);
    },
    passageProgress:()=>passageProgress,
    cancel(){anim=null;},
    refreshShadows,
    update(dt,camera,look){
      if(!visible)return false;
      if(anim){
        const a=anim;a.age+=dt;const t=reduced.matches?1:Math.min(1,a.age/a.duration);
        passageProgress=ease(t);
        const segment=Math.min(a.positions.length-2,Math.floor(t*(a.positions.length-1)));
        const u=ease(t===1?1:t*(a.positions.length-1)-segment);
        if(a.rail)a.rail.getPointAt(passageProgress,camera.position);
        else camera.position.lerpVectors(a.positions[segment],a.positions[segment+1],u);
        look.lerpVectors(a.looks[segment],a.looks[segment+1],u);
        camera.up.set(0,1,0);camera.lookAt(look);
        camera.near=Math.max(.001,Math.min(.1,camera.position.distanceTo(look)*.008));camera.updateProjectionMatrix();
        if(t===1){anim=null;a.onDone?.();}return true;
      }
      const end=pose();
      const scale=depth===0?1:MODEL_SCALE**depth;end.position.x+=manual*scale;
      camera.position.copy(end.position);look.copy(end.look);camera.up.set(0,1,0);camera.lookAt(look);
      const near=Math.max(.001,Math.min(.1,camera.position.distanceTo(look)*.008));
      if(camera.near!==near){camera.near=near;camera.updateProjectionMatrix();}return false;
    },
    drag(delta){manual=THREE.MathUtils.clamp(manual+delta,-.7,.7);},
    dispose(){scene.remove(group);for(const light of lights){scene.remove(light,light.target);light.shadow.map?.dispose();}for(const g of geometries)g.dispose();for(const m of materials)m.dispose();for(const t of textures)t.dispose();},
  };
}
