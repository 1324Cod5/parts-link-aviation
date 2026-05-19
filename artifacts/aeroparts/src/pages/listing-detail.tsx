import { useState } from "react";
import { useParams, Link } from "wouter";
import { MainLayout } from "@/components/layout/MainLayout";
import { BadgeIndicator } from "@/components/ui/badge-indicator";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Skeleton } from "@/components/ui/skeleton";
import {
  useGetListing, getGetListingQueryKey, useCreateInquiry,
  useGetListingDocuments, getGetListingDocumentsQueryKey,
} from "@workspace/api-client-react";
import { useToast } from "@/hooks/use-toast";
import {
  ArrowLeft, FileText, Camera, Building2, Phone, Mail, Package, RefreshCw, ChevronRight,
  CheckCircle2, XCircle, Clock, Download,
} from "lucide-react";
import { TrustBadge, TrustScoreBar } from "@/components/ui/trust-badge";

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

export default function ListingDetail() {
  const { id } = useParams<{ id: string }>();
  const { toast } = useToast();
  const [activePhoto, setActivePhoto] = useState(0);

  const { data: docsData } = useGetListingDocuments(Number(id), {
    query: { enabled: !!id, queryKey: getGetListingDocumentsQueryKey(Number(id)) },
  });
  const [inquiryForm, setInquiryForm] = useState({
    buyerName: "", buyerEmail: "", buyerPhone: "", buyerCompany: "", message: ""
  });
  const [inquirySent, setInquirySent] = useState(false);

  const { data: listing, isLoading } = useGetListing(Number(id), {
    query: { enabled: !!id, queryKey: getGetListingQueryKey(Number(id)) },
  });

  const inquiryMutation = useCreateInquiry();

  const handleInquiry = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!listing) return;
    inquiryMutation.mutate(
      { id: listing.id, data: inquiryForm },
      {
        onSuccess: () => {
          setInquirySent(true);
          toast({ title: "Inquiry sent", description: "The seller will be in touch shortly." });
        },
        onError: () => {
          toast({ title: "Error", description: "Could not send inquiry. Please try again.", variant: "destructive" });
        },
      }
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
                <div className="text-right">
                  <div className="text-2xl font-bold text-primary font-mono">{formatPrice(listing.price)}</div>
                  <div className="text-sm text-muted-foreground mt-1">
                    {listing.saleType === "both" ? "Outright or Exchange" : formatCondition(listing.saleType)}
                  </div>
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

            {/* Contact Form */}
            <div className="bg-card border border-border rounded-md p-5">
              <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider mb-4 flex items-center gap-2">
                <Mail className="h-4 w-4" /> Contact Seller
              </h2>
              {inquirySent ? (
                <div className="text-center py-6">
                  <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center mx-auto mb-3">
                    <Mail className="h-5 w-5 text-primary" />
                  </div>
                  <p className="text-white font-medium">Inquiry Sent</p>
                  <p className="text-sm text-muted-foreground mt-1">The seller will contact you shortly.</p>
                </div>
              ) : (
                <form onSubmit={handleInquiry} className="space-y-3">
                  <Input
                    placeholder="Your Name *"
                    value={inquiryForm.buyerName}
                    onChange={e => setInquiryForm(f => ({ ...f, buyerName: e.target.value }))}
                    required
                    className="text-sm"
                  />
                  <Input
                    type="email"
                    placeholder="Email Address *"
                    value={inquiryForm.buyerEmail}
                    onChange={e => setInquiryForm(f => ({ ...f, buyerEmail: e.target.value }))}
                    required
                    className="text-sm"
                  />
                  <Input
                    placeholder="Phone Number"
                    value={inquiryForm.buyerPhone}
                    onChange={e => setInquiryForm(f => ({ ...f, buyerPhone: e.target.value }))}
                    className="text-sm"
                  />
                  <Input
                    placeholder="Company Name"
                    value={inquiryForm.buyerCompany}
                    onChange={e => setInquiryForm(f => ({ ...f, buyerCompany: e.target.value }))}
                    className="text-sm"
                  />
                  <Textarea
                    placeholder="Your message — include any technical requirements, quantity, or delivery schedule..."
                    value={inquiryForm.message}
                    onChange={e => setInquiryForm(f => ({ ...f, message: e.target.value }))}
                    required
                    rows={4}
                    className="text-sm resize-none"
                  />
                  <Button
                    type="submit"
                    className="w-full"
                    disabled={inquiryMutation.isPending}
                  >
                    {inquiryMutation.isPending ? "Sending..." : "Send Inquiry"}
                  </Button>
                  <p className="text-xs text-muted-foreground text-center">
                    Your contact details are shared only with this seller.
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
            </div>
          </div>
        </div>
      </div>
    </MainLayout>
  );
}
