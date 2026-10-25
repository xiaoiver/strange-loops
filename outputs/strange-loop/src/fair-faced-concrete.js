import * as THREE from 'three';

// Fair-faced concrete for the shared exhibition shell.
// Full-scale rooms share one world-space board grid, locked to the lobby
// corner and floor so courses meet the ground. Miniature galleries keep the
// same 900×1800 mm module in their unscaled local coordinates.
// Tie holes sit in the field of each board, not on the joints.
const CONCRETE_CACHE_KEY = 'geb-ando-concrete-v4';

// Joint width in metres. Screen coverage uses the raw axis derivative, never
// the folded distance: fwidth of a V-shaped SDF collapses on the seam and
// leaves a one-pixel line that breaks into dashes in perspective. The line is
// kept a few pixels wide so FXAA sees a soft gradient instead of a sparkle.
export const JOINT_WIDTH = 0.012;
export const SEAM_PIXELS = 2.25;

export function periodDistance(coord, period) {
  const f = coord / period - Math.floor(coord / period);
  return Math.min(f, 1 - f) * period;
}

export function boardSeam(coord, period, px, width = JOINT_WIDTH) {
  const dist = periodDistance(coord, period);
  const outer = Math.max(width, px * SEAM_PIXELS);
  const t = Math.min(1, Math.max(0, dist / outer));
  const s = t * t * (3 - 2 * t);
  return 1 - s;
}

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

// Continuous groove. Coverage is a smoothstep of distance-to-joint; the width
// is at least the requested pixel count of the raw coordinate so perspective cannot skip pixels.
// slope is d(height)/d(coord) for height = -depth * coverage.
void concreteSeam(float coord, float period, float width, float depth, float pixels, out float coverage, out float slope) {
  float f = fract(coord / period);
  float dist = min(f, 1.0 - f) * period;
  float px = fwidth(coord);
  float outer = max(width, px * pixels);
  float t = clamp(dist / outer, 0.0, 1.0);
  float s = t * t * (3.0 - 2.0 * t);
  coverage = 1.0 - s;
  float ds = (t > 0.0 && t < 1.0) ? (6.0 * t * (1.0 - t) / outer) : 0.0;
  float dDist = f < 0.5 ? 1.0 : -1.0;
  slope = depth * ds * dDist;
}

// Albedo multiplier, roughness, and an analytic groove gradient in pattern axes.
void concreteSurface(out vec3 albedo, out float rough, out vec3 grooveGrad) {
  // 1.8 m × 0.9 m plywood, long side horizontal: the quiet Ando course.
  const float BOARD_W = 1.8;
  const float BOARD_H = 0.9;
  const float JOINT = 0.012;
  // Shallow recess. A steep V catches the sun on one face and cancels the
  // albedo line, which FXAA then reads as dashes.
  const float GROOVE = 0.00055;
  const vec3 ORIGIN = vec3(-3.8, -3.8, -3.8);
  bool miniature = vConcreteScale < 0.5;
  vec3 p = miniature ? vConcreteLocal : (vConcreteWorld - ORIGIN);
  vec3 nFace = normalize(miniature ? vConcreteObjectNormal : vConcreteWorldNormal);
  vec3 nWorld = normalize(vConcreteWorldNormal);
  vec3 axisU;
  vec3 axisV;
  vec2 uv;
  if (abs(nFace.y) > 0.65) {
    uv = p.xz; axisU = vec3(1.0, 0.0, 0.0); axisV = vec3(0.0, 0.0, 1.0);
  } else if (abs(nFace.x) > abs(nFace.z)) {
    uv = p.zy; axisU = vec3(0.0, 0.0, 1.0); axisV = vec3(0.0, 1.0, 0.0);
  } else {
    uv = p.xy; axisU = vec3(1.0, 0.0, 0.0); axisV = vec3(0.0, 1.0, 0.0);
  }
  bool floorFace = nWorld.y > 0.65;

  float cloud = concreteNoise(uv * 0.17);
  float blot = concreteNoise(uv * 0.85);
  float grainPx = max(fwidth(uv.x), 1e-4);
  float grainFade = clamp(0.0035 / grainPx, 0.0, 1.0);
  float grain = (concreteNoise(uv * 14.0) - 0.5) * grainFade;
  float tone = 0.972 + cloud * 0.034 + (blot - 0.5) * 0.02 + grain * 0.018;

  grooveGrad = vec3(0.0);
  float seam = 0.0;
  float hole = 0.0;
  if (!floorFace) {
    float seamX, slopeX, seamY, slopeY;
    concreteSeam(uv.x, BOARD_W, JOINT, GROOVE, 2.25, seamX, slopeX);
    concreteSeam(uv.y, BOARD_H, JOINT, GROOVE, 2.25, seamY, slopeY);
    seam = max(seamX, seamY);
    // A wider, lighter shade sits under the hairline so the recess stays a
    // continuous band when the hairline itself is only a couple of pixels.
    float shadeX, shadeSlopeX, shadeY, shadeSlopeY;
    concreteSeam(uv.x, BOARD_W, 0.05, 0.0, 4.5, shadeX, shadeSlopeX);
    concreteSeam(uv.y, BOARD_H, 0.05, 0.0, 4.5, shadeY, shadeSlopeY);
    tone *= mix(1.0, 0.94, max(shadeX, shadeY));
    tone *= mix(1.0, 0.84, seam);
    grooveGrad = axisU * slopeX + axisV * slopeY;

    // One soft tie hole in the middle of each board. No normal, so it cannot
    // sparkle into a second dotted rhythm beside the joint.
    vec2 cell = fract(uv / vec2(BOARD_W, BOARD_H)) - 0.5;
    vec2 toCenter = cell * vec2(BOARD_W, BOARD_H);
    float holeDist = length(toCenter);
    float holePx = max(fwidth(uv.x), fwidth(uv.y));
    float feather = max(0.022, holePx * 2.2);
    float ht = clamp((holeDist - 0.01) / feather, 0.0, 1.0);
    float hs = ht * ht * (3.0 - 2.0 * ht);
    float holeKeep = 1.0 - smoothstep(0.028, 0.06, holePx);
    hole = (1.0 - hs) * holeKeep;
    tone *= mix(1.0, 0.955, hole);
  }

  albedo = vec3(tone);
  rough = floorFace ? 0.86 : 0.93;
  rough = mix(rough, min(1.0, rough + 0.04), max(seam, hole * 0.35));
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
vec3 concreteGroove;
concreteSurface(concreteAlbedo, concreteRough, concreteGroove);
diffuseColor.rgb *= concreteAlbedo;
`);
  shader.fragmentShader = replaceInclude(shader.fragmentShader, 'roughnessmap_fragment', /* glsl */`
roughnessFactor = concreteRough;
`);
  shader.fragmentShader = replaceInclude(shader.fragmentShader, 'normal_fragment_begin', /* glsl */`
vec3 concreteWorldNormal = normalize(vConcreteWorldNormal);
vec3 concreteDx = dFdx(vConcreteWorld);
vec3 concreteDy = dFdy(vConcreteWorld);
vec3 concreteFace = cross(concreteDx, concreteDy);
if (dot(concreteFace, concreteFace) < 1e-12) concreteFace = concreteWorldNormal;
else concreteFace = normalize(concreteFace);
if (dot(concreteFace, concreteWorldNormal) < 0.0) concreteFace = -concreteFace;
vec3 concretePerturbed = normalize(concreteFace - concreteGroove);
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
