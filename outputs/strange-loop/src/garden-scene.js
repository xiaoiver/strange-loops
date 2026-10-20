import * as THREE from 'three';
import { FontLoader } from 'three/addons/loaders/FontLoader.js';
import { TextGeometry } from 'three/addons/geometries/TextGeometry.js';
import fontData from 'three/examples/fonts/optimer_regular.typeface.json';
import { createExhibitFade } from './exhibit-fade.js';
import { displayWord, rewriteSources } from './miu-system.js';
import { passageGeometry, applyPassageOcclusion } from './passage-occlusion.js';

export function createGardenScene(scene, reduced, { exitWall, floorMaterial } = {}) {
  const group = new THREE.Group(); group.visible = false; scene.add(group);
  const fade = createExhibitFade(group, { anchorY: -3.8, lift: .12, shrink: .018 });
  const font = new FontLoader().parse(fontData), geometries = new Map();
  const plinth = new THREE.MeshStandardMaterial({color:0x505451,roughness:.88});
  // Cast from the lit surface so the thin plinth's contact shadow stays attached.
  plinth.shadowSide=THREE.FrontSide;
  const ink = new THREE.MeshStandardMaterial({color:0x252827,roughness:.62});
  const highlight = new THREE.MeshStandardMaterial({color:0xe9eae7,roughness:.68,emissive:0x343634,emissiveIntensity:.35});
  const pale = new THREE.MeshStandardMaterial({color:0xe0e0de,roughness:.9});
  function box(w,h,d,material,x,y,z){
    const mesh=new THREE.Mesh(new THREE.BoxGeometry(w,h,d),material);
    mesh.position.set(x,y,z);mesh.castShadow=mesh.receiveShadow=true;group.add(mesh);return mesh;
  }
  const tableScale=.8;
  const table=box(4.8,.48,2.8,plinth,1,-3.8+.24*tableScale,1);
  table.scale.setScalar(tableScale);table.rotation.y=Math.PI/2;

  // Open the existing wall instead of placing a dark rectangle on its surface.
  const lobbyWallGeometry = exitWall?.geometry, lobbyWallMaterial=exitWall?.material;
  const lobbyWallCastShadow=exitWall?.castShadow, doorZ=-1.3, doorScale=.8;
  const doorwayWallMaterial=lobbyWallMaterial?.clone();
  // The gallery wall must occlude light on both sides of the opening.
  if(doorwayWallMaterial)doorwayWallMaterial.shadowSide=THREE.DoubleSide;
  let doorwayWallGeometry;
  if (exitWall) {
    exitWall.updateMatrixWorld(true);
    const center=exitWall.worldToLocal(new THREE.Vector3(-3.8,-3.8,doorZ));
    const left=center.x-.95*doorScale, right=center.x+.95*doorScale, floor=center.y, top=floor+3.95*doorScale;
    const shape = new THREE.Shape();
    shape.moveTo(-21,floor);shape.lineTo(left,floor);shape.lineTo(left,top);
    shape.lineTo(right,top);shape.lineTo(right,floor);shape.lineTo(21,floor);
    shape.lineTo(21,21);shape.lineTo(-21,21);shape.closePath();
    doorwayWallGeometry = new THREE.ShapeGeometry(shape);
  }
  const doorway = new THREE.Group();doorway.position.set(-3.8,-3.8*(1-doorScale),doorZ);doorway.scale.setScalar(doorScale);doorway.rotation.y=Math.PI/2;group.add(doorway);
  function doorBox(w,h,d,material,x,y,z,occlusion=true){
    const mesh=box(w,h,d,material,x,y,z);
    if(occlusion){mesh.geometry.dispose();mesh.geometry=passageGeometry(w,h,d,x,y,z);}
    doorway.add(mesh);return mesh;
  }
  const reveal = new THREE.MeshStandardMaterial({color:0xd7d8d5,roughness:.94});
  const passageFloor=floorMaterial?.clone()||new THREE.MeshStandardMaterial({color:0xd6d6d5,roughness:.84});
  for(const material of [reveal,passageFloor])applyPassageOcclusion(material);
  const darkness = new THREE.MeshStandardMaterial({color:0x101312,roughness:1,envMapIntensity:0,fog:false});
  // Continuous jambs avoid a painted light/dark seam partway into the passage.
  const passageDepth=.9;
  doorBox(.16,3.95,passageDepth,reveal,-1.03,-1.825,-passageDepth/2-.015);
  doorBox(.16,3.95,passageDepth,reveal,1.03,-1.825,-passageDepth/2-.015);
  doorBox(2.22,.16,passageDepth,reveal,0,.23,-passageDepth/2-.015);
  // The threshold meets the hall floor at exactly the same height and finish.
  doorBox(1.9,.06,passageDepth,passageFloor,0,-3.83,-passageDepth/2);
  doorBox(1.9,3.95,.1,darkness,0,-1.825,-passageDepth,false);
  const target = new THREE.Group(); target.position.set(0,.55,.08); doorway.add(target);

  // A distant skylight through a real rectangular roof aperture. Its shadow
  // creates one continuous band on the wall and floor, including object shadows.
  const roofY=5.7, apertureBack=-4.31, apertureFront=-.84, apertureCenter=(apertureBack+apertureFront)/2;
  box(40,.12,apertureBack+20,pale,0,roofY,(-20+apertureBack)/2);
  box(40,.12,20-apertureFront,pale,0,roofY,(20+apertureFront)/2);
  box(12,.12,apertureFront-apertureBack,pale,-14,roofY,apertureCenter);
  box(11,.12,apertureFront-apertureBack,pale,14.5,roofY,apertureCenter);
  const skylight=new THREE.SpotLight(0xf4f4f1,0,80,.48,.16,3);
  skylight.name='garden-skylight';skylight.position.set(17,22,-10);skylight.target.position.set(1,-3.8,1);
  // Preserve illumination at the floor target while increasing distance contrast.
  const skylightIntensity=4000*Math.pow(skylight.position.distanceTo(skylight.target.position),skylight.decay-2);
  skylight.castShadow=true;skylight.visible=false;skylight.shadow.mapSize.set(2048,2048);
  // All gallery casters are well beyond eight units; avoid wasting perspective
  // depth precision near the source, which amplifies bias at the floor.
  Object.assign(skylight.shadow.camera,{near:8,far:80});
  skylight.shadow.normalBias=.001;skylight.shadow.bias=-.00001;skylight.shadow.radius=3;
  skylight.shadow.autoUpdate=false;skylight.shadow.camera.name='floor-shadow';
  scene.add(skylight,skylight.target);
  function setPresence(value){
    fade(value);skylight.visible=value>0;skylight.intensity=skylightIntensity*value;skylight.shadow.needsUpdate=true;
    if(exitWall){
      exitWall.geometry=value>0?doorwayWallGeometry:lobbyWallGeometry;
      exitWall.material=value>0?doorwayWallMaterial:lobbyWallMaterial;
      exitWall.castShadow=value>0?true:lobbyWallCastShadow;
    }
  }
  const letters = new THREE.Group();letters.position.set(1+.55*tableScale,-3.8+.5*tableScale,1);letters.scale.setScalar(tableScale);letters.rotation.y=Math.PI/2-.1;group.add(letters);
  const trails = new THREE.Group();group.add(trails);
  const trailMat=new THREE.MeshBasicMaterial({color:0x777b78,transparent:true,opacity:.65,depthWrite:false});
  let current='',language='',motion=null,ghost=null,goal='',pathKey='';
  function geometry(letter){
    if(!geometries.has(letter)){
      const g=new TextGeometry(letter,{font,size:1,depth:.1,curveSegments:5,bevelEnabled:true,bevelThickness:.008,bevelSize:.006,bevelSegments:1});
      g.computeBoundingBox();g.translate(-g.boundingBox.min.x,-g.boundingBox.min.y,0);g.computeBoundingBox();geometries.set(letter,g);
    }
    return geometries.get(letter);
  }
  function layout(text){
    const perRow=16, rows=Math.ceil(text.length/perRow), spacing=.13, rowSpacing=1.15;
    const data=[];
    for(let row=0;row<rows;row++){
      const chars=[...text.slice(row*perRow,(row+1)*perRow)];
      const widths=chars.map(ch=>geometry(ch).boundingBox.max.x);
      const total=widths.reduce((sum,w)=>sum+w+spacing,0)-spacing;
      const scale=Math.min(.95,4.1/Math.max(total,1),rows>1?1.9/(rows*rowSpacing):1);
      let x=-total*scale/2;
      chars.forEach((ch,i)=>{data.push({ch,x,y:0,z:-row*rowSpacing*scale,scale});x+=(widths[i]+spacing)*scale;});
    }
    return data;
  }
  function clearMotion(){
    if(ghost){group.remove(ghost);ghost.traverse(m=>{if(m.isMesh)m.material.dispose();});ghost=null;}
    motion=null;
  }
  function setTarget(text){
    if(text===goal)return;goal=text;target.children.forEach(m=>m.geometry.dispose());target.clear();
    const g=new TextGeometry(text,{font,size:.58,depth:.025,curveSegments:5});g.computeBoundingBox();
    const width=g.boundingBox.max.x-g.boundingBox.min.x;g.translate(-width/2,0,0);
    const m=new THREE.Mesh(g,ink);if(width>1.8)m.scale.setScalar(1.8/width);target.add(m);
  }
  function setTrail(path){
    const key=path.join('|');if(key===pathKey)return;pathKey=key;
    trails.children.forEach(m=>m.geometry.dispose());trails.clear();
    path.slice(-5).forEach((word,i)=>{
      const text=word.length>14?word.slice(0,11)+'...':word;
      const g=new TextGeometry(text,{font,size:.28,depth:.001,curveSegments:2});g.computeBoundingBox();g.translate(-(g.boundingBox.max.x-g.boundingBox.min.x)/2,0,0);
      const mesh=new THREE.Mesh(g,trailMat);mesh.rotation.set(-Math.PI/2,0,-.35);mesh.position.set(-2.1-i*.04,-3.785,2.6-i*1.08);trails.add(mesh);
    });
  }
  return {
    setVisible(value){setPresence(value ? 1 : 0);},
    setPresence,
    refreshShadows(){skylight.shadow.needsUpdate=true;},
    settle(){
      clearMotion();
      letters.children.forEach(m=>{m.position.copy(m.userData.end);m.scale.setScalar(m.userData.scale);});
    },
    setWord(word,locale,meta={}){
      setTarget(displayWord(meta.target||'MU',locale));
      setTrail((meta.path||[word]).map(w=>displayWord(w,locale)));
      if(word===current&&locale===language)return;
      clearMotion();
      const previousPositions=letters.children.map(m=>m.position.clone());
      const previousScales=letters.children.map(m=>m.scale.x);
      let sources=[];
      const animate=group.visible&&!reduced.matches&&meta.previous===current&&meta.rule&&locale===language;
      if(animate){
        sources=rewriteSources(current,meta.rule,meta.position);
        ghost=letters.clone();ghost.traverse(m=>{if(m.isMesh){m.material=ink.clone();m.material.transparent=true;}});group.add(ghost);
      }
      letters.clear();
      const destinations=layout(displayWord(word,locale));
      destinations.forEach((entry,i)=>{
        const mesh=new THREE.Mesh(geometry(entry.ch),ink);mesh.castShadow=mesh.receiveShadow=true;
        mesh.rotation.x=-Math.PI/2;
        mesh.position.set(entry.x,entry.y,entry.z);mesh.scale.setScalar(entry.scale);
        mesh.userData.end=mesh.position.clone();mesh.userData.scale=entry.scale;
        if(animate){
          const source=sources[i];
          if(source>=0&&previousPositions[source]){mesh.position.copy(previousPositions[source]);mesh.scale.setScalar(previousScales[source]);}
          else{mesh.position.y+=.65;mesh.scale.setScalar(entry.scale*.3);}
        }
        mesh.userData.start=mesh.position.clone();mesh.userData.startScale=mesh.scale.x;letters.add(mesh);
      });
      current=word;language=locale;if(animate)motion={age:0};
    },
    highlight(position,length){letters.children.forEach((m,i)=>{m.material=position!==null&&i>=position&&i<position+length?highlight:ink;});},
    update(dt){
      if(!motion)return false;
      motion.age+=dt;const t=reduced.matches?1:Math.min(1,motion.age/.55),ease=1-Math.pow(1-t,3);
      letters.children.forEach(m=>{m.position.lerpVectors(m.userData.start,m.userData.end,ease);m.scale.setScalar(THREE.MathUtils.lerp(m.userData.startScale,m.userData.scale,ease));});
      if(ghost)ghost.traverse(m=>{if(m.isMesh)m.material.opacity=Math.max(0,1-t*2.5);});
      if(t===1)clearMotion();return true;
    },
  };
}
