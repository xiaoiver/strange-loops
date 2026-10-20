import * as THREE from 'three';

// Cosine-weighted sky visibility through the only opening in a closed passage.
// This bakes the missing architectural AO for the global environment lighting;
// direct light and its shadow map remain independent of this value.
export function openingVisibility(point, normal, samples=128) {
  const tangent=new THREE.Vector3().crossVectors(normal,Math.abs(normal.y)<.9?new THREE.Vector3(0,1,0):new THREE.Vector3(1,0,0)).normalize();
  const bitangent=new THREE.Vector3().crossVectors(normal,tangent);
  const origin=point.clone().addScaledVector(normal,.001);
  let visible=0;
  for(let i=0;i<samples;i++){
    const u=(i+.5)/samples, radius=Math.sqrt(u), angle=i*2.399963229728653;
    const tx=radius*Math.cos(angle), ty=radius*Math.sin(angle), nz=Math.sqrt(1-u);
    const x=tangent.x*tx+bitangent.x*ty+normal.x*nz;
    const y=tangent.y*tx+bitangent.y*ty+normal.y*nz;
    const z=tangent.z*tx+bitangent.z*ty+normal.z*nz;
    if(z<=0)continue;
    const distance=-origin.z/z;
    if(distance<0)continue;
    const hitX=origin.x+x*distance, hitY=origin.y+y*distance;
    if(Math.abs(hitX)<.95&&hitY>-3.8&&hitY<.15)visible++;
  }
  return visible/samples;
}

export function passageGeometry(w,h,d,x,y,z) {
  const geometry=new THREE.BoxGeometry(w,h,d,w>.2?8:1,h>.2?8:1,20);
  const positions=geometry.getAttribute('position'), normals=geometry.getAttribute('normal');
  const values=new Float32Array(positions.count), point=new THREE.Vector3(), normal=new THREE.Vector3();
  for(let i=0;i<positions.count;i++){
    point.fromBufferAttribute(positions,i).add(new THREE.Vector3(x,y,z));
    normal.fromBufferAttribute(normals,i);
    // A small diffuse-bounce allowance keeps the unlit interior readable.
    values[i]=.08+.92*openingVisibility(point,normal);
  }
  geometry.setAttribute('passageOcclusion',new THREE.BufferAttribute(values,1));
  return geometry;
}

export function applyPassageOcclusion(material) {
  material.onBeforeCompile=shader=>{
    shader.vertexShader='attribute float passageOcclusion;\nvarying float vPassageOcclusion;\n'+shader.vertexShader;
    shader.vertexShader=shader.vertexShader.replace('#include <project_vertex>','#include <project_vertex>\nvPassageOcclusion = passageOcclusion;');
    shader.fragmentShader='varying float vPassageOcclusion;\n'+shader.fragmentShader;
    shader.fragmentShader=shader.fragmentShader.replace('#include <aomap_fragment>','#include <aomap_fragment>\nreflectedLight.indirectDiffuse *= vPassageOcclusion;\nreflectedLight.indirectSpecular *= vPassageOcclusion;');
  };
  material.customProgramCacheKey=()=> 'passage-occlusion-v1';
}
