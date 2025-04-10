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
      // utils의 formatSrtTimestamp 함수 사용
      return utils.formatSrtTimestamp(date);
    } catch (error) {
      console.error("SRT 시간 형식 변환 오류:", error);
      return "00:00:00,000";
    }
  }

  /**
   * 자막 캡처 시작
   */
  start() {
    // 현재 URL 확인
    const currentURL = window.location.href;
    let isValidPage = false;
    let videoContainer = null;

    // player.asp 페이지 처리 추가
    if (currentURL.includes("assembly.webcast.go.kr/main/player.asp")) {
      // player.asp 페이지의 비디오 요소 찾기
      videoContainer =
        document.querySelector("#video_01") ||
        document.querySelector("#vod_player") ||
        document.querySelector(".video_area");
      if (videoContainer) isValidPage = true;
    }
    // pressplayer.asp 페이지 처리
    else if (
      currentURL.includes("assembly.webcast.go.kr/main/pressplayer.asp")
    ) {
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
    // 추가: assembly.go.kr 도메인의 다른 페이지들 허용
    else if (currentURL.includes("assembly.go.kr")) {
      videoContainer =
        document.querySelector("video") ||
        document.querySelector("iframe") ||
        document.body; // 최후의 수단으로 body 사용
      isValidPage = true; // 도메인이 맞으면 일단 허용
    }

    // 적절한 페이지가 아닌 경우에도 덜 제한적으로 동작
    if (!isValidPage) {
      console.warn(
        "Hack Assembly: 국회 의사중계시스템 페이지가 아니지만 계속 진행합니다.",
      );
      utils.showNotification(
        "국회 웹사이트로 이동하여 자막 추출을 사용하세요: assembly.webcast.go.kr",
        "info",
      );

      // 어떤 페이지든 body는 있으므로 최소한의 컨테이너로 사용
      videoContainer = document.body;
    }

    // 자막 컨테이너 생성
    this.createSubtitleContainer(videoContainer);

    // 자막 활성화 함수 호출 (실행되어 있지 않은 경우 자동으로 활성화)
    this.activateSubtitlesIfNeeded();

    // 캡처를 바로 시작하지 않고 준비 상태로 설정
    this.isRunning = false; // 아직 실행 중이 아님
    this.isPaused = false;

    // 상태 저장
    this.saveState();

    // 준비 완료 알림
    utils.showNotification(
      "자막 추출 준비가 완료되었습니다. '시작' 버튼을 눌러 추출을 시작하세요.",
      "success",
    );
  }

  /**
   * 자막 기능이 활성화되어 있지 않으면 활성화
   */
  activateSubtitlesIfNeeded() {
    const currentURL = window.location.href;

    // 자막이 이미 활성화되어 있는지 확인
    let subtitlesActive = false;

    if (currentURL.includes("assembly.webcast.go.kr/main/pressplayer.asp")) {
      // 자막 요소 확인
      subtitlesActive =
        document.querySelectorAll("#viewSubtit .smi_word").length > 0 ||
        document.querySelectorAll("[class*='subtitle']").length > 0;

      if (!subtitlesActive) {
        // 자막 버튼 클릭 (모든 가능한 선택자 시도)
        const subtitleButtons = [
          ".player_ctrl .btn_subtit",
          ".subtitle_area .btn_subtit",
          ".btn_subtitle",
        ];

        for (const selector of subtitleButtons) {
          const button = document.querySelector(selector);
          if (button) {
            console.log(`자막 버튼 발견 (${selector}), 클릭 시도`);
            button.click();

            // 버튼 클릭 후 활성화 확인
            setTimeout(() => {
              const active =
                document.querySelectorAll("#viewSubtit .smi_word").length > 0 ||
                document.querySelectorAll("[class*='subtitle']").length > 0;
              console.log(
                "자막 활성화 상태:",
                active ? "활성화됨" : "비활성화됨",
              );
            }, 1000);

            break;
          }
        }
      } else {
        console.log("자막이 이미 활성화되어 있습니다.");
      }
    } else if (currentURL.includes("w3.assembly.go.kr/vod/")) {
      const subtitleButton = document.querySelector(".player_ctrl .btn_subtit");
      if (subtitleButton) subtitleButton.click();
    } else {
      const subtitleButton = document.querySelector(".btn_subtitle");
      if (subtitleButton) subtitleButton.click();
    }
  }

  /**
   * 자막 추출 준비만 수행 (자막 컨테이너는 생성하지 않음)
   */
  prepare() {
    // 현재 URL 확인
    const currentURL = window.location.href;
    let isValidPage = false;
    let videoContainer = null;

    // 페이지 유효성 확인 (기존 코드와 동일)
    if (currentURL.includes("assembly.webcast.go.kr/main/player.asp")) {
      videoContainer =
        document.querySelector("#video_01") ||
        document.querySelector("#vod_player") ||
        document.querySelector(".video_area");
      if (videoContainer) isValidPage = true;
    } else if (
      currentURL.includes("assembly.webcast.go.kr/main/pressplayer.asp")
    ) {
      videoContainer = document.querySelector("#video_01");
      if (videoContainer) isValidPage = true;
    } else if (currentURL.includes("w3.assembly.go.kr/vod/")) {
      videoContainer = document.querySelector("#video_01");
      if (videoContainer) isValidPage = true;
    } else if (currentURL.includes("assembly.webcast.go.kr/main/")) {
      videoContainer =
        document.querySelector("#viewer") ||
        document.querySelector(".media_wrap") ||
        document.querySelector(".player_area");
      if (videoContainer) isValidPage = true;
    }
    // 추가: assembly.go.kr 도메인의 다른 페이지들 허용
    else if (currentURL.includes("assembly.go.kr")) {
      videoContainer =
        document.querySelector("video") ||
        document.querySelector("iframe") ||
        document.body; // 최후의 수단으로 body 사용
      isValidPage = true; // 도메인이 맞으면 일단 허용
    }

    // 적절한 페이지가 아닌 경우에도 덜 제한적으로 동작
    if (!isValidPage) {
      console.warn(
        "Hack Assembly: 국회 의사중계시스템 페이지가 아니지만 계속 진행합니다.",
      );
      
      try {
        // utils 객체가 존재하는지 안전하게 확인하고 호출
        if (window.utils && typeof window.utils.showNotification === 'function') {
          window.utils.showNotification(
            "국회 웹사이트로 이동하여 자막 추출을 사용하세요: assembly.webcast.go.kr",
            "info",
          );
        } else {
          console.warn("utils 객체를 찾을 수 없어 알림을 표시할 수 없습니다.");
          // 크롬 확장 API 직접 사용 시도
          chrome.runtime.sendMessage({
            action: "showNotification",
            message: "국회 웹사이트로 이동하여 자막 추출을 사용하세요: assembly.webcast.go.kr",
            type: "info",
          });
        }
      } catch (e) {
        console.error("알림 메시지 전송 실패:", e);
      }

      // 어떤 페이지든 body는 있으므로 최소한의 컨테이너로 사용
      videoContainer = document.body;
    }

    // 자막 컨테이너는 생성하지 않고 저장만 함
    this.videoContainer = videoContainer;

    // 캡처 상태 설정 - 실행은 하지 않음
    this.isRunning = false;
    this.isPaused = false;

    // 상태 저장
    this.saveState();

    // 준비 완료 알림
    utils.showNotification(
      "자막 추출 준비가 완료되었습니다. '시작' 버튼을 눌러 추출을 시작하세요.",
      "success",
    );
  }

  /**
   * 실제 캡처 시작 (시작 버튼 클릭 시 호출)
   */
  startCapture() {
    // 이미 실행 중이면 중단
    if (this.isRunning && !this.isPaused) return;

    // 자막 컨테이너 생성 (시작할 때만 생성)
    this.createSubtitleContainer(this.videoContainer);

    // AI 자막 활성화 여부 확인 및 활성화
    this.ensureSubtitlesEnabled().then((enabled) => {
      if (!enabled) {
        utils.showNotification(
          "AI 자막을 활성화할 수 없습니다. 페이지를 확인해주세요.",
          "error",
        );
        // 실패한 경우 생성한 컨테이너 제거
        this.removeSubtitleContainer();
        return;
      }

      // 캡처 시작
      this.isRunning = true;
      this.isPaused = false;
      this.captureInterval = setInterval(() => this.captureSubtitles(), 1000);

      // 배지 업데이트
      chrome.runtime.sendMessage({ action: "updateBadge", status: "running" });

      // 상태 저장
      this.saveState();

      utils.showNotification("자막 추출이 시작되었습니다.", "success");
    });
  }

  /**
   * AI 자막이 활성화되어 있는지 확인하고, 필요시 활성화
   * @returns {Promise<boolean>} 자막 활성화 성공 여부
   */
  ensureSubtitlesEnabled() {
    return new Promise((resolve) => {
      const currentURL = window.location.href;

      // 자막이 이미 활성화되어 있는지 확인
      const checkSubtitlesActive = () => {
        if (currentURL.includes("assembly.webcast.go.kr/main/")) {
          return (
            document.querySelectorAll("#viewSubtit .smi_word").length > 0 ||
            document.querySelectorAll("[class*='subtitle']").length > 0
          );
        }
        return false;
      };

      // 자막이 이미 활성화되어 있으면 바로 성공 반환
      if (checkSubtitlesActive()) {
        console.log("자막이 이미 활성화되어 있습니다.");
        resolve(true);
        return;
      }

      // 자막 버튼 찾기 및 클릭
      let buttonClicked = false;

      if (
        currentURL.includes("assembly.webcast.go.kr/main/pressplayer.asp") ||
        currentURL.includes("assembly.webcast.go.kr/main/player.asp")
      ) {
        // 가능한 자막 버튼 선택자들
        const subtitleButtons = [
          ".player_ctrl .btn_subtit",
          ".subtitle_area .btn_subtit",
          ".btn_subtitle",
          "[class*='subtitle-btn']",
          "button:contains('자막')",
        ];

        for (const selector of subtitleButtons) {
          try {
            const button = document.querySelector(selector);
            if (button) {
              console.log(`자막 버튼 발견 (${selector}), 클릭 시도`);
              button.click();
              buttonClicked = true;
              break;
            }
          } catch (e) {
            console.error(`선택자 ${selector} 처리 중 오류:`, e);
          }
        }
      } else if (currentURL.includes("w3.assembly.go.kr/vod/")) {
        const subtitleButton = document.querySelector(
          ".player_ctrl .btn_subtit",
        );
        if (subtitleButton) {
          subtitleButton.click();
          buttonClicked = true;
        }
      }

      // 버튼을 찾지 못했거나 클릭할 수 없으면 실패
      if (!buttonClicked) {
        console.warn("자막 버튼을 찾을 수 없습니다.");
        resolve(false);
        return;
      }

      // 버튼을 클릭한 후 자막이 활성화되었는지 확인 (최대 5초 대기)
      let checkCount = 0;
      const maxChecks = 10; // 5초 (500ms * 10)

      const checkInterval = setInterval(() => {
        if (checkSubtitlesActive()) {
          clearInterval(checkInterval);
          console.log("자막이 성공적으로 활성화되었습니다.");
          resolve(true);
          return;
        }

        checkCount++;
        if (checkCount >= maxChecks) {
          clearInterval(checkInterval);
          console.warn("자막 활성화 시간 초과");
          resolve(false);
        }
      }, 500);
    });
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

    // 자막 컨테이너 제거
    this.removeSubtitleContainer();

    // 배지 업데이트
    chrome.runtime.sendMessage({ action: "updateBadge", status: "stopped" });

    // 상태 저장
    this.saveState();
  }

  /**
   * 자막 컨테이너 제거
   */
  removeSubtitleContainer() {
    const container = document.querySelector("#hack_title");
    if (container) {
      container.remove();
    }
  }

  /**
   * 자막 초기화
   */
  reset() {
    this.subtitles = {};

    // 타임스탬프 초기화
    if (window.timestampManager) {
      window.timestampManager.reset();
    }

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
   * 확장 프로그램 컨텍스트 무효화 오류 처리 추가
   */
  saveSessionData() {
    try {
      // 타임스탬프 객체 존재 여부 확인 (안전한 접근)
      let timestamps = {};
      let durations = {};

      // window.timestampManager가 존재하는지 확인
      if (
        window.timestampManager &&
        typeof window.timestampManager === "object"
      ) {
        // timestamps 속성이 존재하는지 확인
        if (window.timestampManager.timestamps) {
          timestamps = window.timestampManager.timestamps;
        }

        // durations 속성이 존재하는지 확인
        if (window.timestampManager.durations) {
          durations = window.timestampManager.durations;
        }
      }

      // 확장 프로그램 컨텍스트 유효성 검사
      if (typeof chrome === 'undefined' || typeof chrome.runtime === 'undefined' || typeof chrome.storage === 'undefined') {
        console.warn("확장 프로그램 컨텍스트가 유효하지 않음, 저장 건너뜀");
        return;
      }

      // 세션 데이터를 스토리지에 저장
      chrome.storage.local.set(
        {
          [`session_${this.sessionId}`]: {
            subtitles: this.subtitles,
            timestamps: timestamps,
            durations: durations,
          },
        },
        () => {
          // 저장 완료 후 chrome.runtime.lastError 확인
          if (chrome.runtime && chrome.runtime.lastError) {
            console.warn(
              "세션 데이터 저장 중 오류:",
              chrome.runtime.lastError.message,
            );
            return;
          }

          console.log(
            `세션 데이터 저장 완료: ${this.sessionId}, 자막 수: ${Object.keys(this.subtitles).length}`,
          );
        },
      );
    } catch (error) {
      console.error("세션 데이터 저장 중 오류 발생:", error);

      // extension context invalidated 오류인 경우 특별 처리
      if (
        error.message &&
        error.message.includes("Extension context invalidated")
      ) {
        console.warn(
          "확장 프로그램 컨텍스트가 무효화되었습니다. 새로고침이 필요할 수 있습니다.",
        );

        // 로컬 스토리지에 임시 저장 시도 (fallback)
        try {
          const tempData = JSON.stringify({
            subtitles: this.subtitles,
            timestamp: new Date().toISOString(),
            sessionId: this.sessionId,
          });
          localStorage.setItem("hack_assembly_temp_data", tempData);
          console.log("자막 데이터를 로컬 스토리지에 임시 저장했습니다.");
        } catch (localStorageError) {
          console.error("로컬 스토리지 저장 실패:", localStorageError);
        }
      }
    }
  }

  /**
   * 자막 캡처 - 중복 자막 및 "로딩중.." 문제 해결
   */
  captureSubtitles() {
    try {
      // 현재 URL에 따라 자막 요소 선택자 결정
      const currentURL = window.location.href;
      let subtitleElements = [];

      // 특히 #viewSubtit 영역 자막 처리를 위한 변수들
      let viewSubtitElements = document.querySelectorAll(
        "#viewSubtit .smi_word",
      );

      // 자막 컨테이너 확인
      const container = document.querySelector("#hack_title");
      if (!container) {
        console.log("자막 컨테이너를 찾을 수 없습니다. 다시 생성합니다.");
        if (this.videoContainer) {
          this.createSubtitleContainer(this.videoContainer);
        }
        return;
      }

      // #viewSubtit 영역 자막 처리 (개선된 방식)
      if (viewSubtitElements && viewSubtitElements.length > 0) {
        viewSubtitElements.forEach((element) => {
          // 원본 코드와 동일한 방식으로 ID 생성
          const id = element.className.replace("smi_word ", "");

          // 자막 텍스트 가져오기
          let text = element.innerText;

          // "로딩중.." 텍스트 제거
          text = text.replace(/^로딩중\.\.\s*/g, "");

          // 텍스트가 비어있지 않은 경우만 처리
          if (text && text.trim().length > 0) {
            // 줄바꿈 제거 및 공백 정리
            text = text
              .replace(/\r?\n|\r/g, " ")
              .trim()
              .replace(/\s+/g, " ");

            // 새 자막인 경우만 등록 (같은 ID에 대해 내용이 바뀐 경우 업데이트)
            if (!this.subtitles[id] || this.subtitles[id] !== text) {
              // 새 자막인 경우 타임스탬프 추가
              if (
                !this.subtitles[id] &&
                window.timestampManager &&
                typeof window.timestampManager.addTimestamp === "function"
              ) {
                try {
                  window.timestampManager.addTimestamp(id);
                } catch (error) {
                  console.error("타임스탬프 추가 중 오류:", error);
                }
              }

              // 자막 저장
              this.subtitles[id] = text;

              // 자막 요소 업데이트 또는 추가
              let existEl = document.getElementById(id);
              if (existEl) {
                // 기존 요소가 있으면 텍스트만 업데이트
                existEl.innerText = text;
              } else {
                // 새 요소 생성
                let p = document.createElement("p");
                p.style.lineHeight = "20px";
                p.style.fontSize = "15px";
                p.style.margin = "0 0 4px 0";
                p.innerText = text;
                p.id = id;
                container.appendChild(p);
              }
            }
          }
        });
      } else {
        // 다른 선택자로 자막 찾기
        if (currentURL.includes("assembly.webcast.go.kr/main/player.asp")) {
          subtitleElements = document.querySelectorAll(
            ".caption_area .caption_text, [class*='subtitle'], [class*='caption']",
          );
        } else if (
          currentURL.includes("assembly.webcast.go.kr/main/pressplayer.asp")
        ) {
          subtitleElements = document.querySelectorAll("#viewSubtit .smi_word");
        } else if (currentURL.includes("assembly.webcast.go.kr/main/")) {
          subtitleElements = document.querySelectorAll(
            ".subtitle_wrap .subtitle_text, .subtitles-container .subtitle-item, [class*='subtitle']",
          );
        }

        // 다른 자막 요소 처리
        if (subtitleElements.length > 0) {
          subtitleElements.forEach((element) => {
            // 다른 사이트에서는 내용 기반으로 ID 생성
            let text = element.innerText;

            // "로딩중.." 텍스트 제거
            text = text.replace(/^로딩중\.\.\s*/g, "");

            if (text && text.trim().length > 0) {
              // 줄바꿈 제거 및 공백 처리
              text = text
                .replace(/\r?\n|\r/g, " ")
                .trim()
                .replace(/\s+/g, " ");

              // 일관된 ID 생성
              const id =
                "subtitle_" + text.trim().replace(/\s+/g, "_").substring(0, 20);

              // 중복 방지: 같은 ID에 대해 내용이 바뀐 경우만 업데이트
              if (!this.subtitles[id] || this.subtitles[id] !== text) {
                // 새 자막인 경우 타임스탬프 추가
                if (
                  !this.subtitles[id] &&
                  window.timestampManager &&
                  typeof window.timestampManager.addTimestamp === "function"
                ) {
                  try {
                    window.timestampManager.addTimestamp(id);
                  } catch (error) {
                    console.error("타임스탬프 추가 중 오류:", error);
                  }
                }

                // 자막 저장
                this.subtitles[id] = text;

                // UI에 자막 추가
                let existEl = document.getElementById(id);
                if (existEl) {
                  existEl.innerText = text;
                } else {
                  let p = document.createElement("p");
                  p.style.lineHeight = "20px";
                  p.style.fontSize = "15px";
                  p.style.margin = "0 0 4px 0";
                  p.innerText = text;
                  p.id = id;
                  container.appendChild(p);
                }
              }
            }
          });
        }
      }

      // 마지막 부분에서 자동 스크롤 즉시 적용
      if (this.autoScroll && container) {
        container.scrollTop = container.scrollHeight;

        // 약간의 딜레이 후 한 번 더 스크롤 (DOM 업데이트 완료 후)
        setTimeout(() => {
          container.scrollTop = container.scrollHeight;
        }, 50);
      }

      // 세션 데이터 저장
      this.saveSessionData();

      // 확장 프로그램 컨텍스트 유효성 검사
      try {
        // chrome과 runtime 객체가 있는지 확인
        if (typeof chrome === 'undefined' || typeof chrome.runtime === 'undefined') {
          console.warn(
            "확장 프로그램 컨텍스트가 유효하지 않음, 메시지 전송 건너뜀",
          );
          return;
        }

        // 팝업에 업데이트 알림
        chrome.runtime.sendMessage(
          {
            action: "updateSubtitles",
            subtitles: this.subtitles,
            sessionId: this.sessionId,
            timestamps: window.timestampManager
              ? window.timestampManager.timestamps
              : {},
            durations: window.timestampManager
              ? window.timestampManager.durations
              : {},
          },
          (response) => {
            // 메시지 전송 후 오류 확인
            if (chrome.runtime && chrome.runtime.lastError) {
              console.warn(
                "메시지 전송 중 오류:",
                chrome.runtime.lastError.message,
              );
            }
          },
        );
      } catch (error) {
        console.error("자막 업데이트 전송 중 오류:", error);

        // 확장 프로그램 컨텍스트 오류인 경우 특별 처리
        if (
          error.message &&
          error.message.includes("Extension context invalidated")
        ) {
          console.warn(
            "확장 프로그램 컨텍스트가 무효화되었습니다. 새로고침 또는 재활성화가 필요합니다.",
          );
        }
      }
    } catch (error) {
      console.error("자막 캡처 중 오류 발생:", error);
    }
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
   * 이미 캡처된 자막에서 줄바꿈을 제거하고 모든 자막을 정리합니다.
   */
  cleanupExistingSubtitles() {
    // 기존 자막의 줄바꿈 제거
    Object.entries(this.subtitles).forEach(([id, text]) => {
      // 줄바꿈 제거 및 공백 정리
      const cleanedText = text
        .replace(/\r?\n|\r/g, " ")
        .trim()
        .replace(/\s+/g, " ");
      // 정리된 텍스트로 업데이트
      this.subtitles[id] = cleanedText;

      // DOM에 있는 요소도 업데이트
      const element = document.getElementById(id);
      if (element) {
        element.innerText = cleanedText;
      }
    });

    // 컨테이너 가져오기
    const container = document.querySelector("#hack_title");
    if (container) {
      // 자동 스크롤 적용 - 명시적으로 자막 컨테이너에만 적용
      if (this.autoScroll) {
        // 스크롤을 자막 컨테이너의 맨 아래로 이동
        container.scrollTop = container.scrollHeight;

        // DOM 업데이트가 완료된 후 한 번 더 스크롤 시도
        setTimeout(() => {
          if (container) {
            container.scrollTop = container.scrollHeight;
          }
        }, 50);
      }
    }

    // 세션 데이터 저장
    this.saveSessionData();

    // 자막 업데이트 메시지 전송
    chrome.runtime.sendMessage({
      action: "updateSubtitles",
      subtitles: this.subtitles,
      sessionId: this.sessionId,
    });

    console.log("자막 정리 완료 - 줄바꿈 제거됨");
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

// 누락된 함수가 있을 경우 추가
if (!SubtitleCapture.prototype.createSubtitleContainer) {
  SubtitleCapture.prototype.createSubtitleContainer = function (
    videoContainer,
  ) {
    console.log("자막 캡처 컨테이너 생성 (푸터 위 표시 모드)");

    // 기존 컨테이너가 있으면 제거
    let existingContainer = document.querySelector("#hack_title");
    if (existingContainer) {
      existingContainer.remove();
    }

    // 새 컨테이너 생성
    const container = document.createElement("div");
    container.id = "hack_title";

    // 스타일 설정 - 푸터 바로 위에 표시
    container.style.position = "relative"; // fixed 대신 relative로 변경
    container.style.margin = "0";
    container.style.width = "100%";
    container.style.maxHeight = "200px"; // 화면의 일부만 차지하도록
    container.style.backgroundColor = "rgba(255, 255, 255, 0.95)";
    container.style.color = "black";
    container.style.padding = "10px";
    container.style.overflowY = "auto";
    container.style.zIndex = "9000";
    container.style.borderTop = "2px solid #3b82f6"; // 파란색 테두리
    container.style.borderBottom = "1px solid #ccc";
    container.style.boxShadow = "0 0 10px rgba(0, 0, 0, 0.1)";
    container.style.fontSize = "14px";
    container.style.lineHeight = "1.5";

    // 스타일 시트 추가 - 줄무늬 효과
    const style = document.createElement("style");
    style.textContent = `
                #hack_title p:nth-child(odd) {
                  background-color: #ffffff;
                  padding: 5px;
                  margin: 0;
                }
                #hack_title p:nth-child(even) {
                  background-color: #f3f3f3;
                  padding: 5px;
                  margin: 0;
                }
              `;
    document.head.appendChild(style);

    // 헤더 추가
    const header = document.createElement("div");
    header.style.fontWeight = "bold";
    header.style.padding = "5px";
    header.style.backgroundColor = "#3b82f6";
    header.style.color = "white";
    header.style.textAlign = "center";
    header.style.borderRadius = "5px 5px 0 0";
    header.style.marginBottom = "5px";
    header.innerText = "국회 의사중계 자막 (Hack Assembly)";
    container.appendChild(header);

    // 닫기 버튼 추가 - 더 눈에 띄게 개선
    const closeButton = document.createElement("button");
    closeButton.innerText = "숨기기";
    closeButton.style.position = "absolute";
    closeButton.style.top = "5px";
    closeButton.style.right = "10px";
    closeButton.style.padding = "3px 8px";
    closeButton.style.fontSize = "12px";
    closeButton.style.backgroundColor = "#ffffff";
    closeButton.style.border = "1px solid #3b82f6";
    closeButton.style.borderRadius = "4px";
    closeButton.style.color = "#3b82f6";
    closeButton.style.fontWeight = "bold";
    closeButton.style.cursor = "pointer";
    closeButton.style.boxShadow = "0 1px 3px rgba(0,0,0,0.12)";

    // 고정된 버튼을 위한 별도 컨테이너
    const fixedButtonContainer = document.createElement("div");
    fixedButtonContainer.id = "hack_title_fixed_button";
    fixedButtonContainer.style.position = "fixed";
    fixedButtonContainer.style.top = "10px";
    fixedButtonContainer.style.right = "10px";
    fixedButtonContainer.style.zIndex = "9999";
    fixedButtonContainer.style.display = "none"; // 처음에는 숨김
    fixedButtonContainer.style.backgroundColor = "rgba(59, 130, 246, 0.9)"; // 파란색 배경
    fixedButtonContainer.style.borderRadius = "4px";
    fixedButtonContainer.style.boxShadow = "0 2px 10px rgba(0, 0, 0, 0.3)";
    fixedButtonContainer.style.padding = "5px 10px";

    // 고정된 버튼 생성
    const fixedButton = document.createElement("button");
    fixedButton.innerText = closeButton.innerText; // 원래 버튼과 동일한 텍스트로 시작
    fixedButton.style.padding = "3px 8px";
    fixedButton.style.fontSize = "12px";
    fixedButton.style.backgroundColor = "#ffffff";
    fixedButton.style.border = "1px solid #3b82f6";
    fixedButton.style.borderRadius = "4px";
    fixedButton.style.color = "#3b82f6";
    fixedButton.style.fontWeight = "bold";
    fixedButton.style.cursor = "pointer";
    fixedButton.style.boxShadow = "0 1px 3px rgba(0,0,0,0.12)";

    fixedButtonContainer.appendChild(fixedButton);
    document.body.appendChild(fixedButtonContainer);

    // 버튼 호버 효과 함수
    const applyHoverEffect = (button) => {
      button.onmouseover = () => {
        button.style.backgroundColor = "#3b82f6";
        button.style.color = "white";
      };
      button.onmouseout = () => {
        if (container.style.height !== "30px") {
          button.style.backgroundColor = "#ffffff";
          button.style.color = "#3b82f6";
        } else {
          button.style.backgroundColor = "#3b82f6";
          button.style.color = "white";
        }
      };
    };

    // 두 버튼에 호버 효과 적용
    applyHoverEffect(closeButton);
    applyHoverEffect(fixedButton);

    // 토글 함수 정의
    const toggleContainer = () => {
      if (container.style.height === "30px") {
        container.style.height = "auto";
        container.style.maxHeight = "200px";
        closeButton.innerText = "숨기기";
        fixedButton.innerText = "숨기기";
        closeButton.style.backgroundColor = "#ffffff";
        fixedButton.style.backgroundColor = "#ffffff";
        closeButton.style.color = "#3b82f6";
        fixedButton.style.color = "#3b82f6";
      } else {
        container.style.height = "30px";
        container.style.overflow = "hidden";
        closeButton.innerText = "펼치기";
        fixedButton.innerText = "펼치기";
        closeButton.style.backgroundColor = "#3b82f6";
        fixedButton.style.backgroundColor = "#3b82f6";
        closeButton.style.color = "white";
        fixedButton.style.color = "white";
      }
    };

    // 두 버튼에 클릭 이벤트 추가
    closeButton.onclick = toggleContainer;
    fixedButton.onclick = toggleContainer;

    // 스크롤 이벤트 리스너 추가
    window.addEventListener("scroll", () => {
      // 컨테이너가 화면에 표시되는지 확인
      const containerRect = container.getBoundingClientRect();

      if (containerRect.top < 0 && containerRect.bottom > 0) {
        // 컨테이너가 아직 화면에 부분적으로 보이는 경우 (상단만 스크롤됨)
        fixedButtonContainer.style.display = "none";
      } else if (
        containerRect.bottom <= 0 ||
        containerRect.top >= window.innerHeight
      ) {
        // 컨테이너가 완전히 화면에서 벗어난 경우
        fixedButtonContainer.style.display = "block";
      } else {
        // 컨테이너가 화면에 완전히 보이는 경우
        fixedButtonContainer.style.display = "none";
      }
    });

    // 버튼을 header에 추가
    header.appendChild(closeButton);

    // 내용 컨테이너 추가
    const contentContainer = document.createElement("div");
    contentContainer.style.overflow = "auto";
    contentContainer.style.maxHeight = "calc(100% - 30px)";
    container.appendChild(contentContainer);

    // 푸터 바로 위에 컨테이너 추가 (페이지 내에 삽입)
    // 푸터 요소 찾기 시도
    let footer =
      document.querySelector("footer") ||
      document.querySelector(".footer") ||
      document.querySelector("#footer") ||
      document.querySelector('[class*="footer"]') ||
      document.querySelector('[id*="footer"]');

    if (footer) {
      // 푸터 바로 앞에 삽입
      footer.parentNode.insertBefore(container, footer);
    } else {
      // 푸터를 찾지 못했으면 body의 맨 끝에 삽입
      document.body.appendChild(container);
    }

    // 원래 컨테이너에 추가하는 대신 contentContainer에 추가하도록 오버라이드
    const originalAppendChild = container.appendChild;
    container.appendChild = function (el) {
      // 헤더와 contentContainer가 아닌 경우에만 contentContainer에 추가
      if (el !== header && el !== contentContainer && el !== closeButton) {
        return contentContainer.appendChild(el);
      } else {
        return originalAppendChild.call(this, el);
      }
    };

    console.log("자막 캡처 컨테이너 생성 완료 (푸터 위 표시 모드)");
  };
}

if (!SubtitleCapture.prototype.loadSessionData) {
  SubtitleCapture.prototype.loadSessionData = function () {
    console.log("세션 데이터 로드");

    // 확장 프로그램 컨텍스트 유효성 검사
    if (typeof chrome === 'undefined' || typeof chrome.storage === 'undefined') {
      console.warn("확장 프로그램 컨텍스트가 유효하지 않음, 세션 데이터 로드 건너뜀");
      return;
    }

    try {
      chrome.storage.local.get([`session_${this.sessionId}`], (result) => {
        // 저장 완료 후 chrome.runtime.lastError 확인
        if (chrome.runtime && chrome.runtime.lastError) {
          console.warn(
            "세션 데이터 로드 중 오류:",
            chrome.runtime.lastError.message
          );
          return;
        }

        const sessionData = result[`session_${this.sessionId}`];

        if (sessionData) {
          // 자막 데이터 로드
          this.subtitles = sessionData.subtitles || {};

          // 타임스탬프 데이터 로드
          if (window.timestampManager && sessionData.timestamps) {
            window.timestampManager.timestamps = sessionData.timestamps;
          }

          if (window.timestampManager && sessionData.durations) {
            window.timestampManager.durations = sessionData.durations;
          }

          console.log(
            `세션 데이터 로드 완료: ${this.sessionId}, 자막 수: ${Object.keys(this.subtitles).length}`,
          );
        } else {
          console.log(`세션 데이터 없음: ${this.sessionId}`);
        }
      });
    } catch (error) {
      console.error("세션 데이터 로드 중 오류 발생:", error);
    }
  };
}

// 먼저 utils 사용 가능 여부 확인
if (typeof window.utils === "undefined") {
  console.warn("utils 객체가 아직 로드되지 않았습니다. 임시 객체 생성");
  // 최소한의 utils 객체 임시 생성
  window.utils = {
    showNotification: function(message, type) {
      console.log(`[알림 - ${type}]: ${message}`);
      try {
        chrome.runtime.sendMessage({
          action: "showNotification",
          message: message,
          type: type
        });
      } catch (e) {
        console.error("알림 메시지 전송 실패:", e);
      }
    },
    formatSrtTimestamp: function(date) {
      if (!date || !(date instanceof Date)) return "00:00:00,000";
      const hours = String(date.getHours()).padStart(2, "0");
      const minutes = String(date.getMinutes()).padStart(2, "0");
      const seconds = String(date.getSeconds()).padStart(2, "0");
      const milliseconds = String(date.getMilliseconds()).padStart(3, "0");
      return `${hours}:${minutes}:${seconds},${milliseconds}`;
    }
  };
}

// 전역 인스턴스 생성 (확실하게 전역에 노출)
console.log("capture.js: SubtitleCapture 클래스 정의됨");

// timestampManager도 전역 객체에 명시적으로 할당
if (
  typeof window.timestampManager === "undefined" &&
  typeof timestampManager !== "undefined"
) {
  window.timestampManager = timestampManager;
  console.log("capture.js: window.timestampManager 객체 설정됨");
}

// 명시적으로 전역 객체(window)에 할당
try {
  window.subtitleCapture = new SubtitleCapture();
  console.log("capture.js: window.subtitleCapture 객체 생성됨");

  // 전역 범위에도 할당 (legacy 지원용)
  this.subtitleCapture = window.subtitleCapture;
} catch (error) {
  console.error("subtitleCapture 객체 생성 중 오류:", error);
}
