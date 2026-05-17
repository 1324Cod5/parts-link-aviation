import { useState } from "react";
import { Link } from "wouter";
import { MainLayout } from "@/components/layout/MainLayout";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { BadgeIndicator } from "@/components/ui/badge-indicator";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  useGetAdminListings, getGetAdminListingsQueryKey,
  useGetAdminStats, getGetAdminStatsQueryKey,
  useUpdateListingBadge, useAdminRemoveListing,
  useGetAdminMroProfiles, getGetAdminMroProfilesQueryKey,
  useAdminSetMroStatus,
} from "@workspace/api-client-react";
import { useAuth } from "@/context/AuthContext";
import { useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import {
  Package, Users, Clock, MessageSquare, ShieldAlert, ExternalLink,
  Wrench, MapPin, CheckCircle2, XCircle, ShieldCheck
} from "lucide-react";

function formatCondition(c: string) {
  return c.split("_").map(w => w[0].toUpperCase() + w.slice(1)).join(" ");
}

function formatPrice(price: number | null) {
  if (price == null) return "POA";
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 }).format(price);
}

const MRO_STATUS_META: Record<string, { label: string; color: string; bg: string }> = {
  active: { label: "Active", color: "text-emerald-400", bg: "bg-emerald-500/10 border border-emerald-500/20" },
  pending: { label: "Pending", color: "text-amber-400", bg: "bg-amber-500/10 border border-amber-500/20" },
  suspended: { label: "Suspended", color: "text-red-400", bg: "bg-red-500/10 border border-red-500/20" },
};

export default function AdminDashboard() {
  const { user, isLoading: authLoading } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState<"listings" | "mro">("listings");
  const [badgeFilter, setBadgeFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");

  const queryParams = {
    badge: badgeFilter !== "all" ? badgeFilter as any : undefined,
    status: statusFilter !== "all" ? statusFilter as any : undefined,
  };

  const { data: listings, isLoading: listingsLoading } = useGetAdminListings(queryParams, {
    query: { queryKey: getGetAdminListingsQueryKey(queryParams) },
  });
  const { data: stats, isLoading: statsLoading } = useGetAdminStats({
    query: { queryKey: getGetAdminStatsQueryKey() },
  });
  const { data: mroData, isLoading: mroLoading } = useGetAdminMroProfiles({
    query: { queryKey: getGetAdminMroProfilesQueryKey() },
  });

  const badgeMutation = useUpdateListingBadge();
  const removeMutation = useAdminRemoveListing();
  const mroStatusMutation = useAdminSetMroStatus();

  const handleBadgeChange = (listingId: number, badge: string) => {
    badgeMutation.mutate(
      { id: listingId, data: { badge: badge as any } },
      {
        onSuccess: () => {
          queryClient.invalidateQueries({ queryKey: getGetAdminListingsQueryKey(queryParams) });
          queryClient.invalidateQueries({ queryKey: getGetAdminStatsQueryKey() });
          toast({ title: "Badge updated", description: `Listing badge set to ${badge.replace(/_/g, " ")}.` });
        },
      }
    );
  };

  const handleRemove = (listingId: number, partNumber: string) => {
    if (!confirm(`Remove listing ${partNumber} as fraudulent? The seller will no longer be able to show it.`)) return;
    removeMutation.mutate(
      { id: listingId },
      {
        onSuccess: () => {
          queryClient.invalidateQueries({ queryKey: getGetAdminListingsQueryKey(queryParams) });
          queryClient.invalidateQueries({ queryKey: getGetAdminStatsQueryKey() });
          toast({ title: "Listing removed", description: `${partNumber} has been removed from the marketplace.` });
        },
      }
    );
  };

  const handleMroStatus = (mroId: number, status: "active" | "pending" | "suspended") => {
    mroStatusMutation.mutate(
      { id: mroId, data: { status } },
      {
        onSuccess: () => {
          queryClient.invalidateQueries({ queryKey: getGetAdminMroProfilesQueryKey() });
          toast({ title: "MRO status updated", description: `Profile set to ${status}.` });
        },
        onError: () => {
          toast({ title: "Failed to update status", variant: "destructive" });
        },
      }
    );
  };

  if (authLoading) {
    return <MainLayout><div className="container mx-auto px-4 py-16 text-center text-muted-foreground">Loading...</div></MainLayout>;
  }

  if (!user || user.role !== "admin") {
    return (
      <MainLayout>
        <div className="container mx-auto px-4 py-16 text-center">
          <ShieldAlert className="h-12 w-12 text-muted-foreground/30 mx-auto mb-4" />
          <p className="text-muted-foreground mb-4">Admin access required.</p>
          <Link href="/seller/login"><Button>Sign In as Admin</Button></Link>
          <p className="text-xs text-muted-foreground mt-3">Use admin@aeroparts.com / password</p>
        </div>
      </MainLayout>
    );
  }

  return (
    <MainLayout>
      <div className="container mx-auto px-4 py-8">
        <div className="mb-8">
          <h1 className="text-2xl font-bold text-white">Admin Portal</h1>
          <p className="text-muted-foreground text-sm mt-1">Review listings, manage badges, and moderate the marketplace</p>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
          {[
            { icon: Package, label: "Total Listings", value: stats?.totalListings },
            { icon: Users, label: "Total Sellers", value: stats?.totalSellers },
            { icon: Clock, label: "Pending Review", value: stats?.pendingVerification },
            { icon: MessageSquare, label: "Total Inquiries", value: stats?.totalInquiries },
          ].map(({ icon: Icon, label, value }) => (
            <div key={label} className="bg-card border border-border rounded-md p-5">
              <div className="flex items-center gap-2 text-muted-foreground mb-3">
                <Icon className="h-4 w-4" />
                <span className="text-xs uppercase tracking-wider">{label}</span>
              </div>
              {statsLoading ? (
                <Skeleton className="h-8 w-12" />
              ) : (
                <p className="text-3xl font-bold text-white font-mono">{value ?? 0}</p>
              )}
            </div>
          ))}
        </div>

        {/* Tabs */}
        <div className="flex border-b border-border mb-6 gap-1">
          <button
            onClick={() => setActiveTab("listings")}
            className={`px-4 py-2.5 text-sm font-medium transition-colors border-b-2 -mb-px flex items-center gap-2 ${activeTab === "listings" ? "border-primary text-white" : "border-transparent text-muted-foreground hover:text-white"}`}
          >
            <Package className="w-4 h-4" />
            Parts Listings
            <span className="text-xs bg-secondary/60 text-muted-foreground rounded px-1.5">{listings?.length ?? 0}</span>
          </button>
          <button
            onClick={() => setActiveTab("mro")}
            className={`px-4 py-2.5 text-sm font-medium transition-colors border-b-2 -mb-px flex items-center gap-2 ${activeTab === "mro" ? "border-primary text-white" : "border-transparent text-muted-foreground hover:text-white"}`}
          >
            <Wrench className="w-4 h-4" />
            MRO Providers
            <span className="text-xs bg-secondary/60 text-muted-foreground rounded px-1.5">{mroData?.total ?? 0}</span>
          </button>
        </div>

        {/* Listings Tab */}
        {activeTab === "listings" && (
          <div className="bg-card border border-border rounded-md">
            <div className="p-5 border-b border-border flex flex-wrap items-center gap-3 justify-between">
              <h2 className="font-semibold text-white">Listings Review</h2>
              <div className="flex gap-2">
                <Select value={badgeFilter} onValueChange={setBadgeFilter}>
                  <SelectTrigger className="text-xs h-8 w-40">
                    <SelectValue placeholder="All badges" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Badges</SelectItem>
                    <SelectItem value="pending_verification">Pending</SelectItem>
                    <SelectItem value="documentation_reviewed">Docs Reviewed</SelectItem>
                    <SelectItem value="verified">Verified</SelectItem>
                  </SelectContent>
                </Select>
                <Select value={statusFilter} onValueChange={setStatusFilter}>
                  <SelectTrigger className="text-xs h-8 w-32">
                    <SelectValue placeholder="All status" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Status</SelectItem>
                    <SelectItem value="active">Active</SelectItem>
                    <SelectItem value="removed">Removed</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            {listingsLoading ? (
              <div className="p-5 space-y-3">
                {Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} className="h-14 w-full" />)}
              </div>
            ) : listings?.length === 0 ? (
              <div className="p-12 text-center text-muted-foreground">No listings match the current filters.</div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-border text-xs text-muted-foreground uppercase tracking-wider">
                      <th className="text-left p-4">Part Number</th>
                      <th className="text-left p-4 hidden md:table-cell">Seller</th>
                      <th className="text-left p-4 hidden lg:table-cell">Condition</th>
                      <th className="text-left p-4 hidden lg:table-cell">Price</th>
                      <th className="text-left p-4">Current Badge</th>
                      <th className="text-left p-4">Set Badge</th>
                      <th className="text-right p-4">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {listings?.map(listing => (
                      <tr
                        key={listing.id}
                        className={`border-b border-border/50 hover:bg-secondary/20 transition-colors ${listing.status === "removed" ? "opacity-50" : ""}`}
                      >
                        <td className="p-4">
                          <Link href={`/listings/${listing.id}`}>
                            <span className="font-mono text-primary hover:underline cursor-pointer flex items-center gap-1">
                              {listing.partNumber}
                              <ExternalLink className="h-3 w-3" />
                            </span>
                          </Link>
                          {listing.status === "removed" && (
                            <span className="text-xs text-destructive ml-1">(removed)</span>
                          )}
                        </td>
                        <td className="p-4 hidden md:table-cell text-muted-foreground">
                          {listing.seller?.companyName ?? "—"}
                        </td>
                        <td className="p-4 hidden lg:table-cell text-muted-foreground">{formatCondition(listing.condition)}</td>
                        <td className="p-4 hidden lg:table-cell font-mono text-white">{formatPrice(listing.price)}</td>
                        <td className="p-4"><BadgeIndicator badge={listing.badge} /></td>
                        <td className="p-4">
                          {listing.status !== "removed" && (
                            <Select
                              value={listing.badge}
                              onValueChange={v => handleBadgeChange(listing.id, v)}
                              disabled={badgeMutation.isPending}
                            >
                              <SelectTrigger className="text-xs h-7 w-36 bg-secondary/30">
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="pending_verification">Pending</SelectItem>
                                <SelectItem value="documentation_reviewed">Docs Reviewed</SelectItem>
                                <SelectItem value="verified">Verified</SelectItem>
                              </SelectContent>
                            </Select>
                          )}
                        </td>
                        <td className="p-4 text-right">
                          {listing.status !== "removed" && (
                            <Button
                              variant="ghost"
                              size="sm"
                              className="text-xs text-destructive hover:text-destructive h-7"
                              onClick={() => handleRemove(listing.id, listing.partNumber)}
                              disabled={removeMutation.isPending}
                            >
                              Remove
                            </Button>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}

        {/* MRO Tab */}
        {activeTab === "mro" && (
          <div className="bg-card border border-border rounded-md">
            <div className="p-5 border-b border-border flex items-center justify-between">
              <h2 className="font-semibold text-white">MRO Providers</h2>
              <span className="text-sm text-muted-foreground">{mroData?.total ?? 0} registered</span>
            </div>

            {mroLoading ? (
              <div className="p-5 space-y-3">
                {Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} className="h-20 w-full" />)}
              </div>
            ) : !mroData?.profiles.length ? (
              <div className="p-12 text-center text-muted-foreground">
                <Wrench className="h-8 w-8 mx-auto mb-3 opacity-30" />
                No MRO providers registered yet.
              </div>
            ) : (
              <div className="divide-y divide-border/50">
                {mroData.profiles.map(mro => {
                  const statusMeta = MRO_STATUS_META[mro.status] ?? MRO_STATUS_META.active;
                  return (
                    <div key={mro.id} className="p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4 hover:bg-secondary/10 transition-colors">
                      <div className="flex items-start gap-3">
                        <div className="w-9 h-9 rounded-md bg-primary/10 flex items-center justify-center flex-shrink-0 mt-0.5">
                          <Wrench className="w-4 h-4 text-primary" />
                        </div>
                        <div>
                          <div className="flex items-center gap-2 mb-1">
                            <Link href={`/mro/${mro.id}`}>
                              <span className="font-medium text-white hover:text-primary cursor-pointer">{mro.companyName}</span>
                            </Link>
                            <span className={`text-xs px-1.5 py-0.5 rounded ${statusMeta.bg} ${statusMeta.color}`}>
                              {statusMeta.label}
                            </span>
                            {mro.featured && (
                              <span className="text-xs text-amber-400 bg-amber-500/10 border border-amber-500/20 rounded px-1.5 py-0.5">Featured</span>
                            )}
                          </div>
                          <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
                            <span className="flex items-center gap-1">
                              <MapPin className="w-3 h-3" />
                              {[mro.city, mro.country].filter(Boolean).join(", ")}
                            </span>
                            {mro.certifications.slice(0, 2).map(c => (
                              <span key={c} className="flex items-center gap-0.5">
                                <ShieldCheck className="w-3 h-3" /> {c}
                              </span>
                            ))}
                            <span>{mro.serviceTypes.length} service types</span>
                          </div>
                          <p className="text-xs text-muted-foreground mt-1">{mro.contactEmail}</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2 ml-12 sm:ml-0 flex-shrink-0">
                        {mro.status !== "active" && (
                          <Button size="sm" variant="ghost"
                            className="text-xs h-7 text-emerald-400 hover:text-emerald-300 hover:bg-emerald-500/10 gap-1"
                            onClick={() => handleMroStatus(mro.id, "active")}
                            disabled={mroStatusMutation.isPending}>
                            <CheckCircle2 className="w-3.5 h-3.5" /> Activate
                          </Button>
                        )}
                        {mro.status !== "suspended" && (
                          <Button size="sm" variant="ghost"
                            className="text-xs h-7 text-red-400 hover:text-red-300 hover:bg-red-500/10 gap-1"
                            onClick={() => handleMroStatus(mro.id, "suspended")}
                            disabled={mroStatusMutation.isPending}>
                            <XCircle className="w-3.5 h-3.5" /> Suspend
                          </Button>
                        )}
                        <Link href={`/mro/${mro.id}`}>
                          <Button size="sm" variant="outline"
                            className="text-xs h-7 border-border text-muted-foreground hover:text-white gap-1">
                            <ExternalLink className="w-3 h-3" /> View
                          </Button>
                        </Link>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}
      </div>
    </MainLayout>
  );
}
