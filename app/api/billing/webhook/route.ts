import { NextResponse, type NextRequest } from "next/server";
import type Stripe from "stripe";
import { PLAN_CONFIG } from "@/lib/billing/entitlements";
import { PLAN_BY_LOOKUP_KEY } from "@/lib/billing/plans";
import { getStripe } from "@/lib/billing/stripe";
import { getSupabaseAdminClient } from "@/lib/supabase/admin";

export const runtime = "nodejs";

const GIGABYTE = 1024 * 1024 * 1024;

function unixToIso(value: number | null): string | null {
  return value ? new Date(value * 1000).toISOString() : null;
}

// `current_period_end` lives on the subscription in older API versions and on
// the subscription item in newer ones — read it wherever it is.
function readUnix(obj: unknown, key: string): number | null {
  const value = (obj as Record<string, unknown> | null | undefined)?.[key];
  return typeof value === "number" ? value : null;
}

function mapBillingStatus(status: Stripe.Subscription.Status): string {
  switch (status) {
    case "trialing":
      return "trial";
    case "active":
      return "active";
    case "past_due":
    case "unpaid":
    case "incomplete":
      return "past_due";
    case "paused":
      return "suspended";
    case "canceled":
    case "incomplete_expired":
      return "cancelled";
    default:
      return "active";
  }
}

async function syncSubscription(sub: Stripe.Subscription) {
  const admin = getSupabaseAdminClient();
  if (!admin) return;

  const customerId =
    typeof sub.customer === "string" ? sub.customer : sub.customer.id;

  let organizationId: string | null = sub.metadata?.organization_id ?? null;
  if (!organizationId) {
    const { data } = await admin
      .from("organizations")
      .select("id")
      .eq("stripe_customer_id", customerId)
      .maybeSingle();
    organizationId = data?.id ?? null;
  }
  if (!organizationId) return;

  const item = sub.items.data[0];
  const lookupKey = item?.price?.lookup_key ?? null;
  const plan = lookupKey ? (PLAN_BY_LOOKUP_KEY[lookupKey] ?? null) : null;
  const periodEnd =
    readUnix(item, "current_period_end") ??
    readUnix(sub, "current_period_end");

  await admin
    .from("organizations")
    .update({
      ...(plan
        ? { plan, storage_limit_bytes: PLAN_CONFIG[plan].storageGb * GIGABYTE }
        : {}),
      billing_status: mapBillingStatus(sub.status),
      stripe_customer_id: customerId,
      stripe_subscription_id: sub.id,
      plan_seats: item?.quantity ?? null,
      current_period_end: unixToIso(periodEnd),
      trial_ends_at: unixToIso(readUnix(sub, "trial_end")),
    })
    .eq("id", organizationId);
}

export async function POST(request: NextRequest) {
  const secret = process.env.STRIPE_WEBHOOK_SECRET;
  if (!secret) {
    return new NextResponse("Webhook non configuré.", { status: 503 });
  }

  const stripe = getStripe();
  const signature = request.headers.get("stripe-signature") ?? "";
  const raw = await request.text();

  let event: Stripe.Event;
  try {
    event = stripe.webhooks.constructEvent(raw, signature, secret);
  } catch {
    return new NextResponse("Signature invalide.", { status: 400 });
  }

  try {
    switch (event.type) {
      case "customer.subscription.created":
      case "customer.subscription.updated":
      case "customer.subscription.deleted":
        await syncSubscription(event.data.object);
        break;
      default:
        break;
    }
  } catch (error) {
    console.error("[billing webhook]", event.type, error);
    return new NextResponse("Erreur de traitement.", { status: 500 });
  }

  return NextResponse.json({ received: true });
}
