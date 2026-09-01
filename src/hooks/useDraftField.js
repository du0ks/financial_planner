import { useState, useEffect, useRef, useCallback } from 'react';

/**
 * Draft state for a text/number input that commits on its own.
 *
 * The old behaviour was commit-on-blur only, which loses work in two real ways: React does
 * not fire onBlur when a component unmounts (tapping a nav tab with a field focused), and
 * Safari on iOS does not move focus to a <button> when you tap it, so no blur happens at all.
 * Here the value is committed a short pause after the last keystroke, on blur, and on unmount.
 */
export default function useDraftField(value, onCommit, delay = 1000) {
    const [draft, setDraft] = useState(value);
    const [dirty, setDirty] = useState(false);

    // Mirrors of the above for the debounce timer and the unmount flush, which run outside
    // render and must see the latest values without being re-created for each keystroke.
    const dirtyRef = useRef(false);
    const draftRef = useRef(draft);
    const commitRef = useRef(onCommit);

    useEffect(() => {
        draftRef.current = draft;
        commitRef.current = onCommit;
    });

    const commit = useCallback(() => {
        if (!dirtyRef.current) return;
        dirtyRef.current = false;
        setDirty(false);
        commitRef.current(draftRef.current);
    }, []);

    const onChange = useCallback((next) => {
        dirtyRef.current = true;
        setDirty(true);
        setDraft(next);
    }, []);

    // Auto-commit once typing stops.
    useEffect(() => {
        if (!dirty) return undefined;
        const timer = setTimeout(commit, delay);
        return () => clearTimeout(timer);
    }, [draft, dirty, delay, commit]);

    // Flush whatever is pending if the field goes away with the user still in it.
    useEffect(() => commit, [commit]);

    // While the user is typing, show their text; otherwise mirror whatever the parent holds.
    // Deriving this rather than syncing it in an effect is what stops a background cloud
    // update from overwriting a half-typed number.
    return { draft: dirty ? draft : value, onChange, flush: commit };
}
