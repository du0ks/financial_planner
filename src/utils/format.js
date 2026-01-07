const CURRENCY_CONFIG = {
    TRY: { locale: 'tr-TR', currency: 'TRY' },
    UAH: { locale: 'uk-UA', currency: 'UAH' },
    USD: { locale: 'en-US', currency: 'USD' },
    EUR: { locale: 'de-DE', currency: 'EUR' }
};

export const formatMoney = (amount, currencyCode = 'TRY') => {
    const config = CURRENCY_CONFIG[currencyCode] || CURRENCY_CONFIG.TRY;

    return new Intl.NumberFormat(config.locale, {
        style: 'currency',
        currency: config.currency,
        minimumFractionDigits: 0,
        maximumFractionDigits: 0
    }).format(amount);
};

/**
 * Sanitizes input strings like "1,000.50" or "1.000,50" into a standard float.
 * Handles user-reported case: "1,000" -> 1000, "1000,68" -> 1000.68.
 */
export const parseCloudNumber = (val) => {
    if (val === null || val === undefined || val === '') return 0;
    if (typeof val === 'number') return val;

    // 1. Remove all characters except digits, dots, commas, and minus sign
    let cleaned = val.toString().replace(/[^\d.,-]/g, '');

    // 2. Locate separators
    const lastComma = cleaned.lastIndexOf(',');
    const lastDot = cleaned.lastIndexOf('.');
    const lastSepIdx = Math.max(lastComma, lastDot);

    if (lastSepIdx === -1) return parseFloat(cleaned) || 0;

    // 3. Heuristic: if a separator is followed by exactly 3 digits, it's likely a thousands separator.
    // Otherwise, treat it as a decimal separator.
    const digitsAfter = cleaned.length - 1 - lastSepIdx;

    if (digitsAfter === 3) {
        // Thousands separator -> strip it and everything else
        return parseFloat(cleaned.replace(/[.,]/g, '')) || 0;
    } else {
        // Decimal separator -> strip all other separators, Replace this one with a dot
        const parts = [
            cleaned.substring(0, lastSepIdx).replace(/[.,]/g, ''),
            cleaned.substring(lastSepIdx + 1)
        ];
        return parseFloat(parts.join('.')) || 0;
    }
};
