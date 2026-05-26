/**
 * Seed script: creates Parts Link Aviation subscription products and prices in Stripe.
 * Idempotent — if a product already exists, checks for the expected monthly and
 * yearly price points at the correct amounts and creates any that are missing.
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

    let productId: string;

    if (existing.data.length > 0) {
      const p = existing.data[0];
      productId = p.id;
      console.log(`  ✓ Product already exists: ${p.id}`);
    } else {
      // Create product
      const product = await stripe.products.create({
        name: plan.name,
        description: plan.description,
        metadata: plan.metadata,
      });
      productId = product.id;
      console.log(`  Created product: ${product.id}`);
    }

    // Check existing prices and create any that are missing at the correct amounts
    const prices = await stripe.prices.list({ product: productId, active: true, limit: 100 });

    const hasMonthly = prices.data.some(
      (pr) => pr.recurring?.interval === "month" && pr.unit_amount === plan.monthlyPrice,
    );
    const hasYearly = prices.data.some(
      (pr) => pr.recurring?.interval === "year" && pr.unit_amount === plan.yearlyPrice,
    );

    // Log all existing prices for visibility
    for (const price of prices.data) {
      const interval = price.recurring?.interval ?? "one_time";
      console.log(`    Existing price (${interval}): ${price.id} — $${(price.unit_amount! / 100).toFixed(2)}`);
    }

    if (!hasMonthly) {
      const monthly = await stripe.prices.create({
        product: productId,
        unit_amount: plan.monthlyPrice,
        currency: "usd",
        recurring: { interval: "month" },
        metadata: { plan: plan.metadata.plan, billing: "monthly" },
      });
      console.log(`  ✓ Created monthly price: ${monthly.id} — $${(plan.monthlyPrice / 100).toFixed(2)}/mo`);
    } else {
      console.log(`  ✓ Monthly price already correct ($${(plan.monthlyPrice / 100).toFixed(2)}/mo)`);
    }

    if (!hasYearly) {
      const yearly = await stripe.prices.create({
        product: productId,
        unit_amount: plan.yearlyPrice,
        currency: "usd",
        recurring: { interval: "year" },
        metadata: { plan: plan.metadata.plan, billing: "yearly" },
      });
      console.log(`  ✓ Created yearly price: ${yearly.id} — $${(plan.yearlyPrice / 100).toFixed(2)}/yr`);
    } else {
      console.log(`  ✓ Yearly price already correct ($${(plan.yearlyPrice / 100).toFixed(2)}/yr)`);
    }
  }

  console.log("\n✓ Done seeding products.");
  console.log("Stripe webhooks will automatically sync product data to the database.");
}

seedProducts().catch((err) => {
  console.error("Error seeding products:", err);
  process.exit(1);
});
