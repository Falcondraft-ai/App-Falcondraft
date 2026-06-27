import { NextResponse } from "next/server";
import { canManageWorkspace } from "@/lib/auth/workspace-permissions";
import { getStripe, isStripeConfigured } from "@/lib/billing/stripe";
import { requireBrokerApiContext } from "@/lib/broker/server";

export const runtime = "nodejs";

export async function POST() {
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

  const { data: org } = await auth.adminSupabase
    .from("organizations")
    .select("stripe_customer_id")
    .eq("id", auth.organizationId)
    .single();

  if (!org?.stripe_customer_id) {
    return NextResponse.json(
      { success: false, message: "Aucun abonnement actif à gérer." },
      { status: 400 },
    );
  }

  const stripe = getStripe();
  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";

  const session = await stripe.billingPortal.sessions.create({
    customer: org.stripe_customer_id,
    return_url: `${appUrl}/courtier/settings`,
  });

  return NextResponse.json({ success: true, url: session.url });
}
