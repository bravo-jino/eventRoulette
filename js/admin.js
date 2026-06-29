const itemsWrap = document.getElementById("items");
const addButton = document.getElementById("add");
const saveButtons = Array.from(document.querySelectorAll(".save-config"));
const resetButton = document.getElementById("reset");
const eventTitleInput = document.getElementById("event-title-input");
const spinButtonInput = document.getElementById("spin-button-input");
const titleImageUpload = document.getElementById("title-image-upload");
const titleImagePreview = document.getElementById("title-image-preview");
const removeTitleImageButton = document.getElementById("remove-title-image");
const loggingEnabledInput = document.getElementById("logging-enabled");
const logSummary = document.getElementById("log-summary");
const logBody = document.getElementById("log-body");
const statsGrid = document.getElementById("stats-grid");
const exportLogButton = document.getElementById("export-log");
const exportBackupButton = document.getElementById("export-backup");
const importBackupButton = document.getElementById("import-backup");
const importBackupInput = document.getElementById("import-backup-file");
const clearLogButton = document.getElementById("clear-log");
const openCsvButton = document.getElementById("open-csv");
const openCsvInput = document.getElementById("open-csv-file");
const csvStatus = document.getElementById("csv-status");

const preview = document.getElementById("preview");
const previewCtx = preview.getContext("2d");

let currentTitleImage = "";
let visibleLogSource = "db";
let openedCsvRows = [];

function runAdminAction(action) {
  Promise.resolve(action()).catch((error) => {
    console.error(error);
    alert("작업 중 오류가 발생했습니다.");
  });
}

function buildSegments(items) {
  const safeItems = rouletteNormalizeItems(items);
  const totalWeight = safeItems.reduce((sum, item) => sum + item.weight, 0) || 1;
  let start = -Math.PI / 2;

  return safeItems.map((item) => {
    const angle = (item.weight / totalWeight) * Math.PI * 2;
    const segment = { ...item, start, end: start + angle };
    start += angle;
    return segment;
  });
}

function getWheelFontSize(context, label, radius, maxWidth) {
  let fontSize = Math.min(radius * 0.09, 30);
  const minFontSize = Math.max(13, radius * 0.052);

  while (fontSize > minFontSize) {
    context.font = `900 ${fontSize}px Pretendard, Noto Sans KR, Arial, sans-serif`;
    if (context.measureText(label).width <= maxWidth) break;
    fontSize -= 1;
  }

  return fontSize;
}

function drawWheelLabel(context, segment, radius) {
  const label = segment.label;
  const textAngle = (segment.start + segment.end) / 2;
  const maxWidth = radius * 0.48;
  const fontSize = getWheelFontSize(context, label, radius, maxWidth);

  context.save();
  context.rotate(textAngle);
  context.textAlign = "right";
  context.textBaseline = "middle";
  context.font = `900 ${fontSize}px Pretendard, Noto Sans KR, Arial, sans-serif`;
  context.lineWidth = Math.max(3, fontSize * 0.15);
  context.strokeStyle = "rgba(255, 255, 255, 0.92)";
  context.fillStyle = "#111827";
  context.strokeText(label, radius * 0.77, 0, maxWidth);
  context.fillText(label, radius * 0.77, 0, maxWidth);
  context.restore();
}

function drawPreview(segments) {
  const size = Math.min(320, preview.parentElement.clientWidth);
  preview.width = size;
  preview.height = size;

  const radius = size / 2;
  previewCtx.clearRect(0, 0, size, size);

  previewCtx.save();
  previewCtx.translate(radius, radius);

  segments.forEach((segment) => {
    previewCtx.beginPath();
    previewCtx.moveTo(0, 0);
    previewCtx.arc(0, 0, radius * 0.86, segment.start, segment.end);
    previewCtx.closePath();
    previewCtx.fillStyle = segment.color;
    previewCtx.fill();
    previewCtx.strokeStyle = "rgba(255,255,255,0.78)";
    previewCtx.lineWidth = 1.5;
    previewCtx.stroke();
    drawWheelLabel(previewCtx, segment, radius);
  });

  previewCtx.restore();

  previewCtx.beginPath();
  previewCtx.arc(radius, radius, radius * 0.9, 0, Math.PI * 2);
  previewCtx.strokeStyle = "#67e8f9";
  previewCtx.lineWidth = radius * 0.08;
  previewCtx.stroke();

  previewCtx.beginPath();
  previewCtx.arc(radius, radius, radius * 0.98, 0, Math.PI * 2);
  previewCtx.strokeStyle = "#123a9f";
  previewCtx.lineWidth = radius * 0.06;
  previewCtx.stroke();
}

function buildChanceValues(items) {
  const hasAnyProbability = items.some((item) => item.probability !== null);
  if (!hasAnyProbability) {
    const values = items.map((item) => item.weight);
    const total = values.reduce((sum, value) => sum + value, 0) || 1;
    return { mode: "weight", values, total };
  }

  const values = items.map((item) => (item.probability !== null ? item.probability : 0));
  const total = values.reduce((sum, value) => sum + value, 0);
  return { mode: "probability", values, total };
}

function updateProbabilityBadges(items) {
  const rows = Array.from(itemsWrap.children);
  const chance = buildChanceValues(items);
  const total = chance.total > 0 ? chance.total : 1;

  rows.forEach((row, index) => {
    const badge = row.querySelector(".probability-value");
    if (!badge) return;
    const percent = (chance.values[index] / total) * 100;
    badge.textContent = `실제 ${percent.toFixed(1)}%`;
  });
}

function createRow(item = { label: "", weight: 1, color: "", probability: null }) {
  const row = document.createElement("div");
  row.className = "item-row";

  const labelInput = document.createElement("input");
  labelInput.placeholder = "상품명";
  labelInput.className = "item-label";
  labelInput.value = item.label || "";

  const weightInput = document.createElement("input");
  weightInput.type = "number";
  weightInput.min = "0.1";
  weightInput.step = "0.1";
  weightInput.value = rouletteToPositiveNumber(item.weight, 1);
  weightInput.className = "item-weight";

  const probabilityCell = document.createElement("div");
  probabilityCell.className = "probability-cell";

  const probabilityInput = document.createElement("input");
  probabilityInput.type = "number";
  probabilityInput.min = "0";
  probabilityInput.step = "0.1";
  probabilityInput.placeholder = "확률(%)";
  probabilityInput.value = item.probability === null ? "" : item.probability;
  probabilityInput.className = "item-probability";

  const probabilityBadge = document.createElement("span");
  probabilityBadge.className = "probability-value";
  probabilityBadge.textContent = "실제 0%";

  probabilityCell.append(probabilityInput, probabilityBadge);

  const colorInput = document.createElement("input");
  colorInput.type = "text";
  colorInput.placeholder = "예: #fff3a3";
  colorInput.value = item.color || "";
  colorInput.className = "item-color";

  const deleteButton = document.createElement("button");
  deleteButton.type = "button";
  deleteButton.textContent = "삭제";
  deleteButton.addEventListener("click", () => {
    row.remove();
    renderPreview();
  });

  [labelInput, weightInput, probabilityInput, colorInput].forEach((input) => {
    input.addEventListener("input", renderPreview);
  });

  row.append(labelInput, weightInput, probabilityCell, colorInput, deleteButton);
  return row;
}

function readRows() {
  const rows = Array.from(itemsWrap.children);
  return rows.map((row, index) => {
    const labelInput = row.querySelector(".item-label");
    const weightInput = row.querySelector(".item-weight");
    const probabilityInput = row.querySelector(".item-probability");
    const colorInput = row.querySelector(".item-color");

    return {
      label: labelInput?.value.trim() || "(미입력)",
      weight: rouletteToPositiveNumber(weightInput?.value, 1),
      probability: rouletteToOptionalNonNegativeNumber(probabilityInput?.value?.trim()),
      color: colorInput?.value.trim() || ROULETTE_PALETTE[index % ROULETTE_PALETTE.length]
    };
  });
}

function renderRows(config) {
  itemsWrap.innerHTML = "";
  config.items.forEach((item) => itemsWrap.appendChild(createRow(item)));
  renderPreview();
}

function renderSettings(config) {
  currentTitleImage = config.titleImage || "";
  eventTitleInput.value = config.eventTitle || ROULETTE_DEFAULT_CONFIG.eventTitle;
  spinButtonInput.value = config.spinButtonText || ROULETTE_DEFAULT_CONFIG.spinButtonText;
  loggingEnabledInput.checked = config.loggingEnabled === true;
  renderTitleImagePreview();
}

function renderTitleImagePreview() {
  const image = titleImagePreview.querySelector("img");
  if (!currentTitleImage || !image) {
    titleImagePreview.hidden = true;
    if (image) image.removeAttribute("src");
    return;
  }
  image.src = currentTitleImage;
  titleImagePreview.hidden = false;
}

function renderPreview() {
  const items = readRows();
  if (items.length === 0) return;
  drawPreview(buildSegments(items));
  updateProbabilityBadges(items);
}

function buildStats(rows) {
  const counts = new Map();
  rows.forEach((entry) => {
    const label = entry.label || "";
    if (!label) return;
    counts.set(label, (counts.get(label) || 0) + 1);
  });

  const sorted = Array.from(counts.entries()).sort((a, b) => b[1] - a[1]);
  const latest = rows.length ? rows[rows.length - 1] : null;
  return {
    total: rows.length,
    unique: counts.size,
    top: sorted[0] ? `${sorted[0][0]} (${sorted[0][1]}건)` : "-",
    latest: latest ? `${rouletteFormatLogTime(latest.timestamp) || latest.localTime} / ${latest.label}` : "-"
  };
}

function renderStats(rows) {
  const stats = buildStats(rows);
  statsGrid.innerHTML = "";
  [
    ["총 기록", `${stats.total}건`],
    ["상품 종류", `${stats.unique}개`],
    ["최다 당첨", stats.top],
    ["최근 결과", stats.latest]
  ].forEach(([label, value]) => {
    const item = document.createElement("div");
    item.className = "stat-item";
    const labelNode = document.createElement("span");
    const valueNode = document.createElement("strong");
    labelNode.textContent = label;
    valueNode.textContent = value;
    item.append(labelNode, valueNode);
    statsGrid.appendChild(item);
  });
}

async function getVisibleRows() {
  if (visibleLogSource === "csv") return openedCsvRows;
  if (RouletteStore.isRemoteEnabled()) return RouletteAdminApi.getLogs();
  return RouletteStore.getLogs();
}

async function renderLog() {
  const rows = await getVisibleRows();
  const displayRows = rows.slice().reverse();
  const sourceName = RouletteStore.isRemoteEnabled() ? "공용 DB" : "로컬 DB";
  logSummary.textContent = visibleLogSource === "csv"
    ? `CSV 파일 기록 ${rows.length}건`
    : `${sourceName} 기록 ${rows.length}건`;
  renderStats(rows);
  logBody.innerHTML = "";

  if (displayRows.length === 0) {
    const emptyRow = document.createElement("tr");
    const cell = document.createElement("td");
    cell.colSpan = 3;
    cell.textContent = "아직 기록이 없습니다.";
    emptyRow.appendChild(cell);
    logBody.appendChild(emptyRow);
    return;
  }

  displayRows.forEach((entry) => {
    const row = document.createElement("tr");
    const timeCell = document.createElement("td");
    const labelCell = document.createElement("td");
    const actionCell = document.createElement("td");
    timeCell.textContent = rouletteFormatLogTime(entry.timestamp) || entry.localTime || "";
    labelCell.textContent = entry.label || "";

    if (visibleLogSource === "db" && entry.id !== undefined) {
      const deleteButton = document.createElement("button");
      deleteButton.type = "button";
      deleteButton.className = "log-delete-button";
      deleteButton.textContent = "삭제";
      deleteButton.addEventListener("click", () => runAdminAction(async () => {
        if (!confirm("이 기록을 삭제할까요?")) return;
        if (RouletteStore.isRemoteEnabled()) {
          await RouletteAdminApi.deleteLog(entry.id);
        } else {
          await RouletteStore.deleteLog(entry.id);
        }
        await renderLog();
      }));
      actionCell.appendChild(deleteButton);
    } else {
      actionCell.textContent = "-";
    }

    row.append(timeCell, labelCell, actionCell);
    logBody.appendChild(row);
  });
}

function downloadLogCsv(rows) {
  const blob = new Blob([rouletteBuildCsv(rows)], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = `roulette-results-${new Date().toISOString().slice(0, 10)}.csv`;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}

function downloadJson(filename, data) {
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}

function validateItems(items) {
  if (items.length < 2) {
    alert("상품은 최소 2개 이상 필요합니다.");
    return false;
  }

  const chance = buildChanceValues(items);
  if (chance.mode !== "probability") return true;

  const hasMissing = items.some((item) => item.probability === null);
  if (hasMissing) {
    alert("확률 입력을 시작하면 모든 항목에 확률을 입력해야 합니다.");
    return false;
  }

  if (chance.total <= 0) {
    alert("확률 합계는 0보다 커야 합니다.");
    return false;
  }

  if (Math.abs(chance.total - 100) > 0.1) {
    alert(`확률 합계는 100이어야 합니다. 현재 합계: ${chance.total.toFixed(1)}`);
    return false;
  }

  return true;
}

addButton.addEventListener("click", () => {
  itemsWrap.appendChild(createRow());
  renderPreview();
});

function saveConfig() {
  runAdminAction(async () => {
    const items = readRows();
    if (!validateItems(items)) return;

    const config = {
      items,
      eventTitle: eventTitleInput.value.trim() || ROULETTE_DEFAULT_CONFIG.eventTitle,
      spinButtonText: spinButtonInput.value.trim() || ROULETTE_DEFAULT_CONFIG.spinButtonText,
      titleImage: currentTitleImage,
      loggingEnabled: loggingEnabledInput.checked === true
    };

    if (RouletteStore.isRemoteEnabled()) {
      await RouletteAdminApi.saveConfig(config);
    } else {
      await RouletteStore.saveConfig(config);
    }
    alert("저장되었습니다.");
  });
}

saveButtons.forEach((button) => button.addEventListener("click", saveConfig));

resetButton.addEventListener("click", () => runAdminAction(async () => {
  const config = RouletteStore.isRemoteEnabled()
    ? await RouletteAdminApi.resetConfig()
    : await RouletteStore.resetConfig();
  renderSettings(config);
  renderRows(config);
}));

titleImageUpload.addEventListener("change", () => {
  const file = titleImageUpload.files?.[0];
  if (!file) return;
  const reader = new FileReader();
  reader.addEventListener("load", () => {
    currentTitleImage = typeof reader.result === "string" ? reader.result : "";
    renderTitleImagePreview();
  });
  reader.readAsDataURL(file);
});

removeTitleImageButton.addEventListener("click", () => {
  currentTitleImage = "";
  titleImageUpload.value = "";
  renderTitleImagePreview();
});

exportLogButton.addEventListener("click", () => runAdminAction(async () => {
  downloadLogCsv(await getVisibleRows());
}));

exportBackupButton.addEventListener("click", () => runAdminAction(async () => {
  const data = RouletteStore.isRemoteEnabled()
    ? await RouletteAdminApi.exportData()
    : await RouletteStore.exportData();
  downloadJson(`roulette-backup-${new Date().toISOString().slice(0, 10)}.json`, data);
}));

importBackupButton.addEventListener("click", () => {
  importBackupInput.click();
});

importBackupInput.addEventListener("change", () => {
  const file = importBackupInput.files?.[0];
  if (!file) return;

  const reader = new FileReader();
  reader.addEventListener("load", () => runAdminAction(async () => {
    if (!confirm("백업 파일의 설정과 결과 기록으로 현재 데이터를 교체할까요?")) return;
    const data = JSON.parse(String(reader.result || "{}"));
    if (RouletteStore.isRemoteEnabled()) {
      await RouletteAdminApi.importData(data);
    } else {
      await RouletteStore.importData(data);
    }
    const config = await RouletteStore.getConfig();
    renderSettings(config);
    renderRows(config);
    visibleLogSource = "db";
    openedCsvRows = [];
    csvStatus.textContent = "백업 파일을 불러왔습니다.";
    await renderLog();
    alert("백업을 불러왔습니다.");
  }));
  reader.readAsText(file, "utf-8");
  importBackupInput.value = "";
});

clearLogButton.addEventListener("click", () => runAdminAction(async () => {
  if (!confirm("로컬 DB 기록을 모두 삭제할까요?")) return;
  if (RouletteStore.isRemoteEnabled()) {
    await RouletteAdminApi.clearLogs();
  } else {
    await RouletteStore.clearLogs();
  }
  visibleLogSource = "db";
  openedCsvRows = [];
  await renderLog();
}));

openCsvButton.addEventListener("click", () => {
  openCsvInput.click();
});

openCsvInput.addEventListener("change", () => {
  const file = openCsvInput.files?.[0];
  if (!file) return;
  const reader = new FileReader();
  reader.addEventListener("load", async () => {
    openedCsvRows = rouletteParseCsv(String(reader.result || ""));
    visibleLogSource = "csv";
    csvStatus.textContent = `${file.name} 파일을 열었습니다.`;
    await renderLog();
  });
  reader.readAsText(file, "utf-8");
});

window.addEventListener("resize", renderPreview);

(async function initAdmin() {
  if (RouletteStore.isRemoteEnabled()) {
    await RouletteAdminAuth.require();
  }
  await RouletteStore.init();
  if (RouletteStore.isRemoteEnabled()) {
    csvStatus.textContent = "공용 DB 기록을 표시 중입니다.";
  }
  const initialConfig = await RouletteStore.getConfig();
  renderSettings(initialConfig);
  renderRows(initialConfig);
  await renderLog();
})();
