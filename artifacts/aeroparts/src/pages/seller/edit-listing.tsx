import { useState, useEffect } from "react";
import { Link, useLocation, useParams } from "wouter";
import { MainLayout } from "@/components/layout/MainLayout";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import {
  useGetListing, getGetListingQueryKey,
  useUpdateListing, getGetSellerListingsQueryKey
} from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import { Plus, Trash2, ArrowLeft } from "lucide-react";

export default function EditListing() {
  const { id } = useParams<{ id: string }>();
  const [, navigate] = useLocation();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const updateListing = useUpdateListing();

  const [form, setForm] = useState({
    partNumber: "", description: "", aircraftApplicability: "", manufacturer: "",
    condition: "serviceable" as any, saleType: "outright" as any,
    quantity: 1, price: "" as string | number,
    certificationDocs: [""], photos: [""], traceHistory: "",
  });
  const [initialized, setInitialized] = useState(false);

  const { data: listing, isLoading } = useGetListing(Number(id), {
    query: { enabled: !!id, queryKey: getGetListingQueryKey(Number(id)) },
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
        certificationDocs: listing.certificationDocs?.length ? listing.certificationDocs : [""],
        photos: listing.photos?.length ? listing.photos : [""],
        traceHistory: listing.traceHistory ?? "",
      });
      setInitialized(true);
    }
  }, [listing, initialized]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const data = {
      ...form,
      price: form.price !== "" ? Number(form.price) : null,
      certificationDocs: form.certificationDocs.filter(d => d.trim()),
      photos: form.photos.filter(p => p.trim()),
      aircraftApplicability: form.aircraftApplicability || null,
      traceHistory: form.traceHistory || null,
    };
    updateListing.mutate({ id: Number(id), data }, {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: getGetListingQueryKey(Number(id)) });
        queryClient.invalidateQueries({ queryKey: getGetSellerListingsQueryKey() });
        toast({ title: "Listing updated", description: "Changes saved successfully." });
        navigate("/seller/dashboard");
      },
      onError: () => {
        toast({ title: "Error", description: "Could not update listing.", variant: "destructive" });
      },
    });
  };

  const addDoc = () => setForm(f => ({ ...f, certificationDocs: [...f.certificationDocs, ""] }));
  const removeDoc = (i: number) => setForm(f => ({ ...f, certificationDocs: f.certificationDocs.filter((_, idx) => idx !== i) }));
  const updateDoc = (i: number, val: string) => setForm(f => ({ ...f, certificationDocs: f.certificationDocs.map((d, idx) => idx === i ? val : d) }));
  const addPhoto = () => setForm(f => ({ ...f, photos: [...f.photos, ""] }));
  const removePhoto = (i: number) => setForm(f => ({ ...f, photos: f.photos.filter((_, idx) => idx !== i) }));
  const updatePhoto = (i: number, val: string) => setForm(f => ({ ...f, photos: f.photos.map((p, idx) => idx === i ? val : p) }));

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

            <div className="space-y-4">
              <h2 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider border-b border-border pb-2">Certification Documents</h2>
              <div className="space-y-2">
                {form.certificationDocs.map((doc, i) => (
                  <div key={i} className="flex gap-2">
                    <Input value={doc} onChange={e => updateDoc(i, e.target.value)} placeholder="e.g. FAA Form 8130-3" className="flex-1" />
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

            <div className="space-y-4">
              <h2 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider border-b border-border pb-2">Photos</h2>
              <div className="space-y-2">
                {form.photos.map((photo, i) => (
                  <div key={i} className="flex gap-2">
                    <Input value={photo} onChange={e => updatePhoto(i, e.target.value)} placeholder="https://..." className="flex-1" />
                    {form.photos.length > 1 && (
                      <Button type="button" variant="ghost" size="sm" className="h-9 w-9 p-0 text-destructive" onClick={() => removePhoto(i)}>
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    )}
                  </div>
                ))}
                <Button type="button" variant="outline" size="sm" onClick={addPhoto} className="text-xs">
                  <Plus className="h-3.5 w-3.5 mr-1" /> Add Photo
                </Button>
              </div>
            </div>

            <div className="space-y-4">
              <h2 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider border-b border-border pb-2">Trace History</h2>
              <Textarea value={form.traceHistory} onChange={e => setForm(f => ({ ...f, traceHistory: e.target.value }))} rows={4} className="resize-none" />
            </div>

            <div className="flex gap-3 pt-2">
              <Button type="submit" className="flex-1" disabled={updateListing.isPending}>
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
