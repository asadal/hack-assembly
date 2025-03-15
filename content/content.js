/**
 * content/content.js
 * Main content script for the Hack Assembly extension
 */

// 콘텐츠 스크립트 로드 완료 알림
chrome.runtime.sendMessage({ action: "contentScriptLoaded" });

// Initialize when content script loads
chrome.storage.local.get(
  ["isRunning", "isPaused", "sessionId", "autoScroll"],
  (result) => {
    // Set auto-scroll preference
    if (typeof result.autoScroll !== "undefined") {
      subtitleCapture.autoScroll = result.autoScroll;
    }

    // Set current session
    if (result.sessionId) {
      subtitleCapture.sessionId = result.sessionId;
      subtitleCapture.loadSessionData();
    }

    // Start capture if it was running
    if (result.isRunning) {
      subtitleCapture.start();

      if (result.isPaused) {
        subtitleCapture.pause();
      }
    }
  },
);

// Listen for messages from popup or background script
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  // ping 메시지 처리 - 콘텐츠 스크립트 로드 여부 확인용
  if (message.action === "ping") {
    sendResponse({ status: "ok" });
    return true;
  }

  switch (message.action) {
    case "startCapture":
      subtitleCapture.start();
      sendResponse({ success: true });
      break;

    case "pauseCapture":
      subtitleCapture.pause();
      sendResponse({ success: true });
      break;

    case "resumeCapture":
      subtitleCapture.resume();
      sendResponse({ success: true });
      break;

    case "stopCapture":
      subtitleCapture.stop();
      sendResponse({ success: true });
      break;

    case "resetSubtitles":
      subtitleCapture.reset();
      sendResponse({ success: true });
      break;

    case "getSubtitles":
      sendResponse({
        subtitles: subtitleCapture.subtitles,
        timestamps: timestampManager.timestamps,
        durations: timestampManager.durations,
      });
      break;

    case "setAutoScroll":
      subtitleCapture.setAutoScroll(message.enabled);
      sendResponse({ success: true });
      break;

    case "changeSession":
      subtitleCapture.changeSession(message.sessionId);
      sendResponse({ success: true });
      break;
  }

  return true; // Keep the message channel open for async responses
});

// Listen for keyboard shortcuts
document.addEventListener("keydown", (event) => {
  // Alt+S: Toggle Start/Pause
  if (event.altKey && event.key === "s") {
    if (!subtitleCapture.isRunning) {
      subtitleCapture.start();
    } else if (subtitleCapture.isPaused) {
      subtitleCapture.resume();
    } else {
      subtitleCapture.pause();
    }
  }

  // Alt+X: Stop
  if (event.altKey && event.key === "x") {
    subtitleCapture.stop();
  }

  // Alt+D: Save (send message to popup to handle save)
  if (event.altKey && event.key === "d") {
    chrome.runtime.sendMessage({ action: "saveSubtitles" });
  }
});
