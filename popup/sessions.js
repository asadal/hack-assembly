/**
 * popup/sessions.js
 * Handles session management functionality
 */

class SessionManager {
  constructor() {
    // DOM elements
    this.sessionSelect = document.getElementById("session-select");
    this.newSessionButton = document.getElementById("new-session-button");
    this.sessionDialog = document.getElementById("session-dialog");
    this.sessionNameInput = document.getElementById("session-name");
    this.sessionCancelButton = document.getElementById("session-cancel");
    this.sessionCreateButton = document.getElementById("session-create");

    // Current session ID
    this.currentSessionId = "default";

    // Session list
    this.sessions = [
      {
        id: "default",
        name: "기본 세션",
      },
    ];

    // Initialize
    this.init();
  }

  /**
   * Initialize the session manager
   */
  init() {
    // Set up event listeners
    this.sessionSelect.addEventListener("change", () => this.changeSession());
    this.newSessionButton.addEventListener("click", () =>
      this.showNewSessionDialog(),
    );
    this.sessionCancelButton.addEventListener("click", () =>
      this.hideNewSessionDialog(),
    );
    this.sessionCreateButton.addEventListener("click", () =>
      this.createNewSession(),
    );

    // Handle Enter key in session name input
    this.sessionNameInput.addEventListener("keypress", (e) => {
      if (e.key === "Enter") {
        this.createNewSession();
      }
    });

    // Load session list
    this.loadSessions();
  }

  /**
   * Load sessions from storage
   */
  loadSessions() {
    chrome.storage.local.get(["sessions", "currentSessionId"], (result) => {
      if (result.sessions) {
        this.sessions = result.sessions;
      }

      if (result.currentSessionId) {
        this.currentSessionId = result.currentSessionId;
      }

      // Populate session dropdown
      this.populateSessionDropdown();

      // Set current session
      this.sessionSelect.value = this.currentSessionId;
    });
  }

  /**
   * Populate the session dropdown with options
   */
  populateSessionDropdown() {
    // Clear current options except the first one (default)
    while (this.sessionSelect.options.length > 0) {
      this.sessionSelect.remove(0);
    }

    // Add all sessions
    this.sessions.forEach((session) => {
      const option = document.createElement("option");
      option.value = session.id;
      option.textContent = session.name;
      this.sessionSelect.appendChild(option);
    });
  }

  /**
   * Show dialog to create a new session
   */
  showNewSessionDialog() {
    this.sessionDialog.classList.remove("hidden");
    this.sessionNameInput.value = "";
    this.sessionNameInput.focus();
  }

  /**
   * Hide new session dialog
   */
  hideNewSessionDialog() {
    this.sessionDialog.classList.add("hidden");
  }

  /**
   * Create a new session
   */
  createNewSession() {
    const sessionName = this.sessionNameInput.value.trim();

    if (!sessionName) {
      alert("세션 이름을 입력해주세요.");
      return;
    }

    // Check for duplicate names
    if (this.sessions.some((s) => s.name === sessionName)) {
      alert("동일한 이름의 세션이 이미 존재합니다.");
      return;
    }

    // Generate new ID
    const sessionId = "session_" + utils.generateUniqueId();

    // Add to session list
    this.sessions.push({
      id: sessionId,
      name: sessionName,
      created: new Date().toISOString(),
    });

    // Save sessions to storage
    chrome.storage.local.set({ sessions: this.sessions });

    // Update session dropdown
    this.populateSessionDropdown();

    // Switch to new session
    this.sessionSelect.value = sessionId;
    this.changeSession();

    // Hide dialog
    this.hideNewSessionDialog();

    // Show success notification
    utils.showNotification(
      `'${sessionName}' 세션이 생성되었습니다.`,
      "success",
    );
  }

  /**
   * Change to selected session
   */
  /**
   * Change to selected session
   */
  changeSession() {
    const newSessionId = this.sessionSelect.value;

    // Skip if same session
    if (newSessionId === this.currentSessionId) {
      return;
    }

    // Update current session ID
    this.currentSessionId = newSessionId;

    // Save current session ID
    chrome.storage.local.set({ currentSessionId: this.currentSessionId });

    // Notify content script using safe message sending
    utils.sendMessageToActiveTab(
      {
        action: "changeSession",
        sessionId: this.currentSessionId,
      },
      (response) => {
        if (!response || !response.success) {
          console.log("세션을 변경할 수 없습니다.");
          utils.showNotification("세션 변경 실패", "error");
        }
      },
    );

    // Reset search and filters
    if (searchManager) {
      searchManager.resetFilters();
    }

    // Show session change notification
    const sessionName = this.getSessionName(this.currentSessionId);
    utils.showNotification(
      `'${sessionName}' 세션으로 전환되었습니다.`,
      "success",
    );
  }

  /**
   * Get the name of a session by ID
   *
   * @param {string} sessionId - The session ID
   * @returns {string} The session name
   */
  getSessionName(sessionId) {
    const session = this.sessions.find((s) => s.id === sessionId);
    return session ? session.name : "알 수 없는 세션";
  }

  /**
   * Get current session ID
   *
   * @returns {string} The current session ID
   */
  getCurrentSessionId() {
    return this.currentSessionId;
  }
}
