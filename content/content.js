/**
 * content/content.js
 * 확장 프로그램의 콘텐츠 스크립트
 */

/**
 * 페이지가 완전히 로드되었는지 확인하는 함수
 */
function isPageFullyLoaded() {
  const currentURL = window.location.href;

  // pressplayer.asp 페이지 처리
  if (currentURL.includes("assembly.webcast.go.kr/main/pressplayer.asp")) {
    const videoEl = document.querySelector("#video_01");
    if (videoEl) {
      console.log("pressplayer.asp 페이지의 비디오 요소 감지됨");
      return true;
    }
  }
  // 다른 페이지들 처리
  else if (currentURL.includes("w3.assembly.go.kr/vod/")) {
    return !!document.querySelector("#video_01");
  } else if (currentURL.includes("assembly.webcast.go.kr/main/")) {
    return !!(
      document.querySelector("#viewer") ||
      document.querySelector(".media_wrap") ||
      document.querySelector(".player_area")
    );
  }

  return false;
}

// 페이지 로드 완료 시 초기화
function initializeWhenReady() {
  if (isPageFullyLoaded()) {
    // 페이지가 준비되었으면 초기화
    initialize();
  } else {
    // 페이지가 아직 준비되지 않았으면 일정 시간 후 다시 시도
    setTimeout(initializeWhenReady, 500);
  }
}

// 초기화 함수
function initialize() {
  console.log("Hack Assembly: 콘텐츠 스크립트 초기화");

  // 콘텐츠 스크립트 로드 완료 알림
  chrome.runtime.sendMessage({ action: "contentScriptLoaded" });

  // 설정 로드
  chrome.storage.local.get(
    ["isRunning", "isPaused", "sessionId", "autoScroll"],
    (result) => {
      // 자동 스크롤 설정
      if (typeof result.autoScroll !== "undefined") {
        subtitleCapture.autoScroll = result.autoScroll;
      }

      // 세션 설정
      if (result.sessionId) {
        subtitleCapture.sessionId = result.sessionId;
        subtitleCapture.loadSessionData();
      }

      // 이전에 실행 중이었으면 자동 시작
      if (result.isRunning) {
        subtitleCapture.start();

        if (result.isPaused) {
          subtitleCapture.pause();
        }
      }
    },
  );
}

// 메시지 리스너 설정
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

  return true; // 비동기 응답을 위해 메시지 채널 유지
});

// 키보드 단축키 리스너 설정
document.addEventListener("keydown", (event) => {
  // Alt+S: 시작/일시정지 토글
  if (event.altKey && event.key === "s") {
    if (!subtitleCapture.isRunning) {
      subtitleCapture.start();
    } else if (subtitleCapture.isPaused) {
      subtitleCapture.resume();
    } else {
      subtitleCapture.pause();
    }
  }

  // Alt+X: 중지
  if (event.altKey && event.key === "x") {
    subtitleCapture.stop();
  }

  // Alt+D: 저장
  if (event.altKey && event.key === "d") {
    chrome.runtime.sendMessage({ action: "saveSubtitles" });
  }
});

// DOM 변화 감지
let domObserver = null;

function setupDOMObserver() {
  // 이미 Observer가 있으면 중단
  if (domObserver) return;

  // DOM 변화 감지를 위한 MutationObserver 설정
  domObserver = new MutationObserver((mutations) => {
    // 페이지가 로드되었는지 확인
    if (isPageFullyLoaded() && !subtitleCapture.isRunning) {
      // 페이지가 로드되었고 캡처가 실행 중이 아니면 초기화
      initialize();
      // Observer 중단 (더 이상 필요 없음)
      domObserver.disconnect();
      domObserver = null;
    }
  });

  // 문서 전체 변화 감지
  domObserver.observe(document.documentElement, {
    childList: true,
    subtree: true,
  });
}

// 페이지 로드 시 초기화
if (document.readyState === "complete") {
  initializeWhenReady();
} else {
  window.addEventListener("load", initializeWhenReady);
  // 로드 이벤트를 놓치지 않기 위해 DOM 변화도 감시
  setupDOMObserver();
}
