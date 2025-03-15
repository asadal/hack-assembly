/**
 * popup/search.js
 * Handles search and filtering functionality
 */

class SearchManager {
  constructor() {
    // DOM elements
    this.searchInput = document.getElementById("search-input");
    this.searchButton = document.getElementById("search-button");
    this.filterButton = document.getElementById("filter-button");
    this.filterPanel = document.getElementById("filter-panel");

    this.filterTimeStart = document.getElementById("filter-time-start");
    this.filterTimeEnd = document.getElementById("filter-time-end");
    this.filterKeyword = document.getElementById("filter-keyword");
    this.filterApplyButton = document.getElementById("filter-apply");
    this.filterResetButton = document.getElementById("filter-reset");

    // Search state
    this.isFilterPanelOpen = false;
    this.currentSearchTerm = "";

    // Debounced search function to improve performance
    this.debouncedSearch = utils.debounce(() => {
      this.performSearch();
    }, 300);

    // Initialize
    this.init();
  }

  /**
   * Initialize the search manager
   */
  init() {
    // Set up event listeners
    this.searchInput.addEventListener("input", () => this.debouncedSearch());
    this.searchButton.addEventListener("click", () => this.performSearch());

    this.filterButton.addEventListener("click", () => this.toggleFilterPanel());
    this.filterApplyButton.addEventListener("click", () => this.applyFilters());
    this.filterResetButton.addEventListener("click", () => this.resetFilters());

    // Handle search on Enter key
    this.searchInput.addEventListener("keypress", (e) => {
      if (e.key === "Enter") {
        this.performSearch();
      }
    });

    // Load saved filters
    this.loadSavedFilters();
  }

  /**
   * Perform search
   */
  performSearch() {
    this.currentSearchTerm = this.searchInput.value.trim();

    // Apply search and filters
    if (subtitleManager) {
      subtitleManager.applyFilters(
        this.currentSearchTerm,
        this.filterTimeStart.value,
        this.filterTimeEnd.value,
        this.filterKeyword.value,
      );
    }

    // Save filters
    this.saveFilters();
  }

  /**
   * Toggle filter panel visibility
   */
  toggleFilterPanel() {
    this.isFilterPanelOpen = !this.isFilterPanelOpen;

    if (this.isFilterPanelOpen) {
      this.filterPanel.classList.remove("hidden");
      this.filterButton.classList.add("active");
    } else {
      this.filterPanel.classList.add("hidden");
      this.filterButton.classList.remove("active");
    }
  }

  /**
   * Apply current filters
   */
  applyFilters() {
    if (subtitleManager) {
      subtitleManager.applyFilters(
        this.currentSearchTerm,
        this.filterTimeStart.value,
        this.filterTimeEnd.value,
        this.filterKeyword.value,
      );
    }

    // Save filters
    this.saveFilters();
  }

  /**
   * Reset all filters
   */
  resetFilters() {
    this.searchInput.value = "";
    this.filterTimeStart.value = "";
    this.filterTimeEnd.value = "";
    this.filterKeyword.value = "";

    this.currentSearchTerm = "";

    // Apply reset filters
    if (subtitleManager) {
      subtitleManager.applyFilters("", "", "", "");
    }

    // Save filters
    this.saveFilters();
  }

  /**
   * Save current filters to storage
   */
  saveFilters() {
    chrome.storage.local.set({
      searchFilters: {
        searchTerm: this.currentSearchTerm,
        timeStart: this.filterTimeStart.value,
        timeEnd: this.filterTimeEnd.value,
        keyword: this.filterKeyword.value,
        sessionId: sessionManager
          ? sessionManager.getCurrentSessionId()
          : "default",
      },
    });
  }

  /**
   * Load saved filters from storage
   */
  loadSavedFilters() {
    chrome.storage.local.get(["searchFilters"], (result) => {
      if (result.searchFilters) {
        const filters = result.searchFilters;

        // Only restore filters for the current session
        const currentSessionId = sessionManager
          ? sessionManager.getCurrentSessionId()
          : "default";
        if (filters.sessionId === currentSessionId) {
          this.searchInput.value = filters.searchTerm || "";
          this.filterTimeStart.value = filters.timeStart || "";
          this.filterTimeEnd.value = filters.timeEnd || "";
          this.filterKeyword.value = filters.keyword || "";

          this.currentSearchTerm = filters.searchTerm || "";

          // Apply filters
          if (subtitleManager) {
            subtitleManager.applyFilters(
              filters.searchTerm,
              filters.timeStart,
              filters.timeEnd,
              filters.keyword,
            );
          }
        }
      }
    });
  }
}
