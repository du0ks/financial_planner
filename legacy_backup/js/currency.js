/**
 * Currency Management Module
 * Handles currency formatting and switching
 */

let currentCurrency = 'TRY';
let currentLocale = 'tr-TR';

const CURRENCY_MAP = {
    'TRY': { symbol: '₺', label: 'TRY ₺', locale: 'tr-TR' },
    'UAH': { symbol: '₴', label: 'UAH ₴', locale: 'uk-UA' }
};

/**
 * Initialize currency from settings
 */
function initCurrency() {
    const settings = loadSettings();

    if (settings.currency === 'UAH') {
        currentCurrency = 'UAH';
        currentLocale = 'uk-UA';
        updateCurrencyLabel();
    } else {
        currentCurrency = 'TRY';
        currentLocale = 'tr-TR';
        updateCurrencyLabel();
    }
}

/**
 * Update the currency label in the UI
 */
function updateCurrencyLabel() {
    const label = document.getElementById('currencyLabel');
    if (label) {
        label.innerText = CURRENCY_MAP[currentCurrency].label;
    }
}

/**
 * Toggle between TRY and UAH
 */
function toggleCurrency() {
    if (currentCurrency === 'TRY') {
        currentCurrency = 'UAH';
        currentLocale = 'uk-UA';
    } else {
        currentCurrency = 'TRY';
        currentLocale = 'tr-TR';
    }

    updateCurrencyLabel();
    saveSettings(currentCurrency, currentLocale);

    // Re-render all tables with new currency
    renderCards();
    renderFunds();
    renderOthers();
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
