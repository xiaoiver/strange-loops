import test from 'node:test';
import assert from 'node:assert/strict';
import { Scene, PerspectiveCamera, Vector3, TextureLoader, Texture, Box3, Raycaster } from 'three';
import { initialLabyrinthState, advanceLabyrinth, restoreLabyrinthState, labyrinthReading, MAX_DEPTH } from '../src/labyrinth-system.js';
import { createLabyrinthScene, passageRail } from '../src/labyrinth-scene.js';
import { contourRoute, routeSample, labyrinthStop } from '../src/chapter-passage.js';
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
  const advance=()=>{for(let i=0;i<300;i++)view.update(1/60,camera,look);};
  let entered=0;view.beginEntry(camera,look,()=>entered++);advance();assert.equal(entered,1);
  const outer=camera.position.clone(),poses=[];
  const gallery=createFigureGroundScene(scene,{matches:false},()=>{});gallery.setVisible(true);scene.updateMatrixWorld(true);
  const ray=new Raycaster(camera.position,look.clone().sub(camera.position).normalize(),0,camera.position.distanceTo(look));
  assert.equal(ray.intersectObject(scene.getObjectByName('figure-ground-gallery'),true).length,0,'the shared contour must not obscure the model observation point');
  for(const depth of [1,2]){
    view.setDepth(depth,camera,look);advance();poses.push(camera.position.clone());
    assert.ok(camera.near<camera.position.distanceTo(look));
    const room=scene.getObjectByName(`nested-gallery-${depth}`);assert.ok(room);
    const eye=room.worldToLocal(camera.position.clone());assert.ok(Math.abs(eye.x)<7&&Math.abs(eye.z)<7,'camera left the entered room floor');
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

for(const mobile of [false,true])test(`chapter passage is one smooth rail through the actual gap (${mobile?'mobile':'desktop'})`,t=>{
  const oldWidth=globalThis.innerWidth;globalThis.innerWidth=mobile?390:1280;t.after(()=>{globalThis.innerWidth=oldWidth;});
  t.mock.method(TextureLoader.prototype,'load',()=>new Texture());
  const scene=new Scene(),view=createLabyrinthScene(scene,{matches:false},()=>{}),gallery=createFigureGroundScene(scene,{matches:false},()=>{});
  view.setVisible(true);gallery.setVisible(true);scene.updateMatrixWorld(true);
  const end=gallery.contourPose(),camera=new PerspectiveCamera(),look=end.look.clone();camera.position.copy(end.position);camera.lookAt(look);
  let done=false;view.beginEntry(camera,look,()=>{done=true;});
  const samples=[];
  function record(){
    let count=0,previous=camera.position.clone(),rotation=camera.quaternion.clone();
    while(!done&&++count<400){
      view.update(1/60,camera,look);const step=camera.position.distanceTo(previous);
      assert.ok(step<.24,'camera jumped or accelerated at an intermediate waypoint');
      assert.ok(camera.quaternion.angleTo(rotation)<.08,'view direction turned abruptly');
      if(count>40&&count<210)assert.ok(step>.035,'camera stopped at an intermediate waypoint');
      assert.ok(camera.position.y>=Math.min(end.position.y,.7)-.05,'camera dipped below both observation heights');
      if(camera.position.z>=-.1&&camera.position.z<=.6)assert.ok(Math.abs(camera.position.x)<1e-5,'camera crossed a solid profile');
      assert.ok(camera.position.distanceTo(look)>2,'camera overtook its gaze target');
      samples.push(camera.position.clone());previous.copy(camera.position);rotation.copy(camera.quaternion);
    }
    assert.ok(done,'passage did not finish');
  }
  record();const outer=camera.position.clone();assert.ok(outer.z<-3,'the turn must finish behind the profile walls');
  // Constant arc steps stay constant despite unequal distances between the controls.
  for(const returning of [false,true]){
    const rail=passageRail(returning?outer:end.position,returning?end.position:outer,returning);
    let last=rail.getPointAt(0),min=Infinity,max=0;
    for(let i=1;i<=1000;i++){const p=rail.getPointAt(i/1000),distance=p.distanceTo(last);min=Math.min(min,distance);max=Math.max(max,distance);assert.ok(returning?p.z>=last.z-1e-6:p.z<=last.z+1e-6,'route doubled back');last=p;}
    assert.ok(max/min<1.03,'arc speed depends on control-point spacing');
  }
  done=false;view.beginExit(camera,look,end,()=>{done=true;});record();
  assert.ok(camera.position.distanceTo(end.position)<1e-6);assert.ok(look.distanceTo(end.look)<1e-6);
  let stale=0;view.beginEntry(camera,look,()=>stale++);view.update(.1,camera,look);view.setVisible(false);view.setVisible(true);
  for(let i=0;i<320;i++)view.update(1/60,camera,look);assert.equal(stale,0);
  view.dispose();
});

for(const mobile of [false,true])test(`architecture unfolds around an upright, gently moving eye (${mobile?'mobile':'desktop'})`,t=>{
  const oldWidth=globalThis.innerWidth;globalThis.innerWidth=mobile?390:1280;t.after(()=>{globalThis.innerWidth=oldWidth;});
  t.mock.method(TextureLoader.prototype,'load',()=>new Texture());
  const scene=new Scene(),view=createLabyrinthScene(scene,{matches:false},()=>{}),camera=new PerspectiveCamera(),look=new Vector3();
  view.setVisible(true);view.setDepth(0,camera,look,null,{immediate:true});
  const outer=camera.position.clone(),model=scene.getObjectByName('nested-gallery-1'),child=scene.getObjectByName('nested-gallery-2');
  const initialSize=new Box3().setFromObject(model).getSize(new Vector3()).x;
  function move(depth){
    let done=false,previous=camera.position.clone(),rotation=camera.quaternion.clone();view.setDepth(depth,camera,look,()=>{done=true;});
    for(let frame=0;frame<720&&!done;frame++){
      view.update(1/60,camera,look);scene.updateMatrixWorld(true);
      assert.ok(camera.position.distanceTo(previous)<.04,'a fold moved the eye too abruptly');
      assert.ok(camera.quaternion.angleTo(rotation)<.01,'the eye followed the rotating architecture');
      assert.ok(camera.up.distanceTo(new Vector3(0,1,0))<1e-10,'the camera rolled');
      assert.equal(camera.position.y,outer.y,'the scale change must come from architecture, not an eye drop');
      const parentFloor=model.localToWorld(new Vector3()).y;
      for(const x of [-7,7])for(const z of [-7,7]){
        const corner=child.localToWorld(new Vector3(x,0,z));
        assert.ok(corner.y>=parentFloor-.001,'the folding floor tunneled underneath its parent');
      }
      previous.copy(camera.position);rotation.copy(camera.quaternion);
    }
    assert.ok(done);return camera.quaternion.clone();
  }
  const firstRotation=move(1),firstPosition=camera.position.clone();
  assert.ok(new Box3().setFromObject(model).getSize(new Vector3()).x>initialSize*4,'the miniature must become architectural scale');
  const secondRotation=move(2);
  assert.ok(firstRotation.angleTo(secondRotation)<1e-6,'the wall fold must not rotate the eye');
  const width=mobile?390:1280,height=mobile?844:800;
  camera.fov=mobile?48:36;camera.aspect=width/height;camera.setViewOffset(width,height,-width*(mobile?0:.12),0,width,height);
  camera.updateMatrixWorld(true);
  const leaf=scene.getObjectByName('recursion-leaf').getWorldPosition(new Vector3()).project(camera);
  assert.ok(Math.abs(leaf.x)<.5&&Math.abs(leaf.y)<.5,'the stopping point must stay visible above the footer');
  for(const room of [model,child]){
    const eye=room.worldToLocal(camera.position.clone());
    assert.ok(Math.abs(eye.x)<7&&Math.abs(eye.z)<7&&eye.y>0&&eye.y<5.7,'the final eye must be inside both room boundaries');
  }
  move(1);assert.ok(camera.position.distanceTo(firstPosition)<1e-8);
  move(0);assert.ok(camera.position.distanceTo(outer)<1e-8);
  camera.updateMatrixWorld(true);
  scene.getObjectByName('menger-parent').traverse(object=>{
    if(!object.isMesh)return;
    const positions=object.geometry.getAttribute('position');
    for(let i=0;i<positions.count;i++){
      const point=new Vector3().fromBufferAttribute(positions,i).applyMatrix4(object.matrixWorld).project(camera);
      assert.ok(Math.abs(point.x)<.94&&Math.abs(point.y)<.94,'the complete miniature must fit inside the outer observation frame');
    }
  });
  for(const [index,actorHeight] of [1.5,.34].entries()){
    const [x,z]=labyrinthStop(index),actor=new Vector3(x,-3.8+actorHeight*.55,z).project(camera);
    assert.ok(Math.abs(actor.x)<.94&&Math.abs(actor.y)<.92,'a companion was lost outside the outer observation frame');
  }
  move(2);move(0);assert.ok(camera.position.distanceTo(outer)<1e-8,'a direct chapter exit must restore the outer room too');
  view.dispose();
});

test('saved inner architecture restores immediately and reduced motion leaves all kinetic exhibits still',t=>{
  const oldWidth=globalThis.innerWidth;globalThis.innerWidth=1280;t.after(()=>{globalThis.innerWidth=oldWidth;});
  t.mock.method(TextureLoader.prototype,'load',()=>new Texture());
  const scene=new Scene(),view=createLabyrinthScene(scene,{matches:true},()=>{}),camera=new PerspectiveCamera(),look=new Vector3();
  view.setVisible(true);view.setDepth(2,camera,look,null,{immediate:true});
  const hinge=scene.getObjectByName('folding-gallery-hinge');assert.equal(hinge.rotation.x,0);
  const frame=scene.getObjectByName('recursion-leaf'),still=frame.matrixWorld.clone();view.update(10,camera,look);assert.ok(frame.matrixWorld.equals(still));
  let old=0;view.setDepth(0,camera,look,()=>old++);view.setVisible(false);view.setVisible(true);
  view.setDepth(2,camera,look,null,{immediate:true});view.update(10,camera,look);assert.equal(old,0);assert.equal(hinge.rotation.x,0);
  view.dispose();
});

test('suspended architecture advances only with its active parent level and respects reduced motion',t=>{
  const oldWidth=globalThis.innerWidth;globalThis.innerWidth=1280;t.after(()=>{globalThis.innerWidth=oldWidth;});
  t.mock.method(TextureLoader.prototype,'load',()=>new Texture());
  const scene=new Scene(),reduced={matches:false},view=createLabyrinthScene(scene,reduced,()=>{}),camera=new PerspectiveCamera(),look=new Vector3();
  view.setVisible(true);view.setDepth(1,camera,look,null,{immediate:true});
  assert.equal(view.envelopePresence(),0);
  const rib=scene.getObjectByName('suspended-gallery-0'),initial=rib.quaternion.clone(),piece=scene.getObjectByName('menger-parent-piece-0'),initialPiece=piece.position.clone();
  view.update(2,camera,look);assert.ok(rib.quaternion.angleTo(initial)>.001);
  assert.ok(piece.position.distanceTo(initialPiece)>.001,'the Menger subdivision must open with the active layer');
  const pausedPiece=piece.position.clone(),paused=rib.quaternion.clone();view.setDepth(2,camera,look,null,{immediate:true});view.update(2,camera,look);
  assert.ok(rib.quaternion.angleTo(paused)<1e-6,'the enclosing architecture keeps moving inside its child');
  assert.ok(piece.position.equals(pausedPiece),'a parent Menger cell moved while visiting its child');
  const leaf=scene.getObjectByName('recursion-leaf'),atLeaf=leaf.position.clone();view.update(2,camera,look);
  assert.ok(leaf.position.equals(atLeaf),'the empty stopping point should settle instead of endlessly animating');
  reduced.matches=true;const still=leaf.position.clone();view.update(2,camera,look);assert.ok(leaf.position.equals(still));
  reduced.matches=false;view.setDepth(1,camera,look,null,{immediate:true});view.update(2,camera,look);
  assert.ok(rib.quaternion.angleTo(paused)>.001,'the parent must resume its suspended motion on return');
  assert.ok(piece.position.distanceTo(pausedPiece)>.001,'the Menger structure must also resume after returning');
  view.setDepth(0,camera,look,null,{immediate:true});assert.equal(view.envelopePresence(),1);
  assert.equal(scene.getObjectByName('suspended-galleries').visible,false);
  view.dispose();
});


test('the final frame is a genuine empty aperture and its enclosing walls restore on return',t=>{
  const oldWidth=globalThis.innerWidth;globalThis.innerWidth=1280;t.after(()=>{globalThis.innerWidth=oldWidth;});
  t.mock.method(TextureLoader.prototype,'load',()=>new Texture());
  const scene=new Scene(),view=createLabyrinthScene(scene,{matches:false},()=>{}),camera=new PerspectiveCamera(),look=new Vector3();
  view.setVisible(true);view.setDepth(1,camera,look,null,{immediate:true});
  const enclosure=scene.getObjectByName('parent-room-enclosure'),frame=scene.getObjectByName('recursion-leaf');
  const wall=scene.getObjectByName('menger-parent-piece-0'),floor=scene.getObjectByName('nested-gallery-1').children.find(object=>object.isMesh);
  assert.equal(enclosure.visible,true);assert.notEqual(wall.material,floor.material);
  view.setDepth(2,camera,look,null,{immediate:true});assert.equal(enclosure.visible,false);assert.equal(floor.material.opacity,1);
  assert.equal(scene.getObjectByName('suspended-galleries').visible,false);
  assert.equal(scene.getObjectByName('recursion-leaf-ring'),undefined);
  const center=frame.getWorldPosition(new Vector3()),edge=frame.localToWorld(new Vector3(1.01,0,0));
  const ray=new Raycaster(camera.position,center.clone().sub(camera.position).normalize(),0,30);
  const hits=ray.intersectObject(scene.getObjectByName('harmonic-labyrinth'),true).filter(hit=>{
    for(let node=hit.object;node;node=node.parent)if(!node.visible)return false;
    return true;
  });
  assert.equal(hits.length,0,'the frame center must open onto empty space, not a white picture or an enclosing wall');
  ray.set(camera.position,edge.sub(camera.position).normalize());assert.ok(ray.intersectObject(frame,true).length>0,'the concrete reveals must have real depth');
  view.setDepth(1,camera,look,null,{immediate:true});assert.equal(enclosure.visible,true);assert.equal(wall.material.opacity,1);assert.equal(wall.material.transparent,false);
  assert.equal(scene.getObjectByName('suspended-galleries').visible,true);
  view.dispose();
});
