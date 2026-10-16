import { useMemo, useState } from 'react';
import { ArrowLeftRight, Coins, LogOut, CreditCard, Download, PiggyBank, Plus, Receipt, Repeat, ShoppingBag, Target, Upload, Wallet, X } from 'lucide-react';
import { useModel, useStoreState } from '../state/hooks';
import { setSetting } from '../state/actions';
import { legacyBackupFor, restore, syncNow } from '../state/store';
import { supabase } from '../state/supabase';
import { isDoc, list, normalizeDoc } from '../lib/doc';
import { migrateLegacy } from '../lib/migrate';
import { pairKey, pairRate } from '../lib/fx';
import { allCurrencyCodes, currencyName, currencySymbol, formatNumber, parseDecimal, setNumberLocale } from '../lib/money';
import { Button, Field, Panel, Row, Select, TextInput, cx, toast } from '../ui/kit';
import { categoryIcon } from '../ui/icons';
import { openSheet } from '../ui/sheets';
import SyncBadge from '../ui/SyncBadge';
import S from '../i18n/strings';

function download(name, data) {
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = name;
    document.body.appendChild(link);
    link.click();
    link.remove();
    window.setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export default function SettingsScreen({ session }) {
    const model = useModel();
    return (
        <div className="flex flex-col gap-6">
            <header>
                <h1 className="font-display text-[26px] font-bold text-white">{S.settings.title}</h1>
            </header>
            <AddAnything />
            <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
                <Currencies model={model} />
                <Rates model={model} />
            </div>
            <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
                <Categories model={model} />
                <Preferences model={model} />
            </div>
            <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
                <Data model={model} session={session} />
                <Account session={session} />
            </div>
        </div>
    );
}

function AddAnything() {
    const items = [
        [S.settings.addExpense, Receipt, () => openSheet('tx')],
        [S.settings.addAccount, Wallet, () => openSheet('account')],
        [S.settings.addCard, CreditCard, () => openSheet('card')],
        [S.settings.addIncome, Repeat, () => openSheet('rule', { type: 'income' })],
        [S.settings.addBill, Repeat, () => openSheet('rule', { type: 'expense' })],
        [S.settings.addGold, Coins, () => openSheet('gold', { type: 'adjust' })],
        [S.settings.addInvestment, PiggyBank, () => openSheet('account', { kind: 'investment' })],
        [S.settings.addPlanned, ShoppingBag, () => openSheet('planned')],
        [S.settings.addGoal, Target, () => openSheet('goal')],
        [S.tx.types.transfer, ArrowLeftRight, () => openSheet('tx', { preset: { type: 'transfer' } })],
    ];
    return (
        <Panel title={S.settings.addTitle}>
            <div className="grid grid-cols-2 gap-2 md:grid-cols-5">
                {items.map(([label, Icon, onClick]) => (
                    <button key={label} type="button" onClick={onClick} className="flex h-14 items-center gap-2 border border-dashed border-neon/50 px-3 text-left text-[14px] text-body transition-colors hover:bg-neon/5">
                        <Icon size={17} className="shrink-0 text-neon" />
                        <span className="leading-tight">{label}</span>
                    </button>
                ))}
            </div>
        </Panel>
    );
}

function Currencies({ model }) {
    const { settings, accounts, doc } = model;
    const [adding, setAdding] = useState('');
    const all = useMemo(() => allCurrencyCodes().filter((c) => !settings.currencies.includes(c)), [settings.currencies]);
    const inUse = (code) => accounts.some((a) => a.currency === code) || list(doc, 'tx').some((t) => t.currency === code) || list(doc, 'rules').some((r) => r.currency === code);
    const option = (code) => ({ value: code, label: `${code} · ${currencySymbol(code)}` });
    return (
        <Panel title={S.settings.currencies} subtitle={S.settings.currenciesExplain}>
            <div className="flex flex-wrap gap-2">
                {settings.currencies.map((code) => (
                    <span key={code} className="inline-flex h-10 items-center gap-2 border border-line-strong pl-3 text-[14px] text-white">
                        <span className="font-mono font-semibold">{code}</span>
                        <span className="text-dim">{currencyName(code)}</span>
                        {code !== settings.displayCurrency && !inUse(code) ? (
                            <button type="button" aria-label={`${S.settings.removeCurrency} ${code}`} className="flex h-full w-9 items-center justify-center text-dim hover:text-hot" onClick={() => setSetting('currencies', settings.currencies.filter((c) => c !== code))}><X size={15} /></button>
                        ) : <span className="w-2" />}
                    </span>
                ))}
            </div>
            <div className="mt-3 flex gap-2">
                <Select value={adding} onChange={setAdding} options={[{ value: '', label: S.settings.addCurrency }, ...all.map((c) => ({ value: c, label: `${c} · ${currencyName(c)}` }))]} />
                <Button icon={Plus} disabled={!adding} onClick={() => { setSetting('currencies', [...settings.currencies, adding]); setAdding(''); }}>{S.common.add}</Button>
            </div>
            <div className="mt-4 grid grid-cols-2 gap-3">
                <Field label={S.settings.display}>
                    <Select value={settings.displayCurrency} onChange={(v) => setSetting('displayCurrency', v)} options={settings.currencies.map(option)} />
                </Field>
                <Field label={S.settings.spending}>
                    <Select value={settings.spendingCurrency} onChange={(v) => setSetting('spendingCurrency', v)} options={settings.currencies.map(option)} />
                </Field>
            </div>
        </Panel>
    );
}

function Rates({ model }) {
    const { settings, market, fx } = model;
    const base = settings.displayCurrency;
    const others = settings.currencies.filter((c) => c !== base);
    const [drafts, setDrafts] = useState({});
    const overrides = settings.fxOverrides || {};

    const save = (code) => {
        const text = drafts[code];
        const key = pairKey(code, base);
        const next = { ...overrides };
        delete next[pairKey(base, code)];
        if (!text || !text.trim()) delete next[key];
        else {
            const value = parseDecimal(text, 8);
            if (!value || value.lte(0)) { toast(S.common.invalidAmount); return; }
            next[key] = value.toString();
        }
        setSetting('fxOverrides', next);
        setDrafts({ ...drafts, [code]: undefined });
        toast(S.tx.saved);
    };

    return (
        <Panel title={S.settings.rates} subtitle={S.settings.ratesExplain(market.date)}>
            {others.length === 0 && <p className="text-[14px] text-dim">—</p>}
            <div className="flex flex-col gap-3">
                {others.map((code) => {
                    const market = pairRate(code, base, { rates: fx.rates });
                    const override = overrides[pairKey(code, base)] || (overrides[pairKey(base, code)] ? String(1 / Number(overrides[pairKey(base, code)])) : null);
                    return (
                        <div key={code} className="grid grid-cols-[1fr_120px_auto] items-end gap-2">
                            <div>
                                <p className="font-mono text-[12px] uppercase tracking-[0.08em] text-muted">{S.settings.pair(code, base)}</p>
                                <p className={cx('tabular font-mono text-[16px]', override ? 'text-dim line-through' : 'text-white')}>{market ? formatNumber(market.toString(), 4) : '—'}</p>
                            </div>
                            <TextInput
                                inputMode="decimal"
                                value={drafts[code] ?? override ?? ''}
                                placeholder={S.settings.override}
                                onChange={(e) => setDrafts({ ...drafts, [code]: e.target.value })}
                                onBlur={() => drafts[code] !== undefined && save(code)}
                                className={override ? 'border-gold text-gold' : ''}
                            />
                            {override ? <Button size="sm" variant="ghost" onClick={() => { setDrafts({ ...drafts, [code]: '' }); const next = { ...overrides }; delete next[pairKey(code, base)]; delete next[pairKey(base, code)]; setSetting('fxOverrides', next); }}>{S.settings.clearOverride}</Button> : <span className="w-2" />}
                        </div>
                    );
                })}
            </div>
        </Panel>
    );
}

function Categories({ model }) {
    const categories = list(model.doc, 'categories').sort((a, b) => Number(Boolean(a.income)) - Number(Boolean(b.income)) || (a.order ?? 0) - (b.order ?? 0));
    return (
        <Panel title={S.settings.categories} subtitle={S.settings.categoriesExplain} bare>
            <div className="max-h-[420px] overflow-y-auto">
                {categories.map((category) => (
                    <Row key={category.id} icon={categoryIcon(category)} iconTone={category.income ? 'neon' : 'muted'} title={category.name} subtitle={category.income ? S.tx.types.income : null} onClick={() => openSheet('category', { category })} />
                ))}
            </div>
            <div className="p-4"><Button variant="dashed" icon={Plus} className="w-full" onClick={() => openSheet('category')}>{S.settings.addCategory}</Button></div>
        </Panel>
    );
}

const LOCALES = [['en-US', '1,234.56'], ['en-GB', '1,234.56'], ['de-DE', '1.234,56'], ['tr-TR', '1.234,56'], ['cs-CZ', '1 234,56'], ['uk-UA', '1 234,56']];

function Preferences({ model }) {
    const { settings, doc } = model;
    const locale = list(doc, 'settings').find((s) => s.id === 'numberLocale')?.value || '';
    return (
        <Panel title={S.settings.rules}>
            <div className="flex flex-col gap-4">
                <Field label={S.settings.bigLimit}>
                    <Select value={String(settings.bigPurchaseLimit)} onChange={(v) => setSetting('bigPurchaseLimit', Number(v))} options={[1, 2, 3].map((n) => ({ value: String(n), label: String(n) }))} />
                </Field>
                <Field label={S.settings.reminderDays}>
                    <Select value={String(settings.snapshotReminderDays)} onChange={(v) => setSetting('snapshotReminderDays', Number(v))} options={[7, 14, 30, 45, 60].map((n) => ({ value: String(n), label: String(n) }))} />
                </Field>
                <Field label={S.settings.numberFormat}>
                    <Select
                        value={locale}
                        onChange={(v) => { setNumberLocale(v || navigator.language); setSetting('numberLocale', v); }}
                        options={[{ value: '', label: `${navigator.language} (device)` }, ...LOCALES.map(([value, sample]) => ({ value, label: `${value} · ${sample}` }))]}
                    />
                </Field>
            </div>
        </Panel>
    );
}

function Data({ model, session }) {
    const backup = session?.isDemo ? null : legacyBackupFor(session?.user?.id);
    const exportAll = () => download(`prosperity_backup_${model.today}.json`, { app: 'prosperity', exportedAt: new Date().toISOString(), doc: model.doc });

    const onFile = (event) => {
        const file = event.target.files?.[0];
        event.target.value = '';
        if (!file) return;
        const reader = new FileReader();
        reader.onload = () => {
            try {
                const json = JSON.parse(String(reader.result));
                // Accepts a v5 export, a bare v5 document, or a backup from the previous version.
                let doc = null;
                if (isDoc(json?.doc)) doc = normalizeDoc(json.doc);
                else if (isDoc(json)) doc = normalizeDoc(json);
                else if (json?.cards || json?.funds) doc = migrateLegacy(json, { at: Date.now() });
                if (!doc) throw new Error('unknown format');
                if (!window.confirm(S.settings.restoreConfirm)) return;
                restore(doc);
                toast(S.settings.restored);
            } catch (error) {
                window.alert(S.settings.restoreFailed(error.message));
            }
        };
        reader.readAsText(file);
    };

    return (
        <Panel title={S.settings.data}>
            <div className="flex flex-col gap-3">
                <Button icon={Download} onClick={exportAll}>{S.settings.download}</Button>
                <label className="flex h-11 cursor-pointer items-center justify-center gap-2 border border-dashed border-gold font-mono text-[14px] font-semibold uppercase tracking-[0.08em] text-gold">
                    <input type="file" accept=".json,application/json" className="hidden" onChange={onFile} />
                    <Upload size={16} />{S.settings.restore}
                </label>
                <p className="text-[13px] text-hot">{S.settings.restoreWarn}</p>
                {backup && (
                    <div className="border-t border-line pt-3">
                        <Button variant="ghost" icon={Download} onClick={() => download(`prosperity_pre_upgrade_${model.today}.json`, backup)}>{S.settings.legacyBackup}</Button>
                        <p className="mt-1 text-[13px] text-dim">{S.settings.legacyBackupExplain}</p>
                    </div>
                )}
            </div>
        </Panel>
    );
}

function Account({ session }) {
    const { sync } = useStoreState();
    const isDemo = Boolean(session?.isDemo);
    return (
        <Panel title={S.settings.cloud}>
            <div className="flex flex-col gap-3">
                <p className="text-[15px] text-body">{isDemo ? S.settings.demo : S.settings.signedInAs(session?.user?.email)}</p>
                {!isDemo && (
                    <div className="flex flex-wrap items-center gap-3">
                        <SyncBadge />
                        <Button size="sm" onClick={syncNow}>{S.sync.now}</Button>
                    </div>
                )}
                {sync.state === 'error' && <p className="text-[13px] text-gold">{S.sync.errorDetail} {sync.error ? `(${sync.error})` : ''}</p>}
                <Button variant="danger" icon={LogOut} className="self-start" onClick={() => supabase.auth.signOut()}>{S.settings.signOut}</Button>
            </div>
        </Panel>
    );
}

