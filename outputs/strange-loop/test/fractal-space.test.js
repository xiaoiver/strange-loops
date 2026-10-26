import test from 'node:test';
import assert from 'node:assert/strict';
import {FractalSpacePass} from '../src/fractal-space.js';

test('the costly field is cached while paused and its target stays within the view budget',t=>{
  const previous=[globalThis.innerWidth,globalThis.innerHeight,globalThis.devicePixelRatio];
  t.after(()=>{[globalThis.innerWidth,globalThis.innerHeight,globalThis.devicePixelRatio]=previous;});
  const pass=new FractalSpacePass();t.after(()=>pass.dispose());
  const renders=[];const renderer={setRenderTarget(){},render(object){renders.push(object.material);}};
  const sameTarget=pass.target;
  for(const [width,height,dpr,budget,steps,detail] of [[1280,800,2,860000,136,4],[390,844,3,390000,100,3]]){
    [globalThis.innerWidth,globalThis.innerHeight,globalThis.devicePixelRatio]=[width,height,dpr];pass.setSize();
    assert.equal(pass.target,sameTarget);assert.ok(pass.target.width*pass.target.height<budget*1.003);
    assert.equal(pass.uniforms.uSteps.value,steps);assert.equal(pass.uniforms.uDetail.value,detail);
    const before=pass.renderCount;pass.render(renderer,{});pass.render(renderer,{});pass.render(renderer,{});
    assert.equal(pass.renderCount,before+1,'a paused scene must not rerun the distance field');
    pass.dirty=true;pass.render(renderer,{});assert.equal(pass.renderCount,before+2);
  }
  assert.equal(renders.filter(material=>material===pass.material).length,4);
});

test('the opening caches one bounded field and reuses its program when crossing inside',async t=>{
  const previous=[globalThis.innerWidth,globalThis.innerHeight,globalThis.devicePixelRatio];
  [globalThis.innerWidth,globalThis.innerHeight,globalThis.devicePixelRatio]=[1048,954,2];
  t.after(()=>{[globalThis.innerWidth,globalThis.innerHeight,globalThis.devicePixelRatio]=previous;});
  const {Group,PerspectiveCamera,Vector3}=await import('three');
  const {createFractalSpace}=await import('../src/fractal-space.js');
  const space=createFractalSpace(new Group());t.after(()=>space.dispose());
  const camera=new PerspectiveCamera(40,1048/954);camera.position.set(0,.56,42);camera.lookAt(new Vector3());
  let target=null,compileCalls=0,allocations=0;
  const renderer={getRenderTarget:()=>target,setRenderTarget:value=>{target=value;},render(){},compileAsync:async()=>{compileCalls++;},initRenderTarget(){allocations++;}};
  space.pass.setSize(2096,1908);space.sync(camera);
  space.preparePortal(renderer);assert.equal(space.pass.renderCount,0,'a cold field is prepared before it is displayed');
  const warm=space.warm(renderer);await warm;await space.warm(renderer);
  assert.equal(compileCalls,1);assert.equal(allocations,1);
  space.preparePortal(renderer);assert.equal(target,null,'portal preparation must restore the composer render target');
  assert.equal(space.opening.material.uniforms.image.value,space.pass.target.texture);
  assert.deepEqual(space.opening.material.uniforms.viewport.value.toArray(),[2096,1908]);
  assert.ok(space.pass.target.width*space.pass.target.height<863000);
  const frames=space.pass.renderCount,material=space.pass.material;
  for(let i=0;i<30;i++){space.sync(camera);space.preparePortal(renderer);}
  assert.equal(space.pass.renderCount,frames,'stationary portal must not rerun its ray march for character idle motion');
  camera.position.z=8;space.sync(camera);space.preparePortal(renderer);assert.equal(space.pass.renderCount,frames+1);
  space.pass.setSize(972,885);space.preparePortal(renderer);assert.deepEqual(space.opening.material.uniforms.viewport.value.toArray(),[972,885]);
  space.pass.enabled=true;space.sync(camera,null,0,0,true);space.pass.render(renderer,{});
  assert.equal(space.pass.material,material);assert.equal(compileCalls,1,'crossing must not trigger a second field compilation');
});
