import test from 'node:test';
import assert from 'node:assert/strict';
import { Scene, PerspectiveCamera, Vector3, TextureLoader, Texture, Box3, Raycaster } from 'three';
import { initialLabyrinthState, advanceLabyrinth, restoreLabyrinthState, labyrinthReading, MAX_DEPTH } from '../src/labyrinth-system.js';
import { createLabyrinthScene } from '../src/labyrinth-scene.js';
import { contourRoute, routeSample } from '../src/chapter-passage.js';
import { LABYRINTH_COPY } from '../src/labyrinth-copy.js';
import { LANGUAGES } from '../src/languages.js';
import { createFigureGroundScene } from '../src/figure-ground-scene.js';

test('recursive visit stops at the leaf and resumes both suspended rooms in order',()=>{
  let state=initialLabyrinthState();
  state=advanceLabyrinth(state,'enter');assert.equal(state.depth,1);assert.equal(state.complete,false);
  state=advanceLabyrinth(state,'enter');assert.equal(state.depth,MAX_DEPTH);assert.equal(labyrinthReading(state),'leaf');
  assert.deepEqual(advanceLabyrinth(state,'enter'),state,'the base case cannot recurse further');
  state=advanceLabyrinth(state,'return');assert.equal(state.depth,1);assert.equal(labyrinthReading(state),'resumed');assert.equal(state.complete,false);
  state=advanceLabyrinth(state,'return');assert.equal(state.depth,0);assert.equal(labyrinthReading(state),'returned');
  assert.deepEqual(advanceLabyrinth(state,'return'),state);
  assert.deepEqual(advanceLabyrinth(state,'again'),initialLabyrinthState());
});
test('an early return is allowed and does not claim the complete round trip',()=>{
  const state=advanceLabyrinth(advanceLabyrinth(initialLabyrinthState(),'enter'),'return');
  assert.deepEqual(state,initialLabyrinthState());
  for(const saved of [null,{version:9,depth:1},{version:1,depth:-1},{version:1,depth:3},{version:1,depth:NaN}])assert.deepEqual(restoreLabyrinthState(saved),initialLabyrinthState());
  assert.equal(restoreLabyrinthState({version:1,depth:0,complete:true}).complete,false);
  const inside=advanceLabyrinth(advanceLabyrinth(initialLabyrinthState(),'enter'),'enter');
  assert.deepEqual(restoreLabyrinthState(JSON.parse(JSON.stringify(inside))),inside);
});
test('both directions of the companions route cross the actual contour opening',()=>{
  for(const returning of [false,true])for(const index of [0,1]){
    const route=contourRoute(returning?[-2,-7]:[-5,5],index,returning);
    for(let step=0;step<=1000;step++){
      const sample=routeSample(route,step/1000);
      if(sample.z>=-.1&&sample.z<=.6)assert.ok(Math.abs(sample.x)<.01,'a profile wall was crossed');
    }
  }
});
test('every live labyrinth label has seven translations and all three level names',()=>{
  for(const lang of LANGUAGES){
    const copy=LABYRINTH_COPY[lang];
    for(const key of Object.keys(LABYRINTH_COPY.en))assert.equal(typeof copy[key],typeof LABYRINTH_COPY.en[key],`${lang}.${key}`);
    assert.equal(copy.levels.length,3);assert.ok(Object.values(copy).flat().every(value=>value.length>0));
  }
});

for(const mobile of [false,true])test(`camera enters two real nested models and returns to exactly the same poses (${mobile?'mobile':'desktop'})`,t=>{
  const originalWidth=globalThis.innerWidth;
  globalThis.innerWidth=mobile?390:1280;t.after(()=>{globalThis.innerWidth=originalWidth;});
  t.mock.method(TextureLoader.prototype,'load',()=>new Texture());
  const scene=new Scene(),view=createLabyrinthScene(scene,{matches:false},()=>{}),camera=new PerspectiveCamera();
  const look=new Vector3(0,-.7,0);camera.position.set(3,1.9,17.8);view.setVisible(true);
  const advance=()=>{for(let i=0;i<240;i++)view.update(1/60,camera,look);};
  let entered=0;view.beginEntry(camera,look,()=>entered++);advance();assert.equal(entered,1);
  const outer=camera.position.clone(),poses=[];
  const gallery=createFigureGroundScene(scene,{matches:false},()=>{});gallery.setVisible(true);scene.updateMatrixWorld(true);
  const ray=new Raycaster(camera.position,look.clone().sub(camera.position).normalize(),0,camera.position.distanceTo(look));
  assert.equal(ray.intersectObject(scene.getObjectByName('figure-ground-gallery'),true).length,0,'the shared contour must not obscure the model observation point');
  for(const depth of [1,2]){
    view.setDepth(depth,camera,look);advance();poses.push(camera.position.clone());
    assert.ok(camera.near<camera.position.distanceTo(look));
    const room=scene.getObjectByName(`nested-gallery-${depth}`);assert.ok(room);
    const target=new Box3().setFromObject(room);assert.ok(target.containsPoint(look),'camera focus left the entered model');
  }
  view.setDepth(1,camera,look);advance();assert.ok(camera.position.distanceTo(poses[0])<1e-8);
  view.setDepth(0,camera,look);advance();assert.ok(camera.position.distanceTo(outer)<1e-8);
  let stale=0;view.setDepth(1,camera,look,()=>stale++);view.setVisible(false);view.setVisible(true);advance();assert.equal(stale,0);
  view.dispose();assert.equal(scene.getObjectByName('harmonic-labyrinth'),undefined);
});
test('reduced motion ends each move once without waiting for an animation',t=>{
  const originalWidth=globalThis.innerWidth;globalThis.innerWidth=1280;t.after(()=>{globalThis.innerWidth=originalWidth;});
  t.mock.method(TextureLoader.prototype,'load',()=>new Texture());
  const view=createLabyrinthScene(new Scene(),{matches:true},()=>{}),camera=new PerspectiveCamera(),look=new Vector3();
  view.setVisible(true);let completed=0;view.beginEntry(camera,look,()=>completed++);view.update(0,camera,look);view.update(0,camera,look);
  view.setDepth(2,camera,look,()=>completed++);view.update(0,camera,look);view.update(0,camera,look);assert.equal(completed,2);view.dispose();
});
