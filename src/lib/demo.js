import { emptyDoc, put, putSetting } from './doc';
import { withDefaults } from './defaults';
import { addDays, monthOf, today as todayISO } from './dates';

// Sample data for the demo login. Invented numbers, nothing personal.
export function buildDemoDoc(now = new Date()) {
    const at = now.getTime() - 60000;
    const today = todayISO(now);
    const month = monthOf(today);
    let doc = withDefaults(emptyDoc(), { displayCurrency: 'EUR', at });
    doc = putSetting(doc, 'currencies', ['EUR', 'USD', 'GBP'], at);
    doc = putSetting(doc, 'spendingCurrency', 'EUR', at);

    const accounts = [
        { id: 'demo_bank', name: 'Main bank', kind: 'bank', currency: 'EUR', available: true, balance: 245000 },
        { id: 'demo_card', name: 'Visa', kind: 'credit', currency: 'EUR', available: true, linkedAccountId: 'demo_bank', limit: 300000, monthlyRate: '1.5', taxRate: '0', minPaymentPct: '5', balance: -42000 },
        { id: 'demo_cash', name: 'Cash', kind: 'cash', currency: 'EUR', available: true, balance: 8000 },
        { id: 'demo_usd', name: 'USD savings', kind: 'bank', currency: 'USD', available: false, balance: 150000 },
    ];
    accounts.forEach(({ balance, ...account }, order) => {
        doc = put(doc, 'accounts', { ...account, order }, at);
        doc = put(doc, 'anchors', { id: `anchor_${account.id}`, accountId: account.id, amount: balance, date: addDays(today, -10), setAt: at }, at);
    });

    doc = put(doc, 'rules', { id: 'demo_salary', type: 'income', name: 'Salary', amount: 260000, currency: 'EUR', accountId: 'demo_bank', categoryId: 'cat_salary', dayOfMonth: 1, startMonth: month }, at);
    doc = put(doc, 'rules', { id: 'demo_rent', type: 'expense', name: 'Rent', amount: 90000, currency: 'EUR', accountId: 'demo_bank', categoryId: 'cat_housing', dayOfMonth: 3, startMonth: month, variable: false }, at);
    doc = put(doc, 'rules', { id: 'demo_phone', type: 'expense', name: 'Phone', amount: 1500, currency: 'EUR', accountId: 'demo_card', categoryId: 'cat_subscriptions', dayOfMonth: 15, startMonth: month }, at);

    const spend = [
        ['cat_groceries', 4320, -6], ['cat_groceries', 2875, -3], ['cat_dining', 1850, -2],
        ['cat_transport', 1200, -5], ['cat_personal', 990, -1],
    ];
    spend.forEach(([categoryId, amount, offset], i) => {
        doc = put(doc, 'tx', { id: `demo_tx_${i}`, type: 'expense', date: addDays(today, offset), amount, currency: 'EUR', accountId: i % 2 ? 'demo_card' : 'demo_bank', categoryId, createdAt: at + i + 10 }, at + i + 10);
    });

    for (const [categoryId, amount] of [['cat_groceries', 35000], ['cat_dining', 10000], ['cat_transport', 5000], ['cat_personal', 4000]]) {
        doc = put(doc, 'budgets', { id: `budget_${categoryId}`, categoryId, amount, currency: 'EUR' }, at);
    }
    doc = put(doc, 'goldEvents', { id: 'demo_gold', type: 'buy', date: addDays(today, -90), mg: 10000, portionId: 'portion_longterm', price: 95000, currency: 'EUR' }, at);
    return doc;
}
