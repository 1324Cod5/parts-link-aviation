import { Link } from "wouter";
import { MainLayout } from "@/components/layout/MainLayout";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { useAuth } from "@/context/AuthContext";
import {
  useGetSubscription,
  getGetSubscriptionQueryKey,
} from "@workspace/api-client-react";
import { useQueryClient, useQuery, useMutation } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import {
  ArrowLeft, Zap, Building2, Package, AlertTriangle,
  ShieldCheck, Star, Clock,
} from "lucide-react";

const PLAN_META: Record<string, { label: string; color: string; bg: string; limit: string; icon: React.ElementType }> = {
  free:        { label: "Free",        color: "text-muted-foreground", bg: "bg-secondary/50",   limit: "5 listings",       icon: Package },
  pro:         { label: "Pro",         color: "text-primary",          bg: "bg-primary/10",      limit: "50 listings",      icon: Zap },
  enterprise:  { label: "Enterprise",  color: "text-amber-400",        bg: "bg-amber-500/10",    limit: "Unlimited",        icon: Building2 },
  mro_verified:{ label: "Verified MRO",color: "text-blue-400",         bg: "bg-blue-500/10",     limit: "5 listings, 10 service types", icon: ShieldCheck },
  mro_premium: { label: "Premium MRO", color: "text-purple-400",       bg: "bg-purple-500/10",   limit: "20 listings, unlimited services", icon: Star },
};

export default function SubscriptionManagement() {
  const { user, isLoading: authLoading } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: subscription, isLoading } = useGetSubscription({
    query: { enabled: !!user, queryKey: getGetSubscriptionQueryKey() },
  });

  const NOTIF_KEY = ["seller-msg-notif-prefs"] as const;
  const { data: notifData, isLoading: notifLoading } = useQuery({
    queryKey: NOTIF_KEY,
    queryFn: async () => {
      const res = await fetch("/api/seller/notifications/message-alerts", { credentials: "include" });
      if (!res.ok) return { emailOnMessage: true };
      return res.json() as Promise<{ emailOnMessage: boolean }>;
    },
    enabled: !!user,
  });
  const emailOnMessage = notifData?.emailOnMessage ?? true;

  const notifMutation = useMutation({
    mutationFn: async (value: boolean) => {
      const res = await fetch("/api/seller/notifications/message-alerts", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ emailOnMessage: value }),
      });
      if (!res.ok) throw new Error("Failed to update");
      return res.json();
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: NOTIF_KEY });
      toast({ title: "Notification preference saved" });
    },
    onError: () => toast({ title: "Failed to save preference", variant: "destructive" }),
  });

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
  const meta = PLAN_META[effectivePlan] ?? PLAN_META.free;
  const Icon = meta.icon;
  const status = (subscription as any)?.subscriptionStatus as string | undefined;
  const currentPeriodEnd = (subscription as any)?.currentPeriodEnd as string | undefined;

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

        <h1 className="text-2xl font-bold text-white mb-6">Plan & Usage</h1>

        {/* Current Plan Card */}
        <div className="bg-card border border-border rounded-md p-6 mb-5">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">Current Plan</h2>
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

          {!isLoading && currentPeriodEnd && (
            <div className="mt-4 pt-4 border-t border-border">
              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                <Clock className="h-3.5 w-3.5" />
                <span>
                  {status === "cancelled"
                    ? `Access ends: ${new Date(currentPeriodEnd).toLocaleDateString()}`
                    : `Active until: ${new Date(currentPeriodEnd).toLocaleDateString()}`}
                </span>
              </div>
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

        {/* Upgrade prompt for free plan */}
        {effectivePlan === "free" && (
          <div className="bg-card border border-border rounded-md p-6 mb-5">
            <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider mb-4">Upgrade your plan</h2>
            <p className="text-sm text-muted-foreground mb-4">
              Unlock more listings, priority placement, and full RFQ access. Contact us to get started.
            </p>
            <div className="grid grid-cols-2 gap-3 text-sm mb-4">
              {[
                { icon: Zap, label: "Pro — $149/mo", detail: "Unlimited searches, full listing access" },
                { icon: Building2, label: "Fleet Manager — $349/mo", detail: "Watchlist alerts, API access, priority support" },
                { icon: ShieldCheck, label: "MRO Provider — $10/mo", detail: "MRO directory, verified badge, unlimited services" },
              ].map(({ icon: I, label, detail }) => (
                <div key={label} className="border border-border rounded-md p-3">
                  <I className="h-4 w-4 text-primary mb-1.5" />
                  <p className="text-white text-xs font-medium">{label}</p>
                  <p className="text-muted-foreground text-xs mt-0.5">{detail}</p>
                </div>
              ))}
            </div>
            <a href="mailto:admin@partslinkaviation.com">
              <Button className="w-full gap-2">
                <Zap className="h-4 w-4" /> Contact Sales to Upgrade
              </Button>
            </a>
          </div>
        )}

        {/* Notification Settings */}
        <div className="bg-card border border-border rounded-md p-6 mb-5">
          <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider mb-4">
            Notification Settings
          </h2>
          {notifLoading ? (
            <Skeleton className="h-10 w-full" />
          ) : (
            <div className="flex items-center justify-between gap-4">
              <div>
                <p className="text-white text-sm font-medium">Email on new message</p>
                <p className="text-muted-foreground text-xs mt-0.5">
                  Receive an email alert when a buyer sends you a message
                </p>
              </div>
              <button
                onClick={() => notifMutation.mutate(!emailOnMessage)}
                disabled={notifMutation.isPending}
                aria-label={emailOnMessage ? "Disable email on message" : "Enable email on message"}
                className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2 focus:ring-offset-background ${
                  emailOnMessage ? "bg-primary" : "bg-secondary border border-border"
                }`}
              >
                <span className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                  emailOnMessage ? "translate-x-6" : "translate-x-1"
                }`} />
              </button>
            </div>
          )}
        </div>
      </div>
    </MainLayout>
  );
}
