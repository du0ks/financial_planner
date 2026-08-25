/**
 * History snapshots predate the cash-only headline: they stored
 * `overallNet = cash + investments - cardDebt`, and they never recorded bills at all.
 *
 * Subtracting the investment value recovers the cash position (cash - cardDebt) from any
 * snapshot that recorded it, which is what "this month" comparisons use on both sides —
 * bills are a recurring monthly cost rather than a balance, so leaving them out of the
 * comparison measures how your money actually moved.
 *
 * Returns null for any snapshot that cannot be compared honestly. Callers treat null as
 * "skip this one" rather than substituting a guess.
 */
export const snapshotCashNet = (snapshot, displayCurrency) => {
    if (!snapshot) return null;

    // A snapshot taken in another currency can't be compared without converting historical
    // values at today's rates, which would report FX movement as if it were saving.
    if ((snapshot.currency || displayCurrency) !== displayCurrency) return null;

    if (typeof snapshot.totalCash === 'number' && typeof snapshot.totalCardDebt === 'number') {
        return snapshot.totalCash - snapshot.totalCardDebt;
    }

    // Older snapshot: back it out of the pre-change definition.
    if (typeof snapshot.overallNet !== 'number' || typeof snapshot.totalInvestmentValue !== 'number') {
        return null;
    }
    return snapshot.overallNet - snapshot.totalInvestmentValue;
};
