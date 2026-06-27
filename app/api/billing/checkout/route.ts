import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { canManageWorkspace } from "@/lib/auth/workspace-permissions";
import { getPlanPricing } from "@/lib/billing/plans";
import { getStripe, isStripeConfigured } from "@/lib/billing/stripe";
import { requireBrokerApiContext } from "@/lib/broker/server";

export const runtime = "nodejs";

const schema = z.object({
  plan: z.enum(["essentiel", "cabinet", "performance"]),
  interval: z.enum(["month", "year"]),
});

export async function POST(request: NextRequest) {
  const auth = await requireBrokerApiContext();
  if (!auth.success) {
    return NextResponse.json(
      { success: false, message: auth.message },
      { status: auth.status },
    );
  }
  if (!canManageWorkspace(auth.context.membership?.role)) {
    return NextResponse.json(
      { success: false, message: "Accès réservé au gestionnaire du cabinet." },
      { status: 403 },
    );
  }
  if (!isStripeConfigured()) {
    return NextResponse.json(
      { success: false, message: "La facturation n'est pas encore activée." },
      { status: 503 },
    );
  }

  const body: unknown = await request.json().catch(() => ({}));
  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { success: false, message: "Requête invalide." },
      { status: 400 },
    );
  }

  const pricing = getPlanPricing(parsed.data.plan);
  if (!pricing) {
    return NextResponse.json(
      { success: false, message: "Offre inconnue." },
      { status: 400 },
    );
  }

  const stripe = getStripe();
  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";

  // Resolve the price by its stable lookup_key (no hard-coded price IDs).
  const lookupKey = pricing.lookupKeys[parsed.data.interval];
  const price = (
    await stripe.prices.list({ lookup_keys: [lookupKey], limit: 1, active: true })
  ).data[0];
  if (!price) {
    return NextResponse.json(
      {
        success: false,
        message:
          "Tarif indisponible. Lancez le setup Stripe (scripts/stripe-setup.mjs).",
      },
      { status: 500 },
    );
  }

  const { data: org } = await auth.adminSupabase
    .from("organizations")
    .select("name, stripe_customer_id")
    .eq("id", auth.organizationId)
    .single();

  // Reuse or create the Stripe customer for this organization.
  let customerId = org?.stripe_customer_id ?? null;
  if (!customerId) {
    const customer = await stripe.customers.create({
      name: org?.name ?? undefined,
      email: auth.user.email ?? undefined,
      metadata: { organization_id: auth.organizationId },
    });
    customerId = customer.id;
    await auth.adminSupabase
      .from("organizations")
      .update({ stripe_customer_id: customerId })
      .eq("id", auth.organizationId);
  }

  const session = await stripe.checkout.sessions.create({
    mode: "subscription",
    customer: customerId,
    line_items: [{ price: price.id, quantity: 1 }],
    subscription_data: {
      trial_period_days: 14,
      metadata: { organization_id: auth.organizationId, plan: parsed.data.plan },
    },
    client_reference_id: auth.organizationId,
    allow_promotion_codes: true,
    success_url: `${appUrl}/courtier/settings?checkout=success`,
    cancel_url: `${appUrl}/courtier/settings?checkout=cancel`,
  });

  return NextResponse.json({ success: true, url: session.url });
}
