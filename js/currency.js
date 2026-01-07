/**
 * Currency Management Module
 * Handles currency formatting and switching
 */

let currentCurrency = 'TRY';
let currentLocale = 'tr-TR';

const CURRENCY_MAP = {
    'TRY': { symbol: '₺', label: 'TRY ₺', locale: 'tr-TR' },
    'USD': { symbol: '$', label: 'USD $', locale: 'en-US' },
    'EUR': { symbol: '€', label: 'EUR €', locale: 'de-DE' },
    'GBP': { symbol: '£', label: 'GBP £', locale: 'en-GB' },
    'UAH': { symbol: '₴', label: 'UAH ₴', locale: 'uk-UA' }
};

/**
 * Initialize currency from settings
 */
function initCurrency() {
    const settings = loadSettings();

    if (settings.currency && CURRENCY_MAP[settings.currency]) {
        setCurrency(settings.currency, false);
    } else {
        setCurrency('TRY', false);
    }
}

/**
 * Update the currency label in the UI
 */
function updateCurrencyLabel() {
    // Only needed if we still had the header button, but good to keep for compatibility
    const label = document.getElementById('currencyLabel');
    if (label) {
        label.innerText = CURRENCY_MAP[currentCurrency].label;
    }

    // Update the dropdown in settings if it exists
    const select = document.getElementById('currencySelect');
    if (select) {
        select.value = currentCurrency;
    }
}

/**
 * Set specific currency
 */
function setCurrency(code, save = true) {
    if (!CURRENCY_MAP[code]) return;

    currentCurrency = code;
    currentLocale = CURRENCY_MAP[code].locale;

    updateCurrencyLabel();

    if (save) {
        saveSettings(currentCurrency, currentLocale);

        // Re-render all tables with new currency
        renderCards();
        renderFunds();
        renderOthers();
    }
}

/**
 * Format a number as currency
 */
function formatMoney(amount) {
    return new Intl.NumberFormat(currentLocale, {
        style: 'currency',
        currency: currentCurrency
    }).format(amount);
}
