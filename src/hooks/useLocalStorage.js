import { useState, useEffect, useCallback } from 'react';

export default function useLocalStorage(key, initialValue) {
    const [storedValue, setStoredValue] = useState(() => {
        try {
            const item = window.localStorage.getItem(key);
            return item ? JSON.parse(item) : initialValue;
        } catch (error) {
            console.error(error);
            return initialValue;
        }
    });

    // Handle key changes (e.g. switching to demo account)
    useEffect(() => {
        try {
            const item = window.localStorage.getItem(key);
            setStoredValue(item ? JSON.parse(item) : initialValue);
        } catch (error) {
            console.error(error);
        }
        // initialValue is a fresh literal on most call sites; keying on it would re-read
        // (and reset) the value on every render.
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [key]);

    // The updater form is what makes this safe: two writes landing in the same tick (two
    // debounced field commits, say) each see the previous one instead of clobbering it from
    // a stale render closure. localStorage.setItem is idempotent, so React re-invoking the
    // updater under StrictMode is harmless. useCallback keeps the identity stable, which
    // stops effects that depend on the setter from re-running every render.
    const setValue = useCallback((value) => {
        setStoredValue(prev => {
            const next = value instanceof Function ? value(prev) : value;
            try {
                window.localStorage.setItem(key, JSON.stringify(next));
            } catch (error) {
                console.error(error);
            }
            return next;
        });
    }, [key]);

    return [storedValue, setValue];
}
