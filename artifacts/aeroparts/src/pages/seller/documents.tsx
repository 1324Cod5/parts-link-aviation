import { useState, useRef } from "react";
import { Link } from "wouter";
import { useQueryClient } from "@tanstack/react-query";
import { MainLayout } from "@/components/layout/MainLayout";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { useAuth } from "@/context/AuthContext";
import { useToast } from "@/hooks/use-toast";
import {
  useGetSellerCertDocuments,
  getGetSellerCertDocumentsQueryKey,
  useLinkCertDocumentToListings,
  useGetSellerListings,
  getGetSellerListingsQueryKey,
  type CertDocument,
} from "@workspace/api-client-react";
import {
  FileCheck2,
  Upload,
  Link2,
  AlertTriangle,
  ExternalLink,
  X,
  ChevronLeft,
  FileText,
  CheckCheck,
} from "lucide-react";

const DOC_TYPES = [
  "8130-3",
  "EASA Form 1",
  "CoC",
  "Teardown",
  "Surplus Release",
  "None",
] as const;

function DocTypeBadge({ type }: { type: string }) {
  const colors: Record<string, string> = {
    "8130-3": "bg-emerald-500/15 text-emerald-400 border-emerald-500/30",
    "EASA Form 1": "bg-blue-500/15 text-blue-400 border-blue-500/30",
    CoC: "bg-violet-500/15 text-violet-400 border-violet-500/30",
    Teardown: "bg-amber-500/15 text-amber-400 border-amber-500/30",
    "Surplus Release": "bg-cyan-500/15 text-cyan-400 border-cyan-500/30",
    None: "bg-secondary text-muted-foreground border-border",
  };
  return (
    <span
      className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-mono font-semibold border ${colors[type] ?? "bg-secondary text-muted-foreground border-border"}`}
    >
      {type}
    </span>
  );
}

function UploadDialog({
  onClose,
  onUploaded,
}: {
  onClose: () => void;
  onUploaded: () => void;
}) {
  const { toast } = useToast();
  const fileRef = useRef<HTMLInputElement>(null);
  const [file, setFile] = useState<File | null>(null);
  const [docType, setDocType] = useState<string>("8130-3");
  const [issuingAuthority, setIssuingAuthority] = useState("");
  const [docDate, setDocDate] = useState("");
  const [aircraftApplicability, setAircraftApplicability] = useState("");
  const [uploading, setUploading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!file) {
      toast({ title: "No file selected", description: "Please choose a PDF file.", variant: "destructive" });
      return;
    }
    setUploading(true);
    try {
      const fd = new FormData();
      fd.append("file", file);
      fd.append("docType", docType);
      if (issuingAuthority) fd.append("issuingAuthority", issuingAuthority);
      if (docDate) fd.append("docDate", docDate);
      if (aircraftApplicability) fd.append("aircraftApplicability", aircraftApplicability);

      const resp = await fetch("/api/seller/cert-documents", {
        method: "POST",
        credentials: "include",
        body: fd,
      });

      if (!resp.ok) {
        const err = await resp.json().catch(() => ({ error: "Upload failed" }));
        throw new Error((err as any).error ?? "Upload failed");
      }

      toast({ title: "Document uploaded", description: `${file.name} added to your library.` });
      onUploaded();
      onClose();
    } catch (err: any) {
      toast({ title: "Upload failed", description: err.message ?? "Unknown error", variant: "destructive" });
    } finally {
      setUploading(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
      <div className="bg-card border border-border rounded-md w-full max-w-lg shadow-2xl">
        <div className="flex items-center justify-between p-5 border-b border-border">
          <div className="flex items-center gap-2">
            <Upload className="h-4 w-4 text-primary" />
            <h2 className="font-semibold text-white">Upload Certification Document</h2>
          </div>
          <button onClick={onClose} className="text-muted-foreground hover:text-white transition-colors">
            <X className="h-4 w-4" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-5 space-y-4">
          <div>
            <label className="block text-xs font-medium text-muted-foreground uppercase tracking-wider mb-1.5">
              Document Type <span className="text-red-400">*</span>
            </label>
            <select
              value={docType}
              onChange={e => setDocType(e.target.value)}
              className="w-full h-9 px-3 text-sm bg-secondary/50 border border-border rounded text-white focus:outline-none focus:ring-1 focus:ring-primary"
            >
              {DOC_TYPES.map(t => (
                <option key={t} value={t}>{t}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-xs font-medium text-muted-foreground uppercase tracking-wider mb-1.5">
              PDF File <span className="text-red-400">*</span>
            </label>
            <div
              className="border border-dashed border-border rounded p-6 text-center cursor-pointer hover:border-primary/50 transition-colors"
              onClick={() => fileRef.current?.click()}
            >
              <input
                ref={fileRef}
                type="file"
                accept=".pdf,application/pdf"
                className="hidden"
                onChange={e => setFile(e.target.files?.[0] ?? null)}
              />
              {file ? (
                <div className="flex items-center justify-center gap-2 text-sm text-white">
                  <FileText className="h-4 w-4 text-primary" />
                  <span className="font-mono truncate max-w-xs">{file.name}</span>
                </div>
              ) : (
                <div>
                  <Upload className="h-6 w-6 text-muted-foreground/40 mx-auto mb-2" />
                  <p className="text-sm text-muted-foreground">Click to browse — PDF only, max 10 MB</p>
                </div>
              )}
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-muted-foreground uppercase tracking-wider mb-1.5">
                Issuing Authority
              </label>
              <input
                type="text"
                value={issuingAuthority}
                onChange={e => setIssuingAuthority(e.target.value)}
                placeholder="FAA, EASA, CAA…"
                className="w-full h-9 px-3 text-sm bg-secondary/50 border border-border rounded text-white placeholder:text-muted-foreground/50 focus:outline-none focus:ring-1 focus:ring-primary"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-muted-foreground uppercase tracking-wider mb-1.5">
                Document Date
              </label>
              <input
                type="date"
                value={docDate}
                onChange={e => setDocDate(e.target.value)}
                className="w-full h-9 px-3 text-sm bg-secondary/50 border border-border rounded text-white focus:outline-none focus:ring-1 focus:ring-primary [color-scheme:dark]"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-medium text-muted-foreground uppercase tracking-wider mb-1.5">
              Aircraft Applicability
            </label>
            <input
              type="text"
              value={aircraftApplicability}
              onChange={e => setAircraftApplicability(e.target.value)}
              placeholder="e.g. B737, A320, CFM56-7B"
              className="w-full h-9 px-3 text-sm bg-secondary/50 border border-border rounded text-white placeholder:text-muted-foreground/50 focus:outline-none focus:ring-1 focus:ring-primary"
            />
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <Button type="button" variant="outline" size="sm" onClick={onClose} className="text-xs">
              Cancel
            </Button>
            <Button type="submit" size="sm" disabled={uploading} className="text-xs gap-1.5">
              {uploading ? (
                <><span className="inline-block h-3 w-3 border-2 border-white border-t-transparent rounded-full animate-spin" /> Uploading…</>
              ) : (
                <><Upload className="h-3 w-3" /> Upload Document</>
              )}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}

function LinkListingsDialog({
  doc,
  onClose,
}: {
  doc: CertDocument;
  onClose: () => void;
}) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { data: listingsData, isLoading: listingsLoading } = useGetSellerListings({
    query: { queryKey: getGetSellerListingsQueryKey() },
  });
  const listings = listingsData ?? [];

  const linkMutation = useLinkCertDocumentToListings();

  const [selected, setSelected] = useState<Set<number>>(new Set());
  const [saving, setSaving] = useState(false);

  function toggle(id: number) {
    setSelected(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  async function handleSave() {
    setSaving(true);
    try {
      await linkMutation.mutateAsync({
        id: doc.id,
        data: { listingIds: Array.from(selected) },
      });
      await queryClient.invalidateQueries({ queryKey: getGetSellerCertDocumentsQueryKey() });
      toast({ title: "Listings linked", description: `${selected.size} listing(s) linked to this document.` });
      onClose();
    } catch {
      toast({ title: "Failed to link listings", variant: "destructive" });
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
      <div className="bg-card border border-border rounded-md w-full max-w-lg shadow-2xl flex flex-col max-h-[80vh]">
        <div className="flex items-center justify-between p-5 border-b border-border flex-shrink-0">
          <div>
            <div className="flex items-center gap-2">
              <Link2 className="h-4 w-4 text-primary" />
              <h2 className="font-semibold text-white">Link to Listings</h2>
            </div>
            <p className="text-xs text-muted-foreground mt-0.5 font-mono">{doc.originalFilename}</p>
          </div>
          <button onClick={onClose} className="text-muted-foreground hover:text-white transition-colors">
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-5">
          {listingsLoading ? (
            <div className="space-y-2">
              {[1, 2, 3].map(i => <Skeleton key={i} className="h-12 w-full" />)}
            </div>
          ) : listings.length === 0 ? (
            <div className="text-center py-8">
              <p className="text-muted-foreground text-sm">No listings found. Create a listing first.</p>
            </div>
          ) : (
            <div className="space-y-2">
              <p className="text-xs text-muted-foreground mb-3">Select the listings this document applies to:</p>
              {listings.map((listing: any) => {
                const checked = selected.has(listing.id);
                return (
                  <button
                    key={listing.id}
                    onClick={() => toggle(listing.id)}
                    className={`w-full text-left p-3 rounded border transition-colors flex items-center gap-3 ${
                      checked
                        ? "border-primary/60 bg-primary/10"
                        : "border-border hover:border-border/80 hover:bg-secondary/30"
                    }`}
                  >
                    <div className={`h-4 w-4 rounded border flex items-center justify-center flex-shrink-0 transition-colors ${
                      checked ? "bg-primary border-primary" : "border-muted-foreground/40"
                    }`}>
                      {checked && <CheckCheck className="h-3 w-3 text-white" />}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="text-sm font-mono text-white truncate">{listing.partNumber}</div>
                      <div className="text-xs text-muted-foreground truncate">{listing.description}</div>
                    </div>
                    <span className="text-xs text-muted-foreground flex-shrink-0">{listing.condition}</span>
                  </button>
                );
              })}
            </div>
          )}
        </div>

        <div className="flex justify-between items-center p-5 border-t border-border flex-shrink-0">
          <span className="text-xs text-muted-foreground">{selected.size} selected</span>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={onClose} className="text-xs">
              Cancel
            </Button>
            <Button size="sm" onClick={handleSave} disabled={saving} className="text-xs gap-1.5">
              {saving ? (
                <><span className="inline-block h-3 w-3 border-2 border-white border-t-transparent rounded-full animate-spin" /> Saving…</>
              ) : (
                <><Link2 className="h-3 w-3" /> Save Links</>
              )}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function SellerDocumentsPage() {
  const { user, isLoading: authLoading } = useAuth();
  const queryClient = useQueryClient();
  const [showUpload, setShowUpload] = useState(false);
  const [linkingDoc, setLinkingDoc] = useState<CertDocument | null>(null);

  const { data, isLoading } = useGetSellerCertDocuments({
    query: { queryKey: getGetSellerCertDocumentsQueryKey(), enabled: !!user },
  });
  const documents = data?.documents ?? [];

  function handleUploaded() {
    queryClient.invalidateQueries({ queryKey: getGetSellerCertDocumentsQueryKey() });
  }

  if (authLoading) {
    return (
      <MainLayout>
        <div className="container mx-auto px-4 py-16 text-center text-muted-foreground">
          <div className="inline-block w-6 h-6 border-2 border-primary border-t-transparent rounded-full animate-spin mb-3" />
        </div>
      </MainLayout>
    );
  }

  if (!user) {
    return (
      <MainLayout>
        <div className="container mx-auto px-4 py-16 text-center">
          <p className="text-muted-foreground mb-4">You must be signed in to access this page.</p>
          <Link href="/seller/login"><Button>Sign In</Button></Link>
        </div>
      </MainLayout>
    );
  }

  return (
    <MainLayout>
      <div className="container mx-auto px-4 py-8">

        {/* Header */}
        <div className="flex items-center gap-3 mb-1">
          <Link href="/seller/dashboard" className="text-muted-foreground hover:text-white transition-colors">
            <ChevronLeft className="h-4 w-4" />
          </Link>
          <h1 className="text-2xl font-bold text-white">Document Library</h1>
        </div>
        <p className="text-muted-foreground text-sm mb-8 pl-7">
          Upload FAA 8130-3s, EASA Form 1s, Certificates of Conformance, and other airworthiness documents.
          Link them to your listings to increase buyer confidence.
        </p>

        {/* Info banner */}
        <div className="mb-6 rounded-md border border-primary/20 bg-primary/5 p-4 flex items-start gap-3">
          <FileCheck2 className="h-5 w-5 text-primary flex-shrink-0 mt-0.5" />
          <div>
            <p className="text-sm font-semibold text-white">Certification documents raise your Trust Score</p>
            <p className="text-xs text-muted-foreground mt-0.5">
              Listings with linked airworthiness certificates appear higher in search results and display a
              verification badge visible to buyers.
            </p>
          </div>
        </div>

        {/* Main card */}
        <div className="bg-card border border-border rounded-md">
          <div className="p-5 border-b border-border flex items-center justify-between gap-3">
            <div>
              <h2 className="font-semibold text-white text-sm">Your Documents</h2>
              <p className="text-xs text-muted-foreground mt-0.5">{documents.length} document{documents.length !== 1 ? "s" : ""} in library</p>
            </div>
            <Button size="sm" onClick={() => setShowUpload(true)} className="gap-1.5 text-xs h-8">
              <Upload className="h-3.5 w-3.5" /> Upload Document
            </Button>
          </div>

          {isLoading ? (
            <div className="p-5 space-y-3">
              {[1, 2, 3].map(i => <Skeleton key={i} className="h-16 w-full" />)}
            </div>
          ) : documents.length === 0 ? (
            <div className="p-16 text-center">
              <FileCheck2 className="h-10 w-10 text-muted-foreground/20 mx-auto mb-3" />
              <p className="text-muted-foreground mb-2">No documents yet.</p>
              <p className="text-xs text-muted-foreground/60 mb-6">
                Upload your first airworthiness certificate or conformance document to get started.
              </p>
              <Button size="sm" onClick={() => setShowUpload(true)} className="gap-1.5 text-xs">
                <Upload className="h-3.5 w-3.5" /> Upload Your First Document
              </Button>
            </div>
          ) : (
            <div className="divide-y divide-border">
              {documents.map(doc => (
                <div key={doc.id} className={`p-4 flex items-center gap-4 flex-wrap ${doc.flagged ? "bg-red-950/20" : ""}`}>
                  {/* Icon */}
                  <div className="h-10 w-10 rounded-md bg-primary/10 flex items-center justify-center flex-shrink-0">
                    <FileText className="h-5 w-5 text-primary" />
                  </div>

                  {/* Info */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1 flex-wrap">
                      <DocTypeBadge type={doc.docType} />
                      {doc.flagged && (
                        <span className="inline-flex items-center gap-1 text-xs text-red-400 bg-red-500/10 border border-red-500/30 rounded px-1.5 py-0.5">
                          <AlertTriangle className="h-3 w-3" /> Flagged
                        </span>
                      )}
                    </div>
                    <p className="text-sm text-white font-mono truncate">{doc.originalFilename}</p>
                    <div className="flex items-center gap-3 mt-0.5 flex-wrap">
                      {doc.issuingAuthority && (
                        <span className="text-xs text-muted-foreground">{doc.issuingAuthority}</span>
                      )}
                      {doc.docDate && (
                        <span className="text-xs text-muted-foreground">{doc.docDate}</span>
                      )}
                      {doc.aircraftApplicability && (
                        <span className="text-xs text-muted-foreground font-mono">{doc.aircraftApplicability}</span>
                      )}
                      <span className="text-xs text-muted-foreground">
                        Uploaded {new Date(doc.createdAt).toLocaleDateString()}
                      </span>
                    </div>
                  </div>

                  {/* Linked listings badge */}
                  <div className="flex-shrink-0 text-center hidden sm:block">
                    <p className="text-xl font-bold font-mono text-white">{doc.linkedListings}</p>
                    <p className="text-xs text-muted-foreground">listing{doc.linkedListings !== 1 ? "s" : ""}</p>
                  </div>

                  {/* Actions */}
                  <div className="flex items-center gap-2 flex-shrink-0">
                    <a
                      href={`/api${doc.fileUrl}`}
                      target="_blank"
                      rel="noopener noreferrer"
                    >
                      <Button variant="outline" size="sm" className="h-8 text-xs gap-1.5 border-border text-muted-foreground hover:text-white">
                        <ExternalLink className="h-3 w-3" /> View
                      </Button>
                    </a>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setLinkingDoc(doc)}
                      className="h-8 text-xs gap-1.5 border-primary/30 text-primary hover:bg-primary/10"
                    >
                      <Link2 className="h-3 w-3" /> Link Listings
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* How it works */}
        <div className="mt-8 bg-card border border-border rounded-md p-5">
          <h3 className="text-sm font-semibold text-white mb-4">How Certification Documents Work</h3>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {[
              {
                step: "1",
                title: "Upload",
                desc: "Add your airworthiness certificate, CoC, 8130-3, or teardown report as a PDF.",
              },
              {
                step: "2",
                title: "Link",
                desc: "Attach the document to one or more of your listings so buyers can see it.",
              },
              {
                step: "3",
                title: "Verified Badge",
                desc: "Admin review promotes your badge from Pending → Docs Reviewed → Verified.",
              },
            ].map(item => (
              <div key={item.step} className="flex gap-3">
                <div className="h-7 w-7 rounded-full bg-primary/20 flex items-center justify-center flex-shrink-0 text-xs font-bold text-primary">
                  {item.step}
                </div>
                <div>
                  <p className="text-sm font-semibold text-white">{item.title}</p>
                  <p className="text-xs text-muted-foreground mt-0.5">{item.desc}</p>
                </div>
              </div>
            ))}
          </div>
        </div>

      </div>

      {showUpload && (
        <UploadDialog
          onClose={() => setShowUpload(false)}
          onUploaded={handleUploaded}
        />
      )}

      {linkingDoc && (
        <LinkListingsDialog
          doc={linkingDoc}
          onClose={() => setLinkingDoc(null)}
        />
      )}
    </MainLayout>
  );
}
