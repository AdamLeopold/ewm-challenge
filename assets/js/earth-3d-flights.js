import * as THREE from 'three';

// Sparse intercontinental flights share the globe's local coordinate system.
// Each model faces +Z, with +Y pointing away from the surface.
const ROUTES = [
  { name: 'North America to Europe', from: [41, -81], to: [49, 8], phase: 0.66, duration: 39 },
  { name: 'South America to Africa', from: [-16, -51], to: [-10, 28], phase: 0.36, duration: 37 },
  { name: 'Europe to Asia', from: [48, 12], to: [31, 110], phase: 0.18, duration: 43 },
  { name: 'Asia to Australia', from: [18, 101], to: [-27, 134], phase: 0.55, duration: 35 },
  { name: 'North America to East Asia', from: [42, -119], to: [37, 127], phase: 0.81, duration: 46 },
];
const RAD = Math.PI / 180;
const wrap = value => value - Math.floor(value);
const smooth = value => value * value * (3 - 2 * value);

function direction([latitude, longitude]) {
  const phi = latitude * RAD, lambda = longitude * RAD;
  return new THREE.Vector3(Math.cos(phi) * Math.sin(lambda), Math.sin(phi), Math.cos(phi) * Math.cos(lambda));
}

function airplaneGeometry() {
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
  function horizontalShape(points, height, thickness, tint) {
    const shape = new THREE.Shape(points.map(([x, z]) => new THREE.Vector2(x, z)));
    const geometry = new THREE.ExtrudeGeometry(shape, { depth: thickness, bevelEnabled: false });
    geometry.rotateX(Math.PI / 2).translate(0, height + thickness / 2, 0);
    add(geometry, tint);
  }

  // Faceted fuselage, swept wings and a conventional tail retain the existing
  // scene's small, matte toy-model proportions instead of a flat plane icon.
  const hull = new THREE.LatheGeometry([
    [0, -0.049], [0.003, -0.040], [0.008, -0.018],
    [0.009, 0.023], [0.006, 0.040], [0, 0.049],
  ].map(([radius, z]) => new THREE.Vector2(radius, z)), 8);
  add(hull.rotateX(Math.PI / 2), 0xeaf2f4);
  horizontalShape([
    [-0.007, 0.012], [-0.046, -0.010], [-0.045, -0.019], [-0.007, -0.009],
    [0.007, -0.009], [0.045, -0.019], [0.046, -0.010], [0.007, 0.012],
  ], -0.001, 0.0025, 0xb8dce9);
  horizontalShape([
    [-0.003, -0.025], [-0.022, -0.038], [-0.022, -0.043],
    [0.022, -0.043], [0.022, -0.038], [0.003, -0.025],
  ], 0.004, 0.002, 0x72b6cf);

  const finShape = new THREE.Shape([
    new THREE.Vector2(0.023, 0.003), new THREE.Vector2(0.038, 0.023),
    new THREE.Vector2(0.044, 0.023), new THREE.Vector2(0.044, 0.002),
  ]);
  add(new THREE.ExtrudeGeometry(finShape, { depth: 0.002, bevelEnabled: false })
    .rotateY(Math.PI / 2).translate(-0.001, 0, 0), 0x6bafcc);
  add(new THREE.SphereGeometry(1, 8, 4).scale(0.006, 0.0035, 0.009)
    .translate(0, 0.007, 0.029), 0x3f708c);
  for (const x of [-0.019, 0.019]) {
    add(new THREE.CylinderGeometry(0.004, 0.0035, 0.018, 8)
      .rotateX(Math.PI / 2).translate(x, -0.005, -0.001), 0xd9e7ed);
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geometry.setAttribute('normal', new THREE.Float32BufferAttribute(normals, 3));
  geometry.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
  geometry.computeBoundingSphere();
  return geometry;
}

export function createEarthFlights({ parent, surfaceRadius = () => 1 }) {
  const group = new THREE.Group();
  group.name = 'Earth intercontinental flights';
  parent.add(group);
  const geometry = airplaneGeometry();
  const material = new THREE.MeshStandardMaterial({
    vertexColors: true, roughness: 0.81, metalness: 0, flatShading: true,
    emissive: 0x132938, emissiveIntensity: 0.18,
  });
  const flights = ROUTES.map(route => {
    const from = direction(route.from), to = direction(route.to);
    const angle = Math.acos(THREE.MathUtils.clamp(from.dot(to), -1, 1));
    const tangent = to.clone().addScaledVector(from, -Math.cos(angle)).normalize();
    const model = new THREE.Mesh(geometry, material);
    model.name = route.name;
    model.userData.route = { from: route.from.slice(), to: route.to.slice() };
    // Keep depth testing so terrain naturally hides flights on the far side.
    model.castShadow = false;
    model.receiveShadow = false;
    group.add(model);
    return { ...route, from, tangent, angle, model,
      startRadius: surfaceRadius(...route.from), endRadius: surfaceRadius(...route.to) };
  });
  const up = new THREE.Vector3(), forward = new THREE.Vector3(), right = new THREE.Vector3();
  const matrix = new THREE.Matrix4();

  function update(seconds) {
    for (const flight of flights) {
      const progress = wrap(seconds / flight.duration + flight.phase);
      const angle = progress * flight.angle;
      const cosine = Math.cos(angle), sine = Math.sin(angle);
      up.copy(flight.from).multiplyScalar(cosine).addScaledVector(flight.tangent, sine);
      forward.copy(flight.from).multiplyScalar(-sine).addScaledVector(flight.tangent, cosine);
      right.crossVectors(up, forward).normalize();
      const altitude = 0.075 + 0.105 * Math.sin(Math.PI * progress);
      const radius = THREE.MathUtils.lerp(flight.startRadius, flight.endRadius, progress) + altitude;
      flight.model.position.copy(up).multiplyScalar(radius);
      flight.model.quaternion.setFromRotationMatrix(matrix.makeBasis(right, up, forward));
      const arrival = smooth(Math.min(1, Math.min(progress, 1 - progress) / 0.085));
      flight.model.scale.setScalar(arrival);
      flight.model.visible = arrival > 0.005;
      flight.model.userData.progress = progress;
      flight.model.userData.altitude = altitude;
    }
  }
  update(0);
  return { update, flightCount: flights.length, group,
    dispose() { parent.remove(group); geometry.dispose(); material.dispose(); } };
}
