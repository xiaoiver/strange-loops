import { FEDEX_ART } from './fedex-exhibit.js';
import { CUTOUT_ANCHOR, studyById } from './cutout-studies.js';
import { createNegativeSpaceWall } from './negative-space-wall.js';
import * as THREE from 'three';
import { GALLERY_ENTRY } from './chapter-passage.js';
import { traceProfile } from './rubin-contour.js';
import { figureStage } from './figure-ground-system.js';
import { LOBSTER_POSTERS } from './gallery-art.js';
import { applySoftShadows } from './soft-shadows.js';
import { createFairFacedConcrete } from './fair-faced-concrete.js';
import { createExhibitFade } from './exhibit-fade.js';

export function createFigureGroundScene(scene, reduced, invalidate) {
  const group = new THREE.Group(); group.name = 'figure-ground-gallery'; group.visible = false; scene.add(group);
  const shell = createFairFacedConcrete();
  const ink = new THREE.MeshStandardMaterial({ color: 0x424641, roughness: .85 });
  for (const m of [shell, ink]) { m.shadowSide = THREE.DoubleSide; applySoftShadows(m, innerWidth <= 760); }
  function box(w,h,d,material,x,y,z) {
    const mesh = new THREE.Mesh(new THREE.BoxGeometry(w,h,d), material);
    mesh.position.set(x,y,z); mesh.castShadow = mesh.receiveShadow = true; group.add(mesh); return mesh;
  }
  box(45,.16,62,shell,2,-3.89,0);
  box(30,12,.35,shell,2,2.2,-19);
  // An actual side-wall opening receives the companions from the previous room.
  const entry=GALLERY_ENTRY,back=-19.2,front=21.8,left=entry.z-entry.halfWidth,right=entry.z+entry.halfWidth,top=-.64;
  box(.35,12,left-back,shell,entry.x,2.2,(back+left)/2);
  box(.35,12,front-right,shell,entry.x,2.2,(right+front)/2);
  box(.35,8.2-top,right-left,shell,entry.x,(8.2+top)/2,entry.z);
  box(entry.depth,3.16,.12,shell,entry.x-entry.depth/2,-2.22,left-.06);
  box(entry.depth,3.16,.12,shell,entry.x-entry.depth/2,-2.22,right+.06);
  box(.08,3.16,right-left,ink,entry.x-entry.depth,-2.22,entry.z);
  box(.35,12,41,shell,17,2.2,1.3);
  group.add(new THREE.HemisphereLight(0xf2f3f0,0x6e726e,.42));
  // Two architectural piers share the vase boundary. The middle remains empty space.
  const contour = new THREE.Group(); contour.position.set(0,-3.8,0); group.add(contour);
  const contourWalls = [];
  const inkFocus = ink.clone(); inkFocus.emissive = new THREE.Color(0x2a2d28); inkFocus.emissiveIntensity = .22;
  const inkRest = ink.clone(); inkRest.color.multiplyScalar(.72);
  for (const sign of [-1,1]) {
    const shape = traceProfile(new THREE.Shape(), sign);
    shape.lineTo(sign * 5.2,0); shape.lineTo(sign * 5.2,6); shape.closePath();
    const geo = new THREE.ExtrudeGeometry(shape,{ depth: .48, bevelEnabled: false, curveSegments: 18 });
    const wall = new THREE.Mesh(geo,ink.clone()); wall.castShadow = wall.receiveShadow = true;
    wall.userData.coEdge = 'faces'; contourWalls.push(wall); contour.add(wall);
  }
  // A real roof aperture casts the diagonal light band onto walls, floor and actors.
  box(40,.18,8,shell,4,6.1,-16.5);
  box(40,.18,11,shell,4,6.1,-1.1);
  box(40,.18,22,shell,4,6.1,18.6);
  const sun = new THREE.DirectionalLight(0xf4f4ef,2.7); sun.position.set(5,17,10); sun.target.position.set(-1,-3.8,-2);
  sun.castShadow = true; sun.shadow.mapSize.set(2048,2048);
  Object.assign(sun.shadow.camera,{left:-19,right:19,top:16,bottom:-16,near:1,far:70});
  sun.shadow.camera.name='floor-shadow'; sun.shadow.normalBias=.005; sun.shadow.bias=-.000015;
  sun.shadow.autoUpdate=false; sun.visible=false; scene.add(sun,sun.target);

  // Both original posters share a hanging line and retain their native aspect ratio.
  const posterMount=new THREE.Group();posterMount.position.set(-6.69,-.4,3.6);posterMount.rotation.y=Math.PI/2;group.add(posterMount);
  const posterTargets=[];
  LOBSTER_POSTERS.forEach((art,index)=>{
    const height=3.04,width=height*art.width/art.height,x=(index-.5)*2.58;
    const frame=box(width+.06,height+.06,.045,ink,x,0,-.03);posterMount.add(frame);
    const surface=new THREE.Mesh(new THREE.PlaneGeometry(width,height),new THREE.MeshStandardMaterial({color:0xffffff,roughness:1}));
    surface.position.set(x,0,.004);surface.receiveShadow=true;posterMount.add(surface);posterTargets.push(frame,surface);
    new THREE.TextureLoader().load(art.file,texture=>{
      texture.colorSpace=THREE.SRGBColorSpace;texture.anisotropy=4;
      surface.material.map=texture;surface.material.needsUpdate=true;invalidate();
    },undefined,()=>{surface.visible=false;invalidate();});
  });
  // One concrete wall on the right. Each study is a real through-hole;
  // a matching plug fills it until the visitor asks to see the gap.
  const fedexMount=new THREE.Group();fedexMount.name='fedex-exhibit';
  fedexMount.position.set(CUTOUT_ANCHOR.x,CUTOUT_ANCHOR.y,CUTOUT_ANCHOR.z);fedexMount.rotation.y=-Math.PI/2;group.add(fedexMount);
  const concrete=createFairFacedConcrete({space:'local'});
  applySoftShadows(concrete, innerWidth<=760);
  const wordmarkMaterial=new THREE.MeshBasicMaterial({transparent:true,depthWrite:false,opacity:1});
  const cutouts=createNegativeSpaceWall({concrete,ink,wordmark:wordmarkMaterial});
  fedexMount.add(cutouts.root);
  new THREE.TextureLoader().load(FEDEX_ART.file,texture=>{
    texture.colorSpace=THREE.SRGBColorSpace;texture.anisotropy=4;
    wordmarkMaterial.map=texture;wordmarkMaterial.needsUpdate=true;invalidate();
  },undefined,()=>{const logo=fedexMount.getObjectByName('fedex-wordmark');if(logo)logo.visible=false;invalidate();});
  let revealTarget=0,revealAmount=0,focusStudy='fedex';
  const raycaster=new THREE.Raycaster();
  const fade=createExhibitFade(group,{lift:0,shrink:0});
  const gapPlane=new THREE.Plane(new THREE.Vector3(0,0,1),0);
  const hitPoint=new THREE.Vector3();
  let visible=false, targetMode='contour', coEdgeFocus=null;
  function applyCoEdgeFocus(){
    for(const wall of contourWalls){
      wall.material = coEdgeFocus === 'faces' ? inkFocus : coEdgeFocus === 'vase' ? inkRest : ink;
      wall.material.needsUpdate = true;
    }
    invalidate();
  }
  const startPosition=new THREE.Vector3(),startLook=new THREE.Vector3();
  let blend=1, poseKey='', manualOffset=0, entryTime=0, entryPending=false, entryDone=null;
  function pose() {
    const mobile=innerWidth<=760;
    if(entryTime>0)return {position:new THREE.Vector3(mobile?-.5:3.5,1.3,mobile?19:18),look:new THREE.Vector3(-5.7,-1.8,9)};
    if(targetMode==='fedex'){
      const focusY=mobile?studyById(focusStudy).centerY:0;
      const distance=mobile?5.4:Math.max(13.2,16.5/(innerWidth/innerHeight));
      const lookY=CUTOUT_ANCHOR.y+focusY;
      return {position:new THREE.Vector3(CUTOUT_ANCHOR.x-distance*(mobile?1:.98),mobile?lookY:.2,CUTOUT_ANCHOR.z+distance*(mobile?.02:.12)),look:new THREE.Vector3(CUTOUT_ANCHOR.x,mobile?lookY:CUTOUT_ANCHOR.y,CUTOUT_ANCHOR.z)};
    }
    if(targetMode==='poster'){
      const distance=mobile?16.2:Math.max(12,15/(innerWidth/innerHeight));
      return {position:new THREE.Vector3(-6.69+distance*(mobile?1:.944),mobile?.5:1,3.6+distance*(mobile?.05:.33)),look:new THREE.Vector3(-6.69,mobile?-.8:-1.3,3.6)};
    }
    return {position:new THREE.Vector3(mobile?.2:3,mobile?1.8:1.9,mobile?20:17.8),look:new THREE.Vector3(mobile?-.4:-.6,-.7,0)};
  }
  let lastPresence=null;
  function setPresence(value){
    if(value===lastPresence)return;lastPresence=value;
    fade(value);sun.visible=value>0;sun.intensity=2.7*value;
    sun.shadow.needsUpdate=true;invalidate();
  }
  return {
    contourPose(){return {position:new THREE.Vector3(innerWidth<=760?.2:3,innerWidth<=760?1.8:1.9,innerWidth<=760?20:17.8),look:new THREE.Vector3(innerWidth<=760?-.4:-.6,-.7,0)};},
    beginEntry(onComplete){entryTime=reduced.matches?0:.25;entryPending=true;entryDone=onComplete;poseKey='';},
    setVisible(value){visible=value;setPresence(value?1:0);blend=0;poseKey='';manualOffset=0;entryTime=0;entryPending=false;entryDone=null;coEdgeFocus=null;applyCoEdgeFocus();},
    setPresence,
    setCoEdgeFocus(value){coEdgeFocus=value;applyCoEdgeFocus();},
    setState(value,locale,{poster=false,fedex=false,arrow=false,study='fedex'}={}) {
      revealTarget=fedex&&arrow?1:0;
      focusStudy=studyById(study).id;
      targetMode=fedex?'fedex':poster||figureStage(value)==='posters'?'poster':'contour';
      if(targetMode!=='contour'){coEdgeFocus=null;applyCoEdgeFocus();}
      sun.shadow.needsUpdate=true;invalidate();
    },
    refreshShadows(){if(visible)sun.shadow.needsUpdate=true;},
    update(dt,camera,look){
      if(!visible)return false;
      const previousReveal=revealAmount;
      revealAmount=reduced.matches?revealTarget:THREE.MathUtils.damp(revealAmount,revealTarget,9,dt);
      if(Math.abs(revealAmount-revealTarget)<.001)revealAmount=revealTarget;
      for(const plug of cutouts.plugs)plug.position.z=plug.userData.closedZ+(plug.userData.openZ-plug.userData.closedZ)*revealAmount;
      entryTime=Math.max(0,entryTime-dt);
      const p=pose(),mobile=innerWidth<=760,key=`${entryTime>0?'entry':targetMode}:${mobile}:${targetMode==='fedex'&&mobile?focusStudy:''}`;
      if(poseKey!==key){poseKey=key;startPosition.copy(camera.position);startLook.copy(look);blend=0;manualOffset=0;}
      blend=reduced.matches?1:Math.min(1,blend+dt/(entryPending?.8:1.25));const t=blend*blend*(3-2*blend);
      p.position.x+=manualOffset;camera.position.lerpVectors(startPosition,p.position,t);look.lerpVectors(startLook,p.look,t);
      camera.up.set(0,1,0);camera.lookAt(look);
      // Reading and navigation follow the camera, while companions finish their route.
      if(entryPending&&entryTime===0&&blend===1){
        const done=entryDone;entryPending=false;entryDone=null;done?.();
      }
      return blend<1||entryTime>0||previousReveal!==revealAmount;
    },
    drag(delta){manualOffset=THREE.MathUtils.clamp(manualOffset+delta,-.65,.65);},
    pickFedex(pointer,camera){
      if(!visible)return false;
      raycaster.setFromCamera(pointer,camera);
      const hit=raycaster.intersectObjects(cutouts.pickables,false)[0];
      if(!hit)return false;
      return hit.object.userData.study||'fedex';
    },
    pickPoster(pointer,camera){if(!visible)return false;raycaster.setFromCamera(pointer,camera);return raycaster.intersectObjects(posterTargets).length>0;},
    pickCoEdge(pointer,camera){
      if(!visible||targetMode!=='contour')return null;
      raycaster.setFromCamera(pointer,camera);
      if(raycaster.intersectObjects(contourWalls,false).length)return 'faces';
      if(raycaster.ray.intersectPlane(gapPlane,hitPoint)&&Math.abs(hitPoint.x)<1.35&&hitPoint.y>-2.2&&hitPoint.y<3.5)return 'vase';
      return null;
    },
  };
}
