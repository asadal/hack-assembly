/**
 * common/utils.js
 * Hack Assembly 확장 프로그램의 공통 유틸리티 함수
 */

// 전역 네임스페이스 오염 방지 (한 번만 선언되도록)
if (typeof window.utils === "undefined") {
  // Utils 객체 생성
  window.utils = {};

  /**
   * 타임스탬프를 HH:MM:SS 형식으로 포맷팅
   *
   * @param {Date} date - 포맷팅할 Date 객체
   * @returns {string} 포맷팅된 타임스탬프 문자열
   */
  window.utils.formatTimestamp = function (date) {
    return date.toTimeString().split(" ")[0];
  };

  /**
   * SRT 형식(HH:MM:SS,mmm)으로 타임스탬프 포맷팅
   *
   * @param {Date} date - 포맷팅할 Date 객체
   * @returns {string} SRT용 포맷팅된 타임스탬프 문자열
   */
  window.utils.formatSrtTimestamp = function (date) {
    const hours = String(date.getHours()).padStart(2, "0");
    const minutes = String(date.getMinutes()).padStart(2, "0");
    const seconds = String(date.getSeconds()).padStart(2, "0");
    const milliseconds = String(date.getMilliseconds()).padStart(3, "0");

    return `${hours}:${minutes}:${seconds},${milliseconds}`;
  };

  /**
   * 파일 다운로드 생성
   *
   * @param {string} content - 파일 내용
   * @param {string} filename - 저장할 파일명
   * @param {string} type - 파일의 MIME 타입
   */
  window.utils.downloadFile = function (
    content,
    filename,
    type = "text/plain",
  ) {
    const blob = new Blob([content], { type });
    const url = URL.createObjectURL(blob);

    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    a.click();

    URL.revokeObjectURL(url);
  };

  /**
   * 고유 ID 생성
   *
   * @returns {string} 고유 ID 문자열
   */
  window.utils.generateUniqueId = function () {
    return Date.now().toString(36) + Math.random().toString(36).substr(2, 5);
  };

  /**
   * 알림 표시
   *
   * @param {string} message - 알림 메시지
   * @param {string} type - 알림 유형 ('success', 'warning', 'error')
   */
  window.utils.showNotification = function (message, type = "info") {
    chrome.runtime.sendMessage({
      action: "showNotification",
      message,
      type,
    });
  };

  /**
   * 타임스탬프 문자열(HH:MM:SS)에서 시간 값 획득
   *
   * @param {string} timeString - 분석할 시간 문자열
   * @returns {number} 밀리초 단위의 시간 값
   */
  window.utils.getTimeValue = function (timeString) {
    if (!timeString) return 0;

    const [hours, minutes, seconds] = timeString.split(":").map(Number);
    return (hours * 3600 + minutes * 60 + seconds) * 1000;
  };

  /**
   * 텍스트에 키워드가 포함되어 있는지 확인(대소문자 구분 없음)
   *
   * @param {string} text - 검색할 텍스트
   * @param {string} keyword - 검색할 키워드
   * @returns {boolean} 텍스트에 키워드가 포함되어 있으면 true
   */
  window.utils.textIncludesKeyword = function (text, keyword) {
    if (!keyword || !text) return true;
    return text.toLowerCase().includes(keyword.toLowerCase());
  };

  /**
   * 함수 호출을 디바운스
   *
   * @param {Function} func - 디바운스할 함수
   * @param {number} wait - 밀리초 단위의 대기 시간
   * @returns {Function} 디바운스된 함수
   */
  window.utils.debounce = function (func, wait = 300) {
    let timeout;

    return function executedFunction(...args) {
      const later = () => {
        clearTimeout(timeout);
        func(...args);
      };

      clearTimeout(timeout);
      timeout = setTimeout(later, wait);
    };
  };

  /**
   * 안전하게 활성 탭에 메시지를 보내는 함수 (개선 버전)
   * @param {Object} message - 보낼 메시지 객체
   * @param {Function} callback - 응답을 처리할 콜백 함수
   */
  window.utils.sendMessageToActiveTab = function (message, callback) {
    try {
      chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
        if (!tabs || tabs.length === 0) {
          console.log("활성 탭을 찾을 수 없음");
          if (callback)
            callback({ success: false, error: "활성 탭을 찾을 수 없습니다." });
          return;
        }

        // 메시지 직접 전송 시도
        chrome.tabs.sendMessage(tabs[0].id, message, (response) => {
          // 마지막 오류 확인
          const lastError = chrome.runtime.lastError;

          if (lastError) {
            console.log("메시지 전송 오류:", lastError.message);

            // 오류가 발생했지만 콜백이 있으면 실패 상태로 호출
            if (callback)
              callback({ success: false, error: lastError.message });
            return;
          }

          // 정상 응답 처리
          if (callback) callback(response || { success: true });
        });
      });
    } catch (error) {
      console.error("메시지 전송 중 예외:", error);
      if (callback) callback({ success: false, error: error.message });
    }
  };

  /**
   * 콘텐츠 스크립트가 로드되었는지 확인하는 함수
   * @param {number} tabId - 확인할 탭 ID
   * @returns {Promise<boolean>} 콘텐츠 스크립트 로드 여부
   */
  window.utils.isContentScriptAvailable = function (tabId) {
    return new Promise((resolve) => {
      try {
        chrome.tabs.sendMessage(tabId, { action: "ping" }, (response) => {
          if (chrome.runtime.lastError) {
            resolve(false);
            return;
          }
          resolve(true);
        });
      } catch (error) {
        console.error("콘텐츠 스크립트 확인 오류:", error);
        resolve(false);
      }
    });
  };
}

// utils 객체가 전역에 노출되지 않았다면 노출
if (typeof this !== "undefined" && typeof this.utils === "undefined") {
  this.utils = window.utils;
}
