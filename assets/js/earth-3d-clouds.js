import * as THREE from 'three';

const RAD = Math.PI / 180;
const CELL_SIZE = 0.0085;
const FIELD_STEEPNESS = 2.8;
const SURFACE_DENSITY = Math.exp(-FIELD_STEEPNESS);

// Each ellipsoid is centered in a cloud's tangent frame: east, altitude, south.
// The density fields merge into a single continuous surface with shared normals.
const SHAPES = [
  [ // An elongated front with a scalloped edge and tapered tail.
    [-.033, -.012, .010, .132, .010, .031],
    [-.122, -.004, .021, .055, .015, .027],
    [-.087, .006, -.006, .045, .021, .034],
    [-.032, .001, .026, .047, .017, .040],
    [.016, .011, -.015, .051, .025, .036],
    [.064, -.002, .020, .057, .014, .036],
    [.104, .005, -.018, .048, .019, .029],
    [.145, -.008, -.025, .035, .009, .017],
  ],
  [ // A broad bank with an asymmetric rising shoulder.
    [-.035, -.012, .016, .111, .009, .035],
    [-.083, -.003, .022, .052, .016, .041],
    [-.048, .010, -.018, .041, .024, .040],
    [-.001, -.001, .041, .057, .019, .032],
    [.016, .014, -.023, .046, .028, .044],
    [.060, .004, .015, .051, .023, .046],
    [.100, -.005, -.015, .044, .013, .026],
    [.042, -.005, .051, .050, .011, .023],
  ],
  [ // A softer low sheet folded by wind shear.
    [-.037, -.011, .006, .110, .008, .026],
    [-.101, -.003, .012, .053, .012, .029],
    [-.063, .005, -.011, .042, .018, .033],
    [-.017, -.002, .026, .045, .013, .033],
    [.032, .008, -.020, .055, .023, .035],
    [.077, .001, .013, .043, .016, .037],
    [.113, -.006, .003, .043, .010, .023],
  ],
];

// latitude, longitude, shape, scale, heading, longitudinal wind in degrees/sec.
const SYSTEMS = [
  [41, -53, 2, 1.05, -12, .13],
  [1, -35, 0, .94, -25, .20],
  [-27, 67, 1, .86, 11, .12],
  [-51, 5, 2, .82, 16, .16],
  [22, 114, 0, .78, -15, .11],
  [-19, 157, 1, 1.04, 21, .18],
  [39, -132, 0, .88, -9, .10],
  [-40, -112, 2, 1.08, -22, .17],
];

// A fixed diagonal on each voxel gives the same interpolation on shared faces.
const TETS = [
  [0, 1, 3, 7], [0, 3, 2, 7], [0, 2, 6, 7],
  [0, 6, 4, 7], [0, 4, 5, 7], [0, 5, 1, 7],
];

function createCloudGeometry(lobes) {
  const lower = [0, 1, 2].map(axis => Math.min(...lobes.map(lobe => lobe[axis] - lobe[axis + 3])) - .022);
  const upper = [0, 1, 2].map(axis => Math.max(...lobes.map(lobe => lobe[axis] + lobe[axis + 3])) + .022);
  const cells = upper.map((max, axis) => Math.ceil((max - lower[axis]) / CELL_SIZE));
  const lobesWithFalloff = lobes.map(([x, y, z, rx, ry, rz]) => [x, y, z, 1 / (rx * rx), 1 / (ry * ry), 1 / (rz * rz)]);

  function density(x, y, z, normal) {
    let value = -SURFACE_DENSITY;
    let nx = 0, ny = 0, nz = 0;
    for (const [cx, cy, cz, ax, ay, az] of lobesWithFalloff) {
      const dx = x - cx, dy = y - cy, dz = z - cz;
      const weight = Math.exp(-FIELD_STEEPNESS * (ax * dx * dx + ay * dy * dy + az * dz * dz));
      value += weight;
      if (normal) {
        nx += dx * ax * weight;
        ny += dy * ay * weight;
        nz += dz * az * weight;
      }
    }
    if (normal) normal.set(nx, ny, nz).normalize();
    return value;
  }

  const [countX, countY, countZ] = cells;
  const strideY = countX + 1;
  const strideZ = strideY * (countY + 1);
  const samples = [];
  for (let z = 0; z <= countZ; z++) {
    for (let y = 0; y <= countY; y++) {
      for (let x = 0; x <= countX; x++) {
        const px = lower[0] + x * CELL_SIZE, py = lower[1] + y * CELL_SIZE, pz = lower[2] + z * CELL_SIZE;
        samples.push({ px, py, pz, field: density(px, py, pz) });
      }
    }
  }

  const positions = [], normals = [], colors = [], indices = [];
  const cachedEdges = new Map();
  const normal = new THREE.Vector3();
  const shadowColor = new THREE.Color(0xa6bbd1);
  const crownColor = new THREE.Color(0xe2edf8);
  const vertexColor = new THREE.Color();
  function crossing(aIndex, bIndex) {
    const key = aIndex < bIndex ? aIndex * samples.length + bIndex : bIndex * samples.length + aIndex;
    if (cachedEdges.has(key)) return cachedEdges.get(key);
    const a = samples[aIndex], b = samples[bIndex];
    const fraction = a.field / (a.field - b.field);
    const x = THREE.MathUtils.lerp(a.px, b.px, fraction);
    const y = THREE.MathUtils.lerp(a.py, b.py, fraction);
    const z = THREE.MathUtils.lerp(a.pz, b.pz, fraction);
    density(x, y, z, normal);
    const index = positions.length / 3;
    positions.push(x, y, z);
    normals.push(normal.x, normal.y, normal.z);
    vertexColor.copy(shadowColor).lerp(crownColor, THREE.MathUtils.smoothstep(y, -.023, .030));
    colors.push(vertexColor.r, vertexColor.g, vertexColor.b);
    cachedEdges.set(key, index);
    return index;
  }

  const edgeAB = new THREE.Vector3(), edgeAC = new THREE.Vector3(), faceNormal = new THREE.Vector3();
  const vertexA = new THREE.Vector3(), vertexB = new THREE.Vector3(), vertexC = new THREE.Vector3();
  function triangle(a, b, c) {
    vertexA.fromArray(positions, a * 3);
    vertexB.fromArray(positions, b * 3);
    vertexC.fromArray(positions, c * 3);
    edgeAB.subVectors(vertexB, vertexA);
    edgeAC.subVectors(vertexC, vertexA);
    faceNormal.crossVectors(edgeAB, edgeAC);
    normal.fromArray(normals, a * 3);
    if (faceNormal.dot(normal) > 0) indices.push(a, b, c);
    else indices.push(a, c, b);
  }

  for (let z = 0; z < countZ; z++) {
    for (let y = 0; y < countY; y++) {
      for (let x = 0; x < countX; x++) {
        const index = x + y * strideY + z * strideZ;
        const corners = [index, index + 1, index + strideY, index + strideY + 1, index + strideZ,
          index + strideZ + 1, index + strideZ + strideY, index + strideZ + strideY + 1];
        if (corners.every(i => samples[i].field < 0) || corners.every(i => samples[i].field >= 0)) continue;
        for (const tetrahedron of TETS) {
          const inside = [], outside = [];
          for (const corner of tetrahedron) {
            const sample = corners[corner];
            (samples[sample].field >= 0 ? inside : outside).push(sample);
          }
          if (inside.length === 1) triangle(...outside.map(index => crossing(inside[0], index)));
          else if (inside.length === 3) triangle(...inside.map(index => crossing(index, outside[0])));
          else if (inside.length === 2) {
            const [a, b] = inside, [c, d] = outside;
            const ac = crossing(a, c), ad = crossing(a, d), bc = crossing(b, c), bd = crossing(b, d);
            triangle(ac, ad, bd);
            triangle(ac, bd, bc);
          }
        }
      }
    }
  }

  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geometry.setAttribute('normal', new THREE.Float32BufferAttribute(normals, 3));
  geometry.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
  geometry.setIndex(indices);
  geometry.computeBoundingBox();
  geometry.computeBoundingSphere();
  return geometry;
}

export function createEarthClouds({ parent }) {
  const geometries = SHAPES.map(createCloudGeometry);
  const material = new THREE.MeshStandardMaterial({
    roughness: 1,
    vertexColors: true,
    emissive: 0x9ab5ce,
    emissiveIntensity: .08,
  });

  const clouds = SYSTEMS.map(([latitude, longitude, shape, scale, heading, wind], index) => {
    const geometry = geometries[shape];
    const mesh = new THREE.Mesh(geometry, material);
    mesh.name = `Weather formation ${index + 1}`;
    mesh.scale.setScalar(scale);
    parent.add(mesh);

    // Even the underside clears the highest displaced ground as it drifts.
    const shellRadius = Math.max(1.072, 1.055 - geometry.boundingBox.min.y * scale);
    const shadowRadius = Math.min(.12, .37 * scale * (geometry.boundingBox.max.x - geometry.boundingBox.min.x));
    return { latitude, longitude, heading, wind, phase: index * 1.81, mesh, shellRadius, shadowRadius };
  });

  const shadowCenters = clouds.map(() => new THREE.Vector4());
  const east = new THREE.Vector3(), radial = new THREE.Vector3(), south = new THREE.Vector3();
  const basis = new THREE.Matrix4();
  function update(seconds) {
    for (const [index, cloud] of clouds.entries()) {
      const { latitude, longitude, heading, wind, phase, mesh, shellRadius, shadowRadius } = cloud;
      const lat = (latitude + .55 * Math.sin(.025 * seconds + phase)) * RAD;
      const lon = (longitude + wind * seconds) * RAD;
      const cosLat = Math.cos(lat), sinLat = Math.sin(lat), cosLon = Math.cos(lon), sinLon = Math.sin(lon);
      east.set(cosLon, 0, -sinLon);
      radial.set(cosLat * sinLon, sinLat, cosLat * cosLon);
      south.crossVectors(east, radial);
      mesh.position.copy(radial).multiplyScalar(shellRadius + .002 * Math.sin(.032 * seconds + phase));
      mesh.quaternion.setFromRotationMatrix(basis.makeBasis(east, radial, south));
      mesh.rotateY(heading * RAD);
      shadowCenters[index].set(mesh.position.x, mesh.position.y, mesh.position.z, shadowRadius);
    }
  }

  update(0);
  return { update, cloudCount: clouds.length, shadowCenters };
}
