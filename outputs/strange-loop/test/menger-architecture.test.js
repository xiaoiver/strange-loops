import test from 'node:test';
import assert from 'node:assert/strict';
import { MeshStandardMaterial, Raycaster, Vector3 } from 'three';
import { mengerCells, createMengerArchitecture } from '../src/menger-architecture.js';

test('Menger generations retain twenty self-similar children and clear all three central tunnels',()=>{
  for(const depth of [0,1,2,3]){
    const cells=mengerCells(depth);assert.equal(cells.length,20**depth);
    assert.equal(new Set(cells.map(p=>p.join(','))).size,cells.length);
    if(depth===0)continue;
    // Each of the three coordinate axes must pass through the entire sponge.
    for(const axis of [0,1,2])assert.ok(cells.every(cell=>cell.filter((_,i)=>i!==axis).some(value=>value!==0)));
  }
  for(const invalid of [-1,4,.5,NaN])assert.throws(()=>mengerCells(invalid),RangeError);
});

test('the architectural sponge has real holes, consistent face winding and a small mesh budget',()=>{
  const material=new MeshStandardMaterial(),view=createMengerArchitecture({depth:2,size:14,material});
  assert.equal(view.group.children.length,20);
  view.group.updateMatrixWorld(true);
  let triangles=0;
  for(const object of view.group.children){
    const g=object.geometry,p=g.getAttribute('position'),n=g.getAttribute('normal');triangles+=g.index.count/3;
    for(let i=0;i<g.index.count;i+=3){
      const ids=[0,1,2].map(j=>g.index.getX(i+j));
      const [a,b,c]=ids.map(id=>new Vector3().fromBufferAttribute(p,id));
      assert.ok(b.sub(a).cross(c.sub(a)).normalize().dot(new Vector3().fromBufferAttribute(n,ids[0]))>.999,'an inner face is reversed');
    }
  }
  assert.ok(triangles<=3000);
  for(const axis of [new Vector3(1,0,0),new Vector3(0,1,0),new Vector3(0,0,1)]){
    const ray=new Raycaster(axis.clone().multiplyScalar(20),axis.clone().negate(),0,40);
    assert.equal(ray.intersectObject(view.group,true).length,0);
  }
  const ray=new Raycaster(new Vector3(6,6,20),new Vector3(0,0,-1),0,40);
  assert.ok(ray.intersectObject(view.group,true).length>0,'the corner must remain solid');
  view.update(1,0);const paused=view.group.children.map(object=>object.position.clone());
  view.update(1,0);assert.ok(view.group.children.every((object,i)=>object.position.equals(paused[i])));
  view.update(1,2);assert.ok(view.group.children.some((object,i)=>object.position.distanceTo(paused[i])>.001));
  view.update(0,0);assert.ok(view.group.children.every(object=>object.position.length()===0));
  let disposed=0;for(const object of view.group.children)object.geometry.addEventListener('dispose',()=>disposed++);
  view.dispose();assert.equal(disposed,20);material.dispose();
});
