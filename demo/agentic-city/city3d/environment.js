import * as T from 'three';

const clamp = T.MathUtils.clamp;
const mix = T.MathUtils.lerp;
const smooth = T.MathUtils.smoothstep;
const radians = T.MathUtils.degToRad;

// All directions use the city's east/north/up (X/Y/Z) coordinates.
const skyVertex = /* glsl */`
varying vec3 vDirection;
void main() {
  vDirection = position;
  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
}`;

const skyFragment = /* glsl */`
uniform vec3 topColor;
uniform vec3 horizonColor;
uniform vec3 lowerColor;
uniform vec3 cloudColor;
uniform vec3 sunDirection;
uniform vec3 moonDirection;
uniform float daylight;
uniform float cloudCover;
uniform float sunVisible;
uniform float moonVisible;
uniform float moonFraction;
uniform float moonAngle;
uniform float skyTime;
varying vec3 vDirection;

float hash(vec2 p) {
  return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453123);
}
float noise(vec2 p) {
  vec2 cell = floor(p), f = fract(p);
  f = f * f * (3.0 - 2.0 * f);
  return mix(mix(hash(cell), hash(cell + vec2(1., 0.)), f.x),
             mix(hash(cell + vec2(0., 1.)), hash(cell + vec2(1.)), f.x), f.y);
}
float clouds(vec2 p) {
  return noise(p) * .57 + noise(p * 2.03 + 7.1) * .29 + noise(p * 4.07) * .14;
}
void main() {
  vec3 direction = normalize(vDirection);
  float height = max(direction.z, 0.0);
  vec3 color = mix(horizonColor, topColor, pow(height, .5));
  color = mix(color, lowerColor, 1. - smoothstep(-.38, .01, direction.z));

  // Clouds occupy the upper hemisphere and drift slowly across the horizon.
  vec2 cloudUV = direction.xy / max(.24, direction.z + .35) * 2.4;
  float cloudNoise = clouds(cloudUV + vec2(skyTime * .006, skyTime * .002));
  float cover = smoothstep(1.0 - cloudCover, 1.22 - cloudCover, cloudNoise);
  cover *= smoothstep(-.025, .12, direction.z) * clamp(cloudCover * 1.5, 0., 1.);
  float transmission = 1. - cover * .98;

  // Sparse, quiet stars rather than a bright planetarium backdrop.
  vec2 starUV = vec2(atan(direction.y, direction.x), asin(direction.z)) * vec2(90., 115.);
  vec2 starCell = floor(starUV), starLocal = fract(starUV);
  vec2 starPoint = vec2(hash(starCell + 9.), hash(starCell + 21.));
  float star = (1. - smoothstep(.015, .075, length(starLocal - starPoint)))
             * step(.995, hash(starCell)) * smoothstep(.02, .2, direction.z);
  color += vec3(.42, .5, .68) * star * (1. - daylight) * transmission;

  float sunDot = max(dot(direction, sunDirection), 0.);
  float sunDisc = smoothstep(.99990, .99995, sunDot);
  float sunHalo = pow(sunDot, 380.) * .23 + pow(sunDot, 35.) * .045;
  color += vec3(1., .72, .36) * (sunDisc * 2.6 + sunHalo) * sunVisible * transmission;

  // Shading a sphere gives the illuminated fraction of the actual lunar disk.
  vec3 moonRight = cross(vec3(0., 0., 1.), moonDirection);
  if (length(moonRight) < .01) moonRight = vec3(1., 0., 0.);
  moonRight = normalize(moonRight);
  vec3 moonUp = normalize(cross(moonDirection, moonRight));
  float moonRadius = .0085;
  vec2 disk = vec2(dot(direction, moonRight), dot(direction, moonUp)) / moonRadius;
  float radiusSquared = dot(disk, disk);
  if (radiusSquared < 1. && dot(direction, moonDirection) > .99) {
    float z = sqrt(max(0., 1. - radiusSquared));
    float lightZ = moonFraction * 2. - 1.;
    float lightSide = sqrt(max(0., 1. - lightZ * lightZ));
    // The bright-limb angle is already supplied in the observer's sky basis.
    vec3 lunarLight = vec3(sin(moonAngle) * lightSide, cos(moonAngle) * lightSide, lightZ);
    vec3 normal = vec3(disk, z);
    float lit = smoothstep(-.035, .055, dot(normal, lunarLight));
    float edge = 1. - smoothstep(.91, 1., radiusSquared);
    float textureTone = .88 + noise(disk * 7. + 13.) * .12;
    vec3 lunarColor = vec3(.78, .84, .95) * textureTone * lit;
    color = mix(color, lunarColor, edge * moonVisible * transmission);
  }

  color = mix(color, cloudColor * (.91 + cloudNoise * .15), cover * .89);
  gl_FragColor = vec4(color, 1.);
  #include <tonemapping_fragment>
  #include <colorspace_fragment>
}`;

const rainVertex = /* glsl */`
uniform float rainTime;
attribute float endpoint;
varying float vOpacity;
void main() {
  float phase = fract(position.z - rainTime * (.28 + fract(position.x * 13.) * .12));
  vec3 p = vec3(position.xy * 190., (phase - .5) * 240.);
  p.x += endpoint * .65;
  p.z -= endpoint * 3.4;
  vOpacity = smoothstep(0., .12, phase) * (1. - smoothstep(.86, 1., phase));
  gl_Position = projectionMatrix * modelViewMatrix * vec4(p, 1.);
}`;

const rainFragment = /* glsl */`
uniform vec3 rainColor;
uniform float rainOpacity;
varying float vOpacity;
void main() {
  gl_FragColor = vec4(rainColor, rainOpacity * vOpacity);
  #include <tonemapping_fragment>
  #include <colorspace_fragment>
}`;

function directionOf(value, fallback) {
  const direction = new T.Vector3(...(value || fallback));
  return direction.lengthSq() > .0001 ? direction.normalize() : new T.Vector3(...fallback).normalize();
}

/** A small, display-only environment. City meshes and planning data stay untouched. */
export function createEnvironment({scene, camera, renderer, controls, sunLight, hemisphere, reducedMotion = false}) {
  const original = {
    background: scene.background,
    fog: scene.fog,
    exposure: renderer.toneMappingExposure,
    hemisphereColor: hemisphere.color.clone(),
    groundColor: hemisphere.groundColor.clone(),
    hemisphereIntensity: hemisphere.intensity,
    hemispherePosition: hemisphere.position.clone(),
    sunColor: sunLight.color.clone(),
    sunIntensity: sunLight.intensity,
    sunPosition: sunLight.position.clone(),
    sunTarget: sunLight.target.position.clone(),
    sunCastShadow: sunLight.castShadow
  };
  const group = new T.Group();
  group.name = 'Hong Kong sky and weather';
  scene.add(group);
  scene.background = new T.Color('#182b49');
  hemisphere.position.set(0, 0, 1);

  const uniforms = {
    topColor: {value: new T.Color('#407eb6')},
    horizonColor: {value: new T.Color('#a6c3d4')},
    lowerColor: {value: new T.Color('#8eaab7')},
    cloudColor: {value: new T.Color('#c2d0da')},
    sunDirection: {value: new T.Vector3(0, 0, 1)},
    moonDirection: {value: new T.Vector3(0, 0, -1)},
    daylight: {value: 1}, cloudCover: {value: .3}, sunVisible: {value: 1},
    moonVisible: {value: 0}, moonFraction: {value: .5}, moonAngle: {value: 0},
    skyTime: {value: 0}
  };
  const skyMaterial = new T.ShaderMaterial({
    uniforms, vertexShader: skyVertex, fragmentShader: skyFragment,
    side: T.BackSide, depthWrite: false, depthTest: false, fog: false
  });
  const skyGeometry = new T.SphereGeometry(48000, 24, 16);
  const sky = new T.Mesh(skyGeometry, skyMaterial);
  sky.name = 'Procedural sky';
  sky.frustumCulled = false;
  sky.renderOrder = -1000;
  sky.raycast = () => {};
  group.add(sky);

  const maxRain = (renderer.domElement.clientWidth || 900) < 600 ? 320 : 900;
  const rainPositions = new Float32Array(maxRain * 6);
  const endpoints = new Float32Array(maxRain * 2);
  // Deterministic particles also keep preview screenshots repeatable.
  let seed = 7391;
  const random = () => { seed = (seed * 16807) % 2147483647; return (seed - 1) / 2147483646; };
  for (let i = 0; i < maxRain; i++) {
    const x = random() * 2 - 1, y = random() * 2 - 1, z = random();
    rainPositions.set([x, y, z, x, y, z], i * 6);
    endpoints[i * 2 + 1] = 1;
  }
  const rainGeometry = new T.BufferGeometry();
  rainGeometry.setAttribute('position', new T.BufferAttribute(rainPositions, 3));
  rainGeometry.setAttribute('endpoint', new T.BufferAttribute(endpoints, 1));
  rainGeometry.setDrawRange(0, 0);
  const rainUniforms = {
    rainTime: {value: 0},
    rainColor: {value: new T.Color('#bdd5e8')}, rainOpacity: {value: 0}
  };
  const rainMaterial = new T.ShaderMaterial({
    uniforms: rainUniforms, vertexShader: rainVertex, fragmentShader: rainFragment,
    transparent: true, depthTest: true, depthWrite: false, fog: false
  });
  const rain = new T.LineSegments(rainGeometry, rainMaterial);
  rain.name = 'Local rain';
  rain.frustumCulled = false;
  rain.raycast = () => {};
  group.add(rain);

  const moonLight = new T.DirectionalLight('#9db5e3', 0);
  moonLight.name = 'Soft moonlight';
  moonLight.castShadow = false;
  group.add(moonLight, moonLight.target);
  const planningFill = new T.AmbientLight('#c8d4e8', 0);
  planningFill.name = 'Night planning fill';
  group.add(planningFill);

  const fog = new T.Fog('#a6c3d4', 3000, 16000);
  scene.fog = fog;
  const sunDirection = new T.Vector3(0, 0, 1);
  const moonDirection = new T.Vector3(0, 0, -1);
  const current = {daylight: 1, twilight: 0, cloud: .3, rain: 0, fog: 0, sunAltitude: 50, moonAltitude: -20, fraction: .5, angle: 0};
  let target = {...current, sunDirection: sunDirection.clone(), moonDirection: moonDirection.clone()};
  let weatherKey = 'neutral', disposed = false, elapsed = 0, shadowExtent = -1;

  const colors = {
    nightTop: new T.Color('#07152e'), dayTop: new T.Color('#397fb6'),
    nightHorizon: new T.Color('#253d58'), dayHorizon: new T.Color('#a3c6d9'),
    nightLower: new T.Color('#20364c'), dayLower: new T.Color('#406683'),
    sunset: new T.Color('#dd9271'), nightCloud: new T.Color('#26364d'),
    dayCloud: new T.Color('#bac8d0'), stormCloud: new T.Color('#7d8e9a'),
    nightSkyLight: new T.Color('#bacbe7'), daySkyLight: new T.Color('#dcecff'),
    nightGround: new T.Color('#8597b2'), dayGround: new T.Color('#a8a99c'),
    sunWarm: new T.Color('#ffd0a0'), sunDay: new T.Color('#fff5e4')
  };

  function updateShadowTarget() {
    const distance = camera.position.distanceTo(controls.target);
    const extent = Math.min(2500, Math.max(300, distance * .6));
    if (Math.abs(extent - shadowExtent) > .01) {
      Object.assign(sunLight.shadow.camera, {left: -extent, bottom: -extent, right: extent, top: extent});
      sunLight.shadow.camera.updateProjectionMatrix();
      shadowExtent = extent;
    }
    sunLight.target.position.copy(controls.target);
    sunLight.position.copy(controls.target).addScaledVector(sunDirection, 9000);
    moonLight.target.position.copy(controls.target);
    moonLight.position.copy(controls.target).addScaledVector(moonDirection, 9000);
    const haze = clamp(current.fog * .72 + current.rain * .17 + current.cloud * .07, 0, 1);
    fog.near = Math.max(250, distance * (1.5 - haze * .65) + 1200 * (1 - haze));
    fog.far = fog.near + Math.max(6500, distance * 2.8) * (1 - haze * .35);
  }

  function applyLighting() {
    const day = current.daylight;
    const warmth = (1 - smooth(Math.abs(current.sunAltitude - 1), 0, 12)) * (1 - current.cloud * .7);
    uniforms.topColor.value.copy(colors.nightTop).lerp(colors.dayTop, day);
    uniforms.horizonColor.value.copy(colors.nightHorizon).lerp(colors.dayHorizon, day).lerp(colors.sunset, warmth * .45);
    uniforms.lowerColor.value.copy(colors.nightLower).lerp(colors.dayLower, day);
    uniforms.cloudColor.value.copy(colors.nightCloud).lerp(colors.dayCloud, day);
    if (current.rain > .2) uniforms.cloudColor.value.lerp(colors.stormCloud, current.rain * day * .45);
    // The planning camera looks below the horizon: carry the weather tint
    // through that backdrop too, without moving celestial objects off the sky.
    uniforms.lowerColor.value.lerp(uniforms.cloudColor.value, clamp(current.cloud * .5 + current.fog * .2, 0, .75));
    uniforms.sunDirection.value.copy(sunDirection);
    uniforms.moonDirection.value.copy(moonDirection);
    uniforms.daylight.value = day;
    uniforms.cloudCover.value = current.cloud;
    uniforms.sunVisible.value = smooth(current.sunAltitude, -.6, .3);
    uniforms.moonVisible.value = smooth(current.moonAltitude, 0, 1) * (1 - day * .9);
    uniforms.moonFraction.value = current.fraction;
    uniforms.moonAngle.value = current.angle;

    hemisphere.color.copy(colors.nightSkyLight).lerp(colors.daySkyLight, day);
    hemisphere.groundColor.copy(colors.nightGround).lerp(colors.dayGround, day);
    // The dark sky carries the time of day; planning surfaces retain usable light.
    hemisphere.intensity = mix(1.28, 1.48, day) * (1 - current.cloud * mix(.07, .14, day));
    planningFill.intensity = .18 * (1 - day);
    sunLight.color.copy(colors.sunWarm).lerp(colors.sunDay, smooth(current.sunAltitude, 3, 25));
    sunLight.intensity = 2.6 * smooth(current.sunAltitude, -.5, 10) * (1 - current.cloud * .78);
    sunLight.castShadow = current.sunAltitude > .1 && sunLight.intensity > .08;
    moonLight.intensity = .28 * current.fraction * (1 - day) * smooth(current.moonAltitude, 0, 6) * (1 - current.cloud * .85);
    renderer.toneMappingExposure = mix(1.12, 1.02, day);
    fog.color.copy(uniforms.horizonColor.value).lerp(uniforms.cloudColor.value, current.cloud * .35);
    scene.background.copy(fog.color);
    rain.visible = current.rain > .015 && !reducedMotion;
    rainGeometry.setDrawRange(0, Math.floor(maxRain * current.rain) * 2);
    rainUniforms.rainOpacity.value = mix(.34, .46, day) * current.rain;
    updateShadowTarget();
  }

  function setState(state, {immediate = false} = {}) {
    if (disposed) return;
    const sun = state.sun || {}, moon = state.moon || {}, weather = state.weather || {};
    weatherKey = weather.key || 'neutral';
    target = {
      daylight: clamp(state.daylight ?? 1, 0, 1), twilight: clamp(state.twilight ?? 0, 0, 1),
      cloud: clamp(weather.cloud ?? .3, 0, 1), rain: clamp(weather.rain ?? 0, 0, 1), fog: clamp(weather.fog ?? 0, 0, 1),
      sunAltitude: sun.altitude ?? 50, moonAltitude: moon.altitude ?? -20,
      fraction: clamp(moon.fraction ?? .5, 0, 1), angle: radians((moon.angle || 0) - (moon.parallacticAngle || 0)),
      sunDirection: directionOf(sun.direction, [0, 0, 1]), moonDirection: directionOf(moon.direction, [0, 0, -1])
    };
    if (immediate) {
      for (const key of Object.keys(current)) current[key] = target[key];
      sunDirection.copy(target.sunDirection);
      moonDirection.copy(target.moonDirection);
      applyLighting();
    }
  }

  function update(dtSeconds = 0) {
    if (disposed) return;
    const dt = clamp(Number.isFinite(dtSeconds) ? dtSeconds : 0, 0, .1);
    const alpha = 1 - Math.exp(-dt * 3);
    for (const key of Object.keys(current)) current[key] = mix(current[key], target[key], alpha);
    sunDirection.lerp(target.sunDirection, alpha);
    moonDirection.lerp(target.moonDirection, alpha);
    if (sunDirection.lengthSq() < .0001) sunDirection.copy(target.sunDirection);
    if (moonDirection.lengthSq() < .0001) moonDirection.copy(target.moonDirection);
    sunDirection.normalize(); moonDirection.normalize();
    if (!reducedMotion) elapsed += dt;
    uniforms.skyTime.value = elapsed;
    rainUniforms.rainTime.value = elapsed;
    sky.position.copy(camera.position);
    rain.position.copy(camera.position);
    applyLighting();
  }

  function setReducedMotion(value) {
    reducedMotion = Boolean(value);
    applyLighting();
  }

  function getDiagnostics() {
    return {
      weather: weatherKey, daylight: current.daylight, reducedMotion,
      sunVisible: uniforms.sunVisible.value, moonVisible: uniforms.moonVisible.value, cloudCover: uniforms.cloudCover.value,
      sunDirection: sunDirection.toArray(), moonDirection: moonDirection.toArray(),
      sunAltitude: current.sunAltitude, moonAltitude: current.moonAltitude, moonFraction: current.fraction,
      hemisphereIntensity: hemisphere.intensity, sunIntensity: sunLight.intensity, moonIntensity: moonLight.intensity,
      planningFillIntensity: planningFill.intensity,
      fogNear: fog.near, fogFar: fog.far, rainCount: rain.visible ? rainGeometry.drawRange.count / 2 : 0,
      renderObjects: 2, extraShadowMaps: 0
    };
  }

  function dispose() {
    if (disposed) return;
    disposed = true;
    controls.removeEventListener('change', updateShadowTarget);
    scene.remove(group);
    skyGeometry.dispose(); skyMaterial.dispose(); rainGeometry.dispose(); rainMaterial.dispose();
    scene.background = original.background; scene.fog = original.fog;
    renderer.toneMappingExposure = original.exposure;
    hemisphere.color.copy(original.hemisphereColor); hemisphere.groundColor.copy(original.groundColor);
    hemisphere.position.copy(original.hemispherePosition); hemisphere.intensity = original.hemisphereIntensity;
    sunLight.color.copy(original.sunColor); sunLight.intensity = original.sunIntensity;
    sunLight.position.copy(original.sunPosition); sunLight.target.position.copy(original.sunTarget);
    sunLight.castShadow = original.sunCastShadow;
  }

  controls.addEventListener('change', updateShadowTarget);
  applyLighting();
  return {setState, update, setReducedMotion, dispose, getDiagnostics};
}
