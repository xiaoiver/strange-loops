import { test } from 'node:test';
import assert from 'node:assert/strict';
import { GARDEN_EXIT, GALLERY_ENTRY, exitRoute, entryRoute, routeSample } from '../src/chapter-passage.js';

test('both companions cross the actual WU/MU aperture before the room changes',()=>{
  for(const [i,start] of [[2.8,-1.95],[3.6,-1.75]].entries()){
    const route=exitRoute(start,i),end=route.at(-1);
    assert.ok(end[0]<GARDEN_EXIT.x-GARDEN_EXIT.depth, 'walk beyond the opaque back wall, without idling in the aperture');
    let crossing;
    for(let t=0;t<=1;t+=.001){const p=routeSample(route,t);if(p.x<=GARDEN_EXIT.x){crossing=p;break;}}
    assert.ok(crossing);assert.ok(Math.abs(crossing.z-GARDEN_EXIT.z)<GARDEN_EXIT.halfWidth-.25);
  }
});
test('gallery arrival crosses the side-wall aperture before turning toward the exhibit',()=>{
  for(const mobile of [false,true])for(const i of [0,1]){
    const points=entryRoute(i,mobile);
    assert.ok(points[0][0]<GALLERY_ENTRY.x&&points[1][0]>GALLERY_ENTRY.x);
    assert.equal(points[0][1],GALLERY_ENTRY.z);assert.equal(points[1][1],GALLERY_ENTRY.z);
    const end=routeSample(points,1);assert.ok(Math.hypot(end.x-points.at(-1)[0],end.z-points.at(-1)[1])<1e-9);
  }
});
test('distance-based passage movement remains continuous at bends and clamps endpoints',()=>{
  const points=[[0,0],[3,0],[3,4]];
  const a=routeSample(points,3/7-1e-6),b=routeSample(points,3/7+1e-6);
  assert.ok(Math.hypot(a.x-b.x,a.z-b.z)<.00002);
  assert.equal(a.length,7);assert.equal(routeSample(points,-2).x,0);assert.equal(routeSample(points,2).z,4);
});

test('the new gallery route visits the nearby poster wall before crossing toward the contour',()=>{
  for(const mobile of [false,true])for(const index of [0,1]){
    const route=entryRoute(index,mobile,'poster'),end=route.at(-1);
    assert.equal(route[0][1],GALLERY_ENTRY.z);
    assert.ok(end[0]<-4.8&&end[1]>4,'Stop beside the poster wall, outside the shared-contour piers');
    assert.ok(route.every(point=>point[1]>.48),'Arrival never cuts through the contour wall');
  }
});
