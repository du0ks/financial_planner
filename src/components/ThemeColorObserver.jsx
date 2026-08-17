import { useEffect } from 'react';

// Neon Grid is a single committed dark theme (no light mode), so the browser chrome
// color is now constant — previously this watched a `dark` class on <html> that
// Tailwind's `darkMode: 'media'` strategy never actually applies (it's CSS-media-query
// based, not class based), so this observer was silently a no-op before.
const THEME_COLOR = '#050409';

export default function ThemeColorObserver() {
    useEffect(() => {
        let meta = document.querySelector('meta[name="theme-color"]');
        if (meta) {
            meta.setAttribute('content', THEME_COLOR);
        } else {
            meta = document.createElement('meta');
            meta.name = 'theme-color';
            meta.content = THEME_COLOR;
            document.head.appendChild(meta);
        }
    }, []);

    return null;
}
