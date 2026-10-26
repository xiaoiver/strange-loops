import * as THREE from 'three';

// Cast concrete: cloudy cement, faint formwork ghosts and small recessed ties.
// The construction grid is secondary to the continuous poured surface.
const CONCRETE_CACHE_KEY = 'geb-ando-concrete-v6';

// Preserve a thin seam's coverage as it recedes, rather than drawing a fixed
// dark screen-space grid. Derivatives come from the unfolded coordinate.
export const JOINT_WIDTH = 0.003;
export const SEAM_PIXELS = 0.75;

export function periodDistance(coord, period) {
  const f = coord / period - Math.floor(coord / period);
  return Math.min(f, 1 - f) * period;
}

export function boardSeam(coord, period, px, width = JOINT_WIDTH) {
  const dist = periodDistance(coord, period);
  const outer = Math.max(width, px * SEAM_PIXELS);
  const t = Math.min(1, Math.max(0, dist / outer));
  const s = t * t * (3 - 2 * t);
  return (1 - s) * Math.min(1, width / Math.max(px, width));
}

const CONCRETE_VARYINGS = /* glsl */`
varying vec3 vConcreteLocal;
varying vec3 vConcreteWorld;
varying vec3 vConcreteObjectNormal;
varying vec3 vConcreteWorldNormal;
varying mat3 vConcreteBasis;
`;

const CONCRETE_FUNCTIONS = /* glsl */`
uniform float uConcreteLocalSpace;
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

// The unresolved seam loses contrast instead of becoming a thick drawn line.
void concreteSeam(float coord, float period, float width, float depth, float pixels, out float coverage, out float slope) {
  float f = fract(coord / period);
  float dist = min(f, 1.0 - f) * period;
  float px = fwidth(coord);
  float outer = max(width, px * pixels);
  float t = clamp(dist / outer, 0.0, 1.0);
  float s = t * t * (3.0 - 2.0 * t);
  float keep = min(1.0, width / max(px, width));
  coverage = (1.0 - s) * keep;
  float ds = (t > 0.0 && t < 1.0) ? (6.0 * t * (1.0 - t) / outer) : 0.0;
  float dDist = f < 0.5 ? 1.0 : -1.0;
  slope = depth * ds * dDist * keep;
}

float concretePit(vec2 point, float radius, float pixel) {
  float aa = max(0.001, pixel * 0.65);
  float edge = 1.0 - smoothstep(radius - aa, radius + aa, length(point));
  return edge * min(1.0, pow(2.0 * radius / max(pixel, 0.001), 2.0));
}

// Albedo multiplier, roughness, and an analytic groove gradient in pattern axes.
void concreteSurface(out vec3 albedo, out float rough, out vec3 grooveGrad) {
  const float BOARD_W = 3.6;
  const float BOARD_H = 1.8;
  const float JOINT = ${JOINT_WIDTH.toFixed(4)};
  const float GROOVE = 0.00015;
  const vec3 ORIGIN = vec3(-3.8, -3.8, -3.8);
  bool localSpace = uConcreteLocalSpace > 0.5;
  vec3 p = localSpace ? vConcreteLocal : (vConcreteWorld - ORIGIN);
  vec3 nFace = normalize(localSpace ? vConcreteObjectNormal : vConcreteWorldNormal);
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
  bool floorFace = nFace.y > 0.65;

  float pixel = max(max(fwidth(uv.x), fwidth(uv.y)), 0.0001);
  // Domain-warped low frequencies avoid a recognizable noise lattice or veins.
  vec2 warp = vec2(concreteNoise(uv * 0.42), concreteNoise(uv * 0.42 + 19.7));
  vec2 cement = uv + (warp - 0.5) * 0.7;
  float cloud = concreteNoise(cement * 0.34) * 0.65
              + concreteNoise(cement * 0.93 + 7.1) * 0.35;
  float mottling = concreteNoise(cement * vec2(2.6, 3.9) + 31.4);
  float slurry = concreteNoise(cement * vec2(5.8, 0.8) + 8.5);
  float grainKeep = 1.0 - smoothstep(0.015, 0.07, pixel);
  float grain = (concreteNoise(uv * 22.0) - 0.5) * grainKeep;
  float surfaceVariation = (cloud - 0.5) * 0.65 + (mottling - 0.5) * 0.16
                         + (slurry - 0.5) * 0.055 + grain * 0.07;
  float tone = 0.97 + surfaceVariation * (floorFace ? 0.48 : 1.0);

  grooveGrad = vec3(0.0);
  float seam = 0.0;
  float hole = 0.0;
  if (!floorFace) {
    float seamX, slopeX, seamY, slopeY;
    concreteSeam(uv.x, BOARD_W, JOINT, GROOVE, ${SEAM_PIXELS.toFixed(2)}, seamX, slopeX);
    concreteSeam(uv.y, BOARD_H, JOINT, GROOVE, ${SEAM_PIXELS.toFixed(2)}, seamY, slopeY);
    seam = max(seamX, seamY);
    float jointWear = 0.25 + 0.75 * concreteNoise(cement * 2.1 + 12.0);
    tone *= 1.0 - seam * 0.055 * jointWear;
    // A trace of a form board, with a soft boundary rather than a tiled edge.
    vec2 board = floor(uv / vec2(BOARD_W, BOARD_H));
    vec2 edge = min(fract(uv / vec2(BOARD_W, BOARD_H)), 1.0 - fract(uv / vec2(BOARD_W, BOARD_H))) * vec2(BOARD_W, BOARD_H);
    float boardField = smoothstep(0.0, 0.12, min(edge.x, edge.y));
    tone += (concreteHash(board + 3.4) - 0.5) * 0.035 * boardField;
    grooveGrad = axisU * slopeX + axisV * slopeY;

    // Recessed tie marks are clearer than board joints, on a construction rhythm.
    vec2 tieCell = floor(uv / 1.8);
    float tieRandom = concreteHash(tieCell + 71.3);
    vec2 tiePoint = (fract(uv / 1.8) - 0.5) * 1.8;
    tiePoint -= vec2(tieRandom - 0.5, concreteHash(tieCell + 6.2) - 0.5) * 0.012;
    hole = concretePit(tiePoint, 0.030, pixel);
    float tieHalo = concretePit(tiePoint, 0.050, pixel);
    tone *= 1.0 - hole * mix(0.58, 0.74, tieRandom) - tieHalo * 0.035;

    // Sparse small air pockets: fixed on the wall and filtered out at a distance.
    vec2 poreCell = floor(uv * 14.0);
    vec2 poreCenter = vec2(concreteHash(poreCell), concreteHash(poreCell + 29.1));
    float poreSeed = concreteHash(poreCell + 93.7);
    float pore = concretePit((fract(uv * 14.0) - poreCenter) / 14.0, mix(0.002, 0.007, poreSeed), pixel);
    tone *= 1.0 - pore * step(0.82, poreSeed) * 0.24;
  }

  albedo = vec3(tone);
  rough = (floorFace ? 0.86 : 0.93) + (mottling - 0.5) * 0.035;
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
vConcreteBasis = mat3(normalize(modelMatrix[0].xyz), normalize(modelMatrix[1].xyz), normalize(modelMatrix[2].xyz));
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
vec3 concreteGradient = uConcreteLocalSpace > 0.5 ? vConcreteBasis * concreteGroove : concreteGroove;
vec3 concretePerturbed = normalize(concreteFace - concreteGradient);
normal = normalize(mat3(viewMatrix) * concretePerturbed);
#ifdef DOUBLE_SIDED
normal *= gl_FrontFacing ? 1.0 : -1.0;
#endif
`);
}

export function createFairFacedConcrete({space='world'}={}) {
  const material = new THREE.MeshStandardMaterial({
    name: 'fair-faced-concrete',
    color: 0x8e918d,
    roughness: 0.93,
    metalness: 0,
    envMapIntensity: 0.42,
  });
  material.userData.fairFaced = true;
  material.userData.concreteSpace = space;
  material.onBeforeCompile = function (shader) {
    // Moving architecture keeps its cast surface through every scale and rotation.
    shader.uniforms.uConcreteLocalSpace = {value:space==='local'?1:0};
    installFairFacedConcrete(shader);
  };
  material.customProgramCacheKey = () => `${CONCRETE_CACHE_KEY}-${space}`;
  return material;
}
