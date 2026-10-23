import * as THREE from 'three';
import { GALLERY_ENTRY } from './chapter-passage.js';
import { traceProfile } from './rubin-contour.js';
import { figureStage } from './figure-ground-system.js';
import { LOBSTER_POSTERS } from './gallery-art.js';
import { applySoftShadows } from './soft-shadows.js';

export function createFigureGroundScene(scene, reduced, invalidate) {
  const group = new THREE.Group(); group.name = 'figure-ground-gallery'; group.visible = false; scene.add(group);
  const pale = new THREE.MeshStandardMaterial({ color: 0xd7d8d4, roughness: .92 });
  const paper = new THREE.MeshStandardMaterial({ color: 0xe9e9e4, roughness: .88 });
  const ink = new THREE.MeshStandardMaterial({ color: 0x424641, roughness: .85 });
  for (const m of [pale, paper, ink]) { m.shadowSide = THREE.DoubleSide; applySoftShadows(m, innerWidth <= 760); }
  function box(w,h,d,material,x,y,z) {
    const mesh = new THREE.Mesh(new THREE.BoxGeometry(w,h,d), material);
    mesh.position.set(x,y,z); mesh.castShadow = mesh.receiveShadow = true; group.add(mesh); return mesh;
  }
  box(45,.16,62,pale,2,-3.89,0);
  box(30,12,.35,paper,2,2.2,-19);
  // An actual side-wall opening receives the companions from the previous room.
  const entry=GALLERY_ENTRY,back=-19.2,front=21.8,left=entry.z-entry.halfWidth,right=entry.z+entry.halfWidth,top=-.64;
  box(.35,12,left-back,pale,entry.x,2.2,(back+left)/2);
  box(.35,12,front-right,pale,entry.x,2.2,(right+front)/2);
  box(.35,8.2-top,right-left,pale,entry.x,(8.2+top)/2,entry.z);
  box(entry.depth,3.16,.12,pale,entry.x-entry.depth/2,-2.22,left-.06);
  box(entry.depth,3.16,.12,pale,entry.x-entry.depth/2,-2.22,right+.06);
  box(.08,3.16,right-left,ink,entry.x-entry.depth,-2.22,entry.z);
  box(.35,12,41,pale,17,2.2,1.3);
  group.add(new THREE.HemisphereLight(0xf0f0ea,0x9a9e96,.35));
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
  box(40,.18,8,pale,4,6.1,-16.5);
  box(40,.18,11,pale,4,6.1,-1.1);
  box(40,.18,22,pale,4,6.1,18.6);
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
  const raycaster=new THREE.Raycaster();
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
    if(targetMode==='poster'){
      const distance=mobile?16.2:Math.max(12,15/(innerWidth/innerHeight));
      return {position:new THREE.Vector3(-6.69+distance*(mobile?1:.944),mobile?.5:1,3.6+distance*(mobile?.05:.33)),look:new THREE.Vector3(-6.69,mobile?-.8:-1.3,3.6)};
    }
    return {position:new THREE.Vector3(mobile?.2:3,mobile?1.8:1.9,mobile?20:17.8),look:new THREE.Vector3(mobile?-.4:-.6,-.7,0)};
  }
  return {
    contourPose(){return {position:new THREE.Vector3(innerWidth<=760?.2:3,innerWidth<=760?1.8:1.9,innerWidth<=760?20:17.8),look:new THREE.Vector3(innerWidth<=760?-.4:-.6,-.7,0)};},
    beginEntry(onComplete){entryTime=reduced.matches?0:.25;entryPending=true;entryDone=onComplete;poseKey='';},
    setVisible(value){visible=value;group.visible=value;sun.visible=value;sun.shadow.needsUpdate=true;blend=0;poseKey='';manualOffset=0;entryTime=0;entryPending=false;entryDone=null;coEdgeFocus=null;applyCoEdgeFocus();},
    setCoEdgeFocus(value){coEdgeFocus=value;applyCoEdgeFocus();},
    setState(value,locale,{poster=false}={}) {
      targetMode=poster||figureStage(value)==='posters'?'poster':'contour';
      if(targetMode!=='contour'){coEdgeFocus=null;applyCoEdgeFocus();}
      sun.shadow.needsUpdate=true;invalidate();
    },
    refreshShadows(){if(visible)sun.shadow.needsUpdate=true;},
    update(dt,camera,look){
      if(!visible)return false;
      entryTime=Math.max(0,entryTime-dt);
      const p=pose(),key=`${entryTime>0?'entry':targetMode}:${innerWidth<=760}`;
      if(poseKey!==key){poseKey=key;startPosition.copy(camera.position);startLook.copy(look);blend=0;manualOffset=0;}
      blend=reduced.matches?1:Math.min(1,blend+dt/(entryPending?.8:1.25));const t=blend*blend*(3-2*blend);
      p.position.x+=manualOffset;camera.position.lerpVectors(startPosition,p.position,t);look.lerpVectors(startLook,p.look,t);
      camera.up.set(0,1,0);camera.lookAt(look);
      // Reading and navigation follow the camera, while companions finish their route.
      if(entryPending&&entryTime===0&&blend===1){
        const done=entryDone;entryPending=false;entryDone=null;done?.();
      }
      return blend<1||entryTime>0;
    },
    drag(delta){manualOffset=THREE.MathUtils.clamp(manualOffset+delta,-.65,.65);},
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
