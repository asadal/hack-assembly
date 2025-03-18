/**
 * popup/subtitles.js
 * Handles subtitle management in the popup
 */

class SubtitleManager {
  constructor() {
    // DOM elements
    this.subtitlesContainer = document.getElementById("subtitles");
    this.autoScrollToggle = document.getElementById("auto-scroll-toggle");
    this.resetButton = document.getElementById("reset-button");
    this.saveTxtButton = document.getElementById("save-txt");
    this.saveSrtButton = document.getElementById("save-srt");

    // Template for creating subtitle items
    this.subtitleTemplate = document.getElementById("subtitle-template");

    // Current subtitles data
    this.subtitles = {};
    this.timestamps = {};
    this.durations = {};

    // Current search and filter criteria
    this.searchTerm = "";
    this.timeStartFilter = "";
    this.timeEndFilter = "";
    this.keywordFilter = "";

    // Initialize
    this.init();
  }

  /**
   * Initialize the subtitle manager
   */
  init() {
    // Set up event listeners
    this.autoScrollToggle.addEventListener("change", () =>
      this.toggleAutoScroll(),
    );
    this.resetButton.addEventListener("click", () => this.resetSubtitles());
    this.saveTxtButton.addEventListener("click", () => this.saveAsTxt());
    this.saveSrtButton.addEventListener("click", () => this.saveAsSrt());

    // Load auto-scroll preference
    chrome.storage.local.get(["autoScroll"], (result) => {
      if (typeof result.autoScroll !== "undefined") {
        this.autoScrollToggle.checked = result.autoScroll;
      }
    });

    // Fetch current subtitles from content script
    this.fetchSubtitles();
  }

  /**
   * Toggle auto-scroll feature
   */
  toggleAutoScroll() {
    const enabled = this.autoScrollToggle.checked;

    // 안전한 메시지 전송 사용
    utils.sendMessageToActiveTab(
      {
        action: "setAutoScroll",
        enabled,
      },
      (response) => {
        if (!response) {
          console.log("자동 스크롤 설정을 변경할 수 없습니다.");
        }
      },
    );

    // Save preference
    chrome.storage.local.set({ autoScroll: enabled });
  }

  /**
   * Reset all subtitles
   */
  resetSubtitles() {
    // Confirm before reset
    if (confirm("모든 자막을 초기화하시겠습니까?")) {
      utils.sendMessageToActiveTab({ action: "resetSubtitles" }, (response) => {
        if (response && response.success) {
          // Clear subtitles container
          this.subtitlesContainer.innerHTML = "";
          this.subtitles = {};
          this.timestamps = {};
          this.durations = {};

          // Show success notification
          utils.showNotification("자막이 초기화되었습니다.", "success");
        } else {
          console.log("자막을 초기화할 수 없습니다.");
          utils.showNotification("자막 초기화 실패", "error");
        }
      });
    }
  }

  /**
   * Save subtitles as TXT file
   */
  saveAsTxt() {
    // Check if we have subtitles
    if (Object.keys(this.subtitles).length === 0) {
      alert("저장할 자막이 없습니다.");
      return;
    }

    // Generate text content
    let content = "";

    // Sort subtitles by timestamp
    const sortedIds = Object.keys(this.subtitles).sort((a, b) => {
      const timeA = this.timestamps[a]
        ? new Date(this.timestamps[a]).getTime()
        : 0;
      const timeB = this.timestamps[b]
        ? new Date(this.timestamps[b]).getTime()
        : 0;
      return timeA - timeB;
    });

    // Format each subtitle - 시간 정보 없이 텍스트만 저장
    sortedIds.forEach((id) => {
      content += `${this.subtitles[id]}\n\n`;
    });

    // Generate filename with date and session ID
    const date = new Date().toISOString().split("T")[0];
    const sessionId = sessionManager.getCurrentSessionId();
    const filename = `hack_assembly_${sessionId}_${date}.txt`;

    // Download the file
    utils.downloadFile(content, filename);

    // Show success notification
    utils.showNotification("자막이 TXT 파일로 저장되었습니다.", "success");
  }

  /**
   * 자막을 SRT 파일로 저장
   */
  saveAsSrt() {
    // 자막이 있는지 확인
    if (Object.keys(this.subtitles).length === 0) {
      alert("저장할 자막이 없습니다.");
      return;
    }

    // 타임스탬프 디버깅 정보
    console.log("저장할 자막 수:", Object.keys(this.subtitles).length);
    console.log("타임스탬프 객체:", this.timestamps);
    console.log(
      "타임스탬프가 있는 자막 수:",
      Object.keys(this.timestamps).length,
    );

    // 타임스탬프가 없는 경우 직접 생성하는 옵션 제공
    if (Object.keys(this.timestamps).length === 0) {
      if (
        confirm(
          "타임스탬프 정보가 없습니다. 현재 시간을 기준으로 타임스탬프를 생성하시겠습니까?",
        )
      ) {
        this.generateTimestamps();
      } else {
        alert(
          "타임스탬프가 있는 자막이 없습니다. SRT 파일을 생성할 수 없습니다.",
        );
        return;
      }
    }

    try {
      // SRT 컨텐츠 생성
      let content = "";
      let index = 1;

      // 자막을 시간순으로 정렬
      const sortedIds = Object.keys(this.subtitles).sort((a, b) => {
        const timeA = this.timestamps[a]
          ? new Date(this.timestamps[a]).getTime()
          : 0;
        const timeB = this.timestamps[b]
          ? new Date(this.timestamps[b]).getTime()
          : 0;
        return timeA - timeB;
      });

      // 각 자막에 대해 SRT 포맷으로 변환
      sortedIds.forEach((id, idx) => {
        const text = this.subtitles[id];

        // 시작 시간 (현재 자막의 타임스탬프)
        const startTime = new Date(this.timestamps[id]);

        // 종료 시간 계산 (다음 자막 시작 시간 또는 +3초)
        let endTime;
        const nextId = sortedIds[idx + 1];
        if (nextId && this.timestamps[nextId]) {
          const nextStart = new Date(this.timestamps[nextId]);
          // 너무 간격이 클 경우 3초로 제한
          if (nextStart - startTime > 10000) {
            endTime = new Date(startTime.getTime() + 3000);
          } else {
            endTime = nextStart;
          }
        } else {
          // 마지막 자막은 3초 지속
          endTime = new Date(startTime.getTime() + 3000);
        }

        // SRT 포맷으로 변환
        content += `${index}\n`;
        content += `${this.formatSrtTime(startTime)} --> ${this.formatSrtTime(endTime)}\n`;
        content += `${text}\n\n`;

        index++;
      });

      // 파일 이름 생성
      const date = new Date().toISOString().split("T")[0];
      const sessionId = sessionManager.getCurrentSessionId();
      const filename = `hack_assembly_${sessionId}_${date}.srt`;

      // 파일 다운로드
      utils.downloadFile(content, filename);

      utils.showNotification("자막이 SRT 파일로 저장되었습니다.", "success");
    } catch (error) {
      console.error("SRT 저장 중 오류 발생:", error);
      alert("SRT 파일 생성 중 오류가 발생했습니다: " + error.message);
    }
  }

  /**
   * 자막에 임시 타임스탬프 생성
   */
  generateTimestamps() {
    // 현재 시간을 기준으로 시작
    let currentTime = new Date();

    // 타임스탬프 생성 - 각 자막당 3초 간격
    Object.keys(this.subtitles).forEach((id) => {
      this.timestamps[id] = new Date(currentTime);
      // 다음 자막을 위해 3초 추가
      currentTime = new Date(currentTime.getTime() + 3000);
    });

    console.log(
      "임시 타임스탬프 생성 완료:",
      Object.keys(this.timestamps).length,
    );
  }

  /**
   * Date 객체를 SRT 형식의 시간 문자열로 변환
   * @param {Date} date - 변환할 Date 객체
   * @returns {string} SRT 형식 시간 문자열 (00:00:00,000)
   */
  formatSrtTime(date) {
    if (!date || !(date instanceof Date)) {
      console.error("잘못된 날짜 객체:", date);
      return "00:00:00,000";
    }

    try {
      const hours = String(date.getHours()).padStart(2, "0");
      const minutes = String(date.getMinutes()).padStart(2, "0");
      const seconds = String(date.getSeconds()).padStart(2, "0");
      const milliseconds = String(date.getMilliseconds()).padStart(3, "0");

      return `${hours}:${minutes}:${seconds},${milliseconds}`;
    } catch (error) {
      console.error("SRT 시간 형식 변환 오류:", error);
      return "00:00:00,000";
    }
  }

  /**
   * Fetch subtitles from content script
   */
  fetchSubtitles() {
    utils.sendMessageToActiveTab({ action: "getSubtitles" }, (response) => {
      if (response && response.subtitles) {
        this.updateSubtitles(
          response.subtitles,
          response.timestamps,
          response.durations,
        );
      } else {
        console.log("자막 정보를 가져올 수 없습니다.");
        utils.showNotification("국회 의사중계시스템 페이지로 이동한 후 '시작' 버튼을 누르세요: assembly.webcast.go.kr", "info");
      }
    });
  }

  /**
   * Update subtitles data and UI
   *
   * @param {Object} subtitles - Subtitle data
   * @param {Object} timestamps - Timestamp data
   * @param {Object} durations - Duration data
   */
  updateSubtitles(subtitles, timestamps, durations) {
    this.subtitles = subtitles || {};

    // Convert timestamp strings to Date objects
    this.timestamps = {};
    if (timestamps) {
      Object.entries(timestamps).forEach(([id, timestamp]) => {
        this.timestamps[id] = new Date(timestamp);
      });
    }

    this.durations = durations || {};

    // Render subtitles
    this.renderSubtitles();
  }

  /**
   * Apply search and filters to subtitles
   *
   * @param {string} searchTerm - Search term
   * @param {string} timeStart - Start time filter
   * @param {string} timeEnd - End time filter
   * @param {string} keyword - Keyword filter
   */
  applyFilters(searchTerm, timeStart, timeEnd, keyword) {
    this.searchTerm = searchTerm || "";
    this.timeStartFilter = timeStart || "";
    this.timeEndFilter = timeEnd || "";
    this.keywordFilter = keyword || "";

    this.renderSubtitles();
  }

  /**
   * Render subtitles in the UI
   */
  renderSubtitles() {
    // Clear container
    this.subtitlesContainer.innerHTML = "";

    // Sort subtitles by timestamp
    const sortedIds = Object.keys(this.subtitles).sort((a, b) => {
      const timeA = this.timestamps[a]
        ? new Date(this.timestamps[a]).getTime()
        : 0;
      const timeB = this.timestamps[b]
        ? new Date(this.timestamps[b]).getTime()
        : 0;
      return timeA - timeB;
    });

    // Check if we have subtitles
    if (sortedIds.length === 0) {
      const emptyMessage = document.createElement("div");
      emptyMessage.className = "empty-message";
      emptyMessage.textContent = "자막이 없습니다.";
      this.subtitlesContainer.appendChild(emptyMessage);
      return;
    }

    // Create subtitle elements
    sortedIds.forEach((id) => {
      const text = this.subtitles[id];

      // Skip if doesn't match search term
      if (
        this.searchTerm &&
        !text.toLowerCase().includes(this.searchTerm.toLowerCase())
      ) {
        return;
      }

      // Skip if doesn't match keyword filter
      if (
        this.keywordFilter &&
        !utils.textIncludesKeyword(text, this.keywordFilter)
      ) {
        return;
      }

      // Skip if outside time filter range
      if (
        this.timestamps[id] &&
        (this.timeStartFilter || this.timeEndFilter) &&
        !this.isInTimeRange(id)
      ) {
        return;
      }

      // Create subtitle item from template
      const subtitleItem = this.createSubtitleElement(id, text);
      this.subtitlesContainer.appendChild(subtitleItem);
    });

    // Scroll to bottom if auto-scroll is enabled
    if (this.autoScrollToggle.checked) {
      this.scrollToBottom();
    }
  }

  /**
   * Create a subtitle element
   *
   * @param {string} id - Subtitle ID
   * @param {string} text - Subtitle text
   * @returns {HTMLElement} The created subtitle element
   */
  createSubtitleElement(id, text) {
    // Clone template
    const template = this.subtitleTemplate.content.cloneNode(true);
    const subtitleItem = template.querySelector(".subtitle-item");

    // Set ID
    subtitleItem.dataset.id = id;

    // Set timestamp if available
    const timestampElement = subtitleItem.querySelector(".subtitle-timestamp");
    if (this.timestamps[id]) {
      const formattedTime = utils.formatTimestamp(this.timestamps[id]);
      timestampElement.textContent = formattedTime;
    } else {
      timestampElement.style.display = "none";
    }

    // Set text
    const textElement = subtitleItem.querySelector(".subtitle-text");
    textElement.textContent = text;

    // Highlight search term if any
    if (this.searchTerm) {
      this.highlightSearchTerm(textElement, this.searchTerm);
    }

    return subtitleItem;
  }

  /**
   * Highlight search term in text
   *
   * @param {HTMLElement} element - The element containing text
   * @param {string} searchTerm - The search term to highlight
   */
  highlightSearchTerm(element, searchTerm) {
    if (!searchTerm) return;

    const text = element.textContent;
    const regex = new RegExp(`(${searchTerm})`, "gi");
    const highlightedText = text.replace(
      regex,
      '<span class="highlight">$1</span>',
    );

    // Only update if there are matches
    if (text !== highlightedText) {
      element.innerHTML = highlightedText;
    }
  }

  /**
   * Check if a subtitle is within the time range filter
   *
   * @param {string} id - Subtitle ID
   * @returns {boolean} True if within range or no range set
   */
  isInTimeRange(id) {
    // If no timestamp, can't filter by time
    if (!this.timestamps[id]) return true;

    const timestamp = this.timestamps[id];

    // If no time filters, everything passes
    if (!this.timeStartFilter && !this.timeEndFilter) return true;

    // Check start time
    if (this.timeStartFilter) {
      const startParts = this.timeStartFilter.split(":").map(Number);
      const startDate = new Date();
      startDate.setHours(
        startParts[0] || 0,
        startParts[1] || 0,
        startParts[2] || 0,
      );

      if (timestamp < startDate) return false;
    }

    // Check end time
    if (this.timeEndFilter) {
      const endParts = this.timeEndFilter.split(":").map(Number);
      const endDate = new Date();
      endDate.setHours(endParts[0] || 0, endParts[1] || 0, endParts[2] || 0);

      if (timestamp > endDate) return false;
    }

    return true;
  }

  /**
   * Scroll to the bottom of the subtitles container
   */
  scrollToBottom() {
    this.subtitlesContainer.scrollTop = this.subtitlesContainer.scrollHeight;
  }
}
