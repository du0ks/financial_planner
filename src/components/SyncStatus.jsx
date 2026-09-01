import { syncPresentation } from '../utils/sync';

export default function SyncStatus({ syncState, lastSyncedAt, compact = false }) {
    const { icon: Icon, color, label } = syncPresentation(syncState, lastSyncedAt);

    if (compact) {
        return (
            <span
                className="flex items-center gap-1.5 font-mono text-[12px] uppercase tracking-[0.1em]"
                style={{ color }}
                title={label}
            >
                <Icon size={13} />
                <span className="hidden sm:inline">{label}</span>
            </span>
        );
    }

    return (
        <div
            className="inline-flex h-[30px] w-fit items-center gap-2 border px-3 font-mono text-[12px] uppercase tracking-[0.12em]"
            style={{ borderColor: color, color }}
        >
            <Icon size={13} />
            {label}
        </div>
    );
}
