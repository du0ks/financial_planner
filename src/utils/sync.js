import { Cloud, CloudOff, RefreshCw, Check } from 'lucide-react';

// Neon Grid design tokens (design_handoff_neon_grid/README.md).
const CYAN = '#7ee9ff';
const AMBER = '#ffc861';
const TEXT_DIM = '#a6a4c4';

const MINUTE_MS = 60 * 1000;

export function relativeSyncTime(timestamp) {
    if (!timestamp) return null;
    const minutes = Math.floor((Date.now() - timestamp) / MINUTE_MS);
    if (minutes < 1) return 'just now';
    if (minutes === 1) return '1 min ago';
    if (minutes < 60) return `${minutes} min ago`;
    const hours = Math.floor(minutes / 60);
    return hours === 1 ? '1 hour ago' : `${hours} hours ago`;
}

// How the last cloud save is reported. This exists because the failure it describes — every
// upsert being rejected while the UI showed a hardcoded "On" badge — went unnoticed for days.
// Silence now has to mean success.
export function syncPresentation(syncState, lastSyncedAt) {
    switch (syncState) {
        case 'error':
            return { icon: CloudOff, color: AMBER, label: 'Not saved' };
        case 'saving':
            return { icon: RefreshCw, color: CYAN, label: 'Saving…' };
        case 'loading':
            return { icon: RefreshCw, color: CYAN, label: 'Loading…' };
        case 'ready': {
            const when = relativeSyncTime(lastSyncedAt);
            return { icon: Check, color: CYAN, label: when ? `Saved ${when}` : 'Saved' };
        }
        default:
            return { icon: Cloud, color: TEXT_DIM, label: 'On this device' };
    }
}
