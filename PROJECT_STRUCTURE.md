# Financial Planner - Project Structure

## 📁 Directory Structure

```
financial_planner/
├── index.html              # Main HTML file (clean & minimal)
├── manifest.webmanifest    # PWA manifest
├── service-worker.js       # Service worker for offline support
│
├── css/
│   └── styles.css         # All custom CSS styles
│
├── js/
│   ├── app.js             # App initialization & coordinator
│   ├── storage.js         # LocalStorage management
│   ├── currency.js        # Currency handling & formatting
│   ├── data.js            # Data CRUD operations
│   ├── ui.js              # DOM manipulation & rendering
│   ├── export.js          # CSV/Excel export functionality
│   └── pwa.js             # PWA & service worker registration
│
└── .git/                  # Git repository
    └── ...
```

## 📚 Module Descriptions

### **storage.js**
Manages all localStorage operations and data persistence.
- `loadData()` - Load data from localStorage
- `saveData()` - Persist data to localStorage
- `loadSettings()` - Load user preferences (currency, locale)
- `saveSettings()` - Save user preferences
- `getDefaultData()` - Initialize default data for new users

### **currency.js**
Handles currency management and locale formatting.
- `initCurrency()` - Initialize currency from saved settings
- `toggleCurrency()` - Switch between TRY and UAH
- `formatMoney()` - Format numbers as currency

### **data.js**
Core data management with CRUD operations.
- `initializeData()` - Load and initialize all data
- `updateCard()`, `updateFund()`, `updateOther()` - Update specific fields
- `addRow()` - Add new records
- `removeCard()`, `removeFund()`, `removeOther()` - Delete records
- `calculateTotals()` - Calculate dashboard metrics

### **ui.js**
All DOM manipulation and table rendering.
- `renderCards()` - Render credit cards table
- `renderFunds()` - Render assets/cash table
- `renderOthers()` - Render other payments table
- `updateDashboard()` - Update summary cards with totals
- `shrinkSummaryText()` - Responsive text scaling
- `fitTextToContainer()` - Text fitting utility

### **export.js**
Export functionality for data backup.
- `exportToCSV()` - Export all data to CSV/Excel format

### **pwa.js**
Progressive Web App features.
- `registerServiceWorker()` - Register service worker for offline support

### **app.js**
Main application entry point and initialization.
- `initializeApp()` - Initialize all modules and start the app

### **styles.css**
All custom styles for the application.
- Custom input styling
- Responsive mobile tables
- Dashboard card styling

## 🔄 Data Flow

```
app.js (initialization)
    ↓
    ├── storage.js (load data & settings)
    ├── currency.js (initialize currency)
    ├── data.js (prepare data arrays)
    ├── ui.js (render tables & dashboard)
    └── pwa.js (register service worker)
```

## 🚀 Benefits of This Structure

✅ **Modularity** - Each module has a single responsibility  
✅ **Maintainability** - Easy to find and modify specific functionality  
✅ **Scalability** - Ready for new features without cluttering files  
✅ **Reusability** - Modules can be imported in different projects  
✅ **Testing** - Each module can be tested independently  
✅ **Performance** - Smaller, focused files are easier to optimize  
✅ **Clean HTML** - Separated concerns improve readability  

## 📋 Script Loading Order

Scripts are loaded in dependency order in `index.html`:
1. `storage.js` - No dependencies
2. `currency.js` - Depends on storage.js
3. `ui.js` - Depends on currency.js
4. `data.js` - Depends on storage.js, ui.js
5. `export.js` - Depends on data.js
6. `pwa.js` - No dependencies on app logic
7. `app.js` - Initializes everything (depends on all others)

## 🔧 Adding New Features

**Example: Adding a new category (Investments)**

1. Update `storage.js` - Add investments array to default data
2. Update `data.js` - Add update/add/remove functions for investments
3. Update `ui.js` - Add renderInvestments() function
4. Update `index.html` - Add new table HTML
5. Update `app.js` - Call renderInvestments() in initialization

## 📦 Future Enhancements

- Analytics & chart generation
- Budget planning features
- Multi-user support with cloud sync
- Advanced filtering & search
- Data import from bank CSV files
- Monthly/yearly reports
