import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { initialFigureState, advanceFigure, restoreFigureState, figureStage, figureLocation, figureNavigation } from '../src/figure-ground-system.js';
import { FIGURE_COPY } from '../src/figure-ground-copy.js';
import { RUBIN_LABELS, RUBIN_CREDIT } from '../src/gallery-art.js';
import { LANGUAGES } from '../src/languages.js';
import { rubinSVG, PROFILE } from '../src/rubin-contour.js';

test('the observation tour stops at the shared contour without a number challenge',()=>{
  let state=initialFigureState();
  assert.equal(figureStage(state),'posters');
  assert.deepEqual(advanceFigure(state,'ground'),state);
  assert.equal(figureNavigation(state).primary,'fedex');
  assert.equal(figureNavigation(state).next,'to-contour');
  state=advanceFigure(state,'to-wall');assert.equal(figureStage(state),'marks');
  assert.equal(figureLocation(state),'fedex');
  assert.equal(figureNavigation(state).next,'to-contour');
  assert.deepEqual(restoreFigureState(JSON.parse(JSON.stringify(state))),state);
  state=advanceFigure(state,'to-contour');assert.equal(figureStage(state),'faces');
  assert.equal(figureNavigation(state).primary,'ground');
  state=advanceFigure(state,'ground');assert.equal(figureStage(state),'ground');
  assert.deepEqual(figureNavigation(state),{primary:'next',next:'next'});
  for(const action of ['ground','to-contour','meaning','generate','check','not-listed']){
    assert.deepEqual(advanceFigure(state,action),state);
  }
  assert.deepEqual(restoreFigureState(JSON.parse(JSON.stringify(state))),state);
});
test('old number-wall saves resume at the observed artwork and discard retired stages',()=>{
  for(const version of [1,2,3,4,5]){
    const saved={version,posters:true,ground:true,meaning:true,products:[[2,4]],check:{number:11},answer:'not-listed'};
    const restored=restoreFigureState(saved);
    assert.deepEqual(restored,{version:6,posters:true,marks:true,ground:true,observed:false});
    assert.equal(figureStage(restored),'ground');
    assert.deepEqual(restoreFigureState(restored),restored);
  }
  const partial=restoreFigureState({version:3,posters:true,ground:false});
  assert.equal(figureStage(partial),'faces');
  const wallOnly=restoreFigureState({version:1,ground:true});
  assert.equal(figureStage(wallOnly),'posters');
  assert.equal(figureStage(advanceFigure(wallOnly,'to-contour')),'ground');
  assert.deepEqual(restoreFigureState({version:4,posters:true,ground:true,observed:true}),{version:6,posters:true,marks:true,ground:true,observed:true});
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

test('three cutout studies share localized commentary and a reversible fallback',async()=>{
  const {WALL_LABELS,CUTOUT_STUDIES,negativeSpaceSVG,contains}=await import('../src/cutout-studies.js');
  const plateKeys=Object.keys(CUTOUT_STUDIES[0].labels.en);
  for(const language of LANGUAGES){
    assert.deepEqual(Object.keys(WALL_LABELS[language]),Object.keys(WALL_LABELS.en));
    assert.ok(Object.values(WALL_LABELS[language]).every(value=>typeof value==='string'&&value.length));
    for(const study of CUTOUT_STUDIES){
      assert.deepEqual(Object.keys(study.labels[language]),plateKeys);
      assert.ok(Object.values(study.labels[language]).every(value=>typeof value==='string'&&value.length));
      assert.equal(study.labels[language].revealed.includes('?'),false);
    }
  }
  for(const study of CUTOUT_STUDIES){
    assert.ok(study.art.source.startsWith('https://'));
    assert.ok(contains(study.holes[0],study.sample[0],study.sample[1]),study.id);
    for(const [index,mark] of study.marks.entries()){
      const inside=contains(mark,...study.sample)&&!study.markHoles[index].some(hole=>contains(hole,...study.sample));
      assert.equal(inside,false,study.id);
    }
  }
  const closed=negativeSpaceSVG({revealed:false}),open=negativeSpaceSVG({revealed:true});
  assert.equal(closed.split('class="ns-plug"').length-1,3);
  assert.equal(open.includes('class="ns-plug"'),false);
  assert.ok(closed.includes('class="ns-mark')&&open.includes('class="ns-mark'));
  assert.equal(closed.includes('<image'),false,'All three studies use vector paths');
  assert.ok(open.includes('ns-study-fedex'));
  assert.equal(CUTOUT_STUDIES[0].marks.length,3,'F1 keeps the F and both fine speed-line groups');
  assert.ok(CUTOUT_STUDIES[2].marks.length>5,'Keep the mountain ridges and snow details');
  assert.equal(open.includes('opacity="0.2"'),false);
  const focused=negativeSpaceSVG({revealed:false,focus:'toblerone'});
  assert.ok(focused.includes('ns-cutout-mask-toblerone'));
  assert.notEqual(focused.match(/viewBox="([^"]+)"/)[1],closed.match(/viewBox="([^"]+)"/)[1]);
});

test('cutout plugs withdraw through real holes without moving the marks',async t=>{
  const {Scene,PerspectiveCamera,Vector3,Raycaster,TextureLoader,Texture}=await import('three');
  const {createFigureGroundScene}=await import('../src/figure-ground-scene.js');
  const {CUTOUT_STUDIES,CUTOUT_ANCHOR}=await import('../src/cutout-studies.js');
  const oldWidth=globalThis.innerWidth,oldHeight=globalThis.innerHeight;
  globalThis.innerWidth=1280;globalThis.innerHeight=720;
  t.after(()=>{globalThis.innerWidth=oldWidth;globalThis.innerHeight=oldHeight;});
  t.mock.method(TextureLoader.prototype,'load',()=>new Texture());
  const scene=new Scene(),view=createFigureGroundScene(scene,{matches:true},()=>{}),camera=new PerspectiveCamera(),look=new Vector3();
  view.setVisible(true);view.setState(initialFigureState(),'en',{fedex:true,study:'fedex'});view.update(.1,camera,look);scene.updateMatrixWorld(true);
  const mount=scene.getObjectByName('fedex-exhibit');
  const wall=scene.getObjectByName('negative-space-wall');
  wall.geometry.computeBoundingBox();
  const wallBounds=wall.geometry.boundingBox.clone().applyMatrix4(wall.matrixWorld);
  assert.ok(Math.abs(wallBounds.min.x-16.825)<1e-6,'Front face matches the original east wall');
  assert.ok(Math.abs(wallBounds.max.x-17.175)<1e-6,'Wall thickness sits behind the surface');
  assert.ok(Math.abs(wallBounds.min.y+3.8)<1e-6&&Math.abs(wallBounds.max.y-8.2)<1e-6,'Wall extends from floor to ceiling');
  assert.ok(Math.abs(wallBounds.min.z+19.2)<1e-5&&Math.abs(wallBounds.max.z-21.8)<1e-5,'No separate rectangular panel perimeter');
  const backlight=scene.getObjectByName('ns-backlight');
  backlight.geometry.computeBoundingBox();
  for(const study of CUTOUT_STUDIES){
    for(const [x,y] of study.holes.flat()){
      assert.ok(backlight.geometry.boundingBox.containsPoint(new Vector3(x,y,0)),`${study.id}: backlight covers the complete aperture`);
    }
  }
  const logo=scene.getObjectByName('ns-mark-fedex');
  const marks=CUTOUT_STUDIES.map(study=>scene.getObjectByName(`ns-mark-${study.id}`));
  const matrices=new Map([[logo,logo.matrixWorld.clone()],...marks.map(mark=>[mark,mark.matrixWorld.clone()])]);
  const position=camera.position.clone(),orientation=camera.quaternion.clone();
  const raycaster=new Raycaster();
  function hitAt(sample){
    scene.updateMatrixWorld(true);
    const origin=new Vector3(sample[0],sample[1],2);
    const end=new Vector3(sample[0],sample[1],-1);
    mount.localToWorld(origin);mount.localToWorld(end);
    raycaster.set(origin,end.sub(origin).normalize());
    raycaster.far=6;
    const objects=[];
    scene.traverse(object=>{if(object.isMesh)objects.push(object);});
    return raycaster.intersectObjects(objects,false)[0]?.object;
  }
  for(const study of CUTOUT_STUDIES){
    const hit=hitAt(study.sample);
    assert.equal(hit?.name,`ns-plug-${study.id}`,study.id);
  }
  view.setState(initialFigureState(),'en',{fedex:true,arrow:true,study:'fedex'});view.update(.1,camera,look);scene.updateMatrixWorld(true);
  for(const study of CUTOUT_STUDIES){
    const hit=hitAt(study.sample);
    assert.equal(hit?.name,'ns-backlight',study.id);
    assert.ok(scene.getObjectByName(`ns-plug-${study.id}`).position.z<0,study.id);
  }
  for(const mark of marks){
    for(const mesh of mark.children){
      assert.equal(mesh.material.opacity,1);
      assert.equal(mesh.material.map,null,'Wall marks are geometry, not texture planes');
      mesh.geometry.computeBoundingBox();
      const bounds=mesh.geometry.boundingBox;
      assert.ok(bounds.max.z-bounds.min.z>.015,'Keep the marks’ thin relief');
      assert.equal(mesh.castShadow,true);
    }
  }
  for(const [object,matrix] of matrices)assert.ok(object.matrixWorld.equals(matrix));
  assert.ok(camera.position.equals(position));assert.ok(camera.quaternion.equals(orientation));
  view.setState(initialFigureState(),'en',{fedex:true,arrow:false,study:'f1'});view.update(.1,camera,look);
  assert.equal(camera.position.equals(position),true);
  globalThis.innerWidth=390;globalThis.innerHeight=844;
  view.setState(initialFigureState(),'en',{fedex:true,arrow:true,study:'f1'});view.update(.1,camera,look);
  const high=look.y;
  view.setState(initialFigureState(),'en',{fedex:true,arrow:true,study:'toblerone'});view.update(.1,camera,look);
  assert.ok(look.y<high-1);
  for(const study of CUTOUT_STUDIES){
    view.setState(initialFigureState(),'en',{fedex:true,arrow:true,study:study.id});view.update(.1,camera,look);
    const distance=CUTOUT_ANCHOR.x-camera.position.x;
    const frameHeight=2*distance*Math.tan(48*Math.PI/360);
    assert.ok(study.size.width<=frameHeight*(390/844)*.861,`${study.id}: horizontal fit`);
    assert.ok(study.size.height<=frameHeight*.291,`${study.id}: label clearance`);
    assert.ok(camera.position.x>-6.69,`${study.id}: camera stays inside the gallery`);
  }
});

test('analysis apertures remain in the vector negative space instead of cutting through ink',async()=>{
  const {default:clipping}=await import('polygon-clipping');
  const {LOGO_CONTOURS}=await import('../src/logo-contours.js');
  const area=ring=>Math.abs(ring.reduce((sum,p,i)=>{const q=ring[(i+1)%ring.length];return sum+p[0]*q[1]-q[0]*p[1];},0)/2);
  for(const [id,study]of Object.entries(LOGO_CONTOURS)){
    assert.ok(area(study.hole)>.05,`${id}: aperture is not a sliver`);
    for(const mark of study.shapes){
      const overlap=clipping.intersection([[study.hole]],[mark]);
      const filledArea=overlap.reduce((sum,p)=>sum+area(p[0])-p.slice(1).reduce((sum,hole)=>sum+area(hole),0),0);
      assert.ok(filledArea<1e-6,`${id}: aperture cuts through the original mark (${filledArea})`);
    }
  }
});

test('F1 reveal covers the full gap at the curved head, middle bar and both feet',async()=>{
  const {LOGO_CONTOURS}=await import('../src/logo-contours.js');
  const {contains}=await import('../src/cutout-studies.js');
  const toWall=([x,y])=>[(x-102.4)*5.25/163.2,(38.852-y)*5.25/163.2+2.22];
  for(const sourcePoint of [[89,25],[85,45],[50,70],[98,70],[115,10]]){
    assert.ok(contains(LOGO_CONTOURS.f1.hole,...toWall(sourcePoint)),`Unfilled F1 gap at ${sourcePoint}`);
  }
});

test('the gallery ends at the contour and the actual next-room cube is framed behind it',async t=>{
  const {Scene,Box3,Vector3,TextureLoader,Texture,Raycaster}=await import('three');
  const {createFigureGroundScene}=await import('../src/figure-ground-scene.js');
  const {CONTOUR_Z,GALLERY_INTERIOR}=await import('../src/gallery-layout.js');
  const {MODEL_ORIGIN}=await import('../src/labyrinth-fold.js');
  const oldWidth=globalThis.innerWidth;globalThis.innerWidth=1280;t.after(()=>{globalThis.innerWidth=oldWidth;});
  t.mock.method(TextureLoader.prototype,'load',()=>new Texture());
  const scene=new Scene(),view=createFigureGroundScene(scene,{matches:true},()=>{});view.setVisible(true);scene.updateMatrixWorld(true);
  const contour=scene.getObjectByName('rubin-exit'),bounds=new Box3().setFromObject(contour);
  assert.ok(Math.abs(bounds.min.z-CONTOUR_Z)<1e-6&&CONTOUR_Z<0);
  assert.ok(MODEL_ORIGIN[2]<CONTOUR_Z-5&&Math.abs(MODEL_ORIGIN[0])<.01,'The cube is beyond the doorway, along the opening');
  const barriers=[];for(const name of ['rubin-exit','contour-left-wing','contour-right-wing','contour-lintel'])scene.getObjectByName(name).traverse(o=>{if(o.isMesh)barriers.push(o);});
  const ray=new Raycaster();ray.far=2;
  for(const [x,y] of [[GALLERY_INTERIOR.left+.2,-1],[GALLERY_INTERIOR.right-.2,-1],[0,4]]){
    ray.set(new Vector3(x,y,CONTOUR_Z+1),new Vector3(0,0,-1));
    assert.ok(ray.intersectObjects(barriers,false).length,'The wings and lintel close the former side bypasses');
  }
  ray.set(new Vector3(0,-1,CONTOUR_Z+1),new Vector3(0,0,-1));
  assert.equal(ray.intersectObjects(barriers,false).length,0,'The vase remains a real, traversable opening');
});
