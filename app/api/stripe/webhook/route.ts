import { NextResponse, type NextRequest } from "next/server";
import { getStripeServerClient } from "@/lib/stripe/server";

export async function POST(request: NextRequest) {
  const stripe = getStripeServerClient();
  const signature = request.headers.get("stripe-signature");
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;
  const body = await request.text();

  if (!stripe || !webhookSecret) {
    return NextResponse.json(
      {
        received: false,
        message: "Configuration Stripe webhook manquante.",
      },
      { status: 500 },
    );
  }

  if (!signature) {
    return NextResponse.json(
      {
        received: false,
        message: "Signature Stripe manquante.",
      },
      { status: 400 },
    );
  }

  let eventType: string;

  try {
    const event = stripe.webhooks.constructEvent(
      body,
      signature,
      webhookSecret,
    );
    eventType = event.type;
  } catch {
    return NextResponse.json(
      {
        received: false,
        message: "Signature Stripe invalide.",
      },
      { status: 400 },
    );
  }

  // Future implementation:
  // - upsert billing_subscriptions with organization_id for billing events
  // - write an audit_logs entry without exposing sensitive metadata
  // - return only generic success/failure responses
  return NextResponse.json({
    received: true,
    mode: "verified-placeholder",
    eventType,
  });
}
