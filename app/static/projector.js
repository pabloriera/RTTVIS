const PROJECTOR_CHANNEL_NAME = "rtiavis.projector.v1";
const BAND_RANGES = [
  [40, 160],
  [160, 500],
  [500, 2000],
  [2000, 8000],
];
const EVENT_COOLDOWN_MS = 75;
const ACTIVITY_UPDATE_INTERVAL_MS = 33;
const FFT_SIZE = 2048;
const FFT_FLOOR_DB = -120;
const SPECTRUM_MAX_FREQUENCY = 8000;
const SPECTRUM_SMOOTHING_MS = 90;
const DEFAULT_BAND_THRESHOLDS = [-42, -45, -48, -50];
const THRESHOLD_HYSTERESIS_DB = 3;

const projectionCanvas = document.querySelector("#projectionCanvas");
const startButton = document.querySelector("#startButton");
const projectorStatus = document.querySelector("#projectorStatus");
const channel = new BroadcastChannel(PROJECTOR_CHANNEL_NAME);

const VERTEX_SHADER_SOURCE = `
attribute vec2 a_position;
varying vec2 v_uv;

void main() {
  v_uv = a_position * 0.5 + 0.5;
  gl_Position = vec4(a_position, 0.0, 1.0);
}
`;

const FRAGMENT_SHADER_SOURCE = `
precision mediump float;

varying vec2 v_uv;
uniform sampler2D u_from;
uniform sampler2D u_to;
uniform sampler2D u_from_mask;
uniform sampler2D u_to_mask;
uniform vec2 u_view_size;
uniform vec2 u_from_size;
uniform vec2 u_to_size;
uniform float u_blend;
uniform float u_gamma;
uniform float u_contrast;
uniform float u_brightness;
uniform float u_saturation;
uniform float u_time;
uniform float u_melt_amount;
uniform float u_melt_variation;
uniform float u_melt_speed;
uniform float u_masked_smudge_enabled;
uniform float u_tiling;
uniform float u_glow_enabled;
uniform float u_glow_radius;
uniform float u_glow_intensity;
uniform float u_glow_frequency;
uniform float u_glow_hue;
uniform float u_sam_overlay_enabled;
uniform float u_sam_overlay_alpha;

vec3 permute(vec3 x) { return mod(((x*34.0)+1.0)*x, 289.0); }

vec3 hsv2rgb(vec3 c) {
  vec3 p = abs(fract(c.xxx + vec3(0.0, 2.0 / 3.0, 1.0 / 3.0)) * 6.0 - 3.0);
  return c.z * mix(vec3(1.0), clamp(p - 1.0, 0.0, 1.0), c.y);
}

float snoise(vec2 v){
  const vec4 C = vec4(0.211324865405187, 0.366025403784439,
           -0.577350269189626, 0.024390243902439);
  vec2 i  = floor(v + dot(v, C.yy) );
  vec2 x0 = v -   i + dot(i, C.xx);
  vec2 i1;
  i1 = (x0.x > x0.y) ? vec2(1.0, 0.0) : vec2(0.0, 1.0);
  vec4 x12 = x0.xyxy + C.xxzz;
  x12.xy -= i1;
  i = mod(i, 289.0);
  vec3 p = permute( permute( i.y + vec3(0.0, i1.y, 1.0 ))
  + i.x + vec3(0.0, i1.x, 1.0 ));
  vec3 m = max(0.5 - vec3(dot(x0,x0), dot(x12.xy,x12.xy),
    dot(x12.zw,x12.zw)), 0.0);
  m = m*m ;
  m = m*m ;
  vec3 x = 2.0 * fract(p * C.www) - 1.0;
  vec3 h = abs(x) - 0.5;
  vec3 ox = floor(x + 0.5);
  vec3 a0 = x - ox;
  m *= 1.79284291400159 - 0.85373472095314 * ( a0*a0 + h*h );
  vec3 g;
  g.x  = a0.x  * x0.x  + h.x  * x0.y;
  g.yz = a0.yz * x12.xz + h.yz * x12.yw;
  return 130.0 * dot(m, g);
}

vec4 pixel_melt(vec2 uv) {
  float time = u_time * (0.1 + u_melt_speed * 1.5);
  
  // Use noise to calculate a procedural smudge pull
  float noise_scale = mix(2.0, 15.0, u_melt_variation);
  
  // Adjust UVs for aspect ratio so the noise isn't stretched
  vec2 aspect_uv = uv * vec2(u_view_size.x / max(u_view_size.y, 1.0), 1.0);
  
  // Two different offsets to get pseudo-independent x and y noise
  float noise_x = snoise(aspect_uv * noise_scale + vec2(time, 0.0));
  float noise_y = snoise(aspect_uv * noise_scale + vec2(0.0, time));
  
  vec2 pull = vec2(noise_x, noise_y);
  
  float distance = u_melt_amount * 0.15;
  float smear_length = u_melt_amount * 0.03;
  
  return vec4(
    uv + pull * distance,
    pull * smear_length
  );
}

vec4 sample_contain(sampler2D image, vec2 image_size, vec2 source_uv) {
  float view_aspect = u_view_size.x / max(u_view_size.y, 1.0);
  float image_aspect = image_size.x / max(image_size.y, 1.0);
  
  vec2 uv = source_uv;
  
  if (view_aspect > image_aspect) {
    float visible_width = image_aspect / view_aspect;
    uv.x = (uv.x - (1.0 - visible_width) * 0.5) / visible_width;
  } else {
    float visible_height = view_aspect / image_aspect;
    uv.y = (uv.y - (1.0 - visible_height) * 0.5) / visible_height;
  }
  
  if (u_tiling > 0.5) {
    // Reflection tiling (mirroring)
    uv = 1.0 - abs(mod(uv, 2.0) - 1.0);
  } else {
    // Clamp / transparent border
    if (uv.x < 0.0 || uv.x > 1.0 || uv.y < 0.0 || uv.y > 1.0) {
      return vec4(0.0);
    }
  }

  return texture2D(image, uv);
}

vec4 sample_melt(
  sampler2D image,
  vec2 image_size,
  vec2 source_uv,
  vec2 smear_step
) {
  // Four taps soften each narrow strip into a short directional trail. The
  // contain sampler returns transparent black outside the image, avoiding
  // the stretched edge produced by CLAMP_TO_EDGE.
  vec4 color = sample_contain(image, image_size, source_uv) * 0.50;
  color += sample_contain(image, image_size, source_uv + smear_step) * 0.25;
  color += sample_contain(image, image_size, source_uv + smear_step * 2.0) * 0.15;
  color += sample_contain(image, image_size, source_uv - smear_step) * 0.10;
  return color;
}

float mask_strength(vec4 mask_color) {
  return max(mask_color.a, max(mask_color.r, max(mask_color.g, mask_color.b)));
}

float get_soft_mask(sampler2D maskTex, vec2 image_size, vec2 source_uv) {
  vec2 texel = 1.0 / max(image_size, vec2(1.0));
  float center = mask_strength(sample_contain(maskTex, image_size, source_uv));
  float edge = 0.0;
  edge += mask_strength(sample_contain(maskTex, image_size, source_uv + vec2(texel.x, 0.0)));
  edge += mask_strength(sample_contain(maskTex, image_size, source_uv - vec2(texel.x, 0.0)));
  edge += mask_strength(sample_contain(maskTex, image_size, source_uv + vec2(0.0, texel.y)));
  edge += mask_strength(sample_contain(maskTex, image_size, source_uv - vec2(0.0, texel.y)));
  edge += mask_strength(sample_contain(maskTex, image_size, source_uv + texel));
  edge += mask_strength(sample_contain(maskTex, image_size, source_uv - texel));
  edge += mask_strength(sample_contain(maskTex, image_size, source_uv + vec2(texel.x, -texel.y)));
  edge += mask_strength(sample_contain(maskTex, image_size, source_uv + vec2(-texel.x, texel.y)));
  return max(center, edge / 8.0);
}

float get_mask_glow(sampler2D maskTex, vec2 image_size, vec2 source_uv) {
  float glow = 0.0;
  vec2 texel = 1.0 / max(image_size, vec2(1.0));
  float radius = 1.0 + u_glow_radius * 5.0;

  // 5x5 blur for performance and crisp glow
  for (int x = -2; x <= 2; x++) {
    for (int y = -2; y <= 2; y++) {
      vec2 offset = vec2(float(x), float(y)) * texel * radius;
      glow += mask_strength(sample_contain(maskTex, image_size, source_uv + offset));
    }
  }
  return glow / 25.0;
}

void main() {
  vec4 melt = pixel_melt(v_uv);
  if (u_masked_smudge_enabled > 0.5) {
    float from_smudge_mask = get_soft_mask(u_from_mask, u_from_size, v_uv);
    float to_smudge_mask = get_soft_mask(u_to_mask, u_to_size, v_uv);
    float smudge_mask = mix(from_smudge_mask, to_smudge_mask, u_blend);
    melt.xy = mix(v_uv, melt.xy, smudge_mask);
    melt.zw *= smudge_mask;
  }
  vec4 from_sample = sample_melt(u_from, u_from_size, melt.xy, melt.zw);
  vec4 to_sample = sample_melt(u_to, u_to_size, melt.xy, melt.zw);
  float from_luminance = dot(from_sample.rgb, vec3(0.2126, 0.7152, 0.0722));
  float to_luminance = dot(to_sample.rgb, vec3(0.2126, 0.7152, 0.0722));
  vec3 from_color = mix(vec3(from_luminance), from_sample.rgb, u_saturation);
  vec3 to_color = mix(vec3(to_luminance), to_sample.rgb, u_saturation);
  from_color = pow(max(from_color + vec3(u_brightness), vec3(0.0)), vec3(1.0 / max(u_gamma, 0.001)));
  to_color = pow(max(to_color + vec3(u_brightness), vec3(0.0)), vec3(1.0 / max(u_gamma, 0.001)));
  from_color = (from_color - vec3(0.5)) * u_contrast + vec3(0.5);
  to_color = (to_color - vec3(0.5)) * u_contrast + vec3(0.5);
  vec3 color = mix(from_color * from_sample.a, to_color * to_sample.a, u_blend);

  if (u_glow_enabled > 0.5 && u_glow_intensity > 0.01) {
    float from_mask_val = mask_strength(sample_contain(u_from_mask, u_from_size, melt.xy));
    float to_mask_val = mask_strength(sample_contain(u_to_mask, u_to_size, melt.xy));
    float from_glow = get_mask_glow(u_from_mask, u_from_size, melt.xy);
    float to_glow = get_mask_glow(u_to_mask, u_to_size, melt.xy);

    vec3 glow_color = hsv2rgb(vec3(u_glow_hue / 360.0, 0.9, 1.0))
      * (1.2 + 0.4 * sin(u_time * u_glow_frequency));

    float blended_glow = mix(from_glow, to_glow, u_blend);
    float blended_mask = mix(from_mask_val, to_mask_val, u_blend);

    // Halo intensity is high where the blurred mask is positive but the original mask is 0
    float halo = max(blended_glow - blended_mask * 0.5, 0.0);

    color += glow_color * halo * u_glow_intensity * 1.5;
  }

  if (u_sam_overlay_enabled > 0.5) {
    vec4 from_mask_color = sample_contain(u_from_mask, u_from_size, melt.xy);
    vec4 to_mask_color = sample_contain(u_to_mask, u_to_size, melt.xy);
    vec4 blended_mask_color = mix(from_mask_color, to_mask_color, u_blend);
    float from_soft_mask = get_soft_mask(u_from_mask, u_from_size, melt.xy);
    float to_soft_mask = get_soft_mask(u_to_mask, u_to_size, melt.xy);
    float blended_mask_strength = mix(from_soft_mask, to_soft_mask, u_blend);
    // Standard alpha blend: color = color * (1 - alpha) + mask_color * alpha
    color = mix(color, max(blended_mask_color.rgb, vec3(0.0, 0.65, 1.0)), blended_mask_strength * u_sam_overlay_alpha);
  }

  gl_FragColor = vec4(clamp(color, 0.0, 1.0), 1.0);
}
`;

let images = [];
let masks = [];
let selectedIndex = 0;
let gl = null;
let glProgram = null;
let positionBuffer = null;
let shaderLocations = null;
let fromFrame = null;
let toFrame = null;
let pendingFrame = null;
let transitionStartedAt = null;
let imageRequestId = 0;
let renderAnimationFrame = null;
const textureCache = new Map();
let projectorEffects = {
  crossfadeSeconds: 1,
  gamma: 1,
  contrast: 1,
  brightness: 0,
  saturation: 1,
  meltAmount: 0,
  meltVariation: 0.30,
  meltSpeed: 0.35,
  maskedSmudge: false,
  tiling: 1.0,
  glowRadius: 0.0,
  glowIntensity: 0.5,
  glowFrequency: 4.0,
  glowHue: 195,
  samOverlay: false,
  samOverlayAlpha: 0.65,
};
let audioContext = null;
let audioStream = null;
let analyser = null;
let silentAudioSink = null;
let timeData = null;
let fftReal = null;
let fftImaginary = null;
let fftWindow = null;
let fftMagnitudes = null;
let smoothedMagnitudes = null;
let fftMagnitudeScale = 1;
let inputGainLinear = 1;
let animationFrame = null;
let bandThresholds = [...DEFAULT_BAND_THRESHOLDS];
const bandArmed = BAND_RANGES.map(() => true);
let lastEventAt = Number.NEGATIVE_INFINITY;
let lastActivityUpdateAt = Number.NEGATIVE_INFINITY;
let lastSpectrumAt = null;

let normalizedBands = [0.0, 0.0, 0.0, 0.0];
let audioMatrix = {
  masterGain: 1.0,
  crossfadeSeconds: [0, 0, 0, 0],
  gamma: [0, 0, 0, 0],
  contrast: [0, 0, 0, 0],
  brightness: [0, 0, 0, 0],
  saturation: [0, 0, 0, 0],
  meltAmount: [0, 0, 0, 0],
  meltVariation: [0, 0, 0, 0],
  meltSpeed: [0, 0, 0, 0],
  glowRadius: [0, 0, 0, 0],
  glowIntensity: [0, 0, 0, 0],
  glowFrequency: [0, 0, 0, 0],
  glowHue: [0, 0, 0, 0],
  samOverlayAlpha: [0, 0, 0, 0],
};

function applyAudioMatrix(matrix) {
  if (matrix && typeof matrix === "object") {
    if (Number.isFinite(matrix.masterGain)) {
      audioMatrix.masterGain = matrix.masterGain;
    }
    Object.keys(audioMatrix).forEach((key) => {
      if (key !== "masterGain" && Array.isArray(matrix[key])) {
        audioMatrix[key] = matrix[key].map((v) => Number.isFinite(v) ? v : 0);
      }
    });
  }
}

function getModulated(paramName, baseValue) {
  const multipliers = audioMatrix[paramName];
  if (!multipliers) {
    return baseValue;
  }
  let modulation = 0;
  for (let index = 0; index < 4; index += 1) {
    modulation += normalizedBands[index] * (multipliers[index] || 0);
  }
  const gain = Number.isFinite(audioMatrix.masterGain) ? audioMatrix.masterGain : 1.0;
  const val = baseValue + modulation * gain;
  switch (paramName) {
    case "crossfadeSeconds": return Math.max(0, Math.min(30, val));
    case "gamma": return Math.max(0.2, Math.min(3, val));
    case "contrast": return Math.max(0, Math.min(3, val));
    case "brightness": return Math.max(-1, Math.min(1, val));
    case "saturation": return Math.max(0, Math.min(2, val));
    case "meltAmount": return Math.max(0, Math.min(0.5, val));
    case "meltVariation": return Math.max(0, Math.min(1, val));
    case "meltSpeed": return Math.max(0, Math.min(2, val));
    case "glowRadius": return Math.max(0, Math.min(1, val));
    case "glowIntensity": return Math.max(0, Math.min(2, val));
    case "glowFrequency": return Math.max(0, Math.min(12, val));
    case "glowHue": return Math.max(0, Math.min(360, val));
    case "samOverlayAlpha": return Math.max(0, Math.min(1, val));
    default: return val;
  }
}

function normalizeIndex(index) {
  if (images.length === 0) {
    return 0;
  }
  return ((index % images.length) + images.length) % images.length;
}

function compileShader(type, source) {
  const shader = gl.createShader(type);
  gl.shaderSource(shader, source);
  gl.compileShader(shader);
  if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
    const message = gl.getShaderInfoLog(shader) || "Unknown GLSL compilation error";
    gl.deleteShader(shader);
    throw new Error(message);
  }
  return shader;
}

function initializeWebGl() {
  gl = projectionCanvas.getContext("webgl", {
    alpha: false,
    antialias: true,
    powerPreference: "high-performance",
  });
  if (!gl) {
    throw new Error("WebGL is unavailable");
  }
  const vertexShader = compileShader(gl.VERTEX_SHADER, VERTEX_SHADER_SOURCE);
  const fragmentShader = compileShader(gl.FRAGMENT_SHADER, FRAGMENT_SHADER_SOURCE);
  glProgram = gl.createProgram();
  gl.attachShader(glProgram, vertexShader);
  gl.attachShader(glProgram, fragmentShader);
  gl.linkProgram(glProgram);
  gl.deleteShader(vertexShader);
  gl.deleteShader(fragmentShader);
  if (!gl.getProgramParameter(glProgram, gl.LINK_STATUS)) {
    throw new Error(gl.getProgramInfoLog(glProgram) || "Unable to link GLSL program");
  }
  positionBuffer = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, positionBuffer);
  gl.bufferData(
    gl.ARRAY_BUFFER,
    new Float32Array([-1, -1, 1, -1, -1, 1, -1, 1, 1, -1, 1, 1]),
    gl.STATIC_DRAW,
  );
  shaderLocations = {
    position: gl.getAttribLocation(glProgram, "a_position"),
    from: gl.getUniformLocation(glProgram, "u_from"),
    to: gl.getUniformLocation(glProgram, "u_to"),
    fromMask: gl.getUniformLocation(glProgram, "u_from_mask"),
    toMask: gl.getUniformLocation(glProgram, "u_to_mask"),
    viewSize: gl.getUniformLocation(glProgram, "u_view_size"),
    fromSize: gl.getUniformLocation(glProgram, "u_from_size"),
    toSize: gl.getUniformLocation(glProgram, "u_to_size"),
    blend: gl.getUniformLocation(glProgram, "u_blend"),
    gamma: gl.getUniformLocation(glProgram, "u_gamma"),
    contrast: gl.getUniformLocation(glProgram, "u_contrast"),
    brightness: gl.getUniformLocation(glProgram, "u_brightness"),
    saturation: gl.getUniformLocation(glProgram, "u_saturation"),
    time: gl.getUniformLocation(glProgram, "u_time"),
    meltAmount: gl.getUniformLocation(glProgram, "u_melt_amount"),
    meltVariation: gl.getUniformLocation(glProgram, "u_melt_variation"),
    meltSpeed: gl.getUniformLocation(glProgram, "u_melt_speed"),
    maskedSmudgeEnabled: gl.getUniformLocation(glProgram, "u_masked_smudge_enabled"),
    tiling: gl.getUniformLocation(glProgram, "u_tiling"),
    glowEnabled: gl.getUniformLocation(glProgram, "u_glow_enabled"),
    glowRadius: gl.getUniformLocation(glProgram, "u_glow_radius"),
    glowIntensity: gl.getUniformLocation(glProgram, "u_glow_intensity"),
    glowFrequency: gl.getUniformLocation(glProgram, "u_glow_frequency"),
    glowHue: gl.getUniformLocation(glProgram, "u_glow_hue"),
    samOverlayEnabled: gl.getUniformLocation(glProgram, "u_sam_overlay_enabled"),
    samOverlayAlpha: gl.getUniformLocation(glProgram, "u_sam_overlay_alpha"),
  };
  gl.clearColor(0, 0, 0, 1);
}

function loadTexture(source, maskSource = null) {
  const cacheKey = source + (maskSource ? "::mask::" + maskSource : "");
  if (textureCache.has(cacheKey)) {
    return textureCache.get(cacheKey);
  }
  const pending = new Promise((resolve, reject) => {
    const image = new Image();
    image.onload = () => {
      const texture = gl.createTexture();
      gl.bindTexture(gl.TEXTURE_2D, texture);
      gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, true);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, image);

      // Create mask texture
      const maskTexture = gl.createTexture();
      gl.bindTexture(gl.TEXTURE_2D, maskTexture);
      gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, true);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);

      if (maskSource) {
        const maskImage = new Image();
        maskImage.onload = () => {
          gl.bindTexture(gl.TEXTURE_2D, maskTexture);
          gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, maskImage);
          resolve({ texture, maskTexture, width: image.naturalWidth, height: image.naturalHeight, source, maskSource });
        };
        maskImage.onerror = () => {
          // Fallback empty mask (black 1x1)
          gl.bindTexture(gl.TEXTURE_2D, maskTexture);
          const pixel = new Uint8Array([0, 0, 0, 0]);
          gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, 1, 1, 0, gl.RGBA, gl.UNSIGNED_BYTE, pixel);
          resolve({ texture, maskTexture, width: image.naturalWidth, height: image.naturalHeight, source, maskSource: null });
        };
        maskImage.src = maskSource;
      } else {
        // Create standard empty mask (black 1x1)
        const pixel = new Uint8Array([0, 0, 0, 0]);
        gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, 1, 1, 0, gl.RGBA, gl.UNSIGNED_BYTE, pixel);
        resolve({ texture, maskTexture, width: image.naturalWidth, height: image.naturalHeight, source, maskSource: null });
      }
    };
    image.onerror = () => reject(new Error("Unable to load projection image"));
    image.src = source;
  });
  textureCache.set(cacheKey, pending);
  pending.catch(() => textureCache.delete(cacheKey));
  return pending;
}

function pruneTextureCache() {
  const retainedSources = new Set();
  images.forEach((src, idx) => {
    const maskSrc = masks[idx] || null;
    const cacheKey = src + (maskSrc ? "::mask::" + maskSrc : "");
    retainedSources.add(cacheKey);
  });
  if (fromFrame) {
    const key = fromFrame.source + (fromFrame.maskSource ? "::mask::" + fromFrame.maskSource : "");
    retainedSources.add(key);
  }
  if (toFrame) {
    const key = toFrame.source + (toFrame.maskSource ? "::mask::" + toFrame.maskSource : "");
    retainedSources.add(key);
  }
  if (pendingFrame) {
    const key = pendingFrame.source + (pendingFrame.maskSource ? "::mask::" + pendingFrame.maskSource : "");
    retainedSources.add(key);
  }
  textureCache.forEach((pending, cacheKey) => {
    if (retainedSources.has(cacheKey)) {
      return;
    }
    textureCache.delete(cacheKey);
    void pending.then((frame) => {
      if (frame !== fromFrame && frame !== toFrame && frame !== pendingFrame) {
        gl.deleteTexture(frame.texture);
        if (frame.maskTexture) {
          gl.deleteTexture(frame.maskTexture);
        }
      }
    }).catch(() => {});
  });
}

async function showImage(index, { notify = false } = {}) {
  if (images.length === 0) {
    return;
  }
  selectedIndex = normalizeIndex(index);
  const source = images[selectedIndex];
  const maskSource = masks[selectedIndex] || null;
  const requestId = ++imageRequestId;
  projectorStatus.textContent = `Image ${selectedIndex + 1} of ${images.length}`;
  if (notify) {
    channel.postMessage({ type: "select", index: selectedIndex });
  }
  try {
    const nextFrame = await loadTexture(source, maskSource);
    if (requestId !== imageRequestId) {
      return;
    }
    if (!toFrame) {
      fromFrame = nextFrame;
      toFrame = nextFrame;
      transitionStartedAt = null;
    } else if (transitionStartedAt !== null) {
      pendingFrame = nextFrame;
    } else if (toFrame.source !== nextFrame.source || toFrame.maskSource !== nextFrame.maskSource) {
      fromFrame = toFrame;
      toFrame = nextFrame;
      transitionStartedAt = performance.now();
    }
    pruneTextureCache();
  } catch (error) {
    projectorStatus.textContent = error?.message || "Unable to load projection image";
  }
}

function setBatch(nextImages, nextMasks, index) {
  images = Array.isArray(nextImages) ? nextImages.filter((image) => typeof image === "string") : [];
  masks = Array.isArray(nextMasks) ? nextMasks : [];
  if (!gl) {
    projectorStatus.textContent = "WebGL unavailable; audio analysis remains available";
    return;
  }
  for (let i = 0; i < images.length; i++) {
    const source = images[i];
    const maskSource = masks[i] || null;
    void loadTexture(source, maskSource).catch(() => {});
  }
  if (images.length > 0) {
    void showImage(Number.isFinite(index) ? index : 0);
  }
  pruneTextureCache();
}

function clearProjection() {
  imageRequestId += 1;
  images = [];
  masks = [];
  selectedIndex = 0;
  fromFrame = null;
  toFrame = null;
  pendingFrame = null;
  transitionStartedAt = null;
  projectorStatus.textContent = "Waiting for next render";
  pruneTextureCache();
}

function nextImage() {
  if (images.length > 1) {
    void showImage(selectedIndex + 1, { notify: true });
  }
}

function resizeProjectionCanvas() {
  const pixelRatio = Math.min(window.devicePixelRatio || 1, 2);
  const width = Math.max(1, Math.round(projectionCanvas.clientWidth * pixelRatio));
  const height = Math.max(1, Math.round(projectionCanvas.clientHeight * pixelRatio));
  if (projectionCanvas.width !== width || projectionCanvas.height !== height) {
    projectionCanvas.width = width;
    projectionCanvas.height = height;
  }
  gl.viewport(0, 0, width, height);
}

function renderProjection(timestamp) {
  resizeProjectionCanvas();
  gl.clear(gl.COLOR_BUFFER_BIT);
  if (fromFrame && toFrame) {
    let blend = 1;
    const currentCrossfadeSeconds = getModulated("crossfadeSeconds", projectorEffects.crossfadeSeconds);
    if (transitionStartedAt !== null && currentCrossfadeSeconds > 0) {
      const linearBlend = Math.max(
        0,
        Math.min(1, (timestamp - transitionStartedAt) / (currentCrossfadeSeconds * 1000)),
      );
      blend = linearBlend * linearBlend * (3 - 2 * linearBlend);
      if (linearBlend >= 1) {
        fromFrame = toFrame;
        transitionStartedAt = null;
        if (pendingFrame && (pendingFrame.source !== toFrame.source || pendingFrame.maskSource !== toFrame.maskSource)) {
          toFrame = pendingFrame;
          pendingFrame = null;
          transitionStartedAt = timestamp;
          blend = 0;
        } else {
          pendingFrame = null;
        }
        pruneTextureCache();
      }
    } else if (transitionStartedAt !== null) {
      fromFrame = toFrame;
      transitionStartedAt = null;
      if (pendingFrame && (pendingFrame.source !== toFrame.source || pendingFrame.maskSource !== toFrame.maskSource)) {
        toFrame = pendingFrame;
        pendingFrame = null;
        transitionStartedAt = timestamp;
        blend = 0;
      } else {
        pendingFrame = null;
      }
      pruneTextureCache();
    }

    gl.useProgram(glProgram);
    gl.bindBuffer(gl.ARRAY_BUFFER, positionBuffer);
    gl.enableVertexAttribArray(shaderLocations.position);
    gl.vertexAttribPointer(shaderLocations.position, 2, gl.FLOAT, false, 0, 0);
    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, fromFrame.texture);
    gl.uniform1i(shaderLocations.from, 0);
    gl.activeTexture(gl.TEXTURE1);
    gl.bindTexture(gl.TEXTURE_2D, toFrame.texture);
    gl.uniform1i(shaderLocations.to, 1);
    gl.activeTexture(gl.TEXTURE2);
    gl.bindTexture(gl.TEXTURE_2D, fromFrame.maskTexture);
    gl.uniform1i(shaderLocations.fromMask, 2);
    gl.activeTexture(gl.TEXTURE3);
    gl.bindTexture(gl.TEXTURE_2D, toFrame.maskTexture);
    gl.uniform1i(shaderLocations.toMask, 3);
    gl.uniform2f(shaderLocations.viewSize, projectionCanvas.width, projectionCanvas.height);
    gl.uniform2f(shaderLocations.fromSize, fromFrame.width, fromFrame.height);
    gl.uniform2f(shaderLocations.toSize, toFrame.width, toFrame.height);
    gl.uniform1f(shaderLocations.blend, blend);
    gl.uniform1f(shaderLocations.gamma, getModulated("gamma", projectorEffects.gamma));
    gl.uniform1f(shaderLocations.contrast, getModulated("contrast", projectorEffects.contrast));
    gl.uniform1f(shaderLocations.brightness, getModulated("brightness", projectorEffects.brightness));
    gl.uniform1f(shaderLocations.saturation, getModulated("saturation", projectorEffects.saturation));
    gl.uniform1f(shaderLocations.time, timestamp / 1000);
    gl.uniform1f(shaderLocations.meltAmount, getModulated("meltAmount", projectorEffects.meltAmount));
    gl.uniform1f(shaderLocations.meltVariation, getModulated("meltVariation", projectorEffects.meltVariation));
    gl.uniform1f(shaderLocations.meltSpeed, getModulated("meltSpeed", projectorEffects.meltSpeed));
    gl.uniform1f(shaderLocations.maskedSmudgeEnabled, projectorEffects.maskedSmudge ? 1.0 : 0.0);
    gl.uniform1f(shaderLocations.tiling, projectorEffects.tiling);
    const hasGlow = (fromFrame.maskSource || toFrame.maskSource) ? 1.0 : 0.0;
    gl.uniform1f(shaderLocations.glowEnabled, hasGlow);
    gl.uniform1f(shaderLocations.glowRadius, getModulated("glowRadius", projectorEffects.glowRadius));
    gl.uniform1f(shaderLocations.glowIntensity, getModulated("glowIntensity", projectorEffects.glowIntensity));
    gl.uniform1f(shaderLocations.glowFrequency, getModulated("glowFrequency", projectorEffects.glowFrequency));
    gl.uniform1f(shaderLocations.glowHue, getModulated("glowHue", projectorEffects.glowHue));
    gl.uniform1f(shaderLocations.samOverlayEnabled, projectorEffects.samOverlay ? 1.0 : 0.0);
    gl.uniform1f(shaderLocations.samOverlayAlpha, getModulated("samOverlayAlpha", projectorEffects.samOverlayAlpha));
    gl.drawArrays(gl.TRIANGLES, 0, 6);
  }
  renderAnimationFrame = window.requestAnimationFrame(renderProjection);
}

function applyProjectorEffects(effects) {
  projectorEffects = {
    crossfadeSeconds: Number.isFinite(effects?.crossfadeSeconds)
      ? Math.max(0, Math.min(30, effects.crossfadeSeconds))
      : 1,
    gamma: Number.isFinite(effects?.gamma) ? Math.max(0.2, Math.min(3, effects.gamma)) : 1,
    contrast: Number.isFinite(effects?.contrast) ? Math.max(0, Math.min(3, effects.contrast)) : 1,
    brightness: Number.isFinite(effects?.brightness)
      ? Math.max(-1, Math.min(1, effects.brightness))
      : 0,
    saturation: Number.isFinite(effects?.saturation)
      ? Math.max(0, Math.min(2, effects.saturation))
      : 1,
    meltAmount: Number.isFinite(effects?.meltAmount)
      ? Math.max(0, Math.min(0.5, effects.meltAmount))
      : 0,
    meltVariation: Number.isFinite(effects?.meltVariation)
      ? Math.max(0, Math.min(1, effects.meltVariation))
      : 0.30,
    meltSpeed: Number.isFinite(effects?.meltSpeed)
      ? Math.max(0, Math.min(2, effects.meltSpeed))
      : 0.35,
    maskedSmudge: !!effects?.maskedSmudge,
    glowRadius: Number.isFinite(effects?.glowRadius)
      ? Math.max(0, Math.min(1, effects.glowRadius))
      : 0,
    glowIntensity: Number.isFinite(effects?.glowIntensity)
      ? Math.max(0, Math.min(2, effects.glowIntensity))
      : 0.5,
    glowFrequency: Number.isFinite(effects?.glowFrequency)
      ? Math.max(0, Math.min(12, effects.glowFrequency))
      : 4.0,
    glowHue: Number.isFinite(effects?.glowHue)
      ? Math.max(0, Math.min(360, effects.glowHue))
      : 195,
    samOverlay: !!effects?.samOverlay,
    samOverlayAlpha: Number.isFinite(effects?.samOverlayAlpha)
      ? Math.max(0, Math.min(1, effects.samOverlayAlpha))
      : 0.65,
    tiling: effects?.tiling ?? 1.0,
  };
}

function initializeFft() {
  timeData = new Float32Array(FFT_SIZE);
  fftReal = new Float64Array(FFT_SIZE);
  fftImaginary = new Float64Array(FFT_SIZE);
  fftWindow = new Float64Array(FFT_SIZE);
  fftMagnitudes = new Float64Array(FFT_SIZE / 2);
  smoothedMagnitudes = new Float64Array(FFT_SIZE / 2);
  let effectiveWindowLength = 0;
  for (let index = 0; index < FFT_SIZE; index += 1) {
    const weight = 0.5 * (1 - Math.cos((2 * Math.PI * index) / (FFT_SIZE - 1)));
    fftWindow[index] = weight;
    effectiveWindowLength += weight;
  }
  // One-sided FFT amplitude, normalized by the effective Hann-window length.
  fftMagnitudeScale = 2 / effectiveWindowLength;
}

function calculateFftMagnitudes() {
  for (let index = 0; index < FFT_SIZE; index += 1) {
    fftReal[index] = timeData[index] * inputGainLinear * fftWindow[index];
    fftImaginary[index] = 0;
  }

  for (let index = 1, reversed = 0; index < FFT_SIZE; index += 1) {
    let bit = FFT_SIZE >> 1;
    while (reversed & bit) {
      reversed ^= bit;
      bit >>= 1;
    }
    reversed ^= bit;
    if (index < reversed) {
      const realValue = fftReal[index];
      fftReal[index] = fftReal[reversed];
      fftReal[reversed] = realValue;
      const imaginaryValue = fftImaginary[index];
      fftImaginary[index] = fftImaginary[reversed];
      fftImaginary[reversed] = imaginaryValue;
    }
  }

  for (let length = 2; length <= FFT_SIZE; length <<= 1) {
    const angle = (-2 * Math.PI) / length;
    const stepReal = Math.cos(angle);
    const stepImaginary = Math.sin(angle);
    for (let start = 0; start < FFT_SIZE; start += length) {
      let twiddleReal = 1;
      let twiddleImaginary = 0;
      const halfLength = length >> 1;
      for (let offset = 0; offset < halfLength; offset += 1) {
        const evenIndex = start + offset;
        const oddIndex = evenIndex + halfLength;
        const oddReal = fftReal[oddIndex] * twiddleReal
          - fftImaginary[oddIndex] * twiddleImaginary;
        const oddImaginary = fftReal[oddIndex] * twiddleImaginary
          + fftImaginary[oddIndex] * twiddleReal;
        const evenReal = fftReal[evenIndex];
        const evenImaginary = fftImaginary[evenIndex];
        fftReal[evenIndex] = evenReal + oddReal;
        fftImaginary[evenIndex] = evenImaginary + oddImaginary;
        fftReal[oddIndex] = evenReal - oddReal;
        fftImaginary[oddIndex] = evenImaginary - oddImaginary;
        const nextTwiddleReal = twiddleReal * stepReal - twiddleImaginary * stepImaginary;
        twiddleImaginary = twiddleReal * stepImaginary + twiddleImaginary * stepReal;
        twiddleReal = nextTwiddleReal;
      }
    }
  }

  for (let bin = 0; bin < fftMagnitudes.length; bin += 1) {
    fftMagnitudes[bin] = Math.hypot(fftReal[bin], fftImaginary[bin]) * fftMagnitudeScale;
  }
}

function magnitudeToDb(magnitude) {
  return Math.max(FFT_FLOOR_DB, 20 * Math.log10(Math.max(magnitude, 1e-12)));
}

function bandPeakDb(minimum, maximum, binWidth) {
  const startBin = Math.max(1, Math.ceil(minimum / binWidth));
  const endBin = Math.min(smoothedMagnitudes.length - 1, Math.floor(maximum / binWidth));
  let peak = 0;
  for (let bin = startBin; bin <= endBin; bin += 1) {
    peak = Math.max(peak, smoothedMagnitudes[bin]);
  }
  return magnitudeToDb(peak);
}

function analyzeAudio(timestamp) {
  analyser.getFloatTimeDomainData(timeData);
  calculateFftMagnitudes();
  const elapsed = lastSpectrumAt === null ? Number.POSITIVE_INFINITY : timestamp - lastSpectrumAt;
  const memory = Number.isFinite(elapsed) ? Math.exp(-elapsed / SPECTRUM_SMOOTHING_MS) : 0;
  for (let bin = 0; bin < smoothedMagnitudes.length; bin += 1) {
    smoothedMagnitudes[bin] = smoothedMagnitudes[bin] * memory
      + fftMagnitudes[bin] * (1 - memory);
  }
  lastSpectrumAt = timestamp;
  const binWidth = audioContext.sampleRate / FFT_SIZE;
  const bandDb = BAND_RANGES.map(([minimum, maximum]) => bandPeakDb(minimum, maximum, binWidth));

  normalizedBands = bandDb.map((db) => {
    const minDb = -96;
    const maxDb = 0;
    return Math.max(0, Math.min(1, (db - minDb) / (maxDb - minDb)));
  });

  const crossedBands = [];
  bandDb.forEach((level, index) => {
    const threshold = bandThresholds[index];
    if (level <= threshold - THRESHOLD_HYSTERESIS_DB) {
      bandArmed[index] = true;
    }
    if (bandArmed[index] && level >= threshold) {
      crossedBands.push(index);
      bandArmed[index] = false;
    }
  });

  const eventTriggered = crossedBands.length > 0 && timestamp - lastEventAt >= EVENT_COOLDOWN_MS;
  if (eventTriggered) {
    lastEventAt = timestamp;
    nextImage();
  }
  if (eventTriggered || timestamp - lastActivityUpdateAt >= ACTIVITY_UPDATE_INTERVAL_MS) {
    lastActivityUpdateAt = timestamp;
    const spectrumStartBin = Math.max(1, Math.ceil(BAND_RANGES[0][0] / binWidth));
    const spectrumEndBin = Math.min(
      smoothedMagnitudes.length - 1,
      Math.floor(SPECTRUM_MAX_FREQUENCY / binWidth),
    );
    const spectrumDb = [];
    for (let bin = spectrumStartBin; bin <= spectrumEndBin; bin += 1) {
      spectrumDb.push(magnitudeToDb(smoothedMagnitudes[bin]));
    }
    channel.postMessage({
      type: "audio",
      bandDb,
      spectrumDb,
      spectrumStartBin,
      spectrumBinWidth: binWidth,
      eventTriggered,
      triggeredBands: eventTriggered ? crossedBands : [],
    });
  }
  animationFrame = window.requestAnimationFrame(analyzeAudio);
}

async function startProjection() {
  startButton.disabled = true;
  projectorStatus.textContent = "Requesting audio input";
  if (document.fullscreenElement === null) {
    try {
      await document.documentElement.requestFullscreen();
    } catch {
      projectorStatus.textContent = "Fullscreen was blocked; starting audio anyway";
    }
  }
  try {
    audioStream = await navigator.mediaDevices.getUserMedia({
      audio: {
        autoGainControl: false,
        echoCancellation: false,
        noiseSuppression: false,
      },
      video: false,
    });
    audioContext = new AudioContext();
    await audioContext.resume();
    const source = audioContext.createMediaStreamSource(audioStream);
    analyser = audioContext.createAnalyser();
    analyser.fftSize = FFT_SIZE;
    analyser.smoothingTimeConstant = 0;
    source.connect(analyser);
    silentAudioSink = audioContext.createGain();
    silentAudioSink.gain.value = 0;
    analyser.connect(silentAudioSink);
    silentAudioSink.connect(audioContext.destination);
    initializeFft();
    document.body.dataset.started = "true";
    channel.postMessage({ type: "audio-status", active: true });
    animationFrame = window.requestAnimationFrame(analyzeAudio);
  } catch (error) {
    startButton.disabled = false;
    projectorStatus.textContent = error?.message || "Audio input unavailable";
  }
}

channel.addEventListener("message", (event) => {
  if (event.data?.type === "batch") {
    setBatch(event.data.images, event.data.masks, Number.parseInt(event.data.selectedIndex, 10));
  } else if (event.data?.type === "clear") {
    clearProjection();
  } else if (event.data?.type === "select") {
    void showImage(Number.parseInt(event.data.index, 10));
  } else if (event.data?.type === "audio-thresholds") {
    bandThresholds = BAND_RANGES.map((_, index) => {
      const value = event.data.thresholds?.[index];
      return Number.isFinite(value) ? Math.max(-96, Math.min(0, value)) : DEFAULT_BAND_THRESHOLDS[index];
    });
  } else if (event.data?.type === "audio-input-gain") {
    const gainDb = Number.isFinite(event.data.gainDb) ? Math.max(-24, Math.min(24, event.data.gainDb)) : 0;
    inputGainLinear = 10 ** (gainDb / 20);
  } else if (event.data?.type === "projector-effects") {
    applyProjectorEffects(event.data.effects);
  } else if (event.data?.type === "audio-matrix") {
    applyAudioMatrix(event.data.matrix);
  }
});

startButton.addEventListener("click", () => void startProjection());
projectionCanvas.addEventListener("click", nextImage);
projectionCanvas.addEventListener("webglcontextlost", (event) => {
  event.preventDefault();
  projectorStatus.textContent = "WebGL context lost; reload the projector";
});
window.addEventListener("keydown", (event) => {
  if (event.key === "ArrowRight" || event.key === " ") {
    event.preventDefault();
    nextImage();
  } else if (event.key === "ArrowLeft") {
    event.preventDefault();
    void showImage(selectedIndex - 1, { notify: true });
  }
});
window.addEventListener("pagehide", () => {
  if (animationFrame !== null) {
    window.cancelAnimationFrame(animationFrame);
  }
  if (renderAnimationFrame !== null) {
    window.cancelAnimationFrame(renderAnimationFrame);
  }
  for (const track of audioStream?.getTracks() || []) {
    track.stop();
  }
  void audioContext?.close();
  channel.postMessage({ type: "audio-status", active: false });
  channel.close();
});

try {
  initializeWebGl();
  renderAnimationFrame = window.requestAnimationFrame(renderProjection);
} catch (error) {
  projectorStatus.textContent = `${error?.message || "Unable to initialize WebGL"}; audio is still available`;
}
channel.postMessage({ type: "audio-status", active: false });
channel.postMessage({ type: "ready" });
