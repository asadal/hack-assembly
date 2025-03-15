/**
 * background/storage.js
 * Handles storage management for the extension
 */

class StorageManager {
    constructor() {
        // Default settings
        this.defaultSettings = {
            isRunning: false,
            isPaused: false,
            autoScroll: true,
            theme: 'light-mode',
            currentSessionId: 'default',
            sessions: [{
                id: 'default',
                name: '기본 세션',
                created: new Date().toISOString()
            }]
        };
    }
    
    /**
     * Initialize storage with default values
     */
    initializeStorage() {
        // Check if storage has been initialized
        chrome.storage.local.get(['initialized'], (result) => {
            if (!result.initialized) {
                // Set defaults
                chrome.storage.local.set({
                    ...this.defaultSettings,
                    initialized: true
                });
                
                console.log('Storage initialized with defaults');
            }
        });
    }
    
    /**
     * Clear all stored subtitle data
     */
    clearAllSubtitles() {
        chrome.storage.local.get(null, (items) => {
            const keysToRemove = Object.keys(items).filter(key => 
                key.startsWith('session_') || key === 'subtitles'
            );
            
            if (keysToRemove.length > 0) {
                chrome.storage.local.remove(keysToRemove, () => {
                    console.log('All subtitle data cleared');
                });
            }
        });
    }
    
    /**
     * Clear data for a specific session
     * 
     * @param {string} sessionId - The session ID to clear
     */
    clearSessionData(sessionId) {
        if (!sessionId) return;
        
        chrome.storage.local.remove(`session_${sessionId}`, () => {
            console.log(`Data for session ${sessionId} cleared`);
        });
    }
    
    /**
     * Get all sessions info
     * 
     * @param {Function} callback - Callback function that receives the session list
     */
    getAllSessions(callback) {
        chrome.storage.local.get(['sessions'], (result) => {
            const sessions = result.sessions || this.defaultSettings.sessions;
            callback(sessions);
        });
    }
    
    /**
     * Get storage usage stats
     * 
     * @param {Function} callback - Callback function that receives the stats
     */
    getStorageStats(callback) {
        chrome.storage.local.getBytesInUse(null, (bytesInUse) => {
            const stats = {
                bytesInUse,
                bytesInUseMB: (bytesInUse / (1024 * 1024)).toFixed(2),
                percentUsed: ((bytesInUse / chrome.storage.local.QUOTA_BYTES) * 100).toFixed(2)
            };
            
            callback(stats);
        });
    }
}

// Create and export storage manager
window.storageManager = new StorageManager();