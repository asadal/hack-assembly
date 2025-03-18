/**
 * popup/ui.js
 * Handles UI-related functionality
 */

class UIManager {
  constructor() {
    // DOM elements
    this.startButton = document.getElementById("start-button");
    this.stopButton = document.getElementById("stop-button");
    this.pinButton = document.getElementById("pin-button");
    this.lightModeBtn = document.getElementById("light-mode");
    this.darkModeBtn = document.getElementById("dark-mode");

    // UI state
    this.isRunning = false;
    this.isPaused = false;
    this.detachedWindow = null;
    this.currentTheme = "light-mode";

    // Initialize
    this.init();
  }

  /**
   * Initialize the UI manager
   */
  init() {
    // Set up event listeners
    this.startButton.addEventListener("click", () => this.toggleStartPause());
    this.stopButton.addEventListener("click", () => this.stopCapture());

    // 핀 버튼은 popup.js에서 독립적으로 처리하므로 여기서는 처리하지 않음

    this.lightModeBtn.addEventListener("click", () =>
      this.setTheme("light-mode"),
    );
    this.darkModeBtn.addEventListener("click", () =>
      this.setTheme("dark-mode"),
    );

    // Restore state from storage
    chrome.storage.local.get(["isRunning", "isPaused", "theme"], (result) => {
      if (result.isRunning !== undefined) {
        this.isRunning = result.isRunning;
      }

      if (result.isPaused !== undefined) {
        this.isPaused = result.isPaused;
      }

      this.updateButtonStates();

      if (result.theme) {
        this.setTheme(result.theme, false);
      }
    });

    // Check if detached window exists
    chrome.runtime.sendMessage({ action: "checkDetachedWindow" });

    // Listen for keyboard shortcuts
    document.addEventListener("keydown", (e) => {
      // Alt+S: Toggle Start/Pause
      if (e.altKey && e.key === "s") {
        this.toggleStartPause();
      }

      // Alt+X: Stop
      if (e.altKey && e.key === "x") {
        this.stopCapture();
      }

      // Alt+D: Save
      if (e.altKey && e.key === "d") {
        document.getElementById("save-txt").click();
      }
    });
  }

  /**
   * 시작/일시중지 토글
   */
  toggleStartPause() {
    if (!this.isRunning) {
      // 시작하기 전에 콘텐츠 스크립트 가용성 확인
      chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
        if (!tabs || tabs.length === 0) {
          console.error("활성 탭을 찾을 수 없습니다.");
          alert("활성 탭을 찾을 수 없습니다.");
          return;
        }

        // 상태 변경을 먼저 적용하고 메시지 전송
        this.isRunning = true;
        this.isPaused = false;
        this.startButton.textContent = "일시중지";
        this.stopButton.disabled = false;

        // 상태 저장
        this.saveState();

        // 메시지 전송 (새로운 함수 사용)
        utils.sendMessageToActiveTab({ action: "startCapture" }, (response) => {
          if (!response || !response.success) {
            console.error(
              "자막 추출 시작에 실패했습니다:",
              response ? response.error : "응답 없음",
            );

            // 추출 시작에 실패하면 사용자에게 알림
            if (
              confirm(
                "자막 추출을 시작할 수 없습니다. 페이지가 새로고침된 경우 확장 프로그램을 다시 로드해야 할 수 있습니다. 페이지를 새로고침하시겠습니까?",
              )
            ) {
              chrome.tabs.reload(tabs[0].id);
            } else {
              // 상태 되돌리기
              this.isRunning = false;
              this.startButton.textContent = "시작";
              this.stopButton.disabled = true;
              this.saveState();
            }
          } else {
            console.log("자막 추출 시작됨");
          }
        });
      });
    } else {
      // 토글 일시정지
      this.isPaused = !this.isPaused;
      this.startButton.textContent = this.isPaused ? "계속" : "일시중지";

      utils.sendMessageToActiveTab(
        {
          action: this.isPaused ? "pauseCapture" : "resumeCapture",
        },
        (response) => {
          if (!response || !response.success) {
            console.error(
              "자막 추출 상태 변경에 실패했습니다:",
              response ? response.error : "응답 없음",
            );
            alert(
              "자막 추출 상태 변경에 실패했습니다. 페이지를 새로고침한 후 다시 시도해 주세요.",
            );
          }
        },
      );

      // 상태 저장
      this.saveState();
    }
  }

  /**
   * Stop capturing
   */
  stopCapture() {
    this.isRunning = false;
    this.isPaused = false;
    this.startButton.textContent = "시작";
    this.stopButton.disabled = true;

    // 안전한 메시지 전송 사용
    utils.sendMessageToActiveTab({ action: "stopCapture" }, (response) => {
      if (!response) {
        console.error("자막 추출 중지에 실패했습니다.");
      }
    });

    // Save state
    this.saveState();
  }

  /**
   * Set theme
   *
   * @param {string} theme - The theme to set ('light-mode' or 'dark-mode')
   * @param {boolean} save - Whether to save the theme preference
   * @param {boolean} propagate - Whether to propagate the theme to detached window
   */
  setTheme(theme, save = true, propagate = true) {
    // 현재 테마와 같으면 처리하지 않음 (중복 호출 방지)
    if (this.currentTheme === theme) {
      console.log("이미 적용된 테마입니다:", theme);
      return;
    }

    // body 클래스 변경
    document.body.className = theme;
    this.currentTheme = theme;

    // 테마 버튼 상태 업데이트
    this.lightModeBtn.classList.toggle("active", theme === "light-mode");
    this.darkModeBtn.classList.toggle("active", theme === "dark-mode");

    console.log("테마 변경:", theme);

    // 테마 설정 저장
    if (save) {
      chrome.storage.local.set({ theme }, () => {
        console.log("테마 설정 저장됨:", theme);
      });
    }

    // 분리 창 테마 업데이트 (필요한 경우)
    if (propagate) {
      console.log("분리 창 테마 업데이트 요청");
      chrome.runtime.sendMessage(
        {
          action: "updateTheme",
          theme,
        },
        (response) => {
          // 응답 처리 (선택 사항)
          if (chrome.runtime.lastError) {
            console.log(
              "테마 업데이트 전송 오류:",
              chrome.runtime.lastError.message,
            );
          } else if (response && response.success) {
            console.log("분리 창 테마 업데이트 성공");
          }
        },
      );
    }
  }

  /**
   * Update button states based on current status
   */
  updateButtonStates() {
    if (this.isRunning) {
      this.startButton.textContent = this.isPaused ? "계속" : "일시중지";
      this.stopButton.disabled = false;
    } else {
      this.startButton.textContent = "시작";
      this.stopButton.disabled = true;
    }
  }

  /**
   * Save current state to storage
   */
  saveState() {
    chrome.storage.local.set({
      isRunning: this.isRunning,
      isPaused: this.isPaused,
    });
  }
}
