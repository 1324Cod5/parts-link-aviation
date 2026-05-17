import { useState } from "react";
import { Link } from "wouter";
import { MainLayout } from "@/components/layout/MainLayout";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { useAuth } from "@/context/AuthContext";
import {
  useGetSubscription,
  getGetSubscriptionQueryKey,
  useCreatePortalSession,
  useCancelSubscription,
} from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import {
  ArrowLeft, Zap, Building2, Package, Check, AlertTriangle,
  ShieldCheck, Star, CreditCard, ExternalLink, XCircle, Clock,
} from "lucide-react";

const PLAN_META: Record<string, { label: string; color: string; bg: string; limit: string; icon: React.ElementType }> = {
  free:        { label: "Free",        color: "text-muted-foreground", bg: "bg-secondary/50",   limit: "5 listings",       icon: Package },
  pro:         { label: "Pro",         color: "text-primary",          bg: "bg-primary/10",      limit: "50 listings",      icon: Zap },
  enterprise:  { label: "Enterprise",  color: "text-amber-400",        bg: "bg-amber-500/10",    limit: "Unlimited",        icon: Building2 },
  mro_verified:{ label: "Verified MRO",color: "text-blue-400",         bg: "bg-blue-500/10",     limit: "5 listings, 10 service types", icon: ShieldCheck },
  mro_premium: { label: "Premium MRO", color: "text-purple-400",       bg: "bg-purple-500/10",   limit: "20 listings, unlimited services", icon: Star },
};

const STATUS_BADGE: Record<string, { label: string; class: string }> = {
  active:    { label: "Active",    class: "bg-green-500/10 text-green-400 border-green-500/20" },
  trial:     { label: "Trial",     class: "bg-blue-500/10 text-blue-400 border-blue-500/20" },
  past_due:  { label: "Past Due",  class: "bg-amber-500/10 text-amber-400 border-amber-500/20" },
  cancelled: { label: "Cancelled", class: "bg-red-500/10 text-red-400 border-red-500/20" },
  suspended: { label: "Suspended", class: "bg-red-500/10 text-red-400 border-red-500/20" },
};

export default function SubscriptionManagement() {
  const { user, isLoading: authLoading } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [portalLoading, setPortalLoading] = useState(false);

  const portalMutation = useCreatePortalSession();
  const cancelMutation = useCancelSubscription();

  const { data: subscription, isLoading } = useGetSubscription({
    query: { enabled: !!user, queryKey: getGetSubscriptionQueryKey() },
  });

  const handleManageBilling = async () => {
    setPortalLoading(true);
    portalMutation.mutate(undefined, {
      onSuccess: (data: any) => {
        if (data?.url) {
          window.location.href = data.url;
        }
      },
      onError: (err: any) => {
        toast({
          title: "Could not open billing portal",
          description: err?.response?.data?.error ?? "Please try again.",
          variant: "destructive",
        });
        setPortalLoading(false);
      },
    });
  };

  const handleCancel = () => {
    if (!confirm("Cancel your subscription? You'll keep access until the end of the current billing period.")) return;
    cancelMutation.mutate(undefined, {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: getGetSubscriptionQueryKey() });
        toast({ title: "Subscription cancelled", description: "Access continues until the end of this billing period." });
      },
      onError: (err: any) => {
        toast({ title: "Cancellation failed", description: err?.response?.data?.error ?? "Please try again.", variant: "destructive" });
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

  const effectivePlan = (subscription as any)?.effectivePlan ?? subscription?.plan ?? "free";
  const storedPlan = subscription?.plan ?? "free";
  const meta = PLAN_META[effectivePlan] ?? PLAN_META.free;
  const Icon = meta.icon;
  const status = (subscription as any)?.subscriptionStatus as string | undefined;
  const statusBadge = status ? STATUS_BADGE[status] : null;
  const gracePeriodEnd = (subscription as any)?.gracePeriodEnd as string | undefined;
  const currentPeriodEnd = (subscription as any)?.currentPeriodEnd as string | undefined;
  const daysUntilGrace = (subscription as any)?.daysUntilGraceExpires as number | undefined;
  const isPastDue = status === "past_due";
  const hasActiveSub = status === "active" || status === "trial" || isPastDue;
  const isPlanDowngraded = effectivePlan !== storedPlan; // grace period expired or cancelled

  const usedPct = subscription?.listingLimit
    ? Math.min(100, Math.round(((subscription.activeListings ?? 0) / subscription.listingLimit) * 100))
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

        {/* Past-due grace period warning */}
        {isPastDue && (
          <div className="mb-5 flex items-start gap-3 bg-amber-500/10 border border-amber-500/30 rounded-md p-4">
            <AlertTriangle className="h-5 w-5 text-amber-400 flex-shrink-0 mt-0.5" />
            <div>
              <p className="text-amber-300 font-medium text-sm">Payment failed — action required</p>
              <p className="text-amber-200/70 text-xs mt-0.5">
                {daysUntilGrace != null && daysUntilGrace > 0
                  ? `Your plan access continues for ${daysUntilGrace} more day${daysUntilGrace === 1 ? "" : "s"} while we retry payment.`
                  : "Your grace period has expired. Update your billing details to restore access."}
              </p>
              <Button size="sm" className="mt-2 h-7 text-xs bg-amber-500 hover:bg-amber-400 text-black" onClick={handleManageBilling} disabled={portalLoading}>
                <CreditCard className="h-3 w-3 mr-1" /> Update Payment Method
              </Button>
            </div>
          </div>
        )}

        {/* Downgraded notice */}
        {isPlanDowngraded && !isPastDue && (
          <div className="mb-5 flex items-start gap-3 bg-red-500/10 border border-red-500/30 rounded-md p-4">
            <XCircle className="h-5 w-5 text-red-400 flex-shrink-0 mt-0.5" />
            <div>
              <p className="text-red-300 font-medium text-sm">Subscription lapsed — now on Free plan</p>
              <p className="text-red-200/70 text-xs mt-0.5">
                Your {PLAN_META[storedPlan]?.label ?? storedPlan} subscription has ended. Resubscribe to restore access.
              </p>
              <Link href="/pricing">
                <Button size="sm" className="mt-2 h-7 text-xs">Resubscribe</Button>
              </Link>
            </div>
          </div>
        )}

        {/* Current Plan Card */}
        <div className="bg-card border border-border rounded-md p-6 mb-5">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">Current Plan</h2>
            {statusBadge && (
              <span className={`text-xs font-medium px-2.5 py-0.5 rounded-full border ${statusBadge.class}`}>
                {statusBadge.label}
              </span>
            )}
          </div>

          {isLoading ? (
            <Skeleton className="h-16 w-full" />
          ) : (
            <div className="flex items-center gap-4">
              <div className={`h-12 w-12 rounded-md flex items-center justify-center ${meta.bg}`}>
                <Icon className={`h-6 w-6 ${meta.color}`} />
              </div>
              <div>
                <p className={`text-2xl font-bold ${meta.color}`}>{meta.label}</p>
                <p className="text-sm text-muted-foreground">{meta.limit}</p>
              </div>
            </div>
          )}

          {/* Billing dates */}
          {!isLoading && (currentPeriodEnd || gracePeriodEnd) && (
            <div className="mt-4 pt-4 border-t border-border space-y-2">
              {currentPeriodEnd && (
                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                  <Clock className="h-3.5 w-3.5" />
                  <span>
                    {status === "cancelled"
                      ? `Access ends: ${new Date(currentPeriodEnd).toLocaleDateString()}`
                      : `Next billing: ${new Date(currentPeriodEnd).toLocaleDateString()}`}
                  </span>
                </div>
              )}
              {gracePeriodEnd && isPastDue && daysUntilGrace != null && daysUntilGrace > 0 && (
                <div className="flex items-center gap-2 text-xs text-amber-400">
                  <AlertTriangle className="h-3.5 w-3.5" />
                  <span>Grace period ends: {new Date(gracePeriodEnd).toLocaleDateString()}</span>
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
                      {usedPct >= 100
                        ? "Limit reached — upgrade to add more listings."
                        : `${usedPct}% used — consider upgrading soon.`}
                    </div>
                  )}
                </>
              )}
            </>
          )}
        </div>

        {/* Billing Actions */}
        <div className="bg-card border border-border rounded-md p-6 mb-5 space-y-3">
          <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider mb-4">Billing</h2>

          {hasActiveSub ? (
            <>
              <Button
                className="w-full gap-2"
                onClick={handleManageBilling}
                disabled={portalLoading}
              >
                <ExternalLink className="h-4 w-4" />
                {portalLoading ? "Opening portal…" : "Manage Billing & Payment"}
              </Button>
              <p className="text-xs text-muted-foreground text-center">
                Update payment method, download invoices, or change your plan via the Stripe billing portal.
              </p>

              {(status === "active" || status === "trial") && (
                <Button
                  variant="ghost"
                  className="w-full text-muted-foreground hover:text-destructive text-xs h-8 mt-1"
                  onClick={handleCancel}
                  disabled={cancelMutation.isPending}
                >
                  <XCircle className="h-3.5 w-3.5 mr-1" />
                  {cancelMutation.isPending ? "Cancelling…" : "Cancel Subscription"}
                </Button>
              )}
            </>
          ) : (
            <div className="text-center">
              <p className="text-sm text-muted-foreground mb-3">
                {effectivePlan === "free" ? "Upgrade to unlock more listings, priority placement, and full RFQ access." : "No active subscription."}
              </p>
              <Link href="/pricing">
                <Button className="w-full gap-2">
                  <Zap className="h-4 w-4" /> View Plans & Upgrade
                </Button>
              </Link>
            </div>
          )}
        </div>

        {/* Quick plan compare */}
        {effectivePlan === "free" && (
          <div className="bg-card border border-border rounded-md p-6">
            <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider mb-4">Upgrade to unlock</h2>
            <div className="grid grid-cols-2 gap-3 text-sm">
              {[
                { icon: Zap, label: "Pro — $149/mo", detail: "50 listings, analytics, priority placement" },
                { icon: Building2, label: "Enterprise — $299/mo", detail: "Unlimited listings, full RFQ access" },
                { icon: ShieldCheck, label: "Verified MRO — $49/mo", detail: "MRO directory, 10 service types" },
                { icon: Star, label: "Premium MRO — $149/mo", detail: "Featured listing, unlimited services" },
              ].map(({ icon: I, label, detail }) => (
                <div key={label} className="border border-border rounded-md p-3">
                  <I className="h-4 w-4 text-primary mb-1.5" />
                  <p className="text-white text-xs font-medium">{label}</p>
                  <p className="text-muted-foreground text-xs mt-0.5">{detail}</p>
                </div>
              ))}
            </div>
            <Link href="/pricing">
              <Button className="w-full mt-4" variant="outline">Compare All Plans</Button>
            </Link>
          </div>
        )}
      </div>
    </MainLayout>
  );
}
