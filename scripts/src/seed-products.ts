/**
 * Seed script: creates AeroParts subscription products and prices in Stripe.
 * Safe to run multiple times — checks for existing products before creating.
 *
 * Run with: pnpm --filter @workspace/scripts exec tsx src/seed-products.ts
 */
import { getUncachableStripeClient } from "./stripeClient";

const PLANS = [
  {
    name: "Parts Pro Seller",
    description: "Up to 500 active listings, full RFQ buyer contact details, bulk upload, instant email alerts, AOG notifications, priority placement",
    metadata: { plan: "pro", type: "seller" },
    monthlyPrice: 2900,  // $29.00
    yearlyPrice: 29000,  // $290.00 (~$24/mo, save $58/yr)
  },
  {
    name: "Parts Enterprise",
    description: "Unlimited listings, highest RFQ priority, intelligence dashboard, predictive alerts, featured placement, full analytics",
    metadata: { plan: "enterprise", type: "seller" },
    monthlyPrice: 9900,  // $99.00
    yearlyPrice: 99000,  // $990.00 (~$83/mo, save $198/yr)
  },
  {
    name: "MRO Provider",
    description: "MRO directory listing, unlimited service types, full RFQ access, verified badge, priority placement",
    metadata: { plan: "mro_provider", type: "mro" },
    monthlyPrice: 1000,  // $10.00
    yearlyPrice: 10000,  // $100.00
  },
] as const;

async function seedProducts() {
  const stripe = await getUncachableStripeClient();

  for (const plan of PLANS) {
    console.log(`\nChecking for existing product: ${plan.name}`);

    const existing = await stripe.products.search({
      query: `name:'${plan.name}' AND active:'true'`,
    });

    if (existing.data.length > 0) {
      const p = existing.data[0];
      console.log(`  ✓ Already exists: ${p.id}`);

      // Show existing prices
      const prices = await stripe.prices.list({ product: p.id, active: true, limit: 10 });
      for (const price of prices.data) {
        const interval = price.recurring?.interval ?? "one_time";
        console.log(`    Price (${interval}): ${price.id} — $${(price.unit_amount! / 100).toFixed(2)}`);
      }
      continue;
    }

    // Create product
    const product = await stripe.products.create({
      name: plan.name,
      description: plan.description,
      metadata: plan.metadata,
    });
    console.log(`  Created product: ${product.id}`);

    // Monthly price
    const monthly = await stripe.prices.create({
      product: product.id,
      unit_amount: plan.monthlyPrice,
      currency: "usd",
      recurring: { interval: "month" },
      metadata: { plan: plan.metadata.plan, billing: "monthly" },
    });
    console.log(`  Monthly price: ${monthly.id} — $${(plan.monthlyPrice / 100).toFixed(2)}/mo`);

    // Yearly price
    const yearly = await stripe.prices.create({
      product: product.id,
      unit_amount: plan.yearlyPrice,
      currency: "usd",
      recurring: { interval: "year" },
      metadata: { plan: plan.metadata.plan, billing: "yearly" },
    });
    console.log(`  Yearly price:  ${yearly.id} — $${(plan.yearlyPrice / 100).toFixed(2)}/yr`);
  }

  console.log("\n✓ Done seeding products.");
  console.log("Run `pnpm --filter @workspace/api-server run dev` to start the server.");
  console.log("Stripe webhooks will automatically sync product data to the database.");
}

seedProducts().catch((err) => {
  console.error("Error seeding products:", err);
  process.exit(1);
});
