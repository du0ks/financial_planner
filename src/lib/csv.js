import { isCurrencyCode, parseMoney } from './money';

// Reads a simple spending CSV: date, amount, currency, category, note. Separators "," ";" or
// tab; quoted fields allowed; a header row is skipped automatically. Dates as YYYY-MM-DD,
// DD.MM.YYYY or DD/MM/YYYY.

function splitLine(line, separator) {
    const out = [];
    let field = '';
    let quoted = false;
    for (let i = 0; i < line.length; i += 1) {
        const ch = line[i];
        if (quoted) {
            if (ch === '"' && line[i + 1] === '"') { field += '"'; i += 1; }
            else if (ch === '"') quoted = false;
            else field += ch;
        } else if (ch === '"') quoted = true;
        else if (ch === separator) { out.push(field.trim()); field = ''; }
        else field += ch;
    }
    out.push(field.trim());
    return out;
}

function detectSeparator(line) {
    const counts = [';', '\t', ','].map((sep) => [sep, splitLine(line, sep).length]);
    counts.sort((a, b) => b[1] - a[1]);
    return counts[0][0];
}

export function parseDate(text) {
    const t = (text || '').trim();
    let m = t.match(/^(\d{4})-(\d{1,2})-(\d{1,2})$/);
    if (m) return `${m[1]}-${m[2].padStart(2, '0')}-${m[3].padStart(2, '0')}`;
    m = t.match(/^(\d{1,2})[./](\d{1,2})[./](\d{4})$/);
    if (m) return `${m[3]}-${m[2].padStart(2, '0')}-${m[1].padStart(2, '0')}`;
    return null;
}

export function parseSpendingCsv(text, defaultCurrency) {
    const lines = text.replace(/^\ufeff/, '').split(/\r?\n/).filter((l) => l.trim());
    if (!lines.length) return { rows: [], errors: [] };
    const separator = detectSeparator(lines[0]);
    const rows = [];
    const errors = [];
    lines.forEach((line, index) => {
        const [dateText, amountText, currencyText, category, ...noteParts] = splitLine(line, separator);
        const date = parseDate(dateText);
        if (!date) {
            if (index > 0) errors.push({ line: index + 1, text: line });
            return;
        }
        const currency = isCurrencyCode((currencyText || '').toUpperCase()) ? currencyText.toUpperCase() : defaultCurrency;
        const amount = parseMoney((amountText || '').replace(/^-/, ''), currency);
        if (!amount) {
            errors.push({ line: index + 1, text: line });
            return;
        }
        rows.push({ date, amount, currency, categoryName: (category || '').trim() || null, note: noteParts.join(', ').trim() });
    });
    return { rows, errors };
}
