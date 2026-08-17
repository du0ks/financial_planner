import { useState } from 'react';
import { Wallet, User, LogOut, ChevronsUpDown, Coins, LineChart, Settings as SettingsIcon } from 'lucide-react';
import { supabase } from '../utils/supabase';
import { CURRENCY_SYMBOLS } from '../utils/format';
import InstallHint from './InstallHint';

// Neon Grid design tokens (design_handoff_neon_grid/README.md).
const CYAN = '#7ee9ff';
const MAGENTA = '#ff5fb4';
const AMBER = '#ffc861';
const TEXT_DIM = '#a6a4c4';
const FRAME_BORDER = 'rgba(126,233,255,0.22)';

// Tabs covered by the Neon Grid redesign. Two tabs are deliberately left out for now:
//
// - 'expenses' (Spending): closing this feature for 2-3 months at the client's request.
//   Restore by uncommenting this entry, its case in App.jsx's renderContent(), and the
//   ExpensesView import there.
// - 'planner' (Planner): still WIP, not ready to ship. Same restore steps, pointing at
//   the 'planner' case and PlannerView import in App.jsx instead.
const NAV_TABS = [
    { key: 'dashboard', desktopLabel: 'Money', mobileLabel: 'Money', mobileIcon: Wallet },
    { key: 'investments', desktopLabel: 'Investments', mobileLabel: 'Gold', mobileIcon: Coins, accent: 'amber' },
    // { key: 'expenses', desktopLabel: 'Spending', mobileLabel: 'Spend', mobileIcon: Receipt },
    { key: 'history', desktopLabel: 'History', mobileLabel: 'History', mobileIcon: LineChart },
    // { key: 'planner', desktopLabel: 'Planner', mobileLabel: 'Plan', mobileIcon: Flag },
    { key: 'settings', desktopLabel: 'Settings', mobileLabel: 'You', mobileIcon: SettingsIcon },
];

export default function Layout({ children, activeTab, onTabChange, currency, userEmail }) {
    const handleLogout = () => supabase.auth.signOut();
    const currencySymbol = CURRENCY_SYMBOLS[currency] || '';

    return (
        <div
            className="min-h-screen w-full flex flex-col font-sans text-white"
            style={{ backgroundColor: '#07050e', border: `1px solid ${FRAME_BORDER}` }}
        >
            {/* Desktop header — replaced on mobile by the bottom brand bar + tab bar below */}
            <header className="hidden md:block h-[76px] shrink-0" style={{ borderBottom: `1px solid ${FRAME_BORDER}` }}>
                <div className="max-w-6xl mx-auto h-full flex items-center justify-between px-[28px]">
                    <div className="flex items-center gap-3">
                        <div
                            className="w-10 h-10 flex items-center justify-center border shrink-0"
                            style={{ borderColor: CYAN, backgroundColor: 'rgba(126,233,255,0.1)' }}
                        >
                            <Wallet size={21} style={{ color: CYAN }} />
                        </div>
                        <span className="font-display font-bold text-[21px] tracking-[0.24em] uppercase text-white">
                            Prosperity
                        </span>
                    </div>

                    <div className="flex items-center gap-3">
                        <div className="h-[42px] flex items-center gap-2 px-3 border border-white/20">
                            <User size={15} style={{ color: TEXT_DIM }} />
                            <span className="font-mono text-[14px]" style={{ color: TEXT_DIM }}>{userEmail}</span>
                        </div>

                        {/* Display-only per spec: currency is now set from Settings, not cycled here. */}
                        <div
                            className="h-[42px] flex items-center gap-1.5 px-3 border font-mono text-[14px] font-semibold"
                            style={{ borderColor: CYAN, backgroundColor: 'rgba(126,233,255,0.12)', color: CYAN }}
                        >
                            <span>{currencySymbol} {currency}</span>
                            <ChevronsUpDown size={13} />
                        </div>

                        <SignOutButton onClick={handleLogout} />
                    </div>
                </div>
            </header>

            {/* Desktop nav row */}
            <nav className="hidden md:block shrink-0" style={{ borderBottom: `1px solid ${FRAME_BORDER}` }}>
                <div className="max-w-6xl mx-auto flex gap-[6px] px-[28px]">
                    {NAV_TABS.map((tab) => (
                        <NavTab
                            key={tab.key}
                            active={activeTab === tab.key}
                            amber={tab.accent === 'amber'}
                            onClick={() => onTabChange(tab.key)}
                            label={tab.desktopLabel}
                        />
                    ))}
                </div>
            </nav>

            {/* Content */}
            <main className="flex-1 mx-auto w-full max-w-6xl px-4 pt-6 pb-[148px] md:px-[28px] md:pt-[32px] md:pb-[44px] animate-fade-in">
                {children}
            </main>

            {/* Mobile brand bar + bottom tab bar, replacing the desktop header/nav below md */}
            <div className="md:hidden fixed inset-x-0 bottom-0 z-40">
                <div
                    className="h-16 flex items-center justify-between px-4"
                    style={{ backgroundColor: '#07050e', borderTop: `1px solid ${FRAME_BORDER}` }}
                >
                    <div className="flex items-center gap-2">
                        <div
                            className="w-8 h-8 flex items-center justify-center border shrink-0"
                            style={{ borderColor: CYAN, backgroundColor: 'rgba(126,233,255,0.1)' }}
                        >
                            <Wallet size={16} style={{ color: CYAN }} />
                        </div>
                        <span className="font-display font-bold text-[15px] tracking-[0.2em] uppercase text-white">
                            Prosperity
                        </span>
                    </div>

                    <div
                        className="h-[46px] flex items-center gap-1.5 px-3 border font-mono text-[13px] font-semibold"
                        style={{ borderColor: CYAN, backgroundColor: 'rgba(126,233,255,0.12)', color: CYAN }}
                    >
                        <span>{currencySymbol} {currency}</span>
                    </div>
                </div>

                <div
                    className="h-[68px] grid"
                    style={{
                        gridTemplateColumns: `repeat(${NAV_TABS.length}, minmax(0, 1fr))`,
                        backgroundColor: '#06040e',
                        borderTop: `1px solid ${FRAME_BORDER}`,
                    }}
                >
                    {NAV_TABS.map((tab) => (
                        <MobileTab
                            key={tab.key}
                            active={activeTab === tab.key}
                            amber={tab.accent === 'amber'}
                            onClick={() => onTabChange(tab.key)}
                            label={tab.mobileLabel}
                            mobileIcon={tab.mobileIcon}
                        />
                    ))}
                </div>
            </div>

            {/* PWA Install Guide */}
            <InstallHint />
        </div>
    );
}

function SignOutButton({ onClick }) {
    const [hover, setHover] = useState(false);
    return (
        <button
            onClick={onClick}
            onMouseEnter={() => setHover(true)}
            onMouseLeave={() => setHover(false)}
            className="w-[42px] h-[42px] flex items-center justify-center border transition-colors"
            style={{ borderColor: hover ? MAGENTA : 'rgba(255,255,255,0.2)' }}
            title="Sign out"
        >
            <LogOut size={18} style={{ color: hover ? MAGENTA : TEXT_DIM }} />
        </button>
    );
}

function NavTab({ active, amber, onClick, label }) {
    const activeColor = amber ? AMBER : CYAN;
    return (
        <button
            onClick={onClick}
            aria-current={active ? 'page' : undefined}
            className="font-mono font-semibold text-[14px] tracking-[0.14em] uppercase whitespace-nowrap outline-none transition-colors"
            style={{
                padding: '16px 18px',
                borderBottom: `3px solid ${active ? activeColor : 'transparent'}`,
                color: active ? activeColor : TEXT_DIM,
            }}
            onMouseEnter={(e) => { if (!active) e.currentTarget.style.color = '#ffffff'; }}
            onMouseLeave={(e) => { if (!active) e.currentTarget.style.color = TEXT_DIM; }}
        >
            {label}
        </button>
    );
}

function MobileTab({ active, amber, onClick, label, mobileIcon }) {
    // eslint's no-unused-vars only ignores capitalized *variables* (varsIgnorePattern), not
    // capitalized destructured *params* — routing the icon component through a const here
    // (instead of destructuring it directly as `Icon`) keeps the JSX-as-tag usage recognized.
    const Icon = mobileIcon;
    const activeColor = amber ? AMBER : CYAN;
    return (
        <button
            onClick={onClick}
            aria-current={active ? 'page' : undefined}
            className="flex flex-col items-center justify-center gap-[6px] outline-none"
            style={{
                borderTop: `3px solid ${active ? activeColor : 'transparent'}`,
                color: active ? activeColor : TEXT_DIM,
            }}
        >
            <Icon size={20} />
            <span className="font-mono text-[11px] tracking-[0.08em] uppercase">{label}</span>
        </button>
    );
}
