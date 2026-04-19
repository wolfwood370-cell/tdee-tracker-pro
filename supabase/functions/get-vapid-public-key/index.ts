// Returns the VAPID public key so the frontend can subscribe to Web Push
// without needing a build-time environment variable.
const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

Deno.serve((req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const key = Deno.env.get("VAPID_PUBLIC_KEY");
  if (!key) {
    return new Response(
      JSON.stringify({ error: "VAPID_PUBLIC_KEY not configured" }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }

  return new Response(JSON.stringify({ publicKey: key }), {
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
});
