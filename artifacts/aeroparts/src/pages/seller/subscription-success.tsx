import { useEffect, useState } from "react";
import { useSearch } from "wouter";
import { Link } from "wouter";
import { MainLayout } from "@/components/layout/MainLayout";
import { Button } from "@/components/ui/button";
import { CheckCircle2, Loader2, AlertTriangle } from "lucide-react";

export default function SubscriptionSuccessPage() {
  const search = useSearch();
  const params = new URLSearchParams(search.startsWith("?") ? search.slice(1) : search);
  const sessionId = params.get("session_id");

  const [state, setState] = useState<"loading" | "success" | "error">("loading");
  const [planName, setPlanName] = useState("");
  const [errMsg, setErrMsg] = useState("");

  useEffect(() => {
    if (!sessionId) {
      setState("error");
      setErrMsg("No session ID in URL. Check your payment confirmation email.");
      return;
    }

    fetch("/api/stripe/verify-session", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify({ sessionId }),
    })
      .then(r => r.json())
      .then(data => {
        if (data.ok) {
          setState("success");
          setPlanName(data.planName ?? data.plan ?? "");
        } else {
          setState("error");
          setErrMsg(data.error ?? "Verification failed. Your payment was received — contact support if your plan wasn't updated.");
        }
      })
      .catch((err: Error) => {
        setState("error");
        setErrMsg(err.message ?? "Network error. Your payment was received — please refresh.");
      });
  }, [sessionId]);

  return (
    <MainLayout>
      <div className="flex items-center justify-center min-h-[calc(100vh-200px)] px-4">
        <div className="max-w-md w-full text-center">
          {state === "loading" && (
            <>
              <Loader2 className="h-14 w-14 animate-spin text-primary mx-auto mb-6" />
              <h1 className="text-2xl font-bold text-white mb-2">Confirming your subscription…</h1>
              <p className="text-muted-foreground text-sm">Verifying payment with Stripe. This takes just a moment.</p>
            </>
          )}

          {state === "success" && (
            <>
              <div className="w-20 h-20 rounded-full bg-emerald-500/15 border border-emerald-500/30 flex items-center justify-center mx-auto mb-6">
                <CheckCircle2 className="h-10 w-10 text-emerald-400" />
              </div>
              <h1 className="text-3xl font-bold text-white mb-3">You're all set!</h1>
              {planName && (
                <div className="inline-flex items-center gap-2 bg-primary/10 border border-primary/20 rounded-full px-4 py-1.5 mb-4">
                  <span className="text-primary font-semibold text-sm">{planName} plan activated</span>
                </div>
              )}
              <p className="text-muted-foreground mb-8">
                Your subscription is now active. All premium features are unlocked and ready to use.
              </p>
              <div className="flex flex-col sm:flex-row gap-3 justify-center">
                <Link href="/seller/dashboard">
                  <Button className="w-full sm:w-auto px-6">Go to Dashboard</Button>
                </Link>
                <Link href="/marketplace">
                  <Button variant="outline" className="w-full sm:w-auto px-6 border-border text-muted-foreground hover:text-white">
                    Browse Parts
                  </Button>
                </Link>
              </div>
            </>
          )}

          {state === "error" && (
            <>
              <div className="w-20 h-20 rounded-full bg-amber-500/15 border border-amber-500/30 flex items-center justify-center mx-auto mb-6">
                <AlertTriangle className="h-10 w-10 text-amber-400" />
              </div>
              <h1 className="text-2xl font-bold text-white mb-3">Payment Received</h1>
              <p className="text-muted-foreground mb-2 text-sm">
                Your payment was processed but we couldn't automatically confirm your plan. Our team will update it shortly.
              </p>
              {errMsg && (
                <p className="text-xs text-muted-foreground/50 mb-6 font-mono bg-secondary/30 rounded px-3 py-2">{errMsg}</p>
              )}
              <div className="flex flex-col sm:flex-row gap-3 justify-center">
                <Link href="/seller/dashboard">
                  <Button className="w-full sm:w-auto">Go to Dashboard</Button>
                </Link>
                <Link href="/contact">
                  <Button variant="outline" className="w-full sm:w-auto border-border text-muted-foreground hover:text-white">
                    Contact Support
                  </Button>
                </Link>
              </div>
            </>
          )}
        </div>
      </div>
    </MainLayout>
  );
}
