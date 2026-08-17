import { useState } from 'react';
import { Plus, Banknote, Database, Download, Upload, AlertTriangle, Cloud, User, ArrowRight } from 'lucide-react';
import { supabase } from '../utils/supabase';
import { CURRENCY_SYMBOLS } from '../utils/format';

// Neon Grid design tokens (design_handoff_neon_grid/README.md).
const CYAN = '#7ee9ff';
const MAGENTA = '#ff5fb4';
const AMBER = '#ffc861';
const TEXT_MUTED = '#bab8d8';
const WARNING = '#ff9ed0';
const PANEL_BORDER = 'rgba(255,255,255,0.20)';
const PANEL_BG = '#0b0817';

const ACCENT = { cyan: CYAN, magenta: MAGENTA, amber: AMBER };
const CURRENCIES = ['TRY', 'UAH', 'EUR', 'USD'];

export default function SettingsView({ data, session }) {
    const { addCard, addFund, addOther, currency, setCurrency, exportBackup, importBackup } = data;
    const userEmail = session?.user?.email;
    const isDemo = Boolean(session?.isDemo);

    const [isRestoring, setIsRestoring] = useState(false);
    const [status, setStatus] = useState(null); // 'success' | 'error' | null

    const handleLogout = () => supabase.auth.signOut();

    const handleFileImport = (event) => {
        const file = event.target.files[0];
        if (!file) return;

        setIsRestoring(true);
        setStatus(null);
        const reader = new FileReader();
        reader.onload = (e) => {
            const success = importBackup(e.target.result);
            setIsRestoring(false);
            setStatus(success ? 'success' : 'error');
            setTimeout(() => setStatus(null), 4000);
        };
        reader.onerror = () => {
            setIsRestoring(false);
            setStatus('error');
        };
        reader.readAsText(file);
        // Allow re-selecting the same file later.
        event.target.value = '';
    };

    return (
        <div className="flex flex-col gap-6 pb-10 md:gap-8">
            <header>
                <h1 className="font-display text-[26px] font-bold text-white md:text-[34px]">Settings</h1>
                <p className="mt-2 text-[15px] md:text-[17px]" style={{ color: TEXT_MUTED }}>
                    Add things to track, pick your currency, keep a copy of your data.
                </p>
            </header>

            {/* Add something to track */}
            <section className="border p-5 md:p-6" style={{ borderColor: 'rgba(126,233,255,0.3)', backgroundColor: PANEL_BG }}>
                <div className="mb-2 flex items-center gap-3">
                    <IconSquare icon={Plus} accent="cyan" />
                    <h2 className="font-display text-[19px] font-semibold text-white md:text-[22px]">
                        Add something to track
                    </h2>
                </div>
                <p className="mb-5 text-[15px] md:text-[16px]" style={{ color: TEXT_MUTED }}>
                    New items show up on your Money page straight away.
                </p>
                <div className="grid grid-cols-1 gap-3 md:grid-cols-3 md:gap-[14px]">
                    <AddActionButton
                        accent="magenta"
                        title="Add a card"
                        description="Credit card with a limit and debt"
                        onClick={addCard}
                    />
                    <AddActionButton
                        accent="cyan"
                        title="Add an account"
                        description="Bank balance, cash or salary coming in"
                        onClick={addFund}
                    />
                    <AddActionButton
                        accent="amber"
                        title="Add a bill"
                        description="Something you pay every month"
                        onClick={addOther}
                    />
                </div>
            </section>

            {/* Currency | Your data */}
            <div className="grid grid-cols-1 gap-5 md:grid-cols-2 md:gap-6">
                <PanelCard icon={Banknote} accent="amber" title="Currency">
                    <div className="grid grid-cols-4 gap-2">
                        {CURRENCIES.map((code) => (
                            <CurrencyButton
                                key={code}
                                code={code}
                                selected={currency === code}
                                onClick={() => setCurrency(code)}
                            />
                        ))}
                    </div>
                    <p className="mt-4 text-[13px] leading-relaxed" style={{ color: TEXT_MUTED }}>
                        Every amount in the app is shown in this currency. Nothing is converted — the numbers you
                        typed stay as they are.
                    </p>
                </PanelCard>

                <PanelCard icon={Database} accent="cyan" title="Your data">
                    <button
                        onClick={exportBackup}
                        className="flex h-[58px] w-full items-center justify-between border px-4 font-mono text-[14px] font-semibold uppercase tracking-[0.1em] transition-colors"
                        style={{ borderColor: CYAN, color: CYAN }}
                    >
                        <span className="flex items-center gap-2">
                            <Download size={16} />
                            Download a copy
                        </span>
                        <ArrowRight size={16} />
                    </button>

                    <label className="mt-3 block cursor-pointer">
                        <input type="file" accept=".json" onChange={handleFileImport} className="hidden" />
                        <div
                            className="flex h-[58px] w-full items-center gap-2 border border-dashed px-4 font-mono text-[14px] font-semibold uppercase tracking-[0.1em]"
                            style={{ borderColor: AMBER, color: AMBER }}
                        >
                            <Upload size={16} />
                            {isRestoring ? 'Restoring…' : 'Restore from a file'}
                        </div>
                    </label>

                    {status && (
                        <p className="mt-2 font-mono text-[13px]" style={{ color: status === 'success' ? CYAN : MAGENTA }}>
                            {status === 'success' ? 'Backup restored.' : 'Restore failed — check the file and try again.'}
                        </p>
                    )}

                    <p className="mt-4 flex items-start gap-2 text-[13px] leading-relaxed" style={{ color: WARNING }}>
                        <AlertTriangle size={15} className="mt-0.5 shrink-0" />
                        Restoring replaces everything you have now.
                    </p>
                </PanelCard>
            </div>

            {/* Cloud sync | Account */}
            <div className="grid grid-cols-1 gap-5 md:grid-cols-2 md:gap-6">
                <PanelCard icon={Cloud} accent="cyan" title="Saving to the cloud">
                    <p className="text-[15px]" style={{ color: TEXT_MUTED }}>
                        Your numbers are on your private account.
                    </p>
                    <div
                        className="mt-4 inline-flex h-[30px] w-fit items-center gap-2 border px-3 font-mono text-[12px] uppercase tracking-[0.12em]"
                        style={{ borderColor: CYAN, color: CYAN }}
                    >
                        <span className="h-2 w-2" style={{ backgroundColor: CYAN }} />
                        On
                    </div>
                </PanelCard>

                <PanelCard icon={User} accent="cyan" title={userEmail}>
                    <p className="text-[15px]" style={{ color: TEXT_MUTED }}>
                        {isDemo ? 'Demo account — data resets on sign out.' : 'Synced to your private cloud account.'}
                    </p>
                    <button
                        onClick={handleLogout}
                        className="mt-4 h-[48px] w-fit border px-5 font-mono text-[13px] font-semibold uppercase tracking-[0.12em] transition-colors"
                        style={{ borderColor: MAGENTA, color: MAGENTA }}
                    >
                        Sign out
                    </button>
                </PanelCard>
            </div>
        </div>
    );
}

function IconSquare({ icon, accent, size = 34 }) {
    const Icon = icon;
    const color = ACCENT[accent];
    return (
        <div
            className="flex shrink-0 items-center justify-center border"
            style={{ width: size, height: size, borderColor: color, backgroundColor: `${color}1a` }}
        >
            <Icon size={Math.round(size * 0.5)} style={{ color }} />
        </div>
    );
}

function PanelCard({ icon, accent, title, children }) {
    return (
        <div className="flex flex-col gap-4 border p-5 md:p-6" style={{ borderColor: PANEL_BORDER, backgroundColor: PANEL_BG }}>
            <div className="flex items-center gap-3">
                <IconSquare icon={icon} accent={accent} />
                <h3 className="truncate font-display text-[19px] font-semibold text-white md:text-[20px]">{title}</h3>
            </div>
            <div className="flex flex-col">{children}</div>
        </div>
    );
}

function AddActionButton({ accent, title, description, onClick }) {
    const [hover, setHover] = useState(false);
    const color = ACCENT[accent];
    return (
        <button
            onClick={onClick}
            onMouseEnter={() => setHover(true)}
            onMouseLeave={() => setHover(false)}
            className="flex h-14 items-center justify-between border border-dashed px-4 text-left transition-colors md:h-auto md:flex-col md:items-start md:gap-2 md:px-5 md:py-5"
            style={{ borderColor: color, backgroundColor: hover ? `${color}12` : 'transparent' }}
        >
            <span className="font-mono text-[14px] font-semibold uppercase tracking-[0.14em]" style={{ color }}>
                {title}
            </span>
            <span className="hidden text-[16px] md:block" style={{ color: '#d8d6f0' }}>
                {description}
            </span>
            <ArrowRight size={18} className="md:hidden" style={{ color }} />
        </button>
    );
}

function CurrencyButton({ code, selected, onClick }) {
    return (
        <button
            onClick={onClick}
            className="flex h-[58px] flex-col items-center justify-center gap-1 border font-mono transition-colors md:h-[60px]"
            style={{
                borderColor: selected ? CYAN : 'rgba(255,255,255,0.22)',
                backgroundColor: selected ? 'rgba(126,233,255,0.14)' : 'transparent',
                color: selected ? CYAN : '#d8d6f0',
            }}
        >
            <span className="text-[17px]">{CURRENCY_SYMBOLS[code]}</span>
            <span className="text-[12px] uppercase tracking-[0.14em]">{code}</span>
        </button>
    );
}
