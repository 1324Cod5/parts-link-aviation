import { useLocation } from "wouter";
import { Lock, Brain, TrendingUp, AlertTriangle, BarChart3, ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import MainLayout from "@/components/layout/MainLayout";
import { useAuth } from "@/context/AuthContext";
import { Link } from "wouter";

export default function SellerIntelligence() {
  const { user, isLoading } = useAuth();
  const [, navigate] = useLocation();

  if (isLoading) {
    return (
      <MainLayout>
        <div className="container mx-auto px-4 py-16 max-w-5xl">
          <div className="animate-pulse space-y-6">
            <div className="h-8 bg-secondary/30 rounded w-1/3" />
            <div className="grid grid-cols-3 gap-4">
              {[...Array(3)].map((_, i) => (
                <div key={i} className="h-32 bg-secondary/30 rounded-lg" />
              ))}
            </div>
          </div>
        </div>
      </MainLayout>
    );
  }

  if (!user || user.role !== "seller") {
    navigate("/seller/login");
    return null;
  }

  const plan = user.plan ?? "free";
  const isEnterprise = plan === "enterprise";

  if (!isEnterprise) {
    return (
      <MainLayout>
        <div className="container mx-auto px-4 py-16 max-w-xl">
          <div className="bg-card border border-amber-500/30 rounded-lg p-10 text-center space-y-6">
            <div className="mx-auto w-14 h-14 rounded-full bg-amber-500/10 flex items-center justify-center">
              <Lock className="h-7 w-7 text-amber-400" />
            </div>
            <div>
              <h2 className="text-xl font-bold text-white mb-2">Intelligence Dashboard — Enterprise Only</h2>
              <p className="text-muted-foreground text-sm leading-relaxed">
                Demand trend analysis, fraud risk indicators, and predictive inventory alerts are
                available exclusively on the Enterprise plan.
              </p>
            </div>
            <div className="grid grid-cols-1 gap-3 text-left text-sm">
              {[
                { icon: TrendingUp, label: "Demand trend charts", desc: "See which parts are trending in buyer RFQs" },
                { icon: AlertTriangle, label: "Fraud risk indicators", desc: "Surface risk signals on your listings" },
                { icon: BarChart3, label: "Predictive inventory alerts", desc: "Know what to stock before buyers ask" },
              ].map(({ icon: Icon, label, desc }) => (
                <div key={label} className="border border-border rounded-md p-4 bg-secondary/10 flex items-start gap-3">
                  <Icon className="h-4 w-4 text-amber-400 mt-0.5 flex-shrink-0" />
                  <div>
                    <p className="font-medium text-white text-xs">{label}</p>
                    <p className="text-muted-foreground text-xs mt-0.5">{desc}</p>
                  </div>
                </div>
              ))}
            </div>
            <div className="flex flex-col sm:flex-row gap-3 justify-center">
              <Link href="/pricing">
                <Button className="bg-amber-500 hover:bg-amber-600 text-black font-semibold w-full sm:w-auto">
                  Upgrade to Enterprise
                </Button>
              </Link>
              <Link href="/seller/dashboard">
                <Button variant="outline" className="w-full sm:w-auto">
                  Back to Dashboard
                </Button>
              </Link>
            </div>
          </div>
        </div>
      </MainLayout>
    );
  }

  return (
    <MainLayout>
      <div className="container mx-auto px-4 py-10 max-w-5xl space-y-8">
        <div className="flex items-center gap-4">
          <Link href="/seller/dashboard">
            <Button variant="ghost" size="sm" className="text-muted-foreground hover:text-white">
              <ArrowLeft className="h-4 w-4 mr-1.5" />
              Dashboard
            </Button>
          </Link>
          <div>
            <div className="flex items-center gap-2 mb-0.5">
              <Brain className="h-5 w-5 text-amber-400" />
              <h1 className="text-xl font-bold text-white">Intelligence Dashboard</h1>
              <span className="text-xs px-2 py-0.5 rounded bg-amber-500/20 text-amber-400 font-medium uppercase tracking-wide">
                Enterprise
              </span>
            </div>
            <p className="text-sm text-muted-foreground">
              Demand trends, fraud risk analysis, and predictive inventory alerts for your inventory.
            </p>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {[
            {
              icon: TrendingUp,
              title: "Demand Trends",
              desc: "Track which part numbers are trending in buyer RFQs over the past 30 days.",
              color: "text-emerald-400",
              bg: "border-emerald-500/20",
            },
            {
              icon: AlertTriangle,
              title: "Fraud Risk Indicators",
              desc: "Automated risk signals analysed against your active listings and buyer patterns.",
              color: "text-amber-400",
              bg: "border-amber-500/20",
            },
            {
              icon: BarChart3,
              title: "Predictive Alerts",
              desc: "AI-driven inventory recommendations based on AOG frequency and buyer demand spikes.",
              color: "text-blue-400",
              bg: "border-blue-500/20",
            },
          ].map(({ icon: Icon, title, desc, color, bg }) => (
            <div key={title} className={`bg-card border ${bg} rounded-lg p-6 space-y-3`}>
              <div className={`w-10 h-10 rounded-md bg-secondary/30 flex items-center justify-center`}>
                <Icon className={`h-5 w-5 ${color}`} />
              </div>
              <h3 className="font-semibold text-white">{title}</h3>
              <p className="text-sm text-muted-foreground leading-relaxed">{desc}</p>
              <div className="pt-2">
                <div className="h-24 rounded-md bg-secondary/20 border border-border flex items-center justify-center">
                  <p className="text-xs text-muted-foreground">Live data — coming in next release</p>
                </div>
              </div>
            </div>
          ))}
        </div>

        <div className="bg-card border border-border rounded-lg p-6">
          <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider mb-4">
            Market Demand Summary
          </h2>
          <div className="h-48 rounded-md bg-secondary/20 border border-border flex items-center justify-center">
            <div className="text-center space-y-2">
              <Brain className="h-8 w-8 text-muted-foreground mx-auto" />
              <p className="text-sm text-muted-foreground">Full demand analytics launching in the next release.</p>
              <p className="text-xs text-muted-foreground/60">Your Enterprise plan ensures day-one access.</p>
            </div>
          </div>
        </div>
      </div>
    </MainLayout>
  );
}
