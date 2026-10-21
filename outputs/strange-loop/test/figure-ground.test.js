import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { initialFigureState, advanceFigure, restoreFigureState, figureStage, numberEvidence, trialDivision } from '../src/figure-ground-system.js';
import { FIGURE_COPY } from '../src/figure-ground-copy.js';
import { LANGUAGES } from '../src/languages.js';
import { rubinSVG, PROFILE } from '../src/rubin-contour.js';

function at(action) {
  let state=initialFigureState();
  for(const next of ['ground','meaning','generate','check','not-listed']){
    state=advanceFigure(state,next);if(next===action)return state;
  }
}
test('five deliberate actions reach completion; missing evidence cannot be skipped',()=>{
  let state=initialFigureState();
  for(const invalid of ['meaning','generate','check','not-listed'])assert.equal(figureStage(advanceFigure(state,invalid)),'faces');
  const expected=['ground','numbers','eight','eleven','complete'];
  ['ground','meaning','generate','check','not-listed'].forEach((action,index)=>{
    state=advanceFigure(state,action);assert.equal(figureStage(state),expected[index]);
    assert.deepEqual(advanceFigure(state,action),state,'Repeated input is idempotent');
    assert.deepEqual(restoreFigureState(JSON.parse(JSON.stringify(state))),state);
  });
  assert.equal(figureStage(advanceFigure(at('check'),'blank-prime')),'eleven');
});
test('partial generation does not classify blanks as prime',()=>{
  const first=at('meaning');
  assert.deepEqual(first.products,[[2,2],[2,3],[3,3]]);
  assert.equal(numberEvidence(first,8).kind,'unclassified');
  const second=at('generate');assert.deepEqual(numberEvidence(second,8),{kind:'composite',product:[2,4]});
  const checked=at('check');assert.equal(numberEvidence(checked,11).kind,'prime');
  for(const n of [2,3,5,7,10,12])assert.equal(numberEvidence(checked,n).kind,'unclassified');
  assert.equal(numberEvidence(first,6).kind,'composite','The meaning bridge generates six, not eight');
});
test('trial division stops with sufficient evidence, including square boundaries',()=>{
  assert.deepEqual(trialDivision(11),{number:11,checks:[{divisor:2,remainder:1},{divisor:3,remainder:2}],prime:true});
  assert.equal(trialDivision(49).checks.at(-1).divisor,7);assert.equal(trialDivision(49).prime,false);
  assert.equal(trialDivision(2).prime,true);assert.equal(trialDivision(121).prime,false);
  for(const n of [1,0,-1,2.5,NaN,Infinity,1e9])assert.equal(trialDivision(n),null);
});
test('corrupt saved stages and forged proofs never unlock completion',()=>{
  assert.equal(figureStage(restoreFigureState({version:1,complete:true,stage:'complete'})),'faces');
  const complete=at('not-listed');
  for(const mutation of [s=>s.check.checks.pop(),s=>s.check.checks[0].remainder=0,s=>s.check.number=13]){
    const copy=structuredClone(complete);mutation(copy);assert.equal(figureStage(restoreFigureState(copy)),'eight');
  }
  assert.equal(figureStage(restoreFigureState({...complete,products:{}})),'numbers');
  assert.equal(figureStage(restoreFigureState({...complete,meaning:false})),'ground');
});
test('all live chapter text is provided in all seven languages',()=>{
  for(const locale of LANGUAGES){
    assert.deepEqual(Object.keys(FIGURE_COPY[locale]),Object.keys(FIGURE_COPY.en));
    for(const value of Object.values(FIGURE_COPY[locale])){
      if(Array.isArray(value)){assert.equal(value.length,6);assert.ok(value.every(v=>typeof v==='string'&&v.length));}
      else assert.ok(typeof value==='string'&&value.length);
    }
  }
});
test('fallback SVG and the solid walls share the original contour source',()=>{
  assert.equal(readFileSync(new URL('../assets/art/rubin-contour.svg',import.meta.url),'utf8'),rubinSVG());
  assert.ok(PROFILE.some(([operation])=>operation==='C'));
});
