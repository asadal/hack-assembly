/**
 * background/background.js
 * Main background script for the Hack Assembly extension
 */

// 전역 변수
let detachedWindow = null;

// 배지 색상
const badgeColors = {
  running: "#10b981", // Green
  paused: "#f59e0b", // Yellow
  stopped: "#ef4444", // Red
  default: "#3b82f6", // Blue
};

// 배지 텍스트 값
const badgeTexts = {
  running: "ON",
  paused: "II",
  stopped: "",
  default: "",
};

// 기본 설정값
const defaultSettings = {
  isRunning: false,
  isPaused: false,
  autoScroll: true,
  theme: "light-mode",
  currentSessionId: "default",
  sessions: [
    {
      id: "default",
      name: "기본 세션",
      created: new Date().toISOString(),
    },
  ],
};

// 확장 프로그램이 설치될 때 초기화
chrome.runtime.onInstalled.addListener(() => {
  console.log("Hack Assembly extension installed");

  // 기본값으로 스토리지 초기화
  initializeStorage();

  // 기본 상태로 배지 초기화
  updateBadge("default");
});

// 기본값으로 스토리지 초기화
function initializeStorage() {
  // 스토리지가 이미 초기화되었는지 확인
  chrome.storage.local.get(["initialized"], (result) => {
    if (!result.initialized) {
      // 기본값 설정
      chrome.storage.local.set({
        ...defaultSettings,
        initialized: true,
      });

      console.log("Storage initialized with defaults");
    }
  });
}

// 확장 프로그램 배지 업데이트
function updateBadge(status) {
  // 배지 텍스트 설정
  chrome.action.setBadgeText({
    text: badgeTexts[status] || "",
  });

  // 배지 색상 설정
  chrome.action.setBadgeBackgroundColor({
    color: badgeColors[status] || badgeColors.default,
  });
}

// 알림 표시
function showNotification(message, type = "info") {
  // 알림 생성
  chrome.notifications.create({
    type: "basic",
    iconUrl: chrome.runtime.getURL("icons/icon128.png"),
    title: "Hack Assembly",
    message: message,
    priority: 1,
  });
}

// 팝업이나 콘텐츠 스크립트에서 메시지 수신
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  console.log("Background received message:", message.action);

  switch (message.action) {
    case "openDetachedWindow":
      openDetachedWindow();
      sendResponse({ success: true });
      break;

    case "checkDetachedWindow":
      sendResponse({
        detachedWindowExists: !!detachedWindow,
        detachedWindowId: detachedWindow ? detachedWindow.id : null,
      });
      break;

    case "updateDetachedWindow":
      if (message.subtitles) {
        updateDetachedWindow(message.subtitles);
        sendResponse({ success: true });
      }
      break;

    case "updateTheme":
      if (message.theme) {
        updateDetachedWindowTheme(message.theme);
        sendResponse({ success: true });
      }
      break;

    case "updateBadge":
      if (message.status) {
        updateBadge(message.status);
        sendResponse({ success: true });
      }
      break;

    case "showNotification":
      showNotification(message.message, message.type);
      sendResponse({ success: true });
      break;

    case "updateSubtitles":
      // 자막 업데이트를 모든 컨텍스트(팝업 및 분리된 창)에 전달
      forwardMessageToAllWindows(message);
      sendResponse({ success: true });
      break;

    case "contentScriptLoaded":
      console.log("Content script loaded in tab:", sender.tab.id);
      sendResponse({ success: true });
      break;

    case "ping":
      sendResponse({ status: "ok" });
      break;
  }

  return true; // 비동기 응답을 위해 메시지 채널 유지
});

// 메시지를 모든 확장 프로그램 컨텍스트에 전달
function forwardMessageToAllWindows(message) {
  // 팝업(열려있는 경우)으로 전송
  chrome.runtime.sendMessage(message).catch((err) => {
    console.log("Error forwarding to popup:", err);
  });

  // 분리된 창(열려있는 경우)으로 전송
  if (detachedWindow) {
    chrome.tabs.query({ windowId: detachedWindow.id }, (tabs) => {
      if (tabs.length > 0) {
        chrome.tabs.sendMessage(tabs[0].id, message).catch((err) => {
          console.log("Error forwarding to detached window:", err);
        });
      }
    });
  }
}

// 분리된 창 열기
function openDetachedWindow() {
  // 창이 이미 존재하는지 확인
  if (detachedWindow) {
    chrome.windows
      .update(detachedWindow.id, { focused: true })
      .then(() => {
        console.log("Detached window focused:", detachedWindow.id);
      })
      .catch((err) => {
        console.error("Error focusing detached window:", err);
        detachedWindow = null; // 창이 더 이상 존재하지 않는 경우 초기화
        openDetachedWindow(); // 다시 열기 시도
      });
    return;
  }

  // 새 창 생성
  console.log("Creating new detached window");
  chrome.windows
    .create({
      url: chrome.runtime.getURL("popup/popup.html?detached=true"),
      type: "popup",
      width: 450,
      height: 700,
    })
    .then((window) => {
      console.log("Detached window created:", window.id);
      detachedWindow = window;

      // 분리된 창이 열렸음을 팝업에 알림
      chrome.runtime
        .sendMessage({
          action: "detachedWindowOpened",
          windowId: window.id,
        })
        .catch((err) => {
          console.log("Error notifying popup about detached window:", err);
        });
    })
    .catch((err) => {
      console.error("Error creating detached window:", err);
    });
}

// 새로운 자막으로 분리된 창 업데이트
function updateDetachedWindow(subtitles) {
  if (!detachedWindow) return;

  // 분리된 창이 실제로 존재하는지 먼저 확인
  chrome.windows.get(detachedWindow.id, (windowInfo) => {
    if (chrome.runtime.lastError) {
      console.log(
        "분리된 창이 더 이상 존재하지 않습니다:",
        chrome.runtime.lastError.message,
      );
      detachedWindow = null; // 창 참조 초기화
      return;
    }

    // 창이 존재하면 메시지 전송
    chrome.tabs.query({ windowId: detachedWindow.id }, (tabs) => {
      if (tabs.length > 0) {
        chrome.tabs.sendMessage(
          tabs[0].id,
          { action: "updateSubtitles", subtitles },
          (response) => {
            // 응답 처리를 위한 빈 콜백 함수 (오류 방지)
            if (chrome.runtime.lastError) {
              console.log(
                "자막 업데이트 메시지 응답 오류:",
                chrome.runtime.lastError.message,
              );
            }
          },
        );
      }
    });
  });
}

// 분리된 창 테마 업데이트
function updateDetachedWindowTheme(theme) {
  if (!detachedWindow) return;

  // 분리된 창이 실제로 존재하는지 먼저 확인
  chrome.windows.get(detachedWindow.id, (windowInfo) => {
    if (chrome.runtime.lastError) {
      console.log(
        "분리된 창이 더 이상 존재하지 않습니다:",
        chrome.runtime.lastError.message,
      );
      detachedWindow = null; // 창 참조 초기화
      return;
    }

    // 창이 존재하면 메시지 전송
    chrome.tabs.query({ windowId: detachedWindow.id }, (tabs) => {
      if (tabs.length > 0) {
        chrome.tabs.sendMessage(
          tabs[0].id,
          { action: "updateTheme", theme },
          (response) => {
            // 응답 처리를 위한 빈 콜백 함수 (오류 방지)
            if (chrome.runtime.lastError) {
              console.log(
                "테마 업데이트 메시지 응답 오류:",
                chrome.runtime.lastError.message,
              );
            }
          },
        );
      }
    });
  });
}

// 창이 닫힐 때 처리
chrome.windows.onRemoved.addListener((windowId) => {
  if (detachedWindow && detachedWindow.id === windowId) {
    console.log("Detached window closed:", windowId);
    detachedWindow = null;

    // 분리된 창이 닫혔음을 팝업에 알림
    chrome.runtime
      .sendMessage({
        action: "detachedWindowClosed",
      })
      .catch((err) => {
        console.log("Error notifying about detached window close:", err);
      });
  }
});

// 명령(키보드 단축키) 처리
chrome.commands.onCommand.addListener((command) => {
  switch (command) {
    case "toggle-capture":
      // 활성 탭으로 전달
      chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
        if (tabs[0]) {
          chrome.storage.local.get(["isRunning", "isPaused"], (result) => {
            let action = "startCapture";

            if (result.isRunning) {
              action = result.isPaused ? "resumeCapture" : "pauseCapture";
            }

            chrome.tabs.sendMessage(tabs[0].id, { action });
          });
        }
      });
      break;

    case "stop-capture":
      // 활성 탭으로 전달
      chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
        if (tabs[0]) {
          chrome.tabs.sendMessage(tabs[0].id, { action: "stopCapture" });
        }
      });
      break;

    case "save-subtitles":
      // 자막 저장을 위해 팝업에 알림
      chrome.runtime.sendMessage({ action: "saveSubtitles" });
      break;
  }
});
