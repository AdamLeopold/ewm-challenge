import * as THREE from 'three';

const RAD = Math.PI / 180;
const CLOUD_RADIUS = 1.137;
const CLOUD_STEPS = 32;

// Centres and radii of the humid cores, in each formation's east, up, south
// frame. A shared density field feathers them into one weather system.
const FORMS = [
  [
    [-.64, -.18, .05, .28, .40, .43], [-.41, .08, -.18, .34, .48, .40],
    [-.12, .36, -.24, .28, .46, .38], [.10, -.15, .17, .43, .49, .50],
    [.39, .28, -.10, .29, .51, .42], [.64, -.16, .05, .27, .36, .41],
    [-.33, -.28, .40, .37, .34, .42], [.31, -.26, .44, .36, .31, .39],
    [.06, -.26, -.51, .46, .38, .34],
  ],
  [
    [-.63, -.21, .35, .28, .34, .35], [-.39, -.05, .16, .36, .44, .41],
    [-.12, .09, .07, .38, .53, .42], [.15, .25, -.17, .31, .50, .36],
    [.39, .09, -.24, .33, .46, .38], [.66, -.19, -.45, .25, .33, .33],
    [.12, -.25, .32, .34, .31, .37], [-.33, -.21, -.18, .33, .36, .39],
  ],
  [
    [-.67, -.28, -.17, .26, .28, .38], [-.42, -.12, -.21, .34, .34, .47],
    [-.11, .03, -.02, .39, .38, .53], [.22, .05, .17, .39, .43, .46],
    [.51, -.08, .13, .34, .39, .44], [.72, -.26, .28, .22, .26, .30],
    [-.36, -.32, .36, .32, .29, .37], [.24, -.34, -.25, .42, .24, .39],
  ],
];

// Latitude, longitude, formation, width, thickness, depth, heading, drift.
// The two broadest banks are over the Atlantic and Indian Oceans. Their
// positions leave the mid-latitude actors and the Sahara readable at launch.
const SYSTEMS = [
  [-15, -16, 0, .79, .19, .52, -30, .18],
  [-18, 56, 1, .77, .19, .48, 21, .11],
  [50, -44, 1, .58, .14, .43, -18, .13],
  [44, 83, 0, .58, .16, .45, 18, .12],
  [-47, 4, 2, .71, .14, .38, 12, .16],
  [26, -142, 2, .71, .14, .43, -19, .10],
  [-22, 153, 0, .76, .16, .49, 22, .17],
  [-41, -108, 1, .61, .14, .42, -25, .15],
];

const smooth = t => t * t * (3 - 2 * t);
const clamp = value => Math.max(0, Math.min(1, value));
const mix = (a, b, t) => a + (b - a) * t;

function hash(x, y, z, salt) {
  const h = Math.imul(x, 374761393) ^ Math.imul(y, 668265263) ^ Math.imul(z, 1442695041) ^ salt;
  const k = Math.imul(h ^ (h >>> 13), 1274126177);
  return ((k ^ (k >>> 16)) >>> 0) / 4294967295;
}

function noise(x, y, z, salt) {
  const i = Math.floor(x), j = Math.floor(y), k = Math.floor(z);
  const a = smooth(x - i), b = smooth(y - j), c = smooth(z - k);
  const near = mix(mix(hash(i, j, k, salt), hash(i + 1, j, k, salt), a),
    mix(hash(i, j + 1, k, salt), hash(i + 1, j + 1, k, salt), a), b);
  const far = mix(mix(hash(i, j, k + 1, salt), hash(i + 1, j, k + 1, salt), a),
    mix(hash(i, j + 1, k + 1, salt), hash(i + 1, j + 1, k + 1, salt), a), b);
  return mix(near, far, c);
}

function createVolume(form, index) {
  const width = 96, height = 32, depth = 64;
  const data = new Uint8Array(width * height * depth);
  const salt = (index + 1) * 271891;
  const cores = form.map(([x, y, z, rx, ry, rz]) => [x, y, z, 1 / (rx * rx), 1 / (ry * ry), 1 / (rz * rz)]);

  for (let k = 0; k < depth; k++) {
    const z = 2 * k / (depth - 1) - 1;
    for (let j = 0; j < height; j++) {
      const y = 2 * j / (height - 1) - 1;
      for (let i = 0; i < width; i++) {
        const x = 2 * i / (width - 1) - 1;
        const boundary = Math.max(Math.abs(x), Math.abs(y), Math.abs(z));
        if (boundary > .985) continue;
        const xWarp = x + (noise(4.4 * x, 1.45 * y, 2.7 * z, salt) - .5) * .19;
        const zWarp = z + (noise(3.7 * x, 1.31 * y, 3.1 * z, salt + 71) - .5) * .22;
        let body = 0;
        for (const [cx, cy, cz, ax, ay, az] of cores) {
          const dx = xWarp - cx, dy = y - cy, dz = zWarp - cz;
          const q = ax * dx * dx + ay * dy * dy + az * dz * dz;
          if (q < 4.7) body += Math.exp(-2.25 * q);
        }
        if (body < .018) continue;

        // The finer noise erodes the billow edges and leaves soft strands,
        // while coarse moisture keeps the interior a coherent volume.
        const billow = noise(9.2 * x, 2.55 * y, 5.85 * z, salt + 17);
        const wisps = noise(23.4 * x, 6.5 * y, 13.7 * z, salt + 301);
        const vapour = noise(42 * x, 10.8 * y, 24 * z, salt + 603);
        const density = smooth(clamp((body - .052 + .29 * (billow - .53) + .10 * (wisps - .55) + .044 * (vapour - .5)) / .59));
        const feather = 1 - smooth(clamp((boundary - .79) / .195));
        data[i + width * (j + height * k)] = Math.round(255 * density * feather * (.44 + .56 * billow));
      }
    }
  }

  const texture = new THREE.Data3DTexture(data, width, height, depth);
  texture.format = THREE.RedFormat;
  texture.type = THREE.UnsignedByteType;
  texture.minFilter = THREE.LinearFilter;
  texture.magFilter = THREE.LinearFilter;
  texture.unpackAlignment = 1;
  texture.needsUpdate = true;
  return texture;
}

const vertexShader = `
  varying vec3 vLocal;
  varying vec3 vRay;
  varying float vDepthPerUnit;

  void main() {
    vLocal = position;
    vRay = -vec3(modelViewMatrix[0].z, modelViewMatrix[1].z, modelViewMatrix[2].z);
    vDepthPerUnit = -0.5 * projectionMatrix[2].z;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`;

const fragmentShader = `
  precision highp sampler3D;
  uniform sampler3D volume;
  uniform vec3 span;
  uniform vec3 halfBox;
  uniform vec3 sun;
  uniform vec3 moon;
  uniform float shell;
  varying vec3 vLocal;
  varying vec3 vRay;
  varying float vDepthPerUnit;
  out vec4 fragColor;

  float densityAt(vec3 point) {
    float altitude = length(point + vec3(0.0, shell, 0.0)) - shell;
    vec3 uv = vec3(point.x, altitude, point.z) / span + 0.5;
    if (any(lessThanEqual(uv, vec3(0.0))) || any(greaterThanEqual(uv, vec3(1.0)))) return 0.0;
    float floorFade = smoothstep(1.075, 1.107, altitude + shell);
    return texture(volume, uv).r * floorFade;
  }

  void main() {
    vec3 ray = normalize(vRay);
    vec3 origin = vLocal + ray * 0.00025;
    vec3 reciprocal = 1.0 / mix(vec3(0.00001), ray, step(vec3(0.00001), abs(ray)));
    vec3 untilEdge = max((-halfBox - origin) * reciprocal, (halfBox - origin) * reciprocal);
    float finish = min(untilEdge.x, min(untilEdge.y, untilEdge.z));

    // The cloud floor clears the displaced terrain. Limit the rear rays to
    // the ocean radius, and let the actual depth buffer reject raised land.
    vec3 radialStart = origin + vec3(0.0, shell, 0.0);
    float projected = dot(radialStart, ray);
    float hit = projected * projected - dot(radialStart, radialStart) + 0.999 * 0.999;
    if (hit > 0.0 && -projected + sqrt(hit) > 0.0) finish = min(finish, -projected - sqrt(hit));
    if (finish < 0.001) discard;

    float stepLength = finish / float(${CLOUD_STEPS});
    float transmittance = 1.0;
    float firstHit = finish;
    vec3 accumulated = vec3(0.0);
    for (int i = 0; i < ${CLOUD_STEPS}; i++) {
      float distance = (float(i) + 0.5) * stepLength;
      vec3 point = origin + ray * distance;
      float density = densityAt(point);
      if (density < 0.008) continue;
      float opacity = 1.0 - exp(-54.0 * density * stepLength);
      if (opacity > 0.004) firstHit = min(firstHit, distance);
      float nearSun = densityAt(point + sun * 0.023);
      float lightBlock = density * 0.13 + nearSun * 0.33 + densityAt(point + sun * 0.061) * 0.39
        + densityAt(point + sun * 0.115) * 0.23;
      float sunlit = exp(-4.40 * lightBlock);
      float raised = smoothstep(-0.045, 0.23, density - nearSun);
      float rimBlock = density * 0.24 + densityAt(point + moon * 0.056) * 0.56;
      float rimlit = exp(-3.75 * rimBlock);
      vec3 radial = normalize(point + vec3(0.0, shell, 0.0));
      float day = smoothstep(-0.43, 0.84, dot(radial, sun));
      float blueEdge = smoothstep(-0.55, 0.60, dot(radial, moon));
      float crown = smoothstep(1.096, 1.217, length(point + vec3(0.0, shell, 0.0)));
      vec3 light = mix(vec3(0.15, 0.23, 0.39), vec3(0.29, 0.36, 0.49), crown)
        + vec3(0.86, 0.82, 0.75) * sunlit * (0.39 + 0.61 * day) * (0.58 + 0.42 * raised)
        + vec3(0.14, 0.32, 0.52) * rimlit * (0.26 + 0.74 * blueEdge);
      accumulated += transmittance * opacity * light;
      transmittance *= 1.0 - opacity;
      if (transmittance < 0.038) break;
    }

    float alpha = 1.0 - transmittance;
    if (alpha < 0.012) discard;
    gl_FragDepth = clamp(gl_FragCoord.z + vDepthPerUnit * (firstHit + 0.00025), 0.0, 1.0);
    fragColor = vec4(clamp(accumulated / max(alpha, 0.0001), 0.0, 1.0), alpha * 0.94);
  }
`;

export function createEarthClouds({ parent, sunlight, moonlight }) {
  const sun = (sunlight || new THREE.Vector3(-.60, .74, .64)).clone().normalize();
  const moon = (moonlight || new THREE.Vector3(.24, -.80, -.55)).clone().normalize();
  const textures = FORMS.map(createVolume);
  const banks = SYSTEMS.map(([latitude, longitude, form, width, thickness, depth, heading, drift], index) => {
    const span = new THREE.Vector3(width, thickness, depth);
    // Include the bend below the tangent plane as the bank wraps the planet.
    const boxHeight = thickness + .23;
    const halfBox = new THREE.Vector3(width / 2, boxHeight / 2, depth / 2);
    const localSun = new THREE.Vector3(), localMoon = new THREE.Vector3();
    const material = new THREE.ShaderMaterial({
      uniforms: {
        volume: { value: textures[form] }, span: { value: span }, halfBox: { value: halfBox },
        sun: { value: localSun }, moon: { value: localMoon }, shell: { value: CLOUD_RADIUS },
      },
      vertexShader,
      fragmentShader,
      glslVersion: THREE.GLSL3,
      transparent: true,
      depthWrite: false,
      toneMapped: false,
    });
    const mesh = new THREE.Mesh(new THREE.BoxGeometry(width, boxHeight, depth), material);
    mesh.name = `Volumetric weather bank ${index + 1}`;
    parent.add(mesh);
    return { latitude, longitude, heading, drift, phase: index * 1.81, mesh, localSun, localMoon, shadow: .32 * width };
  });

  const shadowCenters = banks.map(() => new THREE.Vector4());
  const east = new THREE.Vector3(), radial = new THREE.Vector3(), south = new THREE.Vector3();
  const basis = new THREE.Matrix4();
  const inverseWorld = new THREE.Quaternion();

  function update(seconds) {
    banks.forEach(({ latitude, longitude, heading, drift, phase, mesh, localSun, localMoon, shadow }, index) => {
      const lat = (latitude + .42 * Math.sin(.031 * seconds + phase)) * RAD;
      const lon = (longitude + drift * seconds) * RAD;
      const cosLat = Math.cos(lat), sinLat = Math.sin(lat), cosLon = Math.cos(lon), sinLon = Math.sin(lon);
      east.set(cosLon, 0, -sinLon);
      radial.set(cosLat * sinLon, sinLat, cosLat * cosLon);
      south.crossVectors(east, radial);
      mesh.position.copy(radial).multiplyScalar(CLOUD_RADIUS);
      mesh.quaternion.setFromRotationMatrix(basis.makeBasis(east, radial, south));
      mesh.rotateY(heading * RAD);
      mesh.getWorldQuaternion(inverseWorld).invert();
      localSun.copy(sun).applyQuaternion(inverseWorld);
      localMoon.copy(moon).applyQuaternion(inverseWorld);
      shadowCenters[index].set(mesh.position.x, mesh.position.y, mesh.position.z, shadow);
    });
  }

  update(0);
  return { update, cloudCount: banks.length, shadowCenters };
}
