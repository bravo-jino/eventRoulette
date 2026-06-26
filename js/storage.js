const ROULETTE_DEFAULT_CONFIG = {
  eventTitle: "룰렛 이벤트",
  spinButtonText: "룰렛 돌리기",
  titleImage: "",
  loggingEnabled: true,
  items: [
    { label: "커피 기프티콘", weight: 2, probability: null, color: "#fff3a3" },
    { label: "햄버거 세트", weight: 1, probability: null, color: "#ffffff" },
    { label: "과자 세트", weight: 2, probability: null, color: "#6ee7f9" },
    { label: "꽝", weight: 1, probability: null, color: "#ffe0f0" },
    { label: "음료 기프티콘", weight: 1, probability: null, color: "#b7f7c4" },
    { label: "꽝", weight: 1, probability: null, color: "#ffd59e" },
    { label: "리유저블 컵", weight: 1, probability: null, color: "#bfdbfe" },
    { label: "쿠폰", weight: 1, probability: null, color: "#fecaca" }
  ]
};

const ROULETTE_PALETTE = ["#fff3a3", "#ffffff", "#6ee7f9", "#ffe0f0", "#b7f7c4", "#ffd59e"];

function rouletteToPositiveNumber(value, fallback = 1) {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

function rouletteToOptionalNonNegativeNumber(value) {
  if (value === "" || value === null || value === undefined) return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : null;
}

function rouletteNormalizeItems(rawItems = []) {
  return rawItems.map((item, index) => ({
    label: (item.label || "").trim() || "(미입력)",
    weight: rouletteToPositiveNumber(item.weight, 1),
    probability: rouletteToOptionalNonNegativeNumber(item.probability),
    color: (item.color || "").trim() || ROULETTE_PALETTE[index % ROULETTE_PALETTE.length]
  }));
}

function rouletteNormalizeConfig(rawConfig = {}) {
  const merged = { ...ROULETTE_DEFAULT_CONFIG, ...rawConfig };
  const items = rouletteNormalizeItems(merged.items);
  return {
    ...merged,
    eventTitle: (merged.eventTitle || ROULETTE_DEFAULT_CONFIG.eventTitle).trim(),
    spinButtonText: (merged.spinButtonText || ROULETTE_DEFAULT_CONFIG.spinButtonText).trim(),
    titleImage: typeof merged.titleImage === "string" ? merged.titleImage : "",
    loggingEnabled: merged.loggingEnabled === true,
    items: items.length >= 2 ? items : rouletteNormalizeItems(ROULETTE_DEFAULT_CONFIG.items)
  };
}

function rouletteEscapeCsv(value) {
  return `"${String(value ?? "").replace(/"/g, '""')}"`;
}

function rouletteFormatLogTime(value) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value || "";
  return date.toLocaleString("ko-KR", { hour12: false });
}

function rouletteBuildCsv(rows) {
  const lines = [
    ["id", "timestamp", "local_time", "prize"].map(rouletteEscapeCsv).join(","),
    ...rows.map((entry) => [
      entry.id || "",
      entry.timestamp || "",
      rouletteFormatLogTime(entry.timestamp),
      entry.label || ""
    ].map(rouletteEscapeCsv).join(","))
  ];
  return `\uFEFF${lines.join("\r\n")}`;
}

function rouletteParseCsvLine(line) {
  const values = [];
  let value = "";
  let inQuotes = false;

  for (let i = 0; i < line.length; i += 1) {
    const char = line[i];
    const next = line[i + 1];
    if (char === '"' && inQuotes && next === '"') {
      value += '"';
      i += 1;
    } else if (char === '"') {
      inQuotes = !inQuotes;
    } else if (char === "," && !inQuotes) {
      values.push(value);
      value = "";
    } else {
      value += char;
    }
  }

  values.push(value);
  return values;
}

function rouletteParseCsv(text) {
  const cleanText = text.replace(/^\uFEFF/, "");
  const lines = cleanText.split(/\r?\n/).filter((line) => line.trim() !== "");
  if (lines.length <= 1) return [];

  const header = rouletteParseCsvLine(lines[0]).map((name) => name.trim());
  const timestampIndex = header.indexOf("timestamp");
  const localTimeIndex = header.indexOf("local_time");
  const labelIndex = header.indexOf("prize");

  return lines.slice(1).map((line, index) => {
    const values = rouletteParseCsvLine(line);
    return {
      id: values[0] || index + 1,
      timestamp: timestampIndex >= 0 ? values[timestampIndex] : "",
      localTime: localTimeIndex >= 0 ? values[localTimeIndex] : "",
      label: labelIndex >= 0 ? values[labelIndex] : values[values.length - 1] || ""
    };
  }).filter((entry) => entry.label);
}

const RouletteStore = (() => {
  const DB_NAME = "rouletteLocalDb";
  const DB_VERSION = 1;
  const CONFIG_KEY = "active";
  const CSV_HANDLE_KEY = "csvFileHandle";
  const LEGACY_MIGRATED_KEY = "legacyMigrated";
  const LEGACY_CONFIG_KEY = "rouletteConfig";
  const LEGACY_LOG_KEY = "rouletteResultLog";
  let dbPromise;

  function openDb() {
    if (dbPromise) return dbPromise;
    dbPromise = new Promise((resolve, reject) => {
      const request = indexedDB.open(DB_NAME, DB_VERSION);
      request.onupgradeneeded = () => {
        const db = request.result;
        if (!db.objectStoreNames.contains("config")) db.createObjectStore("config");
        if (!db.objectStoreNames.contains("meta")) db.createObjectStore("meta");
        if (!db.objectStoreNames.contains("logs")) {
          db.createObjectStore("logs", { keyPath: "id", autoIncrement: true });
        }
      };
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
    return dbPromise;
  }

  async function withStore(storeName, mode, callback) {
    const db = await openDb();
    return new Promise((resolve, reject) => {
      const transaction = db.transaction(storeName, mode);
      const store = transaction.objectStore(storeName);
      let callbackResult;
      transaction.oncomplete = () => resolve(callbackResult);
      transaction.onerror = () => reject(transaction.error);
      transaction.onabort = () => reject(transaction.error);
      callbackResult = callback(store);
    });
  }

  function requestToPromise(request) {
    return new Promise((resolve, reject) => {
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
  }

  async function migrateLegacyData() {
    const alreadyMigrated = await withStore("meta", "readonly", (store) => requestToPromise(store.get(LEGACY_MIGRATED_KEY)));
    if (alreadyMigrated === true) return;

    const existingConfig = await withStore("config", "readonly", (store) => requestToPromise(store.get(CONFIG_KEY)));
    if (existingConfig) {
      await withStore("meta", "readwrite", (store) => store.put(true, LEGACY_MIGRATED_KEY));
      return;
    }

    if (!existingConfig) {
      const legacyConfig = localStorage.getItem(LEGACY_CONFIG_KEY);
      const parsedConfig = legacyConfig ? JSON.parse(legacyConfig) : ROULETTE_DEFAULT_CONFIG;
      await saveConfig(rouletteNormalizeConfig(parsedConfig));
    }

    const existingLogs = await getLogs();
    if (existingLogs.length === 0) {
      const legacyLog = localStorage.getItem(LEGACY_LOG_KEY);
      const parsedLog = legacyLog ? JSON.parse(legacyLog) : [];
      if (Array.isArray(parsedLog)) {
        for (const entry of parsedLog) {
          await addLog(entry.label || "", entry.timestamp || new Date().toISOString(), false);
        }
      }
    }

    await withStore("meta", "readwrite", (store) => store.put(true, LEGACY_MIGRATED_KEY));
  }

  async function init() {
    await openDb();
    try {
      await migrateLegacyData();
    } catch {
      await saveConfig(rouletteNormalizeConfig(ROULETTE_DEFAULT_CONFIG));
    }
  }

  async function getConfig() {
    await init();
    const config = await withStore("config", "readonly", (store) => requestToPromise(store.get(CONFIG_KEY)));
    return rouletteNormalizeConfig(config || ROULETTE_DEFAULT_CONFIG);
  }

  async function saveConfig(config) {
    const normalizedConfig = rouletteNormalizeConfig(config);
    await withStore("config", "readwrite", (store) => store.put(normalizedConfig, CONFIG_KEY));
    return normalizedConfig;
  }

  async function resetConfig() {
    return saveConfig(ROULETTE_DEFAULT_CONFIG);
  }

  async function addLog(label, timestamp = new Date().toISOString(), syncCsv = true) {
    const entry = { timestamp, label };
    await withStore("logs", "readwrite", (store) => store.add(entry));
    return entry;
  }

  async function getLogs() {
    await openDb();
    return withStore("logs", "readonly", (store) => requestToPromise(store.getAll()));
  }

  async function clearLogs() {
    await withStore("logs", "readwrite", (store) => store.clear());
  }

  async function deleteLog(id) {
    const key = Number(id);
    if (!Number.isFinite(key)) return;
    await withStore("logs", "readwrite", (store) => store.delete(key));
  }

  async function exportData() {
    const config = await getConfig();
    const logs = await getLogs();
    return {
      version: 1,
      exportedAt: new Date().toISOString(),
      config,
      logs
    };
  }

  async function importData(data) {
    if (!data || typeof data !== "object") {
      throw new Error("Invalid backup data");
    }

    const config = rouletteNormalizeConfig(data.config || ROULETTE_DEFAULT_CONFIG);
    const logs = Array.isArray(data.logs) ? data.logs : [];
    await saveConfig(config);
    await clearLogs();
    await withStore("logs", "readwrite", (store) => {
      logs.forEach((entry) => {
        if (!entry || !entry.label) return;
        store.add({
          timestamp: entry.timestamp || new Date().toISOString(),
          label: entry.label
        });
      });
    });
  }

  async function setCsvFileHandle(handle) {
    await withStore("meta", "readwrite", (store) => store.put(handle, CSV_HANDLE_KEY));
    await writeCsvFileIfPossible(true);
  }

  async function getCsvFileHandle() {
    return withStore("meta", "readonly", (store) => requestToPromise(store.get(CSV_HANDLE_KEY)));
  }

  async function writeCsvFileIfPossible(forceRequest = false) {
    if (!window.showSaveFilePicker) return false;
    const handle = await getCsvFileHandle();
    if (!handle) return false;

    const options = { mode: "readwrite" };
    const permission = await handle.queryPermission(options);
    if (permission !== "granted") {
      if (!forceRequest) return false;
      const requested = await handle.requestPermission(options);
      if (requested !== "granted") return false;
    }

    const rows = await getLogs();
    const writable = await handle.createWritable();
    await writable.write(rouletteBuildCsv(rows));
    await writable.close();
    return true;
  }

  return {
    init,
    getConfig,
    saveConfig,
    resetConfig,
    addLog,
    getLogs,
    clearLogs,
    deleteLog,
    exportData,
    importData,
    setCsvFileHandle,
    writeCsvFileIfPossible
  };
})();
