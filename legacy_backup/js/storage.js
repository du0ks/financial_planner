/**
 * Storage Management Module
 * Handles all localStorage operations for the Finance Tracker
 */

const STORAGE_KEY = 'financeTracker_local_v1';
const SETTINGS_KEY = 'financeTracker_settings_v1';

/**
 * Initialize default data for a fresh start
 */
function getDefaultData() {
    return {
        cards: [
            { id: 1, name: 'Card A (Main Card)', limit: 15000, money: 2000, debt: 3500 },
            { id: 2, name: 'Card B (Backup)', limit: 5000, money: 0, debt: 0 },
            { id: 3, name: 'Card C', limit: 2500, money: 500, debt: 1250 }
        ],
        funds: [
            { id: 101, name: 'Salary Account', amount: 8500 },
            { id: 102, name: 'Savings Account', amount: 12000 },
            { id: 103, name: 'Wallet / Cash', amount: 450 }
        ],
        others: [
            { id: 201, name: 'Rent', amount: 0 },
            { id: 202, name: 'Dorm / Tuition', amount: 0 }
        ]
    };
}

/**
 * Normalize card data for type consistency
 */
function normalizeCardData(cardData) {
    return cardData.map(c => ({
        id: c.id,
        name: c.name,
        limit: typeof c.limit === 'number' ? c.limit : parseFloat(c.limit) || 0,
        debt: typeof c.debt === 'number' ? c.debt : parseFloat(c.debt) || 0,
        money: typeof c.money === 'number' ? c.money : parseFloat(c.money) || 0
    }));
}

/**
 * Load all data from localStorage
 */
function loadData() {
    const savedData = localStorage.getItem(STORAGE_KEY);
    const parsedData = savedData ? JSON.parse(savedData) : null;

    const defaultData = getDefaultData();

    return {
        cards: normalizeCardData(parsedData?.cards || defaultData.cards),
        funds: parsedData?.funds || defaultData.funds,
        others: parsedData?.others || defaultData.others
    };
}

/**
 * Save all data to localStorage
 */
function saveData(cardData, fundData, otherData) {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({
        cards: cardData,
        funds: fundData,
        others: otherData
    }));
}

/**
 * Save user settings
 */
function saveSettings(currency, locale) {
    localStorage.setItem(SETTINGS_KEY, JSON.stringify({
        currency: currency,
        locale: locale
    }));
}

/**
 * Load user settings
 */
function loadSettings() {
    const raw = localStorage.getItem(SETTINGS_KEY);
    if (!raw) {
        return { currency: 'TRY', locale: 'tr-TR' };
    }
    try {
        return JSON.parse(raw);
    } catch (e) {
        console.error('Settings parse error:', e);
        return { currency: 'TRY', locale: 'tr-TR' };
    }
}
