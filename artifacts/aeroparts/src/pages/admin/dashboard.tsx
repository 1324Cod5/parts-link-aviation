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
  useUpdateListingBadge, useAdminRemoveListing
} from "@workspace/api-client-react";
import { useAuth } from "@/context/AuthContext";
import { useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import { Package, Users, Clock, MessageSquare, ShieldAlert, ExternalLink } from "lucide-react";

function formatCondition(c: string) {
  return c.split("_").map(w => w[0].toUpperCase() + w.slice(1)).join(" ");
}

function formatPrice(price: number | null) {
  if (price == null) return "POA";
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 }).format(price);
}

export default function AdminDashboard() {
  const { user, isLoading: authLoading } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
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

  const badgeMutation = useUpdateListingBadge();
  const removeMutation = useAdminRemoveListing();

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

        {/* Listings Review Table */}
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
      </div>
    </MainLayout>
  );
}
