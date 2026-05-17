import { useParams, useLocation, Link } from "wouter";
import { useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { BadgeIndicator } from "@/components/ui/badge-indicator";
import { useToast } from "@/hooks/use-toast";
import {
  useGetAdminListing,
  getGetAdminListingQueryKey,
  getGetAdminListingsQueryKey,
  useUpdateListingBadge,
} from "@workspace/api-client-react";
import {
  ArrowLeft, FileText, ExternalLink, AlertCircle, CheckCircle2,
  ShieldCheck, Building2, Package, Calendar,
} from "lucide-react";

function DocViewer({ url, index }: { url: string; index: number }) {
  const isImage = /\.(png|jpe?g|gif|webp|svg)(\?.*)?$/i.test(url);
  const isPdf = /\.pdf(\?.*)?$/i.test(url);
  const isHttp = /^https?:\/\//i.test(url);

  if (!isHttp) {
    return (
      <div className="border border-border rounded-lg p-4 bg-secondary/20">
        <div className="flex items-center gap-2 mb-2">
          <FileText className="w-4 h-4 text-muted-foreground" />
          <span className="text-sm font-medium text-white">Document {index + 1}</span>
        </div>
        <p className="text-sm text-muted-foreground font-mono break-all">{url}</p>
        <p className="text-xs text-amber-400 mt-2 flex items-center gap-1">
          <AlertCircle className="w-3 h-3" />
          Reference string — not a viewable URL
        </p>
      </div>
    );
  }

  if (isImage) {
    return (
      <div className="border border-border rounded-lg overflow-hidden bg-secondary/20">
        <div className="flex items-center justify-between px-4 py-2 border-b border-border">
          <span className="text-sm font-medium text-white flex items-center gap-2">
            <FileText className="w-4 h-4 text-muted-foreground" />
            Document {index + 1}
          </span>
          <a href={url} target="_blank" rel="noopener noreferrer"
            className="text-xs text-primary hover:underline flex items-center gap-1">
            Open <ExternalLink className="w-3 h-3" />
          </a>
        </div>
        <img
          src={url}
          alt={`Document ${index + 1}`}
          className="w-full max-h-96 object-contain bg-black/20"
          onError={e => {
            (e.currentTarget as HTMLImageElement).style.display = "none";
            (e.currentTarget.nextSibling as HTMLElement).style.display = "flex";
          }}
        />
        <div className="hidden items-center gap-2 p-4 text-sm text-muted-foreground">
          <AlertCircle className="w-4 h-4 text-amber-400" />
          Image could not be loaded.{" "}
          <a href={url} target="_blank" rel="noopener noreferrer" className="text-primary hover:underline">
            Open directly
          </a>
        </div>
      </div>
    );
  }

  if (isPdf) {
    return (
      <div className="border border-border rounded-lg overflow-hidden bg-secondary/20">
        <div className="flex items-center justify-between px-4 py-2 border-b border-border">
          <span className="text-sm font-medium text-white flex items-center gap-2">
            <FileText className="w-4 h-4 text-primary" />
            Document {index + 1} — PDF
          </span>
          <a href={url} target="_blank" rel="noopener noreferrer"
            className="text-xs text-primary hover:underline flex items-center gap-1">
            Open in tab <ExternalLink className="w-3 h-3" />
          </a>
        </div>
        <iframe
          src={url}
          title={`Document ${index + 1}`}
          className="w-full h-96 border-0"
        />
      </div>
    );
  }

  return (
    <div className="border border-border rounded-lg p-4 bg-secondary/20">
      <div className="flex items-center justify-between">
        <span className="text-sm font-medium text-white flex items-center gap-2">
          <FileText className="w-4 h-4 text-muted-foreground" />
          Document {index + 1}
        </span>
        <a href={url} target="_blank" rel="noopener noreferrer"
          className="inline-flex items-center gap-1.5 text-xs text-primary border border-primary/30 rounded px-2.5 py-1 hover:bg-primary/10 transition-colors">
          Open document <ExternalLink className="w-3 h-3" />
        </a>
      </div>
      <p className="text-xs text-muted-foreground font-mono mt-2 break-all">{url}</p>
    </div>
  );
}

export default function AdminCertReview() {
  const { id } = useParams<{ id: string }>();
  const [, navigate] = useLocation();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const listingId = Number(id);

  const { data: listing, isLoading, isError } = useGetAdminListing(listingId, {
    query: {
      enabled: !isNaN(listingId),
      queryKey: getGetAdminListingQueryKey(listingId),
    },
  });

  const badgeMutation = useUpdateListingBadge();

  function handleBadge(badge: "documentation_reviewed" | "verified") {
    if (!listing) return;
    badgeMutation.mutate({ id: listingId, data: { badge } }, {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: getGetAdminListingQueryKey(listingId) });
        queryClient.invalidateQueries({ queryKey: getGetAdminListingsQueryKey({ badge: "pending_verification" as any }) });
        toast({
          title: badge === "verified" ? "Listing fully verified" : "Documentation approved",
          description: listing.partNumber,
        });
        if (badge === "verified") navigate("/admin");
      },
      onError: () => {
        toast({ title: "Action failed", description: "Could not update badge.", variant: "destructive" });
      },
    });
  }

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background p-8">
        <div className="max-w-3xl mx-auto space-y-4">
          <Skeleton className="h-5 w-32" />
          <Skeleton className="h-8 w-64" />
          <Skeleton className="h-48 w-full rounded-lg" />
          <Skeleton className="h-48 w-full rounded-lg" />
        </div>
      </div>
    );
  }

  if (isError || !listing) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-8">
        <div className="text-center max-w-sm">
          <AlertCircle className="w-10 h-10 text-red-400 mx-auto mb-3" />
          <p className="text-white font-semibold mb-1">Listing not found</p>
          <p className="text-sm text-muted-foreground mb-4">
            This listing may have been removed or the ID is invalid.
          </p>
          <Link href="/admin">
            <Button variant="outline" size="sm">
              <ArrowLeft className="w-4 h-4 mr-1" /> Back to Admin
            </Button>
          </Link>
        </div>
      </div>
    );
  }

  const docs = listing.certificationDocs ?? [];
  const hasDocs = docs.length > 0 && docs.some(d => d.trim());

  return (
    <div className="min-h-screen bg-background">
      <div className="max-w-3xl mx-auto px-6 py-8 space-y-6">

        {/* Back nav */}
        <div>
          <Link href="/admin">
            <Button variant="ghost" size="sm" className="text-muted-foreground -ml-2">
              <ArrowLeft className="w-4 h-4 mr-1" /> Admin Dashboard
            </Button>
          </Link>
        </div>

        {/* Header */}
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div>
            <h1 className="text-xl font-bold text-white font-mono tracking-tight">
              {listing.partNumber}
            </h1>
            <p className="text-sm text-muted-foreground mt-0.5">{listing.description}</p>
          </div>
          <BadgeIndicator badge={listing.badge} />
        </div>

        {/* Listing metadata */}
        <div className="border border-border rounded-lg p-4 bg-card grid grid-cols-2 gap-3">
          <div className="flex items-center gap-2 text-sm">
            <Building2 className="w-4 h-4 text-muted-foreground flex-shrink-0" />
            <span className="text-muted-foreground">Seller:</span>
            <span className="text-white font-medium">{listing.seller?.companyName ?? "Unknown"}</span>
          </div>
          <div className="flex items-center gap-2 text-sm">
            <Package className="w-4 h-4 text-muted-foreground flex-shrink-0" />
            <span className="text-muted-foreground">Manufacturer:</span>
            <span className="text-white font-medium">{listing.manufacturer}</span>
          </div>
          <div className="flex items-center gap-2 text-sm">
            <Calendar className="w-4 h-4 text-muted-foreground flex-shrink-0" />
            <span className="text-muted-foreground">Submitted:</span>
            <span className="text-white font-medium">
              {new Date(listing.createdAt).toLocaleDateString("en-US", { year: "numeric", month: "short", day: "numeric" })}
            </span>
          </div>
          <div className="flex items-center gap-2 text-sm">
            <FileText className="w-4 h-4 text-muted-foreground flex-shrink-0" />
            <span className="text-muted-foreground">Documents:</span>
            <span className={hasDocs ? "text-emerald-400 font-medium" : "text-amber-400 font-medium"}>
              {hasDocs ? `${docs.filter(d => d.trim()).length} uploaded` : "None"}
            </span>
          </div>
        </div>

        {/* Documents section */}
        <div>
          <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider mb-3">
            Certification Documents
          </h2>

          {hasDocs ? (
            <div className="space-y-3">
              {docs.filter(d => d.trim()).map((doc, i) => (
                <DocViewer key={i} url={doc} index={i} />
              ))}
            </div>
          ) : (
            <div className="border border-border rounded-lg p-8 bg-card text-center">
              <AlertCircle className="w-8 h-8 text-amber-400 mx-auto mb-3 opacity-70" />
              <p className="text-white font-medium">No document uploaded</p>
              <p className="text-sm text-muted-foreground mt-1">
                The seller has not attached any certification documents to this listing.
              </p>
            </div>
          )}
        </div>

        {/* Trace history */}
        {listing.traceHistory && (
          <div>
            <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider mb-3">
              Trace History
            </h2>
            <div className="border border-border rounded-lg p-4 bg-card">
              <p className="text-sm text-muted-foreground whitespace-pre-wrap">{listing.traceHistory}</p>
            </div>
          </div>
        )}

        {/* Review actions */}
        <div className="border border-border rounded-lg p-5 bg-card">
          <h2 className="text-sm font-semibold text-white mb-1">Review Decision</h2>
          <p className="text-xs text-muted-foreground mb-4">
            Current status: <span className="text-white font-medium">{listing.badge.replace(/_/g, " ")}</span>
          </p>
          <div className="flex gap-3 flex-wrap">
            <Button
              size="sm"
              variant="outline"
              className="border-blue-500/30 text-blue-400 hover:bg-blue-500/10 gap-1.5"
              onClick={() => handleBadge("documentation_reviewed")}
              disabled={badgeMutation.isPending || listing.badge === "documentation_reviewed" || listing.badge === "verified"}
            >
              <CheckCircle2 className="w-4 h-4" />
              Approve Documentation
            </Button>
            <Button
              size="sm"
              variant="outline"
              className="border-emerald-500/30 text-emerald-400 hover:bg-emerald-500/10 gap-1.5"
              onClick={() => handleBadge("verified")}
              disabled={badgeMutation.isPending || listing.badge === "verified"}
            >
              <ShieldCheck className="w-4 h-4" />
              Full Verify
            </Button>
          </div>
          {!hasDocs && (
            <p className="text-xs text-amber-400 mt-3 flex items-center gap-1.5">
              <AlertCircle className="w-3 h-3" />
              No documents have been uploaded. You can still update the badge, but review manually before approving.
            </p>
          )}
        </div>

      </div>
    </div>
  );
}
