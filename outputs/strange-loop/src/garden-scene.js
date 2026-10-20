import * as THREE from 'three';
import { FontLoader } from 'three/addons/loaders/FontLoader.js';
import { TextGeometry } from 'three/addons/geometries/TextGeometry.js';
import fontData from 'three/examples/fonts/optimer_regular.typeface.json';
import { createExhibitFade } from './exhibit-fade.js';
import { displayWord, rewriteSources } from './miu-system.js';

export function createGardenScene(scene, reduced, { backWall } = {}) {
  const group = new THREE.Group(); group.visible = false; scene.add(group);
  const fade = createExhibitFade(group, { anchorY: -3.8, lift: .12, shrink: .018 });
  const font = new FontLoader().parse(fontData), geometries = new Map();
  const plinth = new THREE.MeshStandardMaterial({color:0x505451,roughness:.88});
  const ink = new THREE.MeshStandardMaterial({color:0x252827,roughness:.62});
  const highlight = new THREE.MeshStandardMaterial({color:0xe9eae7,roughness:.68,emissive:0x343634,emissiveIntensity:.35});
  const pale = new THREE.MeshStandardMaterial({color:0xe0e0de,roughness:.9});
  function box(w,h,d,material,x,y,z){
    const mesh=new THREE.Mesh(new THREE.BoxGeometry(w,h,d),material);
    mesh.position.set(x,y,z);mesh.castShadow=mesh.receiveShadow=true;group.add(mesh);return mesh;
  }
  box(4.8,.48,2.8,plinth,1,-3.56,1);

  // Open the existing wall instead of placing a dark rectangle on its surface.
  const lobbyWallGeometry = backWall?.geometry;
  let doorwayWallGeometry;
  if (backWall) {
    const shape = new THREE.Shape();
    shape.moveTo(-3.8,-3.8);shape.lineTo(-1.55,-3.8);shape.lineTo(-1.55,.15);
    shape.lineTo(.35,.15);shape.lineTo(.35,-3.8);shape.lineTo(38.2,-3.8);
    shape.lineTo(38.2,38.2);shape.lineTo(-3.8,38.2);shape.closePath();
    doorwayWallGeometry = new THREE.ShapeGeometry(shape);
    doorwayWallGeometry.translate(-backWall.position.x,-backWall.position.y,0);
  }
  const reveal = new THREE.MeshStandardMaterial({color:0xd7d8d5,roughness:.94});
  const interior = new THREE.MeshStandardMaterial({color:0x646864,roughness:.97,envMapIntensity:.08,fog:false});
  const darkness = new THREE.MeshStandardMaterial({color:0x101312,roughness:1,envMapIntensity:0,fog:false});
  box(.16,3.95,1.1,reveal,-1.63,-1.825,-4.365);
  box(.16,3.95,1.1,reveal,.43,-1.825,-4.365);
  box(2.22,.16,3.4,reveal,-.6,.23,-5.515);
  box(.16,3.95,2.3,interior,-1.63,-1.825,-6.065);
  box(.16,3.95,2.3,interior,.43,-1.825,-6.065);
  box(1.9,.06,3.4,interior,-.6,-3.8,-5.5);
  box(1.9,3.95,.1,darkness,-.6,-1.825,-7.2);
  const target = new THREE.Group(); target.position.set(-.6,.55,-3.72); group.add(target);

  // A distant skylight through a real rectangular roof aperture. Its shadow
  // creates one continuous band on the wall and floor, including object shadows.
  const roofY=5.7, apertureLeft=1.2, apertureRight=5.4;
  box(apertureLeft+20,.12,40,pale,(-20+apertureLeft)/2,roofY,0);
  box(20-apertureRight,.12,40,pale,(20+apertureRight)/2,roofY,0);
  box(apertureRight-apertureLeft,.12,12,pale,(apertureLeft+apertureRight)/2,roofY,-14);
  box(apertureRight-apertureLeft,.12,11,pale,(apertureLeft+apertureRight)/2,roofY,14.5);
  const skylight=new THREE.SpotLight(0xf4f4f1,0,80,.48,.16,2);
  skylight.name='garden-skylight';skylight.position.set(8,22,17);skylight.target.position.set(1,-3.8,-1);
  skylight.castShadow=true;skylight.visible=false;skylight.shadow.mapSize.set(1024,1024);
  Object.assign(skylight.shadow.camera,{near:.5,far:65});
  skylight.shadow.normalBias=.004;skylight.shadow.bias=-.00002;skylight.shadow.radius=3;
  skylight.shadow.autoUpdate=false;skylight.shadow.camera.name='floor-shadow';
  scene.add(skylight,skylight.target);
  function setPresence(value){
    fade(value);skylight.visible=value>0;skylight.intensity=4000*value;skylight.shadow.needsUpdate=true;
    if(backWall)backWall.geometry=value>0?doorwayWallGeometry:lobbyWallGeometry;
  }
  const letters = new THREE.Group();letters.position.set(1,-3.30,1.55);letters.rotation.y=.1;group.add(letters);
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
