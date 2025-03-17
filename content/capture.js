/**
 * content/capture.js
 * 자막 캡처 기능을 처리하는 모듈
 */

class SubtitleCapture {
  constructor() {
    // 캡처 상태
    this.isRunning = false;
    this.isPaused = false;
    this.captureInterval = null;
    this.autoScroll = true;

    // 캡처된 자막 (id -> text)
    this.subtitles = {};

    // 현재 세션 ID
    this.sessionId = "default";
  }

  /**
   * 자막 캡처 시작
   */
  start() {
    // 현재 URL 확인
    const currentURL = window.location.href;
    let isValidPage = false;
    let videoContainer = null;

    // 특정 페이지 확인
    if (currentURL.includes("assembly.webcast.go.kr/main/pressplayer.asp")) {
      // pressplayer.asp 페이지 - 콘솔 결과에서 #video_01이 존재함
      videoContainer = document.querySelector("#video_01");
      if (videoContainer) isValidPage = true;
    }
    // w3.assembly.go.kr/vod/ 사이트인 경우
    else if (currentURL.includes("w3.assembly.go.kr/vod/")) {
      videoContainer = document.querySelector("#video_01");
      if (videoContainer) isValidPage = true;
    }
    // assembly.webcast.go.kr의 다른 페이지들
    else if (currentURL.includes("assembly.webcast.go.kr/main/")) {
      videoContainer =
        document.querySelector("#viewer") ||
        document.querySelector(".media_wrap") ||
        document.querySelector(".player_area");
      if (videoContainer) isValidPage = true;
    }

    // 적절한 페이지가 아닌 경우 경고
    if (!isValidPage) {
      console.warn("Hack Assembly: 자막 추출을 위한 적절한 페이지가 아닙니다.");
      utils.showNotification(
        "자막 추출을 위한 적절한 페이지가 아닙니다.",
        "warning",
      );
      return;
    }

    // 자막 컨테이너 생성
    this.createSubtitleContainer(videoContainer);

    // AI 자막 버튼 자동 활성화 시도
    // pressplayer.asp 페이지에 맞게 조정
    if (currentURL.includes("assembly.webcast.go.kr/main/pressplayer.asp")) {
      const subtitleButton = document.querySelector(".player_ctrl .btn_subtit");
      if (subtitleButton) {
        console.log("자막 버튼 발견, 클릭 시도");
        subtitleButton.click();
      }
    } else if (currentURL.includes("w3.assembly.go.kr/vod/")) {
      const subtitleButton = document.querySelector(".player_ctrl .btn_subtit");
      if (subtitleButton) subtitleButton.click();
    } else {
      const subtitleButton = document.querySelector(".btn_subtitle");
      if (subtitleButton) subtitleButton.click();
    }

    // 캡처 시작
    this.isRunning = true;
    this.isPaused = false;
    this.captureInterval = setInterval(() => this.captureSubtitles(), 1000);

    // 배지 업데이트
    chrome.runtime.sendMessage({ action: "updateBadge", status: "running" });

    // 상태 저장
    this.saveState();
  }

  /**
   * 자막 캡처 일시 중지
   */
  pause() {
    if (this.captureInterval) {
      clearInterval(this.captureInterval);
      this.captureInterval = null;
    }

    this.isPaused = true;

    // 배지 업데이트
    chrome.runtime.sendMessage({ action: "updateBadge", status: "paused" });

    // 상태 저장
    this.saveState();
  }

  /**
   * 자막 캡처 재개
   */
  resume() {
    if (!this.captureInterval) {
      this.captureInterval = setInterval(() => this.captureSubtitles(), 1000);
    }

    this.isPaused = false;

    // 배지 업데이트
    chrome.runtime.sendMessage({ action: "updateBadge", status: "running" });

    // 상태 저장
    this.saveState();
  }

  /**
   * 자막 캡처 중지
   */
  stop() {
    this.isRunning = false;
    this.isPaused = false;

    if (this.captureInterval) {
      clearInterval(this.captureInterval);
      this.captureInterval = null;
    }

    // 배지 업데이트
    chrome.runtime.sendMessage({ action: "updateBadge", status: "stopped" });

    // 상태 저장
    this.saveState();
  }

  /**
   * 자막 초기화
   */
  reset() {
    this.subtitles = {};

    // 타임스탬프 초기화
    timestampManager.reset();

    // 자막 컨테이너 초기화
    const container = document.querySelector("#hack_title");
    if (container) {
      container.innerHTML = "";
    }

    // 상태 저장
    this.saveState();
  }

  /**
   * 자동 스크롤 설정
   *
   * @param {boolean} enabled - 자동 스크롤 활성화 여부
   */
  setAutoScroll(enabled) {
    this.autoScroll = enabled;
    chrome.storage.local.set({ autoScroll: enabled });
  }

  /**
   * 세션 변경
   *
   * @param {string} sessionId - 변경할 세션 ID
   */
  changeSession(sessionId) {
    // 현재 세션 저장
    this.saveSessionData();

    // 새 세션으로 변경
    this.sessionId = sessionId;

    // 세션 데이터 로드
    this.loadSessionData();
  }

  /**
   * 현재 세션 데이터 저장
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
   * 세션 데이터 로드
   */
  loadSessionData() {
    chrome.storage.local.get([`session_${this.sessionId}`], (result) => {
      const sessionData = result[`session_${this.sessionId}`];

      if (sessionData) {
        // 자막 복원
        this.subtitles = sessionData.subtitles || {};

        // 타임스탬프 복원
        if (sessionData.timestamps) {
          timestampManager.timestamps = {};
          Object.entries(sessionData.timestamps).forEach(([id, timestamp]) => {
            timestampManager.timestamps[id] = new Date(timestamp);
          });
        }

        // 지속 시간 복원
        if (sessionData.durations) {
          timestampManager.durations = sessionData.durations;
        }

        // 컨테이너 업데이트
        this.updateSubtitleContainer();
      }

      // 세션 데이터가 로드되었음을 팝업에 알림
      chrome.runtime.sendMessage({
        action: "sessionLoaded",
        sessionId: this.sessionId,
        subtitles: this.subtitles,
      });
    });
  }

  /**
   * 자막 컨테이너 생성
   * @param {Element} videoContainer - 비디오 컨테이너 요소
   */
  createSubtitleContainer(videoContainer) {
    // 이미 컨테이너가 있는지 확인
    if (document.querySelector("#hack_title")) {
      return;
    }

    // 컨테이너 생성
    const div = document.createElement("div");
    div.id = "hack_title";
    div.style.height = "300px";
    div.style.border = "1px solid";
    div.style.background = "white";
    div.style.zIndex = "1";
    div.style.overflow = "auto";

    // 비디오 컨테이너에 추가
    if (videoContainer) {
      videoContainer.appendChild(div);
    } else {
      // 비디오 컨테이너를 찾을 수 없으면 body에 추가
      document.body.appendChild(div);
    }
  }

  /**
   * 자막 캡처
   * 참조 코드의 중복 처리 방식을 적용
   */
  captureSubtitles() {
    // 현재 URL에 따라 자막 요소 선택자 결정
    const currentURL = window.location.href;
    let subtitleElements = [];

    // pressplayer.asp 페이지 처리
    if (currentURL.includes("assembly.webcast.go.kr/main/pressplayer.asp")) {
      // 콘솔 확인 결과 이 선택자가 작동함
      subtitleElements = document.querySelectorAll("#viewSubtit .smi_word");

      if (subtitleElements.length === 0) {
        // 대체 선택자 시도
        subtitleElements = document.querySelectorAll("[class*='subtitle']");
      }
    }
    // 다른 페이지들 처리
    else if (currentURL.includes("w3.assembly.go.kr/vod/")) {
      // 기존 사이트의 자막 요소 선택
      subtitleElements = document.querySelectorAll("#viewSubtit .smi_word");
    } else if (currentURL.includes("assembly.webcast.go.kr/main/")) {
      // 새 사이트의 자막 요소 선택 (가능한 선택자들 시도)
      subtitleElements = document.querySelectorAll(
        ".subtitle_wrap .subtitle_text",
      );

      if (subtitleElements.length === 0) {
        subtitleElements = document.querySelectorAll(
          ".subtitles-container .subtitle-item",
        );
      }

      if (subtitleElements.length === 0) {
        subtitleElements = document.querySelectorAll("[class*='subtitle']");
      }
    }

    if (subtitleElements.length === 0) {
      console.log("자막 요소를 찾을 수 없습니다.");
      return;
    }

    console.log("자막 요소 발견:", subtitleElements.length);

    // 컨테이너 확인
    const container = document.querySelector("#hack_title");
    if (!container) {
      console.log("자막 컨테이너를 찾을 수 없습니다.");
      return;
    }

    // 각 자막 요소 처리
    subtitleElements.forEach((element) => {
      let id, text;

      // pressplayer.asp나 w3.assembly.go.kr/vod/ 페이지 처리
      if (element.className && element.className.includes("smi_word")) {
        // 원본 코드와 동일한 방식으로 ID 생성
        id = element.className.replace("smi_word ", "");
        text = element.innerText;
      } else {
        // 다른 사이트에서는 내용 기반으로 ID 생성
        text = element.innerText;
        // 내용에서 공백 제거 후 해시로 변환하여 ID 생성
        id = "subtitle_" + text.trim().replace(/\s+/g, "_").substring(0, 20);
      }

      // 자막이 비어있지 않은 경우만 처리
      if (text && text.trim().length > 0) {
        // 새 자막인 경우 타임스탬프 추가
        if (!this.subtitles[id]) {
          timestampManager.addTimestamp(id);
        }

        // 자막 저장
        this.subtitles[id] = text;

        // 자막 요소 업데이트 또는 추가 (참조 코드 방식)
        let existEl = document.getElementById(id);
        if (existEl) {
          // 기존 요소가 있으면 텍스트만 업데이트
          existEl.innerText = text;
        } else {
          // 새 요소 생성
          let p = document.createElement("p");
          p.style.lineHeight = "20px";
          p.style.fontSize = "15px";
          p.innerText = text;
          p.id = id;
          container.appendChild(p);
        }
      }
    });

    // 자동 스크롤 적용
    if (this.autoScroll) {
      container.scrollTop = container.scrollHeight;
    }

    // 세션 데이터 저장
    this.saveSessionData();

    // 팝업에 업데이트 알림
    chrome.runtime.sendMessage({
      action: "updateSubtitles",
      subtitles: this.subtitles,
      sessionId: this.sessionId,
    });
  }

  /**
   * 자막 컨테이너 업데이트
   */
  updateSubtitleContainer() {
    const container = document.querySelector("#hack_title");
    if (!container) return;

    // 기존 컨테이너 내용 비우기
    container.innerHTML = "";

    // 모든 자막 추가
    Object.entries(this.subtitles).forEach(([id, text]) => {
      const p = document.createElement("p");
      p.style.lineHeight = "20px";
      p.style.fontSize = "15px";
      p.innerText = text;
      p.id = id;
      container.appendChild(p);
    });

    // 자동 스크롤 적용
    if (this.autoScroll) {
      container.scrollTop = container.scrollHeight;
    }
  }

  /**
   * 상태 저장
   */
  saveState() {
    chrome.storage.local.set({
      isRunning: this.isRunning,
      isPaused: this.isPaused,
      sessionId: this.sessionId,
    });
  }
}

// 전역 인스턴스 생성 (중복 선언 방지)
if (typeof this.subtitleCapture === "undefined") {
  this.subtitleCapture = new SubtitleCapture();
}
