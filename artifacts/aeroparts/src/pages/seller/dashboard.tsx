import { Link, useLocation } from "wouter";
import { MainLayout } from "@/components/layout/MainLayout";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { BadgeIndicator } from "@/components/ui/badge-indicator";
import {
  useGetSellerListings, getGetSellerListingsQueryKey,
  useGetSellerStats, getGetSellerStatsQueryKey,
  useGetSellerRfqStats,
  useGetMyMroProfile, getGetMyMroProfileQueryKey,
  useDeleteListing
} from "@workspace/api-client-react";
import { useAuth } from "@/context/AuthContext";
import { useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import { Plus, Edit2, Trash2, Package, FileCheck2, MessageSquare, ShieldCheck, Zap, Building2, AlertTriangle, ClipboardList, Wrench, Shield, FileSpreadsheet, Lock } from "lucide-react";
import { TrustBadge, TrustScoreBar, TRUST_BADGE_META } from "@/components/ui/trust-badge";

function formatPrice(price: number | null) {
  if (price == null) return "POA";
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 }).format(price);
}

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
