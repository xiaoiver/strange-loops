import * as THREE from 'three';
import { FontLoader } from 'three/addons/loaders/FontLoader.js';
import { TextGeometry } from 'three/addons/geometries/TextGeometry.js';
import fontData from 'three/examples/fonts/optimer_regular.typeface.json';
import { GALLERY_ENTRY } from './chapter-passage.js';
import { traceProfile } from './rubin-contour.js';
import { NUMBERS, figureStage, numberEvidence } from './figure-ground-system.js';
import { FIGURE_COPY } from './figure-ground-copy.js';
import { ART_LABELS, LOBSTER_POSTERS, LOBSTER_CREDIT } from './gallery-art.js';
import { applySoftShadows } from './soft-shadows.js';

export function createFigureGroundScene(scene, reduced, invalidate) {
  const group = new THREE.Group(); group.name = 'figure-ground-gallery'; group.visible = false; scene.add(group);
  const pale = new THREE.MeshStandardMaterial({ color: 0xd7d8d4, roughness: .92 });
  const paper = new THREE.MeshStandardMaterial({ color: 0xe9e9e4, roughness: .88 });
  const ink = new THREE.MeshStandardMaterial({ color: 0x424641, roughness: .85 });
  const plateMat = new THREE.MeshStandardMaterial({ color: 0xcfd1ca, roughness: .88 });
  for (const m of [pale, paper, ink, plateMat]) { m.shadowSide = THREE.DoubleSide; applySoftShadows(m, innerWidth <= 760); }
  const font = new FontLoader().parse(fontData), entries = [];
  function box(w,h,d,material,x,y,z) {
    const mesh = new THREE.Mesh(new THREE.BoxGeometry(w,h,d), material);
    mesh.position.set(x,y,z); mesh.castShadow = mesh.receiveShadow = true; group.add(mesh); return mesh;
  }
  function text(value, size, material, x,y,z) {
    const geometry = new TextGeometry(value, { font, size, depth: .014, curveSegments: 5 });
    geometry.computeBoundingBox(); geometry.translate(-(geometry.boundingBox.max.x + geometry.boundingBox.min.x)/2, 0, 0);
    const mesh = new THREE.Mesh(geometry, material); mesh.position.set(x,y,z); mesh.castShadow = mesh.receiveShadow = true; group.add(mesh); return mesh;
  }
  box(45,.16,40,pale,2,-3.89,7);
  box(30,12,.35,paper,2,2.2,-5);
  // An actual side-wall opening receives the companions from the previous room.
  const entry=GALLERY_ENTRY,back=-5.2,front=21.8,left=entry.z-entry.halfWidth,right=entry.z+entry.halfWidth,top=-.64;
  box(.35,12,left-back,pale,entry.x,2.2,(back+left)/2);
  box(.35,12,front-right,pale,entry.x,2.2,(right+front)/2);
  box(.35,8.2-top,right-left,pale,entry.x,(8.2+top)/2,entry.z);
  box(entry.depth,3.16,.12,pale,entry.x-entry.depth/2,-2.22,left-.06);
  box(entry.depth,3.16,.12,pale,entry.x-entry.depth/2,-2.22,right+.06);
  box(.08,3.16,right-left,ink,entry.x-entry.depth,-2.22,entry.z);
  box(.35,12,27,pale,17,2.2,8.3);
  group.add(new THREE.HemisphereLight(0xf0f0ea,0x9a9e96,.35));
  // Two architectural piers share the vase boundary. The middle remains empty space.
  const contour = new THREE.Group(); contour.position.set(0,-3.8,0); group.add(contour);
  const edges = new THREE.Group(); contour.add(edges);
  for (const sign of [-1,1]) {
    const shape = traceProfile(new THREE.Shape(), sign);
    shape.lineTo(sign * 5.2,0); shape.lineTo(sign * 5.2,6); shape.closePath();
    const geo = new THREE.ExtrudeGeometry(shape,{ depth: .48, bevelEnabled: false, curveSegments: 18 });
    const wall = new THREE.Mesh(geo,ink); wall.castShadow = wall.receiveShadow = true; contour.add(wall);
    const outline = traceProfile(new THREE.Path(), sign).getPoints(90).map(p => new THREE.Vector3(p.x,p.y,.49));
    edges.add(new THREE.Line(new THREE.BufferGeometry().setFromPoints(outline),new THREE.LineBasicMaterial({color:0xf0f0e9})));
  }
  edges.visible = false;
  // A real roof aperture casts the diagonal light band onto walls, floor and actors.
  box(40,.18,19,pale,4,6.1,-5.1);
  box(40,.18,22,pale,4,6.1,18.6);
  const sun = new THREE.DirectionalLight(0xf4f4ef,2.7); sun.position.set(5,17,10); sun.target.position.set(-1,-3.8,-2);
  sun.castShadow = true; sun.shadow.mapSize.set(2048,2048);
  Object.assign(sun.shadow.camera,{left:-19,right:19,top:16,bottom:-16,near:1,far:70});
  sun.shadow.camera.name='floor-shadow'; sun.shadow.normalBias=.005; sun.shadow.bias=-.000015;
  sun.shadow.autoUpdate=false; sun.visible=false; scene.add(sun,sun.target);

  for (const [i,n] of NUMBERS.entries()) {
    const x=6.3+(i%6)*1.47, y=.6-Math.floor(i/6)*1.65;
    const plate=box(1.25,1.35,.095,plateMat,x,y,-4.73);
    const digit=text(String(n),.5,ink,x,y-.18,-4.66);
    const ring=new THREE.LineSegments(new THREE.EdgesGeometry(new THREE.BoxGeometry(1.32,1.42,.11)),new THREE.LineBasicMaterial({color:0x353b35,transparent:true}));
    ring.position.copy(plate.position);ring.visible=false;group.add(ring);
    entries.push({n,plate,digit,ring,reveal:1});
  }
  const relation = new THREE.Group(); group.add(relation);
  for (let g=0;g<2;g++) for(let i=0;i<3;i++) {
    const mark=box(.035,.32,.04,ink,7.2+g*.83+i*.15,-2.35,-4.65);relation.add(mark);
  }
  const relationText=text('2 x 3 = 6',.21,ink,10.7,-2.4,-4.65);relation.add(relationText);
  const eightText=text('2 x 4 = 8',.23,ink,7,-3.06,-4.65);
  const noteCanvas=document.createElement('canvas');noteCanvas.width=1024;noteCanvas.height=120;
  const noteTexture=new THREE.CanvasTexture(noteCanvas);noteTexture.colorSpace=THREE.SRGBColorSpace;
  const note=new THREE.Mesh(new THREE.PlaneGeometry(6.5,.76),new THREE.MeshBasicMaterial({map:noteTexture,transparent:true,depthWrite:false}));
  note.position.set(11.3,-2.95,-4.64);group.add(note);
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
  // A small, flush museum label lives on the wall, with accessible HTML alongside.
  const labelCanvas=document.createElement('canvas');labelCanvas.width=1200;labelCanvas.height=480;
  const labelTexture=new THREE.CanvasTexture(labelCanvas);labelTexture.colorSpace=THREE.SRGBColorSpace;
  const label=new THREE.Mesh(new THREE.PlaneGeometry(2.15,.86),new THREE.MeshStandardMaterial({map:labelTexture,roughness:1}));
  label.position.set(-1.29,-2.13,.008);label.receiveShadow=true;posterMount.add(label);posterTargets.push(label);
  function paintLabel(locale){
    const t=ART_LABELS[locale],ctx=labelCanvas.getContext('2d');ctx.fillStyle='#e8e8e3';ctx.fillRect(0,0,1200,480);ctx.fillStyle='#303330';ctx.textAlign='left';
    const line=(v,size,y)=>{ctx.font=`${size}px system-ui`;const fitted=Math.min(size,size*1080/ctx.measureText(v).width);ctx.font=`${fitted}px system-ui`;ctx.fillText(v,56,y);};
    line(`${t.title}, ${LOBSTER_CREDIT.year}`,68,108);line(LOBSTER_CREDIT.designer,49,210);
    line(t.design,39,276);line(t.medium,39,342);line(t.source,34,419);labelTexture.needsUpdate=true;
  }
  const raycaster=new THREE.Raycaster();
  let visible=false, state=null, currentLocale='zh', targetMode='contour';
  const startPosition=new THREE.Vector3(),startLook=new THREE.Vector3();
  let blend=1, poseKey='', manualOffset=0, entryTime=0;
  function layoutEvidence(){
    const mobile=innerWidth<=760,columns=mobile?4:6;
    entries.forEach((entry,i)=>{
      const x=(mobile?7.6:6.3)+(i%columns)*(mobile?1.4:1.47),y=(mobile?1.5:.6)-Math.floor(i/columns)*(mobile?1.55:1.65);
      entry.plate.position.set(x,y,-4.73);entry.digit.position.set(x,y-.18,-4.66);entry.ring.position.copy(entry.plate.position);
    });
    relation.position.y=mobile?-.6:0;
    relation.visible=state?.meaning&&(!mobile||figureStage(state)==='numbers');
    eightText.position.set(mobile?10.4:7,mobile?-.91:-3.06,-4.65);eightText.scale.setScalar(mobile?.6:1);
    note.position.set(mobile?9.7:11.3,mobile?-3.25:-2.95,-4.64);
  }
  function pose() {
    const mobile=innerWidth<=760;
    if(entryTime>0)return {position:new THREE.Vector3(mobile?-.5:3.5,1.3,mobile?19:18),look:new THREE.Vector3(-5.7,-1.8,9)};
    if(targetMode==='poster'){
      const distance=mobile?16.2:Math.max(12,15/(innerWidth/innerHeight));
      return {position:new THREE.Vector3(-6.69+distance*(mobile?1:.944),mobile?.5:1,3.6+distance*(mobile?.05:.33)),look:new THREE.Vector3(-6.69,mobile?-.8:-1.3,3.6)};
    }
    if(targetMode==='numbers') return {position:new THREE.Vector3(mobile?10.3:13,mobile?1.4:1.2,mobile?13.5:14.5),look:new THREE.Vector3(mobile?9.7:9.8,mobile?-1.15:-1.5,-4.6)};
    return {position:new THREE.Vector3(mobile?.2:3,mobile?1.8:1.9,mobile?20:17.8),look:new THREE.Vector3(mobile?-.4:-.6,-.7,0)};
  }
  function paintNote(t) {
    const ctx=noteCanvas.getContext('2d');ctx.clearRect(0,0,1024,120);ctx.fillStyle='#353b35';ctx.textAlign='center';
    const line=(value,size,y)=>{ctx.font=`${size}px system-ui`;const fitted=Math.min(size,size*990/ctx.measureText(value).width);ctx.font=`${fitted}px system-ui`;ctx.fillText(value,512,y);};
    line(t.checked,44,45);line(`11 · ${t.prime}`,34,100);noteTexture.needsUpdate=true;
  }
  return {
    beginEntry(){entryTime=3.2;poseKey='';},
    setVisible(value){visible=value;group.visible=value;sun.visible=value;sun.shadow.needsUpdate=true;blend=0;poseKey='';manualOffset=0;entryTime=0;},
    setState(value,locale,{hint=false,explore=false,poster=false}={}) {
      state=value;currentLocale=locale;
      const stage=figureStage(state), mode=['faces','ground'].includes(stage)?'contour':'numbers';
      targetMode=poster?'poster':explore?'contour':mode;
      edges.visible=hint||stage==='ground';relation.visible=mode==='numbers';
      eightText.visible=['eight','eleven','complete'].includes(stage);note.visible=['eleven','complete'].includes(stage);
      for(const entry of entries){const e=numberEvidence(state,entry.n);entry.plate.material=e.kind==='composite'?ink:plateMat;entry.digit.material=e.kind==='composite'?paper:ink;if(e.kind==='prime'&&!entry.ring.visible)entry.reveal=reduced.matches?1:0;entry.ring.visible=e.kind==='prime';}
      layoutEvidence();
      paintLabel(currentLocale);paintNote(FIGURE_COPY[currentLocale]);sun.shadow.needsUpdate=true;invalidate();
    },
    refreshShadows(){if(visible)sun.shadow.needsUpdate=true;},
    update(dt,camera,look){
      if(!visible)return false;
      let revealing=false;
      for(const entry of entries)if(entry.ring.visible){entry.reveal=reduced.matches?1:Math.min(1,entry.reveal+dt/.45);const ease=1-(1-entry.reveal)**3;entry.ring.material.opacity=ease;entry.ring.scale.setScalar(.97+.03*ease);revealing ||= entry.reveal<1;}
      entryTime=Math.max(0,entryTime-dt);
      const p=pose(),key=`${entryTime>0?'entry':targetMode}:${innerWidth<=760}`;
      if(poseKey!==key){poseKey=key;layoutEvidence();startPosition.copy(camera.position);startLook.copy(look);blend=0;manualOffset=0;}
      blend=reduced.matches?1:Math.min(1,blend+dt/1.25);const t=blend*blend*(3-2*blend);
      p.position.x+=manualOffset;camera.position.lerpVectors(startPosition,p.position,t);look.lerpVectors(startLook,p.look,t);
      camera.up.set(0,1,0);camera.lookAt(look);return blend<1||revealing;
    },
    drag(delta){manualOffset=THREE.MathUtils.clamp(manualOffset+delta,-.65,.65);},
    pickPoster(pointer,camera){if(!visible)return false;raycaster.setFromCamera(pointer,camera);return raycaster.intersectObjects(posterTargets).length>0;},
  };
}
