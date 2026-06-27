// Idempotent Stripe setup for the courtier SaaS — creates the 3 products and
// their monthly/annual prices with stable lookup_keys.
//
// Run (Node 20.6+):  node --env-file=.env.local scripts/stripe-setup.mjs
//
// Safe to re-run: products are matched by metadata.falcondraft_plan, prices by
// lookup_key (reused if amount/interval unchanged, else recreated).
// KEEP IN SYNC with lib/billing/plans.ts.

import Stripe from "stripe";

const key = process.env.STRIPE_SECRET_KEY;
if (!key) {
  console.error(
    "STRIPE_SECRET_KEY manquant. Lance : node --env-file=.env.local scripts/stripe-setup.mjs",
  );
  process.exit(1);
}
const stripe = new Stripe(key);

const PLANS = [
  {
    plan: "essentiel",
    name: "FalconDraft Courtier — Essentiel",
    amounts: { month: 3900, year: 39000 },
    lookup: { month: "courtier_essentiel_month", year: "courtier_essentiel_year" },
  },
  {
    plan: "cabinet",
    name: "FalconDraft Courtier — Cabinet",
    amounts: { month: 8900, year: 89000 },
    lookup: { month: "courtier_cabinet_month", year: "courtier_cabinet_year" },
  },
  {
    plan: "performance",
    name: "FalconDraft Courtier — Performance",
    amounts: { month: 17900, year: 179000 },
    lookup: { month: "courtier_performance_month", year: "courtier_performance_year" },
  },
];

async function findProduct(plan) {
  try {
    const res = await stripe.products.search({
      query: `metadata['falcondraft_plan']:'${plan}'`,
      limit: 1,
    });
    return res.data[0] ?? null;
  } catch {
    return null;
  }
}

async function upsertPrice(productId, interval, amount, lookupKey) {
  const existing = (
    await stripe.prices.list({ lookup_keys: [lookupKey], limit: 1 })
  ).data[0];
  if (
    existing &&
    existing.unit_amount === amount &&
    existing.recurring?.interval === interval &&
    existing.active
  ) {
    return { id: existing.id, reused: true };
  }
  const price = await stripe.prices.create({
    product: productId,
    currency: "eur",
    unit_amount: amount,
    recurring: { interval },
    lookup_key: lookupKey,
    transfer_lookup_key: true,
  });
  return { id: price.id, reused: false };
}

async function main() {
  console.log("Stripe setup (mode test)…\n");
  for (const p of PLANS) {
    let product = await findProduct(p.plan);
    if (!product) {
      product = await stripe.products.create({
        name: p.name,
        metadata: { falcondraft_plan: p.plan },
      });
      console.log(`+ produit créé : ${p.name} (${product.id})`);
    } else {
      console.log(`= produit existant : ${p.name} (${product.id})`);
    }
    for (const interval of ["month", "year"]) {
      const r = await upsertPrice(
        product.id,
        interval,
        p.amounts[interval],
        p.lookup[interval],
      );
      console.log(
        `  ${r.reused ? "=" : "+"} prix ${interval} : ${p.lookup[interval]} → ${r.id} (${p.amounts[interval] / 100} €)`,
      );
    }
  }
  console.log("\n✅ Terminé.");
}

main().catch((err) => {
  console.error("\n❌ Échec :", err?.message ?? err);
  process.exit(1);
});
