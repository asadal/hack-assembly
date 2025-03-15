/**
 * popup/popup.js
 * Main popup script for the Hack Assembly extension
 */

// Global manager instances
let subtitleManager;
let sessionManager;
let searchManager;
let uiManager;
let isDetachedWindow = false;

// 분리 창 열기 전용 함수
function openDetachedWindow() {
  console.log("분리 창 열기 함수 실행");
  chrome.runtime.sendMessage({ action: "openDetachedWindow" }, (response) => {
    console.log("분리 창 열기 응답:", response);
    if (!response || !response.success) {
      console.error("분리 창 열기 실패");
      alert("분리 창을 열 수 없습니다. 다시 시도해주세요.");
    } else {
      console.log("분리 창 열기 성공");
    }
  });
}

// 아이콘 경로 문제 해결
function fixScrollIcon() {
  // 스크롤 아이콘 요소 선택
  const scrollIcon = document.querySelector(
    ".toggle-label img[alt='자동 스크롤']",
  );

  if (scrollIcon) {
    console.log("스크롤 아이콘 요소를 찾았습니다.");

    // 기존 src 값 로깅
    console.log("기존 아이콘 경로:", scrollIcon.src);

    // 절대 경로로 변경
    const newSrc = chrome.runtime.getURL("icons/scroll.svg");
    scrollIcon.src = newSrc;
    console.log("새 아이콘 경로:", newSrc);

    // 아이콘 스타일 직접 설정
    scrollIcon.style.width = "18px";
    scrollIcon.style.height = "18px";
    scrollIcon.style.objectFit = "contain";

    // 아이콘이 로드됐는지 확인
    scrollIcon.onload = () => {
      console.log("스크롤 아이콘이 성공적으로 로드되었습니다.");
    };

    scrollIcon.onerror = (e) => {
      console.error("스크롤 아이콘 로드 실패:", e);

      // 백업 플랜: 텍스트로 대체
      const label = document.querySelector(".toggle-label");
      if (label) {
        label.removeChild(scrollIcon);
        label.textContent = "A"; // "A"uto-scroll의 A
        label.style.fontWeight = "bold";
        label.style.fontSize = "14px";
      }
    };
  } else {
    console.error("스크롤 아이콘 요소를 찾을 수 없습니다.");
  }

  // 토글 기능이 제대로 작동하는지 확인
  const autoScrollToggle = document.getElementById("auto-scroll-toggle");
  if (autoScrollToggle) {
    console.log("자동 스크롤 토글 상태:", autoScrollToggle.checked);
  } else {
    console.error("자동 스크롤 토글 요소를 찾을 수 없습니다.");
  }
}

// 페이지 로드 후 핀 버튼에 기능 연결 (독립적으로 동작)
document.addEventListener("DOMContentLoaded", () => {
  // 핀 버튼 초기화
  const pinButton = document.getElementById("pin-button");
  if (pinButton) {
    // 기존 이벤트 리스너 제거
    pinButton.replaceWith(pinButton.cloneNode(true));

    // 새 버튼 참조 가져오기
    const newPinButton = document.getElementById("pin-button");

    // 새 이벤트 리스너 등록
    newPinButton.addEventListener("click", openDetachedWindow);
    console.log("핀 버튼 이벤트 리스너 등록됨");
  }

  // 스크롤 아이콘 수정 함수 호출
  setTimeout(fixScrollIcon, 100);
});

// DOM content loaded event handler (메인 초기화)
document.addEventListener("DOMContentLoaded", async () => {
  console.log("Hack Assembly popup initialized");

  // Check if this is a detached window
  const urlParams = new URLSearchParams(window.location.search);
  isDetachedWindow = urlParams.get("detached") === "true";
  console.log("Is detached window:", isDetachedWindow);

  // If this is detached window, show indicator
  if (isDetachedWindow) {
    document.title = "Hack Assembly (Detached)";
    showDetachedIndicator();
  }

  try {
    // Check if we're on a valid page for content script
    const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
    if (tabs.length === 0) {
      showError("활성 탭을 찾을 수 없습니다.");
      return;
    }

    // Check if content script is available on this page
    const isAvailable = await utils.isContentScriptAvailable(tabs[0].id);
    if (!isAvailable && !isDetachedWindow) {
      showError(
        "이 페이지에서는 자막 추출을 사용할 수 없습니다. 국회 의사중계시스템 페이지로 이동하세요.",
      );
      disableControls();
      return;
    }

    // Initialize manager instances
    try {
      // Initialize in correct order - sessionManager first as others depend on it
      sessionManager = new SessionManager();
      subtitleManager = new SubtitleManager();
      searchManager = new SearchManager();
      uiManager = new UIManager();

      console.log("All managers initialized successfully");
    } catch (error) {
      console.error("Error initializing managers:", error);
      showError("매니저 초기화 중 오류가 발생했습니다: " + error.message);
    }

    // Setup message listeners for communication between popup and other components
    setupMessageListeners();
  } catch (error) {
    console.error("Initialization error:", error);
    showError("초기화 중 오류가 발생했습니다: " + error.message);
  }
});

/**
 * Shows a detached window indicator
 */
function showDetachedIndicator() {
  const indicator = document.createElement("div");
  indicator.style.position = "absolute";
  indicator.style.top = "2px";
  indicator.style.right = "2px";
  indicator.style.fontSize = "10px";
  indicator.style.padding = "2px 5px";
  indicator.style.borderRadius = "3px";
  indicator.style.backgroundColor = "rgba(59, 130, 246, 0.2)";
  indicator.textContent = "분리됨";
  document.body.appendChild(indicator);
}

/**
 * Shows an error message
 * @param {string} message - The error message to display
 */
function showError(message) {
  const errorElement = document.createElement("div");
  errorElement.className = "error-message";
  errorElement.style.color = "red";
  errorElement.style.padding = "10px";
  errorElement.style.margin = "10px";
  errorElement.style.textAlign = "center";
  errorElement.style.border = "1px solid red";
  errorElement.style.borderRadius = "4px";
  errorElement.textContent = message;

  // Hide main content and show error message
  const mainElement = document.querySelector("main");
  if (mainElement) {
    mainElement.style.display = "none";
  }
  document.body.appendChild(errorElement);
}

/**
 * 자막 관련 컨트롤만 비활성화하고 핀 버튼은 활성 상태로 유지
 */
function disableControls() {
  // 핀 버튼 제외하고 모든 컨트롤 비활성화
  document
    .querySelectorAll("button:not(#pin-button), input, select")
    .forEach((element) => {
      element.disabled = true;
    });

  // 핀 버튼은 명시적으로 활성 상태 유지
  const pinButton = document.getElementById("pin-button");
  if (pinButton) {
    pinButton.disabled = false;
  }

  // 오류 메시지에 분리창 이용 안내 추가
  const errorElement = document.querySelector(".error-message");
  if (errorElement) {
    const pinInfo = document.createElement("p");
    pinInfo.style.marginTop = "10px";
    pinInfo.style.fontSize = "12px";
    pinInfo.style.color = "#3b82f6";
    pinInfo.textContent = "핀 버튼을 눌러 분리 창을 열 수 있습니다.";
    errorElement.appendChild(pinInfo);
  }
}

/**
 * Checks if the popup is in detached mode
 * @returns {boolean} True if the popup is in detached mode
 */
function isDetached() {
  return isDetachedWindow;
}

/**
 * Sets up message listeners for communication
 */
function setupMessageListeners() {
  chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    console.log("Popup received message:", message.action);

    switch (message.action) {
      case "updateSubtitles":
        // Update subtitles in UI
        if (subtitleManager && message.subtitles) {
          // Only update if it's for the current session
          if (
            !message.sessionId ||
            message.sessionId === sessionManager.getCurrentSessionId()
          ) {
            subtitleManager.updateSubtitles(
              message.subtitles,
              message.timestamps,
              message.durations,
            );
          }
        }
        break;

      case "detachedWindowOpened":
        if (uiManager && !isDetachedWindow) {
          uiManager.detachedWindow = true;
          console.log("Detached window opened, ID:", message.windowId);
        }
        break;

      case "detachedWindowClosed":
        if (uiManager && !isDetachedWindow) {
          uiManager.detachedWindow = false;
          console.log("Detached window closed");
        }
        break;

      case "updateTheme":
        if (uiManager && message.theme) {
          // propagate = false로 설정하여 메시지 루프 방지
          uiManager.setTheme(message.theme, false, false);
          sendResponse({ success: true });
        } else {
          sendResponse({ success: false });
        }
        break;

      case "saveSubtitles":
        // Trigger save from keyboard shortcut
        if (subtitleManager) {
          subtitleManager.saveAsTxt();
        }
        break;

      case "sessionLoaded":
        if (subtitleManager && message.subtitles) {
          // Only update if it's for the current session
          if (message.sessionId === sessionManager.getCurrentSessionId()) {
            subtitleManager.updateSubtitles(message.subtitles);
          }
        }
        break;
    }

    return true; // Keep the message channel open for async responses
  });
}
