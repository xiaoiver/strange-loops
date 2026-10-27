import test from 'node:test';
import assert from 'node:assert/strict';
import { Scene, PerspectiveCamera, Vector3, TextureLoader, Texture, Box3, Raycaster } from 'three';
import { initialLabyrinthState, advanceLabyrinth, restoreLabyrinthState, labyrinthReading, MAX_DEPTH } from '../src/labyrinth-system.js';
import { createLabyrinthScene, passageRail } from '../src/labyrinth-scene.js';
import { contourRoute, routeSample, labyrinthStop } from '../src/chapter-passage.js';
import { CONTOUR_Z } from '../src/gallery-layout.js';
import { MODEL_ORIGIN } from '../src/labyrinth-fold.js';
import { LABYRINTH_COPY } from '../src/labyrinth-copy.js';
import { LANGUAGES } from '../src/languages.js';
import { createFigureGroundScene } from '../src/figure-ground-scene.js';

const originalHeight=globalThis.innerHeight;
test.beforeEach(()=>{globalThis.innerHeight=800;});
test.afterEach(()=>{globalThis.innerHeight=originalHeight;});

test('both directions of the companions route cross the actual contour opening',()=>{
  for(const returning of [false,true])for(const index of [0,1]){
    const route=contourRoute(returning?[-2,CONTOUR_Z-7]:[-5,CONTOUR_Z+5],index,returning);
    for(let step=0;step<=1000;step++){
      const sample=routeSample(route,step/1000);
      if(sample.z>=CONTOUR_Z-.1&&sample.z<=CONTOUR_Z+.6)assert.ok(Math.abs(sample.x)<.01,'a profile wall was crossed');
    }
  }
});
test('every live labyrinth label has seven translations and both location names',()=>{
  for(const lang of LANGUAGES){
    const copy=LABYRINTH_COPY[lang];
    for(const key of Object.keys(LABYRINTH_COPY.en))assert.equal(typeof copy[key],typeof LABYRINTH_COPY.en[key],`${lang}.${key}`);
    assert.equal(copy.levels.length,2);assert.ok(Object.values(copy).flat().every(value=>value.length>0));
  }
});

for(const mobile of [false,true])test(`chapter passage is one smooth rail through the actual gap (${mobile?'mobile':'desktop'})`,t=>{
  const oldWidth=globalThis.innerWidth;globalThis.innerWidth=mobile?390:1280;t.after(()=>{globalThis.innerWidth=oldWidth;});
  t.mock.method(TextureLoader.prototype,'load',()=>new Texture());
  const scene=new Scene(),view=createLabyrinthScene(scene,{matches:false},()=>{}),gallery=createFigureGroundScene(scene,{matches:false},()=>{});
  view.setVisible(true);gallery.setVisible(true);scene.updateMatrixWorld(true);
  const end=gallery.contourPose(),camera=new PerspectiveCamera(),look=end.look.clone();camera.position.copy(end.position);camera.lookAt(look);
  const barriers=[];
  for(const name of ['rubin-exit','contour-left-wing','contour-right-wing','contour-lintel']){
    scene.getObjectByName(name).traverse(object=>{if(object.isMesh)barriers.push(object);});
  }
  const passageRay=new Raycaster();
  let done=false;view.beginEntry(camera,look,()=>{done=true;});
  const samples=[];
  function record(){
    let count=0,previous=camera.position.clone(),rotation=camera.quaternion.clone();
    while(!done&&++count<400){
      view.update(1/60,camera,look);const step=camera.position.distanceTo(previous);
      assert.ok(step<.24,'camera jumped or accelerated at an intermediate waypoint');
      if(step>1e-8){
        passageRay.set(previous,camera.position.clone().sub(previous).normalize());passageRay.far=step;
        assert.equal(passageRay.intersectObjects(barriers,false).length,0,'camera collided with the actual exit architecture');
      }
      assert.ok(camera.quaternion.angleTo(rotation)<.08,'view direction turned abruptly');
      if(count>40&&count<210)assert.ok(step>.035,'camera stopped at an intermediate waypoint');
      assert.ok(camera.position.y>=Math.min(end.position.y,view.outerPose().position.y)-.05,'camera dipped below both observation heights');
      if(camera.position.z>=CONTOUR_Z-.1&&camera.position.z<=CONTOUR_Z+.6)assert.ok(Math.abs(camera.position.x)<1e-5,'camera crossed a solid profile');
      assert.ok(camera.position.distanceTo(look)>2,'camera overtook its gaze target');
      samples.push(camera.position.clone());previous.copy(camera.position);rotation.copy(camera.quaternion);
    }
    assert.ok(done,'passage did not finish');
  }
  record();const outer=camera.position.clone();assert.ok(outer.z<CONTOUR_Z-3,'the turn must finish behind the profile walls');
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


test('the visitor chooses when to return from the continuous interior',()=>{
  let state=initialLabyrinthState();
  state=advanceLabyrinth(state,'enter');assert.equal(state.depth,1);assert.equal(labyrinthReading(state),'inside');
  assert.equal(state.complete,false);assert.deepEqual(advanceLabyrinth(state,'enter'),state);
  state=advanceLabyrinth(state,'return');assert.equal(state.depth,0);assert.equal(state.complete,true);assert.equal(labyrinthReading(state),'returned');
  assert.equal(advanceLabyrinth(state,'again').depth,1);
  for(const depth of [1,2])assert.equal(restoreLabyrinthState({version:1,depth,leafSeen:true}).depth,1);
  for(const saved of [null,{version:2,depth:2},{version:2,depth:NaN},{version:2,depth:-1}])assert.deepEqual(restoreLabyrinthState(saved),initialLabyrinthState());
  assert.equal(restoreLabyrinthState({version:2,depth:0,complete:true}).complete,false);
});

function fixture(t,reduced={matches:false}){
  const oldWidth=globalThis.innerWidth;globalThis.innerWidth=1280;t.after(()=>{globalThis.innerWidth=oldWidth;});
  const scene=new Scene(),view=createLabyrinthScene(scene,reduced,()=>{}),camera=new PerspectiveCamera(),look=new Vector3();
  view.setVisible(true);view.setDepth(0,camera,look,null,{immediate:true});t.after(()=>view.dispose());
  return {view,camera,look,scene,reduced};
}

test('the mesh opening and full-screen interior share one position metric at the crossing',t=>{
  const {view,camera,look,scene}=fixture(t);const cube=scene.getObjectByName('fractal-cube'),opening=scene.getObjectByName('fractal-opening');
  assert.equal(opening.parent,cube);
  let finished=0;view.setDepth(1,camera,look,()=>finished++);
  assert.equal(view.companionsVisible(),true,'choosing Enter must not hide either companion');
  let wasInside=false,crossings=0,last=camera.position.clone();
  for(let i=0;i<1300;i++){
    view.update(1/60,camera,look);
    assert.equal(view.companionsVisible(),!view.fractalPass.enabled,'visibility follows the physical crossing, not the save depth');
    if(view.fractalPass.enabled&&!wasInside){
      crossings++;const local=cube.worldToLocal(camera.position.clone()).multiplyScalar(3/14);
      assert.ok(Math.abs(local.x)<.02&&Math.abs(local.y-.12)<.02,'the eye crossed the solid cube instead of its opening');
      assert.ok(camera.position.distanceTo(last)<.06,'the portal teleported the eye');
    }
    wasInside=view.fractalPass.enabled;last.copy(camera.position);
  }
  assert.equal(crossings,1);assert.equal(finished,1);assert.equal(view.travelState().moving,true,'entry must hand off to continuous roaming');
  assert.ok(view.fractalPass.uniforms.uInteriorOrigin.value.z>=-18&&view.fractalPass.uniforms.uInteriorOrigin.value.z<18);
});

test('pause freezes the field, manual travel stays bounded, and a return restores the gallery exactly',t=>{
  const {view,camera,look}=fixture(t);const outer=camera.position.clone(),outerLook=look.clone();
  view.setDepth(1,camera,look,null,{immediate:true});
  view.toggleTravel();for(let i=0;i<1000;i++)view.update(1/60,camera,look);view.pause();
  const position=camera.position.clone(),phase=view.fractalPass.uniforms.uCellPhase.value.clone();
  for(let i=0;i<50;i++)view.update(1/60,camera,look);
  assert.ok(position.equals(camera.position));assert.ok(phase.equals(view.fractalPass.uniforms.uCellPhase.value));
  view.move(50000);view.update(0,camera,look);
  assert.ok(Math.abs(view.fractalPass.uniforms.uInteriorOrigin.value.z)<=18);assert.equal(view.travelState().moving,false);
  let returned=0;view.setDepth(0,camera,look,()=>returned++);
  for(let i=0;i<60;i++)view.update(1/60,camera,look);
  assert.equal(returned,1);assert.equal(view.fractalPass.enabled,false);assert.ok(camera.position.equals(outer));assert.ok(look.equals(outerLook));assert.equal(view.returnFade(),0);
});

test('entry can pause and be cancelled by returning; leaving cancels stale callbacks',t=>{
  const {view,camera,look}=fixture(t);let stale=0,returned=0;
  view.setDepth(1,camera,look,()=>stale++);view.update(2,camera,look);view.toggleTravel();const paused=camera.position.clone();
  view.update(20,camera,look);assert.ok(camera.position.equals(paused));assert.equal(stale,0);
  view.setDepth(0,camera,look,()=>returned++);view.update(1,camera,look);assert.equal(returned,1);assert.equal(stale,0);
  view.setDepth(1,camera,look,()=>stale++);view.setVisible(false);view.update(30,camera,look);assert.equal(stale,0);assert.equal(view.fractalPass.enabled,false);
});

test('reduced motion restores a still interior and advances only on explicit steps',t=>{
  const {view,camera,look,reduced}=fixture(t,{matches:true});let arrived=0;
  view.setDepth(1,camera,look,()=>arrived++);assert.equal(arrived,1);assert.equal(view.travelState().moving,false);
  const position=camera.position.clone();view.update(100,camera,look);assert.ok(position.equals(camera.position));
  view.stepTravel();view.update(0,camera,look);assert.ok(!position.equals(camera.position));
  reduced.matches=false;view.setDepth(0,camera,look,null,{immediate:true});view.setDepth(1,camera,look,()=>arrived++);
  reduced.matches=true;view.update(0,camera,look);assert.equal(arrived,2);assert.equal(view.travelState().moving,false);
});

test('the approach starts visibly and hands off within eight seconds without a speed snap',t=>{
  const {view,camera,look}=fixture(t),start=camera.position.clone();let finished=0;
  view.setDepth(1,camera,look,()=>finished++);
  for(let i=0;i<120;i++)view.update(1/60,camera,look);
  assert.ok(camera.position.distanceTo(start)>.3,'the first two seconds must not remain almost motionless');
  for(let i=120;i<479;i++)view.update(1/60,camera,look);
  const before=view.fractalPass.uniforms.uInteriorOrigin.value.z;
  view.update(1/60,camera,look);view.update(1/60,camera,look);
  assert.equal(finished,1);const after=view.fractalPass.uniforms.uInteriorOrigin.value.z;
  assert.ok(Math.abs((before-after)/2-.1)<.002,'the entry must reach the cruise speed continuously');
});
