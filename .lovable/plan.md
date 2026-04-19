
L'utente vuole aggiornare i 3 secrets Stripe già esistenti con nuovi valori.

Plan: chiamare il tool `add_secret` per ciascuno dei 3 secrets, così l'utente può inserire i nuovi valori tramite il form sicuro. I secrets esistenti verranno sovrascritti con i nuovi valori forniti.

## Cosa farò (in default mode)

1. Richiedere aggiornamento di **`STRIPE_SECRET_KEY`** — la chiave segreta di Stripe (inizia con `sk_test_...` o `sk_live_...`), reperibile in Stripe Dashboard → Developers → API keys.

2. Richiedere aggiornamento di **`STRIPE_PRICE_ID`** — l'ID del prezzo del prodotto/abbonamento (inizia con `price_...`), reperibile in Stripe Dashboard → Products → [il tuo prodotto] → Pricing.

3. Richiedere aggiornamento di **`STRIPE_WEBHOOK_SECRET`** — il signing secret del webhook (inizia con `whsec_...`), reperibile cliccando "Reveal signing secret" sull'endpoint webhook configurato all'URL `https://wqiedbnpvdipdjgutkzl.supabase.co/functions/v1/stripe-webhook`.

I 3 secrets verranno richiesti in un'unica chiamata così puoi inserirli tutti insieme. Nessuna modifica al codice è necessaria: le edge functions `create-checkout` e `stripe-webhook` leggono già questi nomi di env var.
