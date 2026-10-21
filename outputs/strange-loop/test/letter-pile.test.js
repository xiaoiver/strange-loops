import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { FontLoader } from 'three/addons/loaders/FontLoader.js';
import { Group, Vector3, Quaternion } from 'three';
import { glyphCollider } from '../src/letter-pile-geometry.js';
import { createLetterPilePhysics, PILE_COUNT, PILE_FLOOR } from '../src/letter-pile-physics.js';
import { PILE_LETTERS } from '../src/letter-pile-config.js';
import { pileArrival } from '../src/letter-pile-arrival.js';
import { createLetterPile } from '../src/letter-pile.js';

const font=new FontLoader().parse(JSON.parse(readFileSync(new URL('../node_modules/three/examples/fonts/optimer_regular.typeface.json',import.meta.url))));
const definitions=[...PILE_LETTERS].map(ch=>glyphCollider(font,ch));
const rest=JSON.parse(readFileSync(new URL('../src/letter-pile-rest.json',import.meta.url)));

test('glyph colliders are convex prisms and preserve the opening in O',()=>{
  const o=glyphCollider(font,'O');
  for(const definition of [...definitions,o])for(const piece of definition.pieces){
    for(const face of piece.faces){
      const a=new Vector3(...piece.vertices[face[0]]),b=new Vector3(...piece.vertices[face[1]]),c=new Vector3(...piece.vertices[face[2]]);
      const normal=b.sub(a).cross(c.sub(a)).normalize();
      assert.ok(normal.length()>.99,'no degenerate collision face');
      for(const vertex of piece.vertices)assert.ok(new Vector3(...vertex).sub(a).dot(normal)<1e-6,'outward convex face');
    }
  }
  assert.ok(o.pieces.every(p=>{
    const polygon=p.faces[1].map(i=>new Vector3(...p.vertices[i]).add(new Vector3(...p.offset)));
    return polygon.some((a,i)=>{const b=polygon[(i+1)%polygon.length];return (b.x-a.x)*(-a.y)-(b.y-a.y)*(-a.x)<-1e-6;});
  }),'the hollow center must not be a solid bounding box');
});

test('falling letters collide with the floor and one another, then stop',()=>{
  const simulation=createLetterPilePhysics(definitions,{count:16});
  simulation.step();const initial=simulation.bodies[0].position.y;
  for(let i=0;i<15;i++)simulation.step();
  assert.ok(simulation.bodies[0].position.y<initial,'gravity changes the pose');
  while(!simulation.finished&&simulation.time<40)simulation.step();
  assert.equal(simulation.finished,true);
  assert.equal(simulation.bodies.length,16);
  assert.ok(simulation.bodies.every(b=>b.position.y>PILE_FLOOR));
  assert.ok(simulation.bodies.some(b=>b.position.y>PILE_FLOOR+.3),'letters stack instead of passing through each other');
  const before=simulation.snapshot();assert.equal(simulation.step(),false);assert.deepEqual(simulation.snapshot(),before);
});

test('reduced-motion fallback has all letters, valid rotations, a mound, and no floor tunnelling',()=>{
  assert.equal(rest.length,PILE_COUNT*7);assert.ok(rest.every(Number.isFinite));
  let highest=-Infinity,lowest=Infinity;
  for(let i=0;i<PILE_COUNT;i++){
    const position=new Vector3().fromArray(rest,i*7),rotation=new Quaternion().fromArray(rest,i*7+3);
    assert.ok(Math.abs(rotation.length()-1)<.00003);
    for(const piece of definitions[i%definitions.length].pieces)for(const vertex of piece.vertices){
      const y=new Vector3(...vertex).add(new Vector3(...piece.offset)).applyQuaternion(rotation).add(position).y;
      lowest=Math.min(lowest,y);highest=Math.max(highest,y);
    }
  }
  assert.ok(lowest>PILE_FLOOR-.04,`lowest vertex ${lowest}`);
  assert.ok(highest>PILE_FLOOR+1,'a three-dimensional mound');
});

test('simulation pauses outside the chapter and falls back when the worker fails',()=>{
  const previousDocument=globalThis.document,previousWorker=globalThis.Worker;
  const messages=[],listeners={};let worker;
  globalThis.document={baseURI:'https://example.test/experiences/geb/',hidden:false,addEventListener:(name,fn)=>{listeners[name]=fn;}};
  globalThis.Worker=class{constructor(url){assert.equal(url.pathname,'/experiences/geb/assets/letter-pile-worker.js');worker=this;}postMessage(data){messages.push(data);}terminate(){this.terminated=true;}};
  try{
    const group=new Group(),pile=createLetterPile(group,font,{matches:false,addEventListener(){}});
    pile.setPresence(.5);assert.equal(messages.length,0);
    pile.setPresence(1);assert.equal(messages.at(-1).value,true);
    document.hidden=true;listeners.visibilitychange();assert.equal(messages.at(-1).value,false);
    document.hidden=false;listeners.visibilitychange();assert.equal(messages.at(-1).value,true);
    pile.setPresence(0);assert.equal(messages.at(-1).value,false);
    pile.setPresence(1);
    worker.onerror();assert.equal(worker.terminated,true);
    assert.equal(pile.update(1/60),true);assert.equal(pile.update(1/60),false);
    assert.equal(group.children.reduce((sum,m)=>sum+m.count,0),PILE_COUNT);
  }finally{globalThis.document=previousDocument;globalThis.Worker=previousWorker;}
});


test('reduced motion displays the settled pile without starting a worker',()=>{
  const previousDocument=globalThis.document,previousWorker=globalThis.Worker;
  let created=0;
  globalThis.document={addEventListener(){}};
  globalThis.Worker=class{constructor(){created++;}};
  try{
    const pile=createLetterPile(new Group(),font,{matches:true,addEventListener(){}});
    pile.setPresence(1);assert.equal(created,0);
    assert.equal(pile.update(1/60),true);assert.equal(pile.update(1/60),false);
  }finally{globalThis.document=previousDocument;globalThis.Worker=previousWorker;}
});


test('arrival lifts only the upper third and gravity brings it back onto the mound',()=>{
  const poses=pileArrival(rest),lifted=[];
  for(let i=0;i<PILE_COUNT;i++)if(poses[i*7+1]>rest[i*7+1]+1)lifted.push(i);
  assert.equal(lifted.length,48);
  const simulation=createLetterPilePhysics(definitions,{initialTransforms:poses});
  assert.equal(simulation.bodies.length,PILE_COUNT);
  const heights=lifted.map(i=>simulation.bodies[i].position.y);
  for(let i=0;i<24;i++)simulation.step();
  assert.ok(lifted.every((index,i)=>simulation.bodies[index].position.y<heights[i]-.4));
});

test('re-entry restarts the arrival while tab visibility only pauses it',()=>{
  const previousDocument=globalThis.document,previousWorker=globalThis.Worker;
  const workers=[],listeners={};
  globalThis.document={baseURI:'https://example.test/',hidden:false,addEventListener:(name,fn)=>{listeners[name]=fn;}};
  globalThis.Worker=class{constructor(){this.messages=[];workers.push(this);}postMessage(data){this.messages.push(data);}terminate(){this.terminated=true;}};
  try{
    const pile=createLetterPile(new Group(),font,{matches:false,addEventListener(){}});
    pile.setPresence(1);assert.equal(workers.length,1);
    document.hidden=true;listeners.visibilitychange();document.hidden=false;listeners.visibilitychange();assert.equal(workers.length,1);
    workers[0].onmessage({data:{transforms:new Float32Array(rest),finished:true}});
    pile.setPresence(.5);pile.setPresence(0);pile.setPresence(.5);pile.setPresence(1);
    assert.equal(workers.length,2);assert.equal(workers[0].terminated,true);
    assert.deepEqual(workers[1].messages[0].initialTransforms,pileArrival(rest));
    // A queued response from the previous visit must not stop the new worker.
    workers[0].onmessage({data:{transforms:new Float32Array(rest),finished:true}});
    assert.notEqual(workers[1].terminated,true);
    workers[1].onmessage({data:{transforms:new Float32Array(rest),finished:true}});
  }finally{globalThis.document=previousDocument;globalThis.Worker=previousWorker;}
});

test('a local tap wakes a few settled letters, makes a small hop and settles again',()=>{
  const simulation=createLetterPilePhysics(definitions,{count:16});
  while(!simulation.finished&&simulation.time<40)simulation.step();
  assert.equal(simulation.finished,true);
  const top=simulation.bodies.reduce((best,b,i,all)=>b.position.y>all[best].position.y?i:best,0);
  const before=simulation.bodies.map(b=>b.position.clone()),affected=simulation.nudge(top);
  assert.ok(affected.includes(top));assert.ok(affected.length<=6);
  assert.equal(simulation.finished,false);
  simulation.bodies.forEach((b,i)=>{if(!affected.includes(i))assert.equal(b.velocity.lengthSquared(),0);});
  let highest=before[top].y;const deadline=simulation.time+30;
  while(!simulation.finished&&simulation.time<deadline){simulation.step();highest=Math.max(highest,simulation.bodies[top].position.y);}
  assert.ok(highest>before[top].y+.025,'a visible but small hop');
  assert.ok(highest<before[top].y+.45,'not an explosive launch');
  assert.equal(simulation.finished,true);
  assert.ok(simulation.bodies.every(b=>b.position.y>PILE_FLOOR));
  assert.deepEqual(simulation.nudge(-1),[]);
});

test('taps reuse the sleeping worker, throttle repeats and ignore stale snapshots',()=>{
  const previousDocument=globalThis.document,previousWorker=globalThis.Worker;
  let worker;const reduced={matches:false,addEventListener(){}};
  globalThis.document={baseURI:'https://example.test/',hidden:false,addEventListener(){}};
  globalThis.Worker=class{constructor(){this.messages=[];worker=this;}postMessage(data){this.messages.push(data);}terminate(){this.terminated=true;}};
  try{
    const pile=createLetterPile(new Group(),font,reduced);pile.setPresence(1);
    worker.onmessage({data:{transforms:new Float32Array(rest),finished:true,revision:0}});
    assert.notEqual(worker.terminated,true);
    assert.equal(pile.nudge(10),true);
    assert.equal(worker.messages.at(-2).type,'nudge');assert.equal(worker.messages.at(-1).value,true);
    const messageCount=worker.messages.length;
    assert.equal(pile.nudge(11),false,'rapid taps do not add energy');
    worker.onmessage({data:{transforms:new Float32Array(rest),finished:true,revision:0}});
    assert.equal(worker.messages.length,messageCount,'old finished response cannot pause the new motion');
    worker.onmessage({data:{transforms:new Float32Array(rest),finished:true,revision:1}});
    assert.equal(worker.messages.at(-1).value,false);
    reduced.matches=true;assert.equal(pile.nudge(10),false);
    pile.setPresence(0);assert.equal(pile.nudge(10),false);
  }finally{globalThis.document=previousDocument;globalThis.Worker=previousWorker;}
});
