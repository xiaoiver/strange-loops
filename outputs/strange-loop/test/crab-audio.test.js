import test from 'node:test';
import assert from 'node:assert/strict';
import {createCrabAudio} from '../src/crab-audio.js';
import {crabFrame,DEFAULT_NOTES} from '../src/crab-system.js';
function harness({deferred=false,broken=false}={}){
 let opened=0,resolve;const notes=[],oscillators=[];
 const param=()=>({setValueAtTime(){},exponentialRampToValueAtTime(){},cancelScheduledValues(){},setTargetAtTime(){}});
 const context={currentTime:0,state:deferred?'suspended':'running',destination:{},resume:()=>deferred?new Promise(r=>{resolve=r;}):Promise.resolve(),
  createGain:()=>({gain:param(),connect(){},disconnect(){}}),
  createOscillator(){const osc={frequency:{setValueAtTime(v){notes.push(Math.round(69+12*Math.log2(v/440)));}},connect(){},disconnect(){this.disconnected=true;},start(){},stop(at){this.end=at;}};oscillators.push(osc);return osc;}};
 const audio=createCrabAudio({contextFactory:()=>{opened++;if(broken)throw Error('blocked');return context;}});
 return {audio,notes,oscillators,context,opened:()=>opened,resolve:()=>{context.state='running';resolve?.();}};
}
const ready=async()=>{await Promise.resolve();await Promise.resolve();};
test('navigation is silent by default; reverse plays re-articulated pitches rather than a reversed recording',async()=>{
 const h=harness();h.audio.setActive(true);h.audio.frame(crabFrame('forward',0),DEFAULT_NOTES,1.5,'a');await ready();assert.equal(h.opened(),0);
 h.audio.toggle();await ready();assert.deepEqual(h.notes,[60,72]);h.notes.length=0;
 for(let i=0;i<6;i++)h.audio.frame(crabFrame('reverse',(i+.1)/6),DEFAULT_NOTES,1.5,`r${i}`);
 assert.deepEqual(h.notes.filter((_,i)=>i%2===0),[67,72,71,67,64,60]);
 const count=h.notes.length;h.audio.frame(crabFrame('reverse',1),DEFAULT_NOTES,1.5,'r5');assert.equal(h.notes.length,count,'one frame stamp cannot retrigger a note');
});
test('two simultaneous voices share edits, and mute/leave immediately fades all voices',async()=>{
 const h=harness();h.audio.toggle();h.audio.setActive(true);await ready();
 const edited=[62,64,67,71,72,69];h.audio.frame(crabFrame('together',0),edited,2,0);assert.deepEqual(h.notes,[62,74,69,81]);
 h.audio.toggle();const n=h.notes.length;assert.ok(h.oscillators.every(o=>o.end<=.06));h.audio.frame(crabFrame('together',.4),edited,2,1);assert.equal(h.notes.length,n);
 h.audio.setActive(false);h.audio.toggle();await ready();assert.equal(h.notes.length,n,'leaving must discard the held frame');
});
test('a late resume or missing audio backend cannot start a departed chapter',async()=>{
 const h=harness({deferred:true});h.audio.toggle();h.audio.setActive(true);h.audio.frame(crabFrame('forward',0),DEFAULT_NOTES,1.5,0);h.audio.setActive(false);h.resolve();await ready();assert.equal(h.notes.length,0);
 const broken=harness({broken:true});broken.audio.toggle();broken.audio.setActive(true);assert.equal(broken.audio.state().available,false);
});
