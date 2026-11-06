import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { clone } from 'three/addons/utils/SkeletonUtils.js';

// Selected inland routes from the original globe, in [latitude, longitude].
const ROUTES = {
  europeBank: ['bank', [[49.8, 9.0], [50.6, 13.8], [49.4, 18.1]]],
  europeWorker: [0, [[47.2, 1.1], [46.5, 3.8], [45.4, 5.4]]],
  eurasiaFirm: ['firm', [[54.8, 36.5], [56.0, 43.2], [54.2, 50.5]]],
  saharaCourt: ['court', [[26.3, 22.0], [28.2, 25.2], [27.6, 29.0]]],
  westAfricaMarket: ['market', [[11.5, -5.5], [10.6, -1.0], [11.2, 3.4]]],
  eastAfricaWorker: [3, [[-9.9, 31.8], [-12.2, 31.0], [-14.2, 32.1]]],
  southAfricaFirm: ['firm', [[-24.0, 20.4], [-25.0, 24.0], [-27.0, 26.7]]],
  northAmericaFirm: ['firm', [[44.0, -108.7], [44.5, -103.5], [41.2, -101.0]]],
  northAmericaWorker: [2, [[38.4, -90.0], [39.4, -84.8], [35.9, -83.0]]],
  southAmericaMarket: ['market', [[-20.0, -55.0], [-25.5, -56.0], [-28.0, -59.0]]],
  southAmericaWorker: [1, [[-9.0, -55.0], [-13.0, -51.5], [-17.7, -47.0]]],
  southAmericaBank: ['bank', [[-24.2, -63.0], [-28.8, -64.5], [-33.0, -64.0]]],
  indiaBank: ['bank', [[19.0, 74.5], [19.2, 76.7], [17.6, 78.5]]],
  indiaWorker: [4, [[26.2, 74.2], [25.7, 78.3], [25.1, 81.8]]],
  chinaFirm: ['firm', [[33.7, 113.4], [35.5, 114.8], [36.8, 115.4]]],
  chinaWorker: [0, [[30.8, 105.5], [30.2, 107.8], [29.7, 106.5]]],
  southeastAsiaMarket: ['market', [[16.7, 100.4], [16.0, 101.8], [15.7, 103.5]]],
  australiaFirm: ['firm', [[-23.6, 136.5], [-24.3, 141.0], [-27.0, 144.1]]],
  australiaWorker: [5, [[-25.0, 123.4], [-26.8, 129.4], [-28.6, 133.3]]],
};

const CONNECTIONS = [
  ['europeBank', 'europeWorker'], ['europeBank', 'eurasiaFirm'],
  ['europeBank', 'westAfricaMarket'], ['europeWorker', 'saharaCourt'],
  ['saharaCourt', 'eastAfricaWorker'], ['westAfricaMarket', 'southAfricaFirm'],
  ['eastAfricaWorker', 'southAfricaFirm'], ['northAmericaFirm', 'northAmericaWorker'],
  ['northAmericaWorker', 'southAmericaWorker'], ['southAmericaWorker', 'southAmericaMarket'],
  ['southAmericaMarket', 'southAmericaBank'], ['southAmericaBank', 'southAfricaFirm'],
  ['eurasiaFirm', 'indiaBank'], ['indiaBank', 'indiaWorker'], ['indiaWorker', 'chinaFirm'],
  ['chinaFirm', 'chinaWorker'], ['chinaFirm', 'southeastAsiaMarket'],
  ['southeastAsiaMarket', 'australiaFirm'], ['australiaFirm', 'australiaWorker'],
];

const PERSON_MODELS = ['male-a', 'female-a', 'male-c', 'female-d', 'male-e', 'female-b'];
const RAD = Math.PI / 180;
const TAU = 2 * Math.PI;
const LINK_COLORS = [0x8ac8ed, 0xb8e1ea, 0x9ddac4, 0xbfb8ea];
const smooth = x => x * x * (3 - 2 * x);
const wrap = x => x - Math.floor(x);

function direction(latitude, longitude, target) {
  const phi = latitude * RAD;
  const lambda = longitude * RAD;
  const cos = Math.cos(phi);
  return target.set(cos * Math.sin(lambda), Math.sin(phi), cos * Math.cos(lambda));
}

function groundRadius(normal, surfaceRadius) {
  const latitude = Math.asin(THREE.MathUtils.clamp(normal.y, -1, 1)) / RAD;
  const longitude = Math.atan2(normal.x, normal.z) / RAD;
  return surfaceRadius(latitude, longitude);
}

function positionOnRoute(actor, seconds, target) {
  const progress = wrap(seconds / actor.period + actor.phase) * actor.waypoints.length;
  const leg = Math.floor(progress);
  const [latA, lonA] = actor.waypoints[leg];
  const [latB, lonB] = actor.waypoints[(leg + 1) % actor.waypoints.length];
  const mix = smooth(progress - leg);
  target.set(THREE.MathUtils.lerp(latA, latB, mix), THREE.MathUtils.lerp(lonA, lonB, mix));
}

function addEdgeLight(material, strength, fill) {
  material.onBeforeCompile = shader => {
    shader.uniforms.earthEdge = { value: new THREE.Color(0xb8e3ff).multiplyScalar(strength) };
    shader.uniforms.earthFill = { value: new THREE.Vector3(fill, fill * 1.17, fill * 1.35) };
    shader.fragmentShader = shader.fragmentShader.replace(
      '#include <common>', '#include <common>\nuniform vec3 earthEdge;\nuniform vec3 earthFill;'
    ).replace('#include <map_fragment>', `#include <map_fragment>
      diffuseColor.rgb = diffuseColor.rgb + earthFill * (1.0 - diffuseColor.rgb);`
    ).replace('#include <emissivemap_fragment>', `#include <emissivemap_fragment>
      float rim = 1.0 - abs(dot(normal, vec3(0.0, 0.0, 1.0)));
      totalEmissiveRadiance += earthEdge * smoothstep(0.42, 1.0, rim) * rim;`);
  };
  material.customProgramCacheKey = () => 'ewm-earth-radial-edge';
  return material;
}

function prepareMaterials(model, cache, person) {
  model.traverse(mesh => {
    if (!mesh.isMesh) return;
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    const source = mesh.material;
    if (!cache.has(source)) {
      const material = source.clone();
      material.roughness = 0.85;
      material.metalness = 0;
      const fill = source.map ? (person ? 0.034 : 0.075) : 0;
      cache.set(source, addEdgeLight(material, 0.17, fill));
    }
    mesh.material = cache.get(source);
  });
}

function civicBuilding(kind) {
  const model = new THREE.Group();
  const stone = new THREE.MeshStandardMaterial({ color: 0xdce4ec, roughness: 0.86 });
  const trim = new THREE.MeshStandardMaterial({ color: 0xa2b4c6, roughness: 0.83 });
  const roof = new THREE.MeshStandardMaterial({ color: kind === 'bank' ? 0x7f81bd : 0x6695b3, roughness: 0.8 });
  const add = (geometry, material, x, y, z) => {
    const mesh = new THREE.Mesh(geometry, material);
    mesh.position.set(x, y, z);
    model.add(mesh);
  };
  const box = (w, h, d, m, x, y, z) => add(new THREE.BoxGeometry(w, h, d), m, x, y, z);
  box(2.75, 0.17, 2.17, trim, 0, 0.085, 0);
  box(2.52, 0.14, 1.94, stone, 0, 0.24, 0);
  box(2.18, 1.12, 1.37, trim, 0, 0.85, -0.2);
  const column = new THREE.CylinderGeometry(0.11, 0.14, 1.13, 10);
  for (let x = -0.96; x <= 1; x += 0.48) add(column, stone, x, 0.87, 0.75);
  box(2.5, 0.21, 1.9, stone, 0, 1.48, 0);
  if (kind === 'bank') {
    const gable = new THREE.Shape().moveTo(-1.26, 0).lineTo(1.26, 0).lineTo(0, 0.59).closePath();
    const geometry = new THREE.ExtrudeGeometry(gable, { depth: 1.87, bevelEnabled: false });
    add(geometry, roof, 0, 1.59, -0.935);
    const brass = new THREE.MeshStandardMaterial({ color: 0xd5b775, roughness: 0.62 });
    box(0.7, 0.16, 0.05, brass, 0, 1.48, 0.96);
  } else {
    box(2.25, 0.13, 1.65, roof, 0, 1.65, 0);
    add(new THREE.CylinderGeometry(0.51, 0.54, 0.17, 20), stone, 0, 1.80, -0.12);
    add(new THREE.SphereGeometry(0.5, 20, 10, 0, TAU, 0, Math.PI / 2), roof, 0, 1.885, -0.12);
  }
  return model;
}

function addMarketTicker(model, top) {
  const green = new THREE.MeshStandardMaterial({ color: 0x75d6af, emissive: 0x072f20, roughness: 0.74 });
  const rose = new THREE.MeshStandardMaterial({ color: 0xed8c99, emissive: 0x341016, roughness: 0.74 });
  [0.18, 0.31, 0.22, 0.38, 0.32].forEach((height, index) => {
    const mesh = new THREE.Mesh(new THREE.BoxGeometry(0.10, height, 0.1), index === 2 ? rose : green);
    mesh.position.set(-0.30 + index * 0.15, top + height / 2, -0.06);
    model.add(mesh);
  });
}

function fittedModel(model, height) {
  model.updateMatrixWorld(true);
  const bounds = new THREE.Box3().setFromObject(model);
  const center = bounds.getCenter(new THREE.Vector3());
  const size = bounds.getSize(new THREE.Vector3());
  const holder = new THREE.Group();
  const scale = height / size.y;
  holder.scale.setScalar(scale);
  model.position.sub(new THREE.Vector3(center.x, bounds.min.y, center.z));
  holder.add(model);
  return { holder, footprint: Math.max(size.x, size.z) * scale * 0.5 };
}

function makeContactShadow(parent, radius, material) {
  const geometry = new THREE.PlaneGeometry(2, 2, 4, 4);
  const original = geometry.attributes.position.array.slice();
  const colors = [];
  for (let i = 0; i < original.length; i += 3) {
    const distance = Math.hypot(original[i], original[i + 1]);
    colors.push(1, 1, 1, Math.max(0, 1 - distance) ** 1.7 * 0.4);
  }
  geometry.setAttribute('color', new THREE.Float32BufferAttribute(colors, 4));
  const mesh = new THREE.Mesh(geometry, material);
  mesh.frustumCulled = false;
  mesh.renderOrder = 1;
  parent.add(mesh);
  return { mesh, original, radius };
}

function conformContactShadow(shadow, radial, east, south, surfaceRadius, point) {
  const position = shadow.mesh.geometry.attributes.position;
  for (let i = 0; i < position.count; i++) {
    const offset = i * 3;
    point.copy(radial)
      .addScaledVector(east, shadow.original[offset] * shadow.radius)
      .addScaledVector(south, shadow.original[offset + 1] * shadow.radius)
      .normalize();
    point.multiplyScalar(groundRadius(point, surfaceRadius) + 0.0008);
    position.setXYZ(i, point.x, point.y, point.z);
  }
  position.needsUpdate = true;
}

const LINK_STEPS = 24;
const LINK_SIDES = 5;
function makeLinkMesh(material, name) {
  const geometry = new THREE.BufferGeometry();
  const position = new THREE.BufferAttribute(new Float32Array((LINK_STEPS + 1) * LINK_SIDES * 3), 3);
  position.setUsage(THREE.DynamicDrawUsage);
  geometry.setAttribute('position', position);
  const indices = [];
  for (let i = 0; i < LINK_STEPS; i++) {
    for (let j = 0; j < LINK_SIDES; j++) {
      const a = i * LINK_SIDES + j;
      const b = i * LINK_SIDES + (j + 1) % LINK_SIDES;
      indices.push(a, b, a + LINK_SIDES, b, b + LINK_SIDES, a + LINK_SIDES);
    }
  }
  geometry.setIndex(indices);
  const mesh = new THREE.Mesh(geometry, material);
  mesh.name = name;
  mesh.frustumCulled = false;
  mesh.renderOrder = 2;
  return mesh;
}

function pointOnLink(link, t, point) {
  if (t === 0) return point.copy(link.from.anchor.position);
  if (t === 1) return point.copy(link.to.anchor.position);
  return point.lerpVectors(link.from.radial, link.to.radial, t).normalize()
    .multiplyScalar(THREE.MathUtils.lerp(link.from.radius, link.to.radius, t) + Math.sin(Math.PI * t) * link.lift);
}

function updateLink(link, tangent, side, up, scratch) {
  link.lift = THREE.MathUtils.clamp(link.from.radial.distanceTo(link.to.radial) * 0.087, 0.007, 0.098);
  for (let i = 0; i <= LINK_STEPS; i++) pointOnLink(link, i / LINK_STEPS, link.points[i]);
  const position = link.mesh.geometry.attributes.position;
  for (let i = 0; i <= LINK_STEPS; i++) {
    const center = link.points[i];
    tangent.subVectors(link.points[Math.min(i + 1, LINK_STEPS)], link.points[Math.max(i - 1, 0)]).normalize();
    side.crossVectors(tangent, center).normalize();
    up.crossVectors(side, tangent).normalize();
    for (let j = 0; j < LINK_SIDES; j++) {
      const angle = TAU * j / LINK_SIDES;
      scratch.copy(center).addScaledVector(side, Math.cos(angle) * 0.00135).addScaledVector(up, Math.sin(angle) * 0.00135);
      position.setXYZ(i * LINK_SIDES + j, scratch.x, scratch.y, scratch.z);
    }
  }
  position.needsUpdate = true;
}

export async function createEarthActors({ parent, surfaceRadius, assetRoot }) {
  const loader = new GLTFLoader().setPath(assetRoot);
  const [people, firm, market] = await Promise.all([
    Promise.all(PERSON_MODELS.map(name => loader.loadAsync(`people/character-${name}.glb`))),
    loader.loadAsync('commercial/firm.glb'),
    loader.loadAsync('commercial/market.glb'),
  ]);
  const marketBounds = new THREE.Box3().setFromObject(market.scene);
  addMarketTicker(market.scene, marketBounds.max.y);
  const templates = { firm: firm.scene, market: market.scene, bank: civicBuilding('bank'), court: civicBuilding('court') };
  const actors = new THREE.Group();
  actors.name = 'Earth surface actors';
  parent.add(actors);
  const shadows = new THREE.Group();
  shadows.name = 'Earth surface contact shade';
  parent.add(shadows);
  const network = new THREE.Group();
  network.name = 'Earth network';
  parent.add(network);
  const shadowMaterial = new THREE.MeshBasicMaterial({ color: 0x031424, vertexColors: true, transparent: true, depthWrite: false, side: THREE.DoubleSide });
  const materialCache = new WeakMap();
  const nodes = Object.entries(ROUTES).map(([name, [kind, waypoints]], index) => {
    const person = typeof kind === 'number';
    const model = person ? clone(people[kind].scene) : templates[kind].clone(true);
    prepareMaterials(model, materialCache, person);
    const height = person ? 0.094 : kind === 'firm' ? 0.113 : 0.094;
    const { holder, footprint } = fittedModel(model, height);
    const anchor = new THREE.Group();
    anchor.name = name;
    const orientation = new THREE.Group();
    orientation.add(holder);
    anchor.add(orientation);
    actors.add(anchor);
    const shadow = makeContactShadow(shadows, footprint * 1.32, shadowMaterial);
    let mixer;
    if (person) {
      mixer = new THREE.AnimationMixer(model);
      mixer.clipAction(THREE.AnimationClip.findByName(people[kind].animations, 'walk')).play();
    } else {
      orientation.rotation.y = -0.55 + (index % 3) * 0.23;
    }
    return {
      name, anchor, orientation, shadow, mixer, waypoints, height,
      period: person ? 21 + (index % 5) * 1.8 : 36 + (index % 4) * 4,
      phase: wrap(index * 0.271), radial: new THREE.Vector3(), radius: 1,
    };
  });
  const byName = Object.fromEntries(nodes.map(node => [node.name, node]));
  const linkMaterials = LINK_COLORS.map(color => new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.49, depthWrite: false, side: THREE.DoubleSide }));
  const links = CONNECTIONS.map(([from, to], index) => {
    const mesh = makeLinkMesh(linkMaterials[index % LINK_COLORS.length], `${from} to ${to}`);
    network.add(mesh);
    return { from: byName[from], to: byName[to], mesh, lift: 0, points: Array.from({ length: LINK_STEPS + 1 }, () => new THREE.Vector3()) };
  });
  const pulses = new THREE.InstancedMesh(new THREE.SphereGeometry(1, 8, 6), new THREE.MeshBasicMaterial({ color: 0xffffff }), links.length);
  pulses.name = 'Moving network signals';
  pulses.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
  pulses.frustumCulled = false;
  const color = new THREE.Color();
  links.forEach((_, index) => pulses.setColorAt(index, color.setHex(LINK_COLORS[index % LINK_COLORS.length]).lerp(new THREE.Color(0xe8f6ff), 0.44)));
  network.add(pulses);

  const coords = new THREE.Vector2();
  const east = new THREE.Vector3(), south = new THREE.Vector3();
  const previous = new THREE.Vector3(), next = new THREE.Vector3(), heading = new THREE.Vector3();
  const scratch = new THREE.Vector3();
  const matrix = new THREE.Matrix4();
  const pulse = new THREE.Object3D();

  function update(seconds) {
    nodes.forEach((node, index) => {
      positionOnRoute(node, seconds, coords);
      const latitude = coords.x;
      const longitude = coords.y;
      node.anchor.userData.latitude = latitude;
      node.anchor.userData.longitude = longitude;
      direction(latitude, longitude, node.radial);
      node.radius = surfaceRadius(latitude, longitude);
      node.anchor.position.copy(node.radial).multiplyScalar(node.radius);
      east.set(Math.cos(longitude * RAD), 0, -Math.sin(longitude * RAD));
      south.crossVectors(east, node.radial);
      node.anchor.quaternion.setFromRotationMatrix(matrix.makeBasis(east, node.radial, south));
      conformContactShadow(node.shadow, node.radial, east, south, surfaceRadius, scratch);
      if (node.mixer) {
        positionOnRoute(node, seconds - 0.35, coords);
        direction(coords.x, coords.y, previous);
        positionOnRoute(node, seconds + 0.35, coords);
        direction(coords.x, coords.y, next);
        heading.subVectors(next, previous);
        if (heading.lengthSq() > 1e-10) node.orientation.rotation.y = Math.atan2(heading.dot(east), heading.dot(south));
        node.mixer.setTime(seconds * 0.84 + index * 0.317);
      }
    });
    links.forEach((link, index) => {
      updateLink(link, heading, east, south, scratch);
      const progress = wrap(seconds * (0.14 + (index % 4) * 0.017) + index * 0.137);
      pointOnLink(link, progress, pulse.position);
      pulse.scale.setScalar(0.0036 * Math.sin(Math.PI * progress) + 0.0001);
      pulse.updateMatrix();
      pulses.setMatrixAt(index, pulse.matrix);
    });
    pulses.instanceMatrix.needsUpdate = true;
  }
  update(0);
  return { update, actorCount: nodes.length };
}
