/**
 * Data Management Module
 * Handles all data operations (CRUD operations on cards, funds, and other payments)
 */

// Global data arrays - will be initialized on app start
let cardData = [];
let fundData = [];
let otherData = [];

/**
 * Initialize all data from storage
 */
function initializeData() {
    const data = loadData();
    cardData = data.cards;
    fundData = data.funds;
    otherData = data.others;
}

/**
 * Update card field
 */
function updateCard(index, field, value) {
    if (field === 'limit' || field === 'debt' || field === 'money') {
        cardData[index][field] = parseFloat(value) || 0;
    } else {
        cardData[index][field] = value;
    }
    saveData(cardData, fundData, otherData);
    renderCards();
}

/**
 * Update fund field
 */
function updateFund(index, field, value) {
    if (field === 'amount') {
        fundData[index][field] = parseFloat(value) || 0;
    } else {
        fundData[index][field] = value;
    }
    saveData(cardData, fundData, otherData);
    calculateTotals();
}

/**
 * Update other payment field
 */
function updateOther(index, field, value) {
    if (field === 'amount') {
        otherData[index][field] = parseFloat(value) || 0;
    } else {
        otherData[index][field] = value;
    }
    saveData(cardData, fundData, otherData);
    calculateTotals();
}

/**
 * Add a new row to a table
 */
function addRow(type) {
    if (type === 'cards') {
        cardData.push({ id: Date.now(), name: 'New Card', limit: 0, money: 0, debt: 0 });
        renderCards();
    } else if (type === 'funds') {
        fundData.push({ id: Date.now(), name: 'New Account', amount: 0 });
        renderFunds();
    } else if (type === 'others') {
        otherData.push({ id: Date.now(), name: 'New Payment', amount: 0 });
        renderOthers();
    }
    saveData(cardData, fundData, otherData);
}

/**
 * Remove a card
 */
function removeCard(index) {
    if (confirm('Are you sure you want to delete this card?')) {
        cardData.splice(index, 1);
        saveData(cardData, fundData, otherData);
        renderCards();
    }
}

/**
 * Remove a fund
 */
function removeFund(index) {
    if (confirm('Are you sure you want to delete this account?')) {
        fundData.splice(index, 1);
        saveData(cardData, fundData, otherData);
        renderFunds();
    }
}

/**
 * Remove an other payment
 */
function removeOther(index) {
    if (confirm('Are you sure you want to delete this payment?')) {
        otherData.splice(index, 1);
        saveData(cardData, fundData, otherData);
        renderOthers();
    }
}

/**
 * Calculate all totals and update dashboard
 */
function calculateTotals() {
    const totalLimit = cardData.reduce((sum, item) => sum + (item.limit || 0), 0);

    const totalCardDebt = cardData.reduce((sum, item) => sum + (item.debt || 0), 0);
    const totalOtherDebt = otherData.reduce((sum, item) => sum + (item.amount || 0), 0);
    const totalDebt = totalCardDebt + totalOtherDebt;

    const totalFundCash = fundData.reduce((sum, item) => sum + (item.amount || 0), 0);
    const totalCardMoney = cardData.reduce((sum, item) => sum + (item.money || 0), 0);
    const totalAssets = totalFundCash + totalCardMoney;

    const overallNet = totalAssets - totalDebt;

    const ccNet = cardData.reduce(
        (sum, item) => sum + ((item.money || 0) - (item.debt || 0)),
        0
    );

    updateDashboard(totalLimit, totalDebt, totalAssets, overallNet, ccNet);
}
