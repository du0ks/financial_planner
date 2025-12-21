/**
 * PWA Module
 * Handles Progressive Web App functionality (service worker registration)
 */

/**
 * Register service worker for offline functionality
 */
function registerServiceWorker() {
    if ('serviceWorker' in navigator) {
        window.addEventListener('load', () => {
            navigator.serviceWorker
                .register('./service-worker.js')
                .catch(error => {
                    console.error('Service worker registration failed:', error);
                });
        });
    }
}
