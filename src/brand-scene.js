import * as THREE from 'three';
import logoSvg from '../public/assets/brand-mark.svg';
import { createBrandModel, updateBrandModel } from './brand-model.mjs';

(() => {
  const host = document.getElementById('dx-webgl');
  if (!host) return;
  host.dataset.renderer = 'fallback';
  let renderer;
  const canvas = document.createElement('canvas');
  canvas.setAttribute('aria-hidden', 'true');
  try {
    const context = canvas.getContext('webgl2', { alpha: true, antialias: true, powerPreference: 'low-power' });
    if (!context) return;
    renderer = new THREE.WebGLRenderer({ canvas, context, alpha: true, antialias: true, powerPreference: 'low-power' });
  } catch (_) { return; }
  renderer.setClearColor(0x000000, 0);
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.25;
  host.append(canvas);
  host.dataset.renderer = 'webgl';
  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(34, 1, .1, 40);
  camera.position.set(0, 0, 12.5);
  const rig = new THREE.Group();
  scene.add(rig);
  const logo = createBrandModel(logoSvg);
  rig.add(logo);
  scene.add(new THREE.HemisphereLight('#fff0d4', '#132d46', 2.8));
  const key = new THREE.DirectionalLight('#fff4e0', 4.2);key.position.set(-4, 5, 7);scene.add(key);
  const rim = new THREE.DirectionalLight('#ff963f', 3);rim.position.set(4, -2, -3);scene.add(rim);
  const fill = new THREE.DirectionalLight('#9ebedb', 2);fill.position.set(5, 1, 6);scene.add(fill);
  let state = window.dxSceneState || { home: false, paused: true, progress: 0, mobile: innerWidth <= 680 };
  let active = false;
  let lost = false;
  let pageSuspended = false;
  let rendered = false;
  let paletteMix = 1;
  let poseProgress = 0;
  let elapsed = 0;
  let lastTime = 0;
  let lastRender = 0;
  let pointerX = 0, pointerY = 0;
  let smoothX = 0, smoothY = 0;
  let mobile = null;
  function size() {
    const nextMobile = innerWidth <= 680;
    if (nextMobile === mobile) return;
    mobile = nextMobile;
    renderer.setPixelRatio(Math.min(devicePixelRatio || 1, mobile ? 1.25 : 1.5));
    renderer.setSize(mobile ? 320 : 512, mobile ? 320 : 512, false);
  }
  function pose() {
    if(!state.paused&&!state.reduced)poseProgress=Math.max(0,Math.min(1,state.progress||0));
    const progress = poseProgress;
    // Keep the thin emblem facing the reader instead of disappearing edge-on.
    rig.rotation.x = .13 + smoothY + Math.sin(elapsed * .24) * .09;
    rig.rotation.y = -.24 + smoothX + Math.sin(progress * Math.PI * 2) * .28 + Math.sin(elapsed * .3) * .16;
    rig.rotation.z = -.05 + Math.sin(elapsed * .22) * .07;
    rig.position.y = Math.sin(elapsed * .7) * .12;
    updateBrandModel(logo, {mix:paletteMix,split:state.reduced?0:(state.split||0),phase:progress*Math.PI*6+elapsed*.55});
    renderer.render(scene, camera);
    host.classList.add('is-rendered');
    rendered = true;
  }
  function tick(time) {
    const interval = mobile ? 1000 / 24 : 1000 / 30;
    if (time - lastRender < interval) return;
    const dt = lastTime ? Math.min(.1, Math.max(0, (time - lastTime) / 1000)) : 0;
    elapsed += dt;
    const paletteTarget = state.tone === 'light' ? 0 : 1;
    paletteMix += (paletteTarget-paletteMix)*(1-Math.exp(-dt/ .35));
    if(Math.abs(paletteMix-paletteTarget)<.001)paletteMix=paletteTarget;
    lastTime = time;lastRender = time;
    const weight = 1 - Math.exp(-dt * 8);
    smoothX += (pointerX - smoothX) * weight;smoothY += (pointerY - smoothY) * weight;
    pose();
  }
  function stop() {
    if (active) renderer.setAnimationLoop(null);
    active = false;lastTime = 0;lastRender = 0;
  }
  function sync() {
    size();
    const visible = state.home && state.visible !== false && !document.hidden && !pageSuspended && !lost;
    if (!visible) { stop();return; }
    const moving = !state.paused && !state.reduced;
    if(!moving)paletteMix=state.tone==='light'?0:1;
    if (!rendered || !moving) pose();
    if (moving && !active) {
      active = true;lastTime = 0;lastRender = 0;renderer.setAnimationLoop(tick);
    } else if (!moving) {
      stop();
    }
  }
  document.addEventListener('dx:scene-state', event => { state = event.detail;sync(); });
  document.addEventListener('visibilitychange', sync);
  window.addEventListener('resize', sync, { passive: true });
  window.addEventListener('pointermove', event => {
    if (!active || mobile || event.pointerType === 'touch') return;
    pointerX = (event.clientX / innerWidth - .5) * .28;
    pointerY = (event.clientY / innerHeight - .5) * .13;
  }, { passive: true });
  canvas.addEventListener('webglcontextlost', event => {
    event.preventDefault();lost = true;rendered = false;stop();
    host.classList.remove('is-rendered');
  });
  canvas.addEventListener('webglcontextrestored', () => { lost = false;sync(); });
  window.addEventListener('pagehide', () => { pageSuspended = true;stop(); });
  window.addEventListener('pageshow', () => { pageSuspended = false;sync(); });
  sync();
})();
