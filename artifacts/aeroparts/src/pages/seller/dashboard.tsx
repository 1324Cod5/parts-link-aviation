import { useState } from "react";
import { Link, useLocation } from "wouter";
import { MainLayout } from "@/components/layout/MainLayout";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Textarea } from "@/components/ui/textarea";
import { BadgeIndicator } from "@/components/ui/badge-indicator";
import {
  useGetSellerListings, getGetSellerListingsQueryKey,
  useGetSellerStats, getGetSellerStatsQueryKey,
  useGetSellerRfqStats,
  useGetMyMroProfile, getGetMyMroProfileQueryKey,
  useDeleteListing,
  useGetAogActiveRfqs, getGetAogActiveRfqsQueryKey,
  useGetConversations, getGetConversationsQueryKey,
  useGetConversationMessages, getGetConversationMessagesQueryKey,
  useSendMessage,
  getGetConversationsUnreadCountQueryKey,
  useGetSubscription, getGetSubscriptionQueryKey,
} from "@workspace/api-client-react";
import { useAuth } from "@/context/AuthContext";
import { useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import { Plus, Edit2, Trash2, Package, FileCheck2, MessageSquare, ShieldCheck, Zap, Building2, AlertTriangle, ClipboardList, Wrench, Shield, FileSpreadsheet, Lock, Radio, ArrowRight, Clock } from "lucide-react";
import { TrustBadge, TrustScoreBar, TRUST_BADGE_META } from "@/components/ui/trust-badge";

// ─── Conversation Thread Sub-Component ────────────────────────────────────────

function ConversationThread({ id, onReplied }: { id: number; onReplied?: () => void }) {
  const [reply, setReply] = useState("");
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data, isLoading, refetch } = useGetConversationMessages(id, {
    query: { queryKey: getGetConversationMessagesQueryKey(id) },
  });

  const sendMutation = useSendMessage();

  const handleReply = () => {
    if (!reply.trim()) return;
    sendMutation.mutate(
      { id, data: { content: reply } },
      {
        onSuccess: () => {
          setReply("");
          void refetch();
          void queryClient.invalidateQueries({ queryKey: getGetConversationsUnreadCountQueryKey() });
          onReplied?.();
        },
        onError: () => toast({ title: "Failed to send reply", variant: "destructive" }),
      },
    );
  };

  if (isLoading) {
    return (
      <div className="p-4 bg-secondary/10 border-t border-border/30">
        <Skeleton className="h-24 w-full" />
      </div>
    );
  }

  return (
    <div className="bg-secondary/10 border-t border-border/30">
      {/* Messages */}
      <div className="max-h-72 overflow-y-auto p-4 space-y-3">
        {data?.messages.length === 0 && (
          <p className="text-xs text-muted-foreground text-center">No messages yet.</p>
        )}
        {data?.messages.map(msg => (
          <div key={msg.id} className={`flex ${msg.senderType === "seller" ? "justify-end" : "justify-start"}`}>
            <div className={`max-w-[80%] rounded p-2.5 text-sm ${
              msg.senderType === "seller"
                ? "bg-primary/20 border border-primary/30"
                : "bg-card border border-border"
            }`}>
              <p className="text-[10px] text-muted-foreground mb-1">
                {msg.senderType === "buyer" ? "Buyer" : "You"} · {new Date(msg.createdAt).toLocaleDateString()}
              </p>
              <p className="text-white/90 leading-relaxed whitespace-pre-wrap">{msg.content}</p>
            </div>
          </div>
        ))}
      </div>

      {/* Reply box */}
      <div className="px-4 pb-4 flex gap-2 border-t border-border/20 pt-3">
        <Textarea
          value={reply}
          onChange={e => setReply(e.target.value)}
          placeholder="Write your reply…"
          rows={2}
          className="text-sm resize-none flex-1"
          onKeyDown={e => { if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) handleReply(); }}
        />
        <Button
          onClick={handleReply}
          disabled={!reply.trim() || sendMutation.isPending}
          size="sm"
          className="self-end h-9 px-4"
        >
          {sendMutation.isPending ? "Sending…" : "Send"}
        </Button>
      </div>
    </div>
  );
}

function formatPrice(price: number | null) {
  if (price == null) return "POA";
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 }).format(price);
}

function formatElapsed(isoDate: string): string {
  const ms = Date.now() - new Date(isoDate).getTime();
  const min = Math.floor(ms / 60_000);
  if (min < 1) return "just now";
  if (min < 60) return `${min}m elapsed`;
  const h = Math.floor(min / 60);
  return `${h}h ${min % 60}m elapsed`;
}

const PHASE_META: Record<string, { label: string; className: string }> = {
  immediate: { label: "PRIORITY WINDOW",  className: "bg-emerald-500/20 text-emerald-400 border-emerald-500/40" },
  expanded:  { label: "10 MIN — EXPANDED", className: "bg-amber-500/20  text-amber-400  border-amber-500/40"  },
  full:      { label: "20 MIN — FULL",     className: "bg-red-500/20    text-red-400    border-red-500/40"    },
  critical:  { label: "30 MIN — CRITICAL", className: "bg-red-800/30    text-red-300    border-red-600/60 animate-pulse" },
};

function formatCondition(c: string) {
  return c.split("_").map(w => w[0].toUpperCase() + w.slice(1)).join(" ");
}

const PLAN_META = {
  free:       { label: "Free",       icon: Package,   color: "text-muted-foreground", bg: "bg-secondary/50"  },
  pro:        { label: "Pro",        icon: Zap,        color: "text-primary",          bg: "bg-primary/10"    },
  enterprise: { label: "Enterprise", icon: Building2,  color: "text-amber-400",        bg: "bg-amber-500/10"  },
};

export default function SellerDashboard() {
  const { user, isLoading: authLoading } = useAuth();
  const [, navigate] = useLocation();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: listings, isLoading: listingsLoading } = useGetSellerListings({
    query: { queryKey: getGetSellerListingsQueryKey() },
  });
  const { data: stats, isLoading: statsLoading } = useGetSellerStats({
    query: { queryKey: getGetSellerStatsQueryKey() },
  });
  const { data: rfqStats } = useGetSellerRfqStats();
  const { data: mroProfile, isLoading: mroLoading } = useGetMyMroProfile({
    query: { retry: false, queryKey: getGetMyMroProfileQueryKey() },
  });

  const deleteMutation = useDeleteListing();

  // AOG alerts — poll every 60 s so sellers see new alerts quickly
  const { data: aogData } = useGetAogActiveRfqs({
    query: { queryKey: getGetAogActiveRfqsQueryKey(), refetchInterval: 60_000, retry: false },
  });
  const aogRfqs = aogData?.rfqs ?? [];

  // Conversations — poll every 60 s for new messages
  const { data: convsData, isLoading: convsLoading } = useGetConversations({
    query: { queryKey: getGetConversationsQueryKey(), refetchInterval: 60_000, retry: false },
  });
  const convs = convsData?.conversations ?? [];
  const totalUnread = convs.reduce((s, c) => s + (c.unreadCount ?? 0), 0);
  const [openConvId, setOpenConvId] = useState<number | null>(null);

  // Subscription status — must be called before any conditional returns (rules of hooks)
  const { data: subscription } = useGetSubscription({ query: { queryKey: getGetSubscriptionQueryKey(), retry: false } });

  const handleDelete = (id: number, partNumber: string) => {
    if (!confirm(`Delete listing ${partNumber}? This cannot be undone.`)) return;
    deleteMutation.mutate({ id }, {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: getGetSellerListingsQueryKey() });
        queryClient.invalidateQueries({ queryKey: getGetSellerStatsQueryKey() });
        toast({ title: "Listing deleted", description: `${partNumber} has been removed.` });
      },
    });
  };

  // Wait until the auth check has fully resolved before deciding whether to
  // show the dashboard or the "sign in" gate.  This prevents the brief flash
  // where user===null while the /auth/me request is still in-flight.
  if (authLoading) {
    return (
      <MainLayout>
        <div className="container mx-auto px-4 py-24 text-center text-muted-foreground">
          <div className="inline-block w-6 h-6 border-2 border-primary border-t-transparent rounded-full animate-spin mb-3" />
          <p className="text-sm">Verifying session…</p>
        </div>
      </MainLayout>
    );
  }

  if (!user) {
    return (
      <MainLayout>
        <div className="container mx-auto px-4 py-16 text-center">
          <p className="text-muted-foreground mb-4">You must be signed in to access the seller dashboard.</p>
          <Link href="/seller/login"><Button>Sign In</Button></Link>
        </div>
      </MainLayout>
    );
  }

  const subscriptionStatus = (subscription as any)?.subscriptionStatus as string | undefined;

  const plan = (stats?.plan ?? user.plan ?? "free") as keyof typeof PLAN_META;
  const planMeta = PLAN_META[plan] ?? PLAN_META.free;
  const PlanIcon = planMeta.icon;
  const canAdd = stats?.canAddListing ?? true;
  const canBulkUpload = plan === "pro" || plan === "enterprise";
  const usedPct = stats && stats.listingLimit
    ? Math.min(100, Math.round((stats.activeListings / stats.listingLimit) * 100))
    : 0;

  return (
    <MainLayout>
      <div className="container mx-auto px-4 py-8">
        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-2xl font-bold text-white">Seller Dashboard</h1>
            <p className="text-muted-foreground text-sm mt-1">{user.companyName}</p>
          </div>
          <div className="flex items-center gap-2">
            <Link href="/seller/bulk-upload">
              {canBulkUpload ? (
                <Button variant="outline" className="flex items-center gap-2 border-border text-white/80 hover:text-white">
                  <FileSpreadsheet className="h-4 w-4" /> Bulk Upload
                </Button>
              ) : (
                <Button variant="outline" className="flex items-center gap-2 border-border text-muted-foreground/60 hover:text-amber-400 hover:border-amber-500/40" title="Upgrade to Pro or Enterprise to use bulk upload">
                  <Lock className="h-4 w-4" /> Bulk Upload
                </Button>
              )}
            </Link>
            {canAdd ? (
              <Link href="/seller/listings/new">
                <Button className="flex items-center gap-2">
                  <Plus className="h-4 w-4" /> New Listing
                </Button>
              </Link>
            ) : (
              <Link href="/pricing">
                <Button className="flex items-center gap-2 bg-amber-500/10 text-amber-400 border border-amber-500/30 hover:bg-amber-500/20">
                  <Zap className="h-4 w-4" /> Upgrade Plan
                </Button>
              </Link>
            )}
          </div>
        </div>

        {/* ─── Subscription Status Banner ───────────────────────────────── */}
        {subscriptionStatus && subscriptionStatus !== "active" && subscriptionStatus !== "trial" && subscriptionStatus !== "none" && (
          <div className={`mb-6 rounded-md border p-4 flex items-start gap-3 ${
            subscriptionStatus === "past_due"
              ? "border-amber-500/40 bg-amber-500/10"
              : "border-red-500/40 bg-red-500/10"
          }`}>
            <AlertTriangle className={`h-5 w-5 flex-shrink-0 mt-0.5 ${subscriptionStatus === "past_due" ? "text-amber-400" : "text-red-400"}`} />
            <div className="flex-1 min-w-0">
              {subscriptionStatus === "past_due" ? (
                <>
                  <p className="text-sm font-semibold text-amber-400">Payment Past Due</p>
                  <p className="text-xs text-amber-400/80 mt-0.5">
                    Your subscription renewal failed. Update your payment method within 7 days to keep all features active.
                  </p>
                </>
              ) : (
                <>
                  <p className="text-sm font-semibold text-red-400">Subscription {subscriptionStatus === "cancelled" ? "Cancelled" : "Suspended"}</p>
                  <p className="text-xs text-red-400/80 mt-0.5">
                    Your subscription is no longer active. Premium features (RFQ responses, bulk upload, email alerts) are locked.
                  </p>
                </>
              )}
            </div>
            <Link href="/seller/subscription">
              <Button size="sm" variant="outline" className={`flex-shrink-0 text-xs border h-8 ${
                subscriptionStatus === "past_due"
                  ? "border-amber-500/50 text-amber-400 hover:bg-amber-500/20"
                  : "border-red-500/50 text-red-400 hover:bg-red-500/20"
              }`}>
                Manage
              </Button>
            </Link>
          </div>
        )}

        {/* ─── AOG Alerts Panel ─────────────────────────────────────────── */}
        {aogRfqs.length > 0 && (
          <div className="mb-6 rounded-md border border-red-600/60 bg-red-950/40 overflow-hidden">
            {/* Panel header */}
            <div className="flex items-center gap-3 px-4 py-3 bg-red-900/40 border-b border-red-600/40">
              <span className="relative flex h-3 w-3">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-500 opacity-75" />
                <span className="relative inline-flex rounded-full h-3 w-3 bg-red-500" />
              </span>
              <Radio className="h-4 w-4 text-red-400" />
              <span className="text-sm font-bold text-red-300 uppercase tracking-wider">
                AOG Alerts — {aogRfqs.length} Active
              </span>
              <span className="ml-auto text-xs text-red-500/70">Live · updates every 60s</span>
            </div>

            {/* Alert rows */}
            <div className="divide-y divide-red-900/40">
              {aogRfqs.map(rfq => {
                const pm = rfq.escalation
                  ? PHASE_META[rfq.escalation.phase] ?? PHASE_META.immediate
                  : null;
                return (
                  <div key={rfq.id} className="flex items-start gap-4 px-4 py-4 hover:bg-red-900/20 transition-colors">
                    {/* Left: alert icon */}
                    <div className="mt-0.5 flex-shrink-0 h-8 w-8 rounded-md bg-red-700/30 flex items-center justify-center">
                      <span className="text-base">🔴</span>
                    </div>

                    {/* Center: details */}
                    <div className="flex-1 min-w-0">
                      <div className="flex flex-wrap items-center gap-2 mb-1">
                        <span className="font-mono text-sm font-bold text-red-200">{rfq.partNumber}</span>
                        {rfq.aircraftApplicability && (
                          <span className="text-xs text-red-400/70">{rfq.aircraftApplicability}</span>
                        )}
                        {pm && (
                          <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded border ${pm.className}`}>
                            {pm.label}
                          </span>
                        )}
                      </div>
                      <p className="text-xs text-red-200/60 truncate">{rfq.description}</p>
                      {rfq.urgencyReason && (
                        <p className="text-xs text-red-400/80 mt-0.5 italic">"{rfq.urgencyReason}"</p>
                      )}
                      <div className="flex items-center gap-1 mt-1.5 text-[10px] text-red-500/60">
                        <Clock className="h-3 w-3" />
                        <span>{formatElapsed(rfq.createdAt)}</span>
                        {rfq.buyerCompany && <span className="ml-2">· {rfq.buyerCompany}</span>}
                        <span className="ml-2">· Qty: {rfq.quantity}</span>
                      </div>
                    </div>

                    {/* Right: CTA */}
                    <Link href={`/rfqs/${rfq.id}`} className="flex-shrink-0">
                      <Button
                        size="sm"
                        className="h-8 px-3 text-xs bg-red-600 hover:bg-red-500 text-white border-0 flex items-center gap-1.5"
                      >
                        Respond Now <ArrowRight className="h-3 w-3" />
                      </Button>
                    </Link>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Limit warning banner */}
        {!statsLoading && stats && !canAdd && (
          <div className="mb-6 flex items-center gap-3 p-4 bg-amber-500/10 border border-amber-500/30 rounded-md">
            <AlertTriangle className="h-5 w-5 text-amber-400 flex-shrink-0" />
            <div className="flex-1">
              <p className="text-amber-300 font-medium text-sm">Listing limit reached</p>
              <p className="text-amber-400/80 text-xs mt-0.5">
                You've used all {stats.listingLimit} listings on your {plan} plan.
                Upgrade to add more inventory.
              </p>
            </div>
            <Link href="/pricing">
              <Button size="sm" className="bg-amber-500 text-black hover:bg-amber-400 text-xs h-8">
                View Plans
              </Button>
            </Link>
          </div>
        )}

        {/* Stats */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
          {[
            { icon: Package, label: "Total Listings", value: stats?.totalListings, loading: statsLoading },
            { icon: FileCheck2, label: "Active", value: stats?.activeListings, loading: statsLoading },
            { icon: ShieldCheck, label: "Verified", value: stats?.verifiedListings, loading: statsLoading },
            { icon: MessageSquare, label: "Inquiries", value: stats?.totalInquiries, loading: statsLoading },
          ].map(({ icon: Icon, label, value, loading }) => (
            <div key={label} className="bg-card border border-border rounded-md p-5">
              <div className="flex items-center gap-2 text-muted-foreground mb-3">
                <Icon className="h-4 w-4" />
                <span className="text-xs uppercase tracking-wider">{label}</span>
              </div>
              {loading ? (
                <Skeleton className="h-8 w-12" />
              ) : (
                <p className="text-3xl font-bold text-white font-mono">{value ?? 0}</p>
              )}
            </div>
          ))}
        </div>

        {/* Plan Card */}
        <div className="bg-card border border-border rounded-md p-5 mb-6 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className={`h-9 w-9 rounded-md flex items-center justify-center ${planMeta.bg}`}>
              <PlanIcon className={`h-4 w-4 ${planMeta.color}`} />
            </div>
            <div>
              <p className="text-xs text-muted-foreground uppercase tracking-wider">Current Plan</p>
              <p className={`font-bold text-lg ${planMeta.color}`}>{planMeta.label}</p>
            </div>
          </div>

          {/* Usage bar */}
          {!statsLoading && stats?.listingLimit != null && (
            <div className="flex-1 max-w-xs hidden md:block">
              <div className="flex justify-between text-xs text-muted-foreground mb-1.5">
                <span>{stats.activeListings} active</span>
                <span>of {stats.listingLimit}</span>
              </div>
              <div className="h-1.5 bg-secondary rounded-full overflow-hidden">
                <div
                  className={`h-full rounded-full transition-all ${usedPct >= 90 ? "bg-red-500" : usedPct >= 70 ? "bg-amber-500" : "bg-primary"}`}
                  style={{ width: `${usedPct}%` }}
                />
              </div>
            </div>
          )}
          {!statsLoading && stats?.listingLimit == null && (
            <p className="text-xs text-muted-foreground hidden md:block">Unlimited listings</p>
          )}

          <div className="flex gap-2">
            <Link href="/seller/subscription">
              <Button variant="outline" size="sm" className="text-xs h-8">Manage</Button>
            </Link>
            {plan === "free" && (
              <Link href="/pricing">
                <Button size="sm" className="text-xs h-8 flex items-center gap-1">
                  <Zap className="h-3 w-3" /> Upgrade
                </Button>
              </Link>
            )}
          </div>
        </div>

        {/* RFQ Opportunity Card */}
        <div className="bg-card border border-border rounded-md p-5 mb-6 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="h-9 w-9 rounded-md flex items-center justify-center bg-primary/10">
              <ClipboardList className="h-4 w-4 text-primary" />
            </div>
            <div>
              <p className="text-xs text-muted-foreground uppercase tracking-wider">RFQ Board</p>
              <p className="font-bold text-lg text-white">
                {rfqStats ? rfqStats.openRfqs : "—"}
                <span className="text-sm font-normal text-muted-foreground ml-1.5">open requests</span>
              </p>
            </div>
          </div>
          <div className="hidden md:flex items-center gap-4 text-sm text-muted-foreground">
            <span>
              <span className="text-white font-medium">{rfqStats?.myResponses ?? 0}</span> my responses
            </span>
          </div>
          <Link href="/rfqs">
            <Button variant="outline" size="sm" className="text-xs h-8 gap-1.5 border-border text-muted-foreground hover:text-white">
              <ClipboardList className="h-3.5 w-3.5" />
              Browse RFQs
            </Button>
          </Link>
        </div>

        {/* Trust Score Card */}
        {user.trustScore != null && (
          <div className="bg-card border border-border rounded-md p-5 mb-6">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <Shield className="h-4 w-4 text-primary" />
                <h2 className="font-semibold text-white text-sm">Trust Score</h2>
              </div>
              <div className="flex items-center gap-2">
                <span className="font-mono text-2xl font-bold text-white">{user.trustScore}</span>
                <span className="text-muted-foreground text-sm">/100</span>
                <TrustBadge badge={user.trustBadge} size="md" />
              </div>
            </div>

            <TrustScoreBar score={user.trustScore} />

            {/* Next tier hint */}
            {(() => {
              const score = user.trustScore ?? 0;
              const next =
                score < 40 ? { label: "Doc Verified", at: 40 } :
                score < 70 ? { label: "Aviation Verified", at: 70 } :
                score < 90 ? { label: "Trusted Partner", at: 90 } : null;
              return next ? (
                <p className="text-xs text-muted-foreground mt-2">
                  {next.at - score} more points to reach <span className="text-white">{next.label}</span>
                </p>
              ) : null;
            })()}

            {/* Score breakdown */}
            {user.trustScoreBreakdown && (
              <div className="mt-4 pt-4 border-t border-border grid grid-cols-2 md:grid-cols-3 gap-3">
                {([
                  { key: "certDocScore",         label: "Cert Docs",       max: 30 },
                  { key: "listingAccuracyScore",  label: "Listing Detail",  max: 20 },
                  { key: "transactionScore",      label: "Transactions",    max: 15 },
                  { key: "responseTimeScore",     label: "Responsiveness",  max: 10 },
                  { key: "subscriptionBoost",     label: "Plan Boost",      max: 10 },
                  { key: "disputePenalty",        label: "Disputes",        max: 0  },
                ] as const).map(({ key, label, max }) => {
                  const val = (user.trustScoreBreakdown as any)?.[key] ?? 0;
                  const pct = max > 0 ? Math.round((val / max) * 100) : 0;
                  const isNegative = val < 0;
                  return (
                    <div key={key} className="bg-secondary/30 rounded p-2.5">
                      <p className="text-xs text-muted-foreground mb-1.5">{label}</p>
                      <div className="flex items-end justify-between gap-1 mb-1.5">
                        <span className={`font-mono text-sm font-bold ${isNegative ? "text-red-400" : "text-white"}`}>
                          {isNegative ? val : `+${val}`}
                        </span>
                        {max > 0 && <span className="text-xs text-muted-foreground">/ {max}</span>}
                      </div>
                      {max > 0 && (
                        <div className="h-1 bg-secondary rounded-full overflow-hidden">
                          <div
                            className="h-full rounded-full bg-primary/70 transition-all"
                            style={{ width: `${pct}%` }}
                          />
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {/* MRO Services Card */}
        <div className="bg-card border border-border rounded-md p-5 mb-6 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="h-9 w-9 rounded-md flex items-center justify-center bg-primary/10">
              <Wrench className="h-4 w-4 text-primary" />
            </div>
            <div>
              <p className="text-xs text-muted-foreground uppercase tracking-wider">MRO Services</p>
              <p className="font-bold text-lg text-white">
                {mroLoading ? "—" : mroProfile ? mroProfile.companyName : "Not listed"}
                {mroProfile && (
                  <span className={`ml-2 text-xs font-normal px-1.5 py-0.5 rounded ${mroProfile.status === "active" ? "text-emerald-400 bg-emerald-500/10" : "text-amber-400 bg-amber-500/10"}`}>
                    {mroProfile.status}
                  </span>
                )}
              </p>
            </div>
          </div>
          {mroProfile ? (
            <div className="flex gap-2">
              <Link href={`/mro/${mroProfile.id}`}>
                <Button variant="outline" size="sm" className="text-xs h-8 gap-1.5 border-border text-muted-foreground hover:text-white">
                  View Profile
                </Button>
              </Link>
              <Link href="/mro/register">
                <Button variant="outline" size="sm" className="text-xs h-8 gap-1.5 border-border text-muted-foreground hover:text-white">
                  Edit
                </Button>
              </Link>
            </div>
          ) : (
            <Link href="/mro/register">
              <Button size="sm" className="text-xs h-8 gap-1.5">
                <Wrench className="h-3.5 w-3.5" />
                List MRO Services
              </Button>
            </Link>
          )}
        </div>

        {/* ─── Messages / Conversations Panel ─────────────────────────── */}
        <div className="bg-card border border-border rounded-md mb-6">
          <div className="p-5 border-b border-border flex items-center justify-between">
            <div className="flex items-center gap-2">
              <MessageSquare className="h-4 w-4 text-muted-foreground" />
              <h2 className="font-semibold text-white">Messages</h2>
              {totalUnread > 0 && (
                <span className="h-5 min-w-[1.25rem] flex items-center justify-center rounded-full bg-blue-500 text-[10px] font-bold text-white px-1">
                  {totalUnread > 99 ? "99+" : totalUnread}
                </span>
              )}
            </div>
            <span className="text-sm text-muted-foreground">
              {convs.length} conversation{convs.length !== 1 ? "s" : ""}
            </span>
          </div>

          {convsLoading ? (
            <div className="p-5 space-y-3">
              {Array.from({ length: 2 }).map((_, i) => <Skeleton key={i} className="h-14 w-full" />)}
            </div>
          ) : convs.length === 0 ? (
            <div className="p-8 text-center">
              <MessageSquare className="h-8 w-8 text-muted-foreground/30 mx-auto mb-2" />
              <p className="text-muted-foreground text-sm">
                No messages yet. Buyers can contact you from your listings.
              </p>
            </div>
          ) : (
            <div className="divide-y divide-border/50">
              {convs.map(conv => (
                <div key={conv.id}>
                  <button
                    className="w-full text-left px-5 py-4 hover:bg-secondary/20 transition-colors flex items-start gap-3"
                    onClick={() => setOpenConvId(openConvId === conv.id ? null : conv.id)}
                  >
                    <div className={`mt-1.5 flex-shrink-0 h-2 w-2 rounded-full ${(conv.unreadCount ?? 0) > 0 ? "bg-blue-500" : "bg-transparent border border-border"}`} />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-0.5">
                        <span className="font-medium text-white text-sm">{conv.buyerName}</span>
                        {conv.buyerCompany && (
                          <span className="text-xs text-muted-foreground">· {conv.buyerCompany}</span>
                        )}
                        {(conv.unreadCount ?? 0) > 0 && (
                          <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-full bg-blue-500/20 text-blue-400">
                            {conv.unreadCount} new
                          </span>
                        )}
                      </div>
                      <p className="text-xs text-muted-foreground font-mono truncate">
                        {conv.subject ?? "(no subject)"}
                      </p>
                      {conv.lastMessage && (
                        <p className="text-xs text-muted-foreground/60 truncate mt-0.5">{conv.lastMessage}</p>
                      )}
                      {plan === "free" && (
                        <p className="text-xs text-amber-400/80 mt-1 flex items-center gap-1">
                          <Lock className="h-2.5 w-2.5" /> Upgrade to see buyer email
                        </p>
                      )}
                      {conv.buyerEmail && plan !== "free" && (
                        <p className="text-xs text-muted-foreground/60 mt-0.5">{conv.buyerEmail}</p>
                      )}
                    </div>
                    <div className="flex-shrink-0 text-xs text-muted-foreground/60 whitespace-nowrap">
                      {new Date(conv.updatedAt).toLocaleDateString()}
                    </div>
                  </button>

                  {openConvId === conv.id && (
                    <ConversationThread
                      id={conv.id}
                      onReplied={() => queryClient.invalidateQueries({ queryKey: getGetConversationsQueryKey() })}
                    />
                  )}
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Listings Table */}
        <div className="bg-card border border-border rounded-md">
          <div className="p-5 border-b border-border flex items-center justify-between">
            <h2 className="font-semibold text-white">Your Listings</h2>
            <span className="text-sm text-muted-foreground">{listings?.length ?? 0} parts listed</span>
          </div>

          {listingsLoading ? (
            <div className="p-5 space-y-3">
              {Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-14 w-full" />)}
            </div>
          ) : listings?.length === 0 ? (
            <div className="p-12 text-center">
              <Package className="h-10 w-10 text-muted-foreground/30 mx-auto mb-3" />
              <p className="text-muted-foreground mb-4">No listings yet. Create your first part listing.</p>
              <Link href="/seller/listings/new">
                <Button><Plus className="h-4 w-4 mr-2" /> Create Listing</Button>
              </Link>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border text-xs text-muted-foreground uppercase tracking-wider">
                    <th className="text-left p-4">Part Number</th>
                    <th className="text-left p-4 hidden md:table-cell">Description</th>
                    <th className="text-left p-4 hidden lg:table-cell">Condition</th>
                    <th className="text-left p-4">Price</th>
                    <th className="text-left p-4">Status</th>
                    <th className="text-right p-4">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {listings?.map(listing => (
                    <tr key={listing.id} className="border-b border-border/50 hover:bg-secondary/20 transition-colors">
                      <td className="p-4">
                        <Link href={`/listings/${listing.id}`}>
                          <span className="font-mono text-primary hover:underline cursor-pointer">{listing.partNumber}</span>
                        </Link>
                      </td>
                      <td className="p-4 hidden md:table-cell text-muted-foreground max-w-xs truncate">{listing.description}</td>
                      <td className="p-4 hidden lg:table-cell text-muted-foreground">{formatCondition(listing.condition)}</td>
                      <td className="p-4 font-mono text-white">{formatPrice(listing.price)}</td>
                      <td className="p-4"><BadgeIndicator badge={listing.badge} /></td>
                      <td className="p-4">
                        <div className="flex items-center justify-end gap-2">
                          <Link href={`/seller/listings/${listing.id}/edit`}>
                            <Button variant="ghost" size="sm" className="h-7 w-7 p-0">
                              <Edit2 className="h-3.5 w-3.5" />
                            </Button>
                          </Link>
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-7 w-7 p-0 text-destructive hover:text-destructive"
                            onClick={() => handleDelete(listing.id, listing.partNumber)}
                            disabled={deleteMutation.isPending}
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </Button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </MainLayout>
  );
}
