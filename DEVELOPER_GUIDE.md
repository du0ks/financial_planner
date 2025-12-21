# Developer Quick Reference

## Module Dependencies Graph

```
┌─────────────────┐
│    app.js       │ ← Entry point
└────────┬────────┘
         │
         ├─→ storage.js (loads/saves data)
         │
         ├─→ currency.js (depends on storage.js)
         │     └─→ formatMoney()
         │
         ├─→ data.js (depends on storage.js, ui.js)
         │     └─→ cardData, fundData, otherData
         │
         ├─→ ui.js (depends on currency.js)
         │     └─→ renderCards(), renderFunds(), renderOthers()
         │
         ├─→ export.js (depends on data.js)
         │     └─→ exportToCSV()
         │
         └─→ pwa.js (independent)
               └─→ registerServiceWorker()
```

## Common Tasks

### 🔄 Update Display After Data Change
```javascript
// After modifying cardData, fundData, or otherData:
renderCards();      // Updates cards table
renderFunds();      // Updates funds table
renderOthers();     // Updates other payments table
calculateTotals();  // Recalculates dashboard
```

### 💾 Persist Data
```javascript
// Automatically called in updateCard(), addRow(), etc.
saveData(cardData, fundData, otherData);
```

### 💱 Format Currency
```javascript
// Already called in UI rendering
const formatted = formatMoney(1234.56);
// Returns: "1.234,56 ₺" or "1,234.56 ₴" depending on currency
```

### ➕ Add New Data Type (e.g., Investments)

**1. Update `storage.js`:**
```javascript
// In getDefaultData():
investments: [
    { id: 301, name: 'Stock ABC', amount: 5000 },
]
```

**2. Update `data.js`:**
```javascript
let investmentData = [];

function updateInvestment(index, field, value) {
    if (field === 'amount') {
        investmentData[index][field] = parseFloat(value) || 0;
    } else {
        investmentData[index][field] = value;
    }
    saveData(cardData, fundData, otherData, investmentData);
    calculateTotals();
}
```

**3. Update `ui.js`:**
```javascript
function renderInvestments() {
    const tbody = document.getElementById('investmentsBody');
    tbody.innerHTML = '';
    investmentData.forEach((inv, index) => {
        // HTML rendering...
    });
    calculateTotals();
}
```

**4. Update `index.html`:**
```html
<!-- Add new section -->
<div class="bg-white border rounded-lg...">
    <!-- investments table HTML -->
    <table id="investmentsTable">
        <tbody id="investmentsBody"></tbody>
    </table>
</div>
```

**5. Update `app.js`:**
```javascript
function initializeApp() {
    // ... existing code ...
    renderInvestments();  // Add this
}
```

## Testing Checklist

### ✅ Before Pushing Changes
- [ ] All tables render correctly
- [ ] Can add new rows
- [ ] Can edit existing values
- [ ] Can delete rows
- [ ] Data persists after refresh
- [ ] Currency toggle works
- [ ] CSV export works
- [ ] Mobile responsive (test on small screen)
- [ ] Service worker registers (check DevTools → Application)

## Debugging Tips

### Check if Data Loaded
```javascript
console.log('Cards:', cardData);
console.log('Funds:', fundData);
console.log('Others:', otherData);
```

### Check Settings
```javascript
const settings = loadSettings();
console.log('Current currency:', currentCurrency);
console.log('Current locale:', currentLocale);
```

### Check localStorage
```javascript
// In browser console:
localStorage.getItem('financeTracker_local_v1')      // Data
localStorage.getItem('financeTracker_settings_v1')   // Settings
```

### Clear All Data (for testing)
```javascript
// In browser console:
localStorage.clear();
location.reload();
```

## Performance Notes

- **Small module files** - Load quickly and can be cached
- **Lazy rendering** - Tables only update when data changes
- **Text fitting** - Numbers shrink if needed to fit small screens
- **Minimal DOM** - Only 3 tables rendered, summary cards updated efficiently

## Browser Support

- ✅ Chrome/Edge (latest)
- ✅ Firefox (latest)
- ✅ Safari (latest)
- ✅ Mobile browsers (iOS Safari, Chrome Mobile)
- ✅ Offline mode (via Service Worker)

## Common Bugs & Solutions

### Issue: Data not saving
**Solution:** Check if `saveData()` is called after modifications

### Issue: Table not updating after edit
**Solution:** Call `renderCards()` or appropriate render function

### Issue: Currency not changing
**Solution:** Check if `toggleCurrency()` is properly linked to button

### Issue: Page blank on load
**Solution:** Check browser console for script loading errors or syntax issues

---

**Need Help?** Check the `PROJECT_STRUCTURE.md` file for complete module documentation.
