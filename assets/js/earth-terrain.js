/* NASA Blue Marble surface color and NOAA ETOPO1 elevation.
 * https://doi.org/10.7289/V5C8276M */
import * as THREE from "three";

const ELEVATION_SCALE = 0.042;
const SEGMENTS = 320;
const ROWS = 160;

function elevationSampler(image) {
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
    const upper = rgba[(y0 * width + i0) * 4] * (1 - dx) + rgba[(y0 * width + i1) * 4] * dx;
    const lower = rgba[(y1 * width + i0) * 4] * (1 - dx) + rgba[(y1 * width + i1) * 4] * dx;
    return (upper * (1 - dy) + lower * dy) / 255;
  };
}

function heightToRadius(height) {
  return 1 + ELEVATION_SCALE * Math.pow(height, 0.93);
}

function buildMesh(sampleHeight) {
  const columns = SEGMENTS + 1;
  const stride = 9;
  const vertices = new Float32Array((ROWS + 1) * columns * stride);
  const indices = new Uint16Array(ROWS * SEGMENTS * 6);
  for (let row = 0; row <= ROWS; row += 1) {
    const v = row / ROWS;
    const lat = (0.5 - v) * Math.PI;
    for (let col = 0; col <= SEGMENTS; col += 1) {
      const u = col / SEGMENTS;
      const lon = (u - 0.5) * 2 * Math.PI;
      const height = sampleHeight(row === 0 || row === ROWS ? 0.5 : u, v);
      const lift = heightToRadius(height);
      const offset = (row * columns + col) * stride;
      vertices[offset] = Math.cos(lat) * Math.sin(lon) * lift;
      vertices[offset + 1] = Math.sin(lat) * lift;
      vertices[offset + 2] = Math.cos(lat) * Math.cos(lon) * lift;
      vertices[offset + 6] = u;
      vertices[offset + 7] = v;
      vertices[offset + 8] = height;
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
  varying vec2 vUv;
  varying vec3 vLocal;
  varying vec3 vRadial;
  varying vec3 vNormal;
  varying float vElevation;

  void main() {
    vUv = uv;
    vLocal = position;
    vRadial = mat3(modelMatrix) * normalize(position);
    vNormal = normalMatrix * normal;
    vElevation = elevation;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`;

const fragmentShader = `
  uniform sampler2D surfaceMap;
  uniform vec3 sun;
  uniform vec3 localSun;
  uniform vec4 cloudCenters[8];
  varying vec2 vUv;
  varying vec3 vLocal;
  varying vec3 vRadial;
  varying vec3 vNormal;
  varying float vElevation;

  void main() {
    vec3 raw = texture2D(surfaceMap, vUv).rgb;
    vec3 radial = normalize(vRadial);
    vec3 surfaceNormal = normalize(vNormal);
    vec3 halfLight = normalize(sun + vec3(0.0, 0.0, 1.0));
    float facingLight = dot(radial, sun);
    float diffuse = max(0.0, dot(surfaceNormal, sun));
    float side = 1.0 - max(0.0, radial.z);
    float water = (1.0 - smoothstep(0.008, 0.085, vElevation))
      * smoothstep(0.015, 0.052, raw.b - raw.r);
    float tone = dot(raw, vec3(0.2126, 0.7152, 0.0722));
    float vegetation = smoothstep(-0.058, 0.09, raw.g - raw.r);
    float snow = smoothstep(0.55, 0.86, tone);
    float rock = smoothstep(0.22, 0.71, vElevation) * (1.0 - 0.38 * vegetation);
    vec3 land = mix(vec3(0.76, 0.65, 0.43), vec3(0.27, 0.56, 0.36), vegetation);
    land = mix(land, vec3(0.54, 0.49, 0.40), rock);
    land = mix(land, vec3(0.86, 0.88, 0.84), max(snow, 0.62 * smoothstep(0.68, 0.93, vElevation)));
    land = mix(land, raw, 0.28);
    land *= 0.47 + 0.68 * diffuse;
    land += vec3(0.09, 0.08, 0.06) * pow(max(0.0, dot(surfaceNormal, halfLight)), 18.0);
    vec3 waterColor = mix(vec3(0.075, 0.31, 0.55), vec3(0.12, 0.51, 0.61), 0.65 * smoothstep(0.14, 0.46, tone));
    waterColor *= 0.48 + 0.53 * smoothstep(-0.28, 1.0, facingLight);
    waterColor += vec3(0.10, 0.14, 0.17) * pow(max(0.0, dot(radial, halfLight)), 17.0);

    // Cast the cloud silhouettes onto the same geographical surface.
    float shadow = 0.0;
    for (int i = 0; i < 8; i++) {
      vec3 towardCloud = cloudCenters[i].xyz - vLocal;
      float distanceToCloud = dot(towardCloud, localSun);
      float clearance = length(towardCloud - localSun * distanceToCloud);
      float radius = max(0.0001, cloudCenters[i].w);
      float softness = radius * 0.76 + distanceToCloud * 0.08;
      float occlusion = 1.0 - smoothstep(radius * 0.18, max(radius * 0.24, softness), clearance);
      shadow = max(shadow, occlusion * smoothstep(0.0, 0.02, distanceToCloud)
        * (1.0 - smoothstep(0.22, 0.50, distanceToCloud)) * step(0.001, cloudCenters[i].w));
    }
    vec3 color = mix(land, waterColor, water) * (1.0 - 0.23 * shadow * smoothstep(-0.1, 0.4, facingLight));
    float rim = pow(side, 4.0) * (0.32 + 0.68 * smoothstep(-0.1, 0.88, facingLight));
    color += vec3(0.13, 0.28, 0.39) * rim;
    gl_FragColor = vec4(color, 1.0);
  }
`;

export function createEarthTerrain(surfaceImage, elevationImage, sunlight) {
  const sampleHeight = elevationSampler(elevationImage);
  const { vertices, indices, stride } = buildMesh(sampleHeight);
  const geometry = new THREE.BufferGeometry();
  const data = new THREE.InterleavedBuffer(vertices, stride);
  geometry.setAttribute("position", new THREE.InterleavedBufferAttribute(data, 3, 0));
  geometry.setAttribute("normal", new THREE.InterleavedBufferAttribute(data, 3, 3));
  geometry.setAttribute("uv", new THREE.InterleavedBufferAttribute(data, 2, 6));
  geometry.setAttribute("elevation", new THREE.InterleavedBufferAttribute(data, 1, 8));
  geometry.setIndex(new THREE.BufferAttribute(indices, 1));

  const surfaceMap = new THREE.Texture(surfaceImage);
  surfaceMap.flipY = false;
  surfaceMap.needsUpdate = true;
  const localSun = sunlight.clone();
  const cloudCenters = Array.from({ length: 8 }, () => new THREE.Vector4(0, 0, 0, 0));
  const material = new THREE.ShaderMaterial({
    uniforms: {
      surfaceMap: { value: surfaceMap },
      sun: { value: sunlight },
      localSun: { value: localSun },
      cloudCenters: { value: cloudCenters },
    },
    vertexShader,
    fragmentShader,
    toneMapped: false,
  });
  const mesh = new THREE.Mesh(geometry, material);
  mesh.name = "Earth terrain";
  const inverseOrientation = new THREE.Quaternion();
  return {
    mesh,
    surfaceRadius(latitude, longitude) {
      const lat = (90 - latitude) / 180 * ROWS;
      const degrees = longitude + 180;
      const lon = (degrees - Math.floor(degrees / 360) * 360) / 360 * SEGMENTS;
      const row = Math.min(ROWS - 1, Math.floor(lat)), col = Math.floor(lon);
      const y = lat - row, x = lon - col;
      const heightAt = (r, c) => vertices[(r * (SEGMENTS + 1) + c) * stride + 8];
      // The anchor follows the triangle used by the rendered mesh.
      if (x + y <= 1) {
        return (1 - x - y) * heightToRadius(heightAt(row, col))
          + x * heightToRadius(heightAt(row, col + 1))
          + y * heightToRadius(heightAt(row + 1, col));
      }
      return (x + y - 1) * heightToRadius(heightAt(row + 1, col + 1))
        + (1 - x) * heightToRadius(heightAt(row + 1, col))
        + (1 - y) * heightToRadius(heightAt(row, col + 1));
    },
    updateLighting(centers) {
      mesh.getWorldQuaternion(inverseOrientation).invert();
      localSun.copy(sunlight).applyQuaternion(inverseOrientation);
      centers.slice(0, 8).forEach((center, index) => cloudCenters[index].copy(center));
    },
  };
}
