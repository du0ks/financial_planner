import { lazy, Suspense, useEffect, useState } from 'react';
import { supabase } from './state/supabase';
import { resetDemo, start, stop } from './state/store';
import { startMarket } from './state/market';
import { useStoreState } from './state/hooks';
import FxFreezer from './state/FxFreezer';
import { getSetting } from './lib/doc';
import { setNumberLocale } from './lib/money';
import Layout from './ui/Layout';
import { SheetHost } from './ui/sheets';
import { Button, Toaster } from './ui/kit';
import AuthScreen from './screens/AuthScreen';
import MoneyScreen from './screens/MoneyScreen';
import S from './i18n/strings';

const screens = {
    spend: lazy(() => import('./screens/SpendScreen')),
    plan: lazy(() => import('./screens/PlanScreen')),
    gold: lazy(() => import('./screens/GoldScreen')),
    insights: lazy(() => import('./screens/InsightsScreen')),
    settings: lazy(() => import('./screens/SettingsScreen')),
};

const TAB_KEY = 'pv5-tab';
const readTab = () => { try { return window.localStorage.getItem(TAB_KEY) || 'money'; } catch { return 'money'; } };

function Loading({ text = S.app.loading }) {
    return <div className="flex min-h-screen items-center justify-center font-mono text-[14px] text-dim">{text}</div>;
}

function Signed({ session }) {
    const state = useStoreState();
    const [tab, setTab] = useState(readTab);
    const locale = getSetting(state.doc, 'numberLocale', '');

    useEffect(() => { setNumberLocale(locale || navigator.language); }, [locale]);

    const changeTab = (next) => {
        setTab(next);
        window.scrollTo(0, 0);
        try { window.localStorage.setItem(TAB_KEY, next); } catch { /* ignore */ }
    };

    if (state.bootError && !state.ready) {
        return (
            <div className="flex min-h-screen flex-col items-center justify-center gap-4 px-6 text-center">
                <p className="max-w-md text-[15px] text-body">{S.app.bootError(state.bootError)}</p>
                <Button variant="primary" onClick={() => start(session)}>{S.app.retry}</Button>
            </div>
        );
    }
    if (!state.ready) return <Loading />;

    const Screen = screens[tab];
    return (
        <Layout tab={tab} onTab={changeTab} email={session.user.email}>
            <FxFreezer />
            {Screen ? (
                <Suspense fallback={<Loading />}>
                    <Screen session={session} />
                </Suspense>
            ) : <MoneyScreen />}
            <SheetHost />
            <Toaster />
        </Layout>
    );
}

export default function App() {
    const [session, setSession] = useState(null);
    const [authReady, setAuthReady] = useState(false);

    useEffect(() => {
        startMarket();
        supabase.auth.getSession()
            .then(({ data }) => setSession(data.session))
            .catch((error) => console.error('Auth failed to start', error))
            .finally(() => setAuthReady(true));
        // Supabase emits a fresh session object on token refresh; only a different user (or
        // signing out) should restart the store.
        const { data: { subscription } } = supabase.auth.onAuthStateChange((event, next) => {
            if (event === 'SIGNED_OUT') { setSession(null); return; }
            setSession((current) => (current?.isDemo ? current : (current?.user?.id === next?.user?.id ? current : next)));
        });
        return () => subscription.unsubscribe();
    }, []);

    const userKey = session?.isDemo ? 'demo' : session?.user?.id || null;
    useEffect(() => {
        if (session) start(session);
        else stop();
    // eslint-disable-next-line react-hooks/exhaustive-deps -- restart only when the user changes
    }, [userKey]);

    if (!authReady) return <Loading />;
    if (!session) {
        return (
            <AuthScreen onDemo={() => {
                resetDemo();
                setSession({ user: { id: 'demo', email: 'demo@prosperity.app' }, isDemo: true });
            }} />
        );
    }
    return (
        <Signed session={session} />
    );
}
