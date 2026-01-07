import { useEffect } from 'react';

export default function ThemeColorObserver() {
    useEffect(() => {
        const updateThemeColor = () => {
            const isDark = document.documentElement.classList.contains('dark');
            const color = isDark ? '#064e3b' : '#ffffff';

            let meta = document.querySelector('meta[name="theme-color"]');
            if (meta) {
                meta.setAttribute('content', color);
            } else {
                meta = document.createElement('meta');
                meta.name = 'theme-color';
                meta.content = color;
                document.head.appendChild(meta);
            }
        };

        // Initial check
        updateThemeColor();

        // Observe changes to the 'dark' class on the html element
        const observer = new MutationObserver((mutations) => {
            mutations.forEach((mutation) => {
                if (mutation.attributeName === 'class') {
                    updateThemeColor();
                }
            });
        });

        observer.observe(document.documentElement, { attributes: true });

        return () => observer.disconnect();
    }, []);

    return null;
}
