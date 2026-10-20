import * as THREE from 'three';
import { FontLoader } from 'three/addons/loaders/FontLoader.js';
import { TextGeometry } from 'three/addons/geometries/TextGeometry.js';
import fontData from 'three/examples/fonts/optimer_regular.typeface.json';
import { createExhibitFade } from './exhibit-fade.js';
import { displayWord, rewriteSources } from './miu-system.js';

export function createGardenScene(scene, reduced) {
  const group = new THREE.Group(); group.visible = false; scene.add(group);
  const fade = createExhibitFade(group, { anchorY: -3.8, lift: .12, shrink: .018 });
  const font = new FontLoader().parse(fontData), geometries = new Map();
  const stone = new THREE.MeshStandardMaterial({color:0xa2a3a1,roughness:.88});
  const ink = new THREE.MeshStandardMaterial({color:0x252827,roughness:.62});
  const highlight = new THREE.MeshStandardMaterial({color:0x777d79,roughness:.6,emissive:0x191c19});
  const pale = new THREE.MeshStandardMaterial({color:0xe0e0de,roughness:.9});
  function box(w,h,d,material,x,y,z){
    const mesh=new THREE.Mesh(new THREE.BoxGeometry(w,h,d),material);
    mesh.position.set(x,y,z);mesh.castShadow=mesh.receiveShadow=true;group.add(mesh);return mesh;
  }
  box(4.8,.65,2.8,stone,1,-3.475,1);
  // A recessed exhibit, not a gate that must open before the visitor can leave.
  box(2.2,3.8,.1,ink,3.1,-1.9,-3.71);
  box(.16,3.95,.32,pale,1.92,-1.825,-3.62);
  box(.16,3.95,.32,pale,4.28,-1.825,-3.62);
  box(2.52,.16,.32,pale,3.1,.15,-3.62);
  const target = new THREE.Group(); target.position.set(3.1,-1.4,-3.62); group.add(target);
  const letters = new THREE.Group();letters.position.set(1,-3.13,1.55);letters.rotation.y=.5;group.add(letters);
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
    const perRow=16, rows=Math.ceil(text.length/perRow), spacing=.13;
    const data=[];
    for(let row=0;row<rows;row++){
      const chars=[...text.slice(row*perRow,(row+1)*perRow)];
      const widths=chars.map(ch=>geometry(ch).boundingBox.max.x);
      const total=widths.reduce((sum,w)=>sum+w+spacing,0)-spacing;
      const scale=Math.min(.95,4.1/Math.max(total,1),rows>1?1.9/(rows*.85):1);
      let x=-total*scale/2;
      chars.forEach((ch,i)=>{data.push({ch,x,y:0,z:-row*.85*scale,scale});x+=(widths[i]+spacing)*scale;});
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
    const m=new THREE.Mesh(g,pale);if(width>1.8)m.scale.setScalar(1.8/width);target.add(m);
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
    setVisible(value){fade(value ? 1 : 0);},
    setPresence(value){fade(value);},
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
