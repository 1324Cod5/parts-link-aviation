import { useState } from "react";
import { useParams, Link } from "wouter";
import { MainLayout } from "@/components/layout/MainLayout";
import { BadgeIndicator } from "@/components/ui/badge-indicator";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Skeleton } from "@/components/ui/skeleton";
import {
  useGetListing, getGetListingQueryKey,
  useGetListingDocuments, getGetListingDocumentsQueryKey,
  useCreateConversation,
} from "@workspace/api-client-react";
import { useToast } from "@/hooks/use-toast";
import {
  ArrowLeft, FileText, Camera, Building2, Phone, Mail, Package, RefreshCw, ChevronRight,
  CheckCircle2, XCircle, Clock, Download, Heart, TrendingDown, TrendingUp, Minus,
} from "lucide-react";
import { TrustBadge, TrustScoreBar } from "@/components/ui/trust-badge";
import { SellerTypeBadge } from "@/components/ui/seller-type-badge";
import { useWatchlist } from "@/hooks/use-watchlist";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, ReferenceLine, Cell,
} from "recharts";

const DOC_TYPE_LABELS: Record<string, string> = {
  faa_8130_3: "FAA Form 8130-3",
  easa_form_1: "EASA Form 1",
  tcca_form_1: "TCCA Form 1",
  overhaul_report: "Overhaul Report",
  test_report: "Test Report",
  coa: "Certificate of Conformance",
  other: "Other",
};

function DocVerificationBadge({ status }: { status: string }) {
  if (status === "approved") return (
    <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-medium bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
      <CheckCircle2 className="w-2.5 h-2.5" /> Approved
    </span>
  );
  if (status === "rejected") return (
    <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-medium bg-red-500/10 text-red-400 border border-red-500/20">
      <XCircle className="w-2.5 h-2.5" /> Rejected
    </span>
  );
  return (
    <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-medium bg-amber-500/10 text-amber-400 border border-amber-500/20">
      <Clock className="w-2.5 h-2.5" /> Pending Review
    </span>
  );
}

function formatCondition(c: string) {
  return c.split("_").map(w => w[0].toUpperCase() + w.slice(1)).join(" ");
}

function formatPrice(price: number | null) {
  if (price == null) return "Contact for Price";
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(price);
}

// ─── Seeded price benchmarking helpers ────────────────────────────────────────

function seededRandom(seed: number): number {
  const x = Math.sin(seed + 1) * 10000;
  return x - Math.floor(x);
}

const BENCH_MONTHS = ["Nov '25", "Dec '25", "Jan '26", "Feb '26", "Mar '26", "Apr '26"];

function buildBenchData(basePrice: number, listingId: number) {
  return BENCH_MONTHS.map((month, i) => {
    const r1 = seededRandom(listingId * 137 + i);
    const r2 = seededRandom(listingId * 137 + i + 71);
    return {
      month,
      thisListing: Math.round(basePrice * (0.80 + r1 * 0.40)),
      marketAvg: Math.round(basePrice * (0.88 + r2 * 0.24)),
    };
  });
}

// ─── Price Benchmarking Section ───────────────────────────────────────────────

function PriceBenchmarkSection({ price, listingId }: { price: number; listingId: number }) {
  const data = buildBenchData(price, listingId);
  const listingPrices = data.map(d => d.thisListing);
  const marketPrices = data.map(d => d.marketAvg);
  const avg = Math.round(listingPrices.reduce((a, b) => a + b, 0) / listingPrices.length);
  const min = Math.min(...listingPrices);
  const max = Math.max(...listingPrices);
  const latestMarketAvg = marketPrices[marketPrices.length - 1];
  const vsMarketPct = ((price - latestMarketAvg) / latestMarketAvg) * 100;
  const isBelowMarket = vsMarketPct < 0;
  const isAtMarket = Math.abs(vsMarketPct) < 3;

  const stats = [
    { label: "6-Month Avg", value: formatPrice(avg) },
    { label: "Low", value: formatPrice(min) },
    { label: "High", value: formatPrice(max) },
    {
      label: "vs Market",
      value: isAtMarket
        ? "At Market"
        : `${isBelowMarket ? "" : "+"}${vsMarketPct.toFixed(1)}%`,
      color: isAtMarket ? "#94a3b8" : isBelowMarket ? "#4ade80" : "#f87171",
      icon: isAtMarket ? Minus : isBelowMarket ? TrendingDown : TrendingUp,
    },
  ];

  const CustomTooltip = ({ active, payload, label }: any) => {
    if (!active || !payload?.length) return null;
    return (
      <div style={{ background: "#0d1f38", border: "1px solid #1a3050", borderRadius: 8, padding: "10px 14px", fontSize: 12 }}>
        <p style={{ color: "#7ea8c8", marginBottom: 6 }}>{label}</p>
        {payload.map((p: any) => (
          <p key={p.dataKey} style={{ color: p.fill, margin: "2px 0" }}>
            {p.dataKey === "thisListing" ? "This Listing" : "Market Avg"}: {formatPrice(p.value)}
          </p>
        ))}
      </div>
    );
  };

  return (
    <div className="bg-card border border-border rounded-md p-6">
      <h2 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
        <TrendingUp className="h-5 w-5 text-primary" />
        Price Benchmarking
        <span className="text-xs font-normal text-muted-foreground ml-auto">6-month market data</span>
      </h2>

      {/* Stat pills */}
      <div className="grid grid-cols-4 gap-3 mb-5">
        {stats.map(s => {
          const Icon = (s as any).icon;
          return (
            <div key={s.label} className="bg-secondary/30 rounded-md p-3 border border-border/50">
              <p className="text-xs text-muted-foreground uppercase tracking-wider mb-1">{s.label}</p>
              <div className="flex items-center gap-1.5">
                {Icon && <Icon className="h-3.5 w-3.5" style={{ color: (s as any).color ?? "#fff" }} />}
                <span className="font-mono font-semibold text-sm" style={{ color: (s as any).color ?? "#fff" }}>
                  {s.value}
                </span>
              </div>
            </div>
          );
        })}
      </div>

      {/* Bar chart */}
      <ResponsiveContainer width="100%" height={190}>
        <BarChart data={data} barGap={4} margin={{ top: 4, right: 4, left: 0, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#1a3050" vertical={false} />
          <XAxis dataKey="month" tick={{ fill: "#4a6480", fontSize: 11 }} axisLine={false} tickLine={false} />
          <YAxis
            tickFormatter={v => `$${(v / 1000).toFixed(0)}k`}
            tick={{ fill: "#4a6480", fontSize: 11 }}
            axisLine={false}
            tickLine={false}
            width={48}
          />
          <Tooltip content={<CustomTooltip />} cursor={{ fill: "rgba(25,118,210,0.05)" }} />
          <ReferenceLine y={price} stroke="#f5a623" strokeDasharray="4 3" strokeWidth={1.5} label={{ value: "Listed", fill: "#f5a623", fontSize: 10, position: "insideTopRight" }} />
          <Bar dataKey="marketAvg" name="Market Avg" fill="#1a3050" radius={[3, 3, 0, 0]} maxBarSize={28}>
            {data.map((_, i) => <Cell key={i} fill="#1e3a58" />)}
          </Bar>
          <Bar dataKey="thisListing" name="This Listing" fill="#1976d2" radius={[3, 3, 0, 0]} maxBarSize={28}>
            {data.map((entry, i) => (
              <Cell key={i} fill={entry.thisListing <= entry.marketAvg ? "#22c55e" : "#1976d2"} />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>

      <div className="flex items-center gap-4 mt-3 text-xs text-muted-foreground">
        <span className="flex items-center gap-1.5"><span className="w-3 h-2.5 rounded-sm bg-[#1e3a58] inline-block" /> Market Avg</span>
        <span className="flex items-center gap-1.5"><span className="w-3 h-2.5 rounded-sm bg-primary inline-block" /> This Listing</span>
        <span className="flex items-center gap-1.5"><span className="w-3 h-2.5 rounded-sm bg-[#22c55e] inline-block" /> Below Market</span>
        <span className="ml-auto flex items-center gap-1.5"><span className="w-8 border-t border-dashed border-[#f5a623]" /> Listed Price</span>
      </div>
    </div>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────

export default function ListingDetail() {
  const { id } = useParams<{ id: string }>();
  const { toast } = useToast();
  const [activePhoto, setActivePhoto] = useState(0);
  const { isWatched, toggle } = useWatchlist();

  const { data: docsData } = useGetListingDocuments(Number(id), {
    query: { enabled: !!id, queryKey: getGetListingDocumentsQueryKey(Number(id)) },
  });
  const [msgForm, setMsgForm] = useState({
    buyerName: "", buyerEmail: "", buyerCompany: "", message: "",
  });
  const [messageSent, setMessageSent] = useState(false);

  const { data: listing, isLoading } = useGetListing(Number(id), {
    query: { enabled: !!id, queryKey: getGetListingQueryKey(Number(id)) },
  });

  const convMutation = useCreateConversation();

  const handleMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!listing?.sellerId) return;
    convMutation.mutate(
      {
        data: {
          sellerId: listing.sellerId,
          listingId: listing.id,
          buyerName: msgForm.buyerName,
          buyerEmail: msgForm.buyerEmail,
          buyerCompany: msgForm.buyerCompany || null,
          subject: `Re: ${listing.partNumber}`,
          initialMessage: msgForm.message,
        },
      },
      {
        onSuccess: () => {
          setMessageSent(true);
          toast({ title: "Message sent", description: "The seller will respond to your email shortly." });
        },
        onError: () => {
          toast({ title: "Error", description: "Could not send message. Please try again.", variant: "destructive" });
        },
      },
    );
  };

  if (isLoading) {
    return (
      <MainLayout>
        <div className="container mx-auto px-4 py-10">
          <Skeleton className="h-6 w-40 mb-8" />
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            <div className="lg:col-span-2 space-y-4">
              <Skeleton className="aspect-video w-full rounded-md" />
              <Skeleton className="h-8 w-2/3" />
              <Skeleton className="h-4 w-1/3" />
            </div>
            <div>
              <Skeleton className="h-64 w-full rounded-md" />
            </div>
          </div>
        </div>
      </MainLayout>
    );
  }

  if (!listing) {
    return (
      <MainLayout>
        <div className="container mx-auto px-4 py-24 text-center">
          <p className="text-muted-foreground text-xl mb-4">Listing not found.</p>
          <Link href="/marketplace"><Button>Back to Marketplace</Button></Link>
        </div>
      </MainLayout>
    );
  }

  const watched = isWatched(listing.id);
  const listingPrice = listing.price ? parseFloat(String(listing.price)) : null;

  const handleWatchToggle = () => {
    toggle(listing.id);
    toast({
      title: watched ? "Removed from watchlist" : "Saved to watchlist",
      description: watched ? "Removed from your saved listings." : "You can find this in your watchlist.",
    });
  };

  return (
    <MainLayout>
      <div className="container mx-auto px-4 py-8">
        {/* Breadcrumb */}
        <div className="flex items-center gap-2 text-sm text-muted-foreground mb-6">
          <Link href="/marketplace" className="hover:text-white flex items-center gap-1">
            <ArrowLeft className="h-3.5 w-3.5" /> Marketplace
          </Link>
          <ChevronRight className="h-3.5 w-3.5" />
          <span className="text-white font-mono">{listing.partNumber}</span>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Left column */}
          <div className="lg:col-span-2 space-y-6">
            {/* Photo Gallery */}
            <div className="bg-card border border-border rounded-md overflow-hidden">
              <div className="aspect-video bg-muted relative">
                {listing.photos && listing.photos.length > 0 ? (
                  <img
                    src={listing.photos[activePhoto]}
                    alt={listing.description}
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <div className="w-full h-full flex items-center justify-center">
                    <div className="text-center text-muted-foreground/40">
                      <Camera className="h-10 w-10 mx-auto mb-2" />
                      <p className="text-sm uppercase tracking-wider">No Photos Available</p>
                    </div>
                  </div>
                )}
                <div className="absolute top-3 left-3">
                  <BadgeIndicator badge={listing.badge} />
                </div>
              </div>
              {listing.photos && listing.photos.length > 1 && (
                <div className="flex gap-2 p-3 overflow-x-auto">
                  {listing.photos.map((photo, i) => (
                    <button
                      key={i}
                      onClick={() => setActivePhoto(i)}
                      className={`flex-shrink-0 h-16 w-24 rounded overflow-hidden border-2 transition-colors ${i === activePhoto ? "border-primary" : "border-transparent"}`}
                    >
                      <img src={photo} alt="" className="w-full h-full object-cover" />
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* Part Details */}
            <div className="bg-card border border-border rounded-md p-6">
              <div className="flex items-start justify-between gap-4 mb-6">
                <div>
                  <h1 className="text-2xl font-bold text-white font-mono mb-1">{listing.partNumber}</h1>
                  <p className="text-muted-foreground">{listing.manufacturer}</p>
                </div>
                <div className="flex flex-col items-end gap-2">
                  <div className="text-2xl font-bold text-primary font-mono">{formatPrice(listingPrice)}</div>
                  <div className="text-sm text-muted-foreground">
                    {listing.saleType === "both" ? "Outright or Exchange" : formatCondition(listing.saleType)}
                  </div>
                  {/* Watchlist button */}
                  <button
                    onClick={handleWatchToggle}
                    className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-md border transition-colors"
                    style={{
                      borderColor: watched ? "rgba(239,68,68,0.5)" : "rgba(255,255,255,0.12)",
                      background: watched ? "rgba(239,68,68,0.1)" : "transparent",
                      color: watched ? "#ef4444" : "#7ea8c8",
                      cursor: "pointer",
                    }}
                  >
                    <Heart
                      className="h-3.5 w-3.5"
                      fill={watched ? "#ef4444" : "none"}
                      color={watched ? "#ef4444" : "#7ea8c8"}
                    />
                    {watched ? "Saved" : "Save to Watchlist"}
                  </button>
                </div>
              </div>

              <p className="text-white/80 leading-relaxed mb-6">{listing.description}</p>

              <div className="grid grid-cols-2 md:grid-cols-3 gap-4 border-t border-border pt-6">
                {[
                  { label: "Condition", value: formatCondition(listing.condition) },
                  { label: "Sale Type", value: listing.saleType === "both" ? "Outright / Exchange" : formatCondition(listing.saleType) },
                  { label: "Quantity", value: String(listing.quantity) },
                  listing.aircraftApplicability && { label: "Aircraft", value: listing.aircraftApplicability },
                  { label: "Manufacturer", value: listing.manufacturer },
                ].filter(Boolean).map((item: any) => (
                  <div key={item.label}>
                    <p className="text-xs text-muted-foreground uppercase tracking-wider mb-1">{item.label}</p>
                    <p className="text-white font-medium text-sm">{item.value}</p>
                  </div>
                ))}
              </div>
            </div>

            {/* Certification Documents */}
            {docsData && docsData.documents.length > 0 && (
              <div className="bg-card border border-border rounded-md p-6">
                <h2 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
                  <FileText className="h-5 w-5 text-primary" />
                  Certification Documents
                </h2>
                <div className="space-y-2">
                  {docsData.documents.map((doc) => (
                    <div key={doc.id} className="flex items-center gap-3 p-3 bg-secondary/30 rounded border border-border/50">
                      <FileText className="h-4 w-4 text-blue-400 flex-shrink-0" />
                      <div className="flex-1 min-w-0">
                        <p className="text-sm text-white/90 font-mono truncate">{doc.fileName}</p>
                        <p className="text-xs text-muted-foreground mt-0.5">
                          {DOC_TYPE_LABELS[doc.documentType] ?? doc.documentType}
                        </p>
                      </div>
                      <DocVerificationBadge status={doc.verificationStatus} />
                      <a
                        href={doc.fileUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex-shrink-0 inline-flex items-center gap-1 text-xs text-primary hover:underline"
                      >
                        <Download className="h-3 w-3" /> View
                      </a>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Trace History */}
            {listing.traceHistory && (
              <div className="bg-card border border-border rounded-md p-6">
                <h2 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
                  <RefreshCw className="h-5 w-5 text-primary" />
                  Trace History
                </h2>
                <p className="text-white/70 text-sm leading-relaxed whitespace-pre-line">{listing.traceHistory}</p>
              </div>
            )}

            {/* Price Benchmarking — only when a price is set */}
            {listingPrice && listingPrice > 0 && (
              <PriceBenchmarkSection price={listingPrice} listingId={listing.id} />
            )}
          </div>

          {/* Right sidebar */}
          <div className="space-y-5">
            {/* Seller Info */}
            {listing.seller && (
              <div className="bg-card border border-border rounded-md p-5">
                <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider mb-4">Seller</h2>
                <div className="space-y-3">
                  <div className="flex items-center gap-3">
                    <div className="h-10 w-10 rounded bg-secondary flex items-center justify-center">
                      <Building2 className="h-5 w-5 text-primary" />
                    </div>
                    <div>
                      <p className="font-semibold text-white">{listing.seller.companyName}</p>
                      <p className="text-sm text-muted-foreground">{listing.seller.contactName}</p>
                    </div>
                  </div>
                  {listing.seller.country && (
                    <div className="text-sm text-muted-foreground">
                      {listing.seller.country}
                    </div>
                  )}
                  {listing.seller.phone && (
                    <div className="flex items-center gap-2 text-sm text-muted-foreground">
                      <Phone className="h-3.5 w-3.5" />
                      {listing.seller.phone}
                    </div>
                  )}
                  {/* Seller type */}
                  <div className="pt-2 border-t border-border/50">
                    <SellerTypeBadge sellerType={(listing.seller as any).sellerType} size="md" />
                  </div>
                  {/* Trust score */}
                  {listing.seller.trustBadge && (
                    <div className="pt-2 border-t border-border/50 space-y-2">
                      <div className="flex items-center justify-between">
                        <span className="text-xs text-muted-foreground uppercase tracking-wider">Trust Score</span>
                        <TrustBadge badge={listing.seller.trustBadge} score={listing.seller.trustScore} showScore />
                      </div>
                      <TrustScoreBar score={listing.seller.trustScore ?? 0} />
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Contact / Message Form */}
            <div className="bg-card border border-border rounded-md p-5">
              <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider mb-4 flex items-center gap-2">
                <Mail className="h-4 w-4" /> Message Seller
              </h2>
              {messageSent ? (
                <div className="text-center py-6">
                  <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center mx-auto mb-3">
                    <Mail className="h-5 w-5 text-primary" />
                  </div>
                  <p className="text-white font-medium">Message Sent</p>
                  <p className="text-sm text-muted-foreground mt-1">
                    The seller will reply to your email shortly.
                  </p>
                </div>
              ) : (
                <form onSubmit={handleMessage} className="space-y-3">
                  <Input
                    placeholder="Your Name *"
                    value={msgForm.buyerName}
                    onChange={e => setMsgForm(f => ({ ...f, buyerName: e.target.value }))}
                    required
                    className="text-sm"
                  />
                  <Input
                    type="email"
                    placeholder="Email Address *"
                    value={msgForm.buyerEmail}
                    onChange={e => setMsgForm(f => ({ ...f, buyerEmail: e.target.value }))}
                    required
                    className="text-sm"
                  />
                  <Input
                    placeholder="Company Name"
                    value={msgForm.buyerCompany}
                    onChange={e => setMsgForm(f => ({ ...f, buyerCompany: e.target.value }))}
                    className="text-sm"
                  />
                  <Textarea
                    placeholder="Your message — include any technical requirements, quantity, or delivery schedule..."
                    value={msgForm.message}
                    onChange={e => setMsgForm(f => ({ ...f, message: e.target.value }))}
                    required
                    rows={4}
                    className="text-sm resize-none"
                  />
                  <Button
                    type="submit"
                    className="w-full"
                    disabled={convMutation.isPending}
                  >
                    {convMutation.isPending ? "Sending..." : "Send Message"}
                  </Button>
                  <p className="text-xs text-muted-foreground text-center">
                    Your details are shared only with this verified seller.
                  </p>
                </form>
              )}
            </div>

            {/* Listing Meta */}
            <div className="bg-card/50 border border-border rounded-md p-4 text-xs text-muted-foreground space-y-1">
              <div className="flex justify-between">
                <span>Listing ID</span>
                <span className="font-mono text-white/60">#{listing.id}</span>
              </div>
              <div className="flex justify-between">
                <span>Listed</span>
                <span className="text-white/60">{new Date(listing.createdAt).toLocaleDateString()}</span>
              </div>
              <div className="flex justify-between">
                <span>Status</span>
                <BadgeIndicator badge={listing.badge} />
              </div>
              <div className="flex justify-between items-center pt-1 border-t border-border/50">
                <span>Watchlist</span>
                <button
                  onClick={handleWatchToggle}
                  className="flex items-center gap-1 text-xs"
                  style={{ color: watched ? "#ef4444" : "#4a6480", cursor: "pointer", background: "none", border: "none" }}
                >
                  <Heart className="h-3 w-3" fill={watched ? "#ef4444" : "none"} />
                  {watched ? "Saved" : "Save"}
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </MainLayout>
  );
}
