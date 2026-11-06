/* Global elevation: NOAA National Geophysical Data Center, ETOPO1 Ice Surface.
 * https://doi.org/10.7289/V5C8276M
 * Relief is intentionally exaggerated for a miniature globe. */
(() => {
  'use strict';

  const EXTENT = 1.049;
  const ELEVATION_SCALE = 0.042;
  const SEGMENTS = 320;
  const ROWS = 160;
  const VERTEX_SHADER = `
    attribute vec3 aPosition;
    attribute vec3 aNormal;
    attribute vec2 aUv;
    attribute float aHeight;
    uniform mat3 uView;
    uniform float uExtent;
    varying vec3 vNormal;
    varying vec3 vRadial;
    varying vec2 vUv;
    varying float vHeight;
    void main() {
      vec3 position = uView * aPosition;
      gl_Position = vec4(position.x, position.y, -position.z, uExtent);
      vNormal = uView * aNormal;
      vRadial = normalize(position);
      vUv = aUv;
      vHeight = aHeight;
    }
  `;
  const FRAGMENT_SHADER = `
    #ifdef GL_FRAGMENT_PRECISION_HIGH
      precision highp float;
    #else
      precision mediump float;
    #endif
    uniform sampler2D uSurface;
    varying vec3 vNormal;
    varying vec3 vRadial;
    varying vec2 vUv;
    varying float vHeight;
    void main() {
      vec3 raw = texture2D(uSurface, vUv).rgb;
      vec3 radial = normalize(vRadial);
      vec3 normal = normalize(vNormal);
      vec3 light = normalize(vec3(-0.53, 0.60, 0.68));
      vec3 halfLight = normalize(light + vec3(0.0, 0.0, 1.0));
      float incidence = max(0.0, dot(radial, light));
      float diffuse = max(0.0, dot(normal, light));
      float limb = 1.0 - max(0.0, radial.z);
      float oceanHue = raw.b - raw.r;
      // The Blue Marble deep oceans have RGB around (2, 5, 20); even
      // that dark blue must pick up the full water material.
      float water = (1.0 - smoothstep(0.008, 0.085, vHeight))
        * smoothstep(0.015, 0.052, oceanHue);
      float photoTone = dot(raw, vec3(0.2126, 0.7152, 0.0722));
      float vegetation = smoothstep(-0.055, 0.13, raw.g - raw.r);
      float ice = smoothstep(0.57, 0.83, photoTone);
      float rock = smoothstep(0.20, 0.69, vHeight) * (1.0 - 0.38 * vegetation);
      vec3 earth = mix(vec3(0.73, 0.63, 0.39), vec3(0.24, 0.60, 0.38), vegetation);
      earth = mix(earth, vec3(0.55, 0.52, 0.46), rock);
      earth = mix(earth, vec3(0.86, 0.87, 0.81), max(ice, 0.66 * smoothstep(0.68, 0.92, vHeight)));
      earth = mix(earth, raw, 0.20);
      earth *= 0.54 + 0.57 * diffuse;
      earth += vec3(0.085, 0.073, 0.058) * pow(max(0.0, dot(normal, halfLight)), 14.0);
      float shallow = smoothstep(0.13, 0.42, photoTone);
      vec3 ocean = mix(vec3(0.060, 0.33, 0.62), vec3(0.09, 0.61, 0.74), 0.80 * shallow);
      ocean = mix(ocean, raw, 0.10);
      ocean *= 0.67 + 0.41 * incidence;
      ocean += vec3(0.11, 0.16, 0.19) * pow(max(0.0, dot(radial, halfLight)), 21.0);
      vec3 color = mix(earth, ocean, water);
      color += vec3(0.062, 0.14, 0.19) * pow(limb, 5.0) * (0.55 + 0.45 * incidence);
      gl_FragColor = vec4(color, 1.0);
    }
  `;

  function shader(gl, type, source) {
    const compiled = gl.createShader(type);
    gl.shaderSource(compiled, source);
    gl.compileShader(compiled);
    if (!gl.getShaderParameter(compiled, gl.COMPILE_STATUS)) {
      throw new Error(gl.getShaderInfoLog(compiled));
    }
    return compiled;
  }

  function createProgram(gl) {
    const program = gl.createProgram();
    const vertex = shader(gl, gl.VERTEX_SHADER, VERTEX_SHADER);
    const fragment = shader(gl, gl.FRAGMENT_SHADER, FRAGMENT_SHADER);
    gl.attachShader(program, vertex);
    gl.attachShader(program, fragment);
    gl.linkProgram(program);
    gl.deleteShader(vertex);
    gl.deleteShader(fragment);
    if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
      throw new Error(gl.getProgramInfoLog(program));
    }
    return program;
  }

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

  function setView(matrix, yaw, pitch, tilt) {
    const cy = Math.cos(yaw);
    const sy = Math.sin(yaw);
    const cp = Math.cos(pitch);
    const sp = Math.sin(pitch);
    const ct = Math.cos(tilt);
    const st = Math.sin(tilt);
    matrix[0] = ct * cy - st * sp * sy;
    matrix[1] = st * cy + ct * sp * sy;
    matrix[2] = -cp * sy;
    matrix[3] = -st * cp;
    matrix[4] = ct * cp;
    matrix[5] = sp;
    matrix[6] = ct * sy + st * sp * cy;
    matrix[7] = st * sy - ct * sp * cy;
    matrix[8] = cp * cy;
  }

  function create(surfaceImage, elevationImage) {
    const canvas = document.createElement('canvas');
    const gl = canvas.getContext('webgl', { alpha: true, antialias: true, preserveDrawingBuffer: true });
    if (!gl) return null;
    try {
      const sampleHeight = elevationSampler(elevationImage);
      const mesh = buildMesh(sampleHeight);
      const program = createProgram(gl);
      gl.useProgram(program);
      gl.bindBuffer(gl.ARRAY_BUFFER, gl.createBuffer());
      gl.bufferData(gl.ARRAY_BUFFER, mesh.vertices, gl.STATIC_DRAW);
      gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, gl.createBuffer());
      gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, mesh.indices, gl.STATIC_DRAW);
      for (const [name, count, offset] of [['aPosition', 3, 0], ['aNormal', 3, 3], ['aUv', 2, 6], ['aHeight', 1, 8]]) {
        const attribute = gl.getAttribLocation(program, name);
        gl.enableVertexAttribArray(attribute);
        gl.vertexAttribPointer(attribute, count, gl.FLOAT, false, mesh.stride * 4, offset * 4);
      }
      gl.bindTexture(gl.TEXTURE_2D, gl.createTexture());
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, surfaceImage);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
      gl.uniform1i(gl.getUniformLocation(program, 'uSurface'), 0);
      gl.uniform1f(gl.getUniformLocation(program, 'uExtent'), EXTENT);
      const viewUniform = gl.getUniformLocation(program, 'uView');
      const view = new Float32Array(9);
      gl.enable(gl.DEPTH_TEST);
      gl.enable(gl.CULL_FACE);
      gl.clearColor(0, 0, 0, 0);
      if (gl.getError() !== gl.NO_ERROR) return null;

      return {
        lift(lat, lon) {
          return heightToRadius(sampleHeight((lon + 180) / 360, (90 - lat) / 180));
        },
        isAvailable() {
          return !gl.isContextLost();
        },
        draw(context, frame, pitch, tilt) {
          const halfSize = frame.radius * EXTENT;
          const screenDensity = Math.max(1, Math.min(2, context.getTransform().a));
          const pixels = Math.max(1, Math.min(1000, Math.ceil(2 * halfSize * screenDensity)));
          if (canvas.width !== pixels || canvas.height !== pixels) {
            canvas.width = pixels;
            canvas.height = pixels;
            gl.viewport(0, 0, pixels, pixels);
          }
          setView(view, frame.rotation, pitch, tilt);
          gl.uniformMatrix3fv(viewUniform, false, view);
          gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
          gl.drawElements(gl.TRIANGLES, mesh.indices.length, gl.UNSIGNED_SHORT, 0);
          context.drawImage(canvas, frame.cx - halfSize, frame.cy - halfSize, 2 * halfSize, 2 * halfSize);
        },
      };
    } catch {
      return null;
    }
  }

  window.EWMEarthTerrain = { create };
})();
