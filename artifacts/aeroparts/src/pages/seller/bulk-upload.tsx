import { useRef, useState } from "react";
import { Link, useLocation } from "wouter";
import { MainLayout } from "@/components/layout/MainLayout";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/context/AuthContext";
import { useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import { getGetSellerListingsQueryKey, getGetSellerStatsQueryKey } from "@workspace/api-client-react";
import type { BulkParsedRow, BulkInvalidRow } from "@workspace/api-client-react";
import {
  ArrowLeft, Upload, FileSpreadsheet, Download, CheckCircle2, XCircle,
  AlertTriangle, Loader2, ChevronRight, Package, Lock, Zap, RefreshCw,
} from "lucide-react";
import { useGetSubscription, getGetSubscriptionQueryKey } from "@workspace/api-client-react";

// ─── Constants ────────────────────────────────────────────────────────────────

const CONDITION_LABELS: Record<string, string> = {
  new: "New",
  overhauled: "Overhauled",
  serviceable: "Serviceable",
  as_removed: "As Removed",
  repaired: "Repaired",
};

const SALE_TYPE_LABELS: Record<string, string> = {
  outright: "Outright",
  exchange: "Exchange",
  both: "Both",
};

function formatPrice(price: number | null) {
  if (price == null) return "POA";
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 }).format(price);
}

// ─── Step type ────────────────────────────────────────────────────────────────

type Step = "upload" | "preview" | "confirm" | "done";

interface ParseResult {
  valid: BulkParsedRow[];
  invalid: BulkInvalidRow[];
  totalRows: number;
  fileName: string;
}

interface ImportResult {
  imported: number;
  skipped: number;
  limitReached: boolean;
  listingIds: number[];
  remainingSlots: number | null;
}

// ─── Plan limit labels ─────────────────────────────────────────────────────────

const PLAN_LIMIT_LABELS: Record<string, string> = {
  free: "5 listings",
  pro: "500 listings",
  enterprise: "Unlimited",
  mro_verified: "500 listings",
  mro_premium: "Unlimited",
  mro_provider: "500 listings",
};

// ─── Component ────────────────────────────────────────────────────────────────

export default function BulkUpload() {
  const { user, isLoading: authLoading } = useAuth();
  const [, navigate] = useLocation();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [step, setStep] = useState<Step>("upload");
  const [dragging, setDragging] = useState(false);
  const [parsing, setParsing] = useState(false);
  const [importing, setImporting] = useState(false);
  const [parseResult, setParseResult] = useState<ParseResult | null>(null);
  const [importResult, setImportResult] = useState<ImportResult | null>(null);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);

  // Subscription status — must be called before any conditional returns (rules of hooks)
  const { data: subscription } = useGetSubscription({ query: { queryKey: getGetSubscriptionQueryKey(), retry: false } });

  // ─── Auth guard ──────────────────────────────────────────────────────────────

  if (authLoading) {
    return (
      <MainLayout>
        <div className="container mx-auto px-4 py-24 text-center text-muted-foreground">
          <div className="inline-block w-6 h-6 border-2 border-primary border-t-transparent rounded-full animate-spin mb-3" />
          <p className="text-sm">Verifying session…</p>
        </div>
      </MainLayout>
    );
  }

  if (!user) {
    return (
      <MainLayout>
        <div className="container mx-auto px-4 py-16 text-center">
          <p className="text-muted-foreground mb-4">You must be signed in to upload inventory.</p>
          <Link href="/seller/login"><Button>Sign In</Button></Link>
        </div>
      </MainLayout>
    );
  }

  const subscriptionStatus = (subscription as any)?.subscriptionStatus as string | undefined;

  const plan = (user.plan ?? "free") as string;
  const planLabel = PLAN_LIMIT_LABELS[plan] ?? "5 listings";
  const isPlanQualified = plan === "pro" || plan === "enterprise" || plan === "mro_verified" || plan === "mro_premium" || plan === "mro_provider";
  // Treat past_due as still active — backend enforces the 7-day grace window
  const isSubscriptionActive =
    !subscriptionStatus ||
    subscriptionStatus === "active" ||
    subscriptionStatus === "trial" ||
    subscriptionStatus === "past_due";
  const isBulkEnabled = isPlanQualified && isSubscriptionActive;

  // ─── Subscription lapsed gate — plan is right but payment failed ──────────────

  if (isPlanQualified && !isSubscriptionActive) {
    return (
      <MainLayout>
        <div className="container mx-auto px-4 py-16 max-w-xl">
          <div className="bg-card border border-red-500/30 rounded-lg p-10 text-center space-y-6">
            <div className="w-14 h-14 bg-red-500/10 rounded-full flex items-center justify-center mx-auto">
              <Lock className="h-7 w-7 text-red-400" />
            </div>
            <div>
              <h2 className="text-xl font-bold text-white mb-2">Subscription Inactive</h2>
              <p className="text-muted-foreground text-sm leading-relaxed">
                Bulk upload requires an active{" "}
                <span className="text-white font-medium capitalize">{plan}</span>{" "}
                subscription. Your subscription is currently{" "}
                <span className="text-red-400 font-medium">{subscriptionStatus ?? "inactive"}</span>.
              </p>
            </div>
            <div className="flex flex-col sm:flex-row gap-3 justify-center pt-2">
              <Link href="/seller/subscription">
                <Button className="bg-primary hover:bg-primary/90 gap-2 w-full sm:w-auto">
                  <RefreshCw className="h-4 w-4" />
                  Manage Subscription
                </Button>
              </Link>
              <Link href="/seller/dashboard">
                <Button variant="outline" className="border-border text-muted-foreground hover:text-white w-full sm:w-auto">
                  Back to Dashboard
                </Button>
              </Link>
            </div>
          </div>
        </div>
      </MainLayout>
    );
  }

  // ─── Plan gate — Pro/Enterprise only ─────────────────────────────────────────

  if (!isBulkEnabled) {
    return (
      <MainLayout>
        <div className="container mx-auto px-4 py-16 max-w-xl">
          <div className="bg-card border border-amber-500/30 rounded-lg p-10 text-center space-y-6">
            <div className="w-14 h-14 bg-amber-500/10 rounded-full flex items-center justify-center mx-auto">
              <Lock className="h-7 w-7 text-amber-400" />
            </div>
            <div>
              <h2 className="text-xl font-bold text-white mb-2">Bulk Upload — Pro &amp; Enterprise Only</h2>
              <p className="text-muted-foreground text-sm leading-relaxed">
                Import an entire parts inventory in one go. Available on{" "}
                <span className="text-white font-medium">Pro</span> and{" "}
                <span className="text-white font-medium">Enterprise</span> plans.
              </p>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-left text-sm">
              <div className="border border-border rounded-md p-4 bg-secondary/20">
                <p className="font-semibold text-white mb-2">Pro — $29/mo</p>
                <ul className="space-y-1.5 text-xs text-muted-foreground">
                  <li className="flex items-center gap-1.5">
                    <CheckCircle2 className="h-3 w-3 text-emerald-400 flex-shrink-0" />
                    Up to 500 rows per upload
                  </li>
                  <li className="flex items-center gap-1.5">
                    <CheckCircle2 className="h-3 w-3 text-emerald-400 flex-shrink-0" />
                    Excel (.xlsx) &amp; CSV support
                  </li>
                  <li className="flex items-center gap-1.5">
                    <CheckCircle2 className="h-3 w-3 text-emerald-400 flex-shrink-0" />
                    Preview &amp; validate before import
                  </li>
                </ul>
              </div>
              <div className="border border-primary/30 rounded-md p-4 bg-primary/5">
                <p className="font-semibold text-white mb-2">Enterprise — $99/mo</p>
                <ul className="space-y-1.5 text-xs text-muted-foreground">
                  <li className="flex items-center gap-1.5">
                    <CheckCircle2 className="h-3 w-3 text-emerald-400 flex-shrink-0" />
                    Unlimited rows per upload
                  </li>
                  <li className="flex items-center gap-1.5">
                    <CheckCircle2 className="h-3 w-3 text-emerald-400 flex-shrink-0" />
                    Everything in Pro
                  </li>
                  <li className="flex items-center gap-1.5">
                    <CheckCircle2 className="h-3 w-3 text-emerald-400 flex-shrink-0" />
                    Dedicated account support
                  </li>
                </ul>
              </div>
            </div>
            <div className="flex flex-col sm:flex-row gap-3 justify-center pt-2">
              <Link href="/pricing">
                <Button className="bg-primary hover:bg-primary/90 gap-2 w-full sm:w-auto">
                  <Zap className="h-4 w-4" />
                  View Upgrade Options
                </Button>
              </Link>
              <Link href="/seller/dashboard">
                <Button variant="outline" className="border-border text-muted-foreground hover:text-white w-full sm:w-auto">
                  Back to Dashboard
                </Button>
              </Link>
            </div>
          </div>
        </div>
      </MainLayout>
    );
  }

  // ─── Parse handler ────────────────────────────────────────────────────────────

  async function handleFile(file: File) {
    if (!file.name.endsWith(".xlsx") && !file.name.endsWith(".csv")) {
      toast({ title: "Unsupported file type", description: "Please upload a .xlsx or .csv file.", variant: "destructive" });
      return;
    }

    setSelectedFile(file);
    setParsing(true);

    const formData = new FormData();
    formData.append("file", file);

    try {
      const res = await fetch("/api/seller/bulk-upload/parse", {
        method: "POST",
        body: formData,
        credentials: "include",
      });
      const data = await res.json();
      if (!res.ok) {
        toast({ title: "Parse failed", description: data.error ?? "Unknown error", variant: "destructive" });
        return;
      }
      setParseResult(data as ParseResult);
      setStep("preview");
    } catch {
      toast({ title: "Network error", description: "Could not reach the server.", variant: "destructive" });
    } finally {
      setParsing(false);
    }
  }

  // ─── Import handler ────────────────────────────────────────────────────────────

  async function handleImport() {
    if (!parseResult || parseResult.valid.length === 0) return;
    setImporting(true);

    try {
      const res = await fetch("/api/seller/bulk-upload/import", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ rows: parseResult.valid }),
      });
      const data = await res.json();
      if (!res.ok) {
        toast({ title: "Import failed", description: data.error ?? "Unknown error", variant: "destructive" });
        return;
      }
      setImportResult(data as ImportResult);
      setStep("done");
      queryClient.invalidateQueries({ queryKey: getGetSellerListingsQueryKey() });
      queryClient.invalidateQueries({ queryKey: getGetSellerStatsQueryKey() });
    } catch {
      toast({ title: "Network error", description: "Could not reach the server.", variant: "destructive" });
    } finally {
      setImporting(false);
    }
  }

  // ─── Drag-and-drop ─────────────────────────────────────────────────────────────

  function handleDrop(e: React.DragEvent) {
    e.preventDefault();
    setDragging(false);
    const file = e.dataTransfer.files[0];
    if (file) handleFile(file);
  }

  // ─── Render ───────────────────────────────────────────────────────────────────

  return (
    <MainLayout>
      <div className="container mx-auto px-4 py-8 max-w-5xl">
        {/* Header */}
        <div className="flex items-center gap-4 mb-8">
          <Link href="/seller/dashboard">
            <Button variant="ghost" size="sm" className="text-muted-foreground hover:text-white">
              <ArrowLeft className="h-4 w-4 mr-1" /> Dashboard
            </Button>
          </Link>
          <div className="flex-1">
            <h1 className="text-2xl font-bold text-white">Bulk Upload Inventory</h1>
            <p className="text-muted-foreground text-sm mt-0.5">
              Import multiple parts at once from Excel or CSV — plan limit: <span className="text-white font-medium">{planLabel}</span>
            </p>
          </div>
          <a href="/api/seller/bulk-upload/template" download="aeroparts-bulk-template.csv">
            <Button variant="outline" size="sm" className="flex items-center gap-2 border-border">
              <Download className="h-4 w-4" /> Download Template
            </Button>
          </a>
        </div>

        {/* Progress steps */}
        <div className="flex items-center gap-2 mb-8">
          {(["upload", "preview", "confirm", "done"] as Step[]).map((s, i, arr) => (
            <div key={s} className="flex items-center gap-2">
              <div className={`flex items-center gap-2 px-3 py-1.5 rounded text-xs font-medium transition-colors ${
                step === s ? "bg-primary/20 text-primary border border-primary/40" :
                (["upload", "preview", "confirm", "done"].indexOf(step) > i) ? "bg-green-500/10 text-green-400 border border-green-500/30" :
                "text-muted-foreground border border-border"
              }`}>
                {(["upload", "preview", "confirm", "done"].indexOf(step) > i) ? (
                  <CheckCircle2 className="h-3 w-3" />
                ) : (
                  <span>{i + 1}</span>
                )}
                {s.charAt(0).toUpperCase() + s.slice(1)}
              </div>
              {i < arr.length - 1 && <ChevronRight className="h-4 w-4 text-muted-foreground/40" />}
            </div>
          ))}
        </div>

        {/* ── Step 1: Upload ── */}
        {step === "upload" && (
          <div
            className={`relative border-2 border-dashed rounded-lg p-16 text-center transition-colors ${
              dragging ? "border-primary bg-primary/5" : "border-border hover:border-border/80"
            }`}
            onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
            onDragLeave={() => setDragging(false)}
            onDrop={handleDrop}
          >
            <input
              ref={fileInputRef}
              type="file"
              accept=".xlsx,.csv"
              className="hidden"
              onChange={(e) => { const f = e.target.files?.[0]; if (f) handleFile(f); }}
            />
            {parsing ? (
              <div className="flex flex-col items-center gap-3">
                <Loader2 className="h-10 w-10 text-primary animate-spin" />
                <p className="text-white font-medium">Parsing file…</p>
              </div>
            ) : (
              <div className="flex flex-col items-center gap-4">
                <div className="w-16 h-16 bg-primary/10 rounded-full flex items-center justify-center">
                  <FileSpreadsheet className="h-8 w-8 text-primary" />
                </div>
                <div>
                  <p className="text-white font-medium text-lg">Drop your spreadsheet here</p>
                  <p className="text-muted-foreground text-sm mt-1">Supports .xlsx and .csv files</p>
                </div>
                <Button onClick={() => fileInputRef.current?.click()} className="mt-2">
                  <Upload className="h-4 w-4 mr-2" /> Browse File
                </Button>
              </div>
            )}
          </div>
        )}

        {/* ── Step 2: Preview ── */}
        {step === "preview" && parseResult && (
          <div className="space-y-6">
            {/* Summary bar */}
            <div className="grid grid-cols-3 gap-4">
              <div className="bg-card border border-border rounded-md p-4 text-center">
                <p className="text-3xl font-bold text-white font-mono">{parseResult.totalRows}</p>
                <p className="text-xs text-muted-foreground mt-1 uppercase tracking-wider">Total Rows</p>
              </div>
              <div className="bg-card border border-green-500/30 rounded-md p-4 text-center">
                <p className="text-3xl font-bold text-green-400 font-mono">{parseResult.valid.length}</p>
                <p className="text-xs text-muted-foreground mt-1 uppercase tracking-wider">Ready to Import</p>
              </div>
              <div className={`bg-card rounded-md p-4 text-center border ${parseResult.invalid.length > 0 ? "border-red-500/30" : "border-border"}`}>
                <p className={`text-3xl font-bold font-mono ${parseResult.invalid.length > 0 ? "text-red-400" : "text-muted-foreground"}`}>
                  {parseResult.invalid.length}
                </p>
                <p className="text-xs text-muted-foreground mt-1 uppercase tracking-wider">Invalid Rows</p>
              </div>
            </div>

            {/* Valid rows table */}
            {parseResult.valid.length > 0 && (
              <div className="bg-card border border-green-500/20 rounded-md overflow-hidden">
                <div className="flex items-center gap-2 px-4 py-3 bg-green-500/5 border-b border-green-500/20">
                  <CheckCircle2 className="h-4 w-4 text-green-400" />
                  <h3 className="text-sm font-semibold text-green-300">
                    Valid Rows ({parseResult.valid.length}) — will be imported
                  </h3>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-border/50 text-muted-foreground text-xs uppercase tracking-wider">
                        <th className="text-left px-4 py-2">#</th>
                        <th className="text-left px-4 py-2">Part Number</th>
                        <th className="text-left px-4 py-2">Description</th>
                        <th className="text-left px-4 py-2">Condition</th>
                        <th className="text-left px-4 py-2">Qty</th>
                        <th className="text-left px-4 py-2">Sale Type</th>
                        <th className="text-right px-4 py-2">Price</th>
                      </tr>
                    </thead>
                    <tbody>
                      {parseResult.valid.map((row) => (
                        <tr key={row.rowNumber} className="border-b border-border/30 hover:bg-secondary/20">
                          <td className="px-4 py-2.5 text-muted-foreground text-xs">{row.rowNumber}</td>
                          <td className="px-4 py-2.5 font-mono text-white text-xs">{row.partNumber}</td>
                          <td className="px-4 py-2.5 text-white/80 max-w-56 truncate">{row.description}</td>
                          <td className="px-4 py-2.5">
                            <span className="text-xs bg-secondary/40 text-white/70 px-2 py-0.5 rounded">
                              {CONDITION_LABELS[row.condition] ?? row.condition}
                            </span>
                          </td>
                          <td className="px-4 py-2.5 font-mono text-white/80">{row.quantity}</td>
                          <td className="px-4 py-2.5 text-white/70 text-xs">{SALE_TYPE_LABELS[row.saleType] ?? row.saleType}</td>
                          <td className="px-4 py-2.5 text-right font-mono text-white/80">{formatPrice(row.price ?? null)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {/* Invalid rows table */}
            {parseResult.invalid.length > 0 && (
              <div className="bg-card border border-red-500/20 rounded-md overflow-hidden">
                <div className="flex items-center gap-2 px-4 py-3 bg-red-500/5 border-b border-red-500/20">
                  <XCircle className="h-4 w-4 text-red-400" />
                  <h3 className="text-sm font-semibold text-red-300">
                    Invalid Rows ({parseResult.invalid.length}) — will be skipped
                  </h3>
                </div>
                <div className="divide-y divide-border/30">
                  {parseResult.invalid.map((row) => (
                    <div key={row.rowNumber} className="px-4 py-3">
                      <div className="flex items-start gap-3">
                        <span className="text-xs text-muted-foreground font-mono mt-0.5 w-12 shrink-0">Row {row.rowNumber}</span>
                        <div className="flex-1 min-w-0">
                          <div className="flex flex-wrap gap-x-4 gap-y-0.5 text-xs text-muted-foreground mb-1.5">
                            {Object.entries(row.rawData)
                              .filter(([, v]) => v !== "")
                              .slice(0, 5)
                              .map(([k, v]) => (
                                <span key={k}><span className="text-white/40">{k}:</span> {String(v)}</span>
                              ))}
                          </div>
                          <div className="flex flex-col gap-0.5">
                            {row.errors.map((err, i) => (
                              <span key={i} className="text-xs text-red-400 flex items-center gap-1">
                                <span className="w-1 h-1 bg-red-400 rounded-full inline-block shrink-0" />
                                {err}
                              </span>
                            ))}
                          </div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Actions */}
            <div className="flex items-center justify-between pt-2">
              <Button
                variant="ghost"
                onClick={() => { setStep("upload"); setParseResult(null); setSelectedFile(null); }}
                className="text-muted-foreground"
              >
                <ArrowLeft className="h-4 w-4 mr-2" /> Upload Different File
              </Button>
              {parseResult.valid.length > 0 ? (
                <Button onClick={() => setStep("confirm")} className="flex items-center gap-2">
                  Continue to Confirm <ChevronRight className="h-4 w-4" />
                </Button>
              ) : (
                <p className="text-sm text-amber-400 flex items-center gap-2">
                  <AlertTriangle className="h-4 w-4" /> No valid rows to import. Fix errors and re-upload.
                </p>
              )}
            </div>
          </div>
        )}

        {/* ── Step 3: Confirm ── */}
        {step === "confirm" && parseResult && (
          <div className="max-w-xl mx-auto">
            <div className="bg-card border border-border rounded-lg p-8 text-center space-y-6">
              <div className="w-16 h-16 bg-primary/10 rounded-full flex items-center justify-center mx-auto">
                <Package className="h-8 w-8 text-primary" />
              </div>
              <div>
                <h2 className="text-xl font-bold text-white">Ready to import</h2>
                <p className="text-muted-foreground text-sm mt-2">
                  This will create <span className="text-white font-semibold">{parseResult.valid.length} new listing{parseResult.valid.length !== 1 ? "s" : ""}</span> from{" "}
                  <span className="font-mono text-white/70">{selectedFile?.name}</span>.
                </p>
                {parseResult.invalid.length > 0 && (
                  <p className="text-amber-400/80 text-xs mt-3 flex items-center justify-center gap-1.5">
                    <AlertTriangle className="h-3.5 w-3.5" />
                    {parseResult.invalid.length} invalid row{parseResult.invalid.length !== 1 ? "s" : ""} will be skipped.
                  </p>
                )}
              </div>
              <div className="bg-secondary/30 border border-border rounded-md p-4 text-left space-y-2">
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Rows to import</span>
                  <span className="text-white font-mono">{parseResult.valid.length}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Rows to skip</span>
                  <span className="text-white/60 font-mono">{parseResult.invalid.length}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Plan</span>
                  <span className="text-white capitalize">{plan}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Plan limit</span>
                  <span className="text-white">{planLabel}</span>
                </div>
              </div>
              <div className="flex gap-3 pt-2">
                <Button
                  variant="outline"
                  className="flex-1 border-border"
                  onClick={() => setStep("preview")}
                  disabled={importing}
                >
                  Back to Preview
                </Button>
                <Button
                  className="flex-1"
                  onClick={handleImport}
                  disabled={importing}
                >
                  {importing ? (
                    <><Loader2 className="h-4 w-4 mr-2 animate-spin" /> Importing…</>
                  ) : (
                    <>Confirm Import</>
                  )}
                </Button>
              </div>
            </div>
          </div>
        )}

        {/* ── Step 4: Done ── */}
        {step === "done" && importResult && (
          <div className="max-w-xl mx-auto">
            <div className="bg-card border border-green-500/30 rounded-lg p-8 text-center space-y-6">
              <div className="w-16 h-16 bg-green-500/10 rounded-full flex items-center justify-center mx-auto">
                <CheckCircle2 className="h-8 w-8 text-green-400" />
              </div>
              <div>
                <h2 className="text-xl font-bold text-white">Import complete</h2>
                <p className="text-muted-foreground text-sm mt-2">
                  <span className="text-green-400 font-semibold">{importResult.imported} listing{importResult.imported !== 1 ? "s" : ""}</span> created successfully.
                </p>
              </div>
              {importResult.limitReached && (
                <div className="flex items-start gap-3 p-4 bg-amber-500/10 border border-amber-500/30 rounded-md text-left">
                  <AlertTriangle className="h-4 w-4 text-amber-400 shrink-0 mt-0.5" />
                  <div>
                    <p className="text-amber-300 font-medium text-sm">Plan limit reached</p>
                    <p className="text-amber-400/80 text-xs mt-1">
                      {importResult.skipped} row{importResult.skipped !== 1 ? "s" : ""} were skipped because you've reached your {plan} plan limit.{" "}
                      <Link href="/pricing" className="underline hover:text-amber-300">Upgrade to import more.</Link>
                    </p>
                  </div>
                </div>
              )}
              <div className="bg-secondary/30 border border-border rounded-md p-4 text-left space-y-2">
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Imported</span>
                  <span className="text-green-400 font-mono">{importResult.imported}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Skipped</span>
                  <span className="text-white/60 font-mono">{importResult.skipped}</span>
                </div>
                {importResult.remainingSlots !== null && (
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Remaining slots</span>
                    <span className="text-white font-mono">{importResult.remainingSlots - importResult.imported}</span>
                  </div>
                )}
              </div>
              <div className="flex gap-3 pt-2">
                <Button
                  variant="outline"
                  className="flex-1 border-border"
                  onClick={() => { setStep("upload"); setParseResult(null); setImportResult(null); setSelectedFile(null); }}
                >
                  Upload Another File
                </Button>
                <Button className="flex-1" onClick={() => navigate("/seller/dashboard")}>
                  Go to Dashboard
                </Button>
              </div>
            </div>
          </div>
        )}

        {/* Template helper info */}
        {step === "upload" && !parsing && (
          <div className="mt-8 border border-border/50 rounded-md p-5 bg-card/50">
            <h3 className="text-sm font-semibold text-white mb-3 flex items-center gap-2">
              <FileSpreadsheet className="h-4 w-4 text-primary" /> Required columns
            </h3>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              {[
                { col: "Part Number", note: "Required" },
                { col: "Description", note: "Required" },
                { col: "Condition", note: "new / overhauled / serviceable / as_removed / repaired" },
                { col: "Quantity", note: "Positive integer" },
                { col: "Price Type", note: "outright / exchange / both" },
                { col: "Price", note: "Number or blank for POA" },
                { col: "Manufacturer", note: "Optional" },
                { col: "Aircraft Type", note: "Optional" },
              ].map(({ col, note }) => (
                <div key={col} className="bg-secondary/30 rounded p-3">
                  <p className="text-xs font-mono text-white">{col}</p>
                  <p className="text-xs text-muted-foreground mt-1">{note}</p>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </MainLayout>
  );
}
