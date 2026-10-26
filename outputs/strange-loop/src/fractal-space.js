import * as THREE from 'three';
import {Pass,FullScreenQuad} from 'three/addons/postprocessing/Pass.js';
import {vertexShader,fragmentShader} from './fractal-shader.js';
import {PORTAL_Z,INTERIOR_SCALE,previewResolution,createTravelFrame,cruiseCamera} from './fractal-journey.js';

const AXIS_Y=new THREE.Vector3(0,1,0);
export function createFractalUniforms(){
  return {uResolution:{value:new THREE.Vector2(1,1)},uAspect:{value:1},uFocus:{value:.62},uFocal:{value:1},uOrigin:{value:new THREE.Vector3(0,0,8)},uForward:{value:new THREE.Vector3(0,0,-1)},uRight:{value:new THREE.Vector3(1,0,0)},uUp:{value:new THREE.Vector3(0,1,0)},uInteriorOrigin:{value:new THREE.Vector3()},uCellPhase:{value:new THREE.Vector3()},uBendPhase:{value:new THREE.Vector2()},uSteps:{value:136},uDetail:{value:4},uLinearOutput:{value:true},uPortalView:{value:false}};
}
const shaderMaterial=uniforms=>new THREE.RawShaderMaterial({glslVersion:THREE.GLSL3,vertexShader,fragmentShader,uniforms,toneMapped:false,depthTest:false,depthWrite:false});

// One renderer/context; the expensive field renders into a bounded target.
// The normal OutputPass and FXAA handle the shared final display transform.
export class FractalSpacePass extends Pass{
  constructor(){
    super();this.enabled=false;this.uniforms=createFractalUniforms();this.dirty=true;this.quality=1;this.slow=0;this.last=0;this.renderCount=0;this.frameMs=0;this.ready=false;this.disposed=false;this.warming=null;this.sceneViewport=new THREE.Vector2(1,1);
    this.target=new THREE.WebGLRenderTarget(1,1,{type:THREE.HalfFloatType,depthBuffer:false});
    this.material=shaderMaterial(this.uniforms);this.quad=new FullScreenQuad(this.material);
    this.copy=new FullScreenQuad(new THREE.RawShaderMaterial({glslVersion:THREE.GLSL3,toneMapped:false,depthTest:false,depthWrite:false,uniforms:{image:{value:this.target.texture}},vertexShader:`precision highp float;in vec3 position;out vec2 uv;void main(){uv=position.xy*.5+.5;gl_Position=vec4(position.xy,0.,1.);}`,fragmentShader:`precision highp float;in vec2 uv;out vec4 color;uniform sampler2D image;void main(){color=texture(image,uv);}`}));
  }
  setSize(width=innerWidth,height=innerHeight){
    this.sceneViewport.set(width,height);
    const r=previewResolution(innerWidth,innerHeight,devicePixelRatio,this.quality);
    if(this.target.width!==r.width||this.target.height!==r.height)this.target.setSize(r.width,r.height);
    this.uniforms.uResolution.value.set(r.width,r.height);
    this.uniforms.uSteps.value=innerWidth<=760?100:136;this.uniforms.uDetail.value=innerWidth<=760?3:4;this.dirty=true;
  }
  renderField(renderer){
    const now=performance.now(),interval=now-this.last;this.last=now;
    if(interval>1&&interval<250)this.frameMs=this.frameMs?this.frameMs*.95+interval*.05:interval;
    if(this.dirty){
      if(interval>52&&interval<250)this.slow++;else this.slow=Math.max(0,this.slow-1);
      if(this.slow>12&&this.quality>.63){this.quality=Math.max(.62,this.quality*.86);this.slow=0;this.setSize();}
      renderer.setRenderTarget(this.target);this.quad.render(renderer);this.dirty=false;this.renderCount++;
    }
  }
  render(renderer,writeBuffer){
    this.renderField(renderer);
    renderer.setRenderTarget(this.renderToScreen?null:writeBuffer);this.copy.render(renderer);
  }
  warm(renderer,portalMaterial){
    if(this.warming)return this.warming;
    // Compile the SAME field program used on both sides of the opening while
    // initial assets load, instead of linking a second program at the crossing.
    const warmScene=new THREE.Scene(),warmCamera=new THREE.Camera(),geometry=new THREE.PlaneGeometry(2,2);
    for(const material of [this.material,this.copy.material,portalMaterial])warmScene.add(new THREE.Mesh(geometry,material));
    this.warming=renderer.compileAsync(warmScene,warmCamera).then(()=>{
      if(!this.disposed){renderer.initRenderTarget(this.target);this.ready=true;}
    }).finally(()=>geometry.dispose());
    return this.warming;
  }
  dispose(){this.disposed=true;this.target.dispose();this.material.dispose();this.quad.dispose();this.copy.material.dispose();this.copy.dispose();}
}

export function createFractalSpace(parent){
  const pass=new FractalSpacePass(),uniforms=pass.uniforms;
  const material=new THREE.RawShaderMaterial({glslVersion:THREE.GLSL3,toneMapped:false,
    uniforms:{image:{value:pass.target.texture},viewport:{value:new THREE.Vector2(1,1)}},
    vertexShader:'precision highp float;in vec3 position;uniform mat4 modelViewMatrix;uniform mat4 projectionMatrix;void main(){gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}',
    fragmentShader:'precision highp float;out vec4 color;uniform sampler2D image;uniform vec2 viewport;void main(){color=texture(image,gl_FragCoord.xy/viewport);}'
  }),geometry=new THREE.PlaneGeometry(.998,.998);
  const opening=new THREE.Mesh(geometry,material);opening.name='fractal-opening';opening.visible=false;
  // Parent geometry is 14 units wide; the shared analytic cube is 3 units wide.
  const metric=14/3;opening.scale.setScalar(metric);opening.position.z=PORTAL_Z*metric;parent.add(opening);
  const inverse=new THREE.Matrix4(),rotation=new THREE.Quaternion(),position=new THREE.Vector3(),forward=new THREE.Vector3(),right=new THREE.Vector3(),up=new THREE.Vector3();
  function localPoint(point){return parent.worldToLocal(point.clone()).multiplyScalar(3/14);}
  function worldPoint(point){return parent.localToWorld(point.clone().multiplyScalar(metric));}
  function cameraAt(camera,look,normalizedPosition,normalizedTarget){
    camera.position.copy(worldPoint(new THREE.Vector3(...normalizedPosition)));
    look.copy(worldPoint(new THREE.Vector3(...normalizedTarget)));camera.up.set(0,1,0);camera.lookAt(look);
  }
  function sync(camera,frame,yaw=0,pitch=0,inside=false){
    parent.updateWorldMatrix(true,false);inverse.copy(parent.matrixWorld).invert();
    position.copy(camera.position).applyMatrix4(inverse).multiplyScalar(3/14);
    parent.getWorldQuaternion(rotation).invert();camera.getWorldDirection(forward).applyQuaternion(rotation).normalize();
    if(inside){
      const heading=Math.atan2(forward.x,-forward.z)+yaw,tilt=Math.asin(forward.y)+pitch;
      forward.set(Math.sin(heading)*Math.cos(tilt),Math.sin(tilt),-Math.cos(heading)*Math.cos(tilt));
    }
    right.crossVectors(forward,AXIS_Y).normalize();up.crossVectors(right,forward).normalize();
    const cell=frame||createTravelFrame(inside?(position.z-PORTAL_Z)*INTERIOR_SCALE:0),at=cruiseCamera(cell);
    const u=uniforms,focus=.5-(camera.view?.enabled?camera.view.offsetX/camera.view.fullWidth:0),focal=.5/Math.tan(THREE.MathUtils.degToRad(camera.fov*.5));
    // CPU camera movement, not character idle poses, invalidates the portal.
    const gate=inside?0:position.z;
    const changed=u.uOrigin.value.x!==position.x||u.uOrigin.value.y!==position.y||u.uOrigin.value.z!==gate||!u.uForward.value.equals(forward)||u.uAspect.value!==camera.aspect||u.uFocus.value!==focus||u.uFocal.value!==focal||u.uInteriorOrigin.value.z!==at.position[2]||u.uCellPhase.value.x!==cell.angle||u.uCellPhase.value.y!==cell.spin||u.uCellPhase.value.z!==cell.scale;
    u.uOrigin.value.set(position.x,position.y,gate);u.uForward.value.copy(forward);u.uRight.value.copy(right);u.uUp.value.copy(up);
    u.uAspect.value=camera.aspect;u.uFocus.value=focus;u.uFocal.value=focal;
    u.uInteriorOrigin.value.fromArray(at.position);u.uCellPhase.value.set(cell.angle,cell.spin,cell.scale);u.uBendPhase.value.set(cell.bendX,cell.bendY);
    u.uPortalView.value=!inside;pass.dirty ||= changed;
  }
  function preparePortal(renderer){
    if(!pass.ready||pass.enabled)return;
    const previous=renderer.getRenderTarget();
    pass.renderField(renderer);renderer.setRenderTarget(previous);
    material.uniforms.viewport.value.copy(pass.sceneViewport);
    opening.visible=true;
  }
  return {pass,opening,localPoint,worldPoint,cameraAt,sync,preparePortal,warm:renderer=>pass.warm(renderer,material),
    dispose(){parent.remove(opening);geometry.dispose();material.dispose();pass.dispose();},
  };
}
