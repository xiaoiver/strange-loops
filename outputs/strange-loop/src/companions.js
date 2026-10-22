import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { DRACOLoader } from 'three/addons/loaders/DRACOLoader.js';
import { exitRoute, entryRoute, routeSample, contourRoute, labyrinthStop } from './chapter-passage.js';
import { playCompanionAnimation as play } from './companion-animation.js';
import { walkProgress, syncLocomotionToDistance } from './companion-locomotion.js';

// Blender-authored rigs and baked clips. World routes remain editable here.
const specifications = [
  {id:'achilles',scale:.6,from:[2.25,-3.05],to:[1.45,-2.85],duration:2.6,height:1.5},
  {id:'tortoise',scale:.46,from:[3.6,-2.8],to:[2.6,-2.7],duration:4.8,height:.34},
];

export async function loadCompanions(scene, reduced, onProject) {
  const loader=new GLTFLoader(),draco=new DRACOLoader(),actors=[];
  draco.setDecoderPath('assets/draco/');
  loader.setDRACOLoader(draco);
  const loaded=await Promise.all(specifications.map(spec=>loader.loadAsync(`assets/characters/${spec.id}.glb?v=${spec.id==='tortoise'?'tripo2':'quaternius-jog-feet2'}`)));
  draco.dispose();
  for(const [index,spec] of specifications.entries()){
    const gltf=loaded[index];
    const root=new THREE.Group();root.name=`companion-${spec.id}`;
    root.add(gltf.scene);root.scale.setScalar(spec.scale);scene.add(root);
    const depth=new THREE.MeshDepthMaterial({depthPacking:THREE.RGBADepthPacking});
    const floorOnly={value:0};
    depth.onBeforeCompile=shader=>{
      shader.uniforms.uCompanionFloorOnly=floorOnly;
      shader.fragmentShader='uniform float uCompanionFloorOnly;\n'+shader.fragmentShader.replace('void main() {','void main() {\nif(uCompanionFloorOnly < .5) discard;');
    };
    depth.customProgramCacheKey=()=> 'companion-floor-only-v1';
    root.traverse(mesh=>{
      if(!mesh.isMesh)return;
      mesh.castShadow=true;mesh.receiveShadow=false;mesh.frustumCulled=false;
      mesh.customDepthMaterial=depth;
      // Preserve the three letter silhouettes; characters cast onto the floor light only.
      mesh.onBeforeShadow=(_renderer,_object,_camera,shadowCamera)=>{floorOnly.value=shadowCamera.name==='floor-shadow'?1:0;};
      for(const material of Array.isArray(mesh.material)?mesh.material:[mesh.material])material.color.multiplyScalar(.58);
    });
    const mixer=new THREE.AnimationMixer(gltf.scene),actions={};
    for(const clip of gltf.animations){
      const name=clip.name.split('_').at(-1);
      actions[name]=mixer.clipAction(clip);
    }
    let walkCycleDistance,jogCycleDistance;
    gltf.scene.traverse(node=>{
      if(Number.isFinite(node.userData.walk_cycle_distance))walkCycleDistance=node.userData.walk_cycle_distance*spec.scale;
      if(Number.isFinite(node.userData.jog_cycle_distance))jogCycleDistance=node.userData.jog_cycle_distance*spec.scale;
    });
    actors.push({...spec,root,mixer,actions,walkCycleDistance,jogCycleDistance,locomotion:'Walk',gaitRate:1,age:0,clipAge:0,current:null,walking:!reduced.matches,
      target:new THREE.Vector3(0,.1,0),from:new THREE.Vector3(spec.from[0],-3.8,spec.from[1]),to:new THREE.Vector3(spec.to[0],-3.8,spec.to[1])});
  }
  for(const actor of actors){
    actor.root.position.copy(reduced.matches?actor.to:actor.from);
    play(actor,reduced.matches?'Idle':'Walk');
    if(reduced.matches)actor.mixer.update(0);
  }
  const projected=new THREE.Vector3(),aim=new THREE.Vector3(),rotation=new THREE.Quaternion(),previousPosition=new THREE.Vector3(),yAxis=new THREE.Vector3(0,1,0);
  let showing=true, routeDone=null;
  function walkPassage(kind,onComplete,area='contour'){
    routeDone=onComplete;
    for(const [index,actor] of actors.entries()){
      actor.route=kind==='exit'?exitRoute([actor.root.position.x,actor.root.position.z],index):entryRoute(index,innerWidth<=760,area);
      actor.locomotion=actor.actions.Jog?'Jog':'Walk';
      const passageSpeed=index===0?2.5:2.0;
      actor.gaitRate=index===0?1:passageSpeed/.56;
      actor.duration=routeSample(actor.route,0).length/passageSpeed;
      actor.delay=index*.4;actor.age=0;actor.walking=true;
      actor.to.set(actor.route.at(-1)[0],-3.8,actor.route.at(-1)[1]);
      if(kind==='entry')actor.root.position.set(actor.route[0][0],-3.8,actor.route[0][1]);
      if(kind==='entry'&&area==='poster')actor.target.set(-6.69,-.4,3.6);
      else actor.target.set(kind==='entry'?0:-5,-.6,kind==='entry'?0:-1.3);
      play(actor,actor.delay?'Idle':actor.locomotion);
    }
  }
  return {
    crossContour(returning=false){
      routeDone=null;
      for(const [index,actor] of actors.entries()){
        actor.route=contourRoute([actor.root.position.x,actor.root.position.z],index,returning,innerWidth<=760);
        actor.from.copy(actor.root.position);actor.to.set(actor.route.at(-1)[0],-3.8,actor.route.at(-1)[1]);
        actor.locomotion='Walk';actor.gaitRate=1;actor.age=0;actor.delay=index*.6;
        actor.duration=routeSample(actor.route,0).length/(index===0?1.55:1.25);actor.walking=!reduced.matches;
        actor.target.set(0,returning?-.6:-2.7,returning?0:-10);
        actor.root.traverse(mesh=>{if(mesh.isMesh)mesh.receiveShadow=true;});
        if(reduced.matches)actor.root.position.copy(actor.to);
        play(actor,actor.walking?'Walk':'Idle');
      }
    },
    walkThroughExit(onComplete){walkPassage('exit',onComplete);},
    enterGallery(onComplete,area){walkPassage('entry',onComplete,area);},
    setSpace(space,{keepPosition=false,immediate=false}={}){
      routeDone=null;
      for(const [index,actor] of actors.entries()){
        actor.route=null;actor.delay=0;actor.locomotion='Walk';actor.gaitRate=1;actor.from.copy(actor.root.position);
        const destination=space==='labyrinth'?labyrinthStop(index):space==='figure-poster'?(index===0?[-4.9,5.2]:[-5.1,4.6]):space==='figure-contour'?(innerWidth<=760?(index===0?[-2.5,.9]:[-1.5,1.2]):(index===0?[-3,3.9]:[-1.9,4.3])):space==='garden' ? (index===0?[2.8,-1.95]:[3.6,-1.75]) : specifications[index].to;
        if(keepPosition)actor.to.copy(actor.root.position);
        else actor.to.set(destination[0],-3.8,destination[1]);
        // Cross a visible stretch of the shaded floor, at each companion's pace.
        actor.duration=Math.max(1.2,actor.from.distanceTo(actor.to)/(space.startsWith('figure-')?(index===0?.62:.52):(index===0?.45:.23)));
        // The garden's architecture shades the companions; keep lobby letter
        // projections off their surfaces when returning to the vestibule.
        actor.root.traverse(mesh=>{if(mesh.isMesh)mesh.receiveShadow=space!=='lobby';});
        actor.age=0;actor.walking=!reduced.matches&&!immediate&&!keepPosition&&actor.from.distanceToSquared(actor.to)>1e-8;
        if(space==='labyrinth')actor.target.set(0,-2.7,-10);
        else if(space==='figure-poster')actor.target.set(-6.69,-.4,3.6);
        else if(space.startsWith('figure-'))actor.target.set(0,-.6,0);
        else actor.target.set(space==='garden'?1.9:0,space==='garden'?-3:.1,0);
        if(reduced.matches||immediate)actor.root.position.copy(actor.to);
        play(actor,actor.walking?'Walk':'Idle');
      }
    },
    update(dt,camera,visible){
      showing=visible;let changed=false;
      for(const actor of actors){
        // Visibility changes invalidate cached shadows even when animation is paused.
        if(actor.root.visible!==visible)changed=true;
        actor.root.visible=visible;
        if(!visible){onProject(actor.id,null);continue;}
        actor.age+=dt;actor.clipAge+=dt;
        if(reduced.matches){
          if(actor.walking){actor.root.position.copy(actor.to);actor.walking=false;play(actor,'Idle');changed=true;}
        }else if(actor.walking){
          previousPosition.copy(actor.root.position);
          const t=THREE.MathUtils.clamp((actor.age-(actor.delay||0))/actor.duration,0,1);
          if(actor.route){
            const point=routeSample(actor.route,walkProgress(t));
            actor.root.position.set(point.x,-3.8,point.z);aim.set(point.dx,0,point.dz);
          }else{
            actor.root.position.lerpVectors(actor.from,actor.to,walkProgress(t));aim.subVectors(actor.to,actor.from);
          }
          const distance=actor.root.position.distanceTo(previousPosition);
          if(distance>1e-8&&actor.current!==actor.locomotion)play(actor,actor.locomotion);
          if(actor.current==='Walk'||actor.current==='Jog')syncLocomotionToDistance(actor,distance,dt);
          changed=true;
          if(t>=1){actor.walking=false;play(actor,'Idle');}
        }
        if(!actor.walking)aim.subVectors(actor.target,actor.root.position);
        rotation.setFromAxisAngle(yAxis,Math.atan2(aim.x,aim.z));
        actor.root.quaternion.slerp(rotation,reduced.matches?1:1-Math.exp(-dt*(actor.walking?8:3)));
        if(!reduced.matches){
          actor.mixer.update(dt);
          if(actor.current==='Idle'||actor.clipAge<(actor.actions[actor.current]?.getClip().duration??0))changed=true;
          if(actor.current==='Look'&&actor.clipAge>=(actor.actions.Look?.getClip().duration??2))play(actor,'Idle');
        }
        projected.copy(actor.root.position);projected.y+=actor.height*.55;projected.project(camera);
        const inFrame=Math.abs(projected.x)<.94&&Math.abs(projected.y)<.92&&projected.z<1;
        onProject(actor.id,inFrame?{x:(projected.x+1)*innerWidth/2,y:(1-projected.y)*innerHeight/2}:null);
      }
      if(routeDone&&actors.every(actor=>!actor.walking)){const done=routeDone;routeDone=null;done();}
      return changed;
    },
    observe(id){
      const actor=actors.find(a=>a.id===id);
      if(actor&&!actor.walking)play(actor,'Look');
    },
    react(view){
      const target={G:[0,-1,-3.7],E:[-3.7,-1,0],B:[0,-3.8,0],free:[0,.1,0]}[view];
      for(const actor of actors){actor.target.set(...target);if(!actor.walking)play(actor,'Look');}
    },
    meet(id,camera){
      if(!showing)return;
      const actor=actors.find(a=>a.id===id);if(!actor)return;
      actor.walking=false;actor.target.copy(camera.position);play(actor,'Look');
    },
  };
}
