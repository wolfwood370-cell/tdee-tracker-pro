import Stripe from "https://esm.sh/stripe@17.7.0?target=deno";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

Deno.serve(async (req) => {
  const stripeKey = Deno.env.get("STRIPE_SECRET_KEY");
  const webhookSecret = Deno.env.get("STRIPE_WEBHOOK_SECRET");
  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

  if (!stripeKey || !webhookSecret || !supabaseUrl || !serviceKey) {
    return new Response("Configurazione mancante", { status: 500 });
  }

  const signature = req.headers.get("stripe-signature");
  if (!signature) {
    return new Response("Firma Stripe mancante", { status: 400 });
  }

  const stripe = new Stripe(stripeKey, { apiVersion: "2024-11-20.acacia" });
  const body = await req.text();

  let event: Stripe.Event;
  try {
    event = await stripe.webhooks.constructEventAsync(body, signature, webhookSecret);
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Firma non valida";
    console.error("[stripe-webhook] signature error:", msg);
    return new Response(`Webhook signature verification failed: ${msg}`, { status: 400 });
  }

  const admin = createClient(supabaseUrl, serviceKey);

  const updateStatus = async (userId: string, status: "active" | "expired") => {
    const { error } = await admin
      .from("profiles")
      .update({ subscription_status: status })
      .eq("id", userId);
    if (error) {
      console.error("[stripe-webhook] update error:", error.message);
      throw error;
    }
    console.log(`[stripe-webhook] profilo ${userId} -> ${status}`);
  };

  try {
    switch (event.type) {
      case "checkout.session.completed": {
        const session = event.data.object as Stripe.Checkout.Session;
        const userId = session.client_reference_id ?? session.metadata?.user_id;
        if (userId) await updateStatus(userId, "active");
        break;
      }
      case "customer.subscription.updated": {
        const sub = event.data.object as Stripe.Subscription;
        const userId = sub.metadata?.user_id;
        if (!userId) break;
        const activeStatuses = ["active", "trialing"];
        if (activeStatuses.includes(sub.status)) {
          await updateStatus(userId, "active");
        } else {
          await updateStatus(userId, "expired");
        }
        break;
      }
      case "customer.subscription.deleted": {
        const sub = event.data.object as Stripe.Subscription;
        const userId = sub.metadata?.user_id;
        if (userId) await updateStatus(userId, "expired");
        break;
      }
      default:
        console.log(`[stripe-webhook] evento ignorato: ${event.type}`);
    }

    return new Response(JSON.stringify({ received: true }), {
      headers: { "Content-Type": "application/json" },
      status: 200,
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Errore handler";
    return new Response(JSON.stringify({ error: msg }), { status: 500 });
  }
});
