import React, { useState } from 'react';
import { supabase } from '../utils/supabase';
import { Wallet, LogIn, Mail, Lock, Loader2, Sparkles } from 'lucide-react';

export default function AuthView() {
    const [loading, setLoading] = useState(false);
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [isSignUp, setIsSignUp] = useState(false);
    const [message, setMessage] = useState({ type: '', text: '' });

    const handleAuth = async (e) => {
        e.preventDefault();
        setLoading(true);
        setMessage({ type: '', text: '' });

        try {
            if (isSignUp) {
                const { error } = await supabase.auth.signUp({ email, password });
                if (error) throw error;
                setMessage({ type: 'success', text: 'Check your email for the confirmation link!' });
            } else {
                const { error } = await supabase.auth.signInWithPassword({ email, password });
                if (error) throw error;
            }
        } catch (error) {
            setMessage({ type: 'error', text: error.message });
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="min-h-screen flex items-center justify-center p-4 bg-gradient-to-br from-gray-50 to-gray-100 dark:from-gray-950 dark:to-black">
            <div className="w-full max-w-md animate-fade-in">
                {/* Logo Area */}
                <div className="text-center mb-8">
                    <div className="inline-flex items-center justify-center p-3 bg-gradient-to-tr from-green-500 to-emerald-400 rounded-2xl shadow-xl shadow-green-500/20 mb-4">
                        <Wallet className="text-white w-8 h-8" />
                    </div>
                    <h1 className="text-3xl font-black text-gray-900 dark:text-white tracking-tight">Prosperity</h1>
                    <p className="text-gray-500 dark:text-gray-400 mt-2 font-medium">Your financial vault in the cloud</p>
                </div>

                {/* Card */}
                <div className="bg-white dark:bg-gray-900 p-8 rounded-[32px] shadow-2xl shadow-gray-200/50 dark:shadow-none border border-gray-100 dark:border-gray-800 relative overflow-hidden">
                    <div className="absolute top-0 right-0 p-8 opacity-5 pointer-events-none">
                        <Sparkles size={120} />
                    </div>

                    <h2 className="text-xl font-bold text-gray-900 dark:text-white mb-6">
                        {isSignUp ? 'Create your account' : 'Welcome back'}
                    </h2>

                    <form onSubmit={handleAuth} className="space-y-4 relative z-10">
                        <div>
                            <label className="block text-xs font-bold text-gray-400 uppercase tracking-widest mb-1 mx-1">Email Address</label>
                            <div className="relative">
                                <Mail className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
                                <input
                                    type="email"
                                    required
                                    value={email}
                                    onChange={(e) => setEmail(e.target.value)}
                                    className="w-full bg-gray-50 dark:bg-gray-800 border-none rounded-2xl py-3 pl-10 pr-4 focus:ring-2 focus:ring-green-500 transition-all dark:text-white outline-none"
                                    placeholder="name@example.com"
                                />
                            </div>
                        </div>

                        <div>
                            <label className="block text-xs font-bold text-gray-400 uppercase tracking-widest mb-1 mx-1">Password</label>
                            <div className="relative">
                                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
                                <input
                                    type="password"
                                    required
                                    value={password}
                                    onChange={(e) => setPassword(e.target.value)}
                                    className="w-full bg-gray-50 dark:bg-gray-800 border-none rounded-2xl py-3 pl-10 pr-4 focus:ring-2 focus:ring-green-500 transition-all dark:text-white outline-none"
                                    placeholder="••••••••"
                                />
                            </div>
                        </div>

                        {message.text && (
                            <div className={`p-4 rounded-2xl text-sm font-medium ${message.type === 'error' ? 'bg-red-50 text-red-600 dark:bg-red-500/10 dark:text-red-400' : 'bg-green-50 text-green-600 dark:bg-green-500/10 dark:text-green-400'}`}>
                                {message.text}
                            </div>
                        )}

                        <button
                            type="submit"
                            disabled={loading}
                            className="w-full bg-green-600 hover:bg-green-700 text-white font-bold py-4 rounded-2xl shadow-lg shadow-green-600/20 transition-all active:scale-95 disabled:opacity-50 disabled:active:scale-100 flex items-center justify-center gap-2"
                        >
                            {loading ? <Loader2 className="animate-spin" size={20} /> : <LogIn size={20} />}
                            {isSignUp ? 'Sign Up' : 'Sign In'}
                        </button>
                    </form>

                    <div className="mt-8 pt-6 border-t border-gray-100 dark:border-gray-800 text-center">
                        <button
                            onClick={() => setIsSignUp(!isSignUp)}
                            className="text-sm font-bold text-green-600 dark:text-green-400 hover:text-green-700 transition"
                        >
                            {isSignUp ? 'Already have an account? Sign In' : "Don't have an account? Sign Up"}
                        </button>
                    </div>
                </div>

                <p className="text-center text-xs text-gray-400 mt-8 leading-relaxed">
                    By continuing, you agree to secure your data in your personal cloud vault. <br />
                    All data is encrypted and private.
                </p>
            </div>
        </div>
    );
}
