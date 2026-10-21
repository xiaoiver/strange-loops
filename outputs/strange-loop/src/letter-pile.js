import * as THREE from 'three';
import { TextGeometry } from 'three/addons/geometries/TextGeometry.js';
import { glyphCollider } from './letter-pile-geometry.js';
import { PILE_COUNT, PILE_LETTERS } from './letter-pile-config.js';
import { pileArrival } from './letter-pile-arrival.js';
import rest from './letter-pile-rest.json' with {type:'json'};

export function createLetterPile(parent,font,reduced){
  const definitions=[...PILE_LETTERS].map(ch=>glyphCollider(font,ch));
  const dummy=new THREE.Object3D(),target=new THREE.Vector3(),rotation=new THREE.Quaternion();
  const current=new Float32Array(PILE_COUNT*7);current.fill(NaN);
  const meshes=definitions.map((definition,index)=>{
    const {letter,size,depth,center}=definition;
    const geometry=new TextGeometry(letter,{font,size,depth,curveSegments:5,bevelEnabled:true,bevelThickness:.006,bevelSize:.005,bevelSegments:1});
    geometry.translate(-center.x,-center.y,-depth/2);
    const material=new THREE.MeshStandardMaterial({color:[0x555956,0x777975,0x414542,0x646762][index%4],roughness:.84});
    const mesh=new THREE.InstancedMesh(geometry,material,Math.ceil((PILE_COUNT-index)/definitions.length));
    mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);mesh.castShadow=mesh.receiveShadow=true;mesh.frustumCulled=false;
    dummy.scale.setScalar(0);dummy.updateMatrix();
    for(let i=0;i<mesh.count;i++)mesh.setMatrixAt(i,dummy.matrix);
    parent.add(mesh);return mesh;
  });
  let worker=null,transforms=null,finished=false,dirty=false,presence=0,active=false,started=false,watchdog,revision=0,lastNudge=-Infinity;
  function resetArrival(){
    clearTimeout(watchdog);worker?.terminate();worker=null;active=false;started=false;finished=false;
    current.fill(NaN);transforms=pileArrival(rest);dirty=true;revision=0;lastNudge=-Infinity;
  }
  function useRest(){
    clearTimeout(watchdog);worker?.terminate();worker=null;active=false;started=true;
    transforms=new Float32Array(rest);finished=true;dirty=true;
  }
  function sync(){
    if(reduced.matches){if(!finished)useRest();return;}
    const shouldRun=presence>.98&&!document.hidden&&!finished;
    if(shouldRun&&!started){
      started=true;
      try{
        worker=new Worker(new URL('assets/letter-pile-worker.js?v=3',document.baseURI));
        const instance=worker;
        worker.onmessage=({data})=>{
          if(worker!==instance||(data.revision??0)!==revision)return;
          clearTimeout(watchdog);transforms=data.transforms;finished=data.finished;dirty=true;
          // The sleeping world uses no simulation timer and can be nudged again.
          if(finished){active=false;worker.postMessage({type:'active',value:false});}
        };
        worker.onerror=()=>{if(worker===instance)useRest();};
        worker.postMessage({type:'init',definitions,initialTransforms:transforms});
        watchdog=setTimeout(useRest,10000);
      }catch{useRest();}
    }
    if(worker&&active!==shouldRun){active=shouldRun;worker.postMessage({type:'active',value:active});}
  }
  document.addEventListener('visibilitychange',sync);
  reduced.addEventListener('change',sync);
  return {
    setPresence(value){if(value>0&&presence===0)resetArrival();presence=value;sync();},
    pick(raycaster){
      if(presence<.99||reduced.matches||document.hidden||!worker)return null;
      parent.updateWorldMatrix(true,true);
      const hit=raycaster.intersectObjects(meshes,false)[0];
      return hit?hit.instanceId*meshes.length+meshes.indexOf(hit.object):null;
    },
    nudge(index){
      const now=performance.now();
      if(presence<.99||reduced.matches||document.hidden||!worker||now-lastNudge<1200||!Number.isInteger(index)||index<0||index>=PILE_COUNT)return false;
      lastNudge=now;finished=false;revision++;
      worker.postMessage({type:'nudge',index,revision});sync();
      clearTimeout(watchdog);watchdog=setTimeout(useRest,10000);
      return true;
    },
    update(dt){
      if(!transforms||!dirty||presence<=0)return false;
      let moving=false;
      const blend=finished?1:1-Math.exp(-30*dt);
      for(let i=0;i<PILE_COUNT;i++){
        const offset=i*7;if(!Number.isFinite(transforms[offset]))continue;
        target.fromArray(transforms,offset);rotation.fromArray(transforms,offset+3).normalize();
        if(Number.isFinite(current[offset])){
          dummy.position.fromArray(current,offset).lerp(target,blend);
          dummy.quaternion.fromArray(current,offset+3).normalize().slerp(rotation,blend);
        }else{dummy.position.copy(target);dummy.quaternion.copy(rotation);}
        moving||=dummy.position.distanceToSquared(target)>1e-8||dummy.quaternion.angleTo(rotation)>1e-4;
        dummy.position.toArray(current,offset);dummy.quaternion.toArray(current,offset+3);
        dummy.scale.setScalar(1);dummy.updateMatrix();
        meshes[i%meshes.length].setMatrixAt(Math.floor(i/meshes.length),dummy.matrix);
      }
      meshes.forEach(mesh=>{mesh.instanceMatrix.needsUpdate=true;mesh.boundingSphere=null;});
      dirty=!finished&&moving;return true;
    },
  };
}
