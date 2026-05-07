import Stripe from "stripe";

let stripe: Stripe | null = null;

export function getStripeServerClient() {
  const secretKey = process.env.STRIPE_SECRET_KEY;

  if (!secretKey) {
    return null;
  }

  stripe ??= new Stripe(secretKey);

  return stripe;
}
