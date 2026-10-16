import { useState } from 'react';
import { useModel } from '../state/hooks';
import { importTransactions } from '../state/actions';
import { parseSpendingCsv } from '../lib/csv';
import { formatDate } from '../lib/dates';
import { formatMoney } from '../lib/money';
import { Button, Field, Select, Sheet, toast } from '../ui/kit';
import S from '../i18n/strings';

export default function ImportSheet({ onClose }) {
    const { settings, accounts } = useModel();
    const [parsed, setParsed] = useState(null);
    const [accountId, setAccountId] = useState('');

    const read = (event) => {
        const file = event.target.files?.[0];
        if (!file) return;
        const reader = new FileReader();
        reader.onload = () => setParsed(parseSpendingCsv(String(reader.result), settings.spendingCurrency));
        reader.readAsText(file);
    };

    const run = () => {
        importTransactions(parsed.rows.map((row) => ({ ...row, accountId: accountId || null })));
        toast(S.spend.importDone(parsed.rows.length));
        onClose();
    };

    return (
        <Sheet
            title={S.spend.importTitle}
            onClose={onClose}
            footer={parsed?.rows.length ? <Button variant="primary" className="w-full" onClick={run}>{S.spend.importDo(parsed.rows.length)}</Button> : null}
        >
            <div className="flex flex-col gap-4">
                <p className="text-[14px] leading-relaxed text-muted">{S.spend.importHelp}</p>
                <label className="flex h-12 cursor-pointer items-center justify-center border border-dashed border-neon font-mono text-[13px] uppercase tracking-[0.08em] text-neon">
                    <input type="file" accept=".csv,text/csv,text/plain" className="hidden" onChange={read} />
                    {S.spend.importPick}
                </label>
                <Field label={S.spend.importAccount}>
                    <Select value={accountId} onChange={setAccountId} options={[{ value: '', label: S.spend.importNone }, ...accounts.map((a) => ({ value: a.id, label: `${a.name} · ${a.currency}` }))]} />
                </Field>
                {parsed && (
                    <>
                        <p className="text-[14px] text-white">{S.spend.importPreview(parsed.rows.length)}</p>
                        {parsed.errors.length > 0 && <p className="text-[14px] text-hot">{S.spend.importErrors(parsed.errors.length)}</p>}
                        <div className="max-h-64 overflow-y-auto border border-line">
                            {parsed.rows.slice(0, 50).map((row, i) => (
                                <div key={i} className="flex justify-between gap-3 border-t border-line px-3 py-2 text-[14px] first:border-t-0">
                                    <span className="truncate text-body">{formatDate(row.date)} · {row.categoryName || '—'} {row.note && `· ${row.note}`}</span>
                                    <span className="tabular shrink-0 font-mono text-white">{formatMoney(row.amount, row.currency)}</span>
                                </div>
                            ))}
                        </div>
                    </>
                )}
            </div>
        </Sheet>
    );
}
