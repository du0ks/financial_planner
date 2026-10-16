import { lazy, Suspense, useSyncExternalStore } from 'react';

// One editor sheet open at a time, opened from anywhere: openSheet('tx', { preset }).

const editors = {
    tx: lazy(() => import('../editors/TxEditor')),
    account: lazy(() => import('../editors/AccountEditor')),
    card: lazy(() => import('../editors/CardEditor')),
    rule: lazy(() => import('../editors/RuleEditor')),
    confirm: lazy(() => import('../editors/ConfirmOccurrence')),
    planned: lazy(() => import('../editors/PlannedEditor')),
    budget: lazy(() => import('../editors/BudgetEditor')),
    gold: lazy(() => import('../editors/GoldEditor')),
    portion: lazy(() => import('../editors/PortionEditor')),
    goal: lazy(() => import('../editors/GoalEditor')),
    category: lazy(() => import('../editors/CategoryEditor')),
    debt: lazy(() => import('../editors/DebtResolver')),
    import: lazy(() => import('../editors/ImportSheet')),
};

let current = null;
const listeners = new Set();
const emit = () => listeners.forEach((l) => l());

export function openSheet(type, props = {}) {
    current = { type, props, key: Date.now() };
    emit();
}

export function closeSheet() {
    current = null;
    emit();
}

export function SheetHost() {
    const sheet = useSyncExternalStore((l) => { listeners.add(l); return () => listeners.delete(l); }, () => current);
    if (!sheet) return null;
    const Editor = editors[sheet.type];
    return (
        <Suspense fallback={null}>
            <Editor key={sheet.key} {...sheet.props} onClose={closeSheet} />
        </Suspense>
    );
}
