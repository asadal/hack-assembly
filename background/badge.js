/**
 * background/badge.js
 * Handles badge and visual indicators
 */

class BadgeManager {
    constructor() {
        // Badge colors
        this.colors = {
            running: '#10b981', // Green
            paused: '#f59e0b', // Yellow
            stopped: '#ef4444', // Red
            default: '#3b82f6' // Blue
        };
        
        // Badge text values
        this.texts = {
            running: 'ON',
            paused: 'II',
            stopped: '',
            default: ''
        };
        
        // Initialize badge with default state
        this.updateBadge('default');
    }
    
    /**
     * Update the extension badge
     * 
     * @param {string} status - The status to display ('running', 'paused', 'stopped', 'default')
     */
    updateBadge(status) {
        // Set badge text
        chrome.action.setBadgeText({
            text: this.texts[status] || ''
        });
        
        // Set badge color
        chrome.action.setBadgeBackgroundColor({
            color: this.colors[status] || this.colors.default
        });
    }
    
    /**
     * Show a notification
     * 
     * @param {string} message - The notification message
     * @param {string} type - The notification type ('success', 'warning', 'error')
     */
    showNotification(message, type = 'info') {
        // Determine icon based on type
        let iconPath = 'icons/icon128.png';
        
        // Create the notification
        chrome.notifications.create({
            type: 'basic',
            iconUrl: chrome.runtime.getURL(iconPath),
            title: 'Hack Assembly',
            message: message,
            priority: 1
        });
    }
}

// Create and export badge manager
window.badgeManager = new BadgeManager();