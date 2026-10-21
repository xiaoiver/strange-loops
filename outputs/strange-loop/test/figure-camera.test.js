import test from 'node:test';
import assert from 'node:assert/strict';
import { Scene, PerspectiveCamera, Vector3, Texture, TextureLoader } from 'three';
import { createFigureGroundScene } from '../src/figure-ground-scene.js';
import { entryRoute, routeSample } from '../src/chapter-passage.js';

function gallery(t,{mobile=false,reduced=false}={}){
 const oldWidth=globalThis.innerWidth,oldHeight=globalThis.innerHeight;
 globalThis.innerWidth=mobile?390:1089;globalThis.innerHeight=mobile?844:954;
 t.after(()=>{globalThis.innerWidth=oldWidth;globalThis.innerHeight=oldHeight;});
 // Exercise the actual camera without a GPU, DOM image loading or WebGL renderer.
 t.mock.method(TextureLoader.prototype,'load',()=>new Texture());
 const camera=new PerspectiveCamera();camera.position.set(6,1.2,5);
 const look=new Vector3(-3.8,-2.1,-1.3);
 const view=createFigureGroundScene(new Scene(),{matches:reduced},()=>{});
 view.setVisible(true);
 return {view,camera,look};
}

for(const mobile of [false,true])test(`gallery camera unlocks at the vase before companions arrive (${mobile?'mobile':'desktop'})`,t=>{
 const {view,camera,look}=gallery(t,{mobile});
 view.setState({version:4,posters:true,ground:true},'zh');
 let completions=0,elapsed=0,finishedAt;
 view.beginEntry(()=>{completions++;finishedAt=elapsed;});
 for(let frame=0;frame<120;frame++){elapsed+=1/60;view.update(1/60,camera,look);}
 assert.equal(completions,1,'completion must not repeat');
 assert.ok(finishedAt>=.8&&finishedAt<1.15,`camera finished at ${finishedAt}s`);
 const earliestCompanion=Math.min(...[0,1].map(i=>routeSample(entryRoute(i,mobile,'contour'),0).length/[2.5,2][i]+i*.4));
 assert.ok(finishedAt<earliestCompanion,'reading still waits for companions');
 assert.ok(camera.position.distanceTo(new Vector3(mobile?.2:3,mobile?1.8:1.9,mobile?20:17.8))<1e-6);
 assert.ok(look.distanceTo(new Vector3(mobile?-.4:-.6,-.7,0))<1e-6);
 // Navigation may change exhibits while the arrival route is still running.
 view.setState({version:4,posters:false,ground:false},'zh');
 for(let frame=0;frame<90;frame++)view.update(1/60,camera,look);
 assert.ok(look.distanceTo(new Vector3(-6.69,mobile?-.8:-1.3,3.6))<1e-6);
 assert.equal(completions,1,'later navigation restarted the arrival callback');
});

test('hiding the gallery cancels a pending camera arrival',t=>{
 const {view,camera,look}=gallery(t);let completions=0;
 view.beginEntry(()=>completions++);view.update(.1,camera,look);
 view.setVisible(false);view.setVisible(true);
 for(let frame=0;frame<120;frame++)view.update(1/60,camera,look);
 assert.equal(completions,0,'a stale camera arrival completed after leaving');
});

test('reduced motion reaches the exhibit immediately and completes once',t=>{
 const {view,camera,look}=gallery(t,{reduced:true});let completions=0;
 view.beginEntry(()=>completions++);view.update(0,camera,look);view.update(0,camera,look);
 assert.equal(completions,1);
 assert.ok(look.distanceTo(new Vector3(-.6,-.7,0))<1e-6);
});
