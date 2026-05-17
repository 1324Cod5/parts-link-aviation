import { Link, useLocation } from "wouter";
import { MainLayout } from "@/components/layout/MainLayout";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { useAuth } from "@/context/AuthContext";
import {
  useGetSubscription, getGetSubscriptionQueryKey,
  useDowngradePlan
} from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import { ArrowLeft, Zap, Building2, Package, Check, AlertTriangle, Calendar } from "lucide-react";

const PLAN_META = {
  free:       { label: "Free",       color: "text-muted-foreground", bg: "bg-secondary/50",    limit: "5 listings" },
  pro:        { label: "Pro",        color: "text-primary",          bg: "bg-primary/10",       limit: "50 listings" },
  enterprise: { label: "Enterprise", color: "text-amber-400",        bg: "bg-amber-500/10",     limit: "Unlimited" },
};

export default function SubscriptionManagement() {
  const { user, isLoading: authLoading } = useAuth();
  const [, navigate] = useLocation();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const downgradeMutation = useDowngradePlan();

  const { data: subscription, isLoading } = useGetSubscription({
    query: {
      enabled: !!user,
      queryKey: getGetSubscriptionQueryKey(),
    },
  });

  const handleDowngrade = () => {
    if (!confirm("Downgrade to Free? Your listing limit will be reduced to 5.")) return;
    downgradeMutation.mutate(undefined, {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: getGetSubscriptionQueryKey() });
        toast({ title: "Downgraded to Free", description: "Your plan has been updated." });
      },
    });
  };

  if (authLoading || !user) {
    return (
      <MainLayout>
        <div className="container mx-auto px-4 py-16 text-center">
          <p className="text-muted-foreground mb-4">Please sign in to manage your subscription.</p>
          <Link href="/seller/login"><Button>Sign In</Button></Link>
        </div>
      </MainLayout>
    );
  }

  const plan = subscription?.plan ?? "free";
  const meta = PLAN_META[plan as keyof typeof PLAN_META] ?? PLAN_META.free;
  const usedPct = subscription && subscription.listingLimit
    ? Math.min(100, Math.round((subscription.activeListings / subscription.listingLimit) * 100))
    : 0;

  return (
    <MainLayout>
      <div className="container mx-auto px-4 py-8 max-w-2xl">
        <div className="mb-6">
          <Link href="/seller/dashboard">
            <Button variant="ghost" size="sm" className="text-muted-foreground">
              <ArrowLeft className="h-4 w-4 mr-1" /> Dashboard
            </Button>
          </Link>
        </div>

        <h1 className="text-2xl font-bold text-white mb-6">Subscription Management</h1>

        {/* Current Plan Card */}
        <div className="bg-card border border-border rounded-md p-6 mb-5">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">Current Plan</h2>
            {plan !== "free" && (
              <span className="text-xs text-muted-foreground">
                {subscription?.planExpiresAt
                  ? `Renews ${new Date(subscription.planExpiresAt).toLocaleDateString()}`
                  : "Active"}
              </span>
            )}
          </div>

          {isLoading ? (
            <Skeleton className="h-16 w-full" />
          ) : (
            <div className="flex items-center gap-4">
              <div className={`h-12 w-12 rounded-md flex items-center justify-center ${meta.bg}`}>
                {plan === "enterprise" ? <Building2 className="h-6 w-6 text-amber-400" />
                  : plan === "pro" ? <Zap className="h-6 w-6 text-primary" />
                  : <Package className="h-6 w-6 text-muted-foreground" />}
              </div>
              <div>
                <p className={`text-2xl font-bold ${meta.color}`}>{meta.label}</p>
                <p className="text-sm text-muted-foreground">{meta.limit}</p>
              </div>
              {plan !== "free" && (
                <div className="ml-auto flex items-center gap-1.5 bg-green-500/10 text-green-400 text-xs px-2.5 py-1 rounded-full">
                  <Check className="h-3 w-3" /> Active
                </div>
              )}
            </div>
          )}
        </div>

        {/* Usage */}
        <div className="bg-card border border-border rounded-md p-6 mb-5">
          <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider mb-4">Listing Usage</h2>
          {isLoading ? (
            <Skeleton className="h-16 w-full" />
          ) : (
            <>
              <div className="flex justify-between items-end mb-2">
                <span className="text-white font-medium">
                  {subscription?.activeListings ?? 0} active listings
                </span>
                <span className="text-sm text-muted-foreground">
                  {subscription?.listingLimit == null ? "Unlimited" : `of ${subscription.listingLimit}`}
                </span>
              </div>
              {subscription?.listingLimit != null && (
                <>
                  <div className="h-2 bg-secondary rounded-full overflow-hidden">
                    <div
                      className={`h-full rounded-full transition-all ${usedPct >= 90 ? "bg-red-500" : usedPct >= 70 ? "bg-amber-500" : "bg-primary"}`}
                      style={{ width: `${usedPct}%` }}
                    />
                  </div>
                  {usedPct >= 80 && (
                    <div className="flex items-center gap-1.5 mt-3 text-amber-400 text-xs">
                      <AlertTriangle className="h-3.5 w-3.5" />
                      {usedPct >= 100 ? "Limit reached — upgrade to add more listings." : `${usedPct}% used — consider upgrading soon.`}
                    </div>
                  )}
                </>
              )}
            </>
          )}
        </div>

        {/* Plan Comparison */}
        <div className="bg-card border border-border rounded-md p-6 mb-5">
          <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider mb-4">Available Plans</h2>
          <div className="space-y-3">
            {[
              { id: "free",       label: "Free",       price: "Free",    limit: "5 listings",        features: ["Standard visibility"] },
              { id: "pro",        label: "Pro",         price: "$149/mo", limit: "50 listings",       features: ["Priority placement", "Verified badge", "Analytics"] },
              { id: "enterprise", label: "Enterprise",  price: "$299/mo", limit: "Unlimited",          features: ["Premium placement", "Bulk upload", "Dedicated support"] },
            ].map(tier => (
              <div
                key={tier.id}
                className={`flex items-center justify-between p-4 rounded-md border transition-colors ${
                  tier.id === plan ? "border-primary bg-primary/5" : "border-border"
                }`}
              >
                <div>
                  <div className="flex items-center gap-2">
                    <span className="font-medium text-white">{tier.label}</span>
                    {tier.id === plan && (
                      <span className="text-xs bg-primary/20 text-primary px-1.5 py-0.5 rounded">Current</span>
                    )}
                  </div>
                  <p className="text-xs text-muted-foreground mt-0.5">{tier.limit} · {tier.features.join(" · ")}</p>
                </div>
                <div className="flex items-center gap-3">
                  <span className="font-mono text-white text-sm">{tier.price}</span>
                  {tier.id !== plan && tier.id !== "free" && (
                    <Link href="/pricing">
                      <Button size="sm" variant={tier.id === "pro" ? "default" : "outline"} className="text-xs h-8">
                        Upgrade
                      </Button>
                    </Link>
                  )}
                  {tier.id === "free" && plan !== "free" && (
                    <Button
                      size="sm"
                      variant="ghost"
                      className="text-xs h-8 text-destructive hover:text-destructive"
                      onClick={handleDowngrade}
                      disabled={downgradeMutation.isPending}
                    >
                      Downgrade
                    </Button>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Billing Note */}
        <div className="text-center text-xs text-muted-foreground border border-border/50 rounded-md p-4 bg-secondary/20">
          <p>This is a demonstration platform. No real payment is processed.</p>
          <p className="mt-1">In production, billing would be managed via Stripe with automatic renewal.</p>
        </div>
      </div>
    </MainLayout>
  );
}
