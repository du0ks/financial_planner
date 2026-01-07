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
    // Register service worker for PWA functionality
    registerServiceWorker();

    // Initialize View (default to dashboard)
    switchView('dashboard');
}

/**
 * Switch the active view
 */
function switchView(viewId) {
    // Hide all views
    document.querySelectorAll('.view-section').forEach(el => {
        el.classList.add('hidden');
    });

    // Show selected view
    const target = document.getElementById(`view-${viewId}`);
    if (target) {
        target.classList.remove('hidden');
    }

    // Update nav states
    ['dashboard', 'history', 'settings'].forEach(id => {
        const btn = document.getElementById(`nav-${id}`);
        if (btn) {
            if (id === viewId) {
                btn.classList.add('border-white', 'dark:border-green-200', 'opacity-100');
                btn.classList.remove('border-transparent', 'opacity-80');
            } else {
                btn.classList.remove('border-white', 'dark:border-green-200', 'opacity-100');
                btn.classList.add('border-transparent', 'opacity-80');
            }
        }
    });

    // Save current view preference (optional)
    localStorage.setItem('lastView', viewId);
}


/**
 * Start app when DOM is ready
 */
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initializeApp);
} else {
    initializeApp();
}
