/**
 * Main Application Module
 * Initializes the app and coordinates all modules
 */

/**
 * Initialize and start the application
 */
function initializeApp() {
    // Load settings and apply currency preferences
    initCurrency();
    
    // Load data from storage
    initializeData();
    
    // Render all tables
    renderCards();
    renderFunds();
    renderOthers();
    
    // Register service worker for PWA functionality
    registerServiceWorker();
}

/**
 * Start app when DOM is ready
 */
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initializeApp);
} else {
    initializeApp();
}
