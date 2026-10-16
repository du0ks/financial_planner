import { createClient } from '@supabase/supabase-js'

// Public client config. These two values are NOT secrets: any Vite VITE_* var is
// inlined into the client bundle and shipped to every visitor, so a Supabase URL and
// anon key are public by design. What actually protects the data is Row Level Security
// on the tables — never the secrecy of this key. (A service_role key would be a real
// secret and must never appear here.)
//
// They live in source rather than only in .env because the GitHub Pages build has no
// .env file: the deploy runs `npm run build` in CI, and with these unset createClient()
// throws at module load and the whole app fails to boot.
const FALLBACK_SUPABASE_URL = 'https://sjrvsqhmdrrsshwokuok.supabase.co'
const FALLBACK_SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InNqcnZzcWhtZHJyc3Nod29rdW9rIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Njc4MDgyMjAsImV4cCI6MjA4MzM4NDIyMH0.NCGFMl4PAzG8r2YukP6Yd7B-aBNNnYEM3hPENoBo-nI'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || FALLBACK_SUPABASE_URL
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY || FALLBACK_SUPABASE_ANON_KEY

if (!supabaseUrl || !supabaseAnonKey) {
    console.error('Supabase credentials missing in .env file')
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey)
