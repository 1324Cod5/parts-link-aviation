import { useState, useRef } from "react";
import { Link, useLocation } from "wouter";
import { MainLayout } from "@/components/layout/MainLayout";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useCreateListing, getGetSellerListingsQueryKey, getGetSellerStatsQueryKey } from "@workspace/api-client-react";
import { useAuth } from "@/context/AuthContext";
import { useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import { Plus, Trash2, ArrowLeft, Zap, ImagePlus, Loader2, AlertCircle, X } from "lucide-react";

const MAX_PHOTOS = 5;
const ACCEPTED_TYPES = "image/jpeg,image/png,image/webp,image/gif,image/avif";

interface PhotoEntry {
  objectUrl: string;
  serverUrl: string | null;
  uploading: boolean;
  error: boolean;
}

interface LimitError {
  plan: string;
  activeListings: number;
  listingLimit: number;
}

export default function NewListing() {
  const { user, isLoading: authLoading } = useAuth();
  const [, navigate] = useLocation();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const createListing = useCreateListing();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [limitError, setLimitError] = useState<LimitError | null>(null);
  const [photoEntries, setPhotoEntries] = useState<PhotoEntry[]>([]);

  const [form, setForm] = useState({
    partNumber: "",
    description: "",
    aircraftApplicability: "",
    manufacturer: "",
    condition: "serviceable" as any,
    saleType: "outright" as any,
    quantity: 1,
    price: "" as string | number,
    certificationDocs: [""],
    traceHistory: "",
  });

  // ─── Photo upload ────────────────────────────────────────────────────────────

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files ?? []);
    if (files.length === 0) return;

    const remaining = MAX_PHOTOS - photoEntries.length;
    if (remaining <= 0) {
      toast({ title: "Photo limit reached", description: `Maximum ${MAX_PHOTOS} photos per listing.`, variant: "destructive" });
      return;
    }

    const toAdd = files.slice(0, remaining);
    if (files.length > remaining) {
      toast({ description: `Only ${remaining} slot(s) remaining — added first ${remaining}.` });
    }

    // Create preview entries immediately
    const newEntries: PhotoEntry[] = toAdd.map((f) => ({
      objectUrl: URL.createObjectURL(f),
      serverUrl: null,
      uploading: true,
      error: false,
    }));
    setPhotoEntries((prev) => [...prev, ...newEntries]);

    // Upload to server
    const formData = new FormData();
    toAdd.forEach((f) => formData.append("images", f));

    try {
      const res = await fetch("/api/upload", {
        method: "POST",
        body: formData,
        credentials: "include",
      });

      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error ?? "Upload failed");
      }

      const { urls }: { urls: string[] } = await res.json();

      // Match back by objectUrl and fill in server URLs
      setPhotoEntries((prev) =>
        prev.map((entry) => {
          const batchIdx = newEntries.findIndex((n) => n.objectUrl === entry.objectUrl);
          if (batchIdx !== -1 && urls[batchIdx]) {
            return { ...entry, serverUrl: urls[batchIdx], uploading: false };
          }
          return entry;
        }),
      );
    } catch (err: any) {
      toast({
        title: "Upload failed",
        description: err?.message ?? "Could not upload images. Please try again.",
        variant: "destructive",
      });
      setPhotoEntries((prev) =>
        prev.map((entry) => {
          const isBatch = newEntries.some((n) => n.objectUrl === entry.objectUrl);
          if (isBatch) return { ...entry, uploading: false, error: true };
          return entry;
        }),
      );
    }

    // Reset input so the same file can be selected again
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const removePhoto = (i: number) => {
    setPhotoEntries((prev) => {
      const updated = [...prev];
      URL.revokeObjectURL(updated[i].objectUrl);
      return updated.filter((_, idx) => idx !== i);
    });
  };

  // ─── Form submit ─────────────────────────────────────────────────────────────

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setLimitError(null);

    const pendingUploads = photoEntries.filter((p) => p.uploading);
    if (pendingUploads.length > 0) {
      toast({ title: "Please wait", description: "Images are still uploading.", variant: "destructive" });
      return;
    }

    const photos = photoEntries
      .filter((p) => p.serverUrl !== null && !p.error)
      .map((p) => p.serverUrl!);

    const data = {
      ...form,
      price: form.price !== "" ? Number(form.price) : null,
      certificationDocs: form.certificationDocs.filter((d) => d.trim()),
      photos,
      aircraftApplicability: form.aircraftApplicability || null,
      traceHistory: form.traceHistory || null,
    };

    createListing.mutate({ data }, {
      onSuccess: (listing) => {
        queryClient.invalidateQueries({ queryKey: getGetSellerListingsQueryKey() });
        queryClient.invalidateQueries({ queryKey: getGetSellerStatsQueryKey() });
        toast({ title: "Listing created", description: `${listing.partNumber} is now live.` });
        navigate("/seller/dashboard");
      },
      onError: (err: any) => {
        const status = err?.response?.status;
        if (status === 402) {
          const body = err?.response?.data;
          setLimitError({
            plan: body?.plan ?? "free",
            activeListings: body?.activeListings ?? 0,
            listingLimit: body?.listingLimit ?? 5,
          });
        } else {
          toast({ title: "Error", description: "Could not create listing.", variant: "destructive" });
        }
      },
    });
  };

  // ─── Cert docs helpers ────────────────────────────────────────────────────────

  const addDoc = () => setForm((f) => ({ ...f, certificationDocs: [...f.certificationDocs, ""] }));
  const removeDoc = (i: number) =>
    setForm((f) => ({ ...f, certificationDocs: f.certificationDocs.filter((_, idx) => idx !== i) }));
  const updateDoc = (i: number, val: string) =>
    setForm((f) => ({ ...f, certificationDocs: f.certificationDocs.map((d, idx) => (idx === i ? val : d)) }));

  // ─── Guard screens ────────────────────────────────────────────────────────────

  if (!authLoading && !user) {
    return (
      <MainLayout>
        <div className="container mx-auto px-4 py-16 text-center">
          <p className="text-muted-foreground mb-4">You must be signed in to create listings.</p>
          <Link href="/seller/login"><Button>Sign In</Button></Link>
        </div>
      </MainLayout>
    );
  }

  if (limitError) {
    return (
      <MainLayout>
        <div className="container mx-auto px-4 py-16 max-w-md">
          <div className="bg-card border border-amber-500/30 rounded-md p-8 text-center">
            <div className="h-14 w-14 rounded-full bg-amber-500/10 flex items-center justify-center mx-auto mb-5">
              <Zap className="h-7 w-7 text-amber-400" />
            </div>
            <h1 className="text-xl font-bold text-white mb-2">Listing Limit Reached</h1>
            <p className="text-muted-foreground text-sm mb-1">
              You have <span className="text-white font-medium">{limitError.activeListings}</span> active listings
              on your <span className="text-white font-medium capitalize">{limitError.plan}</span> plan
              (limit: {limitError.listingLimit}).
            </p>
            <p className="text-muted-foreground text-sm mb-8">
              Upgrade to add more inventory and unlock priority placement.
            </p>
            <div className="space-y-3">
              <Link href="/pricing" className="block">
                <Button className="w-full bg-amber-500 text-black hover:bg-amber-400">
                  <Zap className="h-4 w-4 mr-2" /> View Upgrade Plans
                </Button>
              </Link>
              <Link href="/seller/dashboard" className="block">
                <Button variant="outline" className="w-full">Back to Dashboard</Button>
              </Link>
            </div>
          </div>
        </div>
      </MainLayout>
    );
  }

  // ─── Main form ────────────────────────────────────────────────────────────────

  const canAddMore = photoEntries.length < MAX_PHOTOS;
  const anyUploading = photoEntries.some((p) => p.uploading);

  return (
    <MainLayout>
      <div className="container mx-auto px-4 py-8 max-w-3xl">
        <div className="mb-6 flex items-center gap-3">
          <Link href="/seller/dashboard">
            <Button variant="ghost" size="sm" className="text-muted-foreground">
              <ArrowLeft className="h-4 w-4 mr-1" /> Dashboard
            </Button>
          </Link>
        </div>

        <div className="bg-card border border-border rounded-md p-8">
          <h1 className="text-2xl font-bold text-white mb-6">Create New Listing</h1>

          <form onSubmit={handleSubmit} className="space-y-6">
            {/* Part Identification */}
            <div className="space-y-4">
              <h2 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider border-b border-border pb-2">Part Identification</h2>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-1.5 block">Part Number *</label>
                  <Input value={form.partNumber} onChange={e => setForm(f => ({ ...f, partNumber: e.target.value }))} placeholder="e.g. 737-21N1120-3" required className="font-mono" />
                </div>
                <div>
                  <label className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-1.5 block">Manufacturer *</label>
                  <Input value={form.manufacturer} onChange={e => setForm(f => ({ ...f, manufacturer: e.target.value }))} placeholder="e.g. Boeing" required />
                </div>
              </div>
              <div>
                <label className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-1.5 block">Description *</label>
                <Textarea value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} placeholder="Full part description and specification..." required rows={3} className="resize-none" />
              </div>
              <div>
                <label className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-1.5 block">Aircraft Applicability</label>
                <Input value={form.aircraftApplicability} onChange={e => setForm(f => ({ ...f, aircraftApplicability: e.target.value }))} placeholder="e.g. Boeing 737-700/800/900" />
              </div>
            </div>

            {/* Condition & Sale */}
            <div className="space-y-4">
              <h2 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider border-b border-border pb-2">Condition & Sale</h2>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div>
                  <label className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-1.5 block">Condition *</label>
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
                  <label className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-1.5 block">Sale Type *</label>
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
                  <label className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-1.5 block">Quantity *</label>
                  <Input type="number" min={1} value={form.quantity} onChange={e => setForm(f => ({ ...f, quantity: parseInt(e.target.value) || 1 }))} required />
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
              <p className="text-xs text-muted-foreground">Enter URLs to uploaded certification documents (e.g. FAA Form 8130-3, EASA Form 1). Use a public link so admin can preview the document.</p>
              <div className="space-y-2">
                {form.certificationDocs.map((doc, i) => (
                  <div key={i} className="flex gap-2">
                    <Input value={doc} onChange={e => updateDoc(i, e.target.value)} placeholder="https://docs.example.com/faa-8130-3.pdf" className="flex-1 font-mono text-sm" />
                    {form.certificationDocs.length > 1 && (
                      <Button type="button" variant="ghost" size="sm" className="h-9 w-9 p-0 text-destructive" onClick={() => removeDoc(i)}>
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    )}
                  </div>
                ))}
                <Button type="button" variant="outline" size="sm" onClick={addDoc} className="text-xs">
                  <Plus className="h-3.5 w-3.5 mr-1" /> Add Document
                </Button>
              </div>
            </div>

            {/* Photos */}
            <div className="space-y-4">
              <h2 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider border-b border-border pb-2">Photos</h2>
              <p className="text-xs text-muted-foreground">
                Upload up to {MAX_PHOTOS} photos of the part. Accepted: JPEG, PNG, WebP, GIF — max 10 MB each.
              </p>

              {/* Preview grid */}
              {photoEntries.length > 0 && (
                <div className="grid grid-cols-3 sm:grid-cols-5 gap-2">
                  {photoEntries.map((entry, i) => (
                    <div
                      key={entry.objectUrl}
                      className="relative aspect-square rounded border border-border overflow-hidden bg-muted/20 group"
                    >
                      <img
                        src={entry.objectUrl}
                        alt={`Photo ${i + 1}`}
                        className={`w-full h-full object-cover transition-opacity ${entry.uploading || entry.error ? "opacity-40" : "opacity-100"}`}
                      />

                      {/* Uploading overlay */}
                      {entry.uploading && (
                        <div className="absolute inset-0 flex items-center justify-center">
                          <Loader2 className="h-5 w-5 text-white animate-spin drop-shadow" />
                        </div>
                      )}

                      {/* Error overlay */}
                      {entry.error && !entry.uploading && (
                        <div className="absolute inset-0 flex flex-col items-center justify-center gap-1">
                          <AlertCircle className="h-4 w-4 text-destructive drop-shadow" />
                          <span className="text-[10px] text-destructive font-medium">Failed</span>
                        </div>
                      )}

                      {/* Remove button */}
                      {!entry.uploading && (
                        <button
                          type="button"
                          onClick={() => removePhoto(i)}
                          className="absolute top-1 right-1 h-5 w-5 rounded-full bg-black/70 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
                        >
                          <X className="h-3 w-3 text-white" />
                        </button>
                      )}

                      {/* Success indicator */}
                      {!entry.uploading && !entry.error && entry.serverUrl && (
                        <div className="absolute bottom-1 left-1 h-2 w-2 rounded-full bg-green-400" title="Uploaded" />
                      )}
                    </div>
                  ))}
                </div>
              )}

              {/* Add photos button */}
              {canAddMore && (
                <>
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept={ACCEPTED_TYPES}
                    multiple
                    className="hidden"
                    onChange={handleFileSelect}
                  />
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => fileInputRef.current?.click()}
                    className="text-xs gap-1.5"
                    disabled={anyUploading}
                  >
                    {anyUploading
                      ? <><Loader2 className="h-3.5 w-3.5 animate-spin" /> Uploading…</>
                      : <><ImagePlus className="h-3.5 w-3.5" /> Add Photos ({photoEntries.length}/{MAX_PHOTOS})</>
                    }
                  </Button>
                </>
              )}

              {!canAddMore && (
                <p className="text-xs text-muted-foreground">
                  Maximum {MAX_PHOTOS} photos reached. Remove one to add another.
                </p>
              )}
            </div>

            {/* Trace History */}
            <div className="space-y-4">
              <h2 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider border-b border-border pb-2">Trace History</h2>
              <Textarea value={form.traceHistory} onChange={e => setForm(f => ({ ...f, traceHistory: e.target.value }))} placeholder="Previous operators, removal reason, TSN/CSN, overhaul history..." rows={4} className="resize-none" />
            </div>

            <div className="flex gap-3 pt-2">
              <Button type="submit" className="flex-1" disabled={createListing.isPending || anyUploading}>
                {createListing.isPending ? "Creating..." : "Create Listing"}
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
