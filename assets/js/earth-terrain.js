/* NASA Blue Marble surface color and NOAA ETOPO1 elevation.
 * https://doi.org/10.7289/V5C8276M */
import * as THREE from "three";

const ELEVATION_SCALE = 0.060;
const CONTINENT_SHELF = 0.023;
const SEGMENTS = 400;
const ROWS = 200;

function rasterSampler(image, readPixel) {
  const canvas = document.createElement('canvas');
  canvas.width = image.naturalWidth || image.width;
  canvas.height = image.naturalHeight || image.height;
  const { width, height } = canvas;
  const context = canvas.getContext('2d', { willReadFrequently: true });
  context.drawImage(image, 0, 0);
  const rgba = context.getImageData(0, 0, width, height).data;
  return (u, v) => {
    const x = (u - Math.floor(u)) * width - 0.5;
    const y = Math.max(0, Math.min(height - 1, v * height - 0.5));
    const x0 = Math.floor(x);
    const y0 = Math.floor(y);
    const y1 = Math.min(y0 + 1, height - 1);
    const i0 = (x0 + width) % width;
    const i1 = (x0 + 1) % width;
    const dx = x - x0;
    const dy = y - y0;
    const upper = readPixel(rgba, (y0 * width + i0) * 4) * (1 - dx)
      + readPixel(rgba, (y0 * width + i1) * 4) * dx;
    const lower = readPixel(rgba, (y1 * width + i0) * 4) * (1 - dx)
      + readPixel(rgba, (y1 * width + i1) * 4) * dx;
    return upper * (1 - dy) + lower * dy;
  };
}

function smoothstep(low, high, value) {
  const t = THREE.MathUtils.clamp((value - low) / (high - low), 0, 1);
  return t * t * (3 - 2 * t);
}

function landPixel(rgba, offset) {
  const red = rgba[offset], green = rgba[offset + 1], blue = rgba[offset + 2];
  const brightness = Math.max(red, green);
  const blueWater = smoothstep(3, 18, blue - red);
  return smoothstep(12, 32, brightness) * (1 - blueWater);
}

function buildMesh(sampleHeight, sampleLand) {
  const columns = SEGMENTS + 1;
  const stride = 11;
  const vertices = new Float32Array((ROWS + 1) * columns * stride);
  const indices = new Uint32Array(ROWS * SEGMENTS * 6);
  const coastSampleU = 0.27 / SEGMENTS;
  const coastSampleV = 0.27 / ROWS;
  for (let row = 0; row <= ROWS; row += 1) {
    const v = row / ROWS;
    const lat = (0.5 - v) * Math.PI;
    for (let col = 0; col <= SEGMENTS; col += 1) {
      const u = col / SEGMENTS;
      const lon = (u - 0.5) * 2 * Math.PI;
      const sourceU = row === 0 || row === ROWS ? 0.5 : u;
      const height = sampleHeight(sourceU, v);
      const coverage = 0.44 * sampleLand(sourceU, v)
        + 0.14 * (sampleLand(sourceU - coastSampleU, v) + sampleLand(sourceU + coastSampleU, v)
          + sampleLand(sourceU, v - coastSampleV) + sampleLand(sourceU, v + coastSampleV));
      const land = Math.max(smoothstep(0.14, 0.88, coverage), smoothstep(0.012, 0.075, height));
      const lift = 1 + CONTINENT_SHELF * land + ELEVATION_SCALE * Math.pow(height, 0.94);
      const offset = (row * columns + col) * stride;
      vertices[offset] = Math.cos(lat) * Math.sin(lon) * lift;
      vertices[offset + 1] = Math.sin(lat) * lift;
      vertices[offset + 2] = Math.cos(lat) * Math.cos(lon) * lift;
      vertices[offset + 6] = u;
      vertices[offset + 7] = v;
      vertices[offset + 8] = height;
      vertices[offset + 9] = land;
      vertices[offset + 10] = lift;
    }
  }
  for (let row = 0; row <= ROWS; row += 1) {
    for (let col = 0; col <= SEGMENTS; col += 1) {
      const offset = (row * columns + col) * stride;
      let x = vertices[offset];
      let y = vertices[offset + 1];
      let z = vertices[offset + 2];
      if (row > 0 && row < ROWS) {
        const west = (row * columns + (col + SEGMENTS - 1) % SEGMENTS) * stride;
        const east = (row * columns + (col + 1) % SEGMENTS) * stride;
        const north = offset - columns * stride;
        const south = offset + columns * stride;
        const sx = vertices[south] - vertices[north];
        const sy = vertices[south + 1] - vertices[north + 1];
        const sz = vertices[south + 2] - vertices[north + 2];
        const ex = vertices[east] - vertices[west];
        const ey = vertices[east + 1] - vertices[west + 1];
        const ez = vertices[east + 2] - vertices[west + 2];
        x = sy * ez - sz * ey;
        y = sz * ex - sx * ez;
        z = sx * ey - sy * ex;
      }
      const length = Math.hypot(x, y, z);
      vertices[offset + 3] = x / length;
      vertices[offset + 4] = y / length;
      vertices[offset + 5] = z / length;
    }
  }
  let i = 0;
  for (let row = 0; row < ROWS; row += 1) {
    for (let col = 0; col < SEGMENTS; col += 1) {
      const top = row * columns + col;
      const bottom = top + columns;
      indices[i++] = top;
      indices[i++] = bottom;
      indices[i++] = top + 1;
      indices[i++] = top + 1;
      indices[i++] = bottom;
      indices[i++] = bottom + 1;
    }
  }
  return { vertices, indices, stride };
}

const vertexShader = `
  attribute float elevation;
  attribute float landMask;
  uniform mat4 actorShadowMatrix;
  varying vec2 vUv;
  varying vec3 vLocal;
  varying vec3 vView;
  varying vec3 vRadial;
  varying vec3 vNormal;
  varying vec2 vTerrain;
  varying vec4 vActorShadowCoord;

  void main() {
    vUv = uv;
    vLocal = position;
    vRadial = normalMatrix * normalize(position);
    vNormal = normalMatrix * normal;
    vTerrain = vec2(elevation, landMask);
    vec4 view = modelViewMatrix * vec4(position, 1.0);
    vView = view.xyz;
    vActorShadowCoord = actorShadowMatrix * modelMatrix * vec4(position, 1.0);
    gl_Position = projectionMatrix * view;
  }
`;

const fragmentShader = `
  #include <packing>
  uniform sampler2D surfaceMap;
  uniform sampler2D elevationMap;
  uniform vec3 sun;
  uniform vec3 localSun;
  uniform vec4 cloudCenters[8];
  uniform sampler2D actorShadowMap;
  uniform vec2 actorShadowTexel;
  uniform float actorShadowBias;
  uniform bool actorShadowEnabled;
  uniform bool actorShadowPacked;
  varying vec2 vUv;
  varying vec3 vLocal;
  varying vec3 vView;
  varying vec3 vRadial;
  varying vec3 vNormal;
  varying vec2 vTerrain;
  varying vec4 vActorShadowCoord;

  float actorShadow(float facingLight) {
    if (!actorShadowEnabled || facingLight <= 0.06) return 0.0;
    vec3 sampleCoord = vActorShadowCoord.xyz / vActorShadowCoord.w;
    if (any(lessThan(sampleCoord, vec3(0.0))) || any(greaterThan(sampleCoord, vec3(1.0)))) return 0.0;

    // Filter the real model silhouettes to soften their edges at globe scale.
    float shade = 0.0;
    for (int y = -1; y <= 1; y++) {
      for (int x = -1; x <= 1; x++) {
        vec2 offset = vec2(float(x), float(y)) * actorShadowTexel;
        vec4 mapSample = texture2D(actorShadowMap, sampleCoord.xy + offset);
        float nearestDepth = actorShadowPacked ? unpackRGBAToDepth(mapSample) : mapSample.r;
        shade += step(nearestDepth, sampleCoord.z + actorShadowBias);
      }
    }
    return (shade / 9.0) * smoothstep(0.06, 0.30, facingLight);
  }

  vec3 reliefNormal(vec3 normal, float detail) {
    vec3 dx = dFdx(vView);
    vec3 dy = dFdy(vView);
    vec3 tangentX = cross(dy, normal);
    vec3 tangentY = cross(normal, dx);
    float determinant = dot(dx, tangentX);
    vec3 slope = sign(determinant) * (dFdx(detail) * tangentX + dFdy(detail) * tangentY);
    return normalize(max(abs(determinant), 0.0000001) * normal - slope);
  }

  void main() {
    vec3 raw = texture2D(surfaceMap, vUv).rgb;
    float height = vTerrain.x;
    float landBase = vTerrain.y;
    float landPixel = smoothstep(0.047, 0.125, max(raw.r, raw.g))
      * (1.0 - smoothstep(0.012, 0.071, raw.b - raw.r));
    float land = max(landPixel, smoothstep(0.015, 0.066, height));
    // Exposed rock follows the bevel of each raised continental shelf.
    float exposedShelf = smoothstep(0.20, 0.75, landBase) * (1.0 - land);
    land = max(land, 0.96 * exposedShelf);

    vec3 radial = normalize(vRadial);
    vec3 meshNormal = normalize(vNormal);
    float highResHeight = texture2D(elevationMap, vUv).r;
    float fineRelief = (highResHeight - height) * 0.027 * smoothstep(0.45, 0.96, landBase);
    vec3 normal = reliefNormal(meshNormal, fineRelief);
    float facingLight = dot(radial, sun);
    float sunlit = smoothstep(-0.24, 0.79, facingLight);
    float slope = 1.0 - max(0.0, dot(normal, radial));
    float diffuse = max(0.0, dot(normal, sun));
    float groundShadow = actorShadow(facingLight);
    float viewEdge = 1.0 - max(0.0, radial.z);
    vec3 halfLight = normalize(sun + vec3(0.0, 0.0, 1.0));

    float tone = dot(raw, vec3(0.2126, 0.7152, 0.0722));
    float vegetation = smoothstep(-0.085, 0.064, raw.g - raw.r) * (1.0 - smoothstep(0.62, 0.82, tone));
    float arid = smoothstep(0.20, 0.77, tone);
    float alpine = smoothstep(0.27, 0.71, highResHeight);
    float coolWhite = 1.0 - smoothstep(0.07, 0.24, max(raw.r, raw.g) - raw.b);
    float snow = max(smoothstep(0.65, 0.87, tone) * coolWhite,
      smoothstep(0.70, 0.93, highResHeight) * (1.0 - 0.68 * smoothstep(0.09, 0.38, slope)));
    vec3 earth = mix(vec3(0.42, 0.31, 0.19), vec3(0.86, 0.73, 0.50), arid);
    vec3 grass = mix(vec3(0.12, 0.26, 0.09), vec3(0.39, 0.51, 0.20), smoothstep(0.09, 0.49, tone));
    vec3 stone = mix(vec3(0.48, 0.40, 0.30), vec3(0.61, 0.57, 0.53), alpine);
    float rock = max(alpine * 0.77, smoothstep(0.07, 0.35, slope) * 0.72);
    vec3 landColor = mix(earth, grass, vegetation);
    landColor = mix(landColor, raw, 0.19);
    landColor = mix(landColor, stone, rock);
    landColor = mix(landColor, vec3(0.44, 0.36, 0.26), exposedShelf * 0.72);
    landColor = mix(landColor, vec3(0.87, 0.91, 0.93), snow);
    // Cool fill preserves rock faces in shadow while warm sun picks out the ridges.
    landColor *= mix(vec3(0.25, 0.34, 0.50), vec3(0.37, 0.42, 0.50), sunlit)
      + diffuse * (1.0 - 0.80 * groundShadow) * vec3(0.91, 0.84, 0.72);

    float shallows = (1.0 - land) * smoothstep(0.015, 0.60, landBase);
    vec3 ocean = mix(vec3(0.010, 0.029, 0.108), vec3(0.026, 0.145, 0.337), sunlit);
    ocean += vec3(0.028, 0.079, 0.112) * pow(max(0.0, dot(radial, halfLight)), 9.0) * (1.0 - 0.70 * groundShadow);
    ocean += vec3(0.026, 0.100, 0.128) * shallows * (0.35 + 0.65 * sunlit);
    ocean += vec3(0.017, 0.051, 0.092) * pow(viewEdge, 2.7);

    // Cast the soft cloud silhouettes onto the same geographical surface.
    float shadow = 0.0;
    for (int i = 0; i < 8; i++) {
      vec3 towardCloud = cloudCenters[i].xyz - vLocal;
      float distanceToCloud = dot(towardCloud, localSun);
      float clearance = length(towardCloud - localSun * distanceToCloud);
      float radius = max(0.0001, cloudCenters[i].w);
      float softness = radius * 0.76 + distanceToCloud * 0.10;
      float occlusion = 1.0 - smoothstep(radius * 0.23, max(radius * 0.27, softness), clearance);
      shadow = max(shadow, occlusion * smoothstep(0.0, 0.02, distanceToCloud)
        * (1.0 - smoothstep(0.22, 0.52, distanceToCloud)) * step(0.001, cloudCenters[i].w));
    }
    vec3 color = mix(ocean, landColor, land) * (1.0 - 0.33 * shadow * sunlit);
    gl_FragColor = vec4(clamp(color, 0.0, 1.0), 1.0);
  }
`;

export function createEarthTerrain(surfaceImage, elevationImage, sunlight, shadowLight) {
  const sampleHeight = rasterSampler(elevationImage, (rgba, offset) => rgba[offset] / 255);
  const sampleLand = rasterSampler(surfaceImage, landPixel);
  const { vertices, indices, stride } = buildMesh(sampleHeight, sampleLand);
  const geometry = new THREE.BufferGeometry();
  const data = new THREE.InterleavedBuffer(vertices, stride);
  geometry.setAttribute("position", new THREE.InterleavedBufferAttribute(data, 3, 0));
  geometry.setAttribute("normal", new THREE.InterleavedBufferAttribute(data, 3, 3));
  geometry.setAttribute("uv", new THREE.InterleavedBufferAttribute(data, 2, 6));
  geometry.setAttribute("elevation", new THREE.InterleavedBufferAttribute(data, 1, 8));
  geometry.setAttribute("landMask", new THREE.InterleavedBufferAttribute(data, 1, 9));
  geometry.setIndex(new THREE.BufferAttribute(indices, 1));

  const surfaceMap = new THREE.Texture(surfaceImage);
  surfaceMap.flipY = false;
  surfaceMap.needsUpdate = true;
  const elevationMap = new THREE.Texture(elevationImage);
  elevationMap.flipY = false;
  elevationMap.needsUpdate = true;
  const localSun = sunlight.clone();
  const cloudCenters = Array.from({ length: 8 }, () => new THREE.Vector4(0, 0, 0, 0));
  const material = new THREE.ShaderMaterial({
    uniforms: {
      surfaceMap: { value: surfaceMap },
      elevationMap: { value: elevationMap },
      sun: { value: sunlight },
      localSun: { value: localSun },
      cloudCenters: { value: cloudCenters },
      actorShadowMatrix: { value: shadowLight?.shadow.matrix ?? new THREE.Matrix4() },
      actorShadowMap: { value: null },
      actorShadowTexel: { value: new THREE.Vector2() },
      actorShadowBias: { value: 0 },
      actorShadowEnabled: { value: false },
      actorShadowPacked: { value: true },
    },
    vertexShader,
    fragmentShader,
    extensions: { derivatives: true },
    toneMapped: false,
  });
  const mesh = new THREE.Mesh(geometry, material);
  mesh.name = "Earth terrain";
  if (shadowLight) {
    const uniforms = material.uniforms;
    // Three creates the light's render target in the shadow pass before this draw.
    mesh.onBeforeRender = renderer => {
      const shadow = shadowLight.shadow;
      const map = shadow.map;
      uniforms.actorShadowEnabled.value = Boolean(renderer.shadowMap.enabled && shadowLight.castShadow && map);
      if (map) {
        // r160 stores packed RGBA. Newer Three versions expose raw depth for BasicShadowMap.
        uniforms.actorShadowMap.value = map.depthTexture ?? map.texture;
        uniforms.actorShadowPacked.value = !map.depthTexture;
        uniforms.actorShadowTexel.value.set(1 / map.width, 1 / map.height);
        uniforms.actorShadowBias.value = shadow.bias;
      }
      material.uniformsNeedUpdate = true;
    };
  }
  const inverseOrientation = new THREE.Quaternion();
  const groundRay = new THREE.Ray();
  const groundHit = new THREE.Vector3();
  const topLeft = new THREE.Vector3(), topRight = new THREE.Vector3();
  const bottomLeft = new THREE.Vector3(), bottomRight = new THREE.Vector3();
  const vertexOffset = (row, col) => (row * (SEGMENTS + 1) + col) * stride;

  function groundTriangle(row, col) {
    const top = vertexOffset(row, col);
    const bottom = vertexOffset(row + 1, col);
    topLeft.fromArray(vertices, top);
    topRight.fromArray(vertices, top + stride);
    bottomLeft.fromArray(vertices, bottom);
    bottomRight.fromArray(vertices, bottom + stride);
    return groundRay.intersectTriangle(topLeft, bottomLeft, topRight, false, groundHit)
      || groundRay.intersectTriangle(topRight, bottomLeft, bottomRight, false, groundHit);
  }

  return {
    mesh,
    surfaceRadius(latitude, longitude) {
      const lat = (90 - latitude) / 180 * ROWS;
      const degrees = longitude + 180;
      const lon = (degrees - Math.floor(degrees / 360) * 360) / 360 * SEGMENTS;
      const row = Math.min(ROWS - 1, Math.floor(lat)), col = Math.floor(lon);
      const phi = latitude * Math.PI / 180, theta = longitude * Math.PI / 180;
      const cosLatitude = Math.cos(phi);
      groundRay.direction.set(cosLatitude * Math.sin(theta), Math.sin(phi), cosLatitude * Math.cos(theta));
      // A curved latitude edge can put a boundary sample in an adjacent cell.
      const contact = groundTriangle(row, col)
        || (row > 0 && groundTriangle(row - 1, col))
        || (row < ROWS - 1 && groundTriangle(row + 1, col));
      if (contact) return contact.dot(groundRay.direction);

      // The exact poles share an apex and may have a degenerate triangle.
      const y = lat - row, x = lon - col;
      const radiusAt = (r, c) => vertices[vertexOffset(r, c) + 10];
      if (x + y <= 1) {
        return (1 - x - y) * radiusAt(row, col)
          + x * radiusAt(row, col + 1)
          + y * radiusAt(row + 1, col);
      }
      return (x + y - 1) * radiusAt(row + 1, col + 1)
        + (1 - x) * radiusAt(row + 1, col)
        + (1 - y) * radiusAt(row, col + 1);
    },
    updateLighting(centers) {
      mesh.getWorldQuaternion(inverseOrientation).invert();
      localSun.copy(sunlight).applyQuaternion(inverseOrientation);
      centers.slice(0, 8).forEach((center, index) => cloudCenters[index].copy(center));
    },
  };
}
