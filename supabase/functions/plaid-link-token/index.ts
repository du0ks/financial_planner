import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
    // Log incoming request
    console.log(`Incoming ${req.method} request`);
    const headers = {};
    req.headers.forEach((val, key) => headers[key] = val);
    console.log("Headers:", JSON.stringify(headers));

    // Handle CORS preflight
    if (req.method === "OPTIONS") {
        return new Response("ok", { headers: corsHeaders });
    }

    try {
        const PLAID_CLIENT_ID = Deno.env.get("PLAID_CLIENT_ID");
        const PLAID_SECRET = Deno.env.get("PLAID_SECRET");

        // Debug config
        console.log("Config check:", {
            hasClientId: !!PLAID_CLIENT_ID,
            hasSecret: !!PLAID_SECRET
        });

        if (!PLAID_CLIENT_ID || !PLAID_SECRET) {
            throw new Error("Missing Plaid credentials");
        }

        const body = await req.json();
        const { user_id } = body;

        if (!user_id) {
            throw new Error("user_id is required");
        }

        const plaidBaseUrl = "https://sandbox.plaid.com";
        console.log("Creating link token for:", user_id);

        const response = await fetch(`${plaidBaseUrl}/link/token/create`, {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
            },
            body: JSON.stringify({
                client_id: PLAID_CLIENT_ID,
                secret: PLAID_SECRET,
                user: { client_user_id: user_id },
                client_name: "Prosperity Planner",
                products: ["transactions"],
                country_codes: ["US"],
                language: "en",
            }),
        });

        const data = await response.json();
        console.log("Plaid API Response Status:", response.status);

        if (data.error_code) {
            console.error("Plaid Error:", data);
            return new Response(JSON.stringify(data), {
                headers: { ...corsHeaders, "Content-Type": "application/json" },
                status: 400,
            });
        }

        return new Response(JSON.stringify({ link_token: data.link_token }), {
            headers: { ...corsHeaders, "Content-Type": "application/json" },
            status: 200,
        });
    } catch (error) {
        console.error("Function Error:", error);
        return new Response(JSON.stringify({
            error: error.message,
            stack: error.stack
        }), {
            headers: { ...corsHeaders, "Content-Type": "application/json" },
            status: 500,
        });
    }
});
