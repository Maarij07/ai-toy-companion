// Supabase Edge Function: Process Refund
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import Stripe from "https://esm.sh/stripe@14.19.0";

const stripe = new Stripe(Deno.env.get("STRIPE_SECRET_KEY")!, {
  // This is needed to use the Fetch API rather than relying on the Node http
  // library.
  httpClient: Stripe.createFetchHttpClient(),
});

console.log("Process refund function initialized");

serve(async (req: Request) => {
  if (req.method !== "POST") {
    return new Response(JSON.stringify({ error: "Method not allowed" }), {
      headers: { "Content-Type": "application/json" },
      status: 405,
    });
  }

  try {
    const { payment_intent_id, reason } = await req.json();

    // Validate required fields
    if (!payment_intent_id) {
      return new Response(JSON.stringify({ error: "Payment intent ID is required" }), {
        headers: { "Content-Type": "application/json" },
        status: 400,
      });
    }

    // Create a refund with Stripe
    const refund = await stripe.refunds.create({
      payment_intent: payment_intent_id,
      reason: reason || 'requested_by_customer',
    });

    // Return the refund details
    return new Response(
      JSON.stringify({
        id: refund.id,
        status: refund.status,
        payment_intent: refund.payment_intent,
        amount: refund.amount,
        currency: refund.currency,
        created: refund.created,
      }),
      {
        headers: { "Content-Type": "application/json" },
        status: 200,
      }
    );
  } catch (error) {
    console.error("Error processing refund:", error);
    return new Response(
      JSON.stringify({ 
        error: error instanceof Error ? error.message : "Internal Server Error" 
      }),
      {
        headers: { "Content-Type": "application/json" },
        status: 500,
      }
    );
  }
});