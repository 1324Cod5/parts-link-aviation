import { useState } from "react";
import { Link, useParams } from "wouter";
import { useGetMroProfile, useCreateServiceQuoteRequest } from "@workspace/api-client-react";
import { useAuth } from "@/context/useAuth";
import { Navbar } from "@/components/layout/Navbar";
import { Footer } from "@/components/layout/Footer";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import {
  ArrowLeft, MapPin, Globe, Phone, Mail, ShieldCheck, Plane,
  Clock, Star, Wrench, CheckCircle2, Send, AlertCircle, Edit2,
  FileText, Package, Zap
} from "lucide-react";

const CERT_COLORS: Record<string, string> = {
  "FAA Part 145": "bg-blue-500/20 text-blue-400 border-blue-500/30",
  "EASA Part 145": "bg-indigo-500/20 text-indigo-400 border-indigo-500/30",
  "CAAC CCAR-145": "bg-red-500/20 text-red-400 border-red-500/30",
  "ISO 9001:2015": "bg-emerald-500/20 text-emerald-400 border-emerald-500/30",
  "AS9100D": "bg-purple-500/20 text-purple-400 border-purple-500/30",
};
function certColor(c: string) { return CERT_COLORS[c] ?? "bg-secondary/60 text-muted-foreground border-border"; }

const URGENCY_META = {
  standard: { label: "Standard", color: "text-muted-foreground", bg: "bg-secondary/40" },
  urgent: { label: "Urgent", color: "text-amber-400", bg: "bg-amber-500/10 border border-amber-500/20" },
  aog: { label: "AOG — Aircraft on Ground", color: "text-red-400", bg: "bg-red-500/10 border border-red-500/20" },
};

export default function MroDetailPage() {
  const params = useParams<{ id: string }>();
  const id = parseInt(params.id);
  const { user } = useAuth();
  const { toast } = useToast();
  const [quoteSent, setQuoteSent] = useState(false);

  const { data, isLoading } = useGetMroProfile(id);

  const [form, setForm] = useState({
    requesterName: user?.contactName ?? "",
    requesterEmail: user?.email ?? "",
    requesterCompany: user?.companyName ?? "",
    requesterPhone: user?.phone ?? "",
    partNumber: "",
    description: "",
    aircraftType: "",
    serviceType: "",
    quantity: 1,
    urgency: "standard" as "standard" | "urgent" | "aog",
  });

  function set(field: keyof typeof form, value: any) { setForm(f => ({ ...f, [field]: value })); }

  const { mutate: submitQuote, isPending } = useCreateServiceQuoteRequest({
    mutation: {
      onSuccess() { setQuoteSent(true); },
      onError() { toast({ title: "Failed to submit", description: "Please try again.", variant: "destructive" }); },
    },
  });

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    submitQuote({
      id,
      data: {
        requesterName: form.requesterName,
        requesterEmail: form.requesterEmail,
        requesterCompany: form.requesterCompany || null,
        requesterPhone: form.requesterPhone || null,
        partNumber: form.partNumber,
        description: form.description,
        aircraftType: form.aircraftType || null,
        serviceType: form.serviceType || null,
        quantity: form.quantity,
        urgency: form.urgency,
      },
    });
  }

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background flex flex-col">
        <Navbar />
        <main className="flex-1 container mx-auto px-4 py-12 max-w-4xl">
          <div className="space-y-4 animate-pulse">
            <div className="h-8 w-48 bg-card/50 rounded" />
            <div className="h-32 bg-card/50 rounded-lg" />
            <div className="h-48 bg-card/50 rounded-lg" />
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
          <p className="text-muted-foreground">MRO profile not found.</p>
          <Link href="/mro"><Button className="mt-4">Back to Directory</Button></Link>
        </main>
        <Footer />
      </div>
    );
  }

  const { profile: mro, quoteRequestCount } = data;
  const isOwner = user && mro.userId === user.id;

  return (
    <div className="min-h-screen bg-background flex flex-col">
      <Navbar />
      <main className="flex-1">
        {/* Header */}
        <div className="border-b border-border bg-card/30 py-8">
          <div className="container mx-auto px-4 max-w-4xl">
            <Link href="/mro" className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-white mb-4">
              <ArrowLeft className="w-4 h-4" /> Back to MRO Directory
            </Link>
            <div className="flex items-start justify-between gap-4">
              <div className="flex items-start gap-4">
                <div className="w-14 h-14 rounded-xl bg-primary/10 border border-primary/20 flex items-center justify-center flex-shrink-0">
                  <Wrench className="w-7 h-7 text-primary" />
                </div>
                <div>
                  <div className="flex items-center gap-2 mb-1">
                    <h1 className="text-2xl font-bold text-white">{mro.companyName}</h1>
                    {mro.featured && (
                      <span className="flex items-center gap-0.5 text-xs text-amber-400 bg-amber-500/10 border border-amber-500/20 rounded px-2 py-0.5">
                        <Star className="w-3 h-3 fill-amber-400" /> Featured
                      </span>
                    )}
                  </div>
                  <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-muted-foreground">
                    <span className="flex items-center gap-1.5">
                      <MapPin className="w-3.5 h-3.5" />
                      {[mro.city, mro.country].filter(Boolean).join(", ")}
                    </span>
                    {mro.website && (
                      <a href={mro.website} target="_blank" rel="noopener noreferrer"
                        className="flex items-center gap-1.5 hover:text-primary transition-colors">
                        <Globe className="w-3.5 h-3.5" /> Website
                      </a>
                    )}
                    <span>{quoteRequestCount} quote request{quoteRequestCount !== 1 ? "s" : ""} received</span>
                  </div>
                </div>
              </div>
              {isOwner && (
                <Link href="/mro/register">
                  <Button variant="outline" size="sm" className="border-border text-muted-foreground hover:text-white gap-1.5 flex-shrink-0">
                    <Edit2 className="w-3.5 h-3.5" /> Edit Profile
                  </Button>
                </Link>
              )}
            </div>
          </div>
        </div>

        <div className="container mx-auto px-4 py-8 max-w-4xl">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            {/* Main */}
            <div className="lg:col-span-2 space-y-6">
              {mro.description && (
                <div className="border border-border rounded-lg p-5 bg-card">
                  <h2 className="text-xs font-semibold text-muted-foreground uppercase tracking-widest mb-3">About</h2>
                  <p className="text-sm text-foreground leading-relaxed">{mro.description}</p>
                </div>
              )}

              {/* Certifications */}
              {mro.certifications.length > 0 && (
                <div className="border border-border rounded-lg p-5 bg-card">
                  <h2 className="text-xs font-semibold text-muted-foreground uppercase tracking-widest mb-3 flex items-center gap-2">
                    <ShieldCheck className="w-4 h-4" /> Certifications & Approvals
                  </h2>
                  <div className="flex flex-wrap gap-2">
                    {mro.certifications.map(c => (
                      <span key={c} className={`text-sm border rounded-md px-3 py-1.5 flex items-center gap-1.5 ${certColor(c)}`}>
                        <ShieldCheck className="w-3.5 h-3.5" /> {c}
                      </span>
                    ))}
                  </div>
                </div>
              )}

              {/* Service Types */}
              {mro.serviceTypes.length > 0 && (
                <div className="border border-border rounded-lg p-5 bg-card">
                  <h2 className="text-xs font-semibold text-muted-foreground uppercase tracking-widest mb-3 flex items-center gap-2">
                    <Wrench className="w-4 h-4" /> Services Offered
                  </h2>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    {mro.serviceTypes.map(s => (
                      <div key={s} className="flex items-center gap-2 text-sm text-foreground">
                        <CheckCircle2 className="w-4 h-4 text-primary flex-shrink-0" /> {s}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Aircraft Types */}
              {mro.aircraftTypes.length > 0 && (
                <div className="border border-border rounded-lg p-5 bg-card">
                  <h2 className="text-xs font-semibold text-muted-foreground uppercase tracking-widest mb-3 flex items-center gap-2">
                    <Plane className="w-4 h-4" /> Aircraft Types Supported
                  </h2>
                  <div className="flex flex-wrap gap-2">
                    {mro.aircraftTypes.map(a => (
                      <span key={a} className="text-sm bg-secondary/50 border border-border text-foreground rounded-md px-3 py-1.5 flex items-center gap-1.5">
                        <Plane className="w-3 h-3 text-muted-foreground" /> {a}
                      </span>
                    ))}
                  </div>
                </div>
              )}

              {/* Part Numbers */}
              {mro.partNumbersServiced.length > 0 && (
                <div className="border border-border rounded-lg p-5 bg-card">
                  <h2 className="text-xs font-semibold text-muted-foreground uppercase tracking-widest mb-3 flex items-center gap-2">
                    <Package className="w-4 h-4" /> Part Numbers Serviced
                  </h2>
                  <div className="flex flex-wrap gap-2">
                    {mro.partNumbersServiced.map(p => (
                      <span key={p} className="font-mono text-xs bg-secondary/50 border border-border text-primary rounded px-2 py-1">{p}</span>
                    ))}
                  </div>
                </div>
              )}

              {/* Capability Docs */}
              {mro.capabilityDocuments.length > 0 && (
                <div className="border border-border rounded-lg p-5 bg-card">
                  <h2 className="text-xs font-semibold text-muted-foreground uppercase tracking-widest mb-3 flex items-center gap-2">
                    <FileText className="w-4 h-4" /> Capability Documents
                  </h2>
                  <div className="space-y-2">
                    {mro.capabilityDocuments.map(d => (
                      <div key={d} className="flex items-center gap-2 text-sm text-muted-foreground">
                        <FileText className="w-4 h-4 text-primary/60 flex-shrink-0" /> {d}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Quote Request Form */}
              <div className="border border-border rounded-lg p-6 bg-card" id="quote">
                <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-widest mb-4 flex items-center gap-2">
                  <Send className="w-4 h-4" /> Request Service Quote
                </h2>

                {quoteSent ? (
                  <div className="text-center py-8">
                    <div className="w-12 h-12 rounded-full bg-emerald-500/20 flex items-center justify-center mx-auto mb-4">
                      <CheckCircle2 className="w-6 h-6 text-emerald-400" />
                    </div>
                    <p className="text-white font-medium">Quote Request Sent</p>
                    <p className="text-sm text-muted-foreground mt-1">The MRO team will contact you at {form.requesterEmail}.</p>
                    <Button variant="outline" size="sm" onClick={() => setQuoteSent(false)}
                      className="border-border text-muted-foreground hover:text-white mt-4">
                      Submit Another
                    </Button>
                  </div>
                ) : (
                  <form onSubmit={handleSubmit} className="space-y-4">
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <div className="space-y-1.5">
                        <Label htmlFor="rName">Your Name <span className="text-destructive">*</span></Label>
                        <Input id="rName" value={form.requesterName} onChange={e => set("requesterName", e.target.value)} required className="bg-background border-border" />
                      </div>
                      <div className="space-y-1.5">
                        <Label htmlFor="rEmail">Email <span className="text-destructive">*</span></Label>
                        <Input id="rEmail" type="email" value={form.requesterEmail} onChange={e => set("requesterEmail", e.target.value)} required className="bg-background border-border" />
                      </div>
                      <div className="space-y-1.5">
                        <Label htmlFor="rCompany">Company</Label>
                        <Input id="rCompany" value={form.requesterCompany} onChange={e => set("requesterCompany", e.target.value)} className="bg-background border-border" />
                      </div>
                      <div className="space-y-1.5">
                        <Label htmlFor="rPhone">Phone</Label>
                        <Input id="rPhone" value={form.requesterPhone} onChange={e => set("requesterPhone", e.target.value)} className="bg-background border-border" />
                      </div>
                      <div className="space-y-1.5">
                        <Label htmlFor="rPart">Part Number <span className="text-destructive">*</span></Label>
                        <Input id="rPart" value={form.partNumber} onChange={e => set("partNumber", e.target.value)} required placeholder="e.g. CFM56-7B" className="bg-background border-border font-mono" />
                      </div>
                      <div className="space-y-1.5">
                        <Label htmlFor="rQty">Quantity <span className="text-destructive">*</span></Label>
                        <Input id="rQty" type="number" min={1} value={form.quantity} onChange={e => set("quantity", Math.max(1, parseInt(e.target.value) || 1))} className="bg-background border-border" />
                      </div>
                      <div className="space-y-1.5">
                        <Label htmlFor="rAircraft">Aircraft Type</Label>
                        <Input id="rAircraft" value={form.aircraftType} onChange={e => set("aircraftType", e.target.value)} placeholder="e.g. Boeing 737-800" className="bg-background border-border" />
                      </div>
                      <div className="space-y-1.5">
                        <Label htmlFor="rService">Service Required</Label>
                        <select id="rService" value={form.serviceType} onChange={e => set("serviceType", e.target.value)}
                          className="w-full bg-background border border-border rounded-md px-3 py-2 text-sm text-foreground">
                          <option value="">Select service type</option>
                          {mro.serviceTypes.map(s => <option key={s} value={s}>{s}</option>)}
                        </select>
                      </div>
                      <div className="sm:col-span-2 space-y-1.5">
                        <Label htmlFor="rDesc">Description / Requirements <span className="text-destructive">*</span></Label>
                        <Textarea id="rDesc" value={form.description} onChange={e => set("description", e.target.value)}
                          required rows={3} placeholder="Describe the work required, condition of the part, any special requirements…"
                          className="bg-background border-border resize-none" />
                      </div>
                    </div>

                    {/* Urgency selector */}
                    <div className="space-y-2">
                      <Label>Urgency Level</Label>
                      <div className="grid grid-cols-3 gap-2">
                        {(["standard", "urgent", "aog"] as const).map(u => {
                          const meta = URGENCY_META[u];
                          return (
                            <button key={u} type="button"
                              onClick={() => set("urgency", u)}
                              className={`rounded-md px-3 py-2.5 text-xs font-medium transition-all border text-center ${form.urgency === u ? meta.bg + " " + meta.color + " border-current" : "bg-card border-border text-muted-foreground hover:text-white"}`}>
                              {meta.label}
                            </button>
                          );
                        })}
                      </div>
                    </div>

                    <Button type="submit" disabled={isPending} className="w-full bg-primary hover:bg-primary/90 gap-2">
                      <Send className="w-4 h-4" />
                      {isPending ? "Submitting…" : "Send Quote Request"}
                    </Button>
                  </form>
                )}
              </div>
            </div>

            {/* Sidebar */}
            <div className="space-y-4">
              <div className="border border-border rounded-lg p-5 bg-card">
                <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-widest mb-4">Contact</h3>
                <div className="space-y-3 text-sm">
                  <div className="font-medium text-white">{mro.contactName}</div>
                  <a href={`mailto:${mro.contactEmail}`} className="flex items-center gap-2 text-primary hover:underline">
                    <Mail className="w-4 h-4 flex-shrink-0" /> {mro.contactEmail}
                  </a>
                  {mro.contactPhone && (
                    <div className="flex items-center gap-2 text-muted-foreground">
                      <Phone className="w-4 h-4 flex-shrink-0" /> {mro.contactPhone}
                    </div>
                  )}
                  {mro.website && (
                    <a href={mro.website} target="_blank" rel="noopener noreferrer"
                      className="flex items-center gap-2 text-muted-foreground hover:text-primary transition-colors">
                      <Globe className="w-4 h-4 flex-shrink-0" /> Visit Website
                    </a>
                  )}
                </div>
              </div>

              <div className="border border-border rounded-lg p-5 bg-card">
                <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-widest mb-4">Service Terms</h3>
                <div className="space-y-3 text-sm">
                  {mro.turnaroundTime && (
                    <div>
                      <p className="text-xs text-muted-foreground mb-0.5">Turnaround Time</p>
                      <p className="text-white flex items-center gap-1.5"><Clock className="w-3.5 h-3.5 text-muted-foreground" /> {mro.turnaroundTime}</p>
                    </div>
                  )}
                  {mro.warranty && (
                    <div>
                      <p className="text-xs text-muted-foreground mb-0.5">Warranty</p>
                      <p className="text-white flex items-center gap-1.5"><ShieldCheck className="w-3.5 h-3.5 text-muted-foreground" /> {mro.warranty}</p>
                    </div>
                  )}
                  {!mro.turnaroundTime && !mro.warranty && (
                    <p className="text-muted-foreground text-xs">Contact the MRO for service terms.</p>
                  )}
                </div>
              </div>

              <Button className="w-full bg-primary hover:bg-primary/90 gap-2" asChild>
                <a href="#quote"><Send className="w-4 h-4" /> Request Quote</a>
              </Button>
            </div>
          </div>
        </div>
      </main>
      <Footer />
    </div>
  );
}
