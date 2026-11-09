import * as THREE from 'three';

// Short closed routes stay in open water, well clear of coasts and islands.
// Latitude/longitude are the centre and half-width of each ocean ellipse.
const ROUTES = [
  { name: 'North Atlantic cruise', latitude: 27.5, longitude: -37, latSpan: 4.5, lonSpan: 6, period: 106, phase: 0.10 },
  { name: 'South Atlantic cruise', latitude: -19, longitude: -18, latSpan: 4, lonSpan: 5, period: 113, phase: 0.58 },
  { name: 'Indian Ocean cruise', latitude: -20, longitude: 72, latSpan: 3, lonSpan: 5, period: 98, phase: 0.32 },
  { name: 'Pacific Ocean cruise', latitude: 10, longitude: -143, latSpan: 6, lonSpan: 5, period: 121, phase: 0.73 },
];
const RAD = Math.PI / 180;
const TAU = Math.PI * 2;
const SEA_RADIUS = 1.005;

function cruiseGeometry() {
  const positions = [], normals = [], colors = [];
  const color = new THREE.Color();
  function add(source, tint) {
    const geometry = source.index ? source.toNonIndexed() : source;
    color.setHex(tint);
    const p = geometry.getAttribute('position'), n = geometry.getAttribute('normal');
    for (let i = 0; i < p.count; i++) {
      positions.push(p.getX(i), p.getY(i), p.getZ(i));
      normals.push(n.getX(i), n.getY(i), n.getZ(i));
      colors.push(color.r, color.g, color.b);
    }
    if (geometry !== source) geometry.dispose();
    source.dispose();
  }
  const box = (w, h, d, x, y, z, tint) => add(new THREE.BoxGeometry(w, h, d).translate(x, y, z), tint);
  function deck(points, height, depth, tint) {
    const shape = new THREE.Shape(points.map(([x, z]) => new THREE.Vector2(x, z)));
    add(new THREE.ExtrudeGeometry(shape, { depth, bevelEnabled: false })
      .rotateX(Math.PI / 2).translate(0, height, 0), tint);
  }

  // A narrow pointed bow, dark hull and stepped white decks read as a cruise
  // ship at the same miniature scale as the globe's people and aircraft.
  const outline = [[0, 0.049], [-0.012, 0.032], [-0.015, -0.030], [-0.012, -0.045],
    [0.012, -0.045], [0.015, -0.030], [0.012, 0.032]];
  deck(outline, 0.011, 0.010, 0x31566f);
  deck(outline.map(([x, z]) => [x * 0.98, z * 0.98]), 0.013, 0.002, 0xe9f0ef);
  box(0.023, 0.009, 0.068, 0, 0.0175, -0.003, 0xf4f3e9);
  box(0.020, 0.007, 0.058, 0, 0.0255, -0.005, 0xe6eff1);
  box(0.018, 0.003, 0.046, 0, 0.0305, -0.007, 0xf9f6e9);
  box(0.019, 0.006, 0.011, 0, 0.032, 0.023, 0xf5f5ef);
  // Long navy glazing bands and small orange lifeboats are legible without
  // introducing textures or extra draw calls.
  for (const side of [-1, 1]) {
    box(0.0006, 0.002, 0.057, side * 0.01165, 0.019, -0.003, 0x416e86);
    box(0.0006, 0.0018, 0.047, side * 0.01015, 0.0265, -0.005, 0x416e86);
    for (const z of [-0.018, -0.002]) {
      box(0.0035, 0.0025, 0.010, side * 0.013, 0.0155, z, 0xefb17b);
    }
  }
  box(0.016, 0.002, 0.0006, 0, 0.0325, 0.0287, 0x416e86);
  for (const z of [-0.016, -0.006]) {
    box(0.006, 0.008, 0.006, 0, 0.036, z, 0x86bacc);
    box(0.0065, 0.0015, 0.0065, 0, 0.0405, z, 0x41647b);
  }
  box(0.0009, 0.011, 0.0009, 0, 0.0405, 0.023, 0xc4d5dd);
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geometry.setAttribute('normal', new THREE.Float32BufferAttribute(normals, 3));
  geometry.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
  geometry.computeBoundingSphere();
  return geometry;
}

function wakeGeometry() {
  const geometry = new THREE.BufferGeometry();
  // Two short ribbons trail behind the stern, with the central water visible.
  geometry.setAttribute('position', new THREE.Float32BufferAttribute([
    -0.008, 0, -0.041, -0.021, 0, -0.078, -0.016, 0, -0.074,
    0.008, 0, -0.041, 0.016, 0, -0.074, 0.021, 0, -0.078,
  ], 3));
  geometry.computeBoundingSphere();
  return geometry;
}

export function createEarthCruises({ parent }) {
  const group = new THREE.Group();
  group.name = 'Earth ocean cruises';
  parent.add(group);
  const geometry = cruiseGeometry(), wake = wakeGeometry();
  const material = new THREE.MeshStandardMaterial({
    vertexColors: true, roughness: 0.85, metalness: 0, flatShading: true,
    emissive: 0x102330, emissiveIntensity: 0.16,
  });
  const wakeMaterial = new THREE.MeshBasicMaterial({
    color: 0xc4f1ef, transparent: true, opacity: 0.25, depthWrite: false,
    side: THREE.DoubleSide, toneMapped: false,
  });
  const cruises = ROUTES.map(route => {
    const anchor = new THREE.Group();
    anchor.name = route.name;
    anchor.userData.route = { latitude: route.latitude, longitude: route.longitude,
      latSpan: route.latSpan, lonSpan: route.lonSpan, period: route.period };
    const model = new THREE.Mesh(geometry, material);
    model.name = 'Cruise ship';
    const trail = new THREE.Mesh(wake, wakeMaterial);
    trail.name = 'Short wake';
    anchor.add(model, trail);
    group.add(anchor);
    return { ...route, anchor };
  });
  const up = new THREE.Vector3(), east = new THREE.Vector3(), north = new THREE.Vector3();
  const forward = new THREE.Vector3(), right = new THREE.Vector3();
  const matrix = new THREE.Matrix4();

  function update(seconds) {
    for (const cruise of cruises) {
      const phase = seconds / cruise.period + cruise.phase;
      const angle = (phase - Math.floor(phase)) * TAU;
      const sine = Math.sin(angle), cosine = Math.cos(angle);
      const latitude = cruise.latitude + cruise.latSpan * sine;
      const longitude = cruise.longitude + cruise.lonSpan * cosine;
      const phi = latitude * RAD, lambda = longitude * RAD;
      const sinPhi = Math.sin(phi), cosPhi = Math.cos(phi);
      const sinLambda = Math.sin(lambda), cosLambda = Math.cos(lambda);
      up.set(cosPhi * sinLambda, sinPhi, cosPhi * cosLambda);
      east.set(cosLambda, 0, -sinLambda);
      north.set(-sinPhi * sinLambda, cosPhi, -sinPhi * cosLambda);
      // The analytic derivative keeps the bow aligned through the closed loop,
      // including its periodic seam; there is no arrival reset or jump.
      forward.copy(north).multiplyScalar(cruise.latSpan * cosine)
        .addScaledVector(east, -cruise.lonSpan * sine * cosPhi).normalize();
      right.crossVectors(up, forward).normalize();
      cruise.anchor.position.copy(up).multiplyScalar(SEA_RADIUS);
      cruise.anchor.quaternion.setFromRotationMatrix(matrix.makeBasis(right, up, forward));
      cruise.anchor.userData.latitude = latitude;
      cruise.anchor.userData.longitude = longitude;
    }
  }
  update(0);
  return { update, cruiseCount: cruises.length, group,
    dispose() { parent.remove(group); geometry.dispose(); wake.dispose(); material.dispose(); wakeMaterial.dispose(); } };
}
