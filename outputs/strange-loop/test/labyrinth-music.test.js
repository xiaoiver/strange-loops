import test from 'node:test';
import assert from 'node:assert/strict';
import { createLabyrinthMusic, ROOM_SCORES, modulation } from '../src/labyrinth-music.js';

function harness({enabled=true,deferred=false}={}) {
  let id=0,resolveResume;
  const timers=new Map(),notes=[],oscillators=[];
  const param=()=>({setValueAtTime(){},exponentialRampToValueAtTime(){},cancelScheduledValues(){},setTargetAtTime(){}});
  const context={currentTime:0,state:'running',destination:{},resume:()=>deferred?new Promise(resolve=>{resolveResume=resolve;}):Promise.resolve(),
    createGain:()=>({gain:param(),connect(){},disconnect(){}}),
    createOscillator(){const osc={frequency:{setValueAtTime(value){notes.push(Math.round(69+12*Math.log2(value/440)));}},connect(){},disconnect(){this.disconnected=true;},start(){},stop(at){this.end=at;}};oscillators.push(osc);return osc;}};
  const music=createLabyrinthMusic({contextFactory:()=>context,enabled,setTimer:(fn,delay)=>{timers.set(++id,{fn,delay});return id;},clearTimer:key=>timers.delete(key)});
  function tick(){const next=timers.entries().next().value;if(!next)return false;const [key,{fn,delay}]=next;timers.delete(key);context.currentTime+=delay/1000;for(const osc of oscillators)if(osc.end<=context.currentTime&&!osc.disconnected)osc.onended();fn();return true;}
  const finish=()=>{let n=0;while(tick())assert.ok(++n<100,'phrases must finish without looping');};
  return {music,notes,timers,context,oscillators,tick,finish,resolve:()=>resolveResume?.()};
}
const ready=async()=>{await Promise.resolve();await Promise.resolve();};

test('modulations establish new keys with secondary dominants, and the final return restores C',()=>{
  const pitchClasses=events=>new Set(events.flatMap(event=>event.notes.map(n=>n%12)));
  assert.ok(pitchClasses(modulation(0,1)).has(6),'D7 needs F# to establish G');
  assert.ok(pitchClasses(modulation(1,2)).has(1),'A7 needs C# to establish D');
  assert.ok(pitchClasses(modulation(1,0)).has(5),'G7 restores F natural before C');
  assert.deepEqual(ROOM_SCORES[0].continuation.at(-1).notes,[48,55,64]);
  assert.deepEqual(ROOM_SCORES[2].opening.at(-1).notes,[50,57,66],'the local D cadence is distinct from global C');
});
test('outer phrases suspend without looping; two enters and returns resume saved notes and finish in C',async()=>{
  const h=harness();assert.equal(h.notes.length,0,'initialization is silent');
  h.music.gesture();await ready();h.tick(); // The first two notes of the outer phrase have sounded.
  h.music.move(1);h.music.arrive();await ready();h.finish();assert.equal(h.music.state().key,'G');
  const paused=h.notes.length;assert.equal(h.tick(),false);assert.equal(h.notes.length,paused,'waiting never starts a background loop');
  h.music.gesture();h.music.move(2);h.music.arrive();await ready();h.finish();assert.equal(h.music.state().key,'D');
  h.music.move(1);h.music.arrive();await ready();h.finish();assert.equal(h.music.state().key,'G');
  const start=h.notes.length;h.music.move(0);h.music.arrive();await ready();h.finish();
  // Return transition has 3 + 3 chord tones and 2 melody tones; next is suspended F, not opening C.
  assert.deepEqual(h.notes.slice(start+8,start+12),[53,60,69,77]);
  assert.equal(h.music.state().key,'C');assert.deepEqual(h.notes.slice(-4),[48,55,64,72]);assert.equal(h.tick(),false);
});
test('fast input waits for arrival, handles a fresh pickup and discards the interrupted transition',async()=>{
  const h=harness();h.music.gesture();h.music.move(1);await ready();h.finish();
  assert.equal(h.music.state().key,'G');const transition=h.notes.length;
  h.music.arrive();assert.ok(h.notes.length>transition);
  h.music.move(2);h.music.arrive();await ready();h.finish();
  assert.equal(h.music.state().depth,2);assert.deepEqual(h.notes.slice(-4),[50,57,66,74]);
});
test('mute, background and leaving cancel scheduled notes; re-enabling resumes instead of restarting',async()=>{
  const h=harness();h.music.gesture();await ready();assert.ok(h.notes.length>0);
  h.music.toggle();const count=h.notes.length;h.finish();assert.equal(h.notes.length,count);
  h.music.gesture();await ready();assert.equal(h.notes.length,count,'movement must not override mute');
  h.music.toggle();await ready();assert.ok(h.notes.length>count);const next=h.notes.length;
  h.music.setForeground(false);h.finish();assert.equal(h.notes.length,next);
  h.music.setForeground(true);await ready();assert.ok(h.notes.length>next);
  h.music.stop();const stopped=h.notes.length;h.music.setForeground(false);h.music.setForeground(true);await ready();h.finish();assert.equal(h.notes.length,stopped);
});
test('a late audio resume cannot resurrect a chapter that has been left',async()=>{
  const h=harness({deferred:true});h.music.gesture();h.music.stop();h.resolve();await ready();h.finish();assert.equal(h.notes.length,0);
});
test('restored inner and completed rooms stay silent; unavailable audio never blocks navigation',async()=>{
  const h=harness();h.music.reset(2,{leafSeen:true});await ready();assert.equal(h.notes.length,0);
  h.music.gesture();await ready();h.finish();assert.deepEqual(h.notes.slice(-4),[50,57,66,74]);
  h.music.reset(0,{leafSeen:true,complete:true});h.music.gesture();await ready();h.finish();const n=h.notes.length;
  h.music.reset(0);h.music.gesture();await ready();assert.ok(h.notes.length>n,'a new visit can start a new phrase');
  let opened=false;
  const quiet=createLabyrinthMusic({contextFactory:()=>{opened=true;return h.context;}});
  quiet.gesture();quiet.move(1);quiet.arrive();await ready();assert.equal(opened,false,'default navigation must not even create an audio context');
  quiet.toggle();await ready();assert.equal(opened,true,'only an explicit music toggle opts in');quiet.stop();
  const broken=createLabyrinthMusic({enabled:true,contextFactory:()=>{throw new Error('unavailable');}});broken.gesture();broken.move(1);broken.arrive();assert.equal(broken.state().available,false);assert.equal(broken.state().depth,1);
});
