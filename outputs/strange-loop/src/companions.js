import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { DRACOLoader } from 'three/addons/loaders/DRACOLoader.js';

// Blender-authored rigs and baked clips. World routes remain editable here.
const specifications = [
  {id:'achilles',scale:.6,from:[2.25,-3.05],to:[1.45,-2.85],duration:2.6,height:1.5},
  {id:'tortoise',scale:.46,from:[3.6,-2.8],to:[2.6,-2.7],duration:4.8,height:.34},
];

export async function loadCompanions(scene, reduced, onProject) {
  const loader=new GLTFLoader(),draco=new DRACOLoader(),actors=[];
  draco.setDecoderPath('assets/draco/');
  loader.setDRACOLoader(draco);
  const loaded=await Promise.all(specifications.map(spec=>loader.loadAsync(`assets/characters/${spec.id}.glb?v=draco1`)));
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
    actors.push({...spec,root,mixer,actions,age:0,clipAge:0,current:null,walking:!reduced.matches,
      target:new THREE.Vector3(0,.1,0),from:new THREE.Vector3(spec.from[0],-3.8,spec.from[1]),to:new THREE.Vector3(spec.to[0],-3.8,spec.to[1])});
  }
  function play(actor,name){
    if(actor.current===name)return;
    const action=actor.actions[name];if(!action)return;
    actor.actions[actor.current]?.fadeOut(.2);
    const looping=name==='Walk'||name==='Idle';
    action.reset().setLoop(looping?THREE.LoopRepeat:THREE.LoopOnce,looping?Infinity:1);
    action.clampWhenFinished=!looping;action.fadeIn(.35).play();actor.current=name;actor.clipAge=0;
  }
  for(const actor of actors){
    actor.root.position.copy(reduced.matches?actor.to:actor.from);
    play(actor,reduced.matches?'Idle':'Walk');
    if(reduced.matches)actor.mixer.update(0);
  }
  const projected=new THREE.Vector3(),aim=new THREE.Vector3(),rotation=new THREE.Quaternion(),yAxis=new THREE.Vector3(0,1,0);
  let showing=true;
  return {
    setSpace(space){
      for(const [index,actor] of actors.entries()){
        actor.from.copy(actor.root.position);
        const destination=space==='garden' ? (index===0?[3.8,-.2]:[4.5,-.4]) : specifications[index].to;
        actor.to.set(destination[0],-3.8,destination[1]);
        actor.age=0;actor.walking=!reduced.matches;
        actor.target.set(space==='garden'?1.9:0,space==='garden'?-3:.1,0);
        if(reduced.matches)actor.root.position.copy(actor.to);
        play(actor,reduced.matches?'Idle':'Walk');
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
          const t=Math.min(1,actor.age/actor.duration);
          actor.root.position.lerpVectors(actor.from,actor.to,t);
          aim.subVectors(actor.to,actor.from);changed=true;
          if(t>=1){actor.walking=false;play(actor,'Look');}
        }
        if(!actor.walking)aim.subVectors(actor.target,actor.root.position);
        rotation.setFromAxisAngle(yAxis,Math.atan2(aim.x,aim.z));
        actor.root.quaternion.slerp(rotation,reduced.matches?1:1-Math.exp(-dt*3));
        if(!reduced.matches){
          actor.mixer.update(dt);
          if(actor.current==='Idle'||actor.clipAge<(actor.actions[actor.current]?.getClip().duration??0))changed=true;
          if(actor.current==='Look'&&actor.clipAge>=(actor.actions.Look?.getClip().duration??2))play(actor,'Idle');
        }
        projected.copy(actor.root.position);projected.y+=actor.height*.55;projected.project(camera);
        const inFrame=Math.abs(projected.x)<.94&&Math.abs(projected.y)<.92&&projected.z<1;
        onProject(actor.id,inFrame?{x:(projected.x+1)*innerWidth/2,y:(1-projected.y)*innerHeight/2}:null);
      }
      return changed;
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
