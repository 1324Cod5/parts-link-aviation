import { Link, useLocation } from "wouter";
import { MainLayout } from "@/components/layout/MainLayout";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/context/AuthContext";
import { useGetSubscription, getGetSubscriptionQueryKey, useUpgradePlan } from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import { Check, Zap, Building2, Package } from "lucide-react";

const TIERS = [
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
    price: 399,
    priceLabel: "$399/mo",
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
        {/* Header */}
        <div className="text-center max-w-2xl mx-auto mb-16">
          <h1 className="text-4xl font-bold text-white mb-4">Simple, Transparent Pricing</h1>
          <p className="text-muted-foreground text-lg">
            List your certified aircraft components to a global network of qualified buyers.
            Scale your subscription as your inventory grows.
          </p>
        </div>

        {/* Pricing Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 max-w-5xl mx-auto">
          {TIERS.map(tier => {
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
                    {tier.price && <span className="text-muted-foreground text-sm"></span>}
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
                    className={`w-full ${tier.highlight ? "" : "variant-outline"}`}
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

        {/* FAQ / Notes */}
        <div className="max-w-2xl mx-auto mt-16 pt-12 border-t border-border">
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
                q: "Can I downgrade at any time?",
                a: "Yes. Downgrading to Free will reduce your limit to 5 active listings. Listings beyond the limit will remain but won't be visible until you're within limits or upgrade again.",
              },
              {
                q: "What does 'Priority Placement' mean?",
                a: "Pro and Enterprise listings are displayed ahead of standard listings in search results and on the homepage featured section.",
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
