import { useEffect } from 'react';
import { CalendarRange, Coins, CreditCard, LineChart, Plus, Receipt, Settings, Wallet } from 'lucide-react';
import { useModel } from '../state/hooks';
import { setSetting } from '../state/actions';
import { CurrencySelect, cx } from './kit';
import SyncBadge from './SyncBadge';
import { hasDebtsTab } from './nav';
import { openSheet } from './sheets';
import S from '../i18n/strings';

export const TABS = [
    { key: 'money', label: S.nav.money, icon: Wallet },
    { key: 'spend', label: S.nav.spend, icon: Receipt },
    { key: 'plan', label: S.nav.plan, icon: CalendarRange },
    { key: 'gold', label: S.nav.invest, icon: Coins, amber: true },
    { key: 'debts', label: S.nav.debts, icon: CreditCard, hot: true },
    { key: 'insights', label: S.nav.insights, icon: LineChart },
];

const tone = (t) => (t.amber ? 'border-gold text-gold' : t.hot ? 'border-hot text-hot' : 'border-neon text-neon');

function CurrencySwitcher() {
    const { settings } = useModel();
    return (
        <CurrencySelect
            aria-label={S.settings.display}
            value={settings.displayCurrency}
            onChange={(code) => setSetting('displayCurrency', code)}
            mine={settings.currencies}
            onlyMine
            className="h-9 w-[74px] border border-neon/60 bg-neon/10 px-2 font-mono text-[14px] font-semibold text-neon outline-none"
        />
    );
}

export default function Layout({ tab, onTab, children, email }) {
    const model = useModel();
    const debtsTab = hasDebtsTab(model);
    const tabs = TABS.filter((t) => t.key !== 'debts' || debtsTab);
    // The last debt was resolved while on the Debts tab: go back to Money.
    useEffect(() => { if (tab === 'debts' && !debtsTab) onTab('money'); }, [tab, debtsTab, onTab]);
    const showAdd = tab === 'money' || tab === 'spend';
    return (
        <div className="flex min-h-screen flex-col">
            <header className="safe-top sticky top-0 z-40 border-b border-line bg-bg/95 backdrop-blur">
                <div className="mx-auto flex h-14 max-w-6xl items-center justify-between gap-3 px-4 md:h-16 md:px-7">
                    <button type="button" onClick={() => onTab('money')} className="flex items-center gap-2.5">
                        <span className="flex h-8 w-8 items-center justify-center border border-neon bg-neon/10"><Wallet size={16} className="text-neon" /></span>
                        <span className="font-display text-[16px] font-bold uppercase tracking-[0.2em] text-white">{S.app.name}</span>
                    </button>
                    <div className="flex items-center gap-3">
                        <SyncBadge compact />
                        <span className="hidden font-mono text-[13px] text-dim lg:inline">{email}</span>
                        <CurrencySwitcher />
                        <button type="button" aria-label={S.nav.settings} onClick={() => onTab('settings')} className={cx('flex h-9 w-9 items-center justify-center border', tab === 'settings' ? 'border-neon text-neon' : 'border-line-strong text-muted hover:text-white')}>
                            <Settings size={17} />
                        </button>
                    </div>
                </div>
                <nav className="mx-auto hidden max-w-6xl gap-1 px-7 md:flex">
                    {tabs.map((t) => (
                        <button
                            key={t.key}
                            type="button"
                            onClick={() => onTab(t.key)}
                            aria-current={tab === t.key ? 'page' : undefined}
                            className={cx('border-b-[3px] px-4 py-3 font-mono text-[13px] font-semibold uppercase tracking-[0.12em] transition-colors',
                                tab === t.key ? tone(t) : 'border-transparent text-dim hover:text-white')}
                        >
                            {t.label}
                        </button>
                    ))}
                </nav>
            </header>

            <main className="mx-auto w-full max-w-6xl flex-1 px-4 pb-36 pt-5 md:px-7 md:pb-16 md:pt-8">{children}</main>

            {showAdd && (
                <button
                    type="button"
                    aria-label={S.tx.newExpense}
                    onClick={() => openSheet('tx')}
                    className="fixed bottom-[84px] right-4 z-50 flex h-14 items-center gap-2 border border-neon bg-neon px-5 font-mono text-[14px] font-semibold uppercase tracking-[0.08em] text-[#050409] shadow-[0_0_24px_rgba(126,233,255,0.35)] md:bottom-8 md:right-8"
                    style={{ marginBottom: 'env(safe-area-inset-bottom)' }}
                >
                    <Plus size={20} />{S.spend.add}
                </button>
            )}

            <nav className="safe-bottom fixed inset-x-0 bottom-0 z-40 grid border-t border-line bg-[#06040e] md:hidden" style={{ gridTemplateColumns: `repeat(${tabs.length}, minmax(0, 1fr))` }}>
                {tabs.map((t) => {
                    const Icon = t.icon;
                    const active = tab === t.key;
                    return (
                        <button
                            key={t.key}
                            type="button"
                            onClick={() => onTab(t.key)}
                            aria-current={active ? 'page' : undefined}
                            className={cx('flex h-[68px] flex-col items-center justify-center gap-1 border-t-[3px]', active ? tone(t) : 'border-transparent text-dim')}
                        >
                            <Icon size={20} />
                            <span className="font-mono text-[10px] uppercase tracking-[0.06em]">{t.label}</span>
                        </button>
                    );
                })}
            </nav>
        </div>
    );
}
