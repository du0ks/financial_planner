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
    initTheme();

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
 * Change Currency Helper
 */
function changeCurrency(code) {
    setCurrency(code);
}

/**
 * Set and Apply Theme
 */
function setTheme(theme) {
    const html = document.documentElement;
    const isDark = theme === 'dark' || (theme === 'system' && window.matchMedia('(prefers-color-scheme: dark)').matches);

    if (theme === 'dark') {
        html.classList.add('dark');
    } else {
        html.classList.remove('dark');
    }

    // Update local storage directly if needed, or implement a saveSettings wrapper
    // For now, we reuse saveSettings from currency which might trigger a reload, 
    // but ideally we should separate theme saving.
    // Let's rely on basic localStorage for theme to keep it simple or expand saveSettings later.
    localStorage.setItem('theme', theme);

    // Update active button state
    document.querySelectorAll('[id^="theme-btn-"]').forEach(btn => {
        if (btn.id === `theme-btn-${theme}`) {
            btn.classList.add('bg-white', 'dark:bg-gray-600', 'shadow-sm', 'text-gray-900', 'dark:text-white');
            btn.classList.remove('text-gray-500', 'dark:text-gray-400');
        } else {
            btn.classList.remove('bg-white', 'dark:bg-gray-600', 'shadow-sm', 'text-gray-900', 'dark:text-white');
            btn.classList.add('text-gray-500', 'dark:text-gray-400');
        }
    });
}

/**
 * Initialize Theme
 */
function initTheme() {
    const theme = localStorage.getItem('theme') || 'light';
    setTheme(theme);
}

/**
 * Reset all data
 */
function resetData() {
    if (confirm("CRITICAL WARNING: This will delete ALL your data permanently! Are you sure?")) {
        localStorage.removeItem('financeTracker_local_v1');
        location.reload();
    }
}


/**
 * Start app when DOM is ready
 */
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initializeApp);
} else {
    initializeApp();
}
