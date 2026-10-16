// Lets any screen send the user to another tab (e.g. a chain line on Money → Debts).

const listeners = new Set();

export function goTo(tab) {
    for (const listener of listeners) listener(tab);
}

export function onGoTo(listener) {
    listeners.add(listener);
    return () => listeners.delete(listener);
}

/** The Debts tab is shown only to someone with a card or an open debt. */
export const hasDebtsTab = (model) => model.cards.length > 0 || model.debts.length > 0;
