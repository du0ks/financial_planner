import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers":
        "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
    if (req.method === "OPTIONS") {
        return new Response("ok", { headers: corsHeaders });
    }

    try {
        const PLAID_CLIENT_ID = Deno.env.get("PLAID_CLIENT_ID");
        const PLAID_SECRET = Deno.env.get("PLAID_SECRET");
        const PLAID_ENV = Deno.env.get("PLAID_ENV") || "sandbox";
        const SUPABASE_URL = Deno.env.get("SUPABASE_URL");
        const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

        console.log("Environment check:", {
            hasPlaidClientId: !!PLAID_CLIENT_ID,
            hasPlaidSecret: !!PLAID_SECRET,
            hasSupabaseUrl: !!SUPABASE_URL,
            hasServiceRoleKey: !!SUPABASE_SERVICE_ROLE_KEY
        });

        if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
            // Return empty transactions if DB not configured - this is OK
            console.log("No SUPABASE credentials - returning empty transactions");
            return new Response(JSON.stringify({ transactions: [], accounts: [] }), {
                headers: { ...corsHeaders, "Content-Type": "application/json" },
                status: 200,
            });
        }

        const { user_id } = await req.json();

        if (!user_id) {
            throw new Error("user_id is required");
        }

        const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

        // Get all linked accounts for this user
        const { data: accounts, error: accountsError } = await supabase
            .from("linked_accounts")
            .select("access_token, institution_name, item_id")
            .eq("user_id", user_id);

        if (accountsError) {
            throw new Error("Failed to fetch accounts: " + accountsError.message);
        }

        if (!accounts || accounts.length === 0) {
            return new Response(JSON.stringify({ transactions: [], accounts: [] }), {
                headers: { ...corsHeaders, "Content-Type": "application/json" },
                status: 200,
            });
        }

        const plaidBaseUrl =
            PLAID_ENV === "sandbox"
                ? "https://sandbox.plaid.com"
                : PLAID_ENV === "development"
                    ? "https://development.plaid.com"
                    : "https://production.plaid.com";

        // Fetch transactions for each account
        const allTransactions = [];
        const today = new Date();
        const thirtyDaysAgo = new Date(today.getTime() - 30 * 24 * 60 * 60 * 1000);
        const startDate = thirtyDaysAgo.toISOString().split("T")[0];
        const endDate = today.toISOString().split("T")[0];

        for (const account of accounts) {
            const response = await fetch(`${plaidBaseUrl}/transactions/get`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    client_id: PLAID_CLIENT_ID,
                    secret: PLAID_SECRET,
                    access_token: account.access_token,
                    start_date: startDate,
                    end_date: endDate,
                    options: {
                        count: 100,
                        offset: 0,
                    },
                }),
            });

            const data = await response.json();

            if (data.transactions) {
                const enrichedTransactions = data.transactions.map((tx: any) => ({
                    ...tx,
                    institution_name: account.institution_name,
                }));
                allTransactions.push(...enrichedTransactions);
            }
        }

        // Sort by date (newest first)
        allTransactions.sort(
            (a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()
        );

        return new Response(
            JSON.stringify({
                transactions: allTransactions,
                accounts: accounts.map((a) => ({
                    item_id: a.item_id,
                    institution_name: a.institution_name,
                })),
            }),
            {
                headers: { ...corsHeaders, "Content-Type": "application/json" },
                status: 200,
            }
        );
    } catch (error) {
        return new Response(JSON.stringify({ error: error.message }), {
            headers: { ...corsHeaders, "Content-Type": "application/json" },
            status: 400,
        });
    }
});
