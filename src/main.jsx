import { Component, StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { registerSW } from 'virtual:pwa-register';
import './index.css';
import App from './App.jsx';
import S from './i18n/strings';

// Check for a new version every time the app comes back to the foreground, and reload into
// it. A tab left open on an old version is exactly what must not keep saving old-format data.
const updateSW = registerSW({
    immediate: true,
    onRegisteredSW(_url, registration) {
        if (!registration) return;
        const check = () => registration.update().catch(() => {});
        document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible') check(); });
        window.setInterval(check, 30 * 60 * 1000);
    },
    onNeedRefresh() {
        updateSW(true);
    },
});

class ErrorBoundary extends Component {
    constructor(props) {
        super(props);
        this.state = { error: null };
    }

    static getDerivedStateFromError(error) {
        return { error };
    }

    componentDidCatch(error, info) {
        console.error('App crashed', error, info);
    }

    render() {
        if (this.state.error) {
            return (
                <div style={{ padding: 32, fontFamily: 'sans-serif', color: '#e2e0f7', background: '#07050e', minHeight: '100vh' }}>
                    <h1 style={{ color: '#ff5fb4' }}>Something went wrong.</h1>
                    <p>Your data is safe on this device. Reload to try again.</p>
                    <pre style={{ whiteSpace: 'pre-wrap', color: '#8f8cb0' }}>{String(this.state.error)}</pre>
                    <button type="button" onClick={() => window.location.reload()} style={{ marginTop: 16, padding: '10px 16px' }}>{S.app.retry}</button>
                </div>
            );
        }
        return this.props.children;
    }
}

createRoot(document.getElementById('root')).render(
    <StrictMode>
        <ErrorBoundary>
            <App />
        </ErrorBoundary>
    </StrictMode>,
);
