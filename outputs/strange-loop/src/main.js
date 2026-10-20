import * as THREE from 'three';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { GTAOPass } from 'three/addons/postprocessing/GTAOPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';
import { ShaderPass } from 'three/addons/postprocessing/ShaderPass.js';
import { FXAAShader } from 'three/addons/shaders/FXAAShader.js';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { applySoftShadows } from './soft-shadows.js';
import { COPY } from './copy.js';
import { createCanonPlayer, CANON_SECONDS } from './canon.js';
import { loadCompanions } from './companions.js';
import {
 createSculptureWorker,
 binToGeometry,
 normalizeLetters,
 readQueryLetters,
 writeQueryLetters,
 DEFAULT_LETTERS,
} from './sculpture.js';
import {
 canExportSculpture,
 downloadSculptureSTL,
 downloadSculptureOBJ,
} from './sculpture-export.js';

const $=s=>document.querySelector(s);
const world=$('#world'),status=$('#status');
const reduced=matchMedia('(prefers-reduced-motion: reduce)');
let paused=reduced.matches, inGarden=false, transition=false, currentView='free';
let scene,renderer,camera,sculpture,clock,raf,composer,ao,fxaa,elapsed=0;
let companions;
const projectionLights={};
let currentLetters=DEFAULT_LETTERS, sculptureBusy=false, graphiteMaterial=null;
const sculptureWorker=createSculptureWorker('assets/sculpture-worker.js?v=sculpt2');
const SLOT_ORDER=['G','E','B'];
const home=new THREE.Vector3(11,14,12),camPos=home.clone(),camGoal=home.clone(),look=new THREE.Vector3(0,.1,0),up=new THREE.Vector3(0,1,0);
const Y=new THREE.Vector3(0,1,0),UPTOP=new THREE.Vector3(0,0,-1);
let drag=null,manualAngle=null,autoAngle=0,cameraBlend=0,stage='lobby';
let locale='zh',dialogueKey='free',lastStatus=null;
let canonState='idle',canonRemaining=CANON_SECONDS;
const canon=createCanonPlayer(seconds=>{
 canonState='playing';canonRemaining=seconds;syncCanonLabels();
},reason=>{
 canonState='idle';syncCanonLabels();announce(reason==='error'?'canonError':reason==='ended'?'canonEnded':'canonStopped');
});
try{const saved=localStorage.getItem('geb.locale');if(COPY[saved])locale=saved;}catch{}
const textAt=path=>path.split('.').reduce((value,key)=>value[key],COPY[locale]);

function announce(key,...args){
 lastStatus={key,args};const message=COPY[locale].status[key];status.textContent=typeof message==='function'?message(...args):message;
}
function updateDialogue(key=dialogueKey){
 dialogueKey=key;const [actor,line]=COPY[locale].dialogues[key];$('#speaker').textContent=COPY[locale].actors[actor];$('#dialogue-text').textContent=typeof line==='function'?line(displayLetter(key)):line;
 $('.dialogue').hidden=key==='free';
}
function renderChapterList(){
 const list=$('#chapter-list');list.replaceChildren();
 COPY[locale].chapters.forEach(([name,topic],index)=>{
  const li=document.createElement('li'),number=document.createElement('span'),title=document.createElement('strong'),note=document.createElement('em');
  const here=index===(inGarden?1:0);li.classList.toggle('current',here);number.textContent=String(index).padStart(2,'0');title.textContent=name;note.textContent=here?COPY[locale].index.here:topic;
  li.append(number,title,note);list.append(li);
 });
}
function syncDynamicLabels(){
 const c=COPY[locale];
 syncCanonLabels();
 syncLetterChrome();
 $('.location').innerHTML=inGarden?c.gardenLocation:c.lobbyLocation;
 updateDialogue();renderChapterList();
 if(lastStatus){const message=c.status[lastStatus.key];status.textContent=typeof message==='function'?message(...lastStatus.args):message;}
}
function syncCanonLabels(){
 const c=COPY[locale].canon,b=$('#canon-preview'),active=canonState!=='idle';
 b.setAttribute('aria-pressed',String(active));b.setAttribute('aria-label',active?c.stop:c.play);
 b.title=c.description;b.disabled=canonState==='loading';
 $('#canon-label').textContent=canonState==='loading'?c.loading:active?c.remaining(canonRemaining):c.play;
 $('#canon-symbol').textContent=active?'■':'▷';
 $('#canon-explanation').hidden=!active;$('#canon-explanation').textContent=c.description;
}
function applyLocale(){
 const c=COPY[locale];document.documentElement.lang=c.lang;document.title=c.title;document.querySelector('meta[name="description"]').content=c.description;
 for(const el of document.querySelectorAll('[data-i18n]'))el.textContent=textAt(el.dataset.i18n);
 for(const el of document.querySelectorAll('[data-i18n-html]'))el.innerHTML=textAt(el.dataset.i18nHtml);
 for(const el of document.querySelectorAll('[data-i18n-aria]'))el.setAttribute('aria-label',textAt(el.dataset.i18nAria));
 const toggle=$('#language-switch');toggle.textContent=locale==='zh'?'EN':'中文';toggle.lang=locale==='zh'?'en':'zh-CN';toggle.setAttribute('aria-label',locale==='zh'?'Switch to English':'切换为中文');
 syncDynamicLabels();
}
$('#language-switch').addEventListener('click',()=>{
 locale=locale==='zh'?'en':'zh';try{localStorage.setItem('geb.locale',locale);}catch{}applyLocale();announce('language');
});


function displayLetter(slot){
 const i=SLOT_ORDER.indexOf(slot);
 return currentLetters[i]||slot;
}
function letterPlate(letter){
 const c=COPY[locale];
 return c.letterNames[letter]||c.names[letter]||letter;
}
function syncLetterChrome(){
 const c=COPY[locale];
 const input=$('#sculpture-letters');
 if(input&&document.activeElement!==input){input.value=currentLetters;input.setCustomValidity('');}
 if(input?.validity.customError)input.setCustomValidity(c.status.sculptureInvalid);
 for(const slot of SLOT_ORDER){
  const letter=displayLetter(slot);
  const plate=letterPlate(letter);
  for(const el of document.querySelectorAll(`[data-light="${slot}"] .slot-letter,[data-view="${slot}"] .slot-letter`))el.textContent=letter;
  const nameEl=document.querySelector(`[data-view="${slot}"] .slot-name`);
  if(nameEl){
   nameEl.textContent=plate;
   nameEl.hidden=false;
  }
 }
 const directions={G:locale==='zh'?'正面观察':'front view',E:locale==='zh'?'侧面观察':'side view',B:locale==='zh'?'顶部观察':'top view'};
 for(const b of document.querySelectorAll('[data-view]')){
  const slot=b.dataset.view,letter=displayLetter(slot),plate=letterPlate(letter);
  const sep=locale==='zh'?'：':': ';const label=currentLetters===DEFAULT_LETTERS&&c.viewAria[slot]?c.viewAria[slot]:`${letter} · ${plate}${sep}${directions[slot]}`;
  b.setAttribute('aria-label',label);
 }
 for(const b of document.querySelectorAll('[data-light]')){
  const slot=b.dataset.light,letter=displayLetter(slot);
  const on=projectionLights[slot]?.visible??(b.getAttribute('aria-pressed')==='true');
  b.setAttribute('aria-label',c.lightAria(letter,on));
 }
 for(const b of document.querySelectorAll('[data-view],[data-light],#reset-view'))b.title=b.getAttribute('aria-label')||'';
 const apply=$('#sculpture-apply');
 if(apply){
  apply.disabled=sculptureBusy;
  apply.textContent=sculptureBusy?c.sculpture.generating:c.sculpture.apply;
 }
 const canDownload=canExportSculpture(sculpture)&&!sculptureBusy&&!inGarden&&!transition&&document.body.dataset.scene!=='fallback';
 for(const id of ['sculpture-download-stl','sculpture-download-obj']){
  const b=$(`#${id}`);
  if(b)b.disabled=!canDownload;
 }
}
function refreshShadows(){
 if(!renderer)return;
 for(const light of Object.values(projectionLights))if(light?.shadow)light.shadow.needsUpdate=true;
 renderer.shadowMap.needsUpdate=true;
}
function applySculptureBuffer(buffer,letters){
 const geometry=binToGeometry(buffer);
 const old=sculpture.geometry;
 sculpture.geometry=geometry;
 old?.dispose?.();
 currentLetters=letters;
 updateDialogue();
 writeQueryLetters(letters);
 syncLetterChrome();
 refreshShadows();
}

async function requestSculpture(raw,{announceFailure=true}={}){
 const letters=normalizeLetters(raw);
 if(!letters){
  if(announceFailure)announce('sculptureInvalid');
  syncLetterChrome();
  return false;
 }
 if(letters===currentLetters&&sculpture){
  writeQueryLetters(letters);
  syncLetterChrome();
  announce('sculptureReady',letters);
  return true;
 }
 sculptureBusy=true;syncLetterChrome();announce('sculptureGenerating',letters);
 try{
  const {letters:built,buffer}=await sculptureWorker.build(letters);
  applySculptureBuffer(buffer,built);
  announce('sculptureReady',built);
  return true;
 }catch(error){
  console.warn('Sculpture generation failed',error);
  if(announceFailure)announce(error?.message==='invalid'?'sculptureInvalid':error?.message==='worker'||error?.message==='disposed'?'sculptureWorkerFailed':'sculptureFailed');
  syncLetterChrome();
  return false;
 }finally{
  sculptureBusy=false;syncLetterChrome();
 }
}

function seeded(seed){return()=>{seed=(seed*1664525+1013904223)>>>0;return seed/4294967296;}}
function microTexture(){const c=document.createElement('canvas');c.width=c.height=256;const ctx=c.getContext('2d'),im=ctx.createImageData(256,256),rand=seeded(987);for(let i=0;i<im.data.length;i+=4){const n=128+rand()*8;im.data[i]=im.data[i+1]=im.data[i+2]=n;im.data[i+3]=255;}ctx.putImageData(im,0,0);const t=new THREE.CanvasTexture(c);t.wrapS=t.wrapT=THREE.RepeatWrapping;t.repeat.set(4,4);return t;}
function plane(w,h,mat,x,y,z,rx=0,ry=0){const m=new THREE.Mesh(new THREE.PlaneGeometry(w,h),mat);m.position.set(x,y,z);m.rotation.set(rx,ry,0);m.receiveShadow=true;scene.add(m);return m;}
function box(w,h,d,mat,x,y,z){const m=new THREE.Mesh(new THREE.BoxGeometry(w,h,d),mat);m.position.set(x,y,z);m.castShadow=true;m.receiveShadow=true;scene.add(m);return m;}

async function init(){
 try{
  renderer=new THREE.WebGLRenderer({antialias:true,alpha:false,powerPreference:'high-performance'});
  renderer.setPixelRatio(Math.min(devicePixelRatio,1.5));renderer.setSize(innerWidth,innerHeight);
  renderer.shadowMap.enabled=true;renderer.shadowMap.type=THREE.PCFSoftShadowMap;
  renderer.toneMapping=THREE.ACESFilmicToneMapping;renderer.toneMappingExposure=1.05;
  renderer.setClearColor(0xe6e6e5);world.appendChild(renderer.domElement);
  scene=new THREE.Scene();scene.background=new THREE.Color(0xe6e6e5);scene.fog=new THREE.FogExp2(0xe6e6e5,.022);
  camera=new THREE.PerspectiveCamera(34,innerWidth/innerHeight,.1,150);clock=new THREE.Clock();
  const pmrem=new THREE.PMREMGenerator(renderer),room=new RoomEnvironment();
  scene.environment=pmrem.fromScene(room,.03).texture;scene.environmentIntensity=.22;room.dispose();pmrem.dispose();
  const tex=microTexture(),floorMat=new THREE.MeshStandardMaterial({color:0xd6d6d5,roughness:.84});
  const wallMat=new THREE.MeshStandardMaterial({color:0xe2e2e1,roughness:.92});
  // Three perpendicular receivers. Each is illuminated normally by one collimated source.
  // G falls on z-, E on x-, B on y-. No silhouette textures or compositing.
  plane(42,42,floorMat,17.2,-3.8,17.2,-Math.PI/2);
  plane(42,42,wallMat,17.2,17.2,-3.8);
  plane(42,42,wallMat,-3.8,17.2,17.2,0,Math.PI/2);
  // An original solid created by intersecting three perpendicular letter extrusions.
  const modelData=await fetch('assets/sculpture.bin?v=smooth4').then(r=>{if(!r.ok)throw Error('sculpture');return r.arrayBuffer()});
  const geometry=binToGeometry(modelData);
  graphiteMaterial=new THREE.MeshStandardMaterial({color:0x292c2b,metalness:.18,roughness:.44,bumpMap:tex,bumpScale:.008});
  graphiteMaterial.shadowSide=THREE.DoubleSide;
  for(const material of [graphiteMaterial,floorMat,wallMat])applySoftShadows(material,innerWidth<=760);
  sculpture=new THREE.Mesh(geometry,graphiteMaterial);sculpture.position.y=-.12;sculpture.castShadow=sculpture.receiveShadow=true;scene.add(sculpture);
  currentLetters=DEFAULT_LETTERS;
  const ambient=new THREE.HemisphereLight(0xf4f4f3,0x8c8d8c,.22);scene.add(ambient);
  const lightSet=[['G',[0,0,8],3.4],['E',[8,0,0],2.8],['B',[0,8,0],3.1]];
  for(const [letter,position,intensity]of lightSet){
   const light=new THREE.DirectionalLight(0xf5f5f4,intensity);light.position.set(...position);light.target.position.set(0,0,0);
   light.castShadow=true;light.shadow.mapSize.set(2048,2048);Object.assign(light.shadow.camera,{left:-5,right:5,top:5,bottom:-5,near:.1,far:20});light.shadow.normalBias=.003;light.shadow.bias=-.000025;light.shadow.radius=3;light.name=`source-${letter}`;scene.add(light);scene.add(light.target);projectionLights[letter]=light;
   light.shadow.autoUpdate=false;light.shadow.needsUpdate=true;light.shadow.camera.name=letter==='B'?'floor-shadow':`wall-${letter}`;
  }
  renderer.shadowMap.autoUpdate=false;renderer.shadowMap.needsUpdate=true;
  // PBR image-based lighting, then ground-truth ambient occlusion and a denoise pass.
  composer=new EffectComposer(renderer);composer.addPass(new RenderPass(scene,camera));
  ao=new GTAOPass(scene,camera,innerWidth,innerHeight);ao.updateGtaoMaterial({radius:.42,distanceExponent:1.5,thickness:1.2,distanceFallOff:.7,scale:1.1,samples:16});ao.updatePdMaterial({radius:5,rings:2,samples:16});ao.blendIntensity=.65;composer.addPass(ao);
  composer.addPass(new OutputPass());fxaa=new ShaderPass(FXAAShader);composer.addPass(fxaa);
  if(!paused)camPos.set(0,.1,16.5);
  resize();document.body.dataset.scene='ready';announce('ready');tick();
  loadCompanions(scene,reduced,(id,position)=>{
   const button=$(`#meet-${id}`);button.hidden=!position;
   if(position)button.style.transform=`translate(${position.x-22}px,${position.y-24}px)`;
  }).then(value=>{companions=value;renderer.shadowMap.needsUpdate=true;projectionLights.B.shadow.needsUpdate=true;})
    .catch(error=>{console.warn('Companion models unavailable',error);announce('companionsUnavailable');});
  syncLetterChrome();
  const queryLetters=readQueryLetters();
  if(queryLetters&&queryLetters!==DEFAULT_LETTERS)requestSculpture(queryLetters,{announceFailure:true});
 }catch(e){console.error(e);$('#fallback').hidden=false;world.style.display='none';$('.drag-hint').style.display='none';$('.view-tools').style.display='none';$('.sculpture-form')&&($('.sculpture-form').style.display='none');document.body.dataset.scene='fallback';announce('fallback');}
}

function resize(){if(!renderer)return;const mobile=innerWidth<=760;renderer.setSize(innerWidth,innerHeight);camera.aspect=innerWidth/innerHeight;camera.fov=mobile?50:36;camera.setViewOffset(innerWidth,innerHeight,-innerWidth*(mobile?.035:.16),-innerHeight*(mobile?.025:0),innerWidth,innerHeight);camera.updateProjectionMatrix();if(composer){composer.setPixelRatio(Math.min(devicePixelRatio,mobile?1.25:1.5));composer.setSize(innerWidth,innerHeight);const dpr=Math.min(devicePixelRatio,mobile?1.25:1.5);fxaa.material.uniforms.resolution.value.set(1/(innerWidth*dpr),1/(innerHeight*dpr));}}
function tick(){raf=requestAnimationFrame(tick);const dt=Math.min(clock.getDelta(),.05);if(document.hidden)return;elapsed+=dt;
 const a=1-Math.exp(-dt*4.4);
 if(stage==='lobby'){
  if(currentView==='free'){
   if(!paused&&!drag)autoAngle+=dt*.024;
   if(manualAngle){camGoal.setFromSphericalCoords(manualAngle.radius,manualAngle.phi,manualAngle.theta);}
   else{camGoal.copy(home);camGoal.applyAxisAngle(Y,Math.sin(autoAngle)*.13);}
  }
  camPos.lerp(camGoal,a);camera.position.copy(camPos);look.lerp(new THREE.Vector3(0,.1,0),a);
  up.lerp(currentView==='B'?UPTOP:Y,a).normalize();camera.up.copy(up);camera.lookAt(look);
 }else if(stage==='entering'){
  cameraBlend=Math.min(1,cameraBlend+dt/.95);const t=1-Math.pow(1-cameraBlend,3);camera.position.lerpVectors(enterStart,new THREE.Vector3(4.1,.4,-10.7),t);look.lerp(new THREE.Vector3(4.1,.3,-13),dt*4);camera.up.lerp(Y,dt*5);camera.lookAt(look);if(cameraBlend>=1)showGarden();
 }else if(stage==='returning'){
  camPos.lerp(home,a);camera.position.copy(camPos);look.lerp(new THREE.Vector3(0,.1,0),a);camera.lookAt(look);if(camPos.distanceTo(home)<.03){stage='lobby';transition=false;}
 }
 if(companions?.update(dt,camera,stage==='lobby')){projectionLights.B.shadow.needsUpdate=true;renderer.shadowMap.needsUpdate=true;}
 composer.render(dt);
}

function setView(view){if(inGarden||transition)return;currentView=view;manualAngle=null;autoAngle=0;
 for(const b of document.querySelectorAll('[data-view]'))b.setAttribute('aria-pressed',String(b.dataset.view===view));
 if(view==='G')camGoal.set(0,.1,16.5);if(view==='E')camGoal.set(16.5,.1,0);if(view==='B')camGoal.set(0,16.5,.001);if(view==='free')camGoal.copy(home);
 updateDialogue(view);announce('view',view==='free'?'free':displayLetter(view));
 companions?.react(view);
}
for(const button of document.querySelectorAll('[data-view]'))button.addEventListener('click',()=>setView(button.dataset.view));
$('#reset-view').addEventListener('click',()=>setView('free'));
world.addEventListener('pointerdown',e=>{if(inGarden||transition||!camera)return;const sphere=new THREE.Spherical().setFromVector3(camPos);drag={x:e.clientX,y:e.clientY,theta:sphere.theta,phi:sphere.phi,radius:sphere.radius};world.setPointerCapture(e.pointerId);world.classList.add('dragging');});
world.addEventListener('pointermove',e=>{if(!drag)return;manualAngle={radius:drag.radius,theta:drag.theta-(e.clientX-drag.x)*.006,phi:THREE.MathUtils.clamp(drag.phi+(e.clientY-drag.y)*.006,.12,Math.PI-.2)};currentView='free';for(const b of document.querySelectorAll('[data-view]'))b.setAttribute('aria-pressed','false');});
function endDrag(){if(drag){drag=null;world.classList.remove('dragging');updateDialogue('drag');}}
world.addEventListener('pointerup',endDrag);world.addEventListener('pointercancel',endDrag);
window.addEventListener('resize',resize);
for(const id of ['achilles','tortoise'])$(`#meet-${id}`).addEventListener('click',()=>{
 companions?.meet(id,camera);updateDialogue(id);announce('companionSelected',COPY[locale].actors[id]);
});

let enterStart=new THREE.Vector3(),gardenTimer;
$('#enter').addEventListener('click',()=>{
 if(transition||inGarden)return;transition=true;document.body.classList.add('entering');$('#enter').disabled=true;setIndex(false);
 if(canonState!=='idle')canon.stop();
 if(renderer&&camera&&!paused){stage='entering';cameraBlend=0;enterStart.copy(camera.position);}else{gardenTimer=setTimeout(showGarden,paused?20:600);}
 announce('entering');
});
function showGarden(){inGarden=true;transition=false;stage='garden';document.body.classList.add('in-garden');$('#garden-intro').hidden=false;syncDynamicLabels();announce('garden');$('#back-lobby').focus({preventScroll:true});}
function backLobby(){if(!inGarden)return;clearTimeout(gardenTimer);inGarden=false;transition=false;$('#garden-intro').hidden=true;document.body.classList.remove('entering','in-garden');$('#enter').disabled=false;currentView='free';camGoal.copy(home);camPos.copy(home);look.set(0,.1,0);up.copy(Y);manualAngle=null;stage='lobby';dialogueKey='free';syncDynamicLabels();$('#enter').focus({preventScroll:true});for(const b of document.querySelectorAll('[data-view]'))b.setAttribute('aria-pressed','false');announce('back');}
$('#back-lobby').addEventListener('click',backLobby);
$('.wordmark').addEventListener('click',e=>{e.preventDefault();if(inGarden)backLobby();else setView('free');setIndex(false);});

function setIndex(open){$('#chapter-index').hidden=!open;$('#index-trigger').setAttribute('aria-expanded',String(open));if(open)$('#close-index').focus({preventScroll:true});}
$('#index-trigger').addEventListener('click',()=>setIndex($('#chapter-index').hidden));$('#close-index').addEventListener('click',()=>{setIndex(false);$('#index-trigger').focus()});
document.addEventListener('keydown',e=>{if(e.key==='Escape'){if(!$('#chapter-index').hidden){setIndex(false);$('#index-trigger').focus();}else if(inGarden)backLobby();}});
document.addEventListener('pointerdown',e=>{if(!$('#chapter-index').hidden&&!$('#chapter-index').contains(e.target)&&!$('#index-trigger').contains(e.target)&&!$('#language-switch').contains(e.target))setIndex(false);});

reduced.addEventListener('change',e=>{paused=e.matches;});

$('#canon-preview').addEventListener('click',()=>{
 if(canonState!=='idle'){canon.stop();return;}
 canonState='loading';syncCanonLabels();announce('canonStarted');canon.play();
});
document.addEventListener('visibilitychange',()=>{if(document.hidden&&canonState!=='idle')canon.stop();});
window.addEventListener('pagehide',()=>{if(canonState!=='idle')canon.stop();});

for(const button of document.querySelectorAll('[data-light]'))button.addEventListener('click',()=>{
 const slot=button.dataset.light,light=projectionLights[slot];if(!light)return;light.visible=!light.visible;renderer.shadowMap.needsUpdate=true;button.setAttribute('aria-pressed',String(light.visible));const shown=displayLetter(slot);button.setAttribute('aria-label',COPY[locale].lightAria(shown,light.visible));button.title=button.getAttribute('aria-label');announce('light',shown,light.visible);
});

const sculptureForm=$('#sculpture-form'),sculptureInput=$('#sculpture-letters');
sculptureInput?.addEventListener('invalid',()=>sculptureInput.setCustomValidity(COPY[locale].status.sculptureInvalid));
sculptureInput?.addEventListener('input',()=>{
 sculptureInput.setCustomValidity('');
 sculptureInput.value=sculptureInput.value.toUpperCase().replace(/[^A-Z]/g,'').slice(0,3);
});
sculptureForm?.addEventListener('submit',e=>{
 e.preventDefault();
 if(sculptureBusy||inGarden||transition)return;
 requestSculpture(sculptureInput.value);
});
function exportSculpture(kind){
 if(sculptureBusy||inGarden||transition||!canExportSculpture(sculpture))return;
 try{
  if(kind==='stl')downloadSculptureSTL(sculpture,currentLetters);
  else downloadSculptureOBJ(sculpture,currentLetters);
  announce('sculptureExportReady',currentLetters);
 }catch(error){
  console.warn('Sculpture export failed',error);
  announce('sculptureExportFailed');
 }
}
$('#sculpture-download-stl')?.addEventListener('click',()=>exportSculpture('stl'));
$('#sculpture-download-obj')?.addEventListener('click',()=>exportSculpture('obj'));

applyLocale();init();
