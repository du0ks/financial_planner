import { useState } from 'react';
import { Wallet } from 'lucide-react';
import { supabase } from '../state/supabase';
import { Button, Field, TextInput } from '../ui/kit';
import S from '../i18n/strings';

export default function AuthScreen({ onDemo }) {
    const [mode, setMode] = useState('signIn');
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [busy, setBusy] = useState(false);
    const [message, setMessage] = useState(null);

    const submit = async (event) => {
        event.preventDefault();
        if (email.trim().toLowerCase() === 'demo' && password.toLowerCase() === 'demo') { onDemo(); return; }
        setBusy(true);
        setMessage(null);
        const { error } = mode === 'signIn'
            ? await supabase.auth.signInWithPassword({ email: email.trim(), password })
            : await supabase.auth.signUp({ email: email.trim(), password });
        setBusy(false);
        if (error) setMessage({ tone: 'text-hot', text: error.message });
        else if (mode === 'signUp') setMessage({ tone: 'text-neon', text: S.auth.checkEmail });
    };

    return (
        <div className="flex min-h-screen items-center justify-center px-4 py-10">
            <form onSubmit={submit} className="flex w-full max-w-sm flex-col gap-5 border border-line bg-panel p-6">
                <div className="flex items-center gap-3">
                    <span className="flex h-10 w-10 items-center justify-center border border-neon bg-neon/10"><Wallet size={20} className="text-neon" /></span>
                    <span className="font-display text-[20px] font-bold uppercase tracking-[0.2em] text-white">{S.app.name}</span>
                </div>
                <p className="text-[15px] text-muted">{S.auth.tagline}</p>
                <h1 className="font-display text-[22px] font-semibold text-white">{mode === 'signIn' ? S.auth.title : S.auth.signUpTitle}</h1>
                <Field label={S.auth.email}>{(id) => <TextInput id={id} type="text" inputMode="email" autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} />}</Field>
                <Field label={S.auth.password}>{(id) => <TextInput id={id} type="password" autoComplete={mode === 'signIn' ? 'current-password' : 'new-password'} value={password} onChange={(e) => setPassword(e.target.value)} />}</Field>
                {message && <p className={`text-[14px] ${message.tone}`}>{message.text}</p>}
                <button type="submit" disabled={busy} className="h-12 bg-neon font-mono text-[14px] font-semibold uppercase tracking-[0.1em] text-[#050409] disabled:opacity-50">
                    {mode === 'signIn' ? S.auth.signIn : S.auth.signUp}
                </button>
                <button type="button" className="text-[14px] text-neon" onClick={() => { setMode(mode === 'signIn' ? 'signUp' : 'signIn'); setMessage(null); }}>
                    {mode === 'signIn' ? S.auth.toSignUp : S.auth.toSignIn}
                </button>
                <div className="border-t border-line pt-4">
                    <Button className="w-full" onClick={onDemo}>{S.auth.demo}</Button>
                    <p className="mt-2 text-center text-[13px] text-dim">{S.auth.demoNote}</p>
                </div>
            </form>
        </div>
    );
}
