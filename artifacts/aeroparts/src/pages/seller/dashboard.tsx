import { Link, useLocation } from "wouter";
import { MainLayout } from "@/components/layout/MainLayout";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { BadgeIndicator } from "@/components/ui/badge-indicator";
import {
  useGetSellerListings, getGetSellerListingsQueryKey,
  useGetSellerStats, getGetSellerStatsQueryKey,
  useDeleteListing
} from "@workspace/api-client-react";
import { useAuth } from "@/context/AuthContext";
import { useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import { Plus, Edit2, Trash2, Package, FileCheck2, MessageSquare, ShieldCheck } from "lucide-react";

function formatPrice(price: number | null) {
  if (price == null) return "POA";
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 }).format(price);
}

function formatCondition(c: string) {
  return c.split("_").map(w => w[0].toUpperCase() + w.slice(1)).join(" ");
}

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

  if (authLoading) {
    return <MainLayout><div className="container mx-auto px-4 py-16 text-center text-muted-foreground">Loading...</div></MainLayout>;
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

  return (
    <MainLayout>
      <div className="container mx-auto px-4 py-8">
        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-2xl font-bold text-white">Seller Dashboard</h1>
            <p className="text-muted-foreground text-sm mt-1">{user.companyName}</p>
          </div>
          <Link href="/seller/listings/new">
            <Button className="flex items-center gap-2">
              <Plus className="h-4 w-4" /> New Listing
            </Button>
          </Link>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
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
