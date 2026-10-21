import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { initialFigureState, advanceFigure, restoreFigureState, figureStage } from '../src/figure-ground-system.js';
import { FIGURE_COPY } from '../src/figure-ground-copy.js';
import { RUBIN_LABELS, RUBIN_CREDIT } from '../src/gallery-art.js';
import { LANGUAGES } from '../src/languages.js';
import { rubinSVG, PROFILE } from '../src/rubin-contour.js';

test('the observation tour stops at the shared contour without a number challenge',()=>{
  let state=initialFigureState();
  assert.equal(figureStage(state),'posters');
  assert.deepEqual(advanceFigure(state,'ground'),state);
  state=advanceFigure(state,'to-contour');assert.equal(figureStage(state),'faces');
  state=advanceFigure(state,'ground');assert.equal(figureStage(state),'ground');
  for(const action of ['ground','to-contour','meaning','generate','check','not-listed']){
    assert.deepEqual(advanceFigure(state,action),state);
  }
  assert.deepEqual(restoreFigureState(JSON.parse(JSON.stringify(state))),state);
});
test('old number-wall saves resume at the observed artwork and discard retired stages',()=>{
  for(const version of [1,2,3]){
    const saved={version,posters:true,ground:true,meaning:true,products:[[2,4]],check:{number:11},answer:'not-listed'};
    const restored=restoreFigureState(saved);
    assert.deepEqual(restored,{version:4,posters:true,ground:true});
    assert.equal(figureStage(restored),'ground');
    assert.deepEqual(restoreFigureState(restored),restored);
  }
  const partial=restoreFigureState({version:3,posters:true,ground:false});
  assert.equal(figureStage(partial),'faces');
  const wallOnly=restoreFigureState({version:1,ground:true});
  assert.equal(figureStage(wallOnly),'posters');
  assert.equal(figureStage(advanceFigure(wallOnly,'to-contour')),'ground');
  for(const invalid of [null,{}, {version:99}, {version:4,posters:'true',ground:1}]){
    assert.deepEqual(restoreFigureState(invalid),initialFigureState());
  }
});
test('all live chapter text is provided in all seven languages',()=>{
  for(const locale of LANGUAGES){
    assert.ok(FIGURE_COPY[locale].enter?.length, 'Chapter one requires a localized entry label for the open second chapter');
    assert.deepEqual(Object.keys(FIGURE_COPY[locale]),Object.keys(FIGURE_COPY.en));
    for(const value of Object.values(FIGURE_COPY[locale])){
      if(Array.isArray(value)){assert.equal(value.length,2);assert.ok(value.every(v=>typeof v==='string'&&v.length));}
      else assert.ok(typeof value==='string'&&value.length);
    }
  }
});
test('fallback SVG and the solid walls share the original contour source',()=>{
  assert.equal(readFileSync(new URL('../assets/art/rubin-contour.svg',import.meta.url),'utf8'),rubinSVG());
  assert.ok(PROFILE.some(([operation])=>operation==='C'));
});

test('Rubin exhibit labels cover every language and credit the primary research separately from the original walls',()=>{
  assert.equal(RUBIN_CREDIT.author,'Edgar Rubin');assert.equal(RUBIN_CREDIT.year,1915);
  assert.equal(new URL(RUBIN_CREDIT.source).hostname,'www.kb.dk');
  for(const language of LANGUAGES){
    assert.deepEqual(Object.keys(RUBIN_LABELS[language]),Object.keys(RUBIN_LABELS.en));
    assert.ok(Object.values(RUBIN_LABELS[language]).every(value=>typeof value==='string'&&value.length));
  }
});
