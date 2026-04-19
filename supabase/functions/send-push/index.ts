// Supabase Edge Function: send-push
// Sends a Web Push notification to a given user_id using their stored
// push_subscription on profiles. Authenticates with VAPID keys.
//
// Caller must be authenticated. Either:
//  - the user themselves (sending to own subscription), or
//  - a coach (any user_id).

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import webpush from "https://esm.sh/web-push@3.6.7";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

interface Payload {
  user_id: string;
  title: string;
  body: string;
  url?: string;
  icon?: string;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const VAPID_PUBLIC_KEY = Deno.env.get("VAPID_PUBLIC_KEY");
    const VAPID_PRIVATE_KEY = Deno.env.get("VAPID_PRIVATE_KEY");
    const VAPID_SUBJECT = Deno.env.get("VAPID_SUBJECT") ?? "mailto:admin@example.com";

    if (!VAPID_PUBLIC_KEY || !VAPID_PRIVATE_KEY) {
      return new Response(
        JSON.stringify({ error: "VAPID keys not configured" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // ---- Auth ----
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabaseUser = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } }
    );

    const token = authHeader.replace("Bearer ", "");
    const { data: claimsData, error: claimsErr } = await supabaseUser.auth.getClaims(token);
    if (claimsErr || !claimsData?.claims) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const callerId = claimsData.claims.sub as string;

    // ---- Validate body ----
    const body = (await req.json()) as Partial<Payload>;
    if (!body.user_id || !body.title || !body.body) {
      return new Response(
        JSON.stringify({ error: "Missing user_id, title or body" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // ---- Authorization: self or coach ----
    if (body.user_id !== callerId) {
      const { data: roleRow } = await supabaseUser
        .from("user_roles")
        .select("role")
        .eq("user_id", callerId)
        .maybeSingle();
      if (roleRow?.role !== "coach") {
        return new Response(JSON.stringify({ error: "Forbidden" }), {
          status: 403,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
    }

    // ---- Fetch subscription with service role ----
    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    const { data: profile, error: profileErr } = await supabaseAdmin
      .from("profiles")
      .select("push_subscription")
      .eq("id", body.user_id)
      .maybeSingle();

    if (profileErr) throw profileErr;
    if (!profile?.push_subscription) {
      return new Response(
        JSON.stringify({ error: "No push subscription for user" }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    webpush.setVapidDetails(VAPID_SUBJECT, VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY);

    const notificationPayload = JSON.stringify({
      title: body.title,
      body: body.body,
      url: body.url ?? "/",
      icon: body.icon ?? "/placeholder.svg",
    });

    try {
      await webpush.sendNotification(
        profile.push_subscription as never,
        notificationPayload
      );
    } catch (err) {
      const status = (err as { statusCode?: number }).statusCode;
      // Subscription gone (404/410) → clear it
      if (status === 404 || status === 410) {
        await supabaseAdmin
          .from("profiles")
          .update({ push_subscription: null })
          .eq("id", body.user_id);
        return new Response(
          JSON.stringify({ error: "Subscription expired, cleared" }),
          { status: 410, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      throw err;
    }

    return new Response(JSON.stringify({ success: true }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("[send-push] error:", e);
    return new Response(
      JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
