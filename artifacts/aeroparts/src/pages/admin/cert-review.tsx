import { useState } from "react";
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
  useGetListingDocuments,
  getGetListingDocumentsQueryKey,
  useUpdateDocumentStatus,
} from "@workspace/api-client-react";
import {
  ArrowLeft, FileText, ExternalLink, AlertCircle, CheckCircle2,
  ShieldCheck, Building2, Package, Calendar, XCircle, Clock, Download,
} from "lucide-react";

const DOC_TYPE_LABELS: Record<string, string> = {
  faa_8130_3: "FAA Form 8130-3",
  easa_form_1: "EASA Form 1",
  tcca_form_1: "TCCA Form 1",
  overhaul_report: "Overhaul Report",
  test_report: "Test Report",
  coa: "Certificate of Conformance",
  other: "Other",
};

function DocStatusBadge({ status }: { status: string }) {
  if (status === "approved") {
    return (
      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-medium bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
        <CheckCircle2 className="w-3 h-3" /> Approved
      </span>
    );
  }
  if (status === "rejected") {
    return (
      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-medium bg-red-500/10 text-red-400 border border-red-500/20">
        <XCircle className="w-3 h-3" /> Rejected
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-medium bg-amber-500/10 text-amber-400 border border-amber-500/20">
      <Clock className="w-3 h-3" /> Pending
    </span>
  );
}

function DocRow({ doc, listingId }: { doc: any; listingId: number }) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const updateStatus = useUpdateDocumentStatus();
  const [note, setNote] = useState(doc.reviewNote ?? "");

  const isPdf = /\.pdf(\?.*)?$/i.test(doc.fileUrl);
  const isImage = /\.(png|jpe?g)(\?.*)?$/i.test(doc.fileUrl);

  function handleUpdate(status: "approved" | "rejected") {
    updateStatus.mutate(
      { id: doc.id, data: { verificationStatus: status, reviewNote: note || null } },
      {
        onSuccess: () => {
          queryClient.invalidateQueries({ queryKey: ["getListingDocuments", listingId] });
          toast({
            title: status === "approved" ? "Document approved" : "Document rejected",
            description: doc.fileName,
          });
        },
        onError: () => {
          toast({ title: "Action failed", description: "Could not update document status.", variant: "destructive" });
        },
      },
    );
  }

  return (
    <div className="border border-border rounded-lg overflow-hidden bg-card">
      {/* Header */}
      <div className="flex items-center justify-between gap-3 px-4 py-3 border-b border-border flex-wrap">
        <div className="flex items-center gap-2 min-w-0">
          <FileText className="w-4 h-4 text-primary flex-shrink-0" />
          <span className="text-sm font-medium text-white font-mono truncate">{doc.fileName}</span>
        </div>
        <div className="flex items-center gap-2 flex-shrink-0">
          <DocStatusBadge status={doc.verificationStatus} />
          <span className="text-xs text-muted-foreground px-1.5 py-0.5 rounded bg-secondary/30 border border-border">
            {DOC_TYPE_LABELS[doc.documentType] ?? doc.documentType}
          </span>
          <a
            href={doc.fileUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1 text-xs text-primary hover:underline"
          >
            <Download className="w-3 h-3" /> Open
          </a>
        </div>
      </div>

      {/* Preview */}
      {isImage && (
        <img
          src={doc.fileUrl}
          alt={doc.fileName}
          className="w-full max-h-64 object-contain bg-black/20"
          onError={(e) => { (e.currentTarget as HTMLImageElement).style.display = "none"; }}
        />
      )}
      {isPdf && (
        <iframe
          src={doc.fileUrl}
          title={doc.fileName}
          className="w-full h-64 border-0 bg-black/10"
        />
      )}

      {/* Review note + actions */}
      <div className="px-4 py-3 space-y-3">
        <div>
          <label className="text-xs text-muted-foreground mb-1 block">Review note (optional)</label>
          <input
            type="text"
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder="Add a note for the seller..."
            className="w-full bg-secondary/20 border border-border rounded px-3 py-1.5 text-sm text-white placeholder:text-muted-foreground/50 focus:outline-none focus:border-primary/50"
          />
        </div>
        <div className="flex gap-2">
          <Button
            size="sm"
            variant="outline"
            className="border-emerald-500/30 text-emerald-400 hover:bg-emerald-500/10 gap-1.5"
            onClick={() => handleUpdate("approved")}
            disabled={updateStatus.isPending || doc.verificationStatus === "approved"}
          >
            <CheckCircle2 className="w-3.5 h-3.5" /> Approve
          </Button>
          <Button
            size="sm"
            variant="outline"
            className="border-red-500/30 text-red-400 hover:bg-red-500/10 gap-1.5"
            onClick={() => handleUpdate("rejected")}
            disabled={updateStatus.isPending || doc.verificationStatus === "rejected"}
          >
            <XCircle className="w-3.5 h-3.5" /> Reject
          </Button>
        </div>
      </div>
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

  const { data: docsData, isLoading: docsLoading } = useGetListingDocuments(listingId, {
    query: { enabled: !isNaN(listingId), queryKey: getGetListingDocumentsQueryKey(listingId) },
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

  const docs = docsData?.documents ?? [];
  const hasDocs = docs.length > 0;
  const approvedCount = docs.filter((d) => d.verificationStatus === "approved").length;
  const rejectedCount = docs.filter((d) => d.verificationStatus === "rejected").length;
  const pendingCount = docs.filter((d) => d.verificationStatus === "pending").length;

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
            {hasDocs ? (
              <span className="text-white font-medium">
                {docs.length} total
                {approvedCount > 0 && <span className="text-emerald-400 ml-1">· {approvedCount} approved</span>}
                {rejectedCount > 0 && <span className="text-red-400 ml-1">· {rejectedCount} rejected</span>}
                {pendingCount > 0 && <span className="text-amber-400 ml-1">· {pendingCount} pending</span>}
              </span>
            ) : (
              <span className="text-amber-400 font-medium">None uploaded</span>
            )}
          </div>
        </div>

        {/* Documents section */}
        <div>
          <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider mb-3">
            Certification Documents
          </h2>

          {docsLoading ? (
            <div className="space-y-3">
              <Skeleton className="h-32 w-full rounded-lg" />
              <Skeleton className="h-32 w-full rounded-lg" />
            </div>
          ) : hasDocs ? (
            <div className="space-y-4">
              {docs.map((doc) => (
                <DocRow key={doc.id} doc={doc} listingId={listingId} />
              ))}
            </div>
          ) : (
            <div className="border border-border rounded-lg p-8 bg-card text-center">
              <AlertCircle className="w-8 h-8 text-amber-400 mx-auto mb-3 opacity-70" />
              <p className="text-white font-medium">No documents uploaded</p>
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

        {/* Overall badge review */}
        <div className="border border-border rounded-lg p-5 bg-card">
          <h2 className="text-sm font-semibold text-white mb-1">Overall Listing Decision</h2>
          <p className="text-xs text-muted-foreground mb-4">
            Current badge: <span className="text-white font-medium">{listing.badge.replace(/_/g, " ")}</span>.
            {hasDocs && pendingCount === 0 && approvedCount > 0 && (
              <span className="text-emerald-400 ml-1">All documents reviewed.</span>
            )}
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
              No documents uploaded. Review manually before approving.
            </p>
          )}
        </div>

      </div>
    </div>
  );
}
