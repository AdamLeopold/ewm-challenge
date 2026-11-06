import * as THREE from "three";
import { createEarthActors } from "./earth-3d-actors.js?v=2";
import { createEarthClouds } from "./earth-3d-clouds.js";
import { createEarthTerrain } from "./earth-terrain.js?v=2";

const RADIANS = Math.PI / 180;
const TILT = 14 * RADIANS;
const PITCH = 11 * RADIANS;
const START_YAW = -20 * RADIANS;
const ROTATION_PERIOD = 145;
const FRAMING = 1.4;
const SUN_DIRECTION = new THREE.Vector3(-0.55, 0.8, 1).normalize();
const canvas = document.querySelector("canvas[data-earth-3d]");
const capture = new URLSearchParams(location.search).has("capture");

function createAtmosphere() {
  const geometry = new THREE.SphereGeometry(1.075, 72, 36);
  const material = new THREE.ShaderMaterial({
    uniforms: { sun: { value: SUN_DIRECTION } },
    vertexShader: `
      varying vec3 air;
      void main() {
        air = position;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      }`,
    fragmentShader: `
      uniform vec3 sun;
      varying vec3 air;
      void main() {
        float radius = length(air.xy);
        float lit = max(0.0, dot(air.xy / max(0.0001, radius), sun.xy));
        float edge = 1.0 - smoothstep(1.0, 1.075, radius);
        gl_FragColor = vec4(0.37, 0.66, 0.94, (0.075 + 0.23 * lit) * edge * edge);
      }`,
    side: THREE.BackSide,
    transparent: true,
    depthWrite: false,
    toneMapped: false,
  });
  const atmosphere = new THREE.Mesh(geometry, material);
  atmosphere.name = "Earth atmosphere";
  return atmosphere;
}

async function mount() {
  if (!canvas) return;
  if (capture) window.__EWM_EARTH_READY__ = false;
  const hero = canvas.parentElement;
  const renderer = new THREE.WebGLRenderer({ canvas, alpha: true, antialias: true });
  renderer.setClearColor(0x000000, 0);
  const scene = new THREE.Scene();
  const camera = new THREE.OrthographicCamera(-FRAMING, FRAMING, FRAMING, -FRAMING, 0.1, 12);
  camera.position.z = 4;
  const pole = new THREE.Group();
  pole.rotation.order = "ZXY";
  pole.rotation.set(PITCH, 0, TILT);
  const globe = new THREE.Group();
  globe.name = "Rotating Earth";
  pole.add(globe);
  scene.add(pole, createAtmosphere());

  const sky = new THREE.HemisphereLight(0xe6f0ff, 0x929da3, 1.94);
  const key = new THREE.DirectionalLight(0xfff4e2, 2.14);
  key.position.copy(SUN_DIRECTION);
  const rim = new THREE.DirectionalLight(0x86baff, 0.98);
  rim.position.set(0.52, 0.14, -1);
  scene.add(sky, key, rim);

  const assetRoot = new URL("../models/", import.meta.url).href;
  const load = new THREE.ImageLoader();
  const [surfaceImage, elevationImage] = await Promise.all([
    load.loadAsync(assetRoot + "people/earth-blue-marble.jpg"),
    load.loadAsync(assetRoot + "people/earth-elevation.png"),
  ]);
  const terrain = createEarthTerrain(surfaceImage, elevationImage, SUN_DIRECTION);
  globe.add(terrain.mesh);
  const clouds = createEarthClouds({ parent: globe });
  const actors = await createEarthActors({ parent: globe, surfaceRadius: terrain.surfaceRadius, assetRoot });
  const reduce = matchMedia("(prefers-reduced-motion: reduce)");
  let elapsed = 0;
  let lastTime;
  let visible = true;
  let contextLost = false;
  let fixedTime = capture && Number.isFinite(window.__EWM_EARTH_TIME__) ? window.__EWM_EARTH_TIME__ : undefined;
  let animation = 0;

  function render(seconds) {
    globe.rotation.y = START_YAW + (seconds % ROTATION_PERIOD) * 2 * Math.PI / ROTATION_PERIOD;
    clouds.update(seconds);
    actors.update(seconds);
    terrain.updateLighting(clouds.shadowCenters);
    renderer.render(scene, camera);
  }

  function resize() {
    const width = hero.clientWidth;
    if (!width) return;
    renderer.setPixelRatio(Math.min(devicePixelRatio || 1, 1.8, 1200 / width));
    renderer.setSize(width, width, false);
    if (!contextLost) render(fixedTime ?? elapsed);
  }

  function tick(now) {
    animation = 0;
    if (lastTime !== undefined) elapsed += Math.min(0.08, (now - lastTime) / 1000);
    lastTime = now;
    render(elapsed);
    schedule();
  }

  function schedule() {
    if (!animation && !contextLost && visible && !document.hidden && !reduce.matches && fixedTime === undefined) {
      animation = requestAnimationFrame(tick);
    }
  }

  function stop() {
    if (animation) cancelAnimationFrame(animation);
    animation = 0;
    lastTime = undefined;
  }

  if (capture) {
    window.__EWM_EARTH_RENDER__ = seconds => {
      if (!Number.isFinite(seconds)) throw new TypeError("Expected time in seconds");
      stop();
      fixedTime = seconds;
      render(seconds);
      const axis = new THREE.Vector3(0, 1, 0).applyQuaternion(pole.quaternion);
      return {
        seconds,
        axis: axis.toArray(),
        rotation: globe.rotation.y,
        tilt: Math.atan2(axis.x, axis.y) / RADIANS,
        actors: actors.actorCount,
        clouds: clouds.cloudCount,
        terrain: terrain.surfaceRadius(27.99, 86.92) - 1,
        drawCalls: renderer.info.render.calls,
        triangles: renderer.info.render.triangles,
      };
    };
    window.__EWM_EARTH_READY__ = true;
    window.__EWM_EARTH_SCENE__ = { scene, globe, renderer };
  }

  canvas.addEventListener("webglcontextlost", event => {
    event.preventDefault();
    contextLost = true;
    hero.removeAttribute("data-ready");
    stop();
  });
  canvas.addEventListener("webglcontextrestored", () => {
    contextLost = false;
    resize();
    hero.setAttribute("data-ready", "");
    schedule();
  });
  new ResizeObserver(resize).observe(hero);
  new IntersectionObserver(([entry]) => {
    visible = entry.isIntersecting;
    if (visible) schedule();
    else stop();
  }).observe(hero);
  document.addEventListener("visibilitychange", () => {
    if (document.hidden) stop();
    else schedule();
  });
  reduce.addEventListener("change", () => {
    if (reduce.matches) stop();
    else schedule();
  });

  resize();
  hero.setAttribute("data-ready", "");
  schedule();
}

mount().catch(error => {
  if (capture) window.__EWM_EARTH_ERROR__ = String(error);
  console.warn("Earth scene unavailable", error);
});
