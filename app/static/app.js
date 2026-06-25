const promptInput = document.querySelector("#promptInput");
const promptStack = document.querySelector(".prompt-stack");
const additionalPromptPanel = document.querySelector("#additionalPromptPanel");
const additionalPromptInput = document.querySelector("#additionalPromptInput");
const micButton = document.querySelector("#micButton");
const sequenceButton = document.querySelector("#sequenceButton");
const promptBlendButton = document.querySelector("#promptBlendButton");
const projectorButton = document.querySelector("#projectorButton");
const resetButton = document.querySelector("#resetButton");
const statusWrap = document.querySelector(".status-wrap");
const statusText = document.querySelector("#statusText");
const audioMonitor = document.querySelector("#audioMonitor");
const audioPanelToggle = document.querySelector("#audioPanelToggle");
const audioChannels = document.querySelector("#audioChannels");
const audioSpectrumCanvas = document.querySelector("#audioSpectrumCanvas");
const audioSpectrumContext = audioSpectrumCanvas.getContext("2d");
const audioInputGain = document.querySelector("#audioInputGain");
const audioInputGainValue = document.querySelector("#audioInputGainValue");
const effectsPanel = document.querySelector("#effectsPanel");
const effectsPanelToggle = document.querySelector("#effectsPanelToggle");
const effectsControls = document.querySelector("#effectsControls");
const crossfadeInput = document.querySelector("#crossfadeInput");
const crossfadeValue = document.querySelector("#crossfadeValue");
const gammaInput = document.querySelector("#gammaInput");
const gammaValue = document.querySelector("#gammaValue");
const contrastInput = document.querySelector("#contrastInput");
const contrastValue = document.querySelector("#contrastValue");
const brightnessInput = document.querySelector("#brightnessInput");
const brightnessValue = document.querySelector("#brightnessValue");
const saturationInput = document.querySelector("#saturationInput");
const saturationValue = document.querySelector("#saturationValue");
const meltAmountInput = document.querySelector("#meltAmountInput");
const meltAmountValue = document.querySelector("#meltAmountValue");
const meltVariationInput = document.querySelector("#meltVariationInput");
const meltVariationValue = document.querySelector("#meltVariationValue");
const meltSpeedInput = document.querySelector("#meltSpeedInput");
const meltSpeedValue = document.querySelector("#meltSpeedValue");
const maskedSmudgeToggle = document.querySelector("#maskedSmudgeToggle");
const glowRadiusInput = document.querySelector("#glowRadiusInput");
const glowRadiusValue = document.querySelector("#glowRadiusValue");
const glowIntensityInput = document.querySelector("#glowIntensityInput");
const glowIntensityValue = document.querySelector("#glowIntensityValue");
const glowFrequencyInput = document.querySelector("#glowFrequencyInput");
const glowFrequencyValue = document.querySelector("#glowFrequencyValue");
const glowHueInput = document.querySelector("#glowHueInput");
const glowHueValue = document.querySelector("#glowHueValue");
const tilingInput = document.querySelector("#tilingInput");
const samOverlayAlphaInput = document.querySelector("#samOverlayAlphaInput");
const samOverlayAlphaValue = document.querySelector("#samOverlayAlphaValue");
const audioEventIndicator = document.querySelector("#audioEventIndicator");
const audioEventCount = document.querySelector("#audioEventCount");
const sequenceIndicator = document.querySelector("#sequenceIndicator");
const previewImage = document.querySelector("#previewImage");
const imageSlot = document.querySelector("#imageSlot");
const maskPreviewImage = document.createElement("img");
const modelSelect = document.querySelector("#modelSelect");
const sizeSelect = document.querySelector("#sizeSelect");
const stepsInput = document.querySelector("#stepsInput");
const stepsValue = document.querySelector("#stepsValue");
const guidanceInput = document.querySelector("#guidanceInput");
const guidanceValue = document.querySelector("#guidanceValue");
const seedInput = document.querySelector("#seedInput");
const translateToggle = document.querySelector("#translateToggle");
const sequenceIntervalInput = document.querySelector("#sequenceIntervalInput");
const sequenceIntervalValue = document.querySelector("#sequenceIntervalValue");
const promptSequenceDurationInput = document.querySelector("#promptSequenceDurationInput");
const promptSequenceDurationValue = document.querySelector("#promptSequenceDurationValue");
const batchInput = document.querySelector("#batchInput");
const batchValue = document.querySelector("#batchValue");
const batchWalkToggle = document.querySelector("#batchWalkToggle");
const samToggle = document.querySelector("#samToggle");
const samPromptInput = document.querySelector("#samPromptInput");
const samOverlayToggle = document.querySelector("#samOverlayToggle");
const walkAmplitudeInput = document.querySelector("#walkAmplitudeInput");
const walkAmplitudeMaxInput = document.querySelector("#walkAmplitudeMaxInput");
const walkAmplitudeValue = document.querySelector("#walkAmplitudeValue");
const promptBlendWeightGroup = document.querySelector("#promptBlendWeightGroup");
const promptBlendWeightInput = document.querySelector("#promptBlendWeightInput");
const promptBlendWeightValue = document.querySelector("#promptBlendWeightValue");
const sequenceModeButtons = Array.from(document.querySelectorAll(".sequence-mode-button"));

const GENERATION_SETTINGS_KEY = "rtiavis.generationSettings.v1";
const MODEL_GENERATION_SETTINGS_KEY = "rtiavis.modelGenerationSettings.v1";
const PROJECTOR_CHANNEL_NAME = "rtiavis.projector.v1";
const AUDIO_THRESHOLDS_KEY = "rtiavis.audioThresholdDb.v1";
const AUDIO_INPUT_GAIN_KEY = "rtiavis.audioInputGainDb.v1";
const AUDIO_PANEL_COLLAPSED_KEY = "rtiavis.audioPanelCollapsed.v1";
const PROJECTOR_EFFECTS_KEY = "rtiavis.projectorEffects.v1";
const EFFECTS_PANEL_COLLAPSED_KEY = "rtiavis.effectsPanelCollapsed.v1";
const AUDIO_MATRIX_STATE_KEY = "rtiavis.audioMatrixState.v1";
const AUDIO_MATRIX_PANEL_COLLAPSED_KEY = "rtiavis.audioMatrixPanelCollapsed.v1";
const PNG_DATA_URL_PREFIX = "data:image/png;base64,";
const SAM_SEGMENT_PROMPT = "stuff";
const AUDIO_BAND_RANGES = [[40, 160], [160, 500], [500, 2000], [2000, 8000]];
const AUDIO_BAND_NAMES = ["Bass", "Low", "Mid", "High"];
const AUDIO_BAND_COLORS = ["#0f766e", "#0284c7", "#7c3aed", "#d97706"];
const DEFAULT_AUDIO_THRESHOLDS_DB = [-42, -45, -48, -50];
const DEFAULT_PROJECTOR_EFFECTS = {
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
const CROSSFADE_MIN_SECONDS = 0.05;
const CROSSFADE_MAX_SECONDS = 30;
const CROSSFADE_SLIDER_STEPS = 100;
const SPECTRUM_MIN_FREQUENCY = 40;
const SPECTRUM_MAX_FREQUENCY = 8000;
const SPECTRUM_MIN_DB = -96;
const SPECTRUM_MAX_DB = 0;
const WORD_BOUNDARY = /(?:\s|[.!?,;:])$/;
const DEBOUNCE_MS = 320;
const DEFAULT_SEQUENCE_INTERVAL_SECONDS = 2;
const DEFAULT_PROMPT_SEQUENCE_DURATION_SECONDS = 10;
const DEFAULT_SEQUENCE_MODE = "words";
const SEQUENCE_MODES = new Set(["words", "seed", "walk", "prompts"]);
const DEFAULT_PROMPT_PLACEHOLDER = "un patio verde al atardecer";
const PROMPT_SEQUENCE_PLACEHOLDER = '["prompt 1", "prompt 2", "prompt 3"]';
const DEFAULT_WALK_AMPLITUDE = 0.01;
const DEFAULT_WALK_AMPLITUDE_MAX = 0.01;
const WALK_MOMENTUM = 0.92;
const WALK_TURN_SCALE = 0.35;
const MAX_SEED = 4294967295;
const MAX_STEPS = 50;
const MAX_GUIDANCE = 10;
const DEFAULT_PROMPT_BLEND_WEIGHT = 0.25;
const MAX_PROMPT_BLEND_WEIGHT = 1;
const DEFAULT_GENERATION_SETTINGS = {
  model_id: "sd-turbo",
  width: 512,
  height: 512,
  num_inference_steps: 1,
  guidance_scale: 0,
  seed: null,
  batch_size: 1,
  batch_walk: false,
  sam: false,
  sam_prompt: SAM_SEGMENT_PROMPT,
  translate: false,
  prompt: "",
  sequence_interval_seconds: DEFAULT_SEQUENCE_INTERVAL_SECONDS,
  prompt_sequence_duration_seconds: DEFAULT_PROMPT_SEQUENCE_DURATION_SECONDS,
  walk_amplitude: DEFAULT_WALK_AMPLITUDE,
  walk_amplitude_max: DEFAULT_WALK_AMPLITUDE_MAX,
  sequence_mode: DEFAULT_SEQUENCE_MODE,
  prompt_blend_enabled: false,
  additional_prompt: "",
  additional_prompt_weight: DEFAULT_PROMPT_BLEND_WEIGHT,
};
const ASR_SAMPLE_RATE = 16000;

let imageModelDefaults = new Map();
let modelGenerationSettings = new Map();
let activeModelId = DEFAULT_GENERATION_SETTINGS.model_id;

let debounceTimer = null;
let lastSubmittedKey = "";
let latestRequestId = 0;
let audioContext = null;
let micStream = null;
let micSource = null;
let micProcessor = null;
let micSilencer = null;
let transcriptSocket = null;
let dictationBaseValue = "";
let dictationActive = false;
let dictationStarting = false;
let suppressTranscriptsUntilReset = false;
let sequenceActive = false;
let sequenceRunId = 0;
let sequenceTextRevision = 0;
let projectionImages = [];
let projectionMasks = [];
let projectedImageIndex = 0;
let segmentationRequestId = 0;
let projectorWindow = null;
let projectorAudioEventCount = 0;
let audioEventFlashTimer = null;
let spectrumDb = [];
let spectrumStartBin = 1;
let spectrumBinWidth = 1;
let audioBandDb = AUDIO_BAND_RANGES.map(() => SPECTRUM_MIN_DB);
let triggeredAudioBands = [];
let draggedThresholdBand = null;
let audioThresholdsDb = [...DEFAULT_AUDIO_THRESHOLDS_DB];

maskPreviewImage.className = "mask-preview-image";
maskPreviewImage.alt = "SAM mask overlay";
maskPreviewImage.hidden = true;
imageSlot.append(maskPreviewImage);
const projectorChannel = "BroadcastChannel" in window
  ? new BroadcastChannel(PROJECTOR_CHANNEL_NAME)
  : null;

function growTextarea() {
  promptInput.style.height = "";
}

function growAdditionalPromptTextarea() {
  additionalPromptInput.style.height = "";
}

function setStatus(text, state = "idle") {
  statusText.textContent = text;
  statusWrap.dataset.state = state;
}

function setMicState(state) {
  micButton.dataset.state = state;
  const active = state === "recording";
  micButton.setAttribute("aria-pressed", String(active));
  micButton.setAttribute("aria-label", active ? "Stop dictation" : "Start dictation");
  micButton.textContent = active ? "Stop" : "Dictate";
}

function setSequenceState(active) {
  sequenceActive = active;
  const mode = getSequenceMode();
  const modeLabel = mode === "seed"
    ? "seed sequence"
    : mode === "walk"
      ? "embedding walk"
      : mode === "prompts"
        ? "prompt sequencer"
        : "word-by-word sequence";
  sequenceButton.setAttribute("aria-pressed", String(active));
  sequenceButton.setAttribute(
    "aria-label",
    active ? `Stop ${modeLabel}` : `Generate ${modeLabel}`,
  );
  sequenceButton.title = active ? `Stop ${modeLabel}` : `Play ${modeLabel}`;
  sequenceButton.textContent = active ? "■" : "▶";
}

function setSequenceMode(mode) {
  const nextMode = SEQUENCE_MODES.has(mode) ? mode : DEFAULT_SEQUENCE_MODE;
  sequenceModeButtons.forEach((button) => {
    button.setAttribute("aria-pressed", String(button.dataset.sequenceMode === nextMode));
  });
  promptInput.placeholder = nextMode === "prompts"
    ? PROMPT_SEQUENCE_PLACEHOLDER
    : DEFAULT_PROMPT_PLACEHOLDER;
  setSequenceState(sequenceActive);
  if (nextMode === "prompts") {
    refreshPromptSequenceValidation();
  } else if (!sequenceActive) {
    clearSequenceIndicator();
  }
}

function sendProjectionBatch() {
  if (!projectorChannel) {
    return;
  }
  if (projectionImages.length === 0) {
    projectorChannel.postMessage({ type: "clear" });
    return;
  }
  projectorChannel.postMessage({
    type: "batch",
    images: projectionImages,
    masks: projectionMasks,
    selectedIndex: projectedImageIndex,
  });
}

function imageDataUrl(encoded) {
  if (!encoded) {
    return "";
  }
  return encoded.startsWith("data:image/") ? encoded : `${PNG_DATA_URL_PREFIX}${encoded}`;
}

function maskDataUrl(encoded) {
  if (!encoded) {
    return null;
  }
  return encoded.startsWith("data:image/") ? encoded : `${PNG_DATA_URL_PREFIX}${encoded}`;
}

function base64FromImageDataUrl(source) {
  return source.replace(/^data:image\/[^;]+;base64,/, "");
}

function projectionNeedsSegmentation() {
  return projectionImages.length > 0
    && projectionImages.some((_, index) => !projectionMasks[index]);
}

function hasProjectionMasks() {
  return projectionMasks.some(Boolean);
}

async function segmentImagesBase64(imagesPngBase64, { statusLabel = "Segmenting" } = {}) {
  if (!Array.isArray(imagesPngBase64) || imagesPngBase64.length === 0) {
    return [];
  }
  setStatus(statusLabel, "busy");
  const response = await fetch("/api/segment", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      images_png_base64: imagesPngBase64,
      prompt: samPromptInput ? samPromptInput.value : SAM_SEGMENT_PROMPT,
      translate: translateToggle ? translateToggle.checked : false,
    }),
  });
  const payload = await response.json();
  if (!response.ok || !Array.isArray(payload.masks_png_base64)) {
    throw new Error(payload.detail || "Segmentation failed.");
  }
  return payload.masks_png_base64;
}

async function segmentCurrentProjectionImages({ statusLabel = "Segmenting" } = {}) {
  if (projectionImages.length === 0 || !projectionNeedsSegmentation()) {
    sendProjectionBatch();
    return true;
  }

  const requestId = ++segmentationRequestId;
  const sourceImages = [...projectionImages];
  const imagesPngBase64 = sourceImages.map(base64FromImageDataUrl);
  const masks = await segmentImagesBase64(
    imagesPngBase64,
    { statusLabel },
  );

  if (
    requestId !== segmentationRequestId
    || sourceImages.length !== projectionImages.length
    || sourceImages.some((source, index) => projectionImages[index] !== source)
  ) {
    return false;
  }

  projectionMasks = sourceImages.map((_, index) => maskDataUrl(masks[index]));
  sendProjectionBatch();
  return hasProjectionMasks();
}

function setAudioPanelCollapsed(collapsed, { persist = true } = {}) {
  audioMonitor.dataset.collapsed = String(collapsed);
  audioChannels.hidden = collapsed;
  audioPanelToggle.setAttribute("aria-expanded", String(!collapsed));
  audioPanelToggle.setAttribute(
    "aria-label",
    collapsed ? "Expand audio panel" : "Collapse audio panel",
  );
  audioPanelToggle.title = collapsed ? "Expand audio panel" : "Collapse audio panel";
  audioPanelToggle.textContent = collapsed ? "▸" : "▾";
  if (persist) {
    window.localStorage.setItem(AUDIO_PANEL_COLLAPSED_KEY, String(collapsed));
  }
  if (!collapsed) {
    window.requestAnimationFrame(drawAudioSpectrum);
  }
}

function loadAudioPanelState() {
  setAudioPanelCollapsed(
    window.localStorage.getItem(AUDIO_PANEL_COLLAPSED_KEY) === "true",
    { persist: false },
  );
}

function setEffectsPanelCollapsed(collapsed, { persist = true } = {}) {
  effectsPanel.dataset.collapsed = String(collapsed);
  effectsControls.hidden = collapsed;
  effectsPanelToggle.setAttribute("aria-expanded", String(!collapsed));
  effectsPanelToggle.setAttribute(
    "aria-label",
    collapsed ? "Expand effects panel" : "Collapse effects panel",
  );
  effectsPanelToggle.title = collapsed ? "Expand effects panel" : "Collapse effects panel";
  effectsPanelToggle.textContent = collapsed ? "▸" : "▾";
  if (persist) {
    window.localStorage.setItem(EFFECTS_PANEL_COLLAPSED_KEY, String(collapsed));
  }
}

function loadEffectsPanelState() {
  setEffectsPanelCollapsed(
    window.localStorage.getItem(EFFECTS_PANEL_COLLAPSED_KEY) === "true",
    { persist: false },
  );
}

const MATRIX_EFFECTS = [
  { key: "crossfadeSeconds", label: "Crossfade" },
  { key: "gamma", label: "Gamma" },
  { key: "contrast", label: "Contrast" },
  { key: "brightness", label: "Brightness" },
  { key: "saturation", label: "Saturation" },
  { key: "meltAmount", label: "Smudge amount" },
  { key: "meltVariation", label: "Smudge var" },
  { key: "meltSpeed", label: "Smudge speed" },
  { key: "glowRadius", label: "Glow radius" },
  { key: "glowIntensity", label: "Glow intensity" },
  { key: "glowFrequency", label: "Glow frequency" },
  { key: "glowHue", label: "Glow hue" },
  { key: "samOverlayAlpha", label: "SAM alpha" },
];

let audioMatrixState = {
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

function saveAudioMatrixState() {
  window.localStorage.setItem(AUDIO_MATRIX_STATE_KEY, JSON.stringify(audioMatrixState));
}

function loadAudioMatrixState() {
  try {
    const stored = window.localStorage.getItem(AUDIO_MATRIX_STATE_KEY);
    if (stored) {
      const parsed = JSON.parse(stored);
      if (parsed && typeof parsed === "object") {
        if (Number.isFinite(parsed.masterGain)) {
          audioMatrixState.masterGain = parsed.masterGain;
        }
        Object.keys(audioMatrixState).forEach((key) => {
          if (key !== "masterGain" && Array.isArray(parsed[key])) {
            audioMatrixState[key] = parsed[key].map((v) => Number.isFinite(v) ? v : 0);
          }
        });
      }
    }
  } catch (e) {
    console.error("Failed to load audio matrix state", e);
  }
}

function sendAudioMatrix() {
  projectorChannel?.postMessage({ type: "audio-matrix", matrix: audioMatrixState });
}

function setAudioMatrixPanelCollapsed(collapsed, { persist = true } = {}) {
  const panel = document.getElementById("audioMatrixPanel");
  const controls = document.getElementById("audioMatrixControls");
  const toggle = document.getElementById("audioMatrixPanelToggle");
  if (!panel || !controls || !toggle) return;
  
  panel.dataset.collapsed = String(collapsed);
  controls.hidden = collapsed;
  toggle.setAttribute("aria-expanded", String(!collapsed));
  toggle.setAttribute(
    "aria-label",
    collapsed ? "Expand audio matrix panel" : "Collapse audio matrix panel",
  );
  toggle.title = collapsed ? "Expand audio matrix panel" : "Collapse audio matrix panel";
  toggle.textContent = collapsed ? "▸" : "▾";
  if (persist) {
    window.localStorage.setItem(AUDIO_MATRIX_PANEL_COLLAPSED_KEY, String(collapsed));
  }
}

function loadAudioMatrixPanelState() {
  setAudioMatrixPanelCollapsed(
    window.localStorage.getItem(AUDIO_MATRIX_PANEL_COLLAPSED_KEY) === "true",
    { persist: false },
  );
}

function initializeAudioMatrixUI() {
  const grid = document.querySelector(".audio-matrix-grid");
  if (!grid) return;
  
  loadAudioMatrixState();

  const masterInput = document.getElementById("audioMatrixGainInput");
  const masterValue = document.getElementById("audioMatrixGainValue");
  if (masterInput && masterValue) {
    masterInput.value = String(audioMatrixState.masterGain);
    masterValue.textContent = audioMatrixState.masterGain.toFixed(2) + "x";
    
    masterInput.addEventListener("input", () => {
      const val = Number.parseFloat(masterInput.value);
      audioMatrixState.masterGain = val;
      masterValue.textContent = val.toFixed(2) + "x";
      saveAudioMatrixState();
      sendAudioMatrix();
    });
  }
  
  MATRIX_EFFECTS.forEach((effect) => {
    const isGamma = effect.key === "gamma";
    const labelDiv = document.createElement("div");
    labelDiv.className = "audio-matrix-label";
    labelDiv.textContent = effect.label;
    if (isGamma) {
      labelDiv.style.display = "none";
    }
    grid.appendChild(labelDiv);
    
    for (let bandIndex = 0; bandIndex < 4; bandIndex += 1) {
      const container = document.createElement("div");
      container.className = "audio-matrix-knob-container";
      if (isGamma) {
        container.style.display = "none";
      }
      
      const knobWrapper = document.createElement("div");
      knobWrapper.className = "audio-matrix-knob-wrapper";
      knobWrapper.style.setProperty("--band-color", AUDIO_BAND_COLORS[bandIndex]);
      
      const knobDial = document.createElement("div");
      knobDial.className = "audio-matrix-knob-dial";
      
      const knobPointer = document.createElement("div");
      knobPointer.className = "audio-matrix-knob-pointer";
      
      knobDial.appendChild(knobPointer);
      knobWrapper.appendChild(knobDial);
      
      const initialVal = audioMatrixState[effect.key]?.[bandIndex] ?? 0;
      
      // Minimum is -2.0, maximum is +2.0
      const minVal = -2.0;
      const maxVal = 2.0;
      
      // Total knob travel is 270 degrees (from -135 to +135)
      const updatePointerRotation = (val) => {
        const ratio = (val - minVal) / (maxVal - minVal);
        const degrees = ratio * 270 - 135;
        knobPointer.style.transform = `rotate(${degrees}deg)`;
      };
      
      updatePointerRotation(initialVal);
      
      const valSpan = document.createElement("span");
      valSpan.className = "audio-matrix-knob-value";
      valSpan.textContent = (initialVal > 0 ? "+" : "") + initialVal.toFixed(2);
      
      // Drag behavior
      let isDragging = false;
      let startY = 0;
      let startVal = 0;
      const pixelsPerUnit = 40; // Dragging 40 pixels changes the value by 1.0 unit
      
      knobWrapper.addEventListener("pointerdown", (event) => {
        isDragging = true;
        startY = event.clientY;
        startVal = audioMatrixState[effect.key]?.[bandIndex] ?? 0;
        knobWrapper.setPointerCapture(event.pointerId);
        event.preventDefault();
      });
      
      knobWrapper.addEventListener("pointermove", (event) => {
        if (!isDragging) return;
        event.preventDefault();
        const deltaY = startY - event.clientY; // drag up -> increase value
        let newVal = startVal + deltaY / pixelsPerUnit;
        newVal = Math.max(minVal, Math.min(maxVal, newVal));
        
        // Round to nearest 0.05
        newVal = Math.round(newVal * 20) / 20;
        
        audioMatrixState[effect.key][bandIndex] = newVal;
        valSpan.textContent = (newVal > 0 ? "+" : "") + newVal.toFixed(2);
        updatePointerRotation(newVal);
        
        saveAudioMatrixState();
        sendAudioMatrix();
      });
      
      const finishDrag = (event) => {
        if (!isDragging) return;
        isDragging = false;
        knobWrapper.releasePointerCapture(event.pointerId);
      };
      
      knobWrapper.addEventListener("pointerup", finishDrag);
      knobWrapper.addEventListener("pointercancel", finishDrag);
      
      // Double click to reset to 0.00
      knobWrapper.addEventListener("dblclick", () => {
        const newVal = 0.00;
        audioMatrixState[effect.key][bandIndex] = newVal;
        valSpan.textContent = (newVal > 0 ? "+" : "") + newVal.toFixed(2);
        updatePointerRotation(newVal);
        saveAudioMatrixState();
        sendAudioMatrix();
      });
      
      container.appendChild(knobWrapper);
      container.appendChild(valSpan);
      grid.appendChild(container);
    }
  });
}

function crossfadeSecondsFromSlider(value) {
  const position = Math.max(0, Math.min(CROSSFADE_SLIDER_STEPS, Number(value) || 0));
  if (position <= 0) {
    return 0;
  }
  const normalized = (position - 1) / (CROSSFADE_SLIDER_STEPS - 1);
  return CROSSFADE_MIN_SECONDS
    * ((CROSSFADE_MAX_SECONDS / CROSSFADE_MIN_SECONDS) ** normalized);
}

function crossfadeSliderFromSeconds(value) {
  const seconds = Number(value);
  if (!Number.isFinite(seconds) || seconds <= 0) {
    return 0;
  }
  const clamped = Math.max(CROSSFADE_MIN_SECONDS, Math.min(CROSSFADE_MAX_SECONDS, seconds));
  const normalized = Math.log(clamped / CROSSFADE_MIN_SECONDS)
    / Math.log(CROSSFADE_MAX_SECONDS / CROSSFADE_MIN_SECONDS);
  return Math.round((1 + normalized * (CROSSFADE_SLIDER_STEPS - 1)) * 10) / 10;
}

function formatCrossfadeSeconds(seconds) {
  if (seconds <= 0) {
    return "0s";
  }
  if (seconds < 1) {
    return `${Math.round(seconds * 1000)}ms`;
  }
  if (seconds < 10) {
    return `${seconds.toFixed(1)}s`;
  }
  return `${seconds.toFixed(0)}s`;
}

function getProjectorEffects() {
  const crossfadeSeconds = crossfadeSecondsFromSlider(crossfadeInput.value);
  const gamma = Number.parseFloat(gammaInput.value);
  const contrast = Number.parseFloat(contrastInput.value);
  const brightness = Number.parseFloat(brightnessInput.value);
  const saturation = Number.parseFloat(saturationInput.value);
  const meltAmount = Number.parseFloat(meltAmountInput.value);
  const meltVariation = Number.parseFloat(meltVariationInput.value);
  const meltSpeed = Number.parseFloat(meltSpeedInput.value);
  const glowRadius = Number.parseFloat(glowRadiusInput.value);
  const glowIntensity = Number.parseFloat(glowIntensityInput.value);
  const glowFrequency = Number.parseFloat(glowFrequencyInput.value);
  const glowHue = Number.parseFloat(glowHueInput.value);
  const samOverlayAlpha = Number.parseFloat(samOverlayAlphaInput.value);
  const tiling = tilingInput.checked ? 1.0 : 0.0;
  return {
    crossfadeSeconds,
    gamma: Number.isFinite(gamma)
      ? Math.max(0.2, Math.min(3, gamma))
      : DEFAULT_PROJECTOR_EFFECTS.gamma,
    contrast: Number.isFinite(contrast)
      ? Math.max(0, Math.min(3, contrast))
      : DEFAULT_PROJECTOR_EFFECTS.contrast,
    brightness: Number.isFinite(brightness)
      ? Math.max(-1, Math.min(1, brightness))
      : DEFAULT_PROJECTOR_EFFECTS.brightness,
    saturation: Number.isFinite(saturation)
      ? Math.max(0, Math.min(2, saturation))
      : DEFAULT_PROJECTOR_EFFECTS.saturation,
    meltAmount: Number.isFinite(meltAmount)
      ? Math.max(0, Math.min(0.5, meltAmount))
      : DEFAULT_PROJECTOR_EFFECTS.meltAmount,
    meltVariation: Number.isFinite(meltVariation)
      ? Math.max(0, Math.min(1, meltVariation))
      : DEFAULT_PROJECTOR_EFFECTS.meltVariation,
    meltSpeed: Number.isFinite(meltSpeed)
      ? Math.max(0, Math.min(2, meltSpeed))
      : DEFAULT_PROJECTOR_EFFECTS.meltSpeed,
    maskedSmudge: maskedSmudgeToggle ? maskedSmudgeToggle.checked : false,
    glowRadius: Number.isFinite(glowRadius)
      ? Math.max(0, Math.min(1, glowRadius))
      : DEFAULT_PROJECTOR_EFFECTS.glowRadius,
    glowIntensity: Number.isFinite(glowIntensity)
      ? Math.max(0, Math.min(2, glowIntensity))
      : DEFAULT_PROJECTOR_EFFECTS.glowIntensity,
    glowFrequency: Number.isFinite(glowFrequency)
      ? Math.max(0, Math.min(12, glowFrequency))
      : DEFAULT_PROJECTOR_EFFECTS.glowFrequency,
    glowHue: Number.isFinite(glowHue)
      ? Math.max(0, Math.min(360, glowHue))
      : DEFAULT_PROJECTOR_EFFECTS.glowHue,
    samOverlay: samOverlayToggle ? samOverlayToggle.checked : false,
    samOverlayAlpha: Number.isFinite(samOverlayAlpha)
      ? Math.max(0, Math.min(1, samOverlayAlpha))
      : DEFAULT_PROJECTOR_EFFECTS.samOverlayAlpha,
    tiling,
  };
}

function sendProjectorEffects() {
  projectorChannel?.postMessage({ type: "projector-effects", effects: getProjectorEffects() });
}

function updateProjectorEffects({ persist = true } = {}) {
  const effects = getProjectorEffects();
  crossfadeInput.value = String(crossfadeSliderFromSeconds(effects.crossfadeSeconds));
  gammaInput.value = "1";
  contrastInput.value = String(effects.contrast);
  brightnessInput.value = String(effects.brightness);
  saturationInput.value = String(effects.saturation);
  meltAmountInput.value = String(effects.meltAmount);
  meltVariationInput.value = String(effects.meltVariation);
  meltSpeedInput.value = String(effects.meltSpeed);
  if (maskedSmudgeToggle) {
    maskedSmudgeToggle.checked = !!effects.maskedSmudge;
  }
  glowRadiusInput.value = String(effects.glowRadius);
  glowIntensityInput.value = String(effects.glowIntensity);
  glowFrequencyInput.value = String(effects.glowFrequency);
  glowHueInput.value = String(effects.glowHue);
  samOverlayAlphaInput.value = String(effects.samOverlayAlpha);
  tilingInput.checked = effects.tiling > 0.5;
  crossfadeValue.value = formatCrossfadeSeconds(effects.crossfadeSeconds);
  gammaValue.value = "1.00";
  contrastValue.value = effects.contrast.toFixed(2);
  brightnessValue.value = `${effects.brightness > 0 ? "+" : ""}${effects.brightness.toFixed(2)}`;
  saturationValue.value = effects.saturation.toFixed(2);
  meltAmountValue.value = effects.meltAmount.toFixed(2);
  meltVariationValue.value = effects.meltVariation.toFixed(2);
  meltSpeedValue.value = effects.meltSpeed.toFixed(2);
  glowRadiusValue.value = effects.glowRadius.toFixed(2);
  glowIntensityValue.value = effects.glowIntensity.toFixed(2);
  glowFrequencyValue.value = effects.glowFrequency.toFixed(1);
  glowHueValue.value = effects.glowHue.toFixed(0);
  samOverlayAlphaValue.value = effects.samOverlayAlpha.toFixed(2);
  if (samOverlayToggle) {
    samOverlayToggle.checked = !!effects.samOverlay;
  }
  if (persist) {
    window.localStorage.setItem(PROJECTOR_EFFECTS_KEY, JSON.stringify(effects));
  }
  sendProjectorEffects();
  renderPreviewMaskOverlay();
}

function loadProjectorEffects() {
  let stored = null;
  try {
    stored = JSON.parse(window.localStorage.getItem(PROJECTOR_EFFECTS_KEY) || "null");
  } catch {
    stored = null;
  }
  const source = stored && typeof stored === "object" ? stored : DEFAULT_PROJECTOR_EFFECTS;
  crossfadeInput.value = String(crossfadeSliderFromSeconds(
    source.crossfadeSeconds ?? DEFAULT_PROJECTOR_EFFECTS.crossfadeSeconds,
  ));
  gammaInput.value = "1";
  contrastInput.value = String(source.contrast ?? DEFAULT_PROJECTOR_EFFECTS.contrast);
  brightnessInput.value = String(source.brightness ?? DEFAULT_PROJECTOR_EFFECTS.brightness);
  saturationInput.value = String(source.saturation ?? DEFAULT_PROJECTOR_EFFECTS.saturation);
  meltAmountInput.value = String(source.meltAmount ?? DEFAULT_PROJECTOR_EFFECTS.meltAmount);
  meltVariationInput.value = String(source.meltVariation ?? DEFAULT_PROJECTOR_EFFECTS.meltVariation);
  meltSpeedInput.value = String(source.meltSpeed ?? DEFAULT_PROJECTOR_EFFECTS.meltSpeed);
  if (maskedSmudgeToggle) {
    maskedSmudgeToggle.checked = !!(source.maskedSmudge ?? DEFAULT_PROJECTOR_EFFECTS.maskedSmudge);
  }
  glowRadiusInput.value = String(source.glowRadius ?? DEFAULT_PROJECTOR_EFFECTS.glowRadius);
  glowIntensityInput.value = String(source.glowIntensity ?? DEFAULT_PROJECTOR_EFFECTS.glowIntensity);
  glowFrequencyInput.value = String(source.glowFrequency ?? DEFAULT_PROJECTOR_EFFECTS.glowFrequency);
  glowHueInput.value = String(source.glowHue ?? DEFAULT_PROJECTOR_EFFECTS.glowHue);
  samOverlayAlphaInput.value = String(source.samOverlayAlpha ?? DEFAULT_PROJECTOR_EFFECTS.samOverlayAlpha);
  if (samOverlayToggle) {
    samOverlayToggle.checked = !!(source.samOverlay ?? DEFAULT_PROJECTOR_EFFECTS.samOverlay);
  }
  updateProjectorEffects({ persist: false });
}

function getAudioThresholds() {
  return [...audioThresholdsDb];
}

function sendAudioThresholds() {
  projectorChannel?.postMessage({
    type: "audio-thresholds",
    thresholds: getAudioThresholds(),
  });
}

function loadAudioThresholds() {
  let stored = null;
  try {
    stored = JSON.parse(window.localStorage.getItem(AUDIO_THRESHOLDS_KEY) || "null");
  } catch {
    stored = null;
  }
  audioThresholdsDb = DEFAULT_AUDIO_THRESHOLDS_DB.map((fallback, index) => {
    const threshold = Number.isFinite(stored?.[index]) ? stored[index] : fallback;
    return Math.round(Math.max(SPECTRUM_MIN_DB, Math.min(SPECTRUM_MAX_DB, threshold)));
  });
  sendAudioThresholds();
  drawAudioSpectrum();
}

function updateAudioThresholds() {
  window.localStorage.setItem(AUDIO_THRESHOLDS_KEY, JSON.stringify(audioThresholdsDb));
  sendAudioThresholds();
  drawAudioSpectrum();
}

function getAudioInputGainDb() {
  const gain = Number.parseFloat(audioInputGain.value);
  return Number.isFinite(gain) ? Math.max(-24, Math.min(24, gain)) : 0;
}

function sendAudioInputGain() {
  projectorChannel?.postMessage({ type: "audio-input-gain", gainDb: getAudioInputGainDb() });
}

function updateAudioInputGain({ persist = true } = {}) {
  const gainDb = getAudioInputGainDb();
  audioInputGain.value = String(gainDb);
  audioInputGainValue.value = `${gainDb > 0 ? "+" : ""}${gainDb} dB`;
  if (persist) {
    window.localStorage.setItem(AUDIO_INPUT_GAIN_KEY, String(gainDb));
  }
  sendAudioInputGain();
}

function loadAudioInputGain() {
  const stored = Number.parseFloat(window.localStorage.getItem(AUDIO_INPUT_GAIN_KEY));
  audioInputGain.value = String(Number.isFinite(stored) ? Math.max(-24, Math.min(24, stored)) : 0);
  updateAudioInputGain({ persist: false });
}

function spectrumPlotBounds() {
  const width = audioSpectrumCanvas.clientWidth;
  const height = audioSpectrumCanvas.clientHeight;
  return {
    width,
    height,
    left: 43,
    right: Math.max(44, width - 10),
    top: 19,
    bottom: Math.max(20, height - 27),
  };
}

function frequencyToSpectrumX(frequency, bounds) {
  const position = Math.log(frequency / SPECTRUM_MIN_FREQUENCY)
    / Math.log(SPECTRUM_MAX_FREQUENCY / SPECTRUM_MIN_FREQUENCY);
  return bounds.left + position * (bounds.right - bounds.left);
}

function dbToSpectrumY(db, bounds) {
  const position = (SPECTRUM_MAX_DB - db) / (SPECTRUM_MAX_DB - SPECTRUM_MIN_DB);
  return bounds.top + position * (bounds.bottom - bounds.top);
}

function drawAudioSpectrum() {
  const bounds = spectrumPlotBounds();
  if (bounds.width <= 1 || bounds.height <= 1) {
    return;
  }
  const pixelRatio = Math.min(window.devicePixelRatio || 1, 2);
  const targetWidth = Math.round(bounds.width * pixelRatio);
  const targetHeight = Math.round(bounds.height * pixelRatio);
  if (audioSpectrumCanvas.width !== targetWidth || audioSpectrumCanvas.height !== targetHeight) {
    audioSpectrumCanvas.width = targetWidth;
    audioSpectrumCanvas.height = targetHeight;
  }
  const context = audioSpectrumContext;
  context.setTransform(pixelRatio, 0, 0, pixelRatio, 0, 0);
  context.clearRect(0, 0, bounds.width, bounds.height);
  context.fillStyle = "#fffdf8";
  context.fillRect(0, 0, bounds.width, bounds.height);

  AUDIO_BAND_RANGES.forEach(([minimum, maximum], index) => {
    const startX = frequencyToSpectrumX(minimum, bounds);
    const endX = frequencyToSpectrumX(maximum, bounds);
    context.fillStyle = index % 2 === 0 ? "rgba(15, 118, 110, 0.035)" : "rgba(180, 83, 9, 0.025)";
    context.fillRect(startX, bounds.top, endX - startX, bounds.bottom - bounds.top);
    const levelY = dbToSpectrumY(audioBandDb[index], bounds);
    context.save();
    context.globalAlpha = triggeredAudioBands.includes(index) ? 0.26 : 0.1;
    context.fillStyle = AUDIO_BAND_COLORS[index];
    context.fillRect(startX, levelY, endX - startX, bounds.bottom - levelY);
    context.restore();
    context.fillStyle = AUDIO_BAND_COLORS[index];
    context.font = "600 9px Inter, system-ui, sans-serif";
    context.textAlign = "center";
    context.textBaseline = "top";
    context.fillText(AUDIO_BAND_NAMES[index], (startX + endX) / 2, 4);
  });

  const dbTicks = [-96, -72, -48, -24, 0];
  context.font = "9px Inter, system-ui, sans-serif";
  context.textBaseline = "middle";
  dbTicks.forEach((db) => {
    const y = dbToSpectrumY(db, bounds);
    context.strokeStyle = db === SPECTRUM_MIN_DB ? "#b9b0a1" : "rgba(216, 209, 196, 0.85)";
    context.lineWidth = 1;
    context.beginPath();
    context.moveTo(bounds.left, Math.round(y) + 0.5);
    context.lineTo(bounds.right, Math.round(y) + 0.5);
    context.stroke();
    context.fillStyle = "#68635a";
    context.textAlign = "right";
    context.fillText(`${db}`, bounds.left - 5, y);
  });

  const frequencyTicks = [40, 100, 200, 500, 1000, 2000, 5000, 8000];
  frequencyTicks.forEach((frequency) => {
    const x = frequencyToSpectrumX(frequency, bounds);
    context.strokeStyle = "rgba(216, 209, 196, 0.65)";
    context.beginPath();
    context.moveTo(Math.round(x) + 0.5, bounds.top);
    context.lineTo(Math.round(x) + 0.5, bounds.bottom);
    context.stroke();
    context.fillStyle = "#68635a";
    context.textAlign = frequency === SPECTRUM_MIN_FREQUENCY
      ? "left"
      : frequency === SPECTRUM_MAX_FREQUENCY ? "right" : "center";
    context.textBaseline = "top";
    const label = frequency >= 1000 ? `${frequency / 1000}k` : String(frequency);
    context.fillText(label, x, bounds.bottom + 5);
  });

  if (spectrumDb.length > 0) {
    const points = [];
    spectrumDb.forEach((db, offset) => {
      const frequency = (spectrumStartBin + offset) * spectrumBinWidth;
      if (frequency < SPECTRUM_MIN_FREQUENCY || frequency > SPECTRUM_MAX_FREQUENCY) {
        return;
      }
      const x = frequencyToSpectrumX(frequency, bounds);
      const y = dbToSpectrumY(Math.max(SPECTRUM_MIN_DB, Math.min(SPECTRUM_MAX_DB, db)), bounds);
      points.push({ x, y, frequency });
    });
    if (points.length > 0) {
      context.beginPath();
      context.moveTo(points[0].x, bounds.bottom);
      points.forEach(({ x, y }) => context.lineTo(x, y));
      context.lineTo(points[points.length - 1].x, bounds.bottom);
      context.closePath();
      const fill = context.createLinearGradient(0, bounds.top, 0, bounds.bottom);
      fill.addColorStop(0, "rgba(15, 118, 110, 0.34)");
      fill.addColorStop(1, "rgba(15, 118, 110, 0.03)");
      context.fillStyle = fill;
      context.fill();
      AUDIO_BAND_RANGES.forEach(([minimum, maximum], bandIndex) => {
        const bandPoints = points.filter(({ frequency }) => (
          frequency >= minimum && frequency <= maximum
        ));
        if (bandPoints.length < 2) {
          return;
        }
        context.beginPath();
        bandPoints.forEach(({ x, y }, pointIndex) => {
          if (pointIndex === 0) {
            context.moveTo(x, y);
          } else {
            context.lineTo(x, y);
          }
        });
        context.strokeStyle = AUDIO_BAND_COLORS[bandIndex];
        context.lineWidth = 2.4;
        context.lineJoin = "round";
        context.lineCap = "round";
        context.stroke();
      });
    }
  } else {
    context.fillStyle = "#8a8173";
    context.font = "10px Inter, system-ui, sans-serif";
    context.textAlign = "center";
    context.textBaseline = "middle";
    context.fillText(
      audioMonitor.dataset.active === "true" ? "Waiting for FFT data…" : "Start audio in the projector",
      (bounds.left + bounds.right) / 2,
      (bounds.top + bounds.bottom) / 2,
    );
  }

  AUDIO_BAND_RANGES.forEach(([minimum, maximum], index) => {
    const x = (frequencyToSpectrumX(minimum, bounds) + frequencyToSpectrumX(maximum, bounds)) / 2;
    const y = dbToSpectrumY(
      Math.max(SPECTRUM_MIN_DB, Math.min(SPECTRUM_MAX_DB, audioBandDb[index])),
      bounds,
    );
    context.save();
    context.strokeStyle = AUDIO_BAND_COLORS[index];
    context.globalAlpha = 0.38;
    context.lineWidth = 1.5;
    context.beginPath();
    context.moveTo(x, bounds.bottom);
    context.lineTo(x, y);
    context.stroke();
    context.restore();
    context.fillStyle = AUDIO_BAND_COLORS[index];
    context.beginPath();
    context.arc(x, y, 4, 0, Math.PI * 2);
    context.fill();
  });

  const thresholds = getAudioThresholds();
  AUDIO_BAND_RANGES.forEach(([minimum, maximum], index) => {
    const startX = frequencyToSpectrumX(minimum, bounds) + 2;
    const endX = frequencyToSpectrumX(maximum, bounds) - 2;
    const y = dbToSpectrumY(thresholds[index], bounds);
    context.strokeStyle = "#b45309";
    context.lineWidth = draggedThresholdBand === index ? 3 : 2;
    context.beginPath();
    context.moveTo(startX, y);
    context.lineTo(endX, y);
    context.stroke();
    context.fillStyle = "#b45309";
    context.beginPath();
    context.arc((startX + endX) / 2, y, draggedThresholdBand === index ? 4 : 3, 0, Math.PI * 2);
    context.fill();
  });

  context.save();
  context.translate(10, (bounds.top + bounds.bottom) / 2);
  context.rotate(-Math.PI / 2);
  context.fillStyle = "#68635a";
  context.font = "9px Inter, system-ui, sans-serif";
  context.textAlign = "center";
  context.textBaseline = "top";
  context.fillText("Amplitude (dBFS)", 0, 0);
  context.restore();
  context.fillStyle = "#68635a";
  context.textAlign = "right";
  context.textBaseline = "bottom";
  context.fillText("Frequency (Hz)", bounds.right, bounds.height - 1);
}

function thresholdBandAtCanvasX(x, bounds) {
  const ratio = Math.max(0, Math.min(1, (x - bounds.left) / (bounds.right - bounds.left)));
  const frequency = SPECTRUM_MIN_FREQUENCY
    * ((SPECTRUM_MAX_FREQUENCY / SPECTRUM_MIN_FREQUENCY) ** ratio);
  return AUDIO_BAND_RANGES.findIndex(([minimum, maximum], index) => (
    frequency >= minimum && (frequency < maximum || index === AUDIO_BAND_RANGES.length - 1)
  ));
}

function setThresholdFromPointer(event) {
  if (draggedThresholdBand === null) {
    return;
  }
  const rectangle = audioSpectrumCanvas.getBoundingClientRect();
  const bounds = spectrumPlotBounds();
  const y = Math.max(bounds.top, Math.min(bounds.bottom, event.clientY - rectangle.top));
  const ratio = (y - bounds.top) / (bounds.bottom - bounds.top);
  const db = Math.round(SPECTRUM_MAX_DB - ratio * (SPECTRUM_MAX_DB - SPECTRUM_MIN_DB));
  audioThresholdsDb[draggedThresholdBand] = db;
  updateAudioThresholds();
}

function selectProjectedImage(index, { notify = true } = {}) {
  if (projectionImages.length === 0) {
    return;
  }
  projectedImageIndex = ((index % projectionImages.length) + projectionImages.length)
    % projectionImages.length;
  imageSlot.querySelectorAll("img[data-projection-index]").forEach((image) => {
    const selected = Number.parseInt(image.dataset.projectionIndex, 10) === projectedImageIndex;
    image.dataset.projectionSelected = String(selected);
    image.setAttribute("aria-pressed", String(selected));
  });
  if (notify && projectorChannel) {
    projectorChannel.postMessage({ type: "select", index: projectedImageIndex });
  }
  renderPreviewMaskOverlay();
}

function renderPreviewMaskOverlay() {
  const maskSource = projectionMasks[projectedImageIndex];
  const showOverlay = !!(samOverlayToggle?.checked && maskSource && projectionImages.length === 1);
  maskPreviewImage.hidden = !showOverlay;
  if (!showOverlay) {
    maskPreviewImage.removeAttribute("src");
    return;
  }
  if (maskPreviewImage.src !== maskSource) {
    maskPreviewImage.src = maskSource;
  }
  maskPreviewImage.style.opacity = String(getProjectorEffects().samOverlayAlpha);
}

function makeProjectionThumbnail(image, index) {
  image.dataset.projectionIndex = String(index);
  image.dataset.projectionSelected = "false";
  image.setAttribute("role", "button");
  image.setAttribute("tabindex", "0");
  image.setAttribute("aria-label", `Project batch image ${index + 1}`);
}

function setProjectionBatch(encodedImages, encodedMasks) {
  const nextImages = Array.isArray(encodedImages) ? encodedImages : [];
  const nextMasks = Array.isArray(encodedMasks) ? encodedMasks : [];
  segmentationRequestId += 1;
  projectionImages = nextImages.map(imageDataUrl);
  projectionMasks = projectionImages.map((_, index) => maskDataUrl(nextMasks[index]));
  projectedImageIndex = 0;
  selectProjectedImage(0, { notify: false });
  sendProjectionBatch();
  renderPreviewMaskOverlay();
}

function clearGeneratedImages() {
  segmentationRequestId += 1;
  projectionImages = [];
  projectionMasks = [];
  projectedImageIndex = 0;
  previewImage.hidden = true;
  previewImage.removeAttribute("src");
  previewImage.removeAttribute("data-projection-index");
  previewImage.removeAttribute("data-projection-selected");
  previewImage.removeAttribute("role");
  previewImage.removeAttribute("tabindex");
  previewImage.removeAttribute("aria-label");
  previewImage.removeAttribute("aria-pressed");
  maskPreviewImage.hidden = true;
  maskPreviewImage.removeAttribute("src");
  imageSlot.querySelectorAll("img.dynamic-preview").forEach((image) => image.remove());
  imageSlot.classList.remove("has-image", "two-row-batch");
  sendProjectionBatch();
}

function openProjectorWindow() {
  projectorWindow = window.open(
    "/projector",
    "rtiavis-projector",
    "popup=yes,width=1280,height=720",
  );
  projectorWindow?.focus();
}

function updateAudioMonitor(data) {
  audioMonitor.dataset.active = "true";
  spectrumDb = Array.isArray(data.spectrumDb) ? data.spectrumDb : [];
  spectrumStartBin = Number.isFinite(data.spectrumStartBin) ? data.spectrumStartBin : 1;
  spectrumBinWidth = Number.isFinite(data.spectrumBinWidth) ? data.spectrumBinWidth : 1;
  audioBandDb = AUDIO_BAND_RANGES.map((_, index) => (
    Number.isFinite(data.bandDb?.[index]) ? data.bandDb[index] : SPECTRUM_MIN_DB
  ));
  drawAudioSpectrum();
  if (!data.eventTriggered) {
    return;
  }
  triggeredAudioBands = Array.isArray(data.triggeredBands) ? data.triggeredBands : [];
  drawAudioSpectrum();
  projectorAudioEventCount += 1;
  audioEventCount.value = String(projectorAudioEventCount);
  audioEventIndicator.dataset.triggered = "false";
  void audioEventIndicator.offsetWidth;
  audioEventIndicator.dataset.triggered = "true";
  window.clearTimeout(audioEventFlashTimer);
  audioEventFlashTimer = window.setTimeout(() => {
    audioEventIndicator.dataset.triggered = "false";
    triggeredAudioBands = [];
    drawAudioSpectrum();
  }, 110);
}

function setAudioMonitorActive(active) {
  audioMonitor.dataset.active = String(active);
  if (active) {
    projectorAudioEventCount = 0;
    audioEventCount.value = "0";
    return;
  }
  spectrumDb = [];
  audioBandDb = AUDIO_BAND_RANGES.map(() => SPECTRUM_MIN_DB);
  triggeredAudioBands = [];
  drawAudioSpectrum();
}

projectorChannel?.addEventListener("message", (event) => {
  if (event.data?.type === "ready") {
    sendProjectionBatch();
    sendAudioThresholds();
    sendAudioInputGain();
    sendProjectorEffects();
    sendAudioMatrix();
  } else if (event.data?.type === "select") {
    selectProjectedImage(Number.parseInt(event.data.index, 10), { notify: false });
  } else if (event.data?.type === "audio") {
    updateAudioMonitor(event.data);
  } else if (event.data?.type === "audio-status") {
    setAudioMonitorActive(Boolean(event.data.active));
  }
});

function parseStoredSettings() {
  try {
    return JSON.parse(window.localStorage.getItem(GENERATION_SETTINGS_KEY) || "null");
  } catch {
    return null;
  }
}

function parseStoredModelSettings() {
  try {
    const stored = JSON.parse(window.localStorage.getItem(MODEL_GENERATION_SETTINGS_KEY) || "null");
    return stored && typeof stored === "object" && !Array.isArray(stored) ? stored : null;
  } catch {
    return null;
  }
}

function modelDefaultsFor(modelId) {
  return imageModelDefaults.get(modelId) ?? {
    model_id: modelId,
    width: DEFAULT_GENERATION_SETTINGS.width,
    height: DEFAULT_GENERATION_SETTINGS.height,
    num_inference_steps: DEFAULT_GENERATION_SETTINGS.num_inference_steps,
    guidance_scale: DEFAULT_GENERATION_SETTINGS.guidance_scale,
    walk_amplitude: DEFAULT_GENERATION_SETTINGS.walk_amplitude,
    walk_amplitude_max: DEFAULT_GENERATION_SETTINGS.walk_amplitude_max,
  };
}

function normalizeModelControlSettings(settings, fallback = DEFAULT_GENERATION_SETTINGS) {
  const width = Number.parseInt(settings?.width ?? fallback.width, 10);
  const height = Number.parseInt(settings?.height ?? fallback.height, 10);
  const steps = Number.parseInt(settings?.num_inference_steps ?? fallback.num_inference_steps, 10);
  const guidance = Number.parseFloat(settings?.guidance_scale ?? fallback.guidance_scale);
  const walkAmplitudeMax = normalizeWalkAmplitudeMax(
    settings?.walk_amplitude_max ?? fallback.walk_amplitude_max,
  );
  const walkAmplitude = Number.parseFloat(settings?.walk_amplitude ?? fallback.walk_amplitude);

  return {
    width: Number.isFinite(width) ? width : fallback.width,
    height: Number.isFinite(height) ? height : fallback.height,
    num_inference_steps: Number.isFinite(steps)
      ? Math.min(MAX_STEPS, Math.max(1, steps))
      : fallback.num_inference_steps,
    guidance_scale: Number.isFinite(guidance)
      ? Math.min(MAX_GUIDANCE, Math.max(0, guidance))
      : fallback.guidance_scale,
    walk_amplitude: Number.isFinite(walkAmplitude)
      ? Math.min(walkAmplitudeMax, Math.max(0, walkAmplitude))
      : Math.min(walkAmplitudeMax, DEFAULT_WALK_AMPLITUDE),
    walk_amplitude_max: walkAmplitudeMax,
  };
}

function loadModelGenerationSettings() {
  const stored = parseStoredModelSettings();
  const nextSettings = new Map();
  if (stored) {
    for (const [modelId, settings] of Object.entries(stored)) {
      if (imageModelDefaults.has(modelId)) {
        nextSettings.set(modelId, normalizeModelControlSettings(settings, modelDefaultsFor(modelId)));
      }
    }
  }
  modelGenerationSettings = nextSettings;
}

function saveModelGenerationSettings() {
  const settingsByModel = {};
  for (const [modelId, settings] of modelGenerationSettings) {
    if (imageModelDefaults.has(modelId)) {
      settingsByModel[modelId] = normalizeModelControlSettings(settings, modelDefaultsFor(modelId));
    }
  }
  window.localStorage.setItem(MODEL_GENERATION_SETTINGS_KEY, JSON.stringify(settingsByModel));
}

function normalizeSettings(settings, fallback = DEFAULT_GENERATION_SETTINGS) {
  const modelId = settings?.model_id ?? fallback.model_id ?? DEFAULT_GENERATION_SETTINGS.model_id;
  const width = Number.parseInt(settings?.width ?? fallback.width, 10);
  const height = Number.parseInt(settings?.height ?? fallback.height, 10);
  const steps = Number.parseInt(settings?.num_inference_steps ?? fallback.num_inference_steps, 10);
  const guidance = Number.parseFloat(settings?.guidance_scale ?? fallback.guidance_scale);
  const sequenceInterval = Number.parseFloat(
    settings?.sequence_interval_seconds
      ?? fallback.sequence_interval_seconds
      ?? DEFAULT_SEQUENCE_INTERVAL_SECONDS,
  );
  const promptSequenceDuration = Number.parseFloat(
    settings?.prompt_sequence_duration_seconds
      ?? fallback.prompt_sequence_duration_seconds
      ?? DEFAULT_PROMPT_SEQUENCE_DURATION_SECONDS,
  );
  const walkAmplitude = Number.parseFloat(
    settings?.walk_amplitude
      ?? fallback.walk_amplitude
      ?? DEFAULT_WALK_AMPLITUDE,
  );
  const walkAmplitudeMax = normalizeWalkAmplitudeMax(
    settings?.walk_amplitude_max
      ?? fallback.walk_amplitude_max
      ?? DEFAULT_WALK_AMPLITUDE_MAX,
  );
  const promptBlendWeight = Number.parseFloat(
    settings?.additional_prompt_weight
      ?? fallback.additional_prompt_weight
      ?? DEFAULT_PROMPT_BLEND_WEIGHT,
  );
  const sequenceMode = SEQUENCE_MODES.has(settings?.sequence_mode)
    ? settings.sequence_mode
    : DEFAULT_SEQUENCE_MODE;
  const seed =
    settings?.seed === null || settings?.seed === undefined || settings?.seed === ""
      ? null
      : Number.parseInt(settings.seed, 10);
  const translate =
    typeof settings?.translate === "boolean" ? settings.translate : Boolean(fallback.translate);
  const sam =
    typeof settings?.sam === "boolean" ? settings.sam : Boolean(fallback.sam);
  const samPrompt =
    typeof settings?.sam_prompt === "string" ? settings.sam_prompt : (fallback.sam_prompt ?? SAM_SEGMENT_PROMPT);
  const batchSize = Number.parseInt(settings?.batch_size ?? fallback.batch_size ?? 1, 10);
  const batchWalk = typeof settings?.batch_walk === "boolean" ? settings.batch_walk : Boolean(fallback.batch_walk);
  const promptBlendEnabled =
    typeof settings?.prompt_blend_enabled === "boolean"
      ? settings.prompt_blend_enabled
      : Boolean(fallback.prompt_blend_enabled);

  return {
    model_id: imageModelDefaults.has(modelId)
      ? modelId
      : fallback.model_id ?? DEFAULT_GENERATION_SETTINGS.model_id,
    width: Number.isFinite(width) ? width : fallback.width,
    height: Number.isFinite(height) ? height : fallback.height,
    num_inference_steps: Number.isFinite(steps)
      ? Math.min(MAX_STEPS, Math.max(1, steps))
      : fallback.num_inference_steps,
    guidance_scale: Number.isFinite(guidance)
      ? Math.min(MAX_GUIDANCE, Math.max(0, guidance))
      : fallback.guidance_scale,
    seed: Number.isFinite(seed) ? Math.min(4294967295, Math.max(0, seed)) : null,
    batch_size: Number.isFinite(batchSize) ? Math.max(1, Math.min(8, batchSize)) : 1,
    batch_walk: batchWalk,
    translate,
    sam,
    sam_prompt: samPrompt,
    prompt:
      typeof settings?.prompt === "string"
        ? settings.prompt
        : fallback.prompt ?? "",
    sequence_interval_seconds: Number.isFinite(sequenceInterval)
      ? Math.min(10, Math.max(0, sequenceInterval))
      : DEFAULT_SEQUENCE_INTERVAL_SECONDS,
    prompt_sequence_duration_seconds: Number.isFinite(promptSequenceDuration)
      ? Math.min(120, Math.max(1, promptSequenceDuration))
      : DEFAULT_PROMPT_SEQUENCE_DURATION_SECONDS,
    walk_amplitude: Number.isFinite(walkAmplitude)
      ? Math.min(walkAmplitudeMax, Math.max(0, walkAmplitude))
      : Math.min(walkAmplitudeMax, DEFAULT_WALK_AMPLITUDE),
    walk_amplitude_max: walkAmplitudeMax,
    sequence_mode: sequenceMode,
    prompt_blend_enabled: promptBlendEnabled,
    additional_prompt:
      typeof settings?.additional_prompt === "string"
        ? settings.additional_prompt
        : fallback.additional_prompt ?? "",
    additional_prompt_weight: Number.isFinite(promptBlendWeight)
      ? Math.min(MAX_PROMPT_BLEND_WEIGHT, Math.max(0, promptBlendWeight))
      : DEFAULT_PROMPT_BLEND_WEIGHT,
  };
}

function settingsFromConfig(config) {
  const defaultModelId = config?.image?.default_model_id ?? DEFAULT_GENERATION_SETTINGS.model_id;
  const defaultModel = config?.image?.available_models?.find((model) => model.id === defaultModelId);
  return normalizeSettings({
    model_id: defaultModelId,
    width: defaultModel?.width ?? config?.image?.width,
    height: defaultModel?.height ?? config?.image?.height,
    num_inference_steps: defaultModel?.num_inference_steps ?? config?.image?.num_inference_steps,
    guidance_scale: defaultModel?.guidance_scale ?? config?.image?.guidance_scale,
    seed: null,
    translate: Boolean(config?.translation?.enabled),
  });
}

function applyAvailableModels(models = []) {
  const nextDefaults = new Map();
  modelSelect.replaceChildren();

  const modelList = models.length
    ? models
    : [{ id: DEFAULT_GENERATION_SETTINGS.model_id, label: "SD Turbo", ...DEFAULT_GENERATION_SETTINGS }];
  for (const model of modelList) {
    const option = document.createElement("option");
    option.value = model.id;
    option.textContent = model.label || model.id;
    modelSelect.append(option);
    nextDefaults.set(model.id, {
      model_id: model.id,
      width: model.width,
      height: model.height,
      num_inference_steps: model.num_inference_steps,
      guidance_scale: model.guidance_scale,
      walk_amplitude: model.walk_amplitude ?? DEFAULT_WALK_AMPLITUDE,
      walk_amplitude_max: model.walk_amplitude_max ?? DEFAULT_WALK_AMPLITUDE_MAX,
    });
  }

  imageModelDefaults = nextDefaults;
}

function ensureSizeOption(width, height) {
  const value = `${width}x${height}`;
  if (!Array.from(sizeSelect.options).some((option) => option.value === value)) {
    const option = document.createElement("option");
    option.value = value;
    option.textContent = `${width} x ${height}`;
    sizeSelect.append(option);
  }
}

function applyGenerationSettings(settings) {
  modelSelect.value = settings.model_id;
  activeModelId = settings.model_id;
  ensureSizeOption(settings.width, settings.height);
  sizeSelect.value = `${settings.width}x${settings.height}`;
  stepsInput.value = String(settings.num_inference_steps);
  guidanceInput.value = String(settings.guidance_scale);
  seedInput.value = settings.seed === null ? "" : String(settings.seed);
  batchInput.value = String(settings.batch_size);
  batchWalkToggle.checked = settings.batch_walk;
  if (samToggle) {
    samToggle.checked = !!settings.sam;
  }
  if (samPromptInput) {
    samPromptInput.value = settings.sam_prompt !== undefined ? settings.sam_prompt : SAM_SEGMENT_PROMPT;
  }
  translateToggle.checked = settings.translate;
  promptInput.value = settings.prompt;
  sequenceIntervalInput.value = String(settings.sequence_interval_seconds);
  promptSequenceDurationInput.value = String(settings.prompt_sequence_duration_seconds);
  applyWalkAmplitudeMax(settings.walk_amplitude_max);
  walkAmplitudeInput.value = String(settings.walk_amplitude);
  additionalPromptInput.value = settings.additional_prompt;
  promptBlendWeightInput.value = String(settings.additional_prompt_weight);
  setPromptBlendEnabled(settings.prompt_blend_enabled);
  setSequenceMode(settings.sequence_mode);
  updateSettingLabels();
  growTextarea();
  growAdditionalPromptTextarea();
}

function getModelControlSettings(modelId = modelSelect.value) {
  const [width, height] = sizeSelect.value.split("x").map((value) => Number.parseInt(value, 10));
  return normalizeModelControlSettings(
    {
      width,
      height,
      num_inference_steps: Number.parseInt(stepsInput.value, 10),
      guidance_scale: Number.parseFloat(guidanceInput.value),
      walk_amplitude: getWalkAmplitude(),
      walk_amplitude_max: getWalkAmplitudeMax(),
    },
    modelDefaultsFor(modelId),
  );
}

function rememberModelControlSettings(modelId = modelSelect.value) {
  if (!imageModelDefaults.has(modelId)) {
    return;
  }
  modelGenerationSettings.set(modelId, getModelControlSettings(modelId));
}

function applyModelControlSettings(modelId, settings) {
  const normalized = normalizeModelControlSettings(settings, modelDefaultsFor(modelId));
  ensureSizeOption(normalized.width, normalized.height);
  sizeSelect.value = `${normalized.width}x${normalized.height}`;
  stepsInput.value = String(normalized.num_inference_steps);
  guidanceInput.value = String(normalized.guidance_scale);
  applyWalkAmplitudeMax(normalized.walk_amplitude_max);
  walkAmplitudeInput.value = String(normalized.walk_amplitude);
}

function saveGenerationSettings() {
  rememberModelControlSettings();
  saveModelGenerationSettings();
  window.localStorage.setItem(
    GENERATION_SETTINGS_KEY,
    JSON.stringify({
      ...getGenerationSettings(),
      prompt: promptInput.value,
      sequence_interval_seconds: getSequenceIntervalSeconds(),
      prompt_sequence_duration_seconds: getPromptSequenceDurationSeconds(),
      walk_amplitude: getWalkAmplitude(),
      walk_amplitude_max: getWalkAmplitudeMax(),
      sequence_mode: getSequenceMode(),
      prompt_blend_enabled: isPromptBlendEnabled(),
      additional_prompt: additionalPromptInput.value,
      additional_prompt_weight: getPromptBlendWeight(),
      sam_prompt: samPromptInput ? samPromptInput.value : SAM_SEGMENT_PROMPT,
    }),
  );
}

function getGenerationSettings() {
  const modelControls = getModelControlSettings();
  const seedValue = seedInput.value.trim();
  const seed = Number.parseInt(seedValue, 10);
  const additionalPrompt = additionalPromptInput.value.trim();
  const promptBlendEnabled = isPromptBlendEnabled();
  return {
    model_id: modelSelect.value,
    width: modelControls.width,
    height: modelControls.height,
    num_inference_steps: modelControls.num_inference_steps,
    guidance_scale: modelControls.guidance_scale,
    seed: seedValue === "" || !Number.isFinite(seed) ? null : seed,
    batch_size: Number.parseInt(batchInput.value, 10) || 1,
    batch_walk: batchWalkToggle.checked,
    ...(batchWalkToggle.checked ? { prompt_walk_scale: getWalkAmplitude() } : {}),
    sam: samToggle ? samToggle.checked : false,
    sam_prompt: samPromptInput ? samPromptInput.value : SAM_SEGMENT_PROMPT,
    translate: translateToggle.checked,
    prompt_blend_enabled: promptBlendEnabled,
    additional_prompt: promptBlendEnabled && additionalPrompt ? additionalPrompt : null,
    additional_prompt_weight: getPromptBlendWeight(),
  };
}

function applySelectedModelSettings() {
  const modelId = modelSelect.value;
  const settings = modelGenerationSettings.get(modelId) ?? imageModelDefaults.get(modelId);
  if (!settings) {
    return;
  }
  applyModelControlSettings(modelId, settings);
  activeModelId = modelId;
}

function getSequenceIntervalSeconds() {
  const value = Number.parseFloat(sequenceIntervalInput.value);
  return Number.isFinite(value) ? Math.min(10, Math.max(0, value)) : DEFAULT_SEQUENCE_INTERVAL_SECONDS;
}

function getPromptSequenceDurationSeconds() {
  const value = Number.parseFloat(promptSequenceDurationInput.value);
  return Number.isFinite(value)
    ? Math.min(120, Math.max(1, value))
    : DEFAULT_PROMPT_SEQUENCE_DURATION_SECONDS;
}

function getWalkAmplitude() {
  const value = Number.parseFloat(walkAmplitudeInput.value);
  return Number.isFinite(value)
    ? Math.min(getWalkAmplitudeMax(), Math.max(0, value))
    : Math.min(getWalkAmplitudeMax(), DEFAULT_WALK_AMPLITUDE);
}

function normalizeWalkAmplitudeMax(value) {
  const parsed = Number.parseFloat(value);
  return Number.isFinite(parsed)
    ? Math.max(DEFAULT_WALK_AMPLITUDE_MAX, parsed)
    : DEFAULT_WALK_AMPLITUDE_MAX;
}

function getWalkAmplitudeMax() {
  return normalizeWalkAmplitudeMax(walkAmplitudeMaxInput.value);
}

function applyWalkAmplitudeMax(value) {
  const maximum = normalizeWalkAmplitudeMax(value);
  walkAmplitudeMaxInput.value = String(maximum);
  walkAmplitudeInput.max = String(maximum);
  walkAmplitudeInput.step = String(maximum / 100);
  if (Number.parseFloat(walkAmplitudeInput.value) > maximum) {
    walkAmplitudeInput.value = String(maximum);
  }
}

function getPromptBlendWeight() {
  const value = Number.parseFloat(promptBlendWeightInput.value);
  return Number.isFinite(value)
    ? Math.min(MAX_PROMPT_BLEND_WEIGHT, Math.max(0, value))
    : DEFAULT_PROMPT_BLEND_WEIGHT;
}

function isPromptBlendEnabled() {
  return promptBlendButton.getAttribute("aria-pressed") === "true";
}

function setPromptBlendEnabled(enabled) {
  promptBlendButton.setAttribute("aria-pressed", String(enabled));
  additionalPromptPanel.hidden = !enabled;
  promptStack.classList.toggle("blend-active", enabled);
  promptBlendWeightGroup.hidden = !enabled;
  if (enabled) {
    growAdditionalPromptTextarea();
  }
}

function getSequenceMode() {
  const mode = sequenceModeButtons.find((button) => button.getAttribute("aria-pressed") === "true")
    ?.dataset.sequenceMode;
  return SEQUENCE_MODES.has(mode) ? mode : DEFAULT_SEQUENCE_MODE;
}

function getRequestKey(prompt, settings) {
  return JSON.stringify({ prompt, settings });
}

function canSubmitPrompt(value, settings) {
  const trimmed = value.trim();
  return trimmed.length > 0 && WORD_BOUNDARY.test(value) && getRequestKey(trimmed, settings) !== lastSubmittedKey;
}

function scheduleGeneration({ force = false } = {}) {
  growTextarea();
  growAdditionalPromptTextarea();

  if (sequenceActive) {
    return;
  }

  const settings = getGenerationSettings();
  if (!force && !canSubmitPrompt(promptInput.value, settings)) {
    return;
  }
  if (force && promptInput.value.trim().length === 0) {
    return;
  }

  window.clearTimeout(debounceTimer);
  debounceTimer = window.setTimeout(() => {
    void generateImage();
  }, DEBOUNCE_MS);
}

function renderFromPromptShortcut(event) {
  if (!(event.ctrlKey && event.key === "Enter")) {
    return;
  }
  event.preventDefault();
  if (sequenceActive) {
    return;
  }
  clearSequenceIndicator();
  growTextarea();
  growAdditionalPromptTextarea();
  saveGenerationSettings();
  window.clearTimeout(debounceTimer);
  void generateImage({ trackDuplicate: false });
}

async function generateImage({
  promptOverride = null,
  settingsOverride = null,
  statusLabel = "Rendering",
  trackDuplicate = true,
} = {}) {
  const prompt = (promptOverride ?? promptInput.value).trim();
  const settings = settingsOverride ?? getGenerationSettings();
  const requestKey = getRequestKey(prompt, settings);
  if (!prompt || (trackDuplicate && requestKey === lastSubmittedKey)) {
    return { ok: false, skipped: true };
  }

  if (trackDuplicate) {
    lastSubmittedKey = requestKey;
  }
  const requestId = ++latestRequestId;
  setStatus(statusLabel, "busy");
  const effects = getProjectorEffects();
  const shouldSegmentEffectsFallback = !settings.sam && (effects.samOverlay || effects.maskedSmudge);

  try {
    const response = await fetch("/api/generate", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ prompt, ...settings }),
    });

    const payload = await response.json();
    if (!response.ok) {
      throw new Error(payload.detail || "Generation failed.");
    }

    if (requestId !== latestRequestId || payload.stale) {
      return { ok: false, stale: true };
    }

    let masks_png_base64 = Array.isArray(payload.masks_png_base64)
      ? payload.masks_png_base64
      : null;
    if (shouldSegmentEffectsFallback && !masks_png_base64) {
      const images_png_base64 = payload.images_png_base64 || (payload.image_png_base64 ? [payload.image_png_base64] : []);
      if (images_png_base64.length > 0) {
        try {
          masks_png_base64 = await segmentImagesBase64(
            images_png_base64,
          );
        } catch (error) {
          console.error("SAM error:", error);
        }
        if (requestId !== latestRequestId || payload.stale) {
          return { ok: false, stale: true };
        }
      }
    }

    console.log(
      [
        payload.translated_prompt || payload.prompt || "",
        payload.translated_additional_prompt || "",
        payload.translation_error || "",
      ]
        .filter(Boolean)
        .join("\n"),
    );
    if (payload.images_png_base64 && payload.images_png_base64.length > 0) {
      imageSlot.classList.toggle("two-row-batch", payload.images_png_base64.length > 4);
      // Clear dynamically added images (keep previewImage and emptyPreview)
      const existing = imageSlot.querySelectorAll("img.dynamic-preview");
      for (const img of existing) {
        img.remove();
      }

      if (payload.images_png_base64.length === 1) {
        previewImage.src = `data:image/png;base64,${payload.images_png_base64[0]}`;
        previewImage.hidden = false;
        makeProjectionThumbnail(previewImage, 0);
      } else {
        previewImage.hidden = true;
        for (const [index, base64] of payload.images_png_base64.entries()) {
          const img = document.createElement("img");
          img.className = "preview-image dynamic-preview";
          img.src = `data:image/png;base64,${base64}`;
          img.alt = "Generated image preview";
          makeProjectionThumbnail(img, index);
          imageSlot.append(img);
        }
      }

      setProjectionBatch(payload.images_png_base64, masks_png_base64);
      selectProjectedImage(0, { notify: false });
      imageSlot.classList.add("has-image");
      setStatus(
        settings.sam ? `${payload.elapsed_ms} ms - ${hasProjectionMasks() ? "SAM mask ready" : "No SAM mask"}` : `${payload.elapsed_ms} ms`,
        hasProjectionMasks() || !settings.sam ? "ready" : "error",
      );
    } else if (payload.image_png_base64) {
      imageSlot.classList.remove("two-row-batch");
      previewImage.src = `data:image/png;base64,${payload.image_png_base64}`;
      previewImage.hidden = false;
      makeProjectionThumbnail(previewImage, 0);
      setProjectionBatch([payload.image_png_base64], masks_png_base64);
      selectProjectedImage(0, { notify: false });
      imageSlot.classList.add("has-image");
      setStatus(
        settings.sam ? `${payload.elapsed_ms} ms - ${hasProjectionMasks() ? "SAM mask ready" : "No SAM mask"}` : `${payload.elapsed_ms} ms`,
        hasProjectionMasks() || !settings.sam ? "ready" : "error",
      );
    }
    return { ok: true, payload };
  } catch (error) {
    if (requestId === latestRequestId) {
      setStatus(error.message || "Error", "error");
    }
    return { ok: false, error };
  }
}

function promptWords() {
  return promptInput.value.trim().split(/\s+/).filter(Boolean);
}

function parsePromptSequence(value = promptInput.value) {
  let prompts;
  try {
    prompts = JSON.parse(value);
  } catch {
    throw new Error('Prompt Sequencer expects JSON like ["prompt 1", "prompt 2"]');
  }
  if (!Array.isArray(prompts) || prompts.length < 2) {
    throw new Error("Prompt Sequencer needs at least two prompts");
  }
  const normalized = prompts.map((prompt) => typeof prompt === "string" ? prompt.trim() : "");
  if (normalized.some((prompt) => prompt.length === 0)) {
    throw new Error("Every Prompt Sequencer item must be non-empty text");
  }
  return normalized;
}

function samePromptSequence(left, right) {
  return left.length === right.length
    && left.every((prompt, index) => prompt === right[index]);
}

function renderSequenceWarning(message) {
  sequenceIndicator.replaceChildren();
  sequenceIndicator.dataset.state = "warning";

  const warningLabel = document.createElement("strong");
  warningLabel.textContent = "Warning";
  sequenceIndicator.append(warningLabel);

  const detail = document.createElement("span");
  detail.textContent = ` ${message}`;
  sequenceIndicator.append(detail);
  sequenceIndicator.hidden = false;
}

function refreshPromptSequenceValidation() {
  if (getSequenceMode() !== "prompts") {
    return true;
  }
  try {
    parsePromptSequence();
    if (!sequenceActive || sequenceIndicator.dataset.state === "warning") {
      clearSequenceIndicator();
    }
    return true;
  } catch (error) {
    renderSequenceWarning(error.message);
    return false;
  }
}

function notifySequenceTextChanged() {
  sequenceTextRevision += 1;
  if (sequenceActive) {
    latestRequestId += 1;
  }
  window.dispatchEvent(new Event("rtiavis:sequence-text-change"));
  if (getSequenceMode() === "prompts") {
    refreshPromptSequenceValidation();
  } else if (!sequenceActive) {
    clearSequenceIndicator();
  }
}

function prepareSequenceIndicator() {
  delete sequenceIndicator.dataset.state;
  sequenceIndicator.replaceChildren();
}

function renderSequenceIndicator(words, activeCount) {
  prepareSequenceIndicator();

  const usedText = words.slice(0, activeCount).join(" ");
  const remainingText = words.slice(activeCount).join(" ");
  const used = document.createElement("strong");
  used.textContent = usedText;
  sequenceIndicator.append(used);

  if (remainingText) {
    const remaining = document.createElement("span");
    remaining.textContent = ` ${remainingText}`;
    sequenceIndicator.append(remaining);
  }

  sequenceIndicator.hidden = false;
}

function renderSeedIndicator(prompt, seed) {
  prepareSequenceIndicator();

  const seedLabel = document.createElement("strong");
  seedLabel.textContent = `Seed ${seed}`;
  sequenceIndicator.append(seedLabel);

  const promptLabel = document.createElement("span");
  promptLabel.textContent = ` ${prompt}`;
  sequenceIndicator.append(promptLabel);
  sequenceIndicator.hidden = false;
}

function renderWalkIndicator(prompt, step) {
  prepareSequenceIndicator();

  const stepLabel = document.createElement("strong");
  stepLabel.textContent = `Walk ${step}`;
  sequenceIndicator.append(stepLabel);

  const promptLabel = document.createElement("span");
  promptLabel.textContent = ` ${prompt}`;
  sequenceIndicator.append(promptLabel);
  sequenceIndicator.hidden = false;
}

function renderPromptSequenceIndicator(fromPrompt, toPrompt, progress, fromIndex, toIndex) {
  prepareSequenceIndicator();

  const transitionLabel = document.createElement("strong");
  transitionLabel.textContent = `Prompt ${fromIndex + 1} → ${toIndex + 1}`;
  sequenceIndicator.append(transitionLabel);

  const weights = document.createElement("span");
  weights.textContent = ` ${(1 - progress).toFixed(2)} “${fromPrompt}” · ${progress.toFixed(2)} “${toPrompt}”`;
  sequenceIndicator.append(weights);
  sequenceIndicator.hidden = false;
}

function clearSequenceIndicator() {
  delete sequenceIndicator.dataset.state;
  sequenceIndicator.replaceChildren();
  sequenceIndicator.hidden = true;
}

function waitForSequenceInterval(seconds, runId) {
  if (seconds <= 0) {
    return Promise.resolve(sequenceActive && runId === sequenceRunId);
  }
  const delayMs = seconds * 1000;
  return new Promise((resolve) => {
    let timeoutId = null;
    const finish = () => {
      window.clearTimeout(timeoutId);
      window.removeEventListener("rtiavis:sequence-text-change", finish);
      resolve(sequenceActive && runId === sequenceRunId);
    };
    window.addEventListener("rtiavis:sequence-text-change", finish);
    timeoutId = window.setTimeout(finish, delayMs);
  });
}

function cancelSequence(status = "Sequence stopped") {
  if (!sequenceActive) {
    return;
  }
  sequenceRunId += 1;
  latestRequestId += 1;
  setSequenceState(false);
  setStatus(status, "idle");
}

function prepareSequenceRun() {
  window.clearTimeout(debounceTimer);
  debounceTimer = null;
  latestRequestId += 1;
  return ++sequenceRunId;
}

async function runWordSequence() {
  if (sequenceActive) {
    cancelSequence();
    return;
  }

  if (promptWords().length === 0) {
    promptInput.focus();
    return;
  }

  const runId = prepareSequenceRun();
  setSequenceState(true);
  let index = 1;
  let appliedRevision = sequenceTextRevision;

  while (sequenceActive && runId === sequenceRunId) {
    if (!sequenceActive || runId !== sequenceRunId) {
      return;
    }

    if (appliedRevision !== sequenceTextRevision) {
      appliedRevision = sequenceTextRevision;
      index = 1;
    }
    const words = promptWords();
    if (words.length === 0) {
      setStatus("Waiting for prompt", "busy");
      const shouldContinue = await waitForSequenceInterval(
        Math.max(0.2, getSequenceIntervalSeconds()),
        runId,
      );
      if (!shouldContinue) {
        return;
      }
      continue;
    }

    const activeCount = Math.min(index, words.length);
    const frameRevision = sequenceTextRevision;
    renderSequenceIndicator(words, activeCount);
    const result = await generateImage({
      promptOverride: words.slice(0, activeCount).join(" "),
      settingsOverride: getGenerationSettings(),
      statusLabel: `Sequence ${activeCount}/${words.length}`,
      trackDuplicate: false,
    });

    if (runId !== sequenceRunId) {
      return;
    }
    if (!result.ok && result.error) {
      setSequenceState(false);
      return;
    }
    if (frameRevision !== sequenceTextRevision) {
      continue;
    }
    if (activeCount < words.length) {
      const intervalSeconds = getSequenceIntervalSeconds();
      setStatus(`Next in ${intervalSeconds.toFixed(1)}s`, "busy");
      const shouldContinue = await waitForSequenceInterval(intervalSeconds, runId);
      if (!shouldContinue) {
        return;
      }
      index += 1;
    } else {
      break;
    }
  }

  if (runId === sequenceRunId) {
    setSequenceState(false);
    setStatus("Sequence complete", "ready");
  }
}

function nextSeed(seed) {
  return seed >= MAX_SEED ? 0 : seed + 1;
}

function createWalkSeed() {
  if (window.crypto?.getRandomValues) {
    const values = new Uint32Array(1);
    window.crypto.getRandomValues(values);
    return values[0];
  }
  return Math.floor(Math.random() * (MAX_SEED + 1));
}

async function runSeedSequence() {
  if (sequenceActive) {
    cancelSequence();
    return;
  }

  if (!promptInput.value.trim()) {
    promptInput.focus();
    return;
  }

  const runId = prepareSequenceRun();
  let seed = getGenerationSettings().seed ?? 0;
  setSequenceState(true);

  while (sequenceActive && runId === sequenceRunId) {
    const prompt = promptInput.value.trim();
    if (!prompt) {
      setStatus("Waiting for prompt", "busy");
      const shouldContinue = await waitForSequenceInterval(getSequenceIntervalSeconds(), runId);
      if (!shouldContinue) {
        return;
      }
      continue;
    }

    const frameRevision = sequenceTextRevision;
    renderSeedIndicator(prompt, seed);
    seedInput.value = String(seed);
    saveGenerationSettings();

    const settings = getGenerationSettings();
    const result = await generateImage({
      promptOverride: prompt,
      settingsOverride: { ...settings, seed },
      statusLabel: `Seed ${seed}`,
      trackDuplicate: false,
    });

    if (runId !== sequenceRunId) {
      return;
    }
    if (!result.ok && result.error) {
      setSequenceState(false);
      return;
    }
    if (frameRevision !== sequenceTextRevision) {
      continue;
    }

    seed = nextSeed(seed);
    const intervalSeconds = getSequenceIntervalSeconds();
    setStatus(`Next seed in ${intervalSeconds.toFixed(1)}s`, "busy");
    const shouldContinue = await waitForSequenceInterval(intervalSeconds, runId);
    if (!shouldContinue) {
      return;
    }
  }
}

async function runWalkSequence() {
  if (sequenceActive) {
    cancelSequence();
    return;
  }

  if (!promptInput.value.trim()) {
    promptInput.focus();
    return;
  }
  if (modelSelect.value === "lumina-image-2") {
    setStatus("Walk uses SD/Z-Image", "error");
    return;
  }

  const runId = prepareSequenceRun();
  const walkSeed = createWalkSeed();
  let step = 0;
  setSequenceState(true);

  while (sequenceActive && runId === sequenceRunId) {
    const prompt = promptInput.value.trim();
    if (!prompt) {
      setStatus("Waiting for prompt", "busy");
      const shouldContinue = await waitForSequenceInterval(getSequenceIntervalSeconds(), runId);
      if (!shouldContinue) {
        return;
      }
      continue;
    }

    const frameRevision = sequenceTextRevision;
    renderWalkIndicator(prompt, step);

    const currentSettings = getGenerationSettings();
    const settings = {
      ...currentSettings,
      seed: currentSettings.seed ?? 0,
      prompt_walk_step: step,
      prompt_walk_seed: walkSeed,
      prompt_walk_scale: getWalkAmplitude(),
      prompt_walk_momentum: WALK_MOMENTUM,
      prompt_walk_turn_scale: WALK_TURN_SCALE,
    };
    const result = await generateImage({
      promptOverride: prompt,
      settingsOverride: settings,
      statusLabel: `Walk ${step}`,
      trackDuplicate: false,
    });

    if (runId !== sequenceRunId) {
      return;
    }
    if (!result.ok && result.error) {
      setSequenceState(false);
      return;
    }
    if (frameRevision !== sequenceTextRevision) {
      continue;
    }

    step += 1;
    const intervalSeconds = getSequenceIntervalSeconds();
    setStatus(`Next walk in ${intervalSeconds.toFixed(1)}s`, "busy");
    const shouldContinue = await waitForSequenceInterval(intervalSeconds, runId);
    if (!shouldContinue) {
      return;
    }
  }
}

async function runPromptSequence() {
  if (sequenceActive) {
    cancelSequence();
    return;
  }
  if (modelSelect.value === "lumina-image-2") {
    setStatus("Prompt Sequencer uses SD/Z-Image", "error");
    return;
  }

  let prompts;
  try {
    prompts = parsePromptSequence();
  } catch (error) {
    renderSequenceWarning(error.message);
    setStatus(error.message, "error");
    promptInput.focus();
    return;
  }

  const runId = prepareSequenceRun();
  let fromIndex = 0;
  let seed = getGenerationSettings().seed ?? 0;
  let transitionStartedAt = window.performance.now();
  let firstFrame = true;
  setSequenceState(true);

  while (sequenceActive && runId === sequenceRunId) {
    let nextPrompts;
    try {
      nextPrompts = parsePromptSequence();
    } catch (error) {
      renderSequenceWarning(error.message);
      setStatus("Waiting for valid Prompt JSON", "busy");
      const shouldContinue = await waitForSequenceInterval(
        Math.max(0.2, getSequenceIntervalSeconds()),
        runId,
      );
      if (!shouldContinue) {
        return;
      }
      continue;
    }

    if (!samePromptSequence(prompts, nextPrompts)) {
      const currentPrompt = prompts[fromIndex];
      const matchingIndex = nextPrompts.indexOf(currentPrompt);
      fromIndex = matchingIndex >= 0
        ? matchingIndex
        : Math.min(fromIndex, nextPrompts.length - 1);
      prompts = nextPrompts;
      transitionStartedAt = window.performance.now();
      firstFrame = true;
    }

    const toIndex = (fromIndex + 1) % prompts.length;
    const durationMs = getPromptSequenceDurationSeconds() * 1000;
    const progress = firstFrame
      ? 0
      : Math.min(1, (window.performance.now() - transitionStartedAt) / durationMs);
    firstFrame = false;

    const fromPrompt = prompts[fromIndex];
    const toPrompt = prompts[toIndex];
    const frameRevision = sequenceTextRevision;
    renderPromptSequenceIndicator(fromPrompt, toPrompt, progress, fromIndex, toIndex);

    const settings = {
      ...getGenerationSettings(),
      seed,
      additional_prompt: toPrompt,
      additional_prompt_weight: progress,
    };
    const result = await generateImage({
      promptOverride: fromPrompt,
      settingsOverride: settings,
      statusLabel: `Prompt ${fromIndex + 1} → ${toIndex + 1} ${Math.round(progress * 100)}%`,
      trackDuplicate: false,
    });

    if (runId !== sequenceRunId) {
      return;
    }
    if (!result.ok && result.error) {
      setSequenceState(false);
      return;
    }
    if (frameRevision !== sequenceTextRevision) {
      continue;
    }

    if (progress >= 1) {
      fromIndex = toIndex;
      transitionStartedAt = window.performance.now();
      if (toIndex === 0) {
        seed = nextSeed(seed);
        seedInput.value = String(seed);
        saveGenerationSettings();
      }
    }

    const intervalSeconds = getSequenceIntervalSeconds();
    setStatus(`Next blend in ${intervalSeconds.toFixed(1)}s`, "busy");
    const shouldContinue = await waitForSequenceInterval(intervalSeconds, runId);
    if (!shouldContinue) {
      return;
    }
  }
}

async function runSequence() {
  const mode = getSequenceMode();
  if (mode === "seed") {
    await runSeedSequence();
  } else if (mode === "walk") {
    await runWalkSequence();
  } else if (mode === "prompts") {
    await runPromptSequence();
  } else {
    await runWordSequence();
  }
}

function updateSettingLabels() {
  stepsValue.textContent = stepsInput.value;
  guidanceValue.textContent = Number.parseFloat(guidanceInput.value).toFixed(1);
  batchValue.textContent = batchInput.value;
  sequenceIntervalValue.textContent = `${getSequenceIntervalSeconds().toFixed(1)}s`;
  promptSequenceDurationValue.textContent = `${getPromptSequenceDurationSeconds().toFixed(0)}s`;
  walkAmplitudeValue.textContent = getWalkAmplitude().toFixed(3);
  promptBlendWeightValue.textContent = getPromptBlendWeight().toFixed(2);
}

function appendTranscript(baseText, transcriptText) {
  const text = transcriptText.trim();
  if (!text) {
    return baseText;
  }
  const separator = baseText.length === 0 || /\s$/.test(baseText) ? "" : " ";
  return `${baseText}${separator}${text} `;
}

function applyPartialTranscript(text) {
  const partial = text.trim();
  if (!partial) {
    promptInput.value = dictationBaseValue;
  } else {
    const separator = dictationBaseValue.length === 0 || /\s$/.test(dictationBaseValue) ? "" : " ";
    promptInput.value = `${dictationBaseValue}${separator}${partial}`;
  }
  notifySequenceTextChanged();
  growTextarea();
}

function commitTranscript(text) {
  dictationBaseValue = appendTranscript(dictationBaseValue, text);
  promptInput.value = dictationBaseValue;
  notifySequenceTextChanged();
  growTextarea();
  saveGenerationSettings();
  scheduleGeneration({ force: true });
}

function handleTranscriptionMessage(event) {
  let payload;
  try {
    payload = JSON.parse(event.data);
  } catch {
    return;
  }

  if (payload.type === "ready") {
    setStatus("Listening", "busy");
    return;
  }
  if (payload.type === "reset") {
    suppressTranscriptsUntilReset = false;
    if (dictationActive || dictationStarting) {
      setStatus("Listening", "busy");
    }
    return;
  }
  if (payload.type === "error") {
    suppressTranscriptsUntilReset = false;
    setStatus(payload.message || "Dictation error", "error");
    setMicState("error");
    void stopDictation({ notifyServer: false });
    return;
  }
  if (suppressTranscriptsUntilReset) {
    return;
  }
  if (payload.type === "partial") {
    applyPartialTranscript(payload.text || "");
    return;
  }
  if (payload.type === "final") {
    commitTranscript(payload.text || "");
  }
}

function websocketUrl(path) {
  const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
  return `${protocol}//${window.location.host}${path}`;
}

function waitForTranscriptionReady(socket) {
  return new Promise((resolve, reject) => {
    function cleanup() {
      socket.removeEventListener("message", handleMessage);
      socket.removeEventListener("close", handleClose);
      socket.removeEventListener("error", handleError);
    }

    function handleMessage(event) {
      let payload;
      try {
        payload = JSON.parse(event.data);
      } catch {
        return;
      }

      if (payload.type === "ready") {
        cleanup();
        resolve();
        return;
      }
      if (payload.type === "error") {
        cleanup();
        reject(new Error(payload.message || "Dictation error"));
      }
    }

    function handleClose() {
      cleanup();
      reject(new Error("Dictation connection closed."));
    }

    function handleError() {
      cleanup();
      reject(new Error("Dictation connection failed."));
    }

    socket.addEventListener("message", handleMessage);
    socket.addEventListener("close", handleClose);
    socket.addEventListener("error", handleError);
  });
}

async function startDictation() {
  if (dictationActive || dictationStarting) {
    return;
  }

  dictationStarting = true;
  try {
    setMicState("recording");
    setStatus("Connecting", "busy");
    dictationBaseValue = promptInput.value;
    suppressTranscriptsUntilReset = false;

    transcriptSocket = new WebSocket(websocketUrl("/ws/transcribe"));
    transcriptSocket.binaryType = "arraybuffer";
    transcriptSocket.addEventListener("close", () => {
      if (dictationActive) {
        void stopDictation({ notifyServer: false });
      }
    });

    await new Promise((resolve, reject) => {
      transcriptSocket.addEventListener("open", resolve, { once: true });
      transcriptSocket.addEventListener("error", reject, { once: true });
    });

    transcriptSocket.send(JSON.stringify({ type: "start", sample_rate: ASR_SAMPLE_RATE }));
    await waitForTranscriptionReady(transcriptSocket);
    transcriptSocket.addEventListener("message", handleTranscriptionMessage);

    const context = new AudioContext({ sampleRate: ASR_SAMPLE_RATE });
    audioContext = context;
    await context.audioWorklet.addModule("/static/audio-worklet.js");

    micStream = await navigator.mediaDevices.getUserMedia({
      audio: {
        channelCount: 1,
        echoCancellation: true,
        noiseSuppression: true,
        sampleRate: ASR_SAMPLE_RATE,
      },
    });

    if (context !== audioContext || transcriptSocket?.readyState !== WebSocket.OPEN) {
      micStream.getTracks().forEach((track) => track.stop());
      micStream = null;
      return;
    }

    micSource = context.createMediaStreamSource(micStream);
    micProcessor = new AudioWorkletNode(context, "pcm-capture");
    micSilencer = context.createGain();
    micSilencer.gain.value = 0;

    micProcessor.port.onmessage = (event) => {
      if (transcriptSocket?.readyState === WebSocket.OPEN) {
        transcriptSocket.send(event.data);
      }
    };

    micSource.connect(micProcessor);
    micProcessor.connect(micSilencer);
    micSilencer.connect(context.destination);
    dictationActive = true;
    dictationStarting = false;
    setStatus("Listening", "busy");
  } catch (error) {
    dictationStarting = false;
    setStatus(error.message || "Mic error", "error");
    await stopDictation({ notifyServer: false });
    setMicState("error");
  }
}

async function stopDictation({ notifyServer = true } = {}) {
  const socket = transcriptSocket;
  dictationStarting = false;
  dictationActive = false;
  suppressTranscriptsUntilReset = false;

  socket?.removeEventListener("message", handleTranscriptionMessage);

  if (notifyServer && socket?.readyState === WebSocket.OPEN) {
    socket.send(JSON.stringify({ type: "stop" }));
  }

  micProcessor?.disconnect();
  micSource?.disconnect();
  micSilencer?.disconnect();
  micStream?.getTracks().forEach((track) => track.stop());

  micProcessor = null;
  micSource = null;
  micSilencer = null;
  micStream = null;

  if (audioContext) {
    await audioContext.close();
  }
  audioContext = null;

  const closeDelay = notifyServer ? 150 : 0;
  window.setTimeout(() => {
    if (socket?.readyState === WebSocket.OPEN || socket?.readyState === WebSocket.CONNECTING) {
      socket.close();
    }
  }, closeDelay);
  transcriptSocket = null;
  setMicState("idle");
  if (statusWrap.dataset.state === "busy") {
    setStatus("Idle");
  }
}

async function toggleDictation() {
  if (dictationActive || dictationStarting) {
    await stopDictation();
  } else {
    await startDictation();
  }
}

async function resetPromptAndAsr() {
  cancelSequence("Idle");
  clearSequenceIndicator();
  window.clearTimeout(debounceTimer);
  debounceTimer = null;
  latestRequestId += 1;
  lastSubmittedKey = "";
  dictationBaseValue = "";
  promptInput.value = "";
  additionalPromptInput.value = "";
  clearGeneratedImages();
  growTextarea();
  growAdditionalPromptTextarea();
  saveGenerationSettings();
  if (transcriptSocket?.readyState === WebSocket.OPEN) {
    suppressTranscriptsUntilReset = true;
    transcriptSocket.send(JSON.stringify({ type: "reset", sample_rate: ASR_SAMPLE_RATE }));
  }
  setStatus(
    dictationActive || dictationStarting ? "Listening" : "Idle",
    dictationActive || dictationStarting ? "busy" : "idle",
  );
  promptInput.focus();
}

async function initializeSettings() {
  let defaults = DEFAULT_GENERATION_SETTINGS;
  try {
    const response = await fetch("/api/config");
    if (response.ok) {
      const config = await response.json();
      applyAvailableModels(config?.image?.available_models);
      defaults = settingsFromConfig(config);
    }
  } catch {
    applyAvailableModels();
    defaults = DEFAULT_GENERATION_SETTINGS;
  }
  if (imageModelDefaults.size === 0) {
    applyAvailableModels();
  }

  const storedSettings = parseStoredSettings();
  const baseSettings = normalizeSettings(storedSettings, defaults);
  const storedModelSettings = parseStoredModelSettings();
  loadModelGenerationSettings();
  if (storedSettings?.model_id && !modelGenerationSettings.has(baseSettings.model_id)) {
    modelGenerationSettings.set(
      baseSettings.model_id,
      normalizeModelControlSettings(baseSettings, modelDefaultsFor(baseSettings.model_id)),
    );
  } else if (
    storedSettings?.model_id
    && modelGenerationSettings.has(baseSettings.model_id)
    && storedModelSettings?.[baseSettings.model_id]?.walk_amplitude === undefined
  ) {
    modelGenerationSettings.set(
      baseSettings.model_id,
      normalizeModelControlSettings(
        {
          ...modelGenerationSettings.get(baseSettings.model_id),
          walk_amplitude: baseSettings.walk_amplitude,
          walk_amplitude_max: baseSettings.walk_amplitude_max,
        },
        modelDefaultsFor(baseSettings.model_id),
      ),
    );
  }
  const modelSettings = modelGenerationSettings.get(baseSettings.model_id);
  applyGenerationSettings({
    ...baseSettings,
    ...(modelSettings ?? {}),
  });
  saveGenerationSettings();
}

promptInput.addEventListener("input", () => {
  notifySequenceTextChanged();
  saveGenerationSettings();
  scheduleGeneration();
});
promptInput.addEventListener("keydown", renderFromPromptShortcut);
additionalPromptInput.addEventListener("input", () => {
  notifySequenceTextChanged();
  growAdditionalPromptTextarea();
  saveGenerationSettings();
  scheduleGeneration({ force: true });
});
additionalPromptInput.addEventListener("keydown", renderFromPromptShortcut);
micButton.addEventListener("click", () => {
  void toggleDictation();
});
sequenceButton.addEventListener("click", () => {
  void runSequence();
});
resetButton.addEventListener("click", () => {
  void resetPromptAndAsr();
});
promptBlendButton.addEventListener("click", () => {
  setPromptBlendEnabled(!isPromptBlendEnabled());
  updateSettingLabels();
  saveGenerationSettings();
  scheduleGeneration({ force: true });
  if (isPromptBlendEnabled()) {
    additionalPromptInput.focus();
  }
});
projectorButton.addEventListener("click", openProjectorWindow);
imageSlot.addEventListener("click", (event) => {
  const image = event.target.closest("img[data-projection-index]");
  if (image) {
    selectProjectedImage(Number.parseInt(image.dataset.projectionIndex, 10));
  }
});
imageSlot.addEventListener("keydown", (event) => {
  const image = event.target.closest("img[data-projection-index]");
  if (image && (event.key === "Enter" || event.key === " ")) {
    event.preventDefault();
    selectProjectedImage(Number.parseInt(image.dataset.projectionIndex, 10));
  }
});
[sizeSelect, stepsInput, guidanceInput, seedInput, batchInput, batchWalkToggle, translateToggle].forEach((control) => {
  control.addEventListener("input", () => {
    if (!sequenceActive) {
      clearSequenceIndicator();
    }
    updateSettingLabels();
    saveGenerationSettings();
    scheduleGeneration({ force: true });
  });
});

if (samToggle) {
  samToggle.addEventListener("change", async () => {
    saveGenerationSettings();

    if (samToggle.checked) {
      if (projectionNeedsSegmentation()) {
        try {
          const segmented = await segmentCurrentProjectionImages();
          setStatus(segmented ? "SAM active" : "No SAM mask", segmented ? "ready" : "error");
        } catch (error) {
          setStatus(error.message || "SAM Error", "error");
        }
      } else {
        sendProjectionBatch();
        setStatus("SAM active", "ready");
      }
    } else {
      sendProjectionBatch();
      setStatus("SAM paused", "ready");
    }
  });
}
modelSelect.addEventListener("input", () => {
  if (!sequenceActive) {
    clearSequenceIndicator();
  }
  rememberModelControlSettings(activeModelId);
  applySelectedModelSettings();
  updateSettingLabels();
  saveGenerationSettings();
  scheduleGeneration({ force: true });
});
sequenceIntervalInput.addEventListener("input", () => {
  updateSettingLabels();
  saveGenerationSettings();
});
promptSequenceDurationInput.addEventListener("input", () => {
  updateSettingLabels();
  saveGenerationSettings();
});
walkAmplitudeInput.addEventListener("input", () => {
  updateSettingLabels();
  saveGenerationSettings();
  if (batchWalkToggle.checked) {
    scheduleGeneration({ force: true });
  }
});
walkAmplitudeMaxInput.addEventListener("change", () => {
  applyWalkAmplitudeMax(walkAmplitudeMaxInput.value);
  updateSettingLabels();
  saveGenerationSettings();
});
promptBlendWeightInput.addEventListener("input", () => {
  updateSettingLabels();
  saveGenerationSettings();
  scheduleGeneration({ force: true });
});
sequenceModeButtons.forEach((button) => {
  button.addEventListener("click", () => {
    setSequenceMode(button.dataset.sequenceMode);
    saveGenerationSettings();
  });
});
audioInputGain.addEventListener("input", updateAudioInputGain);
[crossfadeInput, gammaInput, contrastInput, brightnessInput, saturationInput,
  meltAmountInput, meltVariationInput, meltSpeedInput, maskedSmudgeToggle,
  glowRadiusInput, glowIntensityInput, glowFrequencyInput, glowHueInput,
  tilingInput, samOverlayToggle, samOverlayAlphaInput].forEach((input) => {
  if (input) {
    input.addEventListener("input", updateProjectorEffects);
    input.addEventListener("change", updateProjectorEffects);
  }
});
if (samOverlayToggle) {
  samOverlayToggle.addEventListener("change", async () => {
    if (!samOverlayToggle.checked || !projectionNeedsSegmentation()) {
      return;
    }
    try {
      const segmented = await segmentCurrentProjectionImages({ statusLabel: "Segmenting overlay" });
      setStatus(segmented ? "SAM overlay active" : "No SAM mask", segmented ? "ready" : "error");
    } catch (error) {
      setStatus(error.message || "SAM Error", "error");
    }
  });
}
[maskedSmudgeToggle].forEach((input) => {
  input?.addEventListener("change", async () => {
    if (!maskedSmudgeToggle.checked || !projectionNeedsSegmentation()) {
      return;
    }
    try {
      const segmented = await segmentCurrentProjectionImages({ statusLabel: "Segmenting masked smudge" });
      setStatus(segmented ? "Masked smudge active" : "No SAM mask", segmented ? "ready" : "error");
    } catch (error) {
      setStatus(error.message || "SAM Error", "error");
    }
  });
});
[glowRadiusInput, glowIntensityInput, glowFrequencyInput, glowHueInput].forEach((input) => {
  input.addEventListener("change", async () => {
    const effects = getProjectorEffects();
    if (
      projectionNeedsSegmentation()
      && (samToggle?.checked || effects.samOverlay || effects.maskedSmudge || effects.glowIntensity > 0.01)
    ) {
      try {
        const segmented = await segmentCurrentProjectionImages({ statusLabel: "Segmenting glow" });
        setStatus(segmented ? "SAM glow active" : "No SAM mask", segmented ? "ready" : "error");
      } catch (error) {
        setStatus(error.message || "SAM Error", "error");
      }
    }
  });
});
audioSpectrumCanvas.addEventListener("pointerdown", (event) => {
  const rectangle = audioSpectrumCanvas.getBoundingClientRect();
  const bounds = spectrumPlotBounds();
  const x = event.clientX - rectangle.left;
  const y = event.clientY - rectangle.top;
  if (x < bounds.left || x > bounds.right || y < bounds.top || y > bounds.bottom) {
    return;
  }
  draggedThresholdBand = thresholdBandAtCanvasX(x, bounds);
  if (draggedThresholdBand < 0) {
    draggedThresholdBand = null;
    return;
  }
  event.preventDefault();
  audioSpectrumCanvas.setPointerCapture(event.pointerId);
  setThresholdFromPointer(event);
});
audioSpectrumCanvas.addEventListener("pointermove", (event) => {
  if (draggedThresholdBand !== null) {
    event.preventDefault();
    setThresholdFromPointer(event);
  }
});
const finishThresholdDrag = (event) => {
  if (draggedThresholdBand === null) {
    return;
  }
  if (audioSpectrumCanvas.hasPointerCapture(event.pointerId)) {
    audioSpectrumCanvas.releasePointerCapture(event.pointerId);
  }
  draggedThresholdBand = null;
  drawAudioSpectrum();
};
audioSpectrumCanvas.addEventListener("pointerup", finishThresholdDrag);
audioSpectrumCanvas.addEventListener("pointercancel", finishThresholdDrag);
audioPanelToggle.addEventListener("click", () => {
  setAudioPanelCollapsed(audioMonitor.dataset.collapsed !== "true");
});
effectsPanelToggle.addEventListener("click", () => {
  setEffectsPanelCollapsed(effectsPanel.dataset.collapsed !== "true");
});
const audioMatrixPanelToggle = document.getElementById("audioMatrixPanelToggle");
if (audioMatrixPanelToggle) {
  audioMatrixPanelToggle.addEventListener("click", () => {
    const panel = document.getElementById("audioMatrixPanel");
    setAudioMatrixPanelCollapsed(panel.dataset.collapsed !== "true");
  });
}
if (samPromptInput) {
  const triggerSamUpdate = async () => {
    const effects = getProjectorEffects();
    const samActive = (samToggle && samToggle.checked) || effects.samOverlay || effects.maskedSmudge || effects.glowIntensity > 0.01;
    if (samActive) {
      projectionMasks = projectionImages.map(() => null);
      try {
        const segmented = await segmentCurrentProjectionImages();
        setStatus(segmented ? "SAM updated" : "No SAM mask", segmented ? "ready" : "error");
      } catch (error) {
        setStatus(error.message || "SAM Error", "error");
      }
    }
  };

  samPromptInput.addEventListener("input", async () => {
    saveGenerationSettings();
    if (samPromptInput.value.endsWith(" ")) {
      void triggerSamUpdate();
    }
  });

  samPromptInput.addEventListener("change", () => {
    void triggerSamUpdate();
  });

  samPromptInput.addEventListener("keydown", (event) => {
    if (event.key === "Enter") {
      event.preventDefault();
      saveGenerationSettings();
      void triggerSamUpdate();
    }
  });
}
window.addEventListener("resize", drawAudioSpectrum);
if ("ResizeObserver" in window) {
  new ResizeObserver(drawAudioSpectrum).observe(audioSpectrumCanvas);
}
window.addEventListener("load", () => {
  growTextarea();
  growAdditionalPromptTextarea();
  loadAudioPanelState();
  loadEffectsPanelState();
  initializeAudioMatrixUI();
  loadAudioMatrixPanelState();
  loadAudioInputGain();
  loadAudioThresholds();
  loadProjectorEffects();
  drawAudioSpectrum();
  void initializeSettings();
});
