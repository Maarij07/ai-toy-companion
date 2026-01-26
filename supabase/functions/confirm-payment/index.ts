// Supabase Edge Function: Confirm Payment
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import Stripe from "https://esm.sh/stripe@14.19.0";

const stripe = new Stripe(Deno.env.get("STRIPE_SECRET_KEY")!, {
  // This is needed to use the Fetch API rather than relying on the Node http
  // library.
  httpClient: Stripe.createFetchHttpClient(),
});

console.log("Confirm payment function initialized");

serve(async (req: Request) => {
  if (req.method !== "POST") {
    return new Response(JSON.stringify({ error: "Method not allowed" }), {
      headers: { "Content-Type": "application/json" },
      status: 405,
    });
  }

  try {
    const { payment_intent_id } = await req.json();

    // Validate required fields
    if (!payment_intent_id) {
      return new Response(JSON.stringify({ error: "Payment intent ID is required" }), {
        headers: { "Content-Type": "application/json" },
        status: 400,
      });
    }

    // Retrieve the payment intent to confirm its status
    const paymentIntent = await stripe.paymentIntents.retrieve(payment_intent_id);

    // Return the payment intent details
    return new Response(
      JSON.stringify({
        id: paymentIntent.id,
        status: paymentIntent.status,
        amount: paymentIntent.amount,
        currency: paymentIntent.currency,
      }),
      {
        headers: { "Content-Type": "application/json" },
        status: 200,
      }
    );
  } catch (error) {
    console.error("Error confirming payment:", error);
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