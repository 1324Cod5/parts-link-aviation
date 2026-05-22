import { useState } from "react";
import { Link, useParams } from "wouter";
import { useGetRfq, useCreateRfqResponse, useGetSellerListings, useCloseRfq, useGetSubscription } from "@workspace/api-client-react";
import { useAuth } from "@/context/AuthContext";
import { Navbar } from "@/components/layout/Navbar";
import { Footer } from "@/components/layout/Footer";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import {
  ArrowLeft, Clock, Package, Building2, Plane, Phone, Mail,
  CheckCircle2, MessageSquare, Lock, Send, AlertCircle, Rocket, AlertTriangle
} from "lucide-react";

function timeAgo(dateStr: string) {
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 60) return `${mins} minute${mins !== 1 ? "s" : ""} ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours} hour${hours !== 1 ? "s" : ""} ago`;
  const days = Math.floor(hours / 24);
  return `${days} day${days !== 1 ? "s" : ""} ago`;
}

function formatDate(dateStr: string) {
  return new Date(dateStr).toLocaleDateString("en-US", {
    year: "numeric", month: "long", day: "numeric",
    hour: "2-digit", minute: "2-digit",
  });
}

type UrgencyLevel = "aog" | "urgent" | "routine";

const URGENCY_META: Record<UrgencyLevel, { label: string; badgeClass: string; show: boolean }> = {
  aog: {
    label: "AOG",
    badgeClass: "bg-red-500/20 text-red-400 border-red-500/40",
    show: true,
  },
  urgent: {
    label: "URGENT",
    badgeClass: "bg-amber-500/20 text-amber-400 border-amber-500/30",
    show: true,
  },
  routine: {
    label: "ROUTINE",
    badgeClass: "bg-muted text-muted-foreground border-border",
    show: false,
  },
};

export default function RfqDetailPage() {
  const params = useParams<{ id: string }>();
  const id = parseInt(params.id);
  const { user } = useAuth();
  const { toast } = useToast();

  // Fetch fresh subscription status so plan checks aren't stale from login time
  const { data: subscription } = useGetSubscription({
    query: { enabled: !!user && user.role === "seller", retry: false },
  });
  const subscriptionStatus = (subscription as any)?.subscriptionStatus as string | undefined;
  const isSubscriptionActive =
    !subscriptionStatus ||
    subscriptionStatus === "active" ||
    subscriptionStatus === "trial" ||
    subscriptionStatus === "past_due";
  // Effective plan: revert to "free" if subscription has lapsed
  const effectivePlan =
    isSubscriptionActive ? (user?.plan ?? "free") : "free";
  const isFreeSeller = user?.role === "seller" && !["pro", "enterprise", "mro_premium"].includes(effectivePlan);
  const isPaidSeller = user?.role === "seller" && ["pro", "enterprise", "mro_premium"].includes(effectivePlan);

  const { data, isLoading, refetch } = useGetRfq(id);
  const { data: sellerListings } = useGetSellerListings({ query: { enabled: !!user && user.role === "seller" && !isFreeSeller, queryKey: ["seller-listings-rfq"] } });

  const [message, setMessage] = useState("");
  const [listingId, setListingId] = useState<string>("");

  const { mutate: respond, isPending: isResponding } = useCreateRfqResponse({
    mutation: {
      onSuccess() {
        toast({ title: "Response submitted", description: "Your quote has been sent to the buyer." });
        setMessage("");
        setListingId("");
        refetch();
      },
      onError() {
        toast({ title: "Failed to submit", description: "Please try again.", variant: "destructive" });
      },
    },
  });

  const { mutate: closeRfq, isPending: isClosing } = useCloseRfq({
    mutation: {
      onSuccess() {
        toast({ title: "RFQ closed", description: "This RFQ is now marked as closed." });
        refetch();
      },
    },
  });

  function handleRespond(e: React.FormEvent) {
    e.preventDefault();
    if (!message.trim()) return;
    respond({
      id,
      data: {
        message: message.trim(),
        listingId: listingId && listingId !== "none" ? parseInt(listingId) : null,
      },
    });
  }

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background flex flex-col">
        <Navbar />
        <main className="flex-1 container mx-auto px-4 py-12">
          <div className="max-w-3xl mx-auto space-y-4">
            <div className="h-8 w-48 bg-card/50 rounded animate-pulse" />
            <div className="h-48 bg-card/50 rounded-lg animate-pulse" />
            <div className="h-32 bg-card/50 rounded-lg animate-pulse" />
          </div>
        </main>
        <Footer />
      </div>
    );
  }

  if (!data) {
    return (
      <div className="min-h-screen bg-background flex flex-col">
        <Navbar />
        <main className="flex-1 container mx-auto px-4 py-20 text-center">
          <AlertCircle className="w-12 h-12 mx-auto mb-4 text-muted-foreground opacity-30" />
          <p className="text-muted-foreground">RFQ not found.</p>
          <Link href="/rfqs"><Button className="mt-4">Back to RFQ Board</Button></Link>
        </main>
        <Footer />
      </div>
    );
  }

  const { rfq, responses } = data;
  const urgency = ((rfq as any).urgency ?? "routine") as UrgencyLevel;
  const urgencyReason = (rfq as any).urgencyReason as string | null;
  const urgencyMeta = URGENCY_META[urgency];
  const isAog = urgency === "aog";
  const isOpen = rfq.status === "open";

  return (
    <div className="min-h-screen bg-background flex flex-col">
      <Navbar />
      <main className="flex-1">
        {/* AOG Banner — shown above everything when AOG */}
        {isAog && isOpen && (
          <div className="bg-red-500/10 border-b border-red-500/30">
            <div className="container mx-auto px-4 py-3 max-w-3xl flex items-center gap-3">
              <AlertTriangle className="w-4 h-4 text-red-400 flex-shrink-0 animate-pulse" />
              <div className="flex-1 min-w-0">
                <span className="text-sm font-semibold text-red-400 mr-2">AIRCRAFT ON GROUND</span>
                <span className="text-sm text-red-400/80">Immediate response required · Highest escalation priority</span>
                {urgencyReason && (
                  <p className="text-xs text-red-400/70 mt-0.5 truncate">{urgencyReason}</p>
                )}
              </div>
            </div>
          </div>
        )}

        <div className="border-b border-border bg-card/30 py-8">
          <div className="container mx-auto px-4 max-w-3xl">
            <Link href="/rfqs" className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-white mb-4">
              <ArrowLeft className="w-4 h-4" />
              Back to RFQ Board
            </Link>
            <div className="flex items-start justify-between gap-4">
              <div className="flex-1">
                <div className="flex items-center gap-2 flex-wrap mb-2">
                  <span className="font-mono text-lg font-bold text-primary">{rfq.partNumber}</span>
                  {/* Urgency badge */}
                  {urgencyMeta.show && (
                    <Badge
                      variant="outline"
                      className={`text-xs ${urgencyMeta.badgeClass} ${isAog ? "animate-pulse" : ""}`}
                    >
                      {isAog && <AlertTriangle className="w-3 h-3 mr-1 inline-block" />}
                      {urgencyMeta.label}
                    </Badge>
                  )}
                  <Badge className={isOpen
                    ? "bg-emerald-500/20 text-emerald-400 border-emerald-500/30"
                    : "bg-muted text-muted-foreground"}>
                    {rfq.status.toUpperCase()}
                  </Badge>
                </div>
                {/* Description — gated for free sellers */}
                {isFreeSeller ? (
                  <div className="relative">
                    <p className="text-white text-base leading-relaxed line-clamp-2 blur-[3px] select-none pointer-events-none">
                      {rfq.description}
                    </p>
                    <div className="absolute inset-0 flex items-center justify-center">
                      <span className="inline-flex items-center gap-1.5 text-xs text-amber-400 bg-background/90 border border-amber-500/30 rounded px-2.5 py-1">
                        <Lock className="w-3 h-3" />
                        Full notes visible on paid plans
                      </span>
                    </div>
                  </div>
                ) : (
                  <p className="text-white text-base leading-relaxed">{rfq.description}</p>
                )}
              </div>
              {user?.role === "admin" && isOpen && (
                <Button variant="outline" size="sm" onClick={() => closeRfq({ id })} disabled={isClosing}
                  className="border-border text-muted-foreground hover:text-white flex-shrink-0">
                  {isClosing ? "Closing…" : "Close RFQ"}
                </Button>
              )}
            </div>
          </div>
        </div>

        <div className="container mx-auto px-4 py-8 max-w-3xl">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            {/* Main column */}
            <div className="lg:col-span-2 space-y-8">
              {/* Responses */}
              <div>
                <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-widest mb-4 flex items-center gap-2">
                  <MessageSquare className="w-4 h-4" />
                  {responses.length} Response{responses.length !== 1 ? "s" : ""}
                </h2>

                {responses.length === 0 ? (
                  <div className="border border-border rounded-lg p-8 bg-card/30 text-center">
                    <MessageSquare className="w-8 h-8 mx-auto mb-3 text-muted-foreground opacity-30" />
                    <p className="text-muted-foreground text-sm">No responses yet.</p>
                    {isPaidSeller && isOpen && (
                      <p className="text-sm text-muted-foreground mt-1">Be the first to respond with your inventory.</p>
                    )}
                  </div>
                ) : (
                  <div className="space-y-3">
                    {responses.map(r => (
                      <div key={r.id} className="border border-border rounded-lg p-5 bg-card">
                        <div className="flex items-start justify-between mb-3">
                          <div>
                            <span className="font-semibold text-white text-sm">{r.sellerCompanyName}</span>
                            <div className="flex items-center gap-1.5 mt-0.5">
                              <CheckCircle2 className="w-3 h-3 text-primary" />
                              <span className="text-xs text-muted-foreground">Verified Seller</span>
                            </div>
                          </div>
                          <span className="text-xs text-muted-foreground">{timeAgo(r.createdAt)}</span>
                        </div>
                        <p className="text-sm text-foreground leading-relaxed">{r.message}</p>
                        {r.listingId && r.listingPartNumber && (
                          <Link href={`/listings/${r.listingId}`}>
                            <div className="mt-3 inline-flex items-center gap-2 text-xs text-primary border border-primary/30 rounded px-2.5 py-1 hover:bg-primary/10 transition-colors">
                              <Package className="w-3 h-3" />
                              View listing: {r.listingPartNumber}
                            </div>
                          </Link>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Response form — gated by plan */}
              {isPaidSeller && isOpen ? (
                <div className="border border-border rounded-lg p-6 bg-card">
                  <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-widest mb-4 flex items-center gap-2">
                    <Send className="w-4 h-4" />
                    Submit Your Quote
                  </h2>
                  <form onSubmit={handleRespond} className="space-y-4">
                    <div className="space-y-1.5">
                      <Label htmlFor="message">Your Response <span className="text-destructive">*</span></Label>
                      <Textarea
                        id="message"
                        value={message}
                        onChange={e => setMessage(e.target.value)}
                        placeholder={isAog
                          ? "AOG situation — include part availability, certification, and earliest ship time…"
                          : "Describe your available inventory, pricing, condition, certification, lead time…"
                        }
                        required
                        rows={5}
                        className="bg-background border-border resize-none"
                      />
                    </div>
                    <div className="space-y-1.5">
                      <Label htmlFor="listing">Link to a Listing (optional)</Label>
                      <Select value={listingId} onValueChange={setListingId}>
                        <SelectTrigger className="bg-background border-border">
                          <SelectValue placeholder="Select a listing to attach" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="none">No listing</SelectItem>
                          {sellerListings?.map(l => (
                            <SelectItem key={l.id} value={String(l.id)}>
                              {l.partNumber} — {l.description?.slice(0, 40)}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <Button type="submit" disabled={isResponding || !message.trim()}
                      className={`gap-2 ${isAog ? "bg-red-600 hover:bg-red-700" : "bg-primary hover:bg-primary/90"}`}>
                      <Send className="w-4 h-4" />
                      {isResponding ? "Submitting…" : isAog ? "Respond to AOG Request" : "Submit Quote"}
                    </Button>
                  </form>
                </div>
              ) : isFreeSeller && isOpen ? (
                /* Free seller upgrade prompt */
                <div className="border border-amber-500/25 rounded-lg p-6 bg-amber-500/5">
                  <div className="flex items-start gap-4">
                    <div className="w-10 h-10 rounded-full bg-amber-500/15 flex items-center justify-center flex-shrink-0">
                      <Lock className="w-5 h-5 text-amber-400" />
                    </div>
                    <div className="flex-1">
                      <h3 className="font-semibold text-white mb-1">Upgrade to unlock full RFQ access</h3>
                      <p className="text-sm text-muted-foreground mb-4 leading-relaxed">
                        Free accounts can browse RFQs but cannot view buyer contact details, full notes, or submit quotes.
                        Upgrade to Pro or Enterprise to respond directly to buyers.
                      </p>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-4 text-sm">
                        <div className="border border-border rounded p-3 bg-card/50">
                          <div className="font-medium text-white mb-1.5">Pro — $149/mo</div>
                          <ul className="space-y-1 text-muted-foreground text-xs">
                            <li className="flex items-center gap-1.5"><CheckCircle2 className="w-3 h-3 text-emerald-400" /> Full buyer details</li>
                            <li className="flex items-center gap-1.5"><CheckCircle2 className="w-3 h-3 text-emerald-400" /> Respond to RFQs</li>
                            <li className="flex items-center gap-1.5"><CheckCircle2 className="w-3 h-3 text-emerald-400" /> 50 active listings</li>
                          </ul>
                        </div>
                        <div className="border border-primary/30 rounded p-3 bg-primary/5">
                          <div className="font-medium text-white mb-1.5">Enterprise — $299/mo</div>
                          <ul className="space-y-1 text-muted-foreground text-xs">
                            <li className="flex items-center gap-1.5"><CheckCircle2 className="w-3 h-3 text-emerald-400" /> Everything in Pro</li>
                            <li className="flex items-center gap-1.5"><CheckCircle2 className="w-3 h-3 text-emerald-400" /> Unlimited listings</li>
                            <li className="flex items-center gap-1.5"><CheckCircle2 className="w-3 h-3 text-emerald-400" /> Dedicated support</li>
                          </ul>
                        </div>
                      </div>
                      <Link href="/pricing">
                        <Button className="bg-primary hover:bg-primary/90 gap-2">
                          <Rocket className="w-4 h-4" />
                          View Upgrade Options
                        </Button>
                      </Link>
                    </div>
                  </div>
                </div>
              ) : !user ? (
                <div className="border border-border rounded-lg p-6 bg-card/30 text-center">
                  <Lock className="w-8 h-8 mx-auto mb-3 text-muted-foreground opacity-40" />
                  <p className="text-muted-foreground text-sm mb-3">Sign in as a seller to respond to this RFQ.</p>
                  <Link href="/seller/login">
                    <Button size="sm" className="gap-2">Sign In to Respond</Button>
                  </Link>
                </div>
              ) : !isOpen ? (
                <div className="border border-border rounded-lg p-6 bg-card/30 text-center">
                  <Lock className="w-8 h-8 mx-auto mb-3 text-muted-foreground opacity-40" />
                  <p className="text-muted-foreground text-sm">This RFQ has been closed.</p>
                </div>
              ) : null}
            </div>

            {/* Sidebar */}
            <div className="space-y-4">
              {/* Urgency card — only shown for non-routine */}
              {urgency !== "routine" && (
                <div className={`border rounded-lg p-5 ${isAog ? "border-red-500/40 bg-red-500/5" : "border-border bg-card"}`}>
                  <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-widest mb-3">Request Urgency</h3>
                  <div className={`inline-flex items-center gap-1.5 rounded px-2.5 py-1.5 text-sm font-semibold border ${urgencyMeta.badgeClass} ${isAog ? "animate-pulse" : ""}`}>
                    {isAog && <AlertTriangle className="w-3.5 h-3.5" />}
                    {urgencyMeta.label}
                  </div>
                  {urgencyReason && (
                    <p className={`text-xs mt-2 leading-relaxed ${isAog ? "text-red-400/80" : "text-muted-foreground"}`}>
                      {urgencyReason}
                    </p>
                  )}
                </div>
              )}

              <div className="border border-border rounded-lg p-5 bg-card">
                <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-widest mb-4">RFQ Details</h3>
                <dl className="space-y-3 text-sm">
                  <div>
                    <dt className="text-muted-foreground text-xs mb-0.5">Part Number</dt>
                    <dd className="font-mono font-semibold text-primary">{rfq.partNumber}</dd>
                  </div>
                  <div>
                    <dt className="text-muted-foreground text-xs mb-0.5">Quantity</dt>
                    <dd className="text-white font-medium">{rfq.quantity}</dd>
                  </div>
                  {rfq.condition && (
                    <div>
                      <dt className="text-muted-foreground text-xs mb-0.5">Condition</dt>
                      <dd className="text-white">{rfq.condition}</dd>
                    </div>
                  )}
                  {rfq.aircraftApplicability && (
                    <div>
                      <dt className="text-muted-foreground text-xs mb-0.5">Aircraft</dt>
                      <dd className="text-white flex items-center gap-1.5">
                        <Plane className="w-3 h-3 text-muted-foreground" />
                        {rfq.aircraftApplicability}
                      </dd>
                    </div>
                  )}
                  <div>
                    <dt className="text-muted-foreground text-xs mb-0.5">Posted</dt>
                    <dd className="text-white flex items-center gap-1.5">
                      <Clock className="w-3 h-3 text-muted-foreground" />
                      {formatDate(rfq.createdAt)}
                    </dd>
                  </div>
                </dl>
              </div>

              {/* Buyer info — gated for free sellers */}
              <div className="border border-border rounded-lg p-5 bg-card">
                <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-widest mb-4">Buyer</h3>
                {isFreeSeller ? (
                  <div className="space-y-3">
                    {/* Blurred placeholders */}
                    <div className="flex items-center gap-2">
                      <Building2 className="w-4 h-4 text-muted-foreground/40 flex-shrink-0" />
                      <span className="text-sm text-white blur-[6px] select-none pointer-events-none">Company Name Ltd</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <Mail className="w-4 h-4 text-muted-foreground/40 flex-shrink-0" />
                      <span className="text-sm text-primary blur-[6px] select-none pointer-events-none">buyer@company.com</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <Phone className="w-4 h-4 text-muted-foreground/40 flex-shrink-0" />
                      <span className="text-sm text-muted-foreground blur-[6px] select-none pointer-events-none">+1 555 000 0000</span>
                    </div>
                    <div className="pt-2 border-t border-border">
                      <p className="text-xs text-amber-400/80 flex items-center gap-1.5 mb-2">
                        <Lock className="w-3 h-3" />
                        Buyer details locked on free plan
                      </p>
                      <Link href="/pricing">
                        <Button size="sm" variant="outline" className="w-full text-xs border-amber-500/40 text-amber-400 hover:bg-amber-500/10 hover:text-amber-300">
                          Upgrade to unlock
                        </Button>
                      </Link>
                    </div>
                  </div>
                ) : (
                  <dl className="space-y-3 text-sm">
                    {rfq.buyerCompany && (
                      <div className="flex items-center gap-2 text-white">
                        <Building2 className="w-4 h-4 text-muted-foreground flex-shrink-0" />
                        <span className="font-medium">{rfq.buyerCompany}</span>
                      </div>
                    )}
                    <div className="flex items-center gap-2">
                      <Mail className="w-4 h-4 text-muted-foreground flex-shrink-0" />
                      <a href={`mailto:${rfq.buyerEmail}`} className="text-primary hover:underline truncate">
                        {rfq.buyerEmail}
                      </a>
                    </div>
                    {rfq.buyerPhone && (
                      <div className="flex items-center gap-2 text-muted-foreground">
                        <Phone className="w-4 h-4 flex-shrink-0" />
                        <span>{rfq.buyerPhone}</span>
                      </div>
                    )}
                  </dl>
                )}
              </div>
            </div>
          </div>
        </div>
      </main>
      <Footer />
    </div>
  );
}
