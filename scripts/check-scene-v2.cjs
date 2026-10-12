const fs = require('node:fs');
const path = require('node:path');
const assert = require('node:assert/strict');
const {JSDOM, VirtualConsole} = require('jsdom');
const esbuild = require('esbuild');
const root = path.resolve(__dirname, '..');

// Exercise the actual scene, models and event handlers; replace only the GPU renderer.
// This verifies render lifecycle and geometry, not pixels produced by a graphics driver.
(async () => {
  const threeModule = path.join(path.dirname(require.resolve('three')), 'three.module.js');
  const source = process.argv[2] ? fs.readFileSync(process.argv[2], 'utf8') : fs.readFileSync(path.join(root, 'src/brand-scene.js'), 'utf8');
  const result = await esbuild.build({
    stdin: {contents: source, sourcefile: path.join(root, 'src/brand-scene.js'), resolveDir: path.join(root, 'src')},
    bundle: true, write: false, minify: true, format: 'iife', target: 'es2020', loader: {'.svg': 'text'},
    plugins: [{name: 'gpu-lifecycle-fixture', setup(build) {
      build.onResolve({filter: /^three$/}, args => args.importer.endsWith('brand-scene.js') ? {path: 'renderer', namespace: 'gpu-fixture'} : undefined);
      build.onLoad({filter: /.*/, namespace: 'gpu-fixture'}, () => ({resolveDir: root, contents: `
        export * from ${JSON.stringify(threeModule)};
        export class WebGLRenderer {
          constructor() { this.loop=null;this.frames=[];this.loopStarts=0;window.testRenderer=this; }
          setClearColor() {}
          setPixelRatio(ratio) { this.ratio=ratio; }
          setSize(width,height) { this.size=[width,height]; }
          setAnimationLoop(fn) { this.loop=fn;if(fn)this.loopStarts++; }
          render(scene) {
            const rig=scene.children.find(child=>child.type==='Group');
            this.rig=rig;
            this.frames.push({rotation:rig.rotation.toArray().slice(0,3),bob:rig.position.y});
          }
        }
      `}));
    }}]
  });
  const code = result.outputFiles[0].text;
  function create(gpu) {
    const errors = [];
    const console = new VirtualConsole();console.on('jsdomError', e => errors.push(e.message));
    const dom = new JSDOM('<div id="dx-webgl"><div class="dx-webgl-fallback"></div></div>', {
      url: 'https://scene-test.invalid/', runScripts: 'dangerously', pretendToBeVisual: true, virtualConsole: console,
      beforeParse(w) {
        w.HTMLCanvasElement.prototype.getContext = () => gpu ? {} : null;
        Object.defineProperty(w, 'devicePixelRatio', {value: 2});
        Object.defineProperty(w.document, 'hidden', {value: false, writable: true});
        w.dxSceneState = {home: true, visible: true, paused: false, reduced: false, progress: .2, shape: 'logo'};
      }
    });
    dom.window.eval(code);
    return {dom, w: dom.window, errors};
  }
  const {dom, w, errors} = create(true);
  try {
    const renderer = w.testRenderer;
    const host = w.document.querySelector('#dx-webgl');
    let time = 1000;
    const step = () => {assert.equal(typeof renderer.loop, 'function');renderer.loop(time += 40)};
    function publish(changes) {
      w.dxSceneState = {...w.dxSceneState, ...changes};
      w.document.dispatchEvent(new w.CustomEvent('dx:scene-state', {detail: w.dxSceneState}));
    }
    step();
    w.dispatchEvent(new w.Event('pagehide'));assert.equal(renderer.loop, null);
    w.dispatchEvent(new w.Event('pageshow'));
    assert.equal(typeof renderer.loop, 'function', 'back/forward restoration restarts the stopped animation loop');
    step();
    assert.equal(renderer.rig.children.length, 2, 'the brand keeps its identity on every campaign slide');
    assert.equal(renderer.rig.children[0].userData.parts, 13);
    for (const progress of [0, .15, .25, .5, .75, 1]) {
      publish({progress});step();
      assert(Math.abs(renderer.frames.at(-1).rotation[1]) < .9, 'the emblem never turns edge-on');
    }
    const pose = renderer.frames.at(-1);
    publish({paused: true});assert.equal(renderer.loop, null);
    assert.deepEqual(renderer.frames.at(-1), pose, 'pausing freezes the current pose without a snap');
    publish({paused: false});step();
    publish({visible: false});assert.equal(renderer.loop, null);
    const count = renderer.frames.length;
    publish({progress: .4});assert.equal(renderer.frames.length, count, 'hidden geometry does not spend frames');
    publish({home: false});assert.equal(renderer.loop, null);
    publish({home: true, visible: true});step();
    w.document.hidden = true;w.document.dispatchEvent(new w.Event('visibilitychange'));assert.equal(renderer.loop, null);
    w.document.hidden = false;w.document.dispatchEvent(new w.Event('visibilitychange'));step();
    const canvas = host.querySelector('canvas');
    const lost = new w.Event('webglcontextlost', {cancelable: true});canvas.dispatchEvent(lost);
    assert(lost.defaultPrevented);assert.equal(renderer.loop, null);assert(!host.classList.contains('is-rendered'));
    canvas.dispatchEvent(new w.Event('webglcontextrestored'));step();assert(host.classList.contains('is-rendered'));
    w.innerWidth = 390;w.dispatchEvent(new w.Event('resize'));assert.deepEqual(Array.from(renderer.size), [320, 320]);assert.equal(renderer.ratio, 1.25);
    publish({reduced: true});assert.equal(renderer.loop, null);
    publish({reduced: false});step();
    assert.deepEqual(errors, []);
  } finally {dom.window.close();}
  const fallback = create(false);
  try {
    assert.equal(fallback.w.document.querySelectorAll('canvas').length, 0);
    assert.equal(fallback.w.document.querySelector('#dx-webgl').dataset.renderer, 'fallback');
    assert.deepEqual(fallback.errors, []);
  } finally {fallback.dom.window.close();}
  console.log('PASS: scene page restoration, paused pose, hidden/route/visibility rendering, context recovery, mobile pixel ratio, reduced motion, permanent 13-part brand and WebGL fallback.');
  console.log('GPU drawing is a fixture; no claim of graphics-driver validation.');
})().catch(error => {console.error(error);process.exitCode = 1});
