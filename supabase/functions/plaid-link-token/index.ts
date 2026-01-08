import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers":
        "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
    // Handle CORS preflight
    if (req.method === "OPTIONS") {
        return new Response("ok", { headers: corsHeaders });
    }

    try {
        const PLAID_CLIENT_ID = Deno.env.get("PLAID_CLIENT_ID");
        const PLAID_SECRET = Deno.env.get("PLAID_SECRET");
        const PLAID_ENV = Deno.env.get("PLAID_ENV") || "sandbox";

        // Debug: Check if secrets are loaded
        if (!PLAID_CLIENT_ID || !PLAID_SECRET) {
            console.error("Missing Plaid credentials:", {
                hasClientId: !!PLAID_CLIENT_ID,
                hasSecret: !!PLAID_SECRET
            });
            throw new Error("Plaid credentials not configured. Check Edge Function secrets.");
        }

        const { user_id } = await req.json();

        if (!user_id) {
            throw new Error("user_id is required");
        }

        // Determine Plaid base URL
        const plaidBaseUrl = "https://sandbox.plaid.com";

        console.log("Creating link token for user:", user_id);

        // Create Link Token
        const response = await fetch(`${plaidBaseUrl}/link/token/create`, {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
            },
            body: JSON.stringify({
                client_id: PLAID_CLIENT_ID,
                secret: PLAID_SECRET,
                user: {
                    client_user_id: user_id,
                },
                client_name: "Prosperity Planner",
                products: ["transactions"],
                country_codes: ["US"],
                language: "en",
            }),
        });

        const data = await response.json();

        console.log("Plaid response:", JSON.stringify(data));

        if (data.error_code) {
            throw new Error(data.error_message || data.error_code || "Plaid API error");
        }

        return new Response(JSON.stringify({ link_token: data.link_token }), {
            headers: { ...corsHeaders, "Content-Type": "application/json" },
            status: 200,
        });
    } catch (error) {
        console.error("Error:", error);
        return new Response(JSON.stringify({ error: error.message || "Unknown error" }), {
            headers: { ...corsHeaders, "Content-Type": "application/json" },
            status: 400,
        });
    }
});
