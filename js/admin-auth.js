(function () {
  const remoteConfig = window.ROULETTE_REMOTE_CONFIG || {};
  const supabaseUrl = String(remoteConfig.supabaseUrl || "").replace(/\/+$/, "");
  const supabaseAnonKey = String(remoteConfig.supabaseAnonKey || "");
  let currentSession = null;

  function getCurrentSession() {
    if (!currentSession?.token || !currentSession?.expiresAt) return null;
    if (Date.now() >= Number(currentSession.expiresAt)) {
      currentSession = null;
      return null;
    }
    return currentSession;
  }

  function getFunctionUrl(name) {
    return `${supabaseUrl}/functions/v1/${name}`;
  }

  async function verifyAdminCode(code) {
    const response = await fetch(getFunctionUrl("roulette-admin-auth"), {
      method: "POST",
      headers: {
        apikey: supabaseAnonKey,
        Authorization: `Bearer ${supabaseAnonKey}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({ code })
    });

    if (!response.ok) {
      throw new Error(await response.text());
    }

    return response.json();
  }

  function buildOverlay() {
    const overlay = document.createElement("div");
    overlay.className = "action-auth-overlay";
    overlay.innerHTML = `
      <form id="admin-entry-form" class="action-auth-panel" role="dialog" aria-modal="true" aria-label="관리자 코드 확인">
        <h2>관리자 확인</h2>
        <p>관리자 코드를 입력하세요.</p>
        <input id="admin-entry-code" type="password" autocomplete="current-password" placeholder="관리자 코드" required />
        <p id="admin-entry-error" class="auth-error" aria-live="assertive" hidden></p>
        <div class="admin-actions compact action-auth-actions">
          <a class="admin-link" href="index.html">메인으로</a>
          <button id="admin-entry-submit" type="submit">확인</button>
        </div>
      </form>
    `;
    document.body.appendChild(overlay);
    return overlay;
  }

  async function requestSession() {
    const existing = getCurrentSession();
    if (existing) return existing;

    if (!supabaseUrl || !supabaseAnonKey) {
      currentSession = { token: "", expiresAt: Date.now() + 60 * 60 * 1000 };
      return currentSession;
    }

    return new Promise((resolve) => {
      const overlay = buildOverlay();
      const form = document.getElementById("admin-entry-form");
      const input = document.getElementById("admin-entry-code");
      const error = document.getElementById("admin-entry-error");
      const submit = document.getElementById("admin-entry-submit");

      input.focus();

      form.addEventListener("submit", async (event) => {
        event.preventDefault();
        error.hidden = true;
        submit.disabled = true;

        try {
          const data = await verifyAdminCode(input.value);
          currentSession = {
            token: data.token,
            expiresAt: Date.now() + Number(data.expiresIn || 3600) * 1000
          };
          overlay.remove();
          resolve(currentSession);
        } catch {
          error.textContent = "관리자 코드가 올바르지 않습니다.";
          error.hidden = false;
          input.value = "";
          input.focus();
        } finally {
          submit.disabled = false;
        }
      });
    });
  }

  window.RouletteAdminAuth = {
    require: requestSession,
    getToken: async () => (await requestSession()).token
  };

  window.addEventListener("pagehide", () => {
    currentSession = null;
  });

  window.addEventListener("pageshow", (event) => {
    if (event.persisted) {
      window.location.reload();
    }
  });
})();
