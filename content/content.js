/**
 * content/content.js
 * 확장 프로그램의 콘텐츠 스크립트
 */

// 디버깅 로그 추가
console.log("content.js 로드됨");

// 페이지 유효성 검사 함수 개선
function isValidAssemblyPage() {
  const currentURL = window.location.href;

  // 유효한 도메인 목록 확장
  const validDomains = [
    "assembly.webcast.go.kr",
    "w3.assembly.go.kr",
    "webcast.go.kr",
    "assembly.go.kr"  // 추가: 국회 도메인 전체 포함
  ];

  // URL에 유효한 도메인이 포함되어 있는지 확인
  const isValidDomain = validDomains.some((domain) =>
    currentURL.includes(domain),
  );

  // 비디오 또는 자막 요소 선택자들
  const videoSelectors = [
    "#video_01",
    "#vod_player",
    ".video_area",
    "#viewer",
    ".media_wrap",
    ".player_area",
    ".video_player",
    ".webcast-player",
    ".player_wrap",
    "video",  // 추가: 일반 비디오 태그
    "iframe[src*='assembly']"  // 추가: 임베디드 assembly 비디오
  ];

  const subtitleSelectors = [
    "#viewSubtit .smi_word",
    ".subtitle_wrap .subtitle_text",
    ".subtitles-container .subtitle-item",
    '[class*="subtitle"]',
    '[class*="caption"]',
    '.caption',
    '.smi_word'
  ];

  // 비디오 요소 또는 자막 요소 존재 여부 확인
  const hasVideoElement = videoSelectors.some(
    (selector) => document.querySelector(selector) !== null,
  );
  const hasSubtitleElement = subtitleSelectors.some(
    (selector) => document.querySelector(selector) !== null,
  );

  // 페이지 유효성 판단 (도메인이 유효하면 일단 허용)
  const isValid = isValidDomain;

  // 상세 로깅
  console.log("페이지 유효성 검사 결과:", {
    currentURL,
    isValidDomain,
    hasVideoElement,
    hasSubtitleElement,
    isValid,
  });

  return isValid;
}

// 페이지 유효성 검사 및 오류 처리 함수
function checkPageValidity() {
  if (!isValidAssemblyPage()) {
    console.warn("유효하지 않은 페이지입니다.");

    // 알림 메시지 전송
    chrome.runtime.sendMessage({
      action: "showNotification",
      message: "국회 의사중계시스템 페이지에서만 자막 추출이 가능합니다.",
      type: "warning",
    });

    // 추가 디버깅 정보 전송
    chrome.runtime.sendMessage({
      action: "showNotification",
      message: `현재 URL: ${window.location.href}`,
      type: "info",
    });

    return false;
  }
  
  // 추가: 알림 메시지 표시 
  console.log("페이지 유효성 확인됨, 자막 추출을 시작합니다.");
  
  return true;
}

// 페이지 완전 로드 확인 함수
function isPageFullyLoaded() {
  return checkPageValidity();
}

// 안전한 매니저 초기화 함수 추가
function safeInitializeManagers() {
  console.log("safeInitializeManagers 호출됨");
  
  try {
    // subtitleCapture 초기화
    if (!window.subtitleCapture && typeof SubtitleCapture === 'function') {
      console.log("SubtitleCapture 초기화 시도");
      window.subtitleCapture = new SubtitleCapture();
      console.log("SubtitleCapture 초기화 완료");
    } else if (!window.subtitleCapture) {
      console.error("SubtitleCapture 클래스를 찾을 수 없습니다");
    }
    
    // timestampManager 초기화
    if (!window.timestampManager && typeof TimestampManager === 'function') {
      console.log("TimestampManager 초기화 시도");
      window.timestampManager = new TimestampManager();
      console.log("TimestampManager 초기화 완료");
    } else if (!window.timestampManager) {
      console.error("TimestampManager 클래스를 찾을 수 없습니다");
    }
    
    // 전역 변수 동기화 (let으로 선언하여 재할당 가능하게 함)
    try {
      // subtitleCapture가 const로 선언되어 있을 수 있으므로 try/catch 사용
      if (typeof subtitleCapture === 'undefined') {
        window.subtitleCapture = window.subtitleCapture || {};
        let subtitleCapture = window.subtitleCapture;
      }
      
      if (typeof timestampManager === 'undefined') {
        window.timestampManager = window.timestampManager || {};
        let timestampManager = window.timestampManager;
      }
    } catch (e) {
      console.log("변수 재할당 중 오류 (무시 가능):", e.message);
    }
    
    return !!window.subtitleCapture && !!window.timestampManager;
  } catch (error) {
    console.error("매니저 초기화 중 오류 발생:", error);
    return false;
  }
}

// 초기화 함수
function initialize() {
  // 페이지 유효성 확인
  if (!checkPageValidity()) {
    return;
  }

  console.log("Hack Assembly: 콘텐츠 스크립트 초기화");

  // 안전한 매니저 초기화
  safeInitializeManagers();

  // 콘텐츠 스크립트 로드 완료 알림
  chrome.runtime.sendMessage({ action: "contentScriptLoaded" });

  // 페이지 로드 즉시 자막 준비 시작
  if (subtitleCapture) {
    subtitleCapture.prepare();
  }

  // 설정 로드
  chrome.storage.local.get(["autoScroll", "sessionId"], (result) => {
    // 자동 스크롤 설정
    if (typeof result.autoScroll !== "undefined" && subtitleCapture) {
      subtitleCapture.autoScroll = result.autoScroll;
    }

    // 세션 설정
    if (result.sessionId && subtitleCapture) {
      subtitleCapture.sessionId = result.sessionId;
      subtitleCapture.loadSessionData();
    }
  });
}

// 초기화 시도 함수
function initializeWhenReady() {
  if (isPageFullyLoaded()) {
    initialize();
  } else {
    console.log("페이지 로드 대기 중...");
    setTimeout(initializeWhenReady, 500);
  }
}

// 메시지 리스너 설정
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  console.log("메시지 수신:", message.action);

  // ping 메시지 처리
  if (message.action === "ping") {
    const response = {
      status: "ok",
      hasSubtitleCapture: !!subtitleCapture,
    };
    console.log("ping 응답:", response);
    sendResponse(response);
    return true;
  }

  // subtitleCapture가 초기화되지 않았으면 초기화 시도
  if (!window.subtitleCapture) {
    console.log("subtitleCapture가 초기화되지 않았습니다. 초기화를 시도합니다.");
    try {
      // 전역 변수 초기화
      safeInitializeManagers();
      console.log("초기화 완료 상태:", !!window.subtitleCapture);
    } catch (error) {
      console.error("초기화 시도 중 오류:", error);
    }
  }

  try {
    switch (message.action) {
      case "startCapture":
        window.subtitleCapture.startCapture();
        sendResponse({ success: true });
        break;

      case "pauseCapture":
        window.subtitleCapture.pause();
        sendResponse({ success: true });
        break;

      case "resumeCapture":
        window.subtitleCapture.resume();
        sendResponse({ success: true });
        break;

      case "stopCapture":
        window.subtitleCapture.stop();
        sendResponse({ success: true });
        break;

      case "resetSubtitles":
        window.subtitleCapture.reset();
        sendResponse({ success: true });
        break;

      case "getSubtitles":
        sendResponse({
          subtitles: window.subtitleCapture.subtitles,
          timestamps: window.timestampManager ? window.timestampManager.timestamps : {},
          durations: window.timestampManager ? window.timestampManager.durations : {},
        });
        break;

      case "setAutoScroll":
        window.subtitleCapture.setAutoScroll(message.enabled);
        sendResponse({ success: true });
        break;

      case "changeSession":
        window.subtitleCapture.changeSession(message.sessionId);
        sendResponse({ success: true });
        break;

      default:
        sendResponse({ success: false, error: "알 수 없는 액션입니다" });
        break;
    }
  } catch (error) {
    console.error(`${message.action} 처리 중 오류:`, error);
    sendResponse({ success: false, error: error.message });
  }

  return true;
});

// 키보드 단축키 리스너 설정
document.addEventListener("keydown", (event) => {
  // Alt+S: 시작/일시정지 토글
  if (event.altKey && event.key === "s") {
    if (window.subtitleCapture) {
      if (!window.subtitleCapture.isRunning) {
        window.subtitleCapture.startCapture();
      } else if (window.subtitleCapture.isPaused) {
        window.subtitleCapture.resume();
      } else {
        window.subtitleCapture.pause();
      }
    } else {
      console.log("단축키 처리 실패: subtitleCapture 객체가 초기화되지 않았습니다.");
      chrome.runtime.sendMessage({
        action: "showNotification",
        message: "자막 추출 기능이 초기화되지 않았습니다. 페이지를 새로고침 해보세요.",
        type: "warning"
      });
    }
  }

  // Alt+X: 중지
  if (event.altKey && event.key === "x") {
    if (window.subtitleCapture) {
      window.subtitleCapture.stop();
    }
  }

  // Alt+D: 저장
  if (event.altKey && event.key === "d") {
    chrome.runtime.sendMessage({ action: "saveSubtitles" });
  }
});

// 페이지 로드 시 초기화 (약간의 지연 추가)
if (document.readyState === "complete") {
  console.log("페이지 이미 로드됨");
  // 약간의 지연 추가 (스크립트 로딩 시간 확보)
  setTimeout(() => {
    initializeWhenReady();
  }, 500);
} else {
  console.log("페이지 로드 대기 중");
  window.addEventListener("load", () => {
    console.log("페이지 로드됨");
    // 약간의 지연 추가 (스크립트 로딩 시간 확보)
    setTimeout(() => {
      initializeWhenReady();
    }, 500);
  });
}
