import { list, getSetting } from './doc';
import { convertOrZero, goldValueMinor, goldGramPrice } from './fx';
import { accountBalances, billsDueBeforePayday, cardDebt, CREDIT, openDebts, txAmountIn } from './ledger';
import { goldTotals } from './gold';
import { sumMinor } from './money';

// Everything the screens show is derived here from the document and today's rates, so the
// definitions live in one place:
//
//   available now = money in accounts marked available + touchable gold
//                   − card debt − bills still to pay before next payday − debts you surely owe
//   net worth     = all accounts + all gold − card debt − debts you surely owe + money surely owed to you
//
// Possible debts (like a bill someone else covered and may or may not ask back) are shown
// next to these figures but never subtracted.

export function readSettings(doc) {
    const displayCurrency = getSetting(doc, 'displayCurrency', 'EUR');
    const currencies = getSetting(doc, 'currencies', [displayCurrency]);
    return {
        displayCurrency,
        currencies: currencies.includes(displayCurrency) ? currencies : [displayCurrency, ...currencies],
        spendingCurrency: getSetting(doc, 'spendingCurrency', displayCurrency),
        fxOverrides: getSetting(doc, 'fxOverrides', {}),
        snapshotReminderDays: getSetting(doc, 'snapshotReminderDays', 30),
        bigPurchaseLimit: getSetting(doc, 'bigPurchaseLimit', 1),
    };
}

export const debtAmount = (tx) => tx.debt?.amount ?? tx.amount;

export function buildModel(doc, rates, todayDate) {
    const settings = readSettings(doc);
    const display = settings.displayCurrency;
    const fx = rates ? { rates, overrides: settings.fxOverrides } : { rates: {}, overrides: settings.fxOverrides };
    const missing = new Set();
    const toDisplay = (minor, currency) => convertOrZero(minor, currency, display, fx, missing);

    const balances = accountBalances(doc, fx, missing);
    const accounts = list(doc, 'accounts')
        .sort((a, b) => (a.order ?? 0) - (b.order ?? 0) || a.name.localeCompare(b.name))
        .map((account) => {
            const balance = balances[account.id] || 0;
            return { ...account, balance, display: toDisplay(balance, account.currency) };
        });
    const byId = Object.fromEntries(accounts.map((a) => [a.id, a]));

    const cards = accounts.filter((a) => a.kind === CREDIT).map((card) => {
        const debt = cardDebt(card.balance);
        return {
            ...card,
            debt,
            debtDisplay: toDisplay(debt, card.currency),
            leftToSpend: (card.limit || 0) - debt,
            deposit: card.linkedAccountId ? byId[card.linkedAccountId] || null : null,
        };
    });
    const linkedIds = new Set(cards.map((c) => c.linkedAccountId).filter(Boolean));

    const assetAccounts = accounts.filter((a) => a.kind !== CREDIT);
    const overpaidCards = sumMinor(cards.map((c) => (c.balance > 0 ? c.display : 0)));
    const availableCash = sumMinor(assetAccounts.filter((a) => a.available !== false).map((a) => a.display)) + overpaidCards;
    const lockedAssets = sumMinor(assetAccounts.filter((a) => a.available === false).map((a) => a.display));
    const totalCardDebt = sumMinor(cards.map((c) => c.debtDisplay));

    const gold = goldTotals(doc);
    const goldGram = goldGramPrice(display, fx);
    const goldAvailableValue = goldValueMinor(gold.availableMg, display, fx) ?? 0;
    const goldLockedValue = goldValueMinor(gold.lockedMg, display, fx) ?? 0;
    if (gold.totalMg && goldGram === null) missing.add('XAU');

    const bills = billsDueBeforePayday(doc, todayDate);
    const billItems = bills.items.map((o) => ({ ...o, display: toDisplay(o.rule.amount, o.rule.currency) }));
    const billsDue = sumMinor(billItems.map((o) => o.display));

    const debts = openDebts(doc).map((tx) => ({ ...tx, display: txAmountIn({ ...tx, amount: debtAmount(tx) }, display, doc, fx, missing) }));
    const sumDebts = (direction, certainty) => sumMinor(debts
        .filter((d) => d.debt.direction === direction && (!certainty || d.debt.certainty === certainty))
        .map((d) => d.display));
    const iOweCertain = sumDebts('iOwe', 'certain');
    const iOwePossible = sumDebts('iOwe', 'possible');
    const owedToMeCertain = sumDebts('owedToMe', 'certain');
    const owedToMeAll = sumDebts('owedToMe');

    const availableNow = availableCash + goldAvailableValue - totalCardDebt - billsDue - iOweCertain;
    const netWorth = availableCash + lockedAssets + goldAvailableValue + goldLockedValue - totalCardDebt - iOweCertain + owedToMeCertain;

    return {
        doc,
        settings,
        display,
        fx,
        ratesReady: Boolean(rates),
        missing: [...missing],
        accounts,
        accountsById: byId,
        cards,
        cashAccounts: assetAccounts.filter((a) => !linkedIds.has(a.id) && a.kind !== 'investment'),
        investmentAccounts: assetAccounts.filter((a) => a.kind === 'investment'),
        linkedIds,
        gold: { ...gold, gramPrice: goldGram, availableValue: goldAvailableValue, lockedValue: goldLockedValue },
        bills: { payday: bills.payday, items: billItems, total: billsDue },
        debts,
        totals: {
            availableCash,
            lockedAssets,
            totalCardDebt,
            billsDue,
            iOweCertain,
            iOwePossible,
            owedToMeCertain,
            owedToMeAll,
            availableNow,
            netWorth,
        },
        toDisplay,
    };
}
