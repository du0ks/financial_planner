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
