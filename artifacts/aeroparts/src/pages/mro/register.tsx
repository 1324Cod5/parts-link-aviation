import { useState } from "react";
import { Link, useLocation } from "wouter";
import { useCreateMroProfile, useGetMyMroProfile, useUpdateMroProfile, getGetMyMroProfileQueryKey } from "@workspace/api-client-react";
import { useAuth } from "@/context/AuthContext";
import { Navbar } from "@/components/layout/Navbar";
import { Footer } from "@/components/layout/Footer";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { CheckCircle2, ArrowLeft, Wrench, X, Plus, Lock, Zap } from "lucide-react";
import { SERVICE_TYPES, CERTIFICATIONS, AIRCRAFT_FAMILIES } from "./index";

const PLAN_LIMITS = {
  free: { serviceTypes: 3, partNumbers: 5, capDocs: 0, mroLabel: "Free MRO" },
  pro: { serviceTypes: 12, partNumbers: 50, capDocs: 10, mroLabel: "Verified MRO" },
  enterprise: { serviceTypes: 12, partNumbers: 999, capDocs: 20, mroLabel: "Premium MRO" },
};

function TagInput({ label, value, onChange, suggestions, placeholder, limit, limitLabel }:
  { label: string; value: string[]; onChange: (v: string[]) => void; suggestions?: string[]; placeholder?: string; limit?: number; limitLabel?: string }) {
  const [input, setInput] = useState("");

  function add(val: string) {
    const trimmed = val.trim();
    if (!trimmed || value.includes(trimmed)) return;
    if (limit && value.length >= limit) return;
    onChange([...value, trimmed]);
    setInput("");
  }

  function remove(v: string) { onChange(value.filter(x => x !== v)); }

  return (
    <div className="space-y-2">
      <Label>{label} {limit && <span className="text-muted-foreground text-xs font-normal">({value.length}/{limit})</span>}</Label>
      <div className="flex flex-wrap gap-1.5 min-h-[2rem]">
        {value.map(v => (
          <span key={v} className="inline-flex items-center gap-1 text-xs bg-primary/10 text-primary border border-primary/20 rounded-full px-2.5 py-1">
            {v}
            <button type="button" onClick={() => remove(v)}><X className="w-3 h-3" /></button>
          </span>
        ))}
      </div>
      {suggestions ? (
        <div className="flex flex-wrap gap-1.5">
          {suggestions.filter(s => !value.includes(s)).slice(0, limit ? limit - value.length + 3 : 20).map(s => (
            <button key={s} type="button"
              disabled={limit !== undefined && value.length >= limit}
              onClick={() => add(s)}
              className="text-xs bg-secondary/50 hover:bg-primary/10 hover:text-primary border border-border rounded-full px-2.5 py-1 transition-colors disabled:opacity-40 disabled:cursor-not-allowed">
              <Plus className="w-2.5 h-2.5 inline mr-0.5" />{s}
            </button>
          ))}
        </div>
      ) : (
        <div className="flex gap-2">
          <Input value={input} onChange={e => setInput(e.target.value)}
            onKeyDown={e => { if (e.key === "Enter") { e.preventDefault(); add(input); } }}
            placeholder={placeholder ?? "Type and press Enter"}
            className="bg-background border-border text-sm"
            disabled={limit !== undefined && value.length >= limit}
          />
          <Button type="button" variant="outline" size="sm" onClick={() => add(input)}
            disabled={limit !== undefined && value.length >= limit}
            className="border-border text-muted-foreground hover:text-white flex-shrink-0">
            Add
          </Button>
        </div>
      )}
      {limitLabel && limit && value.length >= limit && (
        <p className="text-xs text-amber-400">{limitLabel}</p>
      )}
    </div>
  );
}

export default function MroRegisterPage() {
  const { user } = useAuth();
  const [, navigate] = useLocation();
  const { toast } = useToast();
  const [saved, setSaved] = useState(false);
  const [savedId, setSavedId] = useState<number | null>(null);

  const { data: existingProfile, isLoading: profileLoading } = useGetMyMroProfile({
    query: { enabled: !!user, queryKey: getGetMyMroProfileQueryKey() },
  });

  const plan = (user?.plan ?? "free") as keyof typeof PLAN_LIMITS;
  const limits = PLAN_LIMITS[plan] ?? PLAN_LIMITS.free;

  const [form, setForm] = useState({
    companyName: existingProfile?.companyName ?? user?.companyName ?? "",
    description: existingProfile?.description ?? "",
    website: existingProfile?.website ?? "",
    country: existingProfile?.country ?? user?.country ?? "",
    city: existingProfile?.city ?? "",
    contactName: existingProfile?.contactName ?? user?.contactName ?? "",
    contactEmail: existingProfile?.contactEmail ?? user?.email ?? "",
    contactPhone: existingProfile?.contactPhone ?? user?.phone ?? "",
    aircraftTypes: existingProfile?.aircraftTypes ?? [] as string[],
    partNumbersServiced: existingProfile?.partNumbersServiced ?? [] as string[],
    serviceTypes: existingProfile?.serviceTypes ?? [] as string[],
    certifications: existingProfile?.certifications ?? [] as string[],
    turnaroundTime: existingProfile?.turnaroundTime ?? "",
    warranty: existingProfile?.warranty ?? "",
    capabilityDocuments: existingProfile?.capabilityDocuments ?? [] as string[],
  });

  function set(field: keyof typeof form, value: any) {
    setForm(f => ({ ...f, [field]: value }));
  }

  const isEdit = !!existingProfile;

  const { mutate: create, isPending: isCreating } = useCreateMroProfile({
    mutation: {
      onSuccess(data) { setSaved(true); setSavedId(data.id); },
      onError() { toast({ title: "Failed to save", description: "Please try again.", variant: "destructive" }); },
    },
  });

  const { mutate: update, isPending: isUpdating } = useUpdateMroProfile({
    mutation: {
      onSuccess() { toast({ title: "Profile updated", description: "Your MRO profile has been saved." }); navigate("/mro/" + existingProfile?.id); },
      onError() { toast({ title: "Failed to update", description: "Please try again.", variant: "destructive" }); },
    },
  });

  const isPending = isCreating || isUpdating;

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const payload = {
      companyName: form.companyName,
      description: form.description || null,
      website: form.website || null,
      country: form.country,
      city: form.city || null,
      contactName: form.contactName,
      contactEmail: form.contactEmail,
      contactPhone: form.contactPhone || null,
      aircraftTypes: form.aircraftTypes,
      partNumbersServiced: form.partNumbersServiced,
      serviceTypes: form.serviceTypes,
      certifications: form.certifications,
      turnaroundTime: form.turnaroundTime || null,
      warranty: form.warranty || null,
      capabilityDocuments: form.capabilityDocuments,
    };
    if (isEdit) {
      update({ id: existingProfile.id, data: payload });
    } else {
      create({ data: payload });
    }
  }

  if (!user) {
    return (
      <div className="min-h-screen bg-background flex flex-col">
        <Navbar />
        <main className="flex-1 flex items-center justify-center py-20">
          <div className="text-center max-w-sm px-4">
            <Lock className="w-10 h-10 mx-auto mb-4 text-muted-foreground opacity-40" />
            <h2 className="text-xl font-bold text-white mb-2">Sign In Required</h2>
            <p className="text-muted-foreground text-sm mb-6">You need a seller account to list your MRO services.</p>
            <div className="flex gap-3 justify-center">
              <Link href="/seller/login"><Button>Sign In</Button></Link>
              <Link href="/seller/register"><Button variant="outline" className="border-border text-muted-foreground hover:text-white">Register</Button></Link>
            </div>
          </div>
        </main>
        <Footer />
      </div>
    );
  }

  if (profileLoading) {
    return <div className="min-h-screen bg-background flex flex-col"><Navbar /><main className="flex-1" /></div>;
  }

  if (saved) {
    return (
      <div className="min-h-screen bg-background flex flex-col">
        <Navbar />
        <main className="flex-1 flex items-center justify-center py-20">
          <div className="max-w-md w-full mx-auto px-4 text-center">
            <div className="w-16 h-16 rounded-full bg-emerald-500/20 flex items-center justify-center mx-auto mb-6">
              <CheckCircle2 className="w-8 h-8 text-emerald-400" />
            </div>
            <h1 className="text-2xl font-bold text-white mb-2">MRO Profile Published</h1>
            <p className="text-muted-foreground mb-8">Your MRO services are now listed in the Parts Link Aviation directory.</p>
            <div className="flex flex-col sm:flex-row gap-3 justify-center">
              <Link href={`/mro/${savedId}`}><Button className="w-full sm:w-auto">View Your Profile</Button></Link>
              <Link href="/mro"><Button variant="outline" className="w-full sm:w-auto border-border text-muted-foreground hover:text-white">Browse Directory</Button></Link>
            </div>
          </div>
        </main>
        <Footer />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background flex flex-col">
      <Navbar />
      <main className="flex-1">
        <div className="border-b border-border bg-card/30 py-8">
          <div className="container mx-auto px-4">
            <Link href="/mro" className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-white mb-3">
              <ArrowLeft className="w-4 h-4" /> Back to MRO Directory
            </Link>
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-md bg-primary/20 flex items-center justify-center">
                <Wrench className="w-5 h-5 text-primary" />
              </div>
              <div>
                <h1 className="text-2xl font-bold text-white">{isEdit ? "Edit MRO Profile" : "List Your MRO Services"}</h1>
                <p className="text-sm text-muted-foreground mt-0.5">
                  {isEdit ? "Update your capability listing" : "Register your company in the Parts Link Aviation MRO directory"}
                </p>
              </div>
            </div>
          </div>
        </div>

        <div className="container mx-auto px-4 py-8 max-w-3xl">
          {/* Plan tier notice */}
          {plan === "free" && (
            <div className="mb-6 flex items-start gap-3 p-4 bg-amber-500/10 border border-amber-500/30 rounded-md">
              <Zap className="w-5 h-5 text-amber-400 flex-shrink-0 mt-0.5" />
              <div className="flex-1">
                <p className="text-amber-300 font-medium text-sm">Free plan limits apply</p>
                <p className="text-amber-400/80 text-xs mt-0.5">
                  Up to {limits.serviceTypes} service types, {limits.partNumbers} part numbers. Upgrade to Pro for full listings, priority placement, and capability document uploads.
                </p>
              </div>
              <Link href="/pricing">
                <Button size="sm" className="bg-amber-500 text-black hover:bg-amber-400 text-xs h-8 flex-shrink-0">Upgrade</Button>
              </Link>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-8">
            {/* Company Info */}
            <div className="border border-border rounded-lg p-6 bg-card space-y-4">
              <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-widest">Company Information</h2>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="sm:col-span-2 space-y-1.5">
                  <Label htmlFor="companyName">Company Name <span className="text-destructive">*</span></Label>
                  <Input id="companyName" value={form.companyName} onChange={e => set("companyName", e.target.value)} required className="bg-background border-border" />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="country">Country <span className="text-destructive">*</span></Label>
                  <Input id="country" value={form.country} onChange={e => set("country", e.target.value)} placeholder="United States" required className="bg-background border-border" />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="city">City</Label>
                  <Input id="city" value={form.city} onChange={e => set("city", e.target.value)} placeholder="Atlanta, GA" className="bg-background border-border" />
                </div>
                <div className="sm:col-span-2 space-y-1.5">
                  <Label htmlFor="website">Website</Label>
                  <Input id="website" type="url" value={form.website} onChange={e => set("website", e.target.value)} placeholder="https://yourmro.com" className="bg-background border-border" />
                </div>
                <div className="sm:col-span-2 space-y-1.5">
                  <Label htmlFor="description">Company Description</Label>
                  <Textarea id="description" value={form.description} onChange={e => set("description", e.target.value)}
                    placeholder="Describe your MRO capabilities, experience, and what sets you apart…"
                    rows={4} className="bg-background border-border resize-none" />
                </div>
              </div>
            </div>

            {/* Contact Info */}
            <div className="border border-border rounded-lg p-6 bg-card space-y-4">
              <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-widest">Contact Information</h2>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <Label htmlFor="contactName">Contact Name <span className="text-destructive">*</span></Label>
                  <Input id="contactName" value={form.contactName} onChange={e => set("contactName", e.target.value)} required className="bg-background border-border" />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="contactEmail">Contact Email <span className="text-destructive">*</span></Label>
                  <Input id="contactEmail" type="email" value={form.contactEmail} onChange={e => set("contactEmail", e.target.value)} required className="bg-background border-border" />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="contactPhone">Phone</Label>
                  <Input id="contactPhone" value={form.contactPhone} onChange={e => set("contactPhone", e.target.value)} placeholder="+1-800-555-0100" className="bg-background border-border" />
                </div>
              </div>
            </div>

            {/* Capabilities */}
            <div className="border border-border rounded-lg p-6 bg-card space-y-6">
              <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-widest">Capabilities</h2>

              <TagInput label="Service Types" value={form.serviceTypes} onChange={v => set("serviceTypes", v)}
                suggestions={SERVICE_TYPES} limit={limits.serviceTypes}
                limitLabel={`Upgrade to Pro for more service types`} />

              <TagInput label="Aircraft Types Supported" value={form.aircraftTypes} onChange={v => set("aircraftTypes", v)}
                suggestions={AIRCRAFT_FAMILIES} />

              <TagInput label="Certifications & Approvals" value={form.certifications} onChange={v => set("certifications", v)}
                suggestions={CERTIFICATIONS} />

              <TagInput label="Part Numbers Serviced" value={form.partNumbersServiced} onChange={v => set("partNumbersServiced", v)}
                placeholder="e.g. CFM56-7B" limit={limits.partNumbers}
                limitLabel="Upgrade to Pro for more part numbers" />

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <Label htmlFor="turnaround">Typical Turnaround Time</Label>
                  <Input id="turnaround" value={form.turnaroundTime} onChange={e => set("turnaroundTime", e.target.value)}
                    placeholder="e.g. 5–10 business days" className="bg-background border-border" />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="warranty">Warranty Terms</Label>
                  <Input id="warranty" value={form.warranty} onChange={e => set("warranty", e.target.value)}
                    placeholder="e.g. 12 months or 1,000 FH" className="bg-background border-border" />
                </div>
              </div>
            </div>

            {/* Capability Documents */}
            <div className="border border-border rounded-lg p-6 bg-card space-y-4">
              <div className="flex items-center justify-between">
                <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-widest">Capability Documents</h2>
                {plan === "free" && (
                  <Link href="/pricing">
                    <span className="text-xs text-amber-400 hover:underline flex items-center gap-1">
                      <Zap className="w-3 h-3" /> Pro required
                    </span>
                  </Link>
                )}
              </div>
              {plan === "free" ? (
                <p className="text-sm text-muted-foreground">Upgrade to Pro to upload capability statements, approvals, and certification documents.</p>
              ) : (
                <TagInput label="Document Names / References"
                  value={form.capabilityDocuments} onChange={v => set("capabilityDocuments", v)}
                  placeholder="e.g. FAA 145 Approval Certificate"
                  limit={limits.capDocs} />
              )}
            </div>

            <div className="flex items-center gap-3">
              <Button type="submit" disabled={isPending} className="bg-primary hover:bg-primary/90 px-8">
                {isPending ? "Saving…" : isEdit ? "Save Changes" : "Publish Profile"}
              </Button>
              <Link href="/mro">
                <Button type="button" variant="ghost" className="text-muted-foreground hover:text-white">Cancel</Button>
              </Link>
            </div>
          </form>
        </div>
      </main>
      <Footer />
    </div>
  );
}
