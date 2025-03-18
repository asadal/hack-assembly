/**
 * content/timestamp.js
 * Handles timestamp functionality for subtitle capture
 */

class TimestampManager {
  constructor() {
    // Store subtitle timestamps
    this.timestamps = {};

    // Store subtitle durations (for SRT export)
    this.durations = {};

    // Default duration for subtitles with no explicit end time
    this.defaultDuration = 3000; // 3 seconds
  }

  /**
   * Add a timestamp for a subtitle
   *
   * @param {string} id - The subtitle ID
   * @param {Date} timestamp - The timestamp (Date object)
   */
  addTimestamp(id, timestamp = new Date()) {
    // If this is a new subtitle
    if (!this.timestamps[id]) {
      this.timestamps[id] = timestamp;

      // If the previous subtitle doesn't have an end time, set it
      this.calculatePreviousEndTime(id);
    }
  }

  /**
   * Calculate the end time for the previous subtitle
   *
   * @param {string} currentId - The current subtitle ID
   */
  calculatePreviousEndTime(currentId) {
    const ids = Object.keys(this.timestamps);
    const currentIndex = ids.indexOf(currentId);

    // If this is not the first subtitle
    if (currentIndex > 0) {
      const previousId = ids[currentIndex - 1];
      const previousTimestamp = this.timestamps[previousId];
      const currentTimestamp = this.timestamps[currentId];

      // Calculate duration (difference between current and previous timestamp)
      const duration = currentTimestamp - previousTimestamp;

      // Store the duration (used for SRT export)
      this.durations[previousId] = Math.min(duration, this.defaultDuration);
    }
  }

  /**
   * Get formatted timestamp for a subtitle
   *
   * @param {string} id - The subtitle ID
   * @returns {string} Formatted timestamp (HH:MM:SS)
   */
  getFormattedTimestamp(id) {
    if (!this.timestamps[id]) return "";
    return utils.formatTimestamp(this.timestamps[id]);
  }

  /**
   * Get SRT formatted timestamps for a subtitle (start and end)
   *
   * @param {string} id - The subtitle ID
   * @returns {Object} Object with start and end timestamps in SRT format
   */
  getSrtTimestamps(id) {
    if (!this.timestamps[id]) {
      return { start: "", end: "" };
    }

    const startTime = this.timestamps[id];
    let endTime;

    // If we have a calculated duration for this subtitle
    if (this.durations[id]) {
      endTime = new Date(startTime.getTime() + this.durations[id]);
    } else {
      // Use default duration for the last subtitle
      endTime = new Date(startTime.getTime() + this.defaultDuration);
    }

    return {
      start: utils.formatSrtTimestamp(startTime),
      end: utils.formatSrtTimestamp(endTime),
    };
  }

  /**
   * Check if a subtitle is within a time range
   *
   * @param {string} id - The subtitle ID
   * @param {string} startTime - Start time string (HH:MM:SS)
   * @param {string} endTime - End time string (HH:MM:SS)
   * @returns {boolean} True if the subtitle is within the time range
   */
  isInTimeRange(id, startTime, endTime) {
    // If no time filters are set, return true
    if (!startTime && !endTime) return true;

    const timestamp = this.timestamps[id];
    if (!timestamp) return false;

    const timestampValue = timestamp.getTime();

    // Check against start time if provided
    if (startTime) {
      const startValue = utils.getTimeValue(startTime);
      const startDate = new Date();
      startDate.setHours(0, 0, 0, 0); // Reset to midnight
      startDate.setTime(startDate.getTime() + startValue);

      if (timestamp < startDate) return false;
    }

    // Check against end time if provided
    if (endTime) {
      const endValue = utils.getTimeValue(endTime);
      const endDate = new Date();
      endDate.setHours(0, 0, 0, 0); // Reset to midnight
      endDate.setTime(endDate.getTime() + endValue);

      if (timestamp > endDate) return false;
    }

    return true;
  }

  /**
   * Reset all timestamps
   */
  reset() {
    this.timestamps = {};
    this.durations = {};
  }
}

// Create and export the timestamp manager instance
const timestampManager = new TimestampManager();

// 전역 객체에 할당
window.timestampManager = timestampManager;

// 호환성을 위해 this에도 할당 (에러가 나지 않도록 try/catch로 감싸기)
try {
  this.timestampManager = timestampManager;
} catch (error) {
  console.log("this에 timestampManager 할당 중 오류:", error);
}
