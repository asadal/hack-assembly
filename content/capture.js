/**
 * content/capture.js
 * Handles the subtitle capture functionality
 */

class SubtitleCapture {
  constructor() {
    // Capture state
    this.isRunning = false;
    this.isPaused = false;
    this.captureInterval = null;
    this.autoScroll = true;

    // Captured subtitles (id -> text)
    this.subtitles = {};

    // Current session ID
    this.sessionId = "default";
  }

  /**
   * Start capturing subtitles
   */
  start() {
    // Check if we're on the right page
    if (!document.querySelector("#video_01")) {
      console.warn("Hack Assembly: 자막 추출을 위한 적절한 페이지가 아닙니다.");
      return;
    }

    // Create subtitle container if it doesn't exist
    this.createSubtitleContainer();

    // Enable AI subtitles if they're not already enabled
    const subtitleButton = document.querySelector(".player_ctrl .btn_subtit");
    if (subtitleButton) {
      subtitleButton.click();
    }

    // Start capture interval
    this.isRunning = true;
    this.isPaused = false;
    this.captureInterval = setInterval(() => this.captureSubtitles(), 1000);

    // Update badge
    chrome.runtime.sendMessage({ action: "updateBadge", status: "running" });

    // Update state
    this.saveState();
  }

  /**
   * Pause capturing subtitles
   */
  pause() {
    if (this.captureInterval) {
      clearInterval(this.captureInterval);
      this.captureInterval = null;
    }

    this.isPaused = true;

    // Update badge
    chrome.runtime.sendMessage({ action: "updateBadge", status: "paused" });

    // Save state
    this.saveState();
  }

  /**
   * Resume capturing subtitles
   */
  resume() {
    if (!this.captureInterval) {
      this.captureInterval = setInterval(() => this.captureSubtitles(), 1000);
    }

    this.isPaused = false;

    // Update badge
    chrome.runtime.sendMessage({ action: "updateBadge", status: "running" });

    // Save state
    this.saveState();
  }

  /**
   * Stop capturing subtitles
   */
  stop() {
    this.isRunning = false;
    this.isPaused = false;

    if (this.captureInterval) {
      clearInterval(this.captureInterval);
      this.captureInterval = null;
    }

    // Update badge
    chrome.runtime.sendMessage({ action: "updateBadge", status: "stopped" });

    // Save state
    this.saveState();
  }

  /**
   * Reset subtitles
   */
  reset() {
    this.subtitles = {};

    // Reset timestamps
    timestampManager.reset();

    // Clear the subtitle container
    const container = document.querySelector("#hack_title");
    if (container) {
      container.innerHTML = "";
    }

    // Save state
    this.saveState();
  }

  /**
   * Set auto-scroll state
   *
   * @param {boolean} enabled - Whether auto-scroll should be enabled
   */
  setAutoScroll(enabled) {
    this.autoScroll = enabled;
    chrome.storage.local.set({ autoScroll: enabled });
  }

  /**
   * Change the current session
   *
   * @param {string} sessionId - The session ID to switch to
   */
  changeSession(sessionId) {
    // Save current session
    this.saveSessionData();

    // Change to new session
    this.sessionId = sessionId;

    // Load session data
    this.loadSessionData();
  }

  /**
   * Save the current session data
   */
  saveSessionData() {
    chrome.storage.local.set({
      [`session_${this.sessionId}`]: {
        subtitles: this.subtitles,
        timestamps: timestampManager.timestamps,
        durations: timestampManager.durations,
      },
    });
  }

  /**
   * Load session data
   */
  loadSessionData() {
    chrome.storage.local.get([`session_${this.sessionId}`], (result) => {
      const sessionData = result[`session_${this.sessionId}`];

      if (sessionData) {
        // Restore subtitles
        this.subtitles = sessionData.subtitles || {};

        // Restore timestamps
        if (sessionData.timestamps) {
          timestampManager.timestamps = {};
          Object.entries(sessionData.timestamps).forEach(([id, timestamp]) => {
            timestampManager.timestamps[id] = new Date(timestamp);
          });
        }

        // Restore durations
        if (sessionData.durations) {
          timestampManager.durations = sessionData.durations;
        }

        // Update container
        this.updateSubtitleContainer();
      }

      // Notify popup that session data is loaded
      chrome.runtime.sendMessage({
        action: "sessionLoaded",
        sessionId: this.sessionId,
        subtitles: this.subtitles,
      });
    });
  }

  /**
   * Create subtitle container
   */
  createSubtitleContainer() {
    // Check if container already exists
    if (document.querySelector("#hack_title")) {
      return;
    }

    // Create container
    const div = document.createElement("div");
    div.id = "hack_title";
    div.style.height = "300px";
    div.style.border = "1px solid";
    div.style.background = "white";
    div.style.zIndex = "1";
    div.style.overflow = "auto";

    // Add to page
    const videoContainer = document.querySelector("#video_01");
    if (videoContainer) {
      videoContainer.appendChild(div);
      this.updateSubtitleContainer();
    }
  }

  /**
   * Update subtitle container with stored subtitles
   */
  updateSubtitleContainer() {
    const container = document.querySelector("#hack_title");
    if (!container) return;

    // Clear container
    container.innerHTML = "";

    // Add all subtitles
    Object.entries(this.subtitles).forEach(([id, text]) => {
      const p = document.createElement("p");
      p.style.lineHeight = "20px";
      p.style.fontSize = "15px";
      p.innerHTML = `<span style="color:#999;font-size:12px;">${timestampManager.getFormattedTimestamp(id)}</span> ${text}`;
      p.id = id;
      container.appendChild(p);
    });

    // Scroll to bottom if auto-scroll is enabled
    if (this.autoScroll) {
      container.scrollTop = container.scrollHeight;
    }
  }

  /**
   * Capture subtitles from the page
   */
  captureSubtitles() {
    // Get subtitle elements
    const subtitleElements = document.querySelectorAll("#viewSubtit .smi_word");

    // Process each subtitle
    subtitleElements.forEach((element) => {
      // Extract ID and text
      const id = element.className.replace("smi_word ", "");
      const text = element.innerText;

      // Check if this subtitle is new or updated
      if (this.subtitles[id] !== text) {
        // Add timestamp for new subtitles
        if (!this.subtitles[id]) {
          timestampManager.addTimestamp(id);
        }

        this.subtitles[id] = text;

        // Update subtitle container
        const container = document.querySelector("#hack_title");
        if (container) {
          let p = document.getElementById(id);

          if (p) {
            p.innerHTML = `<span style="color:#999;font-size:12px;">${timestampManager.getFormattedTimestamp(id)}</span> ${text}`;
          } else {
            p = document.createElement("p");
            p.style.lineHeight = "20px";
            p.style.fontSize = "15px";
            p.innerHTML = `<span style="color:#999;font-size:12px;">${timestampManager.getFormattedTimestamp(id)}</span> ${text}`;
            p.id = id;
            container.appendChild(p);

            // Scroll to bottom if auto-scroll is enabled
            if (this.autoScroll) {
              container.scrollTop = container.scrollHeight;
            }
          }
        }

        // Save session data
        this.saveSessionData();

        // Notify popup of updates
        chrome.runtime.sendMessage({
          action: "updateSubtitles",
          subtitles: this.subtitles,
          sessionId: this.sessionId,
        });
      }
    });
  }

  /**
   * Save current state to storage
   */
  saveState() {
    chrome.storage.local.set({
      isRunning: this.isRunning,
      isPaused: this.isPaused,
      sessionId: this.sessionId,
    });
  }
}

// Create and export the subtitle capture instance
const subtitleCapture = new SubtitleCapture();
this.subtitleCapture = subtitleCapture;
