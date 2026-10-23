import test from 'node:test';
import assert from 'node:assert/strict';
import { Scene, PerspectiveCamera, Vector3, Texture, TextureLoader, Raycaster } from 'three';
import { DEFAULT_NOTES, initialCrabState, advanceCrab, restoreCrabState, cycleCrabNote, validNotes, crabScore, crabFrame, crabDialogue, courtRoute, COURT_GATE } from '../src/crab-system.js';
import { createCrabScene } from '../src/crab-scene.js';
import { createFigureGroundScene } from '../src/figure-ground-scene.js';
import { routeSample } from '../src/chapter-passage.js';
import { CRAB_COPY } from '../src/crab-copy.js';
import { LANGUAGES } from '../src/languages.js';

test('retrograde reorders complete events, and both voices read the same non-palindromic source',()=>{
 const events=crabScore(DEFAULT_NOTES);assert.notDeepEqual(DEFAULT_NOTES,[...DEFAULT_NOTES].reverse());
 assert.deepEqual(crabScore(DEFAULT_NOTES,true),[...events].reverse());assert.deepEqual(DEFAULT_NOTES,[60,64,67,71,72,67]);
 for(let step=0;step<6;step++){
  const p=(step+.1)/6,f=crabFrame('together',p);
  assert.equal(DEFAULT_NOTES[f.forward],events[step].pitch);assert.equal(DEFAULT_NOTES[f.reverse],events[5-step].pitch);
  assert.equal(crabFrame('forward',p).reverse,null);assert.equal(crabFrame('reverse',p).forward,null);
 }
 assert.equal(crabFrame('together',1).step,5);
 const lines=Array.from({length:7},(_,i)=>crabDialogue('together',i));assert.equal(lines[3].actor,'crab');
 for(let i=0;i<3;i++){assert.equal(lines[i].line,lines[6-i].line);assert.notEqual(lines[i].actor,lines[6-i].actor);}
 assert.deepEqual(Array.from({length:3},(_,i)=>crabDialogue('reverse',i).line),[2,1,0]);
});
test('visits restore independently; editing changes one shared source while retaining consonant pairs',()=>{
 let state=initialCrabState();for(let i=0;i<10;i++)state=advanceCrab(state);assert.equal(state.stage,3);
 const saved=JSON.parse(JSON.stringify(state));assert.deepEqual(restoreCrabState(saved),state);
 for(let i=0;i<60;i++){const before=[...state.notes],index=i%6;state=cycleCrabNote(state,index);assert.ok(validNotes(state.notes));assert.equal(state.notes.filter((n,j)=>n!==before[j]).length,1);}
 assert.deepEqual(saved.notes,DEFAULT_NOTES,'editing cannot mutate a restored snapshot');
 for(const invalid of [null,{version:2,stage:1},{version:1,stage:-1},{version:1,stage:4},{version:1,stage:NaN}])assert.deepEqual(restoreCrabState(invalid),initialCrabState());
 assert.deepEqual(restoreCrabState({version:1,stage:2,notes:[1,2]}).notes,DEFAULT_NOTES);
 for(const lang of LANGUAGES){assert.deepEqual(Object.keys(CRAB_COPY[lang]),Object.keys(CRAB_COPY.en));assert.equal(CRAB_COPY[lang].lines.length,4);assert.ok(Object.values(CRAB_COPY[lang]).flat().every(v=>typeof v==='string'&&v.length));}
});
test('companions cross the courtyard doorway in both directions',()=>{
 for(const returning of [false,true])for(const i of [0,1])for(let step=0;step<=1000;step++){
  const p=routeSample(courtRoute(returning?[26,-7]:[-2,-7],i,returning),step/1000);
  if(Math.abs(p.x-COURT_GATE.x)<.3)assert.ok(Math.abs(p.z-COURT_GATE.z)<COURT_GATE.halfWidth-.3);
 }
});
for(const mobile of [false,true])test(`courtyard camera traverses the real side doorway without stops, jumps or gaze crossings (${mobile?'mobile':'desktop'})`,t=>{
 const oldWidth=globalThis.innerWidth;globalThis.innerWidth=mobile?390:1280;t.after(()=>{globalThis.innerWidth=oldWidth;});
 t.mock.method(TextureLoader.prototype,'load',()=>new Texture());
 const scene=new Scene(),view=createCrabScene(scene,{matches:false},()=>{}),gallery=createFigureGroundScene(scene,{matches:false},()=>{});
 view.setVisible(true);view.setActive(true);gallery.setVisible(true);scene.updateMatrixWorld(true);
 const start={position:new Vector3(7.6,mobile?1.8:.7,-3.4),look:new Vector3(0,-2.18,-10)};
 const camera=new PerspectiveCamera(),look=start.look.clone();camera.position.copy(start.position);camera.lookAt(look);
 let complete=0;
 const record=()=>{let min=Infinity,max=0;for(let frame=0;frame<280;frame++){
  const previous=camera.position.clone(),rotation=camera.quaternion.clone();view.update(1/60,camera,look);
  const step=camera.position.distanceTo(previous);assert.ok(step<.4,`position jump ${step}`);assert.ok(camera.quaternion.angleTo(rotation)<.1,`gaze jump ${camera.quaternion.angleTo(rotation)}`);
  assert.ok(camera.position.distanceTo(look)>2,'camera overtook its gaze');
  if(frame>40&&frame<220){min=Math.min(min,step);max=Math.max(max,step);}
  if(Math.abs(camera.position.x-17)<.15)assert.ok(Math.abs(camera.position.z+10)<.1,'camera crossed a side wall');
 }assert.ok(min>.02,'camera stopped at a waypoint');};
 view.beginEntry(camera,look,()=>complete++);record();assert.equal(complete,1);
 const forward=camera.position.clone();view.setMode('reverse',camera,look);for(let i=0;i<100;i++)view.update(1/60,camera,look);assert.ok(camera.position.x>forward.x);
 view.beginExit(camera,look,start,()=>{complete++;view.setActive(false);});record();assert.equal(complete,2);assert.ok(camera.position.distanceTo(start.position)<1e-6);
 // A horizontal ray through the opening is unobstructed by the gallery wall.
 const ray=new Raycaster(new Vector3(16,-1,-10),new Vector3(1,0,0),0,2);assert.equal(ray.intersectObject(scene.getObjectByName('figure-ground-gallery'),true).length,0);
 let stale=0;view.beginEntry(camera,look,()=>stale++);view.setVisible(false);view.setVisible(true);for(let i=0;i<300;i++)view.update(1/60,camera,look);assert.equal(stale,0);view.dispose();
});
test('reduced motion finishes once; revisiting a saved mode lands on its final pose',t=>{
 const oldWidth=globalThis.innerWidth;globalThis.innerWidth=1280;t.after(()=>{globalThis.innerWidth=oldWidth;});
 const view=createCrabScene(new Scene(),{matches:true},()=>{}),camera=new PerspectiveCamera(),look=new Vector3();camera.position.set(7.6,.7,-3.4);view.setVisible(true);view.setActive(true);
 let done=0;view.beginEntry(camera,look,()=>done++,'explore');view.update(0,camera,look);view.update(0,camera,look);assert.equal(done,1);assert.deepEqual(camera.position.toArray(),[26.5,4.5,5.2]);view.dispose();
});
