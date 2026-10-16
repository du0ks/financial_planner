import { useEffect, useState } from 'react';
import { Check, Cloud, CloudOff, RefreshCw } from 'lucide-react';
import { useStoreState } from '../state/hooks';
import { syncNow } from '../state/store';
import { cx } from './kit';
import S from '../i18n/strings';

function relative(timestamp) {
    if (!timestamp) return null;
    const minutes = Math.floor((Date.now() - timestamp) / 60000);
    if (minutes < 1) return S.sync.justNow;
    if (minutes < 60) return S.sync.minutesAgo(minutes);
    return S.sync.hoursAgo(Math.floor(minutes / 60));
}

/** Says plainly whether the last change reached the cloud. Tap to retry. */
export default function SyncBadge({ compact }) {
    const { sync, key, dirty } = useStoreState();
    const [, tick] = useState(0);
    useEffect(() => {
        const timer = window.setInterval(() => tick((n) => n + 1), 30000);
        return () => window.clearInterval(timer);
    }, []);

    let Icon = Check;
    let label = S.sync.ready(relative(sync.lastSyncedAt));
    let tone = 'text-neon';
    if (key === 'demo') { Icon = Cloud; label = S.sync.local; tone = 'text-dim'; }
    else if (sync.state === 'saving' || sync.state === 'loading') { Icon = RefreshCw; label = sync.state === 'saving' ? S.sync.saving : S.sync.loading; }
    else if (sync.state === 'offline') { Icon = CloudOff; label = S.sync.offline; tone = 'text-gold'; }
    else if (sync.state === 'error' || (dirty && sync.state !== 'ready')) { Icon = CloudOff; label = S.sync.error; tone = 'text-gold'; }

    return (
        <button type="button" onClick={syncNow} title={sync.error || label} className={cx('inline-flex items-center gap-1.5 font-mono text-[12px]', tone)}>
            <Icon size={14} className={sync.state === 'saving' ? 'animate-spin' : ''} />
            <span className={compact ? 'hidden sm:inline' : ''}>{label}</span>
        </button>
    );
}
