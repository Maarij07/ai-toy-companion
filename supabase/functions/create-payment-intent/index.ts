// Supabase Edge Function: Create Payment Intent
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import Stripe from "https://esm.sh/stripe@14.19.0";

const stripe = new Stripe(Deno.env.get("STRIPE_SECRET_KEY")!, {
  // This is needed to use the Fetch API rather than relying on the Node http
  // library.
  httpClient: Stripe.createFetchHttpClient(),
});

console.log("Payment intent function initialized");

serve(async (req: Request) => {
  if (req.method !== "POST") {
    return new Response(JSON.stringify({ error: "Method not allowed" }), {
      headers: { "Content-Type": "application/json" },
      status: 405,
    });
  }

  try {
    const { amount, currency, description, receipt_email } = await req.json();

    // Validate required fields
    if (!amount || !currency) {
      return new Response(JSON.stringify({ error: "Amount and currency are required" }), {
        headers: { "Content-Type": "application/json" },
        status: 400,
      });
    }

    // Create a payment intent with Stripe
    const paymentIntent = await stripe.paymentIntents.create({
      amount: amount,
      currency: currency,
      description: description,
      receipt_email: receipt_email,
      automatic_payment_methods: {
        enabled: true,
      },
    });

    // Return the client secret and ID
    return new Response(
      JSON.stringify({
        id: paymentIntent.id,
        client_secret: paymentIntent.client_secret,
        status: paymentIntent.status,
      }),
      {
        headers: { "Content-Type": "application/json" },
        status: 200,
      }
    );
  } catch (error) {
    console.error("Error creating payment intent:", error);
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