import test from 'node:test';
import assert from 'node:assert/strict';
import {sampleJourney,PORTAL_Z,INTERIOR_SCALE,previewResolution,CELL_SIZE,CRUISE_SPEED,END_INTERIOR_Z,PHASE_RATES,createTravelFrame,advanceTravel,bendAt,cruiseCamera,entryEase} from '../src/fractal-journey.js';

test('manual and reversed journeys use one continuous rail across the scale portal',()=>{
  let prior=sampleJourney(0),crossings=0;
  const samples=[];
  for(let i=0;i<=10000;i++){
    const p=i/10000,current=sampleJourney(p);
    assert.ok(current.position.every(Number.isFinite));
    assert.ok(current.position[2]<=prior.position[2]);
    assert.ok(Math.hypot(...current.position.map((n,j)=>n-prior.position[j]))<.004,'crossing the portal must not teleport the camera');
    if(current.inside!==prior.inside){
      crossings++;assert.ok(Math.abs(current.position[2]-PORTAL_Z)<.002);
      assert.equal(current.position[0],0,'approach must align before the aperture');
      assert.ok(Math.abs(current.position[1])<.5);
    }
    samples.push(current);prior=current;
  }
  assert.equal(crossings,1);
  for(let i=10000;i>=0;i--)assert.deepEqual(sampleJourney(i/10000),samples[i]);
  assert.equal(sampleJourney(-1).progress,0);assert.equal(sampleJourney(2).progress,1);
  assert.ok(INTERIOR_SCALE>1,'the interior metric must be larger than the exterior');
});

test('fractal fill rate is bounded on Retina, portrait mobile and a reduced-quality pass',()=>{
  for(const [w,h,dpr,budget] of [[390,844,3,390000],[1048,954,2,860000],[1920,1080,2,860000],[3440,1440,1.5,860000]]){
    const full=previewResolution(w,h,dpr),reduced=previewResolution(w,h,dpr,.62);
    assert.ok(full.width*full.height<budget*1.003);
    assert.ok(full.width<=w*dpr&&full.height<=h*dpr);
    assert.ok(Math.abs(full.width/full.height-w/h)<.005,'a quality change cannot stretch the space');
    assert.ok(reduced.width<full.width&&reduced.height<full.height);
  }
});

const near=(a,b,tolerance=1e-8)=>assert.ok(Math.abs(a-b)<tolerance,`${a} should equal ${b}`);
const samePhase=(a,b)=>{near(Math.sin(a),Math.sin(b));near(Math.cos(a),Math.cos(b));};

test('continuous cruising reuses bounded coordinates and phases for a million frames',()=>{
  const frame=createTravelFrame(END_INTERIOR_Z),keys=Object.keys(frame);
  // Over four hours at 60 fps: check every frame, including thousands of wraps.
  for(let i=0;i<1_000_000;i++){
    assert.equal(advanceTravel(frame,CRUISE_SPEED/60),frame);
    assert.ok(frame.localZ>=-CELL_SIZE/2&&frame.localZ<CELL_SIZE/2);
    if(i%1000===0){
      assert.deepEqual(Object.keys(frame),keys,'travel cannot accumulate history');
      for(const key of Object.keys(PHASE_RATES))assert.ok(frame[key]>=0&&frame[key]<Math.PI*2);
    }
  }
  assert.ok(frame.wraps>2700);
});

test('rebasing preserves nearby field phases, surface coordinates and camera direction',()=>{
  const frame=createTravelFrame(-17.99),before={...frame};
  advanceTravel(frame,.02);
  const oldZ=before.localZ-.02,shift=Math.round((oldZ-frame.localZ)/CELL_SIZE);
  assert.equal(shift,-1);
  // The shader evaluates layer angle and size in the same bounded frame.
  for(const offset of [-185,-36,-.1,0,36,185]){
    const zBefore=oldZ+offset,zAfter=frame.localZ+offset;
    const layerBefore=Math.floor((zBefore+18)/36),layerAfter=Math.floor((zAfter+18)/36);
    for(const key of ['angle','spin','scale'])samePhase(before[key]+layerBefore*PHASE_RATES[key],frame[key]+layerAfter*PHASE_RATES[key]);
    const oldBend=bendAt(before,zBefore),newBend=bendAt(frame,zAfter);
    oldBend.forEach((n,j)=>near(n,newBend[j]));
    near(zBefore-layerBefore*CELL_SIZE,zAfter-layerAfter*CELL_SIZE);
  }
  const cameraBefore=cruiseCamera({...before,localZ:oldZ}),cameraAfter=cruiseCamera(frame);
  cameraBefore.position.slice(0,2).forEach((n,j)=>near(n,cameraAfter.position[j]));
  cameraBefore.forward.forEach((n,j)=>near(n,cameraAfter.forward[j]));
});

test('manual travel supports several-cell steps and reversing without losing the same space',()=>{
  const frame=createTravelFrame(END_INTERIOR_Z),initial={...frame};
  for(const distance of [120.6,-500.8,999.3,-619.1])advanceTravel(frame,distance);
  near(frame.localZ,initial.localZ);
  for(const key of Object.keys(PHASE_RATES))samePhase(frame[key],initial[key]);
  const camera=cruiseCamera(frame);
  near(Math.hypot(...camera.forward),1);
});

test('entry motion reaches the cruise speed instead of stopping at the former endpoint',()=>{
  let previous=0;
  for(let i=0;i<=1000;i++){
    const value=entryEase(i/1000);assert.ok(value>=previous&&value<=1);previous=value;
  }
  assert.equal(entryEase(0),0);assert.equal(entryEase(1),1);
  const h=1e-5,terminalSlope=(entryEase(1)-entryEase(1-h))/h;
  near(terminalSlope,.75,1e-5);
  near(terminalSlope*14*INTERIOR_SCALE/14,CRUISE_SPEED,1e-4);
  near(entryEase(h)/h,0,1e-7);
});
