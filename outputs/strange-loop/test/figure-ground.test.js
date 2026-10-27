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
    assert.deepEqual(restored,{version:5,posters:true,ground:true,observed:false});
    assert.equal(figureStage(restored),'ground');
    assert.deepEqual(restoreFigureState(restored),restored);
  }
  const partial=restoreFigureState({version:3,posters:true,ground:false});
  assert.equal(figureStage(partial),'faces');
  const wallOnly=restoreFigureState({version:1,ground:true});
  assert.equal(figureStage(wallOnly),'posters');
  assert.equal(figureStage(advanceFigure(wallOnly,'to-contour')),'ground');
  assert.deepEqual(restoreFigureState({version:4,posters:true,ground:true,observed:true}),{version:5,posters:true,ground:true,observed:true});
  for(const invalid of [null,{}, {version:99}, {version:5,posters:'true',ground:1}]){
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

test('FedEx study has localized, sourced commentary and a reversible fallback',async()=>{
  const {FEDEX_LABELS,FEDEX_ART,fedexStudySVG}=await import('../src/fedex-exhibit.js');
  for(const language of LANGUAGES){
    assert.deepEqual(Object.keys(FEDEX_LABELS[language]),Object.keys(FEDEX_LABELS.en));
    assert.ok(Object.values(FEDEX_LABELS[language]).every(value=>typeof value==='string'&&value.length));
  }
  assert.ok(FEDEX_ART.source.startsWith('https://'));
  assert.ok(!fedexStudySVG(false).includes('<polygon'));
  assert.ok(fedexStudySVG(true).includes('<polygon'));
  assert.ok(fedexStudySVG(true).includes(FEDEX_ART.file));
});

test('revealing FedEx negative space leaves the wordmark and viewpoint in place',async t=>{
  const {Scene,PerspectiveCamera,Vector3,TextureLoader,Texture}=await import('three');
  const {createFigureGroundScene}=await import('../src/figure-ground-scene.js');
  const oldWidth=globalThis.innerWidth,oldHeight=globalThis.innerHeight;
  globalThis.innerWidth=1280;globalThis.innerHeight=720;
  t.after(()=>{globalThis.innerWidth=oldWidth;globalThis.innerHeight=oldHeight;});
  t.mock.method(TextureLoader.prototype,'load',()=>new Texture());
  const scene=new Scene(),view=createFigureGroundScene(scene,{matches:true},()=>{}),camera=new PerspectiveCamera(),look=new Vector3();
  view.setVisible(true);view.setState(initialFigureState(),'en',{fedex:true});view.update(.1,camera,look);scene.updateMatrixWorld(true);
  const logo=scene.getObjectByName('fedex-wordmark'),arrow=scene.getObjectByName('fedex-negative-space');
  const matrix=logo.matrixWorld.clone(),position=camera.position.clone(),orientation=camera.quaternion.clone();
  assert.equal(arrow.visible,false);
  view.setState(initialFigureState(),'en',{fedex:true,arrow:true});view.update(.1,camera,look);scene.updateMatrixWorld(true);
  assert.equal(arrow.visible,true);assert.ok(logo.material.opacity<.3);
  assert.ok(logo.matrixWorld.equals(matrix));assert.ok(camera.position.equals(position));assert.ok(camera.quaternion.equals(orientation));
  view.setState(initialFigureState(),'en',{fedex:true,arrow:false});view.update(.1,camera,look);
  assert.equal(arrow.visible,false);assert.equal(logo.material.opacity,1);
});
