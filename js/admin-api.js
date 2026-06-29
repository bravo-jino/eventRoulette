(function () {
  const remoteConfig = window.ROULETTE_REMOTE_CONFIG || {};
  const supabaseUrl = String(remoteConfig.supabaseUrl || "").replace(/\/+$/, "");
  const supabaseAnonKey = String(remoteConfig.supabaseAnonKey || "");

  async function call(action, payload = {}) {
    if (!supabaseUrl || !supabaseAnonKey) {
      throw new Error("Remote admin API is not configured.");
    }

    const token = await window.RouletteAdminAuth.getToken();
    const response = await fetch(`${supabaseUrl}/functions/v1/roulette-admin-api`, {
      method: "POST",
      headers: {
        apikey: supabaseAnonKey,
        Authorization: `Bearer ${supabaseAnonKey}`,
        "Content-Type": "application/json",
        "x-admin-token": token
      },
      body: JSON.stringify({ action, payload })
    });

    if (!response.ok) {
      throw new Error(await response.text());
    }

    const text = await response.text();
    return text ? JSON.parse(text) : null;
  }

  window.RouletteAdminApi = {
    getLogs: () => call("getLogs"),
    exportData: () => call("exportData"),
    saveConfig: (config) => call("saveConfig", { config }),
    resetConfig: () => call("resetConfig"),
    clearLogs: () => call("clearLogs"),
    deleteLog: (id) => call("deleteLog", { id }),
    importData: (data) => call("importData", { data })
  };
})();
