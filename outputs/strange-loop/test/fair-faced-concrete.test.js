import test from 'node:test';
import assert from 'node:assert/strict';
import { Scene, Texture, TextureLoader } from 'three';
import { createFairFacedConcrete, boardSeam } from '../src/fair-faced-concrete.js';
import { cloneWithHooks } from '../src/shader-hooks.js';
import { applySoftShadows } from '../src/soft-shadows.js';
import { applyPassageOcclusion } from '../src/passage-occlusion.js';
import { createFigureGroundScene } from '../src/figure-ground-scene.js';
import { createLabyrinthScene } from '../src/labyrinth-scene.js';

function stubShader() {
  return {
    uniforms: {},
    vertexShader: [
      '#include <common>',
      'void main() {',
      '#include <project_vertex>',
      '#include <worldpos_vertex>',
      '}',
    ].join('\n'),
    fragmentShader: [
      '#include <common>',
      '#include <shadowmap_pars_fragment>',
      'void main() {',
      '#include <color_fragment>',
      '#include <roughnessmap_fragment>',
      '#include <normal_fragment_begin>',
      '#include <lights_fragment_begin>',
      '#include <aomap_fragment>',
      '}',
    ].join('\n'),
  };
}

test('fair-faced concrete is matte, cool gray, and keeps chained shader hooks', () => {
  const material = createFairFacedConcrete();
  assert.equal(material.name, 'fair-faced-concrete');
  assert.equal(material.metalness, 0);
  assert.equal(material.userData.fairFaced, true);
  assert.ok(material.roughness >= 0.9 && material.roughness <= 1);
  assert.ok(material.envMapIntensity < 0.6);
  assert.equal(material.color.getHex(), 0x8e918d);
  const color = material.color;
  assert.ok(Math.abs(color.r - color.b) < 0.03, 'albedo stays neutral rather than warm');

  applySoftShadows(material, false);
  const passage = cloneWithHooks(material);
  applyPassageOcclusion(passage);
  assert.match(material.customProgramCacheKey(), /geb-ando-concrete-v6-world\|geb-pcss-v1-desktop/);
  assert.match(passage.customProgramCacheKey(), /geb-ando-concrete-v6-world/);
  assert.match(passage.customProgramCacheKey(), /geb-pcss-v1-desktop/);
  assert.match(passage.customProgramCacheKey(), /passage-occlusion-v1/);

  const shader = stubShader();
  passage.onBeforeCompile(shader);
  assert.match(shader.vertexShader, /vConcreteLocal = transformed/);
  assert.match(shader.vertexShader, /vPassageOcclusion = passageOcclusion/);
  assert.match(shader.fragmentShader, /BOARD_W = 3\.6/);
  assert.match(shader.fragmentShader, /BOARD_H = 1\.8/);
  assert.match(shader.fragmentShader, /floorFace/);
  assert.match(shader.fragmentShader, /gebPCSS/);
  assert.match(shader.fragmentShader, /vPassageOcclusion/);
  assert.match(shader.fragmentShader, /roughnessFactor = concreteRough/);
  assert.match(shader.fragmentShader, /fwidth\(coord\)/);
  assert.match(shader.fragmentShader, /fract\(uv \/ 1\.8\)/);
  assert.doesNotMatch(shader.fragmentShader, /fwidth\(jointDist\)/);
  assert.doesNotMatch(shader.fragmentShader, /dFdx\(concreteHeight\)/);
});

test('distant formwork seams lose contrast without growing into a screen-space grid', () => {
  const average = px => {
    let sum=0;
    for(let i=0;i<10000;i++)sum+=boardSeam((i+.5)/10000*.9,.9,px);
    return sum/10000;
  };
  const close=average(.001);
  let previous=1;
  for(const px of [.004,.012,.02,.05,.08]){
    const center=boardSeam(0,.9,px);
    assert.ok(center<previous, 'a distant seam must not keep a fixed dark contrast');
    previous=center;
    assert.ok(boardSeam(.4,.9,px)<.001, 'the board field remains uninterrupted');
    assert.ok(Math.abs(average(px)/close-1)<.3, 'filtering must preserve coverage, not thicken the joints');
  }
  assert.ok(previous<.04, 'unresolved joints should recede into the wall');
});

test('exhibition shells use the concrete and exhibit objects do not', t => {
  const originalWidth = globalThis.innerWidth;
  globalThis.innerWidth = 1280;
  t.after(() => { globalThis.innerWidth = originalWidth; });
  t.mock.method(TextureLoader.prototype, 'load', () => new Texture());

  const scene = new Scene();
  createFigureGroundScene(scene, { matches: true }, () => {});
  const gallery = scene.getObjectByName('figure-ground-gallery');
  let shell = 0, other = 0;
  gallery.traverse(object => {
    if (!object.isMesh) return;
    if (object.material.userData.fairFaced) shell += 1;
    else other += 1;
  });
  assert.ok(shell >= 10, 'gallery floor, walls and soffit share the pour');
  assert.ok(other >= 4, 'co-edge walls and posters keep their own materials');

  const labyrinth = createLabyrinthScene(scene, { matches: true }, () => {});
  const model = scene.getObjectByName('fractal-cube');
  let modelShell = 0, modelOther = 0;
  model.traverse(object => {
    if (!object.isMesh || object.name==='fractal-opening') return;
    if (object.material.userData.fairFaced) modelShell += 1;
    else modelOther += 1;
  });
  assert.ok(modelShell >= 20, 'the mesh Menger branches use the concrete');
  assert.equal(modelOther, 0, 'the Menger architecture does not duplicate the earlier artworks');
  labyrinth.dispose();
});

test('moving architecture keeps object-space concrete through scale and orientation changes', () => {
  const fixed=createFairFacedConcrete(),moving=createFairFacedConcrete({space:'local'});
  const fixedShader=stubShader(),movingShader=stubShader();
  fixed.onBeforeCompile(fixedShader);moving.onBeforeCompile(movingShader);
  assert.equal(fixedShader.uniforms.uConcreteLocalSpace.value,0);
  assert.equal(movingShader.uniforms.uConcreteLocalSpace.value,1);
  assert.notEqual(fixed.customProgramCacheKey(),moving.customProgramCacheKey());
  assert.doesNotMatch(movingShader.fragmentShader,/vConcreteScale\s*</,'scale changes must not switch the coordinate system');
  assert.match(movingShader.fragmentShader,/vConcreteBasis \* concreteGroove/,'the surface recess must rotate with its wall');
});
