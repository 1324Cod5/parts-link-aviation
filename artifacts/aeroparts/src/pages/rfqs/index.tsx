import { useState } from "react";
import { Link } from "wouter";
import { useGetRfqs } from "@workspace/api-client-react";
import { useAuth } from "@/context/AuthContext";
import { Navbar } from "@/components/layout/Navbar";
import { Footer } from "@/components/layout/Footer";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Search, Plus, Clock, Package, ChevronRight, Building2, Plane, Lock } from "lucide-react";

function timeAgo(dateStr: string) {
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}

export default function RfqsPage() {
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [page, setPage] = useState(1);
  const [statusFilter, setStatusFilter] = useState<"open" | "closed" | undefined>("open");

  const { user } = useAuth();
  const isFreeSeller = user?.role === "seller" && user?.plan === "free";

  const { data, isLoading } = useGetRfqs({
    q: debouncedSearch || undefined,
    status: statusFilter,
    page,
    limit: 20,
  });

  function handleSearch(val: string) {
    setSearch(val);
    clearTimeout((window as any)._rfqSearchTimer);
    (window as any)._rfqSearchTimer = setTimeout(() => {
      setDebouncedSearch(val);
      setPage(1);
    }, 350);
  }

  const total = data?.total ?? 0;
  const totalPages = Math.ceil(total / 20);

  return (
    <div className="min-h-screen bg-background flex flex-col">
      <Navbar />
      <main className="flex-1">
        {/* Hero */}
        <div className="border-b border-border bg-card/30 py-10">
          <div className="container mx-auto px-4">
            <div className="flex flex-col md:flex-row md:items-end md:justify-between gap-4">
              <div>
                <div className="flex items-center gap-2 text-muted-foreground text-sm mb-2">
                  <Package className="w-4 h-4" />
                  <span>Request for Quotation Board</span>
                </div>
                <h1 className="text-3xl font-bold text-white">Open RFQs</h1>
                <p className="text-muted-foreground mt-1">
                  Buyers seeking certified aircraft components. Respond with your inventory.
                </p>
              </div>
              <Link href="/rfqs/new">
                <Button className="bg-primary hover:bg-primary/90 gap-2">
                  <Plus className="w-4 h-4" />
                  Post an RFQ
                </Button>
              </Link>
            </div>
          </div>
        </div>

        {/* Free seller access notice */}
        {isFreeSeller && (
          <div className="border-b border-amber-500/20 bg-amber-500/5">
            <div className="container mx-auto px-4 py-3 flex items-center justify-between gap-4">
              <div className="flex items-center gap-2 text-sm text-amber-400/90">
                <Lock className="w-4 h-4 flex-shrink-0" />
                <span>
                  <span className="font-medium">Free plan:</span> Buyer contact details and full RFQ notes are hidden.
                  Upgrade to Pro or Enterprise to unlock full access and respond to RFQs.
                </span>
              </div>
              <Link href="/pricing">
                <Button size="sm" variant="outline" className="border-amber-500/40 text-amber-400 hover:bg-amber-500/10 hover:text-amber-300 flex-shrink-0">
                  Upgrade Plan
                </Button>
              </Link>
            </div>
          </div>
        )}

        <div className="container mx-auto px-4 py-8">
          {/* Filters */}
          <div className="flex flex-col sm:flex-row gap-3 mb-6">
            <div className="relative flex-1 max-w-md">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input
                placeholder="Search by part number or description…"
                value={search}
                onChange={e => handleSearch(e.target.value)}
                className="pl-9 bg-card border-border"
              />
            </div>
            <div className="flex gap-2">
              {(["open", "closed", undefined] as const).map(s => (
                <Button
                  key={String(s)}
                  variant={statusFilter === s ? "default" : "outline"}
                  size="sm"
                  onClick={() => { setStatusFilter(s); setPage(1); }}
                  className={statusFilter !== s ? "border-border text-muted-foreground hover:text-white" : ""}
                >
                  {s === undefined ? "All" : s === "open" ? "Open" : "Closed"}
                </Button>
              ))}
            </div>
          </div>

          {/* Stats bar */}
          <div className="flex items-center gap-4 mb-6 text-sm text-muted-foreground">
            <span>{isLoading ? "…" : total} {statusFilter === "open" ? "open" : statusFilter === "closed" ? "closed" : "total"} RFQs</span>
          </div>

          {/* List */}
          {isLoading ? (
            <div className="space-y-3">
              {Array.from({ length: 6 }).map((_, i) => (
                <div key={i} className="h-28 rounded-lg bg-card/50 animate-pulse" />
              ))}
            </div>
          ) : data?.rfqs.length === 0 ? (
            <div className="text-center py-20 text-muted-foreground">
              <Package className="w-12 h-12 mx-auto mb-4 opacity-30" />
              <p className="text-lg font-medium">No RFQs found</p>
              <p className="text-sm mt-1">Be the first to post a part request</p>
              <Link href="/rfqs/new">
                <Button className="mt-4 gap-2">
                  <Plus className="w-4 h-4" />
                  Post an RFQ
                </Button>
              </Link>
            </div>
          ) : (
            <div className="space-y-3">
              {data?.rfqs.map(rfq => (
                <Link key={rfq.id} href={`/rfqs/${rfq.id}`}>
                  <div className="group border border-border rounded-lg bg-card hover:border-primary/50 hover:bg-card/80 transition-all cursor-pointer p-5">
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-3 mb-1.5">
                          <span className="font-mono text-sm font-semibold text-primary tracking-wider">
                            {rfq.partNumber}
                          </span>
                          <Badge variant={rfq.status === "open" ? "default" : "secondary"}
                            className={rfq.status === "open"
                              ? "bg-emerald-500/20 text-emerald-400 border-emerald-500/30 text-xs"
                              : "bg-muted text-muted-foreground text-xs"
                            }>
                            {rfq.status.toUpperCase()}
                          </Badge>
                          {rfq.condition && (
                            <span className="text-xs text-muted-foreground border border-border rounded px-1.5 py-0.5">
                              {rfq.condition}
                            </span>
                          )}
                        </div>
                        <p className="text-sm text-foreground line-clamp-2 mb-2">{rfq.description}</p>
                        <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted-foreground">
                          {rfq.accessLevel === "limited" ? (
                            <span className="flex items-center gap-1 text-amber-500/60">
                              <Lock className="w-3 h-3" />
                              <span className="blur-[5px] select-none">Buyer contact hidden</span>
                            </span>
                          ) : rfq.buyerCompany ? (
                            <span className="flex items-center gap-1">
                              <Building2 className="w-3 h-3" />
                              {rfq.buyerCompany}
                            </span>
                          ) : null}
                          {rfq.aircraftApplicability && (
                            <span className="flex items-center gap-1">
                              <Plane className="w-3 h-3" />
                              {rfq.aircraftApplicability}
                            </span>
                          )}
                          <span className="flex items-center gap-1">
                            <Package className="w-3 h-3" />
                            Qty: {rfq.quantity}
                          </span>
                          <span className="flex items-center gap-1">
                            <Clock className="w-3 h-3" />
                            {timeAgo(rfq.createdAt)}
                          </span>
                        </div>
                      </div>
                      <ChevronRight className="w-5 h-5 text-muted-foreground group-hover:text-primary transition-colors flex-shrink-0 mt-1" />
                    </div>
                  </div>
                </Link>
              ))}
            </div>
          )}

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="flex justify-center gap-2 mt-8">
              <Button variant="outline" size="sm" disabled={page <= 1} onClick={() => setPage(p => p - 1)}
                className="border-border text-muted-foreground hover:text-white">
                Previous
              </Button>
              <span className="text-sm text-muted-foreground flex items-center px-2">
                Page {page} of {totalPages}
              </span>
              <Button variant="outline" size="sm" disabled={page >= totalPages} onClick={() => setPage(p => p + 1)}
                className="border-border text-muted-foreground hover:text-white">
                Next
              </Button>
            </div>
          )}
        </div>
      </main>
      <Footer />
    </div>
  );
}
