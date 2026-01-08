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

        const { public_token, user_id, institution_name } = await req.json();

        if (!public_token || !user_id) {
            throw new Error("public_token and user_id are required");
        }

        const plaidBaseUrl =
            PLAID_ENV === "sandbox"
                ? "https://sandbox.plaid.com"
                : PLAID_ENV === "development"
                    ? "https://development.plaid.com"
                    : "https://production.plaid.com";

        // Exchange public token for access token
        const response = await fetch(`${plaidBaseUrl}/item/public_token/exchange`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
                client_id: PLAID_CLIENT_ID,
                secret: PLAID_SECRET,
                public_token: public_token,
            }),
        });

        const data = await response.json();

        if (data.error_code) {
            throw new Error(data.error_message || "Plaid API error");
        }

        // Store access token in Supabase
        const supabase = createClient(SUPABASE_URL!, SUPABASE_SERVICE_ROLE_KEY!);

        const { error: dbError } = await supabase.from("linked_accounts").insert({
            user_id: user_id,
            access_token: data.access_token,
            item_id: data.item_id,
            institution_name: institution_name || "Unknown Bank",
        });

        if (dbError) {
            throw new Error("Failed to store account: " + dbError.message);
        }

        return new Response(
            JSON.stringify({ success: true, item_id: data.item_id }),
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
