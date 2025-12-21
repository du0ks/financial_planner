/**
 * UI Module
 * Handles all DOM manipulation and UI rendering
 */

/**
 * Shrink text to fit container width
 */
function fitTextToContainer(el, maxPx = 26, minPx = 12) {
    if (!el) return;
    const parent = el.parentElement;
    if (!parent) return;

    let size = maxPx;
    el.style.fontSize = size + 'px';

    while (size > minPx && el.scrollWidth > parent.clientWidth) {
        size -= 1;
        el.style.fontSize = size + 'px';
    }
}

/**
 * Shrink all summary text values if needed
 */
function shrinkSummaryText() {
    ['totalDebtDisplay', 'totalCashDisplay', 'totalLimitDisplay', 'ccNetDisplay', 'netWorthDisplay']
        .forEach(id => {
            const el = document.getElementById(id);
            if (el) fitTextToContainer(el, 26, 12);
        });
}

/**
 * Render credit cards table
 */
function renderCards() {
    const tbody = document.getElementById('cardsBody');
    tbody.innerHTML = '';
    
    cardData.forEach((card, index) => {
        const money = card.money || 0;
        const remainingLimit = (card.limit || 0) - (card.debt || 0);
        const cardNet = money - (card.debt || 0);

        const cardNetClass = cardNet < 0
            ? 'text-red-600 dark:text-red-400 font-bold'
            : cardNet > 0
                ? 'text-green-600 dark:text-green-400 font-bold'
                : 'text-gray-700 dark:text-gray-300';

        const cardNetText = (cardNet > 0 ? '+' : '') + formatMoney(cardNet);
        const remainingClass = remainingLimit < 0
            ? 'text-red-500 dark:text-red-400 font-bold'
            : 'text-green-600 dark:text-green-400';

        const row = document.createElement('tr');
        row.className = 'border-b hover:bg-gray-50 dark:hover:bg-gray-700 dark:border-gray-600 transition';
        row.innerHTML = `
            <td class="p-3" data-label="Card / Account">
                <input type="text"
                       value="${card.name}"
                       onchange="updateCard(${index}, 'name', this.value)"
                       class="input-cell font-medium text-gray-800 dark:text-gray-200">
            </td>
            <td class="p-3" data-label="Limit">
                <input type="number"
                       value="${card.limit}"
                       onchange="updateCard(${index}, 'limit', this.value)"
                       class="input-cell text-gray-600 dark:text-gray-400">
            </td>
            <td class="p-3" data-label="Current Money">
                <input type="number"
                       value="${money}"
                       onchange="updateCard(${index}, 'money', this.value)"
                       class="input-cell text-blue-600 dark:text-blue-400 font-semibold">
            </td>
            <td class="p-3" data-label="Current Debt">
                <input type="number"
                       value="${card.debt}"
                       onchange="updateCard(${index}, 'debt', this.value)"
                       class="input-cell text-red-600 dark:text-red-400 font-semibold">
            </td>
            <td class="p-3 font-mono text-sm ${remainingClass}" data-label="Remaining Limit">
                ${formatMoney(remainingLimit)}
            </td>
            <td class="p-3 font-mono text-sm ${cardNetClass}" data-label="Card Net">
                ${cardNetText}
            </td>
            <td class="p-3 text-right" data-label="">
                <button onclick="removeCard(${index})" class="text-gray-400 hover:text-red-500 dark:text-gray-500 dark:hover:text-red-400">
                    <i class="fa-solid fa-trash"></i>
                </button>
            </td>
        `;
        tbody.appendChild(row);
    });
    calculateTotals();
}

/**
 * Render funds/assets table
 */
function renderFunds() {
    const tbody = document.getElementById('fundsBody');
    tbody.innerHTML = '';

    fundData.forEach((fund, index) => {
        const row = document.createElement('tr');
        row.className = 'border-b hover:bg-gray-50 dark:hover:bg-gray-700 dark:border-gray-600 transition';
        row.innerHTML = `
            <td class="p-3">
                <input type="text"
                       value="${fund.name}"
                       onchange="updateFund(${index}, 'name', this.value)"
                       class="input-cell font-medium text-gray-800 dark:text-gray-200">
            </td>
            <td class="p-3">
                <input type="number"
                       value="${fund.amount}"
                       oninput="updateFund(${index}, 'amount', this.value)"
                       class="input-cell text-blue-600 dark:text-blue-400 font-semibold">
            </td>
            <td class="p-3 text-right">
                <button onclick="removeFund(${index})" class="text-gray-400 hover:text-red-500 dark:text-gray-500 dark:hover:text-red-400">
                    <i class="fa-solid fa-trash"></i>
                </button>
            </td>
        `;
        tbody.appendChild(row);
    });
    calculateTotals();
}

/**
 * Render other payments table
 */
function renderOthers() {
    const tbody = document.getElementById('othersBody');
    tbody.innerHTML = '';

    otherData.forEach((item, index) => {
        const row = document.createElement('tr');
        row.className = 'border-b hover:bg-gray-50 dark:hover:bg-gray-700 dark:border-gray-600 transition';
        row.innerHTML = `
            <td class="p-3">
                <input type="text"
                       value="${item.name}"
                       onchange="updateOther(${index}, 'name', this.value)"
                       class="input-cell font-medium text-gray-800 dark:text-gray-200">
            </td>
            <td class="p-3">
                <input type="number"
                       value="${item.amount}"
                       oninput="updateOther(${index}, 'amount', this.value)"
                       class="input-cell text-red-600 dark:text-red-400 font-semibold">
            </td>
            <td class="p-3 text-right">
                <button onclick="removeOther(${index})" class="text-gray-400 hover:text-red-500 dark:text-gray-500 dark:hover:text-red-400">
                    <i class="fa-solid fa-trash"></i>
                </button>
            </td>
        `;
        tbody.appendChild(row);
    });
    calculateTotals();
}

/**
 * Update summary dashboard with calculated values
 */
function updateDashboard(totalLimit, totalDebt, totalAssets, overallNet, ccNet) {
    document.getElementById('totalLimitDisplay').innerText = formatMoney(totalLimit);
    document.getElementById('totalDebtDisplay').innerText = formatMoney(totalDebt);
    document.getElementById('totalCashDisplay').innerText = formatMoney(totalAssets);

    const netEl = document.getElementById('netWorthDisplay');
    const statusCard = document.getElementById('netStatusCard');
    const statusMsg = document.getElementById('statusMessage');

    netEl.innerText = (overallNet > 0 ? '+' : '') + formatMoney(overallNet);

    if (overallNet >= 0) {
        statusCard.className = "bg-green-50 dark:bg-green-900/20 p-4 rounded-lg border border-green-200 dark:border-green-900 shadow-sm relative overflow-hidden flex flex-col";
        netEl.className = "summary-value font-bold text-green-700 dark:text-green-300";
        statusMsg.innerText = "Status: Positive (You are safe)";
        statusMsg.className = "text-xs mt-2 text-green-600 dark:text-green-400 text-center";
    } else {
        statusCard.className = "bg-red-50 dark:bg-red-900/20 p-4 rounded-lg border border-red-200 dark:border-red-900 shadow-sm relative overflow-hidden flex flex-col";
        netEl.className = "summary-value font-bold text-red-700 dark:text-red-300";
        statusMsg.innerText = "Status: Negative (Attention needed)";
        statusMsg.className = "text-xs mt-2 text-red-600 dark:text-red-400 text-center";
    }

    const ccNetEl = document.getElementById('ccNetDisplay');
    const ccStatusText = document.getElementById('ccStatusText');

    ccNetEl.innerText = (ccNet > 0 ? '+' : '') + formatMoney(ccNet);
    if (ccNet > 0) {
        ccNetEl.className = "summary-value font-bold text-green-700 dark:text-green-300";
        ccStatusText.innerText = "Overall positive card position.";
    } else if (ccNet < 0) {
        ccNetEl.className = "summary-value font-bold text-red-700 dark:text-red-300";
        ccStatusText.innerText = "Overall negative card position.";
    } else {
        ccNetEl.className = "summary-value font-bold text-gray-700 dark:text-gray-300";
        ccStatusText.innerText = "Cards are balanced (0 net).";
    }

    shrinkSummaryText();
}
