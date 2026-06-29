(function () {
  const SESSION_KEY = "rouletteEntrySession";
  const remoteConfig = window.ROULETTE_REMOTE_CONFIG || {};
  const supabaseUrl = String(remoteConfig.supabaseUrl || "").replace(/\/+$/, "");
  const supabaseAnonKey = String(remoteConfig.supabaseAnonKey || "");

  function getStoredSession() {
    try {
      const session = JSON.parse(sessionStorage.getItem(SESSION_KEY) || "null");
      if (!session?.token || !session?.expiresAt) return null;
      if (Date.now() >= Number(session.expiresAt)) {
        sessionStorage.removeItem(SESSION_KEY);
        return null;
      }
      return session;
    } catch {
      sessionStorage.removeItem(SESSION_KEY);
      return null;
    }
  }

  function setStoredSession(session) {
    sessionStorage.setItem(SESSION_KEY, JSON.stringify(session));
  }

  async function verifyEntryCode(code) {
    const response = await fetch(`${supabaseUrl}/functions/v1/roulette-entry-auth`, {
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
      <form id="entry-form" class="action-auth-panel" role="dialog" aria-modal="true" aria-label="입장 코드 확인">
        <h2>입장 확인</h2>
        <p>룰렛을 사용하려면 입장 코드를 입력하세요.</p>
        <input id="entry-code" type="password" autocomplete="current-password" placeholder="입장 코드" required />
        <p id="entry-error" class="auth-error" aria-live="assertive" hidden></p>
        <div class="admin-actions compact action-auth-actions">
          <button id="entry-submit" type="submit">확인</button>
        </div>
      </form>
    `;
    document.body.appendChild(overlay);
    return overlay;
  }

  async function requestSession() {
    const existing = getStoredSession();
    if (existing) return existing;

    if (!supabaseUrl || !supabaseAnonKey) {
      document.body.classList.add("event-access-ready");
      return { token: "", expiresAt: Date.now() + 60 * 60 * 1000 };
    }

    document.body.classList.add("event-access-locked");

    return new Promise((resolve) => {
      const overlay = buildOverlay();
      const form = document.getElementById("entry-form");
      const input = document.getElementById("entry-code");
      const error = document.getElementById("entry-error");
      const submit = document.getElementById("entry-submit");

      input.focus();

      form.addEventListener("submit", async (event) => {
        event.preventDefault();
        error.hidden = true;
        submit.disabled = true;

        try {
          const data = await verifyEntryCode(input.value);
          const session = {
            token: data.token,
            expiresAt: Date.now() + Number(data.expiresIn || 43200) * 1000
          };
          setStoredSession(session);
          document.body.classList.remove("event-access-locked");
          document.body.classList.add("event-access-ready");
          overlay.remove();
          resolve(session);
        } catch {
          error.textContent = "입장 코드가 올바르지 않습니다.";
          error.hidden = false;
          input.value = "";
          input.focus();
        } finally {
          submit.disabled = false;
        }
      });
    });
  }

  window.RouletteEntryAuth = {
    require: requestSession,
    getToken: async () => (await requestSession()).token
  };
})();
