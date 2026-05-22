import { useState } from "react";
import { Link, useLocation } from "wouter";
import { useCreateRfq } from "@workspace/api-client-react";
import { Navbar } from "@/components/layout/Navbar";
import { Footer } from "@/components/layout/Footer";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { CheckCircle2, ArrowLeft, Package, AlertTriangle, Zap } from "lucide-react";

const CONDITIONS = ["New", "Overhauled", "Serviceable", "As Removed", "Repaired"] as const;

const URGENCY_OPTIONS = [
  {
    value: "aog",
    label: "AOG — Aircraft on Ground",
    description: "Aircraft is grounded and cannot fly. Highest priority.",
    color: "text-red-400",
  },
  {
    value: "urgent",
    label: "Urgent",
    description: "Part needed within days — active operation affected.",
    color: "text-amber-400",
  },
  {
    value: "routine",
    label: "Routine",
    description: "Normal procurement timeline — flexible lead time.",
    color: "text-foreground",
  },
] as const;

type UrgencyValue = typeof URGENCY_OPTIONS[number]["value"];

export default function NewRfqPage() {
  const [, navigate] = useLocation();
  const [submitted, setSubmitted] = useState(false);
  const [rfqId, setRfqId] = useState<number | null>(null);
  const [isAog, setIsAog] = useState(false);

  const [form, setForm] = useState({
    buyerName: "",
    buyerEmail: "",
    buyerCompany: "",
    buyerPhone: "",
    partNumber: "",
    description: "",
    aircraftApplicability: "",
    condition: "",
    quantity: 1,
    urgency: "routine" as UrgencyValue,
    urgencyReason: "",
  });

  const { mutate: createRfq, isPending, error } = useCreateRfq({
    mutation: {
      onSuccess(data) {
        const d = data as any;
        setRfqId(data.id);
        setSubmitted(true);
        // AOG escalation flag — show elevated state on success screen
        if (d._aogEscalation) setIsAog(true);
      },
    },
  });

  function set<K extends keyof typeof form>(field: K, value: typeof form[K]) {
    setForm(f => ({ ...f, [field]: value }));
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    createRfq({
      data: {
        buyerName: form.buyerName,
        buyerEmail: form.buyerEmail,
        buyerCompany: form.buyerCompany || null,
        buyerPhone: form.buyerPhone || null,
        partNumber: form.partNumber,
        description: form.description,
        aircraftApplicability: form.aircraftApplicability || null,
        condition: (form.condition && form.condition !== "any") ? form.condition : null,
        quantity: form.quantity,
        urgency: form.urgency,
        urgencyReason: form.urgency === "aog" ? (form.urgencyReason || null) : null,
      },
    });
  }

  if (submitted) {
    return (
      <div className="min-h-screen bg-background flex flex-col">
        <Navbar />
        <main className="flex-1 flex items-center justify-center py-20">
          <div className="max-w-md w-full mx-auto px-4 text-center">
            {isAog ? (
              <>
                <div className="w-16 h-16 rounded-full bg-red-500/20 flex items-center justify-center mx-auto mb-6 animate-pulse">
                  <AlertTriangle className="w-8 h-8 text-red-400" />
                </div>
                <h1 className="text-2xl font-bold text-white mb-2">AOG Request Submitted</h1>
                <div className="inline-flex items-center gap-2 bg-red-500/10 border border-red-500/30 rounded-lg px-4 py-2 mb-4">
                  <Zap className="w-4 h-4 text-red-400" />
                  <span className="text-sm text-red-400 font-medium">Escalated for immediate response</span>
                </div>
                <p className="text-muted-foreground mb-8">
                  Your AOG request has been flagged with highest priority. Qualified sellers will be
                  notified immediately and are expected to respond as fast as possible.
                </p>
              </>
            ) : (
              <>
                <div className="w-16 h-16 rounded-full bg-emerald-500/20 flex items-center justify-center mx-auto mb-6">
                  <CheckCircle2 className="w-8 h-8 text-emerald-400" />
                </div>
                <h1 className="text-2xl font-bold text-white mb-2">RFQ Posted Successfully</h1>
                <p className="text-muted-foreground mb-8">
                  Your request has been published to the AeroParts RFQ board. Qualified sellers will respond directly.
                </p>
              </>
            )}
            <div className="flex flex-col sm:flex-row gap-3 justify-center">
              <Link href={`/rfqs/${rfqId}`}>
                <Button className={isAog ? "w-full sm:w-auto bg-red-600 hover:bg-red-700" : "w-full sm:w-auto"}>
                  View Your RFQ
                </Button>
              </Link>
              <Link href="/rfqs">
                <Button variant="outline" className="w-full sm:w-auto border-border text-muted-foreground hover:text-white">
                  Browse All RFQs
                </Button>
              </Link>
            </div>
          </div>
        </main>
        <Footer />
      </div>
    );
  }

  const selectedUrgency = URGENCY_OPTIONS.find(u => u.value === form.urgency)!;
  const isAogSelected = form.urgency === "aog";

  return (
    <div className="min-h-screen bg-background flex flex-col">
      <Navbar />
      <main className="flex-1">
        <div className="border-b border-border bg-card/30 py-8">
          <div className="container mx-auto px-4">
            <Link href="/rfqs" className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-white mb-3">
              <ArrowLeft className="w-4 h-4" />
              Back to RFQ Board
            </Link>
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-md bg-primary/20 flex items-center justify-center">
                <Package className="w-5 h-5 text-primary" />
              </div>
              <div>
                <h1 className="text-2xl font-bold text-white">Post a Request for Quotation</h1>
                <p className="text-sm text-muted-foreground mt-0.5">Describe the part you need — sellers will respond with matching inventory</p>
              </div>
            </div>
          </div>
        </div>

        <div className="container mx-auto px-4 py-8 max-w-2xl">
          <form onSubmit={handleSubmit} className="space-y-8">
            {/* Contact info */}
            <div className="border border-border rounded-lg p-6 bg-card space-y-4">
              <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-widest">Your Contact Details</h2>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <Label htmlFor="buyerName">Full Name <span className="text-destructive">*</span></Label>
                  <Input id="buyerName" value={form.buyerName} onChange={e => set("buyerName", e.target.value)}
                    placeholder="Jane Smith" required className="bg-background border-border" />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="buyerEmail">Email Address <span className="text-destructive">*</span></Label>
                  <Input id="buyerEmail" type="email" value={form.buyerEmail} onChange={e => set("buyerEmail", e.target.value)}
                    placeholder="jane@airline.com" required className="bg-background border-border" />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="buyerCompany">Company / Operator</Label>
                  <Input id="buyerCompany" value={form.buyerCompany} onChange={e => set("buyerCompany", e.target.value)}
                    placeholder="Acme Airlines" className="bg-background border-border" />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="buyerPhone">Phone</Label>
                  <Input id="buyerPhone" value={form.buyerPhone} onChange={e => set("buyerPhone", e.target.value)}
                    placeholder="+1-800-555-0100" className="bg-background border-border" />
                </div>
              </div>
            </div>

            {/* Urgency — placed before part details so buyers think critically about it */}
            <div className={`border rounded-lg p-6 space-y-4 ${isAogSelected ? "border-red-500/40 bg-red-500/5" : "border-border bg-card"}`}>
              <div className="flex items-center justify-between">
                <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-widest">Request Urgency</h2>
                {isAogSelected && (
                  <div className="flex items-center gap-1.5 text-xs text-red-400 font-medium animate-pulse">
                    <AlertTriangle className="w-3.5 h-3.5" />
                    AOG — Highest Priority
                  </div>
                )}
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="urgency">Urgency Level <span className="text-destructive">*</span></Label>
                <Select value={form.urgency} onValueChange={v => set("urgency", v as UrgencyValue)}>
                  <SelectTrigger className={`bg-background border-border ${isAogSelected ? "border-red-500/50 text-red-400" : ""}`}>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {URGENCY_OPTIONS.map(opt => (
                      <SelectItem key={opt.value} value={opt.value}>
                        <span className={opt.color}>{opt.label}</span>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {selectedUrgency && (
                  <p className="text-xs text-muted-foreground mt-1">{selectedUrgency.description}</p>
                )}
              </div>

              {isAogSelected && (
                <div className="space-y-1.5">
                  <Label htmlFor="urgencyReason">
                    AOG Reason <span className="text-destructive">*</span>
                  </Label>
                  <Textarea
                    id="urgencyReason"
                    value={form.urgencyReason}
                    onChange={e => set("urgencyReason", e.target.value)}
                    placeholder="Describe the grounding situation — aircraft tail number, flight disruption, estimated impact…"
                    required={isAogSelected}
                    rows={3}
                    className="bg-background border-red-500/30 resize-none focus-visible:ring-red-500/30"
                  />
                  <p className="text-xs text-red-400/70">
                    This information helps sellers prioritize AOG requests and respond immediately.
                  </p>
                </div>
              )}
            </div>

            {/* Part details */}
            <div className="border border-border rounded-lg p-6 bg-card space-y-4">
              <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-widest">Part Requirements</h2>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <Label htmlFor="partNumber">Part Number <span className="text-destructive">*</span></Label>
                  <Input id="partNumber" value={form.partNumber} onChange={e => set("partNumber", e.target.value)}
                    placeholder="e.g. CFM56-7B27" required className="bg-background border-border font-mono" />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="quantity">Quantity Required <span className="text-destructive">*</span></Label>
                  <Input id="quantity" type="number" min={1} value={form.quantity}
                    onChange={e => set("quantity", Math.max(1, parseInt(e.target.value) || 1))}
                    className="bg-background border-border" />
                </div>
                <div className="sm:col-span-2 space-y-1.5">
                  <Label htmlFor="description">Description / Requirements <span className="text-destructive">*</span></Label>
                  <Textarea id="description" value={form.description} onChange={e => set("description", e.target.value)}
                    placeholder="Describe the part, certification requirements, and any other specifications…"
                    required rows={4} className="bg-background border-border resize-none" />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="aircraft">Aircraft Applicability</Label>
                  <Input id="aircraft" value={form.aircraftApplicability}
                    onChange={e => set("aircraftApplicability", e.target.value)}
                    placeholder="e.g. Boeing 737-800" className="bg-background border-border" />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="condition">Acceptable Condition</Label>
                  <Select value={form.condition} onValueChange={v => set("condition", v)}>
                    <SelectTrigger className="bg-background border-border">
                      <SelectValue placeholder="Any condition" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="any">Any condition</SelectItem>
                      {CONDITIONS.map(c => (
                        <SelectItem key={c} value={c}>{c}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </div>

            {error && (
              <p className="text-sm text-destructive bg-destructive/10 border border-destructive/20 rounded p-3">
                Failed to submit. Please check your details and try again.
              </p>
            )}

            <div className="flex items-center gap-3">
              <Button
                type="submit"
                disabled={isPending || (isAogSelected && !form.urgencyReason.trim())}
                className={isAogSelected
                  ? "bg-red-600 hover:bg-red-700 px-8"
                  : "bg-primary hover:bg-primary/90 px-8"
                }
              >
                {isPending ? "Submitting…" : isAogSelected ? "Submit AOG Request" : "Post RFQ"}
              </Button>
              <Link href="/rfqs">
                <Button type="button" variant="ghost" className="text-muted-foreground hover:text-white">
                  Cancel
                </Button>
              </Link>
            </div>
          </form>
        </div>
      </main>
      <Footer />
    </div>
  );
}
