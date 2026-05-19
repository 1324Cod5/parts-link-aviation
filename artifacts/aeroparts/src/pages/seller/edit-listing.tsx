import { useState, useEffect, useRef } from "react";
import { Link, useLocation, useParams } from "wouter";
import { MainLayout } from "@/components/layout/MainLayout";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import {
  useGetListing, getGetListingQueryKey,
  useGetListingDocuments, getGetListingDocumentsQueryKey,
  useUpdateListing, getGetSellerListingsQueryKey,
  type DocumentInputDocumentType,
} from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import { Plus, Trash2, ArrowLeft, Loader2, AlertCircle, X, FileUp, FileText, CheckCircle2, ImagePlus } from "lucide-react";

const MAX_PHOTOS = 5;
const MAX_DOCS = 10;
const ACCEPTED_IMAGE_TYPES = "image/jpeg,image/png,image/webp,image/gif,image/avif";
const ACCEPTED_DOC_TYPES = ".pdf,.docx,.jpg,.jpeg,.png";

const DOC_TYPE_LABELS: Record<string, string> = {
  faa_8130_3: "FAA Form 8130-3",
  easa_form_1: "EASA Form 1",
  tcca_form_1: "TCCA Form 1",
  overhaul_report: "Overhaul Report",
  test_report: "Test Report",
  coa: "Certificate of Conformance",
  other: "Other",
};

interface DocEntry {
  id: string;
  fileName: string;
  documentType: string;
  fileUrl: string | null;
  uploading: boolean;
  error: boolean;
  existing?: boolean;
  verificationStatus?: string;
}

interface PhotoEntry {
  objectUrl: string;
  serverUrl: string | null;
  uploading: boolean;
  error: boolean;
  existing?: boolean;
}

export default function EditListing() {
  const { id } = useParams<{ id: string }>();
  const [, navigate] = useLocation();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const updateListing = useUpdateListing();
  const photoInputRef = useRef<HTMLInputElement>(null);
  const docInputRef = useRef<HTMLInputElement>(null);

  const [form, setForm] = useState({
    partNumber: "", description: "", aircraftApplicability: "", manufacturer: "",
    condition: "serviceable" as any, saleType: "outright" as any,
    quantity: 1, price: "" as string | number, traceHistory: "",
  });
  const [photoEntries, setPhotoEntries] = useState<PhotoEntry[]>([]);
  const [docEntries, setDocEntries] = useState<DocEntry[]>([]);
  const [initialized, setInitialized] = useState(false);

  const { data: listing, isLoading } = useGetListing(Number(id), {
    query: { enabled: !!id, queryKey: getGetListingQueryKey(Number(id)) },
  });

  const { data: docsData } = useGetListingDocuments(Number(id), {
    query: { enabled: !!id && !initialized, queryKey: getGetListingDocumentsQueryKey(Number(id)) },
  });

  useEffect(() => {
    if (listing && !initialized) {
      setForm({
        partNumber: listing.partNumber,
        description: listing.description,
        aircraftApplicability: listing.aircraftApplicability ?? "",
        manufacturer: listing.manufacturer,
        condition: listing.condition,
        saleType: listing.saleType,
        quantity: listing.quantity,
        price: listing.price ?? "",
        traceHistory: listing.traceHistory ?? "",
      });
      setPhotoEntries(
        (listing.photos ?? []).map((url) => ({
          objectUrl: url,
          serverUrl: url,
          uploading: false,
          error: false,
          existing: true,
        })),
      );
    }
  }, [listing, initialized]);

  useEffect(() => {
    if (docsData && listing && !initialized) {
      setDocEntries(
        (docsData.documents ?? []).map((doc) => ({
          id: String(doc.id),
          fileName: doc.fileName,
          documentType: doc.documentType,
          fileUrl: doc.fileUrl,
          uploading: false,
          error: false,
          existing: true,
          verificationStatus: doc.verificationStatus,
        })),
      );
      setInitialized(true);
    } else if (listing && !docsData && !initialized) {
      setInitialized(true);
    }
  }, [docsData, listing, initialized]);

  // ─── Photo upload ─────────────────────────────────────────────────────────

  const handlePhotoSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files ?? []);
    if (files.length === 0) return;
    const remaining = MAX_PHOTOS - photoEntries.length;
    const toAdd = files.slice(0, remaining);
    const newEntries: PhotoEntry[] = toAdd.map((f) => ({
      objectUrl: URL.createObjectURL(f),
      serverUrl: null,
      uploading: true,
      error: false,
    }));
    setPhotoEntries((prev) => [...prev, ...newEntries]);

    const formData = new FormData();
    toAdd.forEach((f) => formData.append("images", f));
    try {
      const res = await fetch("/api/upload", { method: "POST", body: formData, credentials: "include" });
      if (!res.ok) throw new Error((await res.json().catch(() => ({}))).error ?? "Upload failed");
      const { urls }: { urls: string[] } = await res.json();
      setPhotoEntries((prev) =>
        prev.map((entry) => {
          const idx = newEntries.findIndex((n) => n.objectUrl === entry.objectUrl);
          if (idx !== -1 && urls[idx]) return { ...entry, serverUrl: urls[idx], uploading: false };
          return entry;
        }),
      );
    } catch (err: any) {
      toast({ title: "Upload failed", description: err?.message, variant: "destructive" });
      setPhotoEntries((prev) =>
        prev.map((e) => newEntries.some((n) => n.objectUrl === e.objectUrl) ? { ...e, uploading: false, error: true } : e),
      );
    }
    if (photoInputRef.current) photoInputRef.current.value = "";
  };

  const removePhoto = (i: number) => {
    setPhotoEntries((prev) => {
      const updated = [...prev];
      if (!updated[i].existing) URL.revokeObjectURL(updated[i].objectUrl);
      return updated.filter((_, idx) => idx !== i);
    });
  };

  // ─── Document upload ──────────────────────────────────────────────────────

  const handleDocSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files ?? []);
    if (files.length === 0) return;
    const remaining = MAX_DOCS - docEntries.length;
    const toAdd = files.slice(0, remaining);
    const newEntries: DocEntry[] = toAdd.map((f) => ({
      id: `new-${Date.now()}-${Math.random()}`,
      fileName: f.name,
      documentType: "other",
      fileUrl: null,
      uploading: true,
      error: false,
    }));
    setDocEntries((prev) => [...prev, ...newEntries]);

    const formData = new FormData();
    toAdd.forEach((f) => formData.append("files", f));
    try {
      const res = await fetch("/api/upload-documents", { method: "POST", body: formData, credentials: "include" });
      if (!res.ok) throw new Error((await res.json().catch(() => ({}))).error ?? "Upload failed");
      const { documents }: { documents: { fileName: string; fileUrl: string }[] } = await res.json();
      setDocEntries((prev) =>
        prev.map((entry) => {
          const idx = newEntries.findIndex((n) => n.id === entry.id);
          if (idx !== -1 && documents[idx]) return { ...entry, fileUrl: documents[idx].fileUrl, uploading: false };
          return entry;
        }),
      );
    } catch (err: any) {
      toast({ title: "Upload failed", description: err?.message, variant: "destructive" });
      setDocEntries((prev) =>
        prev.map((e) => newEntries.some((n) => n.id === e.id) ? { ...e, uploading: false, error: true } : e),
      );
    }
    if (docInputRef.current) docInputRef.current.value = "";
  };

  const removeDoc = (id: string) => setDocEntries((prev) => prev.filter((d) => d.id !== id));
  const updateDocType = (id: string, documentType: string) =>
    setDocEntries((prev) => prev.map((d) => (d.id === id ? { ...d, documentType } : d)));

  // ─── Submit ───────────────────────────────────────────────────────────────

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (photoEntries.some((p) => p.uploading) || docEntries.some((d) => d.uploading)) {
      toast({ title: "Please wait", description: "Files are still uploading.", variant: "destructive" });
      return;
    }

    const photos = photoEntries.filter((p) => p.serverUrl && !p.error).map((p) => p.serverUrl!);
    const documents = docEntries
      .filter((d) => d.fileUrl && !d.error)
      .map((d) => ({ fileName: d.fileName, documentType: d.documentType as DocumentInputDocumentType, fileUrl: d.fileUrl! }));

    updateListing.mutate(
      {
        id: Number(id),
        data: {
          ...form,
          price: form.price !== "" ? Number(form.price) : null,
          certificationDocs: [],
          photos,
          documents,
          aircraftApplicability: form.aircraftApplicability || null,
          traceHistory: form.traceHistory || null,
        },
      },
      {
        onSuccess: () => {
          queryClient.invalidateQueries({ queryKey: getGetListingQueryKey(Number(id)) });
          queryClient.invalidateQueries({ queryKey: getGetSellerListingsQueryKey() });
          toast({ title: "Listing updated", description: "Changes saved successfully." });
          navigate("/seller/dashboard");
        },
        onError: () => {
          toast({ title: "Error", description: "Could not update listing.", variant: "destructive" });
        },
      },
    );
  };

  if (isLoading) {
    return (
      <MainLayout>
        <div className="container mx-auto px-4 py-8 max-w-3xl">
          <Skeleton className="h-6 w-32 mb-6" />
          <Skeleton className="h-96 w-full rounded-md" />
        </div>
      </MainLayout>
    );
  }

  const canAddMorePhotos = photoEntries.length < MAX_PHOTOS;
  const canAddMoreDocs = docEntries.length < MAX_DOCS;
  const anyUploading = photoEntries.some((p) => p.uploading) || docEntries.some((d) => d.uploading);

  const verificationColor = (status?: string) => {
    if (status === "approved") return "text-emerald-400";
    if (status === "rejected") return "text-red-400";
    return "text-amber-400";
  };

  return (
    <MainLayout>
      <div className="container mx-auto px-4 py-8 max-w-3xl">
        <div className="mb-6">
          <Link href="/seller/dashboard">
            <Button variant="ghost" size="sm" className="text-muted-foreground">
              <ArrowLeft className="h-4 w-4 mr-1" /> Dashboard
            </Button>
          </Link>
        </div>

        <div className="bg-card border border-border rounded-md p-8">
          <h1 className="text-2xl font-bold text-white mb-6">Edit Listing</h1>

          <form onSubmit={handleSubmit} className="space-y-6">
            <div className="space-y-4">
              <h2 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider border-b border-border pb-2">Part Identification</h2>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-1.5 block">Part Number *</label>
                  <Input value={form.partNumber} onChange={e => setForm(f => ({ ...f, partNumber: e.target.value }))} required className="font-mono" />
                </div>
                <div>
                  <label className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-1.5 block">Manufacturer *</label>
                  <Input value={form.manufacturer} onChange={e => setForm(f => ({ ...f, manufacturer: e.target.value }))} required />
                </div>
              </div>
              <div>
                <label className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-1.5 block">Description *</label>
                <Textarea value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} required rows={3} className="resize-none" />
              </div>
              <div>
                <label className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-1.5 block">Aircraft Applicability</label>
                <Input value={form.aircraftApplicability} onChange={e => setForm(f => ({ ...f, aircraftApplicability: e.target.value }))} />
              </div>
            </div>

            <div className="space-y-4">
              <h2 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider border-b border-border pb-2">Condition & Sale</h2>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div>
                  <label className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-1.5 block">Condition</label>
                  <Select value={form.condition} onValueChange={v => setForm(f => ({ ...f, condition: v }))}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="new">New</SelectItem>
                      <SelectItem value="overhauled">Overhauled</SelectItem>
                      <SelectItem value="serviceable">Serviceable</SelectItem>
                      <SelectItem value="as_removed">As Removed</SelectItem>
                      <SelectItem value="repaired">Repaired</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <label className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-1.5 block">Sale Type</label>
                  <Select value={form.saleType} onValueChange={v => setForm(f => ({ ...f, saleType: v }))}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="outright">Outright</SelectItem>
                      <SelectItem value="exchange">Exchange</SelectItem>
                      <SelectItem value="both">Both</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <label className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-1.5 block">Quantity</label>
                  <Input type="number" min={1} value={form.quantity} onChange={e => setForm(f => ({ ...f, quantity: parseInt(e.target.value) || 1 }))} />
                </div>
                <div>
                  <label className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-1.5 block">Price (USD)</label>
                  <Input type="number" min={0} step="0.01" value={form.price} onChange={e => setForm(f => ({ ...f, price: e.target.value }))} placeholder="Leave blank for POA" />
                </div>
              </div>
            </div>

            {/* Certification Documents */}
            <div className="space-y-4">
              <h2 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider border-b border-border pb-2">Certification Documents</h2>
              <p className="text-xs text-muted-foreground">
                Upload up to {MAX_DOCS} certification documents. Accepted: PDF, DOCX, JPG, PNG.
                Adding new documents will replace all existing ones on save.
              </p>

              {docEntries.length > 0 && (
                <div className="space-y-2">
                  {docEntries.map((doc) => (
                    <div key={doc.id} className="flex items-center gap-3 p-3 border border-border rounded-lg bg-secondary/10">
                      <div className="flex-shrink-0">
                        {doc.uploading ? (
                          <Loader2 className="h-4 w-4 text-muted-foreground animate-spin" />
                        ) : doc.error ? (
                          <AlertCircle className="h-4 w-4 text-destructive" />
                        ) : (
                          <CheckCircle2 className="h-4 w-4 text-emerald-400" />
                        )}
                      </div>
                      <FileText className="h-4 w-4 text-blue-400 flex-shrink-0" />
                      <span className="text-sm text-white/80 truncate flex-1 font-mono text-xs">{doc.fileName}</span>
                      {doc.verificationStatus && (
                        <span className={`text-xs font-medium ${verificationColor(doc.verificationStatus)}`}>
                          {doc.verificationStatus}
                        </span>
                      )}
                      {!doc.uploading && !doc.error && (
                        <Select value={doc.documentType} onValueChange={(v) => updateDocType(doc.id, v)}>
                          <SelectTrigger className="w-44 h-7 text-xs">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            {Object.entries(DOC_TYPE_LABELS).map(([val, label]) => (
                              <SelectItem key={val} value={val} className="text-xs">{label}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      )}
                      {doc.error && <span className="text-xs text-destructive">Upload failed</span>}
                      <button
                        type="button"
                        onClick={() => removeDoc(doc.id)}
                        className="flex-shrink-0 h-6 w-6 rounded flex items-center justify-center text-muted-foreground hover:text-destructive transition-colors"
                      >
                        <X className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  ))}
                </div>
              )}

              {canAddMoreDocs && (
                <>
                  <input ref={docInputRef} type="file" accept={ACCEPTED_DOC_TYPES} multiple className="hidden" onChange={handleDocSelect} />
                  <Button type="button" variant="outline" size="sm" onClick={() => docInputRef.current?.click()} className="text-xs gap-1.5" disabled={docEntries.some(d => d.uploading)}>
                    {docEntries.some(d => d.uploading)
                      ? <><Loader2 className="h-3.5 w-3.5 animate-spin" /> Uploading…</>
                      : <><FileUp className="h-3.5 w-3.5" /> Add Documents ({docEntries.length}/{MAX_DOCS})</>
                    }
                  </Button>
                </>
              )}
            </div>

            {/* Photos */}
            <div className="space-y-4">
              <h2 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider border-b border-border pb-2">Photos</h2>
              {photoEntries.length > 0 && (
                <div className="grid grid-cols-3 sm:grid-cols-5 gap-2">
                  {photoEntries.map((entry, i) => (
                    <div key={entry.objectUrl} className="relative aspect-square rounded border border-border overflow-hidden bg-muted/20 group">
                      <img src={entry.objectUrl} alt={`Photo ${i + 1}`} className={`w-full h-full object-cover ${entry.uploading || entry.error ? "opacity-40" : ""}`} />
                      {entry.uploading && <div className="absolute inset-0 flex items-center justify-center"><Loader2 className="h-5 w-5 text-white animate-spin" /></div>}
                      {entry.error && <div className="absolute inset-0 flex items-center justify-center"><AlertCircle className="h-4 w-4 text-destructive" /></div>}
                      {!entry.uploading && (
                        <button type="button" onClick={() => removePhoto(i)} className="absolute top-1 right-1 h-5 w-5 rounded-full bg-black/70 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                          <X className="h-3 w-3 text-white" />
                        </button>
                      )}
                    </div>
                  ))}
                </div>
              )}
              {canAddMorePhotos && (
                <>
                  <input ref={photoInputRef} type="file" accept={ACCEPTED_IMAGE_TYPES} multiple className="hidden" onChange={handlePhotoSelect} />
                  <Button type="button" variant="outline" size="sm" onClick={() => photoInputRef.current?.click()} className="text-xs gap-1.5" disabled={photoEntries.some(p => p.uploading)}>
                    <ImagePlus className="h-3.5 w-3.5" /> Add Photos ({photoEntries.length}/{MAX_PHOTOS})
                  </Button>
                </>
              )}
            </div>

            <div className="space-y-4">
              <h2 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider border-b border-border pb-2">Trace History</h2>
              <Textarea value={form.traceHistory} onChange={e => setForm(f => ({ ...f, traceHistory: e.target.value }))} rows={4} className="resize-none" />
            </div>

            <div className="flex gap-3 pt-2">
              <Button type="submit" className="flex-1" disabled={updateListing.isPending || anyUploading}>
                {updateListing.isPending ? "Saving..." : "Save Changes"}
              </Button>
              <Link href="/seller/dashboard">
                <Button type="button" variant="outline">Cancel</Button>
              </Link>
            </div>
          </form>
        </div>
      </div>
    </MainLayout>
  );
}
