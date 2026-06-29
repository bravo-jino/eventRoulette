const TWO_PI = Math.PI * 2;
const POINTER_ANGLE = -Math.PI / 2;
const MIN_SPIN_TURNS = 2;

const wheel = document.getElementById("wheel");
const spinButton = document.getElementById("spin");
const result = document.getElementById("result");
const eventTitle = document.getElementById("event-title");
const titleImageSlot = document.getElementById("title-image-slot");
const titleImage = document.getElementById("title-image");

const ctx = wheel.getContext("2d");
let currentRotation = 0;
let spinning = false;
let activeConfig = rouletteNormalizeConfig(ROULETTE_DEFAULT_CONFIG);

function buildSegments(items) {
  const totalWeight = items.reduce((sum, item) => sum + item.weight, 0) || 1;
  let start = -Math.PI / 2;

  return items.map((item) => {
    const angle = (item.weight / totalWeight) * TWO_PI;
    const segment = { ...item, start, end: start + angle, angle };
    start += angle;
    return segment;
  });
}

function getWheelFontSize(context, label, radius, maxWidth) {
  let fontSize = Math.min(radius * 0.092, 42);
  const minFontSize = Math.max(18, radius * 0.052);

  while (fontSize > minFontSize) {
    context.font = `900 ${fontSize}px Pretendard, Noto Sans KR, Arial, sans-serif`;
    if (context.measureText(label).width <= maxWidth) break;
    fontSize -= 1;
  }

  return fontSize;
}

function drawWheelText(context, segment, radius) {
  const label = segment.label;
  const textAngle = (segment.start + segment.end) / 2;
  const maxWidth = radius * 0.5;
  const fontSize = getWheelFontSize(context, label, radius, maxWidth);

  context.save();
  context.rotate(textAngle);
  context.textAlign = "right";
  context.textBaseline = "middle";
  context.font = `900 ${fontSize}px Pretendard, Noto Sans KR, Arial, sans-serif`;
  context.lineWidth = Math.max(4, fontSize * 0.16);
  context.strokeStyle = "rgba(255, 255, 255, 0.92)";
  context.fillStyle = "#111827";
  context.strokeText(label, radius * 0.79, 0, maxWidth);
  context.fillText(label, radius * 0.79, 0, maxWidth);
  context.restore();
}

function drawWheel(segments, rotation = 0, canvas = wheel, context = ctx) {
  const { width, height } = canvas;
  const radius = Math.min(width, height) / 2;
  context.clearRect(0, 0, width, height);

  context.save();
  context.translate(width / 2, height / 2);
  context.rotate(rotation);

  segments.forEach((segment) => {
    context.beginPath();
    context.moveTo(0, 0);
    context.arc(0, 0, radius * 0.86, segment.start, segment.end);
    context.closePath();
    context.fillStyle = segment.color;
    context.fill();

    context.strokeStyle = "rgba(255, 255, 255, 0.78)";
    context.lineWidth = Math.max(2, radius * 0.008);
    context.stroke();

    drawWheelText(context, segment, radius);
  });

  context.restore();

  const gradient = context.createRadialGradient(width / 2, height / 2, radius * 0.18, width / 2, height / 2, radius);
  gradient.addColorStop(0, "rgba(255,255,255,0.08)");
  gradient.addColorStop(0.72, "rgba(255,255,255,0)");
  gradient.addColorStop(1, "rgba(15,23,42,0.18)");
  context.fillStyle = gradient;
  context.beginPath();
  context.arc(width / 2, height / 2, radius * 0.86, 0, TWO_PI);
  context.fill();

  context.beginPath();
  context.arc(width / 2, height / 2, radius * 0.9, 0, TWO_PI);
  context.strokeStyle = "#67e8f9";
  context.lineWidth = radius * 0.08;
  context.stroke();

  context.beginPath();
  context.arc(width / 2, height / 2, radius * 0.98, 0, TWO_PI);
  context.strokeStyle = "#123a9f";
  context.lineWidth = radius * 0.06;
  context.stroke();

  const dotCount = 18;
  for (let i = 0; i < dotCount; i += 1) {
    const angle = (i / dotCount) * TWO_PI;
    const x = width / 2 + Math.cos(angle) * radius * 0.93;
    const y = height / 2 + Math.sin(angle) * radius * 0.93;
    context.beginPath();
    context.arc(x, y, radius * 0.025, 0, TWO_PI);
    context.fillStyle = i % 2 === 0 ? "#ffffff" : "#facc15";
    context.fill();
  }

  context.beginPath();
  context.arc(width / 2, height / 2, radius * 0.13, 0, TWO_PI);
  context.fillStyle = "#ffffff";
  context.fill();
  context.lineWidth = radius * 0.03;
  context.strokeStyle = "#123a9f";
  context.stroke();
}

function resizeWheel() {
  const size = Math.min(820, wheel.parentElement.clientWidth);
  wheel.width = size;
  wheel.height = size;
}

function buildChanceValues(items) {
  const hasAnyProbability = items.some((item) => item.probability !== null);
  if (!hasAnyProbability) {
    const values = items.map((item) => item.weight);
    const total = values.reduce((sum, value) => sum + value, 0) || 1;
    return { values, total };
  }

  const values = items.map((item) => (item.probability !== null ? item.probability : 0));
  let total = values.reduce((sum, value) => sum + value, 0);

  if (total <= 0) {
    const fallbackValues = items.map((item) => item.weight);
    total = fallbackValues.reduce((sum, value) => sum + value, 0) || 1;
    return { values: fallbackValues, total };
  }

  return { values, total };
}

function chooseSegment(segments) {
  const { values, total } = buildChanceValues(segments);
  let randomPoint = Math.random() * total;

  for (let i = 0; i < segments.length; i += 1) {
    randomPoint -= values[i];
    if (randomPoint <= 0) return segments[i];
  }
  return segments[segments.length - 1];
}

function getFinalRotation(startRotation, targetAngle) {
  const requestedTurns = MIN_SPIN_TURNS + Math.random() * 2;
  const minFinalRotation = startRotation + requestedTurns * TWO_PI;
  const targetBaseRotation = POINTER_ANGLE - targetAngle;
  const loops = Math.ceil((minFinalRotation - targetBaseRotation) / TWO_PI);
  return targetBaseRotation + loops * TWO_PI;
}

function renderConfiguredText(config) {
  eventTitle.textContent = config.eventTitle || ROULETTE_DEFAULT_CONFIG.eventTitle;
  spinButton.textContent = config.spinButtonText || ROULETTE_DEFAULT_CONFIG.spinButtonText;
}

function renderTitleImage(config) {
  if (!config.titleImage) {
    titleImageSlot.hidden = true;
    titleImage.removeAttribute("src");
    return;
  }
  titleImage.src = config.titleImage;
  titleImageSlot.hidden = false;
}

async function recordResult(label) {
  const config = await RouletteStore.getConfig();
  if (!config.loggingEnabled) return;
  await RouletteStore.addLog(label);
}

async function spin() {
  if (spinning) return;

  activeConfig = await RouletteStore.getConfig();
  renderConfiguredText(activeConfig);
  const segments = buildSegments(activeConfig.items);
  const target = chooseSegment(segments);
  const targetAngle = (target.start + target.end) / 2;

  const startRotation = currentRotation;
  const finalRotation = getFinalRotation(startRotation, targetAngle);
  const duration = 2800;
  const start = performance.now();

  spinning = true;
  spinButton.disabled = true;
  result.textContent = "";

  function animate(now) {
    const t = Math.min(1, (now - start) / duration);
    const ease = 1 - Math.pow(1 - t, 3);
    currentRotation = startRotation + (finalRotation - startRotation) * ease;
    drawWheel(segments, currentRotation);

    if (t < 1) {
      requestAnimationFrame(animate);
      return;
    }

    spinning = false;
    spinButton.disabled = false;
    result.textContent = `결과: ${target.label}`;
    recordResult(target.label).catch(() => {
      result.textContent = `결과: ${target.label} (기록 저장 실패)`;
    });
  }

  requestAnimationFrame(animate);
}

async function init() {
  resizeWheel();
  activeConfig = await RouletteStore.getConfig();
  renderConfiguredText(activeConfig);
  renderTitleImage(activeConfig);
  drawWheel(buildSegments(activeConfig.items), currentRotation);
}

window.addEventListener("resize", () => {
  resizeWheel();
  drawWheel(buildSegments(activeConfig.items), currentRotation);
});

spinButton.addEventListener("click", spin);

(async () => {
  await window.RouletteEntryAuth?.require?.();
  await init();
})().catch(() => {
  activeConfig = rouletteNormalizeConfig(ROULETTE_DEFAULT_CONFIG);
  renderConfiguredText(activeConfig);
  renderTitleImage(activeConfig);
  drawWheel(buildSegments(activeConfig.items), currentRotation);
});
