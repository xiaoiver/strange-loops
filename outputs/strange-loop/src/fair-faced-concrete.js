import * as THREE from 'three';

// Fair-faced concrete for the shared exhibition shell.
// Full-scale rooms share one world-space board grid, locked to the lobby
// corner and floor so courses meet the ground. Miniature galleries keep the
// same 900×1800 mm module in their unscaled local coordinates.
// Tie holes sit in the field of each board, not on the joints.
const CONCRETE_CACHE_KEY = 'geb-ando-concrete-v1';

const CONCRETE_VARYINGS = /* glsl */`
varying vec3 vConcreteLocal;
varying vec3 vConcreteWorld;
varying vec3 vConcreteObjectNormal;
varying vec3 vConcreteWorldNormal;
varying float vConcreteScale;
`;

const CONCRETE_FUNCTIONS = /* glsl */`
float concreteHash(vec2 p) {
  vec3 p3 = fract(vec3(p.xyx) * 0.1031);
  p3 += dot(p3, p3.yzx + 33.33);
  return fract((p3.x + p3.y) * p3.z);
}

float concreteNoise(vec2 p) {
  vec2 i = floor(p);
  vec2 f = fract(p);
  f = f * f * (3.0 - 2.0 * f);
  float a = concreteHash(i);
  float b = concreteHash(i + vec2(1.0, 0.0));
  float c = concreteHash(i + vec2(0.0, 1.0));
  float d = concreteHash(i + vec2(1.0, 1.0));
  return mix(mix(a, b, f.x), mix(c, d, f.x), f.y);
}

float concretePeriod(float coord, float period) {
  float f = fract(coord / period);
  return min(f, 1.0 - f) * period;
}

// Albedo multiplier, roughness, and a local recess depth in metres.
void concreteSurface(out vec3 albedo, out float rough, out float recess) {
  // 1.8 m × 0.9 m plywood, long side horizontal: the quiet Ando course.
  const float BOARD_W = 1.8;
  const float BOARD_H = 0.9;
  const float JOINT = 0.014;
  const vec3 ORIGIN = vec3(-3.8, -3.8, -3.8);
  bool miniature = vConcreteScale < 0.5;
  vec3 p = miniature ? vConcreteLocal : (vConcreteWorld - ORIGIN);
  vec3 nFace = normalize(miniature ? vConcreteObjectNormal : vConcreteWorldNormal);
  vec3 nWorld = normalize(vConcreteWorldNormal);
  vec2 uv = abs(nFace.y) > 0.65 ? p.xz : (abs(nFace.x) > abs(nFace.z) ? p.zy : p.xy);
  bool floorFace = nWorld.y > 0.65;

  float cloud = concreteNoise(uv * 0.17);
  float blot = concreteNoise(uv * 0.85);
  float grainPx = max(fwidth(uv.x), 1e-4);
  float grainFade = clamp(0.0035 / grainPx, 0.0, 1.0);
  float grain = (concreteNoise(uv * 14.0) - 0.5) * grainFade;
  float tone = 0.972 + cloud * 0.034 + (blot - 0.5) * 0.02 + grain * 0.018;

  float seam = 0.0;
  float hole = 0.0;
  if (!floorFace) {
    float jointDist = min(concretePeriod(uv.x, BOARD_W), concretePeriod(uv.y, BOARD_H));
    float jointAa = max(JOINT, fwidth(jointDist) * 1.35);
    seam = 1.0 - smoothstep(0.0, jointAa, jointDist);
    float breath = 1.0 - smoothstep(0.0, 0.05, jointDist);
    tone *= mix(1.0, 0.955, breath * (1.0 - seam));
    tone *= mix(1.0, 0.90, seam);

    // One tie hole in the middle of each 0.9 m square, clear of the joints.
    vec2 rel = uv - vec2(0.45);
    vec2 cell = fract(rel / 0.9);
    vec2 delta = min(cell, 1.0 - cell) * 0.9;
    float holeDist = length(delta);
    float holeAa = fwidth(holeDist);
    hole = 1.0 - smoothstep(0.01, 0.032 + holeAa, holeDist);
    tone *= mix(1.0, 0.90, hole);
  }

  albedo = vec3(tone);
  rough = floorFace ? 0.86 : 0.93;
  rough = mix(rough, min(1.0, rough + 0.045), max(seam, hole * 0.55));
  recess = (cloud - 0.5) * (floorFace ? 0.0005 : 0.0011);
  if (!floorFace) recess -= seam * 0.0042 + hole * 0.0032;
}
`;

function replaceInclude(source, include, insertion) {
  const marker = `#include <${include}>`;
  if (!source.includes(marker)) throw new Error(`Missing shader include <${include}>`);
  return source.replace(marker, `${marker}\n${insertion}`);
}

export function installFairFacedConcrete(shader) {
  shader.vertexShader = replaceInclude(shader.vertexShader, 'common', CONCRETE_VARYINGS);
  shader.vertexShader = replaceInclude(shader.vertexShader, 'worldpos_vertex', /* glsl */`
vConcreteLocal = transformed;
vConcreteWorld = (modelMatrix * vec4(transformed, 1.0)).xyz;
vConcreteObjectNormal = normalize(objectNormal);
vConcreteWorldNormal = normalize(mat3(modelMatrix) * objectNormal);
vConcreteScale = length((modelMatrix * vec4(0.0, 1.0, 0.0, 0.0)).xyz);
`);
  shader.fragmentShader = replaceInclude(shader.fragmentShader, 'common', CONCRETE_VARYINGS + CONCRETE_FUNCTIONS);
  shader.fragmentShader = replaceInclude(shader.fragmentShader, 'color_fragment', /* glsl */`
vec3 concreteAlbedo;
float concreteRough;
float concreteRecess;
concreteSurface(concreteAlbedo, concreteRough, concreteRecess);
diffuseColor.rgb *= concreteAlbedo;
`);
  shader.fragmentShader = replaceInclude(shader.fragmentShader, 'roughnessmap_fragment', /* glsl */`
roughnessFactor = concreteRough;
`);
  shader.fragmentShader = replaceInclude(shader.fragmentShader, 'normal_fragment_begin', /* glsl */`
float concreteHeight = concreteRecess * (vConcreteScale < 0.5 ? vConcreteScale : 1.0);
vec3 concreteWorldNormal = normalize(vConcreteWorldNormal);
vec3 concreteDx = dFdx(vConcreteWorld);
vec3 concreteDy = dFdy(vConcreteWorld);
vec3 concreteFace = cross(concreteDx, concreteDy);
if (dot(concreteFace, concreteFace) < 1e-12) concreteFace = concreteWorldNormal;
else concreteFace = normalize(concreteFace);
if (dot(concreteFace, concreteWorldNormal) < 0.0) concreteFace = -concreteFace;
vec3 concretePerturbed = cross(concreteDx + concreteFace * dFdx(concreteHeight), concreteDy + concreteFace * dFdy(concreteHeight));
if (dot(concretePerturbed, concretePerturbed) < 1e-12) concretePerturbed = concreteFace;
else concretePerturbed = normalize(concretePerturbed);
if (dot(concretePerturbed, concreteFace) < 0.0) concretePerturbed = -concretePerturbed;
normal = normalize(mat3(viewMatrix) * concretePerturbed);
#ifdef DOUBLE_SIDED
normal *= gl_FrontFacing ? 1.0 : -1.0;
#endif
`);
}

export function createFairFacedConcrete() {
  const material = new THREE.MeshStandardMaterial({
    name: 'fair-faced-concrete',
    color: 0x8e918d,
    roughness: 0.93,
    metalness: 0,
    envMapIntensity: 0.42,
  });
  material.userData.fairFaced = true;
  material.onBeforeCompile = function (shader) {
    installFairFacedConcrete(shader);
  };
  material.customProgramCacheKey = () => CONCRETE_CACHE_KEY;
  return material;
}
