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
import { CheckCircle2, ArrowLeft, Package } from "lucide-react";

const CONDITIONS = ["New", "Overhauled", "Serviceable", "As Removed", "Repaired"] as const;

export default function NewRfqPage() {
  const [, navigate] = useLocation();
  const [submitted, setSubmitted] = useState(false);
  const [rfqId, setRfqId] = useState<number | null>(null);

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
  });

  const { mutate: createRfq, isPending, error } = useCreateRfq({
    mutation: {
      onSuccess(data) {
        setRfqId(data.id);
        setSubmitted(true);
      },
    },
  });

  function set(field: keyof typeof form, value: string | number) {
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
        condition: form.condition || null,
        quantity: form.quantity,
      },
    });
  }

  if (submitted) {
    return (
      <div className="min-h-screen bg-background flex flex-col">
        <Navbar />
        <main className="flex-1 flex items-center justify-center py-20">
          <div className="max-w-md w-full mx-auto px-4 text-center">
            <div className="w-16 h-16 rounded-full bg-emerald-500/20 flex items-center justify-center mx-auto mb-6">
              <CheckCircle2 className="w-8 h-8 text-emerald-400" />
            </div>
            <h1 className="text-2xl font-bold text-white mb-2">RFQ Posted Successfully</h1>
            <p className="text-muted-foreground mb-8">
              Your request has been published to the AeroParts RFQ board. Qualified sellers will respond directly.
            </p>
            <div className="flex flex-col sm:flex-row gap-3 justify-center">
              <Link href={`/rfqs/${rfqId}`}>
                <Button className="w-full sm:w-auto">View Your RFQ</Button>
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
                    placeholder="Describe the part, certification requirements, urgency, and any other specifications…"
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
                      <SelectItem value="">Any condition</SelectItem>
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
              <Button type="submit" disabled={isPending} className="bg-primary hover:bg-primary/90 px-8">
                {isPending ? "Submitting…" : "Post RFQ"}
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
