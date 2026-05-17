import { Link, useLocation } from "wouter";
import { MainLayout } from "@/components/layout/MainLayout";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/context/AuthContext";
import { useGetSubscription, getGetSubscriptionQueryKey, useUpgradePlan } from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import { Check, Zap, Building2, Package, Wrench, ShieldCheck, Star, Rocket, Clock } from "lucide-react";

const PARTS_TIERS = [
  {
    id: "free" as const,
    name: "Free",
    price: null,
    priceLabel: "Free",
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
    cta: "Get Started Free",
    highlight: false,
  },
  {
    id: "pro" as const,
    name: "Pro",
    price: 149,
    priceLabel: "$149/mo",
    icon: Zap,
    listingLimit: 50,
    description: "For growing MROs and active parts brokers.",
    features: [
      "Up to 50 active listings",
      "Priority placement in search results",
      "Verified seller badge on your profile",
      "Seller analytics dashboard",
      "Early access to buyer RFQs",
      "Priority email support",
    ],
    cta: "Upgrade to Pro",
    highlight: true,
  },
  {
    id: "enterprise" as const,
    name: "Enterprise",
    price: 299,
    priceLabel: "$299/mo",
    icon: Building2,
    listingLimit: null,
    description: "For airlines, large MROs, and global distributors.",
    features: [
      "Unlimited active listings",
      "Premium homepage placement",
      "Bulk CSV upload tools",
      "Dedicated account manager",
      "API access for inventory sync",
      "Custom contract terms",
      "SLA-backed support",
    ],
    cta: "Upgrade to Enterprise",
    highlight: false,
  },
];

const MRO_TIERS = [
  {
    id: "mro_free",
    name: "Free",
    price: null,
    priceLabel: "Free",
    icon: Wrench,
    description: "Get started with a basic MRO listing.",
    features: [
      "1 MRO service listing",
      "Basic directory visibility",
      "Up to 3 service categories",
      "Up to 5 part numbers listed",
      "Inbound quote request form",
    ],
    cta: "Create Free Listing",
    href: "/mro/register",
    highlight: false,
    badge: null,
  },
  {
    id: "mro_verified",
    name: "Verified MRO",
    price: 49,
    priceLabel: "$49/mo",
    icon: ShieldCheck,
    description: "For active MROs seeking qualified service leads.",
    features: [
      "Full MRO profile listing",
      "Up to 12 service categories",
      "Up to 50 part numbers listed",
      "Capability document references",
      "Priority directory placement",
      "Verified MRO badge",
      "Email notification on new quotes",
    ],
    cta: "Get Verified MRO",
    href: "/mro/register",
    highlight: true,
    badge: null,
  },
  {
    id: "mro_premium",
    name: "Premium MRO",
    price: 149,
    priceLabel: "$149/mo",
    icon: Star,
    description: "Maximum visibility for high-volume service providers.",
    features: [
      "Everything in Verified MRO",
      "Featured placement (homepage + search top)",
      "Unlimited part numbers listed",
      "Up to 20 capability documents",
      "AOG priority listing indicator",
      "Analytics & quote tracking",
      "Dedicated account support",
    ],
    cta: "Get Premium MRO",
    href: "/mro/register",
    highlight: false,
    badge: null,
  },
];

export default function Pricing() {
  const { user } = useAuth();
  const [, navigate] = useLocation();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const upgradeMutation = useUpgradePlan();

  const { data: subscription } = useGetSubscription({
    query: {
      enabled: !!user && user.role === "seller",
      queryKey: getGetSubscriptionQueryKey(),
    },
  });

  const handleUpgrade = (plan: "pro" | "enterprise") => {
    if (!user) {
      navigate("/seller/login");
      return;
    }
    upgradeMutation.mutate(
      { data: { plan } },
      {
        onSuccess: () => {
          queryClient.invalidateQueries({ queryKey: getGetSubscriptionQueryKey() });
          toast({
            title: `Upgraded to ${plan.charAt(0).toUpperCase() + plan.slice(1)}`,
            description: "Your plan has been updated. Your new limits are effective immediately.",
          });
          navigate("/seller/subscription");
        },
        onError: () => {
          toast({ title: "Upgrade failed", description: "Please try again.", variant: "destructive" });
        },
      }
    );
  };

  const currentPlan = subscription?.plan ?? user?.plan ?? "free";

  return (
    <MainLayout>
      <div className="container mx-auto px-4 py-16">

        {/* ── PARTS MARKETPLACE SECTION ── */}
        <div className="text-center max-w-2xl mx-auto mb-14">
          <div className="inline-flex items-center gap-2 text-xs text-muted-foreground uppercase tracking-widest border border-border rounded-full px-3 py-1 mb-4">
            <Package className="w-3.5 h-3.5" /> Parts Marketplace
          </div>
          <h1 className="text-4xl font-bold text-white mb-4">Simple, Transparent Pricing</h1>
          <p className="text-muted-foreground text-lg">
            List your certified aircraft components to a global network of qualified buyers.
            Scale your subscription as your inventory grows.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 max-w-5xl mx-auto mb-24">
          {PARTS_TIERS.map(tier => {
            const Icon = tier.icon;
            const isCurrentPlan = currentPlan === tier.id;
            const isDowngrade = (
              (currentPlan === "enterprise" && (tier.id === "pro" || tier.id === "free")) ||
              (currentPlan === "pro" && tier.id === "free")
            );

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
                    <span className="text-4xl font-bold text-white font-mono">{tier.priceLabel}</span>
                  </div>
                </div>

                <ul className="space-y-3 mb-8 flex-1">
                  {tier.features.map(feature => (
                    <li key={feature} className="flex items-start gap-2.5 text-sm">
                      <Check className={`h-4 w-4 mt-0.5 flex-shrink-0 ${tier.highlight ? "text-primary" : "text-muted-foreground"}`} />
                      <span className="text-white/80">{feature}</span>
                    </li>
                  ))}
                </ul>

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
                    className="w-full"
                    variant={tier.highlight ? "default" : "outline"}
                    disabled={upgradeMutation.isPending || isDowngrade}
                    onClick={() => handleUpgrade(tier.id as "pro" | "enterprise")}
                  >
                    {upgradeMutation.isPending ? "Processing..." : isDowngrade ? "Downgrade" : tier.cta}
                  </Button>
                )}
              </div>
            );
          })}
        </div>

        {/* ── MRO SERVICES SECTION ── */}
        <div className="border-t border-border pt-20">
          {/* Launch Partner Promo Banner */}
          <div className="max-w-5xl mx-auto mb-10">
            <div className="relative overflow-hidden rounded-xl border border-amber-500/40 bg-gradient-to-br from-amber-500/10 via-amber-500/5 to-transparent p-6 md:p-8">
              {/* Decorative glow */}
              <div className="absolute -top-10 -right-10 w-40 h-40 bg-amber-500/10 rounded-full blur-3xl pointer-events-none" />
              <div className="relative flex flex-col md:flex-row md:items-center gap-6">
                <div className="flex items-start gap-4 flex-1">
                  <div className="w-12 h-12 rounded-xl bg-amber-500/20 border border-amber-500/30 flex items-center justify-center flex-shrink-0">
                    <Rocket className="w-6 h-6 text-amber-400" />
                  </div>
                  <div>
                    <div className="flex items-center gap-2 mb-1.5">
                      <span className="text-xs font-bold uppercase tracking-widest text-amber-400 bg-amber-500/20 border border-amber-500/30 rounded-full px-2.5 py-0.5">
                        Launch Partner Offer
                      </span>
                      <span className="text-xs text-amber-500/70 flex items-center gap-1">
                        <Clock className="w-3 h-3" /> Limited time
                      </span>
                    </div>
                    <h3 className="text-xl font-bold text-white mb-1">
                      First 3 months at <span className="text-amber-400 font-mono">$20/mo</span> for early MRO adopters
                    </h3>
                    <p className="text-sm text-amber-200/60 leading-relaxed">
                      Be among the first MRO providers on AeroParts and lock in the launch partner rate on any paid MRO plan.
                      After 3 months, your plan renews at the standard rate — cancel anytime.
                    </p>
                  </div>
                </div>
                <div className="flex-shrink-0">
                  <Link href="/mro/register">
                    <Button className="bg-amber-500 hover:bg-amber-400 text-black font-semibold gap-2 px-6">
                      <Rocket className="w-4 h-4" /> Claim Launch Rate
                    </Button>
                  </Link>
                </div>
              </div>
            </div>
          </div>

          {/* MRO Section Header */}
          <div className="text-center max-w-2xl mx-auto mb-12">
            <div className="inline-flex items-center gap-2 text-xs text-muted-foreground uppercase tracking-widest border border-border rounded-full px-3 py-1 mb-4">
              <Wrench className="w-3.5 h-3.5" /> MRO Services Directory
            </div>
            <h2 className="text-3xl font-bold text-white mb-3">MRO Services Pricing</h2>
            <p className="text-muted-foreground">
              List your MRO capabilities and receive qualified service quote requests directly from operators and airlines worldwide.
            </p>
          </div>

          {/* MRO Tier Cards */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 max-w-5xl mx-auto">
            {MRO_TIERS.map(tier => {
              const Icon = tier.icon;
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
                    <h3 className="text-xl font-bold text-white mb-1">{tier.name}</h3>
                    <p className="text-muted-foreground text-sm mb-4">{tier.description}</p>
                    <div className="space-y-1">
                      <div className="flex items-baseline gap-1">
                        <span className="text-4xl font-bold text-white font-mono">{tier.priceLabel}</span>
                      </div>
                      {tier.price && (
                        <div className="flex items-center gap-1.5">
                          <span className="text-xs text-amber-400 font-medium line-through opacity-60">{tier.priceLabel}</span>
                          <span className="text-xs bg-amber-500/20 border border-amber-500/30 text-amber-400 rounded-full px-2 py-0.5 font-medium flex items-center gap-1">
                            <Rocket className="w-2.5 h-2.5" /> $20/mo for 3 months
                          </span>
                        </div>
                      )}
                    </div>
                  </div>

                  <ul className="space-y-3 mb-8 flex-1">
                    {tier.features.map(feature => (
                      <li key={feature} className="flex items-start gap-2.5 text-sm">
                        <Check className={`h-4 w-4 mt-0.5 flex-shrink-0 ${tier.highlight ? "text-primary" : "text-muted-foreground"}`} />
                        <span className="text-white/80">{feature}</span>
                      </li>
                    ))}
                  </ul>

                  <Link href={tier.href}>
                    <Button
                      className="w-full"
                      variant={tier.highlight ? "default" : "outline"}
                    >
                      {tier.cta}
                    </Button>
                  </Link>
                </div>
              );
            })}
          </div>
        </div>

        {/* FAQ */}
        <div className="max-w-2xl mx-auto mt-20 pt-12 border-t border-border">
          <h2 className="text-xl font-bold text-white mb-6 text-center">Common Questions</h2>
          <div className="space-y-6">
            {[
              {
                q: "Is this a live billing system?",
                a: "This is a demonstration platform. Upgrades are simulated — no payment is charged. In a production deployment, this would integrate with Stripe for real billing.",
              },
              {
                q: "What happens when I hit my listing limit?",
                a: "You'll be prompted to upgrade when you attempt to create a new listing beyond your plan's limit. Existing listings remain active.",
              },
              {
                q: "How does the Launch Partner promotion work?",
                a: "Early MRO adopters who sign up during the launch period receive the first 3 months at $20/month on any paid MRO plan. After 3 months, the plan renews at the standard rate ($49/mo or $149/mo).",
              },
              {
                q: "What is the difference between Parts listings and MRO listings?",
                a: "Parts listings let you sell aircraft components to buyers. MRO listings let you advertise your repair, overhaul, and maintenance services and receive direct service quote requests from operators and airlines.",
              },
              {
                q: "Can I downgrade at any time?",
                a: "Yes. Downgrading to Free will reduce your active listing limit. Existing listings remain but may not be visible until you're within your plan's limits or upgrade again.",
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
