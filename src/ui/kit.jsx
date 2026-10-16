import { useEffect, useId, useRef, useState, useSyncExternalStore } from 'react';
import { X } from 'lucide-react';
import { currencyChoices, currencyName, formatMoney } from '../lib/money';
import { useMarket } from '../state/market';
import S from '../i18n/strings';

// Shared building blocks. Every list row in the app is a button that opens an editor sheet
// with its own Save and Delete, so editing and deleting work the same on a phone as on a
// desktop — nothing depends on hover or on screen width.

export function cx(...parts) {
    return parts.filter(Boolean).join(' ');
}

export function Panel({ title, subtitle, right, children, className, tone, id, bare }) {
    const border = { neon: 'border-neon/30', hot: 'border-hot/30', gold: 'border-gold/30' }[tone] || 'border-line';
    return (
        <section id={id} className={cx('border bg-panel', border, className)}>
            {(title || right) && (
                <header className="flex items-start justify-between gap-3 px-4 pt-4 md:px-5 md:pt-5">
                    <div className="min-w-0">
                        {title && <h2 className="font-display text-[19px] font-semibold text-white md:text-[21px]">{title}</h2>}
                        {subtitle && <p className="mt-1 text-[14px] leading-snug text-muted">{subtitle}</p>}
                    </div>
                    {right && <div className="shrink-0">{right}</div>}
                </header>
            )}
            <div className={bare ? '' : 'p-4 md:p-5'}>{children}</div>
        </section>
    );
}

const BUTTON_VARIANTS = {
    primary: 'bg-neon text-[#050409] border-neon hover:bg-white',
    gold: 'bg-gold text-[#100b02] border-gold hover:bg-white',
    outline: 'border-line-strong text-body hover:border-neon hover:text-neon',
    ghost: 'border-transparent text-muted hover:text-white',
    danger: 'border-hot/60 text-hot hover:bg-hot/10',
    dashed: 'border-dashed border-neon/70 text-neon hover:bg-neon/5',
};

export function Button({ variant = 'outline', icon: Icon, children, className, size = 'md', ...props }) {
    const sizes = { sm: 'h-9 px-3 text-[13px]', md: 'h-11 px-4 text-[14px]', lg: 'h-13 px-5 text-[15px]' };
    return (
        <button
            type="button"
            {...props}
            className={cx(
                'inline-flex items-center justify-center gap-2 border font-mono font-semibold uppercase tracking-[0.08em] transition-colors disabled:opacity-40',
                sizes[size], BUTTON_VARIANTS[variant], className,
            )}
        >
            {Icon && <Icon size={size === 'sm' ? 14 : 16} />}
            {children}
        </button>
    );
}

export function IconButton({ icon: Icon, label, onClick, className, tone }) {
    const color = { hot: 'hover:text-hot hover:border-hot', neon: 'hover:text-neon hover:border-neon' }[tone] || 'hover:text-white hover:border-line-strong';
    return (
        <button
            type="button"
            onClick={onClick}
            aria-label={label}
            title={label}
            className={cx('flex h-10 w-10 shrink-0 items-center justify-center border border-line text-muted transition-colors', color, className)}
        >
            <Icon size={17} />
        </button>
    );
}

/** A full-width bottom sheet on phones, a centered dialog on desktop. */
export function Sheet({ title, onClose, children, footer, wide }) {
    const ref = useRef(null);
    useEffect(() => {
        const onKey = (event) => { if (event.key === 'Escape') onClose(); };
        document.addEventListener('keydown', onKey);
        const previous = document.body.style.overflow;
        document.body.style.overflow = 'hidden';
        return () => {
            document.removeEventListener('keydown', onKey);
            document.body.style.overflow = previous;
        };
    }, [onClose]);

    return (
        <div className="fixed inset-0 z-[80] flex items-end justify-center bg-black/70 fade-in md:items-center md:p-6" onMouseDown={(e) => { if (e.target === e.currentTarget) onClose(); }}>
            <div
                ref={ref}
                role="dialog"
                aria-modal="true"
                aria-label={title}
                className={cx('sheet-in flex max-h-[94dvh] w-full flex-col border border-line-strong bg-panel md:max-h-[88vh]', wide ? 'md:max-w-2xl' : 'md:max-w-lg')}
            >
                <header className="flex shrink-0 items-center justify-between gap-3 border-b border-line px-4 py-3">
                    <h2 className="font-display text-[19px] font-semibold text-white">{title}</h2>
                    <IconButton icon={X} label={S.common.close} onClick={onClose} />
                </header>
                <div className="min-h-0 flex-1 overflow-y-auto px-4 py-4">{children}</div>
                {footer && <footer className="safe-bottom shrink-0 border-t border-line px-4 py-3">{footer}</footer>}
            </div>
        </div>
    );
}

/** Save / Delete row for the bottom of an editor sheet. */
export function SheetActions({ onSave, onDelete, saveLabel = S.common.save, disabled }) {
    return (
        <div className="flex items-center gap-3">
            {onDelete && <Button variant="danger" onClick={onDelete}>{S.common.delete}</Button>}
            <Button variant="primary" className="flex-1" onClick={onSave} disabled={disabled}>{saveLabel}</Button>
        </div>
    );
}

export function Field({ label, hint, error, children, className }) {
    const id = useId();
    return (
        <div className={cx('flex flex-col gap-1.5', className)}>
            {label && <label htmlFor={id} className="font-mono text-[12px] uppercase tracking-[0.1em] text-muted">{label}</label>}
            {typeof children === 'function' ? children(id) : children}
            {error ? <p className="text-[13px] text-hot">{error}</p> : hint ? <p className="text-[13px] leading-snug text-dim">{hint}</p> : null}
        </div>
    );
}

const INPUT = 'h-12 w-full min-w-0 border border-line-strong bg-field px-3 text-white outline-none transition-colors focus:border-neon';

export function TextInput({ className, ...props }) {
    return <input type="text" {...props} className={cx(INPUT, className)} />;
}

export function DateInput({ className, ...props }) {
    return <input type="date" {...props} className={cx(INPUT, 'font-mono', className)} />;
}

export function Select({ value, onChange, options, className, ...props }) {
    return (
        <select value={value ?? ''} onChange={(e) => onChange(e.target.value)} {...props} className={cx(INPUT, 'pr-8', className)}>
            {options.map((option) => (
                <option key={option.value ?? ''} value={option.value ?? ''}>{option.label}</option>
            ))}
        </select>
    );
}

/**
 * Currency dropdown: the user's own currencies first, then every other currency with a rate.
 * `mine` is settings.currencies. `named` adds the full name to each option (for wide fields).
 * `onlyMine` leaves out the full list (the header switcher).
 */
export function CurrencySelect({ value, onChange, mine, named, onlyMine, className, ...props }) {
    const { rates } = useMarket();
    const { own, rest } = currencyChoices(mine, rates, value);
    const label = (code) => (named ? `${code} · ${currencyName(code)}` : code);
    return (
        <select value={value} onChange={(e) => onChange(e.target.value)} aria-label={S.common.currency} {...props} className={className ?? cx(INPUT, 'pr-8 font-mono')}>
            {onlyMine ? own.map((code) => <option key={code} value={code}>{label(code)}</option>) : (
                <>
                    <optgroup label={S.common.yourCurrencies}>
                        {own.map((code) => <option key={code} value={code}>{label(code)}</option>)}
                    </optgroup>
                    <optgroup label={S.common.allCurrencies}>
                        {rest.map((code) => <option key={code} value={code}>{named ? label(code) : `${code} · ${currencyName(code)}`}</option>)}
                    </optgroup>
                </>
            )}
        </select>
    );
}

/** Amount text box with its currency beside it. `value` is the raw text being typed. */
export function AmountInput({ value, onChange, currency, onCurrencyChange, currencies, autoFocus, big, placeholder = '0', id, inputRef }) {
    return (
        <div className={cx('flex items-stretch border border-line-strong bg-field focus-within:border-neon', big ? 'h-16' : 'h-12')}>
            <input
                id={id}
                ref={inputRef}
                type="text"
                inputMode="decimal"
                autoComplete="off"
                enterKeyHint="done"
                autoFocus={autoFocus}
                value={value}
                placeholder={placeholder}
                onChange={(e) => onChange(e.target.value)}
                className={cx('tabular w-full min-w-0 flex-1 bg-transparent px-3 text-right font-mono text-white outline-none', big ? 'text-[30px] font-semibold' : 'text-[18px]')}
            />
            {onCurrencyChange ? (
                <CurrencySelect
                    value={currency}
                    onChange={onCurrencyChange}
                    mine={currencies || []}
                    className="w-[78px] shrink-0 border-l border-line-strong bg-raised px-2 font-mono text-[15px] font-semibold text-neon outline-none"
                />
            ) : (
                <span className="flex items-center border-l border-line-strong px-3 font-mono text-[15px] text-muted">{currency}</span>
            )}
        </div>
    );
}

export function Toggle({ checked, onChange, label, hint }) {
    return (
        <label className="flex cursor-pointer items-start gap-3 py-1">
            <span className={cx('relative mt-0.5 inline-flex h-6 w-11 shrink-0 border transition-colors', checked ? 'border-neon bg-neon/25' : 'border-line-strong bg-field')}>
                <input type="checkbox" className="peer sr-only" checked={Boolean(checked)} onChange={(e) => onChange(e.target.checked)} />
                <span className={cx('absolute top-0.5 h-[18px] w-[18px] transition-all', checked ? 'left-[22px] bg-neon' : 'left-0.5 bg-dim')} />
            </span>
            <span className="min-w-0">
                <span className="block text-[15px] text-white">{label}</span>
                {hint && <span className="mt-0.5 block text-[13px] leading-snug text-dim">{hint}</span>}
            </span>
        </label>
    );
}

export function Segmented({ options, value, onChange, className }) {
    return (
        <div className={cx('grid border border-line-strong', className)} style={{ gridTemplateColumns: `repeat(${options.length}, minmax(0, 1fr))` }}>
            {options.map((option) => (
                <button
                    key={option.value}
                    type="button"
                    onClick={() => onChange(option.value)}
                    className={cx('h-11 px-2 font-mono text-[13px] font-semibold uppercase tracking-[0.06em] transition-colors', value === option.value ? 'bg-neon text-[#050409]' : 'text-muted hover:text-white')}
                >
                    {option.label}
                </button>
            ))}
        </div>
    );
}

/** Single-choice chips that scroll sideways on a phone. */
export function Chips({ options, value, onChange, wrap }) {
    return (
        <div className={cx('flex gap-2', wrap ? 'flex-wrap' : '-mx-4 overflow-x-auto px-4 pb-1 [scrollbar-width:none]')}>
            {options.map((option) => {
                const Icon = option.icon;
                const active = value === option.value;
                return (
                    <button
                        key={option.value ?? 'none'}
                        type="button"
                        onClick={() => onChange(option.value)}
                        className={cx('inline-flex h-10 shrink-0 items-center gap-1.5 border px-3 text-[14px] transition-colors', active ? 'border-neon bg-neon/15 text-neon' : 'border-line-strong text-body hover:border-neon/60')}
                    >
                        {Icon && <Icon size={15} />}
                        {option.label}
                    </button>
                );
            })}
        </div>
    );
}

export function Money({ minor, currency, className, decimals, signed, tone }) {
    const color = tone === 'auto' ? (minor < 0 ? 'text-hot' : 'text-white') : { neon: 'text-neon', hot: 'text-hot', gold: 'text-gold', muted: 'text-muted' }[tone] || '';
    return <span className={cx('tabular font-mono', color, className)}>{formatMoney(minor, currency, { decimals, signed })}</span>;
}

/** An amount in its own currency, with the converted value under it when they differ. */
export function DualMoney({ minor, currency, display, displayMinor, className, tone, decimals }) {
    return (
        <span className={cx('flex flex-col items-end leading-tight', className)}>
            <Money minor={minor} currency={currency} tone={tone} decimals={decimals} className="text-[17px]" />
            {display && currency !== display && (
                <span className="tabular font-mono text-[12px] text-dim">{S.common.approx(formatMoney(displayMinor, display, { decimals: 'never' }))}</span>
            )}
        </span>
    );
}

export function Bar({ ratio, tone = 'neon', marker, className }) {
    const fill = { neon: 'bg-neon', hot: 'bg-hot', gold: 'bg-gold' }[tone];
    const width = Math.max(0, Math.min(1, ratio || 0)) * 100;
    return (
        <div className={cx('relative h-2 w-full border border-line bg-raised', className)}>
            <div className={cx('h-full transition-[width] duration-500', fill)} style={{ width: `${width}%` }} />
            {marker !== undefined && marker !== null && (
                <div className="absolute -top-1 h-3.5 w-0.5 bg-white" style={{ left: `calc(${Math.max(0, Math.min(1, marker)) * 100}% - 1px)` }} />
            )}
        </div>
    );
}

/** A tappable list row. The whole row opens the item's editor. */
export function Row({ icon: Icon, iconTone = 'neon', title, subtitle, right, onClick, className, children }) {
    const ring = { neon: 'border-neon/60 text-neon bg-neon/10', hot: 'border-hot/60 text-hot bg-hot/10', gold: 'border-gold/60 text-gold bg-gold/10', muted: 'border-line-strong text-muted' }[iconTone];
    const Tag = onClick ? 'button' : 'div';
    return (
        <Tag
            type={onClick ? 'button' : undefined}
            onClick={onClick}
            className={cx('flex w-full items-center gap-3 border-t border-line px-4 py-3.5 text-left first:border-t-0 md:px-5', onClick && 'transition-colors hover:bg-white/[0.03] active:bg-white/[0.06]', className)}
        >
            {Icon && (
                <span className={cx('flex h-10 w-10 shrink-0 items-center justify-center border', ring)}>
                    <Icon size={18} />
                </span>
            )}
            <span className="min-w-0 flex-1">
                <span className="block truncate text-[16px] text-white">{title}</span>
                {subtitle && <span className="mt-0.5 block truncate text-[13px] text-dim">{subtitle}</span>}
                {children}
            </span>
            {right && <span className="shrink-0 text-right">{right}</span>}
        </Tag>
    );
}

export function Empty({ children }) {
    return <p className="px-4 py-6 text-center text-[14px] text-dim md:px-5">{children}</p>;
}

export function Stat({ label, children, sub, className }) {
    return (
        <div className={cx('border border-line bg-field p-3', className)}>
            <p className="font-mono text-[11px] uppercase tracking-[0.1em] text-muted">{label}</p>
            <div className="mt-1.5 text-[19px] font-semibold text-white">{children}</div>
            {sub && <p className="mt-1 text-[12px] text-dim">{sub}</p>}
        </div>
    );
}

// ---------- toasts ----------

let toastState = null;
const toastListeners = new Set();
let toastTimer = null;

export function toast(message) {
    toastState = { message, id: Date.now() };
    toastListeners.forEach((l) => l());
    window.clearTimeout(toastTimer);
    toastTimer = window.setTimeout(() => {
        toastState = null;
        toastListeners.forEach((l) => l());
    }, 2600);
}

export function Toaster() {
    const current = useSyncExternalStore((l) => { toastListeners.add(l); return () => toastListeners.delete(l); }, () => toastState);
    if (!current) return null;
    return (
        <div role="status" aria-live="polite" className="fade-in fixed inset-x-4 bottom-[96px] z-[90] border border-neon bg-raised px-4 py-3 text-[14px] text-neon md:inset-x-auto md:bottom-8 md:right-8 md:max-w-sm">
            {current.message}
        </div>
    );
}

/** Text state for an amount field, prefilled from minor units. */
export function useAmountText(initial) {
    return useState(initial ?? '');
}
