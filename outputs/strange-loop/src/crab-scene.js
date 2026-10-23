import * as THREE from 'three';
import {applySoftShadows} from './soft-shadows.js';
import {COURT_GATE,DEFAULT_NOTES} from './crab-system.js';
const UP=new THREE.Vector3(0,1,0);
const ease=t=>t*t*(3-2*t),mobile=()=>innerWidth<=760;
export function courtRail(start,end,returning=false){
 const gates=[-2.5,-1,1,3].map(offset=>new THREE.Vector3(COURT_GATE.x+offset,0,COURT_GATE.z));
 for(const p of gates)p.y=THREE.MathUtils.lerp(start.y,end.y,THREE.MathUtils.clamp((p.x-start.x)/(end.x-start.x||1),0,1));
 const points=[start,...(returning?gates.reverse():gates),end].filter((p,i,array)=>!i||p.distanceToSquared(array[i-1])>1e-8);
 const rail=new THREE.CatmullRomCurve3(points,false,'centripetal');rail.arcLengthDivisions=700;return rail;
}
export function createCrabScene(scene,reduced,invalidate){
 const group=new THREE.Group();group.name='crab-canon-courtyard';group.visible=false;scene.add(group);
 const paper=new THREE.MeshStandardMaterial({color:0xe2e3df,roughness:.94}),pale=new THREE.MeshStandardMaterial({color:0xc9cbc6,roughness:.9}),ink=new THREE.MeshStandardMaterial({color:0x41463f,roughness:.88}),white=new THREE.MeshStandardMaterial({color:0xf1f1ed,roughness:.9});
 const geometries=[],materials=[paper,pale,ink,white];for(const mat of materials)applySoftShadows(mat,mobile());
 const mesh=(parent,g,mat,p)=>{geometries.push(g);const m=new THREE.Mesh(g,mat);m.position.set(...p);m.castShadow=m.receiveShadow=true;parent.add(m);return m;};
 const box=(parent,w,h,d,mat,x,y,z)=>mesh(parent,new THREE.BoxGeometry(w,h,d),mat,[x,y,z]);
 box(group,21,.16,25,paper,27.5,-3.89,-6.8);box(group,21,8,.25,paper,27.5,.2,-19.2);box(group,.25,8,25,pale,38,.2,-6.8);
 // A narrow border reads as a walking line; no raised central platform.
 for(const z of [-11.2,-8.8])box(group,11,.018,.035,pale,26.5,-3.795,z);
 for(const x of [20.8,32.2])box(group,.035,.018,2.4,pale,x,-3.795,-10);
 const notes=[];
 for(let i=0;i<6;i++){
  const mat=ink.clone();materials.push(mat);const block=box(group,.82,1,.72,mat,26.5+(i-2.5)*1.58,-3.3,-10);block.userData.noteIndex=i;notes.push(block);
 }
 const solid=mesh(group,new THREE.SphereGeometry(.105,16,10),ink,[22.55,-3.55,-8.8]);
 solid.castShadow=false;
 const hollow=mesh(group,new THREE.TorusGeometry(.16,.026,8,32),ink,[30.45,-3.55,-11.2]);hollow.rotation.x=-Math.PI/2;hollow.castShadow=false;
 const cr=new THREE.Group();cr.name='crab-sculpture';cr.position.set(26.5,-3.78,-12.3);group.add(cr);
 mesh(cr,new THREE.CylinderGeometry(.7,.78,.1,32),pale,[0,.05,0]);
 const body=mesh(cr,new THREE.IcosahedronGeometry(.42,1),ink,[0,.36,0]);body.scale.set(1.2,.55,.85);
 for(const sign of [-1,1]){
  for(let i=0;i<4;i++){
   const leg=box(cr,.52,.065,.07,ink,sign*(.52+(i%2)*.07),.2,(i-1.5)*.19);leg.rotation.z=sign*.35;leg.rotation.y=sign*(i-1.5)*.18;
  }
  const arm=box(cr,.12,.1,.42,ink,sign*.43,.32,.4);arm.rotation.y=-sign*.5;
  for(const spread of [-1,1]){const claw=box(cr,.055,.12,.24,ink,sign*.51+spread*.065,.36,.66);claw.rotation.y=spread*.4;}
  mesh(cr,new THREE.SphereGeometry(.045,8,6),pale,[sign*.15,.5,.29]);
 }
 cr.scale.setScalar(.85);
 const sun=new THREE.DirectionalLight(0xf3f3ef,2.4);sun.position.set(32.5,17,2);sun.target.position.set(26.5,-3.8,-10);sun.castShadow=true;sun.shadow.mapSize.set(2048,2048);
 Object.assign(sun.shadow.camera,{left:-20,right:20,top:20,bottom:-20,near:1,far:50});sun.shadow.camera.name='floor-shadow';sun.shadow.normalBias=.008;sun.shadow.autoUpdate=false;sun.visible=false;scene.add(sun,sun.target);
 const ambient=new THREE.HemisphereLight(0xf0f0ec,0x9c9e99,.4);ambient.visible=false;scene.add(ambient);
 let visible=false,active=false,mode='forward',anim=null,manual=0,progress=0,values=[],lastStep='';
 const raycaster=new THREE.Raycaster();
 function pose(value=mode){
  const reverse=value==='reverse',both=value==='together'||value==='explore';
  return {position:new THREE.Vector3(mobile()?(both?26.5:reverse?29:24):(both?26.5:reverse?34:20.5),mobile()?4.8:both?4.5:2.4,mobile()?11:both?5.2:3.7),look:new THREE.Vector3(26.5,-3.0,-10)};
 }
 function refresh(){sun.shadow.needsUpdate=true;invalidate();}
 function begin(camera,look,end,duration,done,rail=null){anim={age:0,duration,from:camera.position.clone(),fromLook:look.clone(),end,done,rail};manual=0;}
 function passageGaze(a,p,camera,look){
  // Interpolate directions, rather than a world-space target the camera can overtake.
  const from=a.fromLook.clone().sub(a.from).normalize(),to=a.end.look.clone().sub(a.end.position).normalize();
  const gate=new THREE.Vector3(a.returning?-1:1,0,0),first=p<.4,u=ease(first?p/.4:(p-.4)/.6),v=first?from:gate,w=first?gate:to;
  const yaw=Math.atan2(v.x,v.z),delta=THREE.MathUtils.euclideanModulo(Math.atan2(w.x,w.z)-yaw+Math.PI,Math.PI*2)-Math.PI;
  const pitch=THREE.MathUtils.lerp(Math.asin(v.y),Math.asin(w.y),u),angle=yaw+delta*u;
  const direction=new THREE.Vector3(Math.sin(angle)*Math.cos(pitch),Math.sin(pitch),Math.cos(angle)*Math.cos(pitch));
  const distance=THREE.MathUtils.lerp(a.from.distanceTo(a.fromLook),a.end.position.distanceTo(a.end.look),p);
  look.copy(camera.position).addScaledVector(direction,distance);
 }
 return {
  setVisible(value){visible=value;group.visible=value;if(!value)anim=null;},
  setActive(value){active=value;sun.visible=ambient.visible=value;refresh();},
  setMode(value,camera,look,immediate=false){
   if(!active)return;const changed=mode!==value;mode=value;const end=pose();
   if(immediate){anim=null;camera.position.copy(end.position);look.copy(end.look);camera.up.copy(UP);camera.lookAt(look);manual=0;}
   else if(changed)begin(camera,look,end,1.5);
  },
  beginEntry(camera,look,done,value='forward'){mode=value;const end=pose();begin(camera,look,end,4.4,done,courtRail(camera.position.clone(),end.position));progress=0;},
  beginExit(camera,look,end,done){begin(camera,look,end,4.4,done,courtRail(camera.position.clone(),end.position,true));anim.returning=true;progress=0;},
  progress:()=>progress,
  cancel(){anim=null;},
  setFrame(frame,pitches=DEFAULT_NOTES,playing=false){
   const key=`${frame.mode}:${frame.step}:${playing}`;
   for(let i=0;i<6;i++){
    const block=notes[i],height=.25+(pitches[i]-60)*.055;
    if(values[i]!==pitches[i]){block.scale.y=height;block.position.y=-3.79+height/2;values[i]=pitches[i];refresh();}
    if(key!==lastStep){const highlighted=playing&&(frame.forward===i||frame.reverse===i);block.material.color.setHex(highlighted?0x999e94:0x41463f);}
   }
   lastStep=key;
   const p=reduced.matches?frame.step/5:Math.min(5,frame.progress*6)/5;
   solid.visible=frame.mode!=='reverse';hollow.visible=frame.mode!=='forward';
   solid.position.x=22.55+7.9*p;hollow.position.x=30.45-7.9*p;
   solid.position.y=hollow.position.y=-2.55;
  },
  update(dt,camera,look){
   if(!visible)return;
   if(anim){const a=anim;a.age+=dt;const t=reduced.matches?1:Math.min(1,a.age/a.duration);progress=ease(t);
    if(a.rail)a.rail.getPointAt(progress,camera.position);else camera.position.lerpVectors(a.from,a.end.position,progress);
    if(a.rail)passageGaze(a,progress,camera,look);else look.lerpVectors(a.fromLook,a.end.look,progress);camera.up.copy(UP);camera.lookAt(look);camera.near=.1;
    if(t===1){anim=null;a.done?.();}return;
   }
   if(!active)return;const end=pose();end.position.x+=manual;camera.position.copy(end.position);look.copy(end.look);camera.up.copy(UP);camera.lookAt(look);camera.near=.1;
  },
  drag(delta){manual=THREE.MathUtils.clamp(manual+delta,-.7,.7);},
  pick(pointer,camera){raycaster.setFromCamera(pointer,camera);return raycaster.intersectObjects(notes)[0]?.object.userData.noteIndex;},
  refreshShadows:refresh,
  dispose(){scene.remove(group,sun,sun.target,ambient);sun.shadow.map?.dispose();for(const g of geometries)g.dispose();for(const m of materials)m.dispose();},
 };
}
