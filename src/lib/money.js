import Big from 'big.js';

// Every stored amount is an integer count of the currency's minor unit (kuruş, haléř, cent).
// Arithmetic on minor units is exact in plain JS numbers up to 2^53; anything that needs a
// fraction — a rate, a percentage, a gram price — goes through Big and is rounded back to a
// whole minor unit exactly once, at the end.

Big.DP = 30;
Big.RM = Big.roundHalfUp;

const digitsCache = new Map();

export function currencyDigits(code) {
    if (digitsCache.has(code)) return digitsCache.get(code);
    let digits = 2;
    try {
        digits = new Intl.NumberFormat('en', { style: 'currency', currency: code }).resolvedOptions().maximumFractionDigits;
    } catch {
        digits = 2;
    }
    digitsCache.set(code, digits);
    return digits;
}

export function isCurrencyCode(code) {
    if (typeof code !== 'string' || !/^[A-Z]{3}$/.test(code)) return false;
    try {
        new Intl.NumberFormat('en', { style: 'currency', currency: code });
        return true;
    } catch {
        return false;
    }
}

/** Decimal value (Big | string | number) → integer minor units, rounded half up. */
export function toMinor(value, code) {
    const big = value instanceof Big ? value : new Big(value || 0);
    return Number(big.times(new Big(10).pow(currencyDigits(code))).round(0, Big.roundHalfUp).toString());
}

/** Integer minor units → Big decimal in major units. */
export function fromMinor(minor, code) {
    return new Big(minor || 0).div(new Big(10).pow(currencyDigits(code)));
}

/** Multiply minor units by a decimal factor (rate, percentage) and round to a whole minor unit. */
export function scaleMinor(minor, factor) {
    return Number(new Big(minor || 0).times(factor).round(0, Big.roundHalfUp).toString());
}

export const sumMinor = (values) => values.reduce((total, value) => total + (value || 0), 0);

/**
 * Parses what someone types into an amount field. Accepts both "1.234,56" and "1,234.56".
 * A lone separator followed by more digits than the field allows is read as a thousands
 * separator ("1.500" in a money field is 1500), otherwise as the decimal point
 * ("6.800" in a grams field is 6.8). Returns a Big, or null when the text is not a number.
 */
export function parseDecimal(input, maxDecimals = 2) {
    if (input === null || input === undefined) return null;
    if (input instanceof Big) return input;
    if (typeof input === 'number') return Number.isFinite(input) ? new Big(input) : null;

    let text = String(input).trim().replace(/[\s\u00a0\u202f']/g, '');
    const negative = /^-|^\(.*\)$/.test(text);
    text = text.replace(/[^\d.,]/g, '');
    if (!/\d/.test(text)) return null;

    const lastComma = text.lastIndexOf(',');
    const lastDot = text.lastIndexOf('.');
    let integerPart = text;
    let fractionPart = '';

    if (lastComma !== -1 && lastDot !== -1) {
        const decimalIndex = Math.max(lastComma, lastDot);
        integerPart = text.slice(0, decimalIndex).replace(/[.,]/g, '');
        fractionPart = text.slice(decimalIndex + 1);
    } else if (lastComma !== -1 || lastDot !== -1) {
        const separator = lastComma !== -1 ? ',' : '.';
        const pieces = text.split(separator);
        if (pieces.length > 2) {
            integerPart = pieces.join('');
        } else {
            const after = pieces[1];
            if (after.length === 3 && maxDecimals < 3) {
                integerPart = pieces.join('');
            } else if (after.length <= maxDecimals) {
                integerPart = pieces[0];
                fractionPart = after;
            } else {
                return null;
            }
        }
    }

    if (/[.,]/.test(fractionPart) || fractionPart.length > Math.max(maxDecimals, 0)) return null;
    const normalized = `${integerPart || '0'}${fractionPart ? `.${fractionPart}` : ''}`;
    try {
        const big = new Big(normalized);
        return negative ? big.times(-1) : big;
    } catch {
        return null;
    }
}

/** Text → integer minor units of `code`, or null. */
export function parseMoney(input, code) {
    const big = parseDecimal(input, currencyDigits(code));
    return big === null ? null : toMinor(big, code);
}

/** Minor units → plain editable text ("1234.5"), for prefilling an input. */
export function minorToInput(minor, code) {
    if (minor === null || minor === undefined) return '';
    return fromMinor(minor, code).toString();
}

let numberLocale = typeof navigator !== 'undefined' ? navigator.language || 'en-US' : 'en-US';
export const setNumberLocale = (locale) => { if (locale) numberLocale = locale; };
export const getNumberLocale = () => numberLocale;

const formatterCache = new Map();
function formatter(code, fractionDigits) {
    const key = `${numberLocale}|${code}|${fractionDigits}`;
    if (!formatterCache.has(key)) {
        formatterCache.set(key, new Intl.NumberFormat(numberLocale, {
            style: 'currency',
            currency: code,
            currencyDisplay: 'narrowSymbol',
            minimumFractionDigits: fractionDigits,
            maximumFractionDigits: fractionDigits,
        }));
    }
    return formatterCache.get(key);
}

/**
 * Minor units → display string in the amount's own currency. `decimals`: 'auto' shows the
 * fraction only when there is one, 'never' rounds to whole units (totals), 'always' keeps it.
 */
export function formatMoney(minor, code, { decimals = 'auto', signed = false } = {}) {
    if (minor === null || minor === undefined || !code) return '—';
    const digits = currencyDigits(code);
    const value = fromMinor(minor, code);
    let shown = digits;
    if (decimals === 'never') shown = 0;
    if (decimals === 'auto') shown = minor % (10 ** digits) === 0 ? 0 : digits;
    const text = formatter(code, shown).format(Number(value.round(shown, Big.roundHalfUp).toString()));
    return signed && minor > 0 ? `+${text}` : text;
}

export function currencySymbol(code) {
    try {
        const part = new Intl.NumberFormat(numberLocale, { style: 'currency', currency: code, currencyDisplay: 'narrowSymbol' })
            .formatToParts(0).find((p) => p.type === 'currency');
        return part?.value || code;
    } catch {
        return code;
    }
}

export function currencyName(code) {
    try {
        return new Intl.DisplayNames(['en'], { type: 'currency' }).of(code) || code;
    } catch {
        return code;
    }
}

/** Every ISO currency the browser knows about. */
export function allCurrencyCodes() {
    try {
        return Intl.supportedValuesOf('currency');
    } catch {
        return ['CZK', 'EUR', 'GBP', 'PLN', 'TRY', 'UAH', 'USD'];
    }
}

export function formatNumber(value, fractionDigits = 2) {
    return new Intl.NumberFormat(numberLocale, { minimumFractionDigits: 0, maximumFractionDigits: fractionDigits })
        .format(Number(value));
}

export function formatPercent(value, fractionDigits = 1, { signed = false } = {}) {
    // Round first so a tiny negative doesn't print as "-0%".
    const factor = 10 ** (fractionDigits + 2);
    const n = Math.round(Number(value) * factor) / factor || 0;
    const text = new Intl.NumberFormat(numberLocale, { style: 'percent', minimumFractionDigits: fractionDigits, maximumFractionDigits: fractionDigits })
        .format(n);
    return signed && n > 0 ? `+${text}` : text;
}
