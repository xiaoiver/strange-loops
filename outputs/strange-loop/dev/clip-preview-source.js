import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { loadCompanionAssets, createCompanionActor, updateCompanionPose } from '../src/companion-rig.js';
import { createCompanionPreview } from '../src/companion-preview-controller.js';
import { renderResolution, observePixelRatio } from '../src/render-resolution.js';

const $ = id => document.getElementById(id);
const reduced = matchMedia('(prefers-reduced-motion: reduce)');
let lang = new URL(location.href).searchParams.get('lang') === 'en' ? 'en' : 'zh';
const copy = {
  zh: {jog:'Jog · 轻慢跑',achilles:'阿基里斯',tortoise:'乌龟',walk:'Walk · 自然摆臂',developer:'开发工具',title:'动作预览',intro:'近看每一个动作，检查起停、落脚与视线。',character:'角色',clip:'动作',pause:'暂停',play:'播放',reset:'从头播放',speed:'行进速度',phase:'动作相位',scrub:'拖动相位会暂停。滚轮缩放，拖动观察角度。',automatic:'按速度自动混合待机',weight:'步态权重',gaze:'静止时注视',off:'关闭',left:'左侧',right:'右侧',camera:'镜头',loading:'正在加载角色…',ready:'Walk / Jog 按实际行进距离播放；地面网格显示相对位移。',reduced:'系统已启用减少动态效果，预览默认暂停。',error:'角色加载失败。请先运行 npm run preview:build，然后刷新页面重试。',stageHint:'同一模型 · 同一播放逻辑',footer:'本地预览，不随展厅发布'},
  en: {jog:'Jog · Upright',achilles:'Achilles',tortoise:'Tortoise',walk:'Walk · Natural arms',developer:'DEVELOPER TOOL',title:'Motion study',intro:'Inspect each pose, foot contact and change of attention.',character:'Character',clip:'Clip',pause:'Pause',play:'Play',reset:'Restart',speed:'Travel speed',phase:'Clip phase',scrub:'Scrubbing pauses playback. Scroll to zoom; drag to orbit.',automatic:'Blend idle automatically by speed',weight:'Gait weight',gaze:'Stationary gaze',off:'Off',left:'Left',right:'Right',camera:'Camera',loading:'Loading characters…',ready:'Walk / Jog follow actual travel distance. The ground grid shows relative movement.',reduced:'Reduced motion is enabled. Playback starts paused.',error:'Unable to load characters. Run npm run preview:build, then reload to retry.',stageHint:'Same assets · Same playback',footer:'Local preview, excluded from exhibition releases'},
};
let active, actors = [], controllers = [], renderer, controls, failed = false, loaded = false;
const scene = new THREE.Scene(); scene.background = new THREE.Color('#dededb');
const camera = new THREE.PerspectiveCamera(34, 1, .02, 100);
const canvas = $('stage'), stage = canvas.parentElement;
const grid = new THREE.GridHelper(30, 90, '#c0c0bc', '#cececa'); grid.position.y = .001; scene.add(grid);

function translate() {
  document.documentElement.lang = lang === 'zh' ? 'zh-CN' : 'en';
  document.title = `Strange Loops · ${copy[lang].title}`;
  for (const element of document.querySelectorAll('[data-copy]')) element.textContent = copy[lang][element.dataset.copy];
  $('language').textContent = lang === 'zh' ? 'EN' : '中文';
  refreshLabels();
}
function refreshLabels() {
  if (active) $('play').textContent = copy[lang][active.paused ? 'play' : 'pause'];
  $('status').textContent = copy[lang][failed ? 'error' : !loaded ? 'loading' : reduced.matches && active?.paused ? 'reduced' : 'ready'];
}
$('language').addEventListener('click', () => {
  lang = lang === 'zh' ? 'en' : 'zh';
  const url = new URL(location.href); url.searchParams.set('lang', lang); history.replaceState(null, '', url);
  translate();
});
function syncInputs() {
  const moving = active.actor.current === 'Walk' || active.actor.current === 'Jog';
  $('clip').value = active.actor.current;
  $('speed').disabled = !moving;
  $('automatic').disabled = !moving;
  $('weight').disabled = !moving || $('automatic').checked;
  $('gaze').disabled = !active.actor.gaze || moving;
  refreshLabels();
}
function chooseCharacter() {
  const index = $('character').value === 'achilles' ? 0 : 1;
  actors.forEach((actor, i) => { actor.root.visible = i === index; });
  active = controllers[index];
  for (const option of $('clip').options) option.disabled = !active.actor.actions[option.value];
  $('actor-title').textContent = active.actor.id.toUpperCase();
  $('speed').value = index === 0 ? active.actor.current === 'Jog' ? '2.5' : '.8' : '.23';
  active.setSpeed(Number($('speed').value));
  $('automatic').checked = true; active.manualWeight = null;
  $('gaze').value = 'off'; active.gazeTarget = null;
  const height = index === 0 ? 1.5 : .34;
  controls.target.set(0, height * .48, 0);
  camera.position.set(height * 1.7, height * 1.2, height * 2.8);
  controls.minDistance = height * .6; controls.maxDistance = height * 8; controls.update();
  syncInputs();
}
function updateTarget() {
  const height = active.actor.id === 'achilles' ? 1.5 : .34;
  const value = $('gaze').value;
  active.gazeTarget = value === 'off' ? null : value === 'camera' ? camera.position : new THREE.Vector3(value === 'left' ? -1 : 1, height * .95, 2);
}
function resize() {
  const {width, height} = stage.getBoundingClientRect();
  const resolution = renderResolution(width, height, devicePixelRatio);
  renderer.setPixelRatio(1); renderer.setSize(resolution.bufferWidth, resolution.bufferHeight, false);
  camera.aspect = width / height; camera.updateProjectionMatrix();
}
async function init() {
  try {
    renderer = new THREE.WebGLRenderer({canvas, antialias:true});
    renderer.shadowMap.enabled = true; renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.25;
    controls = new OrbitControls(camera, canvas); controls.enableDamping = false;
    scene.add(new THREE.HemisphereLight('#fafaf7', '#898985', 2));
    const key = new THREE.DirectionalLight('#fafaf7', 3); key.position.set(3, 7, 4);
    key.castShadow = true; key.shadow.mapSize.set(2048, 2048);
    key.shadow.camera.left = -3; key.shadow.camera.right = 3; key.shadow.camera.top = 4; key.shadow.camera.bottom = -3;
    key.shadow.normalBias = .015; key.shadow.bias = -.0001; scene.add(key);
    const floor = new THREE.Mesh(new THREE.PlaneGeometry(60, 60), new THREE.MeshStandardMaterial({color:'#dededb', roughness:.9}));
    floor.rotation.x = -Math.PI / 2; floor.receiveShadow = true; scene.add(floor);
    const gltfs = await loadCompanionAssets(['achilles', 'tortoise']);
    actors = gltfs.map((gltf, i) => createCompanionActor(gltf, {id: i === 0 ? 'achilles' : 'tortoise', scale:i === 0 ? .6 : .46}));
    controllers = actors.map(actor => {
      actor.root.traverse(mesh => {if (mesh.isMesh) {mesh.castShadow = true; mesh.frustumCulled = false;}});
      scene.add(actor.root);
      const preview = createCompanionPreview(actor, {paused:reduced.matches});
      preview.select('Walk'); updateCompanionPose(actor, 0); return preview;
    });
    loaded = true; $('controls').disabled = false; chooseCharacter();
    new ResizeObserver(resize).observe(stage); observePixelRatio(resize); resize();
    $('character').addEventListener('change', chooseCharacter);
    $('clip').addEventListener('change', () => {
      active.select($('clip').value);
      if (['Walk', 'Jog'].includes(active.actor.current)) {
        $('speed').value = active.actor.id === 'tortoise' ? '.23' : active.actor.current === 'Jog' ? '2.5' : '.8';
        active.setSpeed(Number($('speed').value));
      }
      syncInputs();
    });
    $('play').addEventListener('click', () => {active.paused = !active.paused; refreshLabels();});
    $('reset').addEventListener('click', () => {active.reset(); syncInputs();});
    $('speed').addEventListener('input', () => active.setSpeed(Number($('speed').value)));
    $('phase').addEventListener('input', () => {active.seek(Number($('phase').value)); syncInputs();});
    $('automatic').addEventListener('change', () => {active.setManualWeight($('automatic').checked ? null : Number($('weight').value)); syncInputs();});
    $('weight').addEventListener('input', () => {active.setManualWeight(Number($('weight').value));});
    $('gaze').addEventListener('change', updateTarget);
    reduced.addEventListener('change', () => {if (reduced.matches) controllers.forEach(preview => {preview.paused = true;}); refreshLabels();});
    let previous = performance.now(), nextReadout = 0;
    renderer.setAnimationLoop(now => {
      const dt = Math.min(.05, (now - previous) / 1000); previous = now;
      if (document.hidden) return;
      const before = active.actor.current;
      active.update(dt);
      if (active.actor.current !== before) syncInputs();
      grid.position.z = -(active.distance % (30 / 90));
      renderer.render(scene, camera);
      if (now < nextReadout) return;
      nextReadout = now + 100;
      const action = active.actor.actions[active.actor.current];
      const phase = action.time / action.getClip().duration;
      $('phase').value = phase;
      $('phase-value').textContent = `${Math.round(phase * 100)}%`;
      $('speed-value').textContent = Number($('speed').value).toFixed(2);
      $('weight-value').textContent = `${Math.round(action.getEffectiveWeight() * 100)}%`;
      $('metric-clip').textContent = active.actor.current;
      $('metric-time').textContent = `${action.time.toFixed(2)} / ${action.getClip().duration.toFixed(2)}s`;
      $('metric-rate').textContent = `${action.getEffectiveTimeScale().toFixed(2)}×`;
      $('metric-blend').textContent = `${active.actor.actions.Idle.getEffectiveWeight().toFixed(2)} / ${action === active.actor.actions.Idle ? '0.00' : action.getEffectiveWeight().toFixed(2)}`;
    });
  } catch (error) {
    failed = true; refreshLabels(); $('controls').disabled = true;
    renderer?.dispose(); console.error('Companion preview failed', error);
  }
}
translate(); init();
