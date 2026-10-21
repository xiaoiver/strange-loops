import test from 'node:test';
import assert from 'node:assert/strict';
import { bindPileInteraction } from '../src/pile-interaction.js';

test('only a scene tap nudges; scrolling, dragging, controls and transitions do not',()=>{
  const handlers=new Map(),nudged=[];let enabled=true;
  const root={addEventListener:(key,fn)=>handlers.set(key,fn),removeEventListener:key=>handlers.delete(key)};
  const scene={closest:selector=>selector==='#world, #garden-intro'?true:null};
  const control={closest:()=>true};
  const surface={getBoundingClientRect:()=>({left:0,top:0,width:100,height:100})};
  const dispose=bindPileInteraction(root,{surface,enabled:()=>enabled,pick:p=>Math.abs(p.x)<.5?7:null,nudge:i=>nudged.push(i)});
  const event=(type,overrides={})=>handlers.get(type)({target:scene,isPrimary:true,button:0,pointerId:1,clientX:50,clientY:50,timeStamp:0,...overrides});
  event('pointerdown');event('pointerup',{timeStamp:100});assert.deepEqual(nudged,[7]);
  event('pointerdown');event('pointermove',{clientX:70});event('pointerup');
  event('pointerdown');event('scroll');event('pointerup');
  event('pointerdown');event('pointercancel');event('pointerup');
  event('pointerdown');event('pointerup',{timeStamp:700});
  event('pointerdown',{target:control});event('pointerup',{target:control});
  event('pointerdown',{clientX:0});event('pointerup',{clientX:0});
  event('pointerdown');enabled=false;event('pointerup');
  assert.deepEqual(nudged,[7]);dispose();assert.equal(handlers.size,0);
});
