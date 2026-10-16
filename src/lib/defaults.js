import { put, putSetting } from './doc';

// Starter records every new document gets. Ids are fixed so that two devices creating them
// independently produce the same records and merge cleanly.

export const DEFAULT_CATEGORIES = [
    { id: 'cat_housing', name: 'Housing', icon: 'home' },
    { id: 'cat_groceries', name: 'Groceries', icon: 'cart' },
    { id: 'cat_canteen', name: 'Canteen', icon: 'utensils' },
    { id: 'cat_dining', name: 'Dining out', icon: 'coffee' },
    { id: 'cat_personal', name: 'Personal care', icon: 'sparkles' },
    { id: 'cat_subscriptions', name: 'Subscriptions', icon: 'repeat' },
    { id: 'cat_transport', name: 'Transport', icon: 'bus' },
    { id: 'cat_clothing', name: 'Clothing', icon: 'shirt' },
    { id: 'cat_electronics', name: 'Electronics', icon: 'headphones' },
    { id: 'cat_household', name: 'Household', icon: 'sofa' },
    { id: 'cat_travel', name: 'Travel', icon: 'plane' },
    { id: 'cat_health', name: 'Health', icon: 'heart' },
    { id: 'cat_fees', name: 'Card interest & fees', icon: 'percent', system: true },
    { id: 'cat_other', name: 'Other', icon: 'dots' },
    { id: 'cat_salary', name: 'Salary', icon: 'briefcase', income: true },
    { id: 'cat_income_other', name: 'Other income', icon: 'plus', income: true },
];

export const DEFAULT_PORTIONS = [
    { id: 'portion_available', name: 'Touchable', available: true, order: 0 },
    { id: 'portion_longterm', name: 'Long-term', available: false, order: 1 },
];

export const FEES_CATEGORY = 'cat_fees';

export function withDefaults(doc, { displayCurrency, at }) {
    let next = doc;
    DEFAULT_CATEGORIES.forEach((category, order) => {
        if (!next.categories[category.id]) next = put(next, 'categories', { ...category, order }, at);
    });
    for (const portion of DEFAULT_PORTIONS) {
        if (!next.portions[portion.id]) next = put(next, 'portions', portion, at);
    }
    if (displayCurrency) {
        const defaults = {
            displayCurrency,
            // USD is everyone's second currency: subscriptions, savings, prices online.
            currencies: displayCurrency === 'USD' ? ['USD'] : [displayCurrency, 'USD'],
            spendingCurrency: displayCurrency,
            fxOverrides: {},
        };
        for (const [key, value] of Object.entries(defaults)) {
            if (!next.settings[key]) next = putSetting(next, key, value, at);
        }
    }
    return next;
}
