import { list, getSetting } from './doc';
import { convertOrZero, goldValueMinor, goldGramPrice } from './fx';
import { accountBalances, billsDueBeforePayday, cardDebt, CREDIT, OTHER, openDebts, txAmountIn } from './ledger';
import { goldTotals } from './gold';
import { cardTerms, interestIfMinimum } from './cards';
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
//
// `assets` lists everything owned, before any debt, in five groups. `chain` walks from that
// total to net worth and on to available now; each step is one subtraction, so the three
// headline numbers can be checked by hand.

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
        costBasis: getSetting(doc, 'costBasis', 'budget'),
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
        const terms = cardTerms(card);
        const interestMonthly = terms.monthlyRatePct ? interestIfMinimum(debt, terms) : 0;
        return {
            ...card,
            debt,
            terms,
            // Next statement's interest if only the minimum is paid; null when the rate is unknown.
            interestMonthly: terms.monthlyRatePct ? interestMonthly : null,
            interestMonthlyDisplay: toDisplay(interestMonthly, card.currency),
            debtDisplay: toDisplay(debt, card.currency),
            leftToSpend: (card.limit || 0) - debt,
            deposit: card.linkedAccountId ? byId[card.linkedAccountId] || null : null,
        };
    });
    const linkedIds = new Set(cards.map((c) => c.linkedAccountId).filter(Boolean));

    const assetAccounts = accounts.filter((a) => a.kind !== CREDIT);
    const isSpendable = (a) => a.kind !== OTHER && a.available !== false;
    const accountItem = (a) => ({ id: a.id, name: a.name, kind: a.kind, minor: a.balance, currency: a.currency, display: a.display, account: a });
    const spendableItems = [
        ...assetAccounts.filter(isSpendable).map(accountItem),
        // A card paid past zero holds your money until it is spent.
        ...cards.filter((c) => c.balance > 0).map(accountItem),
    ];
    const lockedItems = assetAccounts.filter((a) => a.kind !== OTHER && a.available === false).map(accountItem);
    const totalCardDebt = sumMinor(cards.map((c) => c.debtDisplay));

    const gold = goldTotals(doc);
    const goldGram = goldGramPrice(display, fx);
    if (gold.totalMg && goldGram === null) missing.add('XAU');
    const portionItems = (available) => list(doc, 'portions')
        .filter((p) => Boolean(p.available) === available && gold.holdings[p.id])
        .sort((a, b) => (a.order ?? 0) - (b.order ?? 0))
        .map((p) => ({ id: p.id, name: p.name, mg: gold.holdings[p.id], display: goldValueMinor(gold.holdings[p.id], display, fx) ?? 0, portion: p }));
    const goldTouchableItems = portionItems(true);
    const goldUntouchableItems = portionItems(false);

    const bills = billsDueBeforePayday(doc, todayDate);
    const billItems = bills.items.map((o) => ({ ...o, display: toDisplay(o.rule.amount, o.rule.currency) }));
    const billsDue = sumMinor(billItems.map((o) => o.display));

    const debts = openDebts(doc).map((tx) => ({ ...tx, display: txAmountIn({ ...tx, amount: debtAmount(tx) }, display, doc, fx, missing) }));
    const pickDebts = (direction, certainty) => debts.filter((d) => d.debt.direction === direction && (!certainty || d.debt.certainty === certainty));
    const sumDebts = (direction, certainty) => sumMinor(pickDebts(direction, certainty).map((d) => d.display));
    const iOweCertain = sumDebts('iOwe', 'certain');
    const iOwePossible = sumDebts('iOwe', 'possible');
    const owedToMeCertain = sumDebts('owedToMe', 'certain');
    const owedToMeAll = sumDebts('owedToMe');

    const otherItems = [
        ...assetAccounts.filter((a) => a.kind === OTHER).map(accountItem),
        ...pickDebts('owedToMe', 'certain').map((tx) => ({
            id: tx.id, name: tx.note || tx.debt.who || '', owedBy: tx.debt.who || null, minor: debtAmount(tx), currency: tx.currency, display: tx.display, tx,
        })),
    ];
    const group = (key, items) => ({ key, items, total: sumMinor(items.map((i) => i.display)) });
    const groups = [
        group('spendable', spendableItems),
        group('goldTouchable', goldTouchableItems),
        group('goldUntouchable', goldUntouchableItems),
        group('investments', lockedItems),
        group('other', otherItems),
    ];
    const byKey = Object.fromEntries(groups.map((g) => [g.key, g]));
    const totalAssets = sumMinor(groups.map((g) => g.total));

    const availableCash = byKey.spendable.total;
    const lockedAssets = byKey.investments.total + sumMinor(assetAccounts.filter((a) => a.kind === OTHER).map((a) => a.display));
    const goldAvailableValue = byKey.goldTouchable.total;
    const goldLockedValue = byKey.goldUntouchable.total;

    const netWorth = totalAssets - totalCardDebt - iOweCertain;
    const availableNow = netWorth - goldLockedValue - byKey.investments.total - byKey.other.total - billsDue;

    // Each step's amount is signed; `total` steps repeat the running result.
    const chain = [
        { key: 'assets', minor: totalAssets, total: true },
        { key: 'cards', minor: -totalCardDebt },
        ...(iOweCertain ? [{ key: 'iOwe', minor: -iOweCertain }] : []),
        { key: 'netWorth', minor: netWorth, total: true },
        { key: 'goldUntouchable', minor: -goldLockedValue },
        { key: 'investments', minor: -byKey.investments.total },
        ...(byKey.other.total ? [{ key: 'other', minor: -byKey.other.total }] : []),
        { key: 'bills', minor: -billsDue },
        { key: 'availableNow', minor: availableNow, total: true },
    ];

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
        cashAccounts: assetAccounts.filter((a) => !linkedIds.has(a.id) && a.kind !== 'investment' && a.kind !== OTHER),
        investmentAccounts: assetAccounts.filter((a) => a.kind === 'investment' || a.kind === OTHER),
        linkedIds,
        gold: { ...gold, gramPrice: goldGram, availableValue: goldAvailableValue, lockedValue: goldLockedValue },
        bills: { payday: bills.payday, items: billItems, total: billsDue },
        debts,
        assets: { groups, total: totalAssets },
        chain,
        possibleDebts: pickDebts('iOwe', 'possible'),
        totals: {
            totalAssets,
            cardInterestMonthly: sumMinor(cards.map((c) => c.interestMonthlyDisplay)),
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
