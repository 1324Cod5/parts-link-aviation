import { Link, useLocation } from "wouter";
import { useState } from "react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Search, ShieldCheck, FileCheck2, Clock3 } from "lucide-react";
import { MainLayout } from "@/components/layout/MainLayout";
import { useGetMarketplaceStats, useGetFeaturedListings, getGetMarketplaceStatsQueryKey, getGetFeaturedListingsQueryKey } from "@workspace/api-client-react";
import { ListingCard } from "@/components/ui/listing-card";
import { Skeleton } from "@/components/ui/skeleton";

export default function Home() {
  const [, setLocation] = useLocation();
  const [searchQuery, setSearchQuery] = useState("");

  const { data: stats, isLoading: statsLoading } = useGetMarketplaceStats({
    query: { queryKey: getGetMarketplaceStatsQueryKey() }
  });

  const { data: featuredListings, isLoading: featuredLoading } = useGetFeaturedListings({
    query: { queryKey: getGetFeaturedListingsQueryKey() }
  });

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    if (searchQuery.trim()) {
      setLocation(`/marketplace?q=${encodeURIComponent(searchQuery)}`);
    } else {
      setLocation('/marketplace');
    }
  };

  return (
    <MainLayout>
      {/* Hero Section */}
      <section className="relative pt-24 pb-32 overflow-hidden">
        <div className="absolute inset-0 z-0">
          <div className="absolute inset-0 bg-background mix-blend-multiply" />
          <div className="absolute inset-0 bg-gradient-to-b from-background/80 via-background/90 to-background" />
        </div>
        
        <div className="container mx-auto px-4 relative z-10">
          <div className="max-w-3xl mx-auto text-center">
            <h1 className="text-4xl md:text-6xl font-bold tracking-tight text-white mb-6">
              AeroParts — Aviation Parts Marketplace &amp; RFQ Network
            </h1>
            <p className="text-lg md:text-xl text-muted-foreground mb-10">
              Connect buyers, verified vendors, MRO providers, and aircraft parts suppliers through a trusted aviation procurement platform.
            </p>
            
            <form onSubmit={handleSearch} className="flex gap-2 max-w-2xl mx-auto bg-card border border-border p-2 rounded-lg shadow-2xl">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground h-5 w-5" />
                <Input 
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Search by part number, description, or aircraft..." 
                  className="pl-10 border-0 bg-transparent text-base focus-visible:ring-0 shadow-none"
                />
              </div>
              <Button type="submit" size="lg" className="bg-primary text-primary-foreground hover:bg-primary/90 px-8">
                Search
              </Button>
            </form>

            {/* Stats */}
            <div className="mt-16 grid grid-cols-2 md:grid-cols-4 gap-4 text-center border-t border-border/50 pt-8">
              {statsLoading ? (
                Array.from({ length: 4 }).map((_, i) => (
                  <div key={i} className="flex flex-col items-center">
                    <Skeleton className="h-8 w-16 mb-2" />
                    <Skeleton className="h-4 w-24" />
                  </div>
                ))
              ) : stats ? (
                <>
                  <div>
                    <div className="text-3xl font-bold text-white font-mono">{stats.totalListings.toLocaleString()}</div>
                    <div className="text-sm text-muted-foreground uppercase tracking-wider mt-1">Active Parts</div>
                  </div>
                  <div>
                    <div className="text-3xl font-bold text-white font-mono">{stats.verifiedSellers.toLocaleString()}</div>
                    <div className="text-sm text-muted-foreground uppercase tracking-wider mt-1">Verified Sellers</div>
                  </div>
                  <div>
                    <div className="text-3xl font-bold text-white font-mono">{stats.totalManufacturers.toLocaleString()}</div>
                    <div className="text-sm text-muted-foreground uppercase tracking-wider mt-1">Manufacturers</div>
                  </div>
                  <div>
                    <div className="text-3xl font-bold text-white font-mono">{stats.recentListings.toLocaleString()}</div>
                    <div className="text-sm text-muted-foreground uppercase tracking-wider mt-1">Added This Week</div>
                  </div>
                </>
              ) : null}
            </div>
          </div>
        </div>
      </section>

      {/* Featured Listings */}
      <section className="py-20 bg-secondary/20">
        <div className="container mx-auto px-4">
          <div className="flex justify-between items-end mb-10">
            <div>
              <h2 className="text-2xl font-bold text-white mb-2">Featured Verified Listings</h2>
              <p className="text-muted-foreground">Premium components ready for dispatch.</p>
            </div>
            <Link href="/marketplace">
              <Button variant="outline" className="hidden md:flex">View All Parts</Button>
            </Link>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            {featuredLoading ? (
              Array.from({ length: 4 }).map((_, i) => (
                <Card key={i} className="h-full flex flex-col bg-card overflow-hidden border-border">
                  <Skeleton className="aspect-video w-full rounded-none" />
                  <div className="p-4 flex-1">
                    <Skeleton className="h-6 w-2/3 mb-2" />
                    <Skeleton className="h-4 w-1/3 mb-4" />
                    <Skeleton className="h-4 w-full mb-2" />
                    <Skeleton className="h-4 w-full" />
                  </div>
                </Card>
              ))
            ) : featuredListings?.map(listing => (
              <ListingCard key={listing.id} listing={listing} />
            ))}
          </div>
          
          <div className="mt-8 text-center md:hidden">
            <Link href="/marketplace">
              <Button variant="outline" className="w-full">View All Parts</Button>
            </Link>
          </div>
        </div>
      </section>

      {/* Trust & Certification Section */}
      <section className="py-24 border-t border-border">
        <div className="container mx-auto px-4">
          <div className="text-center max-w-2xl mx-auto mb-16">
            <h2 className="text-3xl font-bold text-white mb-4">Certification & Traceability First</h2>
            <p className="text-muted-foreground">
              We operate a strict badge system to ensure you know exactly what you're buying.
              Our verification team reviews documentation before granting status.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            <div className="bg-card p-8 rounded-lg border border-border">
              <div className="h-12 w-12 rounded-full bg-amber-500/10 flex items-center justify-center mb-6">
                <ShieldCheck className="h-6 w-6 text-amber-500" />
              </div>
              <h3 className="text-xl font-bold text-white mb-3">Verified</h3>
              <p className="text-muted-foreground text-sm leading-relaxed">
                The highest standard. Seller identity confirmed, parts physically inspected, and full trace documentation verified by our quality team.
              </p>
            </div>
            
            <div className="bg-card p-8 rounded-lg border border-border">
              <div className="h-12 w-12 rounded-full bg-blue-500/10 flex items-center justify-center mb-6">
                <FileCheck2 className="h-6 w-6 text-blue-400" />
              </div>
              <h3 className="text-xl font-bold text-white mb-3">Docs Reviewed</h3>
              <p className="text-muted-foreground text-sm leading-relaxed">
                Certification documents (8130-3, Form 1) have been uploaded by the seller and reviewed by our system for validity and completeness.
              </p>
            </div>
            
            <div className="bg-card p-8 rounded-lg border border-border">
              <div className="h-12 w-12 rounded-full bg-slate-500/10 flex items-center justify-center mb-6">
                <Clock3 className="h-6 w-6 text-slate-400" />
              </div>
              <h3 className="text-xl font-bold text-white mb-3">Pending Verification</h3>
              <p className="text-muted-foreground text-sm leading-relaxed">
                Newly listed parts. Buyers are advised to request documentation directly from the seller before completing a transaction.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-24 bg-primary text-primary-foreground relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-r from-black/50 to-transparent pointer-events-none" />
        <div className="container mx-auto px-4 relative z-10">
          <div className="max-w-2xl">
            <h2 className="text-3xl md:text-4xl font-bold mb-6">List Your Inventory to a Global Audience</h2>
            <p className="text-lg text-primary-foreground/80 mb-8">
              Join leading MROs and brokers. Fast onboarding, strict quality controls, and direct access to qualified buyers.
            </p>
            <div className="flex gap-4">
              <Link href="/seller/register">
                <Button size="lg" className="bg-background text-foreground hover:bg-background/90">
                  Become a Seller
                </Button>
              </Link>
              <Link href="/marketplace">
                <Button size="lg" variant="outline" className="border-background/20 text-background hover:bg-background/10">
                  Browse Marketplace
                </Button>
              </Link>
            </div>
          </div>
        </div>
      </section>
    </MainLayout>
  );
}
