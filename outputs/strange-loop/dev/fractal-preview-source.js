import * as THREE from 'three';
import {vertexShader,fragmentShader} from './fractal-shader.js';
import {smooth,sampleJourney,previewResolution,PORTAL_Z,INTERIOR_SCALE,CRUISE_SPEED,END_INTERIOR_Z,createTravelFrame,advanceTravel,cruiseCamera,entryEase} from './fractal-journey.js';

const $=id=>document.getElementById(id),canvas=$('space');
const reduced=matchMedia('(prefers-reduced-motion: reduce)');
const copy={
  zh:{study:'空间试验 / 01',eyebrow:'另一种尺度',title1:'里面，',title2:'比外面更大。',subtitle:'穿过孔洞，继续向内。',journey:'查看入口过渡，进入内部后可继续漫游',outside:'外部',inside:'内部',hint:'拖动环视 · 滚动探索',prototype:'本地空间原型',loading:'正在构建空间…',error:'这个浏览器暂时无法显示分形空间。请尝试刷新，或返回展厅。',enter:'走进孔洞',roam:'继续漫游',step:'向前一步',restart:'回到入口',pause:'暂停行进',resume:'继续向内',resumeBack:'继续返回',approach:'正在靠近孔洞',threshold:'穿过尺度的边界',beyond:'持续向内 · 结构没有终点',ready:'立方体外',stage:'可穿入的分形立方体',back:'返回怪圈展厅'},
  en:{study:'SPATIAL STUDY / 01',eyebrow:'A DIFFERENT SCALE',title1:'Larger',title2:'on the inside.',subtitle:'Through the opening. Further inward.',journey:'Explore the entrance; continue roaming once inside',outside:'Outside',inside:'Within',hint:'Drag to look · Scroll to explore',prototype:'Local spatial prototype',loading:'Building the space…',error:'This browser could not render the fractal space. Reload, or return to the exhibition.',enter:'Enter the opening',roam:'Continue roaming',step:'Step forward',restart:'Back to the entrance',pause:'Pause the journey',resume:'Continue inward',resumeBack:'Continue back',approach:'Approaching the opening',threshold:'Crossing between scales',beyond:'Further inward · The structure continues',ready:'Outside the cube',stage:'A fractal cube you can enter',back:'Return to Strange Loops'},
};
let lang=new URL(location.href).searchParams.get('lang')==='en'?'en':'zh';
let renderer,material,geometry,scene,camera,raf,failed=false,loaded=false;
let progress=0,moving=false,leg=null,cruise=null,cruiseSpeed=0,yaw=0,pitch=0,drag=null,dirty=true,last=0,quality=1,slowFrames=0,frames=0;
const worldUp=new THREE.Vector3(0,1,0),interiorOrigin=new THREE.Vector3(),curveForward=new THREE.Vector3(),origin=new THREE.Vector3(),forward=new THREE.Vector3(),right=new THREE.Vector3(),up=new THREE.Vector3();
const uniforms={uResolution:{value:new THREE.Vector2(1,1)},uAspect:{value:1},uFocus:{value:.64},uFocal:{value:1.35},uOrigin:{value:origin},uForward:{value:forward},uRight:{value:right},uUp:{value:up},uInteriorOrigin:{value:interiorOrigin},uCellPhase:{value:new THREE.Vector3()},uBendPhase:{value:new THREE.Vector2()},uSteps:{value:128},uDetail:{value:4}};

function sync(){
  const t=copy[lang];
  $('travel-label').textContent=moving?t.pause:progress===0?t.enter:progress===1?(reduced.matches?t.step:t.roam):t.resume;
  $('travel-arrow').textContent=moving?'Ⅱ':'→';
  $('return').hidden=progress===0;
  $('journey').value=String(progress);
  const key=progress<.02?'ready':progress<.36?'approach':progress<.53?'threshold':'beyond';
  if($('location').textContent!==t[key])$('location').textContent=t[key];
  document.documentElement.style.setProperty('--intro',String(1-smooth(.23,.44,progress)));
  document.documentElement.style.setProperty('--wash',String(1-.5*smooth(.28,.53,progress)));
}
function translate(){
  const t=copy[lang];document.documentElement.lang=lang==='zh'?'zh-CN':'en';
  document.title=`Strange Loops · ${lang==='zh'?'分形空间试验':'Fractal space study'}`;
  for(const element of document.querySelectorAll('[data-copy]'))element.textContent=t[element.dataset.copy];
  $('language').textContent=lang==='zh'?'EN':'中文';canvas.setAttribute('aria-label',t.stage);
  document.querySelector('.brand').setAttribute('aria-label',t.back);
  $('status').textContent=t[failed?'error':'loading'];sync();
}
function fail(error){
  failed=true;moving=false;loaded=false;
  $('travel').disabled=$('journey').disabled=true;
  $('status').hidden=false;$('status').textContent=copy[lang].error;
  if(error)console.error(error);
}
function resize(){
  if(!renderer)return;
  const w=innerWidth,h=innerHeight,r=previewResolution(w,h,devicePixelRatio,quality);
  renderer.setSize(r.width,r.height,false);uniforms.uResolution.value.set(r.width,r.height);
  uniforms.uAspect.value=w/h;uniforms.uFocus.value=w<=760?.43:.64;
  uniforms.uSteps.value=w<=760?100:136;uniforms.uDetail.value=w<=760?3:4;
  canvas.dataset.resolution=`${r.width}×${r.height}`;canvas.dataset.steps=String(uniforms.uSteps.value);canvas.dataset.detail=String(uniforms.uDetail.value);dirty=true;
}
function seek(value){
  progress=Math.max(0,Math.min(1,value));moving=false;leg=null;cruiseSpeed=0;
  cruise=progress===1?createTravelFrame(END_INTERIOR_Z):null;
  dirty=true;sync();
}
function resetEntrance(){
  yaw=0;pitch=0;seek(0);$('travel').focus({preventScroll:true});
}
function moveManually(distance){
  if(progress===1){
    cruise ||= createTravelFrame(END_INTERIOR_Z);moving=false;leg=null;cruiseSpeed=0;
    advanceTravel(cruise,distance);dirty=true;sync();
  }else seek(progress+distance/112);
}
function startTravel(){
  drag=null;
  if(reduced.matches){if(progress===1)moveManually(4);else seek(1);return;}
  if(progress===1){cruise ||= createTravelFrame(END_INTERIOR_Z);cruiseSpeed=0;leg=null;}
  else leg={from:progress,age:0,duration:Math.max(1.2,(1-progress)*14)};
  moving=true;last=performance.now();dirty=true;sync();
}
$('travel').addEventListener('click',()=>{
  if(moving){moving=false;cruiseSpeed=0;sync();return;}
  startTravel();
});
$('return').addEventListener('click',resetEntrance);
$('journey').addEventListener('input',event=>seek(Number(event.target.value)));
$('language').addEventListener('click',()=>{
  lang=lang==='zh'?'en':'zh';const url=new URL(location.href);url.searchParams.set('lang',lang);history.replaceState(null,'',url);translate();
});
canvas.addEventListener('pointerdown',event=>{
  drag={x:event.clientX,y:event.clientY};canvas.setPointerCapture(event.pointerId);canvas.focus({preventScroll:true});
});
canvas.addEventListener('pointermove',event=>{
  if(!drag)return;
  yaw=THREE.MathUtils.clamp(yaw-(event.clientX-drag.x)*.002,-.48,.48);
  pitch=THREE.MathUtils.clamp(pitch+(event.clientY-drag.y)*.002,-.3,.3);
  drag={x:event.clientX,y:event.clientY};dirty=true;
});
for(const name of ['pointerup','pointercancel','lostpointercapture'])canvas.addEventListener(name,()=>{drag=null;});
canvas.addEventListener('wheel',event=>{if(!loaded)return;event.preventDefault();moveManually(event.deltaY*.04);},{passive:false});
document.addEventListener('keydown',event=>{
  if(event.key==='Escape'&&loaded){resetEntrance();return;}
  if(event.target!==canvas)return;
  if(event.code==='Space'){event.preventDefault();$('travel').click();}
  if(event.key==='ArrowUp'||event.key==='ArrowDown'){event.preventDefault();moveManually(event.key==='ArrowUp'?2.4:-2.4);}
});
document.addEventListener('visibilitychange',()=>{last=performance.now();dirty=true;});
reduced.addEventListener('change',()=>{if(reduced.matches)moving=false;sync();});
canvas.addEventListener('webglcontextlost',event=>{event.preventDefault();fail();});
canvas.addEventListener('webglcontextrestored',()=>location.reload());

function draw(){
  const sample=sampleJourney(progress);origin.fromArray(sample.position);
  const mobile=innerWidth<=760;
  uniforms.uFocal.value=THREE.MathUtils.lerp(mobile?.8:1.35,mobile?.8:1,smooth(.47,.8,progress));
  forward.fromArray(sample.target).sub(origin).normalize();
  if(sample.inside){
    const worldZ=(sample.position[2]-PORTAL_Z)*INTERIOR_SCALE;
    const frame=cruise||createTravelFrame(worldZ),insideCamera=cruiseCamera(frame);
    interiorOrigin.fromArray(insideCamera.position);
    uniforms.uCellPhase.value.set(frame.angle,frame.spin,frame.scale);
    uniforms.uBendPhase.value.set(frame.bendX,frame.bendY);
    curveForward.fromArray(insideCamera.forward);
    forward.lerp(curveForward,cruise?1:smooth(0,12,-worldZ)).normalize();
    canvas.dataset.rebases=String(frame.wraps);
  }else{
    uniforms.uCellPhase.value.set(0,0,0);uniforms.uBendPhase.value.set(0,0);
    canvas.dataset.rebases='0';
  }
  const y=Math.atan2(forward.x,-forward.z)+yaw,p=Math.asin(forward.y)+pitch;
  forward.set(Math.sin(y)*Math.cos(p),Math.sin(p),-Math.cos(y)*Math.cos(p));
  right.crossVectors(forward,worldUp).normalize();up.crossVectors(right,forward).normalize();
  renderer.render(scene,camera);canvas.dataset.region=sample.inside?'inside':'outside';
  canvas.dataset.frames=String(++frames);
}
const intervals=new Float32Array(180);let sampleIndex=0,sampleCount=0,measureFrames=0;
function measureFrame(ms){
  if(ms<1)return;
  intervals[sampleIndex++%intervals.length]=ms;sampleCount=Math.min(intervals.length,sampleCount+1);
  if(++measureFrames%120)return;
  const values=Array.from(intervals.subarray(0,sampleCount)).sort((a,b)=>a-b);
  const average=values.reduce((a,b)=>a+b,0)/values.length;
  canvas.dataset.fps=(1000/average).toFixed(1);
  canvas.dataset.frame95=values[Math.floor((values.length-1)*.95)].toFixed(1);
  canvas.dataset.resources=`geometry:${renderer.info.memory.geometries},textures:${renderer.info.memory.textures},programs:${renderer.info.programs.length}`;
}
function tick(now){
  raf=requestAnimationFrame(tick);
  if(failed||document.hidden){last=now;return;}
  const raw=Math.max(0,now-last),dt=Math.min(.1,raw/1000);last=now;
  if(moving){
    if(cruise){
      cruiseSpeed+=(CRUISE_SPEED-cruiseSpeed)*(1-Math.exp(-dt*2));
      advanceTravel(cruise,cruiseSpeed*dt);
    }else{
      leg.age+=dt;const t=Math.min(1,leg.age/leg.duration);
      progress=THREE.MathUtils.lerp(leg.from,1,entryEase(t));
      if(t===1){
        progress=1;cruise=createTravelFrame(END_INTERIOR_Z);
        cruiseSpeed=Math.min(CRUISE_SPEED,(1-leg.from)*112*.75/leg.duration);leg=null;
      }
    }
    dirty=true;sync();measureFrame(raw);
    // Cost depends on the fixed view budget, never on distance travelled.
    if(raw>52)slowFrames++;else slowFrames=Math.max(0,slowFrames-1);
    if(slowFrames>45&&quality>.63){quality=Math.max(.62,quality*.86);slowFrames=0;resize();}
  }
  if(dirty){draw();dirty=false;}
}
function init(){
  translate();
  try{
    renderer=new THREE.WebGLRenderer({canvas,antialias:false,alpha:false,powerPreference:'high-performance'});
    renderer.setPixelRatio(1);renderer.debug.onShaderError=(gl,program)=>fail(new Error(gl.getProgramInfoLog(program)||'Fractal shader compilation failed'));
    geometry=new THREE.BufferGeometry();geometry.setAttribute('position',new THREE.Float32BufferAttribute([-1,-1,0,3,-1,0,-1,3,0],3));
    material=new THREE.RawShaderMaterial({glslVersion:THREE.GLSL3,vertexShader,fragmentShader,uniforms,depthTest:false,depthWrite:false});
    const plane=new THREE.Mesh(geometry,material);plane.frustumCulled=false;
    scene=new THREE.Scene();scene.add(plane);camera=new THREE.Camera();
    resize();renderer.compile(scene,camera);draw();
    if(failed)return;
    loaded=true;$('travel').disabled=$('journey').disabled=false;$('status').hidden=true;
    addEventListener('resize',resize);last=performance.now();raf=requestAnimationFrame(tick);
  }catch(error){fail(error);}
}
addEventListener('pagehide',event=>{if(!event.persisted){cancelAnimationFrame(raf);geometry?.dispose();material?.dispose();renderer?.dispose();}});
init();
