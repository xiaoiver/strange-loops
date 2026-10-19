import * as THREE from 'three';
import { FontLoader } from 'three/addons/loaders/FontLoader.js';
import { TextGeometry } from 'three/addons/geometries/TextGeometry.js';
import { toCreasedNormals } from 'three/addons/utils/BufferGeometryUtils.js';
import { Brush, Evaluator, INTERSECTION } from 'three-bvh-csg';
import fs from 'node:fs';
const font=new FontLoader().parse(JSON.parse(fs.readFileSync(new URL('../node_modules/three/examples/fonts/helvetiker_bold.typeface.json',import.meta.url))));
function glyph(letter,axis){
 const g=new TextGeometry(letter,{font,size:3,depth:4,curveSegments:16,bevelEnabled:false});
 g.computeBoundingBox();const b=g.boundingBox; const s=b.getSize(new THREE.Vector3());
 g.translate(-b.min.x,-b.min.y,-b.min.z);g.scale(3.5/s.x,3.5/s.y,1);g.translate(-1.75,-1.75,-2);
 if(axis==='x')g.rotateY(Math.PI/2);if(axis==='y')g.rotateX(-Math.PI/2);
 const mesh=new Brush(g,new THREE.MeshStandardMaterial());mesh.updateMatrixWorld();return mesh;
}
const ev=new Evaluator();ev.useGroups=false;ev.attributes=['position','normal'];
const result=ev.evaluate(ev.evaluate(glyph('G','z'),glyph('E','x'),INTERSECTION),glyph('B','y'),INTERSECTION);
result.geometry=toCreasedNormals(result.geometry,Math.PI/6);
const n=result.geometry.attributes.position.count;
const data=Buffer.alloc(4+n*12);data.writeUInt32LE(n,0);
const pos=result.geometry.attributes.position.array,norm=result.geometry.attributes.normal.array;
for(let i=0;i<n*3;i++){data.writeInt16LE(Math.round(pos[i]*8192),4+i*2);data.writeInt16LE(Math.round(Math.max(-1,Math.min(1,norm[i]))*32767),4+n*6+i*2);}
fs.writeFileSync(new URL('../assets/sculpture.bin',import.meta.url),data);
console.log(JSON.stringify({vertices:n,bytes:data.length}));
