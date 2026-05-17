import { useState, useEffect } from "react";
import { useSearch } from "wouter";
import { MainLayout } from "@/components/layout/MainLayout";
import { ListingCard } from "@/components/ui/listing-card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { useGetListings, getGetListingsQueryKey } from "@workspace/api-client-react";
import { Search, SlidersHorizontal, X } from "lucide-react";

const CONDITIONS = [
  { value: "new", label: "New" },
  { value: "overhauled", label: "Overhauled" },
  { value: "serviceable", label: "Serviceable" },
  { value: "as_removed", label: "As Removed" },
  { value: "repaired", label: "Repaired" },
];

const SALE_TYPES = [
  { value: "outright", label: "Outright" },
  { value: "exchange", label: "Exchange" },
  { value: "both", label: "Outright or Exchange" },
];

const BADGES = [
  { value: "verified", label: "Verified" },
  { value: "documentation_reviewed", label: "Docs Reviewed" },
  { value: "pending_verification", label: "Pending" },
];

export default function Marketplace() {
  const searchStr = useSearch();
  const params = new URLSearchParams(searchStr);

  const [q, setQ] = useState(params.get("q") ?? "");
  const [aircraft, setAircraft] = useState("");
  const [condition, setCondition] = useState("all");
  const [saleType, setSaleType] = useState("all");
  const [badge, setBadge] = useState("all");
  const [page, setPage] = useState(1);
  const [filtersOpen, setFiltersOpen] = useState(false);

  const queryParams = {
    q: q || undefined,
    aircraft: aircraft || undefined,
    condition: condition !== "all" ? condition as any : undefined,
    saleType: saleType !== "all" ? saleType as any : undefined,
    badge: badge !== "all" ? badge as any : undefined,
    page,
    limit: 12,
  };

  const { data, isLoading } = useGetListings(queryParams, {
    query: { queryKey: getGetListingsQueryKey(queryParams) },
  });

  const totalPages = data ? Math.ceil(data.total / 12) : 0;

  const hasActiveFilters = condition !== "all" || saleType !== "all" || badge !== "all" || aircraft;
  const clearFilters = () => {
    setCondition("all");
    setSaleType("all");
    setBadge("all");
    setAircraft("");
    setPage(1);
  };

  return (
    <MainLayout>
      <div className="container mx-auto px-4 py-10">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-white mb-2">Parts Marketplace</h1>
          <p className="text-muted-foreground">
            {data ? `${data.total.toLocaleString()} parts available` : "Searching inventory..."}
          </p>
        </div>

        {/* Search + Filters Bar */}
        <div className="flex flex-col md:flex-row gap-3 mb-6">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground h-4 w-4" />
            <Input
              value={q}
              onChange={e => { setQ(e.target.value); setPage(1); }}
              placeholder="Part number, description, manufacturer..."
              className="pl-9"
            />
          </div>
          <Button
            variant="outline"
            onClick={() => setFiltersOpen(!filtersOpen)}
            className={filtersOpen ? "border-primary text-primary" : ""}
          >
            <SlidersHorizontal className="h-4 w-4 mr-2" />
            Filters
            {hasActiveFilters && <span className="ml-2 h-2 w-2 rounded-full bg-primary inline-block" />}
          </Button>
          {hasActiveFilters && (
            <Button variant="ghost" onClick={clearFilters} className="text-muted-foreground">
              <X className="h-4 w-4 mr-1" /> Clear
            </Button>
          )}
        </div>

        {/* Filter Panel */}
        {filtersOpen && (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6 p-4 bg-card border border-border rounded-md">
            <div>
              <label className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-1.5 block">Aircraft</label>
              <Input
                value={aircraft}
                onChange={e => { setAircraft(e.target.value); setPage(1); }}
                placeholder="e.g. Boeing 737"
                className="text-sm"
              />
            </div>
            <div>
              <label className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-1.5 block">Condition</label>
              <Select value={condition} onValueChange={v => { setCondition(v); setPage(1); }}>
                <SelectTrigger className="text-sm">
                  <SelectValue placeholder="All conditions" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Conditions</SelectItem>
                  {CONDITIONS.map(c => <SelectItem key={c.value} value={c.value}>{c.label}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div>
              <label className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-1.5 block">Sale Type</label>
              <Select value={saleType} onValueChange={v => { setSaleType(v); setPage(1); }}>
                <SelectTrigger className="text-sm">
                  <SelectValue placeholder="All types" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Types</SelectItem>
                  {SALE_TYPES.map(s => <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div>
              <label className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-1.5 block">Verification</label>
              <Select value={badge} onValueChange={v => { setBadge(v); setPage(1); }}>
                <SelectTrigger className="text-sm">
                  <SelectValue placeholder="Any status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Any Status</SelectItem>
                  {BADGES.map(b => <SelectItem key={b.value} value={b.value}>{b.label}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          </div>
        )}

        {/* Results */}
        {isLoading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-5">
            {Array.from({ length: 8 }).map((_, i) => (
              <div key={i} className="bg-card rounded-md overflow-hidden border border-border">
                <Skeleton className="aspect-video w-full" />
                <div className="p-4 space-y-2">
                  <Skeleton className="h-5 w-3/4" />
                  <Skeleton className="h-4 w-1/2" />
                  <Skeleton className="h-4 w-full" />
                  <Skeleton className="h-4 w-full" />
                </div>
              </div>
            ))}
          </div>
        ) : data?.listings.length === 0 ? (
          <div className="text-center py-24 border border-dashed border-border rounded-md">
            <p className="text-muted-foreground text-lg">No parts found matching your criteria.</p>
            <Button variant="ghost" onClick={clearFilters} className="mt-4">Clear all filters</Button>
          </div>
        ) : (
          <>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-5">
              {data?.listings.map(listing => (
                <ListingCard key={listing.id} listing={listing} />
              ))}
            </div>

            {/* Pagination */}
            {totalPages > 1 && (
              <div className="flex items-center justify-center gap-2 mt-10">
                <Button
                  variant="outline"
                  disabled={page === 1}
                  onClick={() => setPage(p => p - 1)}
                >
                  Previous
                </Button>
                <span className="text-sm text-muted-foreground px-4">
                  Page {page} of {totalPages}
                </span>
                <Button
                  variant="outline"
                  disabled={page === totalPages}
                  onClick={() => setPage(p => p + 1)}
                >
                  Next
                </Button>
              </div>
            )}
          </>
        )}
      </div>
    </MainLayout>
  );
}
