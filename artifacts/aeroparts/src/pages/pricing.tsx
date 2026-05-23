import { useState } from "react";
import { Link, useLocation } from "wouter";
import { MainLayout } from "@/components/layout/MainLayout";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/context/AuthContext";
import {
  useGetSubscription,
  getGetSubscriptionQueryKey,
  useGetSubscriptionProducts,
  useCreateCheckoutSession,
} from "@workspace/api-client-react";

import { useToast } from "@/hooks/use-toast";
import { Check, Zap, Building2, Package, Wrench, Star, Rocket, Clock, Loader2, CalendarDays, Brain, Radio, Upload } from "lucide-react";

type BillingCycle = "monthly" | "yearly";

const PARTS_TIERS = [
  {
    id: "free" as const,
    planKey: "free",
    name: "Free",
    monthlyPrice: null,
    yearlyPrice: null,
    icon: Package,
    listingLimit: 5,
    description: "For individual brokers testing the platform.",
    features: [
      "Up to 5 active listings",
      "Standard marketplace visibility",
      "Buyer inquiry forms",
      "Part number search indexing",
      "Community support",
    ],
    lockedFeatures: [
      "Bulk CSV upload",
      "Full RFQ buyer contact details",
      "Instant RFQ email alerts",
      "AOG push notifications",
    ],
    cta: "Get Started Free",
    highlight: false,
    supportsYearly: false,
  },
  {
    id: "pro" as const,
    planKey: "pro",
    name: "Parts Pro",
    monthlyPrice: 29,
    yearlyPrice: 290,
    icon: Zap,
    listingLimit: 500,
    description: "For growing MROs and active parts brokers.",
    features: [
      "Up to 500 active listings",
      "Priority placement in search results",
      "Full buyer contact on all RFQs",
      "Bulk CSV listing upload",
      "Instant RFQ email alerts",
      "AOG push notifications",
      "Seller analytics dashboard",
      "Priority email support",
    ],
    lockedFeatures: [],
    cta: "Upgrade to Pro",
    highlight: true,
    supportsYearly: true,
  },
  {
    id: "enterprise" as const,
    planKey: "enterprise",
    name: "Enterprise",
    monthlyPrice: 99,
    yearlyPrice: 990,
    icon: Building2,
    listingLimit: null,
    description: "For airlines, large MROs, and global distributors.",
    features: [
      "Unlimited active listings",
      "Highest RFQ priority ranking",
      "Intelligence dashboard",
      "Predictive demand alerts",
      "Featured homepage placement",
      "Full RFQ access + response metrics",
      "Dedicated account manager",
      "API access for inventory sync",
      "SLA-backed support",
    ],
    lockedFeatures: [],
    cta: "Upgrade to Enterprise",
    highlight: false,
    supportsYearly: true,
  },
];

const MRO_TIER = {
  id: "mro_provider" as const,
  planKey: "mro_provider",
  name: "MRO Provider",
  monthlyPrice: 10,
  yearlyPrice: 100,
  icon: Wrench,
  description: "For certified MROs seeking qualified service leads.",
  features: [
    "Full MRO profile listing",
    "Unlimited service categories",
    "Capability document references",
    "Priority directory placement",
    "Verified MRO badge",
    "Email notification on new quotes",
    "Full RFQ buyer contact access",
    "Analytics & quote tracking",
  ],
  cta: "Get MRO Provider",
  supportsYearly: true,
};

export default function Pricing() {
  const { user } = useAuth();
  const [, navigate] = useLocation();
  const { toast } = useToast();
  const [checkingOutPlan, setCheckingOutPlan] = useState<string | null>(null);
  const [billingCycle, setBillingCycle] = useState<BillingCycle>("monthly");

  const checkoutMutation = useCreateCheckoutSession();

  const { data: subscription } = useGetSubscription({
    query: { enabled: !!user && user.role === "seller", queryKey: getGetSubscriptionQueryKey() },
  });

  const { data: productsData } = useGetSubscriptionProducts();

  const currentPlan = (subscription as any)?.effectivePlan ?? subscription?.plan ?? user?.plan ?? "free";

  const getPriceId = (planKey: string, cycle: BillingCycle): string | null => {
    if (!productsData?.products) return null;
    for (const product of productsData.products) {
      const meta = product.metadata as Record<string, string> | undefined;
      if (meta?.plan === planKey) {
        const targetInterval = cycle === "yearly" ? "year" : "month";
        const price = product.prices.find((p: any) => p.interval === targetInterval);
        return price?.id ?? product.prices.find((p: any) => p.interval === "month")?.id ?? null;
      }
    }
    return null;
  };

  const handleCheckout = async (planKey: string, cycle: BillingCycle = billingCycle) => {
    if (!user) {
      navigate("/seller/login");
      return;
    }

    const priceId = getPriceId(planKey, cycle);
    if (!priceId) {
      toast({
        title: "Plan not available",
        description: "This plan isn't configured yet. Contact support or check back soon.",
        variant: "destructive",
      });
      return;
    }

    setCheckingOutPlan(planKey);
    checkoutMutation.mutate(
      { data: { priceId } },
      {
        onSuccess: (data: any) => {
          if (data?.url) {
            window.location.href = data.url;
          } else {
            toast({ title: "Checkout error", description: "No redirect URL returned.", variant: "destructive" });
            setCheckingOutPlan(null);
          }
        },
        onError: (err: any) => {
          toast({
            title: "Checkout failed",
            description: err?.response?.data?.error ?? "Please try again.",
            variant: "destructive",
          });
          setCheckingOutPlan(null);
        },
      },
    );
  };

  return (
    <MainLayout>
      <div className="container mx-auto px-4 py-16">

        {/* ── PARTS MARKETPLACE SECTION ── */}
        <div className="text-center max-w-2xl mx-auto mb-10">
          <div className="inline-flex items-center gap-2 text-xs text-muted-foreground uppercase tracking-widest border border-border rounded-full px-3 py-1 mb-4">
            <Package className="w-3.5 h-3.5" /> Parts Marketplace
          </div>
          <h1 className="text-4xl font-bold text-white mb-4">Simple, Transparent Pricing</h1>
          <p className="text-muted-foreground text-lg">
            List your certified aircraft components to a global network of qualified buyers.
            Scale your subscription as your inventory grows.
          </p>
        </div>

        {/* Billing cycle toggle */}
        <div className="flex flex-col items-center gap-3 mb-10">
          <div className="inline-flex items-center bg-secondary/60 border border-border rounded-lg p-1 gap-1">
            <button
              onClick={() => setBillingCycle("monthly")}
              className={`px-5 py-2 rounded-md text-sm font-medium transition-colors ${
                billingCycle === "monthly"
                  ? "bg-card text-white shadow"
                  : "text-muted-foreground hover:text-white"
              }`}
            >
              Monthly
            </button>
            <button
              onClick={() => setBillingCycle("yearly")}
              className={`px-5 py-2 rounded-md text-sm font-medium transition-colors flex items-center gap-2 ${
                billingCycle === "yearly"
                  ? "bg-card text-white shadow"
                  : "text-muted-foreground hover:text-white"
              }`}
            >
              <CalendarDays className="h-3.5 w-3.5" />
              Yearly
            </button>
          </div>
          {billingCycle === "yearly" && (
            <div className="inline-flex items-center gap-1.5 text-xs font-semibold text-green-400 bg-green-500/10 border border-green-500/20 rounded-full px-3 py-1">
              <Check className="h-3 w-3" />
              Save ~$58–$198/yr — pay for 10 months, get 12
            </div>
          )}
          {billingCycle === "monthly" && (
            <p className="text-xs text-muted-foreground">Switch to yearly to save on Pro &amp; Enterprise</p>
          )}
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 max-w-5xl mx-auto mb-24">
          {PARTS_TIERS.map(tier => {
            const Icon = tier.icon;
            const isCurrentPlan = currentPlan === tier.id;
            const isDowngrade = (
              (currentPlan === "enterprise" && (tier.id === "pro" || tier.id === "free")) ||
              (currentPlan === "pro" && tier.id === "free")
            );
            const isLoading = checkingOutPlan === tier.planKey;

            const showYearly = billingCycle === "yearly" && tier.supportsYearly;
            const displayedPrice = showYearly ? tier.yearlyPrice : tier.monthlyPrice;
            const perMonthEquiv = showYearly && tier.yearlyPrice
              ? Math.round(tier.yearlyPrice / 12)
              : null;

            let priceLabel: string;
            if (displayedPrice == null) {
              priceLabel = "Free";
            } else if (showYearly) {
              priceLabel = `$${displayedPrice.toLocaleString()}/yr`;
            } else {
              priceLabel = `$${displayedPrice}/mo`;
            }

            const savingsAmount = tier.monthlyPrice && tier.yearlyPrice
              ? tier.monthlyPrice * 12 - tier.yearlyPrice
              : null;

            return (
              <div
                key={tier.id}
                className={`relative rounded-lg border p-8 flex flex-col ${
                  tier.highlight
                    ? "border-primary bg-primary/5 shadow-lg shadow-primary/10"
                    : "border-border bg-card"
                }`}
              >
                {tier.highlight && (
                  <div className="absolute -top-3 left-1/2 -translate-x-1/2">
                    <span className="bg-primary text-primary-foreground text-xs font-bold px-3 py-1 rounded-full uppercase tracking-wider">
                      Most Popular
                    </span>
                  </div>
                )}

                <div className="mb-6">
                  <div className={`h-10 w-10 rounded-md flex items-center justify-center mb-4 ${
                    tier.highlight ? "bg-primary/20" : "bg-secondary"
                  }`}>
                    <Icon className={`h-5 w-5 ${tier.highlight ? "text-primary" : "text-muted-foreground"}`} />
                  </div>
                  <h2 className="text-xl font-bold text-white mb-1">{tier.name}</h2>
                  <p className="text-muted-foreground text-sm mb-4">{tier.description}</p>

                  <div className="flex items-baseline gap-1">
                    <span className="text-4xl font-bold text-white font-mono">{priceLabel}</span>
                  </div>
                  {showYearly && perMonthEquiv && (
                    <p className="text-xs text-muted-foreground mt-1">
                      ~${perMonthEquiv}/mo · billed annually
                    </p>
                  )}
                  {!showYearly && tier.monthlyPrice && (
                    <p className="text-xs text-muted-foreground mt-1">billed monthly</p>
                  )}
                  {showYearly && savingsAmount && (
                    <div className="inline-flex items-center gap-1 mt-2 text-xs text-green-400 font-medium bg-green-500/10 border border-green-500/20 rounded-full px-2.5 py-0.5">
                      <Check className="h-3 w-3" /> Save ${savingsAmount}/yr
                    </div>
                  )}
                </div>

                <ul className="space-y-3 mb-4 flex-1">
                  {tier.features.map(feature => (
                    <li key={feature} className="flex items-start gap-2.5 text-sm">
                      <Check className={`h-4 w-4 mt-0.5 flex-shrink-0 ${tier.highlight ? "text-primary" : "text-muted-foreground"}`} />
                      <span className="text-white/80">{feature}</span>
                    </li>
                  ))}
                  {tier.lockedFeatures.map(feature => (
                    <li key={feature} className="flex items-start gap-2.5 text-sm opacity-40 line-through">
                      <Check className="h-4 w-4 mt-0.5 flex-shrink-0 text-muted-foreground" />
                      <span className="text-muted-foreground">{feature}</span>
                    </li>
                  ))}
                </ul>

                <div className="mb-8" />

                {isCurrentPlan ? (
                  <div className="w-full py-2.5 px-4 rounded-md border border-border text-center text-sm text-muted-foreground font-medium">
                    Current Plan
                  </div>
                ) : tier.id === "free" ? (
                  isDowngrade ? (
                    <Link href="/seller/subscription">
                      <Button variant="outline" className="w-full">Manage Plan</Button>
                    </Link>
                  ) : !user ? (
                    <Link href="/seller/register">
                      <Button variant="outline" className="w-full">{tier.cta}</Button>
                    </Link>
                  ) : (
                    <div className="w-full py-2.5 px-4 rounded-md border border-border text-center text-sm text-muted-foreground font-medium">
                      Current Plan
                    </div>
                  )
                ) : (
                  <Button
                    className="w-full gap-2"
                    variant={tier.highlight ? "default" : "outline"}
                    disabled={!!checkingOutPlan || isDowngrade}
                    onClick={() => handleCheckout(tier.planKey, billingCycle)}
                  >
                    {isLoading ? (
                      <><Loader2 className="h-4 w-4 animate-spin" /> Redirecting…</>
                    ) : isDowngrade ? "Downgrade" : tier.cta}
                  </Button>
                )}
              </div>
            );
          })}
        </div>

        {/* ── MRO SERVICES SECTION ── */}
        <div className="border-t border-border pt-20">
          <div className="text-center max-w-2xl mx-auto mb-14">
            <div className="inline-flex items-center gap-2 text-xs text-muted-foreground uppercase tracking-widest border border-border rounded-full px-3 py-1 mb-4">
              <Wrench className="w-3.5 h-3.5" /> MRO Services
            </div>
            <h2 className="text-3xl font-bold text-white mb-4">MRO Directory Listings</h2>
            <p className="text-muted-foreground">
              Get discovered by airlines, operators, and fleet managers searching for certified maintenance, repair &amp; overhaul providers.
            </p>
          </div>

          {/* Single MRO Provider card + feature callouts */}
          <div className="max-w-5xl mx-auto grid grid-cols-1 md:grid-cols-2 gap-8 items-start">
            {/* Card */}
            <div className="relative rounded-lg border border-primary bg-primary/5 shadow-lg shadow-primary/10 p-8 flex flex-col">
              <div className="absolute -top-3 left-1/2 -translate-x-1/2">
                <span className="bg-primary text-primary-foreground text-xs font-bold px-3 py-1 rounded-full uppercase tracking-wider">
                  Single Plan
                </span>
              </div>

              <div className="mb-6">
                <div className="h-10 w-10 rounded-md flex items-center justify-center mb-4 bg-primary/20">
                  <Wrench className="h-5 w-5 text-primary" />
                </div>
                <h3 className="text-xl font-bold text-white mb-1">{MRO_TIER.name}</h3>
                <p className="text-muted-foreground text-sm mb-4">{MRO_TIER.description}</p>

                {/* Price */}
                <div className="flex items-baseline gap-1">
                  <span className="text-4xl font-bold text-white font-mono">
                    {billingCycle === "yearly" ? `$${MRO_TIER.yearlyPrice}/yr` : `$${MRO_TIER.monthlyPrice}/mo`}
                  </span>
                </div>
                {billingCycle === "yearly" && (
                  <p className="text-xs text-muted-foreground mt-1">~$8/mo · billed annually</p>
                )}
                {billingCycle === "monthly" && (
                  <p className="text-xs text-muted-foreground mt-1">billed monthly</p>
                )}
                {billingCycle === "yearly" && (
                  <div className="inline-flex items-center gap-1 mt-2 text-xs text-green-400 font-medium bg-green-500/10 border border-green-500/20 rounded-full px-2.5 py-0.5">
                    <Check className="h-3 w-3" /> Save $20/yr
                  </div>
                )}
              </div>

              <ul className="space-y-3 mb-8 flex-1">
                {MRO_TIER.features.map(feature => (
                  <li key={feature} className="flex items-start gap-2.5 text-sm">
                    <Check className="h-4 w-4 mt-0.5 flex-shrink-0 text-primary" />
                    <span className="text-white/80">{feature}</span>
                  </li>
                ))}
              </ul>

              {currentPlan === "mro_provider" || currentPlan === "mro_verified" || currentPlan === "mro_premium" ? (
                <div className="w-full py-2.5 px-4 rounded-md border border-border text-center text-sm text-muted-foreground font-medium">
                  Current Plan
                </div>
              ) : (
                <Button
                  className="w-full gap-2"
                  disabled={!!checkingOutPlan}
                  onClick={() => handleCheckout(MRO_TIER.planKey, billingCycle)}
                >
                  {checkingOutPlan === MRO_TIER.planKey ? (
                    <><Loader2 className="h-4 w-4 animate-spin" /> Redirecting…</>
                  ) : MRO_TIER.cta}
                </Button>
              )}
            </div>

            {/* Feature callout tiles */}
            <div className="space-y-4">
              {[
                {
                  icon: Star,
                  title: "Verified MRO Badge",
                  desc: "Display a trust badge on your directory listing. Buyers filter by verified providers — stand out from unverified listings.",
                },
                {
                  icon: Radio,
                  title: "Quote Request Notifications",
                  desc: "Receive instant email alerts whenever a buyer submits a quote request matching your service categories.",
                },
                {
                  icon: Upload,
                  title: "Unlimited Service Categories",
                  desc: "List every capability — airframe, engine, avionics, NDT, and more — with no cap on categories or sub-types.",
                },
                {
                  icon: Brain,
                  title: "Analytics & Tracking",
                  desc: "See how many buyers viewed your profile, which services drive the most quote requests, and your response conversion rate.",
                },
              ].map(({ icon: Icon, title, desc }) => (
                <div key={title} className="flex gap-4 p-4 rounded-lg border border-border bg-card">
                  <div className="h-9 w-9 rounded-md flex items-center justify-center bg-secondary flex-shrink-0">
                    <Icon className="h-4 w-4 text-primary" />
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-white mb-0.5">{title}</p>
                    <p className="text-xs text-muted-foreground leading-relaxed">{desc}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* FAQ */}
        <div className="max-w-2xl mx-auto mt-20 pt-12 border-t border-border">
          <h2 className="text-xl font-bold text-white mb-6 text-center">Common Questions</h2>
          <div className="space-y-6">
            {[
              {
                q: "What's the difference between monthly and yearly billing?",
                a: "Monthly billing charges your card each month. Yearly billing charges once per year and saves you roughly 2 months — Pro yearly is $290/yr vs $348/yr monthly; Enterprise yearly is $990/yr vs $1,188/yr; MRO Provider yearly is $100/yr vs $120/yr.",
              },
              {
                q: "How does billing work?",
                a: "All plans are billed through Stripe. You'll be redirected to a secure Stripe Checkout page to enter your payment details. You can manage, upgrade, or cancel at any time via the billing portal.",
              },
              {
                q: "What happens when I hit my listing limit?",
                a: "You'll be prompted to upgrade when you attempt to create a new listing beyond your plan's limit. Existing listings remain active. Free is capped at 5; Pro at 500; Enterprise is unlimited.",
              },
              {
                q: "What happens if my payment fails?",
                a: "You get a 7-day grace period while Stripe retries your payment. During that time your plan stays active. If payment isn't resolved after 7 days, your account is downgraded to Free.",
              },
              {
                q: "What are AOG notifications?",
                a: "AOG (Aircraft on Ground) alerts are real-time notifications pushed to Pro and Enterprise sellers when a buyer submits an urgent RFQ flagged as AOG. These appear on your dashboard and trigger instant email alerts.",
              },
              {
                q: "What is the intelligence dashboard?",
                a: "Available exclusively on Enterprise, the intelligence dashboard surfaces demand trends, fraud risk indicators, and predictive demand alerts for parts you stock — helping you price competitively and stock the right inventory.",
              },
              {
                q: "Can I cancel at any time?",
                a: "Yes. Cancelling through the billing portal keeps your access active until the end of the current billing period, then downgrades to Free. No penalties.",
              },
            ].map(({ q, a }) => (
              <div key={q}>
                <h3 className="text-white font-medium mb-1">{q}</h3>
                <p className="text-muted-foreground text-sm leading-relaxed">{a}</p>
              </div>
            ))}
          </div>
        </div>
      </div>
    </MainLayout>
  );
}
