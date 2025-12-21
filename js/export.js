/**
 * Export Module
 * Handles data export functionality (CSV/Excel)
 */

/**
 * Export all data to CSV format
 */
function exportToCSV() {
    let csvContent = "data:text/csv;charset=utf-8,";

    csvContent += "CATEGORY,NAME,LIMIT/VALUE,DEBT,NET/REMAINING\n";

    cardData.forEach(card => {
        const remainingLimit = (card.limit || 0) - (card.debt || 0);
        csvContent += `CREDIT CARD,${card.name},${card.limit || 0},${card.debt || 0},${remainingLimit}\n`;
    });

    fundData.forEach(fund => {
        csvContent += `CASH/ASSET,${fund.name},${fund.amount || 0},0,${fund.amount || 0}\n`;
    });

    const totalCardDebt = cardData.reduce((sum, item) => sum + (item.debt || 0), 0);
    const totalOtherDebt = otherData.reduce((sum, item) => sum + (item.amount || 0), 0);
    const totalDebt = totalCardDebt + totalOtherDebt;

    const totalFundCash = fundData.reduce((sum, item) => sum + (item.amount || 0), 0);
    const totalCardMoney = cardData.reduce((sum, item) => sum + (item.money || 0), 0);
    const totalAssets = totalFundCash + totalCardMoney;
    const overallNet = totalAssets - totalDebt;

    csvContent += `,,,\n`;
    csvContent += `SUMMARY,TOTAL ASSETS,${totalAssets},,\n`;
    csvContent += `SUMMARY,TOTAL DEBT,,${totalDebt},\n`;
    csvContent += `SUMMARY,OVERALL NET POSITION,,,${overallNet}\n`;

    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", "finance_table.csv");
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
}
