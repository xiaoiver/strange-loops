import test from 'node:test';
import assert from 'node:assert/strict';
import { Scene, Mesh, PlaneGeometry } from 'three';
import { createGardenScene } from '../src/garden-scene.js';
import { createFairFacedConcrete } from '../src/fair-faced-concrete.js';
import { applySoftShadows } from '../src/soft-shadows.js';

test('entering and leaving the garden preserves the lobby shadow receivers', t => {
  const previousDocument=globalThis.document;
  globalThis.document={hidden:false,addEventListener(){}};
  t.after(()=>{globalThis.document=previousDocument;});
  const scene=new Scene(),shell=createFairFacedConcrete();
  applySoftShadows(shell,false);
  const wall=new Mesh(new PlaneGeometry(42,42),shell),floor=new Mesh(new PlaneGeometry(42,42),shell);
  wall.position.set(-3.8,17.2,17.2);wall.rotation.y=Math.PI/2;
  floor.position.set(17.2,-3.8,17.2);floor.rotation.x=-Math.PI/2;
  wall.receiveShadow=floor.receiveShadow=true;scene.add(wall,floor);
  const wallGeometry=wall.geometry;
  const garden=createGardenScene(scene,{matches:true,addEventListener(){}},{exitWall:wall,shellMaterial:shell});
  garden.setWord('MI','en');
  const hall=scene.getObjectByName('garden-hall');
  // Include partial fades and hiding a never-entered garden, as chapter-map jumps do.
  for(let visit=0;visit<3;visit++)for(const amount of [0,.25,.5,1,.5,0]){
    garden.setPresence(amount);
    assert.equal(floor.material.opacity,1,'fading the roof made the lobby floor transparent');
    assert.equal(floor.material.transparent,false);
    assert.equal(floor.material.depthWrite,true);
    assert.equal(wall.material.opacity,1,'the permanent wall must keep receiving letter shadows');
    if(amount===0){assert.equal(wall.material,shell);assert.equal(wall.geometry,wallGeometry);}
    hall.traverse(object=>{
      if(!object.isMesh||!object.material.userData.fairFaced)return;
      assert.equal(object.material.opacity,amount,'the garden architecture should still fade');
      assert.equal(object.material.customProgramCacheKey().includes('geb-ando-concrete-v6-world|geb-pcss-v1-desktop'),true,'the garden must retain its concrete and shadow shader hooks');
    });
  }
  garden.setVisible(true);garden.setVisible(false);
  assert.equal(shell.opacity,1);
  assert.equal(shell.transparent,false);
  assert.equal(shell.depthWrite,true);
});

test('the gallery envelope can dissolve and return without fading other architectural surfaces', async t => {
  const {TextureLoader,Texture}=await import('three');
  const {createFigureGroundScene}=await import('../src/figure-ground-scene.js');
  const originalWidth=globalThis.innerWidth;globalThis.innerWidth=1280;t.after(()=>{globalThis.innerWidth=originalWidth;});
  t.mock.method(TextureLoader.prototype,'load',()=>new Texture());
  const scene=new Scene(),lobbyMaterial=createFairFacedConcrete();
  scene.add(new Mesh(new PlaneGeometry(42,42),lobbyMaterial));
  const view=createFigureGroundScene(scene,{matches:true},()=>{});
  view.setVisible(true);const gallery=scene.getObjectByName('figure-ground-gallery'),originals=new Map();
  gallery.traverse(object=>{if(object.isMesh)originals.set(object.material,{opacity:object.material.opacity,transparent:object.material.transparent});});
  for(const presence of [1,.5,0,.5,1]){
    view.setPresence(presence);assert.equal(lobbyMaterial.opacity,1);
    gallery.traverse(object=>{if(object.isMesh)assert.equal(object.material.opacity,originals.get(object.material).opacity*presence);});
    assert.deepEqual(gallery.scale.toArray(),[1,1,1]);
    assert.deepEqual(gallery.position.toArray(),[0,0,0]);
  }
  view.setVisible(false);view.setVisible(true);
  gallery.traverse(object=>{if(object.isMesh){assert.equal(object.material.opacity,originals.get(object.material).opacity);assert.equal(object.material.transparent,originals.get(object.material).transparent);}});
});
