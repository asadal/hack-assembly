/**
 * content/content.js
 * 확장 프로그램의 콘텐츠 스크립트
 */

// 디버깅 로그 추가
console.log("content.js 로드됨");

// 페이지 유효성 검사 함수 개선
function isValidAssemblyPage() {
  try {
    const currentURL = window.location.href;

    // 유효한 도메인 목록 확장
    const validDomains = [
      "assembly.webcast.go.kr",
      "w3.assembly.go.kr",
      "webcast.go.kr",
      "assembly.go.kr", // 추가: 국회 도메인 전체 포함
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
      "video", // 추가: 일반 비디오 태그
      "iframe[src*='assembly']", // 추가: 임베디드 assembly 비디오
    ];

    const subtitleSelectors = [
      "#viewSubtit .smi_word",
      ".subtitle_wrap .subtitle_text",
      ".subtitles-container .subtitle-item",
      '[class*="subtitle"]',
      '[class*="caption"]',
      ".caption",
      ".smi_word",
    ];

    // 비디오 요소 또는 자막 요소 존재 여부 확인
    const hasVideoElement = videoSelectors.some(
      (selector) => {
        try { 
          return document.querySelector(selector) !== null;
        } catch (e) {
          console.warn(`선택자 ${selector} 조회 중 오류:`, e);
          return false;
        }
      }
    );
    
    const hasSubtitleElement = subtitleSelectors.some(
      (selector) => {
        try {
          return document.querySelector(selector) !== null;
        } catch (e) {
          console.warn(`선택자 ${selector} 조회 중 오류:`, e);
          return false;
        }
      }
    );

    // 페이지 유효성 판단 - 더 유연하게 수정
    // 일반 웹사이트에서도 작동할 수 있도록 기본값 true로 설정
    const isValid = true; // 항상 true를 반환하여 모든 페이지에서 시도

    // 상세 로깅
    console.log("페이지 유효성 검사 결과:", {
      currentURL,
      isValidDomain,
      hasVideoElement,
      hasSubtitleElement,
      isValid,
    });

    return isValid;
  } catch (error) {
    console.error("페이지 유효성 검사 중 오류:", error);
    return true; // 오류 발생 시에도 기본적으로 true 반환
  }
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
    if (!window.subtitleCapture && typeof SubtitleCapture === "function") {
      console.log("SubtitleCapture 초기화 시도");
      window.subtitleCapture = new SubtitleCapture();
      console.log("SubtitleCapture 초기화 완료");
    } else if (!window.subtitleCapture) {
      console.error("SubtitleCapture 클래스를 찾을 수 없습니다");
    }

    // timestampManager 초기화
    if (!window.timestampManager && typeof TimestampManager === "function") {
      console.log("TimestampManager 초기화 시도");
      window.timestampManager = new TimestampManager();
      console.log("TimestampManager 초기화 완료");
    } else if (!window.timestampManager) {
      console.error("TimestampManager 클래스를 찾을 수 없습니다");
    }

    // 전역 변수 동기화
    try {
      // subtitleCapture가 const로 선언되어 있을 수 있으므로 try/catch 사용
      if (typeof subtitleCapture === "undefined") {
        window.subtitleCapture = window.subtitleCapture || {};
        // 전역 스코프에 참조 할당
        this.subtitleCapture = window.subtitleCapture;
      }

      if (typeof timestampManager === "undefined") {
        window.timestampManager = window.timestampManager || {};
        // 전역 스코프에 참조 할당
        this.timestampManager = window.timestampManager;
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
  try {
    if (subtitleCapture && typeof subtitleCapture.prepare === 'function') {
      console.log("subtitleCapture.prepare() 호출 시도");
      subtitleCapture.prepare();
    } else {
      console.error("subtitleCapture가 초기화되지 않았거나 prepare 함수가 없습니다.");
    }
  } catch (error) {
    console.error("자막 준비 중 오류 발생:", error);
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
    console.log(
      "subtitleCapture가 초기화되지 않았습니다. 초기화를 시도합니다.",
    );
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
          timestamps: window.timestampManager
            ? window.timestampManager.timestamps
            : {},
          durations: window.timestampManager
            ? window.timestampManager.durations
            : {},
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
      console.log(
        "단축키 처리 실패: subtitleCapture 객체가 초기화되지 않았습니다.",
      );
      chrome.runtime.sendMessage({
        action: "showNotification",
        message:
          "자막 추출 기능이 초기화되지 않았습니다. 페이지를 새로고침 해보세요.",
        type: "warning",
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

/**
 * 확장 프로그램 컨텍스트 상태 확인 및 복구 시도 함수
 * content.js 파일에 추가
 */
function checkExtensionContext() {
  // 컨텍스트 유효성 확인
  let isContextValid = true;

  try {
    // chrome 객체 존재 여부 확인
    if (!chrome || !chrome.runtime) {
      isContextValid = false;
    } else {
      // 실제 메시지 전송 시도를 통한 확인
      chrome.runtime.sendMessage({ action: "ping" }, (response) => {
        if (chrome.runtime.lastError) {
          console.warn(
            "확장 프로그램 컨텍스트 무효:",
            chrome.runtime.lastError.message,
          );
          isContextValid = false;
          handleInvalidContext();
        } else {
          console.log("확장 프로그램 컨텍스트 유효");
        }
      });
    }
  } catch (error) {
    console.error("컨텍스트 확인 중 오류:", error);
    isContextValid = false;
    handleInvalidContext();
  }

  return isContextValid;
}

/**
 * 무효화된 컨텍스트 처리
 */
function handleInvalidContext() {
  console.warn("확장 프로그램 컨텍스트가 무효화되었습니다. 복구를 시도합니다.");

  // 임시 저장된 데이터가 있는지 확인
  try {
    const tempData = localStorage.getItem("hack_assembly_temp_data");
    if (tempData) {
      console.log("로컬 스토리지에서 임시 데이터를 찾았습니다:", tempData);

      // 사용자에게 알림 (DOM에 메시지 표시)
      showContextErrorMessage();
    }
  } catch (error) {
    console.error("임시 데이터 검색 중 오류:", error);
  }
}

/**
 * 컨텍스트 오류 메시지를 화면에 표시
 */
function showContextErrorMessage() {
  // 기존 메시지가 있으면 제거
  const existingMsg = document.getElementById("hack_assembly_error_msg");
  if (existingMsg) {
    existingMsg.remove();
  }

  // 새 메시지 요소 생성
  const msgElement = document.createElement("div");
  msgElement.id = "hack_assembly_error_msg";
  msgElement.style.position = "fixed";
  msgElement.style.top = "10px";
  msgElement.style.right = "10px";
  msgElement.style.backgroundColor = "rgba(220, 53, 69, 0.9)";
  msgElement.style.color = "white";
  msgElement.style.padding = "10px 15px";
  msgElement.style.borderRadius = "5px";
  msgElement.style.zIndex = "9999";
  msgElement.style.boxShadow = "0 2px 10px rgba(0,0,0,0.2)";
  msgElement.style.fontSize = "14px";
  msgElement.style.maxWidth = "300px";

  msgElement.innerHTML = `
    <strong>Hack Assembly 알림</strong>
    <p>확장 프로그램 컨텍스트가 무효화되었습니다. 다음 방법을 시도해 보세요:</p>
    <ol style="margin: 5px 0; padding-left: 20px;">
      <li>페이지 새로고침</li>
      <li>확장 프로그램 재활성화</li>
    </ol>
    <button id="hack_assembly_reload_btn" style="background: white; color: #dc3545; border: none; padding: 3px 8px; border-radius: 3px; cursor: pointer; margin-top: 5px;">페이지 새로고침</button>
  `;

  document.body.appendChild(msgElement);

  // 새로고침 버튼에 이벤트 리스너 추가
  document
    .getElementById("hack_assembly_reload_btn")
    .addEventListener("click", () => {
      location.reload();
    });

  // 10초 후 메시지 자동 숨김
  setTimeout(() => {
    if (msgElement.parentNode) {
      msgElement.style.opacity = "0";
      msgElement.style.transition = "opacity 0.5s";

      setTimeout(() => {
        if (msgElement.parentNode) {
          msgElement.remove();
        }
      }, 500);
    }
  }, 10000);
}

// 주기적으로 컨텍스트 상태 확인 (5분마다)
setInterval(checkExtensionContext, 300000);

// 페이지 로드 시 한 번 확인
if (document.readyState === "complete") {
  setTimeout(checkExtensionContext, 2000);
} else {
  window.addEventListener("load", () => {
    setTimeout(checkExtensionContext, 2000);
  });
}
