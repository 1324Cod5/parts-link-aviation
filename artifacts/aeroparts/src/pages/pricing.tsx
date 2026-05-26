import { useState } from "react";
import { Link, useLocation } from "wouter";
import { MainLayout } from "@/components/layout/MainLayout";
import { useAuth } from "@/context/AuthContext";
import {
  useGetSubscription,
  getGetSubscriptionQueryKey,
  useGetSubscriptionProducts,
  useCreateCheckoutSession,
} from "@workspace/api-client-react";
import { useToast } from "@/hooks/use-toast";
import { Check, Zap, Building2, Package, Wrench, Star, Brain, Radio, Upload, Loader2, CalendarDays } from "lucide-react";

// ─── Brand tokens ─────────────────────────────────────────────────────────────
const NAVY  = "#0a1628";
const BLUE  = "#1976d2";
const GOLD  = "#f5a623";
const CARD  = "#0d1f38";
const BORDER = "#1a3050";
const MUTED  = "#7ea8c8";

type BillingCycle = "monthly" | "yearly";

// ─── Plan definitions ─────────────────────────────────────────────────────────
// planKey maps to the backend Stripe product metadata.plan value
const PLANS = [
  {
    planKey: "pro",
    name: "Solo Operator",
    tag: null as string | null,
    monthlyPrice: 149,
    yearlyPrice: 1430,   // ~20% off ($119/mo equiv)
    yearlyMonthly: 119,
    featured: false,
    cta: "Start Free Trial",
    ctaMode: "checkout" as "checkout" | "contact",
    features: [
      "50 searches per month",
      "1.2M part catalog access",
      "Email support",
      "PDF export reports",
      "Basic price history",
    ],
  },
  {
    planKey: "enterprise",
    name: "Fleet Manager",
    tag: "MOST POPULAR",
    monthlyPrice: 349,
    yearlyPrice: 3350,   // ~20% off ($279/mo equiv)
    yearlyMonthly: 279,
    featured: true,
    cta: "Start Free Trial",
    ctaMode: "checkout" as "checkout" | "contact",
    features: [
      "Unlimited searches",
      "Full 4.2M catalog",
      "AOG hotline access",
      "Real-time price benchmarking",
      "Watchlist alerts",
      "24/7 priority support",
      "API access",
    ],
  },
  {
    planKey: "enterprise",   // falls back to enterprise Stripe product; CTA routes to demo
    name: "Mission Control",
    tag: "ENTERPRISE",
    monthlyPrice: 799,
    yearlyPrice: 7670,   // ~20% off ($639/mo equiv)
    yearlyMonthly: 639,
    featured: false,
    cta: "Book a Demo",
    ctaMode: "contact" as "checkout" | "contact",
    features: [
      "Everything in Fleet Manager",
      "ERP & MRO integration",
      "Dedicated account manager",
      "Custom contracts & SLA",
      "White-glove AOG response",
      "Multi-user seats (unlimited)",
      "On-site training",
    ],
  },
];

const MRO_TIER = {
  planKey: "mro_provider",
  name: "MRO Provider",
  monthlyPrice: 10,
  yearlyPrice: 100,
  yearlyMonthly: 8,
  cta: "Get MRO Provider",
  features: [
    "Full MRO profile listing",
    "Unlimited service categories",
    "Capability document references",
    "Priority directory placement",
    "Verified MRO badge",
    "Email notification on new quotes",
    "Full RFQ buyer contact access",
    "Analytics & quote tracking",
  ],
};

// ─── Helpers ──────────────────────────────────────────────────────────────────
function fmtPrice(n: number) {
  return n.toLocaleString();
}

// ─── Sub-components ───────────────────────────────────────────────────────────
function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <div style={{
      display: "inline-block",
      background: `rgba(25,118,210,0.12)`,
      border: `1px solid rgba(25,118,210,0.3)`,
      borderRadius: 4, padding: "4px 14px", marginBottom: 16,
    }}>
      <span style={{
        fontFamily: "'Barlow Condensed', sans-serif", fontWeight: 700,
        fontSize: 12, color: BLUE, letterSpacing: "0.08em", textTransform: "uppercase",
      }}>{children}</span>
    </div>
  );
}

function GoldLabel({ children }: { children: React.ReactNode }) {
  return (
    <div style={{
      display: "inline-block",
      background: `rgba(245,166,35,0.12)`,
      border: `1px solid rgba(245,166,35,0.3)`,
      borderRadius: 4, padding: "4px 14px", marginBottom: 16,
    }}>
      <span style={{
        fontFamily: "'Barlow Condensed', sans-serif", fontWeight: 700,
        fontSize: 12, color: GOLD, letterSpacing: "0.08em", textTransform: "uppercase",
      }}>{children}</span>
    </div>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────
export default function Pricing() {
  const { user } = useAuth();
  const [, navigate] = useLocation();
  const { toast } = useToast();
  const [checkingOutPlan, setCheckingOutPlan] = useState<string | null>(null);
  const [billingCycle, setBillingCycle] = useState<BillingCycle>("monthly");

  const checkoutMutation = useCreateCheckoutSession();

  const { data: subscription } = useGetSubscription({
    query: { enabled: !!user && user.role === "seller", queryKey: getGetSubscriptionQueryKey() },
  });
  const { data: productsData } = useGetSubscriptionProducts();

  const currentPlan = (subscription as any)?.effectivePlan ?? subscription?.plan ?? user?.plan ?? "free";

  const getPriceId = (planKey: string, cycle: BillingCycle): string | null => {
    if (!productsData?.products) return null;
    for (const product of productsData.products) {
      const meta = product.metadata as Record<string, string> | undefined;
      if (meta?.plan === planKey) {
        const targetInterval = cycle === "yearly" ? "year" : "month";
        const price = product.prices.find((p: any) => p.interval === targetInterval);
        return price?.id ?? product.prices.find((p: any) => p.interval === "month")?.id ?? null;
      }
    }
    return null;
  };

  const handleCheckout = async (planKey: string) => {
    if (!user) { navigate("/seller/login"); return; }
    const priceId = getPriceId(planKey, billingCycle);
    if (!priceId) {
      toast({ title: "Plan not available", description: "This plan isn't configured yet. Contact support or check back soon.", variant: "destructive" });
      return;
    }
    setCheckingOutPlan(planKey);
    checkoutMutation.mutate(
      { data: { priceId } },
      {
        onSuccess: (data: any) => {
          if (data?.url) { window.location.href = data.url; }
          else { toast({ title: "Checkout error", description: "No redirect URL returned.", variant: "destructive" }); setCheckingOutPlan(null); }
        },
        onError: (err: any) => {
          toast({ title: "Checkout failed", description: err?.response?.data?.error ?? "Please try again.", variant: "destructive" });
          setCheckingOutPlan(null);
        },
      },
    );
  };

  return (
    <MainLayout>
      <div style={{ background: NAVY, minHeight: "100vh" }}>
        <div style={{ maxWidth: 1140, margin: "0 auto", padding: "72px 24px 80px" }}>

          {/* ── Header ── */}
          <div style={{ textAlign: "center", marginBottom: 48 }}>
            <SectionLabel>Pricing</SectionLabel>
            <h1 style={{
              fontFamily: "'Barlow Condensed', sans-serif", fontWeight: 900,
              fontSize: "clamp(32px, 5vw, 56px)", color: "#fff",
              textTransform: "uppercase", lineHeight: 1.05, marginBottom: 12,
            }}>
              Plans for Every <span style={{ color: GOLD }}>Operation</span>
            </h1>
            <p style={{ fontFamily: "'Barlow', sans-serif", fontSize: 16, color: MUTED, marginBottom: 0 }}>
              No contracts. Cancel anytime. 14-day free trial on all plans.
            </p>
          </div>

          {/* ── Billing toggle ── */}
          <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 12, marginBottom: 48 }}>
            <div style={{
              display: "inline-flex", background: CARD, border: `1px solid ${BORDER}`,
              borderRadius: 10, padding: 4, gap: 4,
            }}>
              {(["monthly", "yearly"] as BillingCycle[]).map(cycle => (
                <button
                  key={cycle}
                  onClick={() => setBillingCycle(cycle)}
                  style={{
                    padding: "9px 28px", borderRadius: 7, border: "none", cursor: "pointer",
                    fontFamily: "'Barlow Condensed', sans-serif", fontWeight: 700,
                    fontSize: 14, letterSpacing: "0.06em", textTransform: "uppercase",
                    transition: "all 0.2s",
                    background: billingCycle === cycle ? BLUE : "transparent",
                    color: billingCycle === cycle ? "#fff" : MUTED,
                    display: "flex", alignItems: "center", gap: 7,
                  }}
                >
                  {cycle === "yearly" && <CalendarDays size={13} />}
                  {cycle === "monthly" ? "Monthly" : "Yearly"}
                </button>
              ))}
            </div>
            {billingCycle === "yearly" ? (
              <div style={{
                display: "inline-flex", alignItems: "center", gap: 6, fontSize: 12, fontWeight: 600,
                color: "#4ade80", background: "rgba(34,197,94,0.1)", border: "1px solid rgba(34,197,94,0.25)",
                borderRadius: 20, padding: "4px 14px", fontFamily: "'Barlow', sans-serif",
              }}>
                <Check size={12} strokeWidth={3} /> Save ~20% — pay for 10 months, get 12
              </div>
            ) : (
              <p style={{ fontFamily: "'Barlow', sans-serif", fontSize: 12, color: "#4a6480", margin: 0 }}>
                Switch to yearly to save ~20% on all plans
              </p>
            )}
          </div>

          {/* ── Plan cards ── */}
          <div style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fill, minmax(300px, 1fr))",
            gap: 20, marginBottom: 80,
          }}>
            {PLANS.map((plan, i) => {
              const isCurrentPlan = currentPlan === plan.planKey && plan.ctaMode !== "contact";
              const isLoading = checkingOutPlan === plan.planKey && plan.ctaMode === "checkout";
              const showYearly = billingCycle === "yearly";
              const displayPrice = showYearly ? plan.yearlyPrice : plan.monthlyPrice;
              const savings = plan.monthlyPrice * 12 - plan.yearlyPrice;

              return (
                <div
                  key={i}
                  style={{
                    background: plan.featured
                      ? `linear-gradient(180deg, rgba(25,118,210,0.15) 0%, ${CARD} 100%)`
                      : CARD,
                    border: plan.featured ? `2px solid ${BLUE}` : `1px solid ${BORDER}`,
                    borderRadius: 14, padding: "36px 28px",
                    position: "relative", overflow: "hidden", display: "flex", flexDirection: "column",
                    boxShadow: plan.featured ? `0 0 48px rgba(25,118,210,0.18)` : "none",
                  }}
                >
                  {/* Tag badge */}
                  {plan.tag && (
                    <div style={{
                      position: "absolute", top: 20, right: 20,
                      background: plan.featured ? BLUE : `rgba(245,166,35,0.15)`,
                      border: `1px solid ${plan.featured ? BLUE : "rgba(245,166,35,0.4)"}`,
                      borderRadius: 4, padding: "3px 10px",
                      fontFamily: "'Barlow Condensed', sans-serif", fontWeight: 800,
                      fontSize: 11, color: plan.featured ? "#fff" : GOLD,
                      letterSpacing: "0.06em", textTransform: "uppercase",
                    }}>{plan.tag}</div>
                  )}

                  {/* Plan name */}
                  <h2 style={{
                    fontFamily: "'Barlow Condensed', sans-serif", fontWeight: 800,
                    fontSize: 24, color: "#fff", marginBottom: 16,
                    textTransform: "uppercase", letterSpacing: "0.02em",
                  }}>{plan.name}</h2>

                  {/* Price */}
                  <div style={{ marginBottom: 28 }}>
                    <div style={{ display: "flex", alignItems: "baseline", gap: 3 }}>
                      <span style={{
                        fontFamily: "'Barlow Condensed', sans-serif", fontWeight: 900,
                        fontSize: 52, lineHeight: 1,
                        color: plan.featured ? "#60a5fa" : "#fff",
                      }}>
                        ${fmtPrice(displayPrice)}
                      </span>
                      <span style={{ fontFamily: "'Barlow', sans-serif", fontSize: 14, color: MUTED }}>
                        {showYearly ? "/yr" : "/mo"}
                      </span>
                    </div>
                    {showYearly ? (
                      <>
                        <p style={{ fontFamily: "'Barlow', sans-serif", fontSize: 13, color: MUTED, marginTop: 4 }}>
                          ~${plan.yearlyMonthly}/mo · billed annually
                        </p>
                        <div style={{
                          display: "inline-flex", alignItems: "center", gap: 5, marginTop: 8,
                          fontSize: 12, fontWeight: 600, color: "#4ade80",
                          background: "rgba(34,197,94,0.1)", border: "1px solid rgba(34,197,94,0.25)",
                          borderRadius: 20, padding: "3px 10px", fontFamily: "'Barlow', sans-serif",
                        }}>
                          <Check size={11} strokeWidth={3} /> Save ${fmtPrice(savings)}/yr
                        </div>
                      </>
                    ) : (
                      <p style={{ fontFamily: "'Barlow', sans-serif", fontSize: 13, color: MUTED, marginTop: 4 }}>
                        per month, billed monthly
                      </p>
                    )}
                  </div>

                  {/* Feature list */}
                  <div style={{ borderTop: `1px solid ${BORDER}`, paddingTop: 24, marginBottom: 28, flex: 1 }}>
                    {plan.features.map(f => (
                      <div key={f} style={{ display: "flex", alignItems: "flex-start", gap: 10, marginBottom: 13 }}>
                        <div style={{
                          width: 18, height: 18, borderRadius: "50%",
                          background: plan.featured ? "rgba(96,165,250,0.12)" : "rgba(34,197,94,0.1)",
                          border: `1px solid ${plan.featured ? "rgba(96,165,250,0.4)" : "rgba(34,197,94,0.4)"}`,
                          display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0, marginTop: 1,
                        }}>
                          <Check size={10} color={plan.featured ? "#60a5fa" : "#4ade80"} strokeWidth={3} />
                        </div>
                        <span style={{ fontFamily: "'Barlow', sans-serif", fontSize: 14, color: "#c8daea", lineHeight: 1.45 }}>{f}</span>
                      </div>
                    ))}
                  </div>

                  {/* CTA */}
                  {isCurrentPlan ? (
                    <div style={{
                      textAlign: "center", padding: "12px 0", borderRadius: 8,
                      border: `1px solid ${BORDER}`,
                      fontFamily: "'Barlow Condensed', sans-serif", fontWeight: 700,
                      fontSize: 14, letterSpacing: "0.06em", textTransform: "uppercase",
                      color: MUTED,
                    }}>Current Plan</div>
                  ) : plan.ctaMode === "contact" ? (
                    <a
                      href="mailto:sales@aeroparts.app"
                      style={{
                        display: "block", textAlign: "center", padding: "13px 0", borderRadius: 8,
                        background: "rgba(255,255,255,0.06)", border: `1px solid ${BORDER}`,
                        color: "#fff", textDecoration: "none",
                        fontFamily: "'Barlow Condensed', sans-serif", fontWeight: 700,
                        fontSize: 15, letterSpacing: "0.06em", textTransform: "uppercase",
                        transition: "all 0.2s",
                      }}
                      onMouseEnter={e => { e.currentTarget.style.background = "rgba(255,255,255,0.12)"; }}
                      onMouseLeave={e => { e.currentTarget.style.background = "rgba(255,255,255,0.06)"; }}
                    >{plan.cta}</a>
                  ) : !user ? (
                    <Link
                      href="/seller/register"
                      style={{
                        display: "block", textAlign: "center", padding: "13px 0", borderRadius: 8,
                        background: plan.featured ? BLUE : "rgba(255,255,255,0.06)",
                        border: plan.featured ? "none" : `1px solid ${BORDER}`,
                        color: "#fff", textDecoration: "none",
                        fontFamily: "'Barlow Condensed', sans-serif", fontWeight: 700,
                        fontSize: 15, letterSpacing: "0.06em", textTransform: "uppercase",
                      }}
                    >{plan.cta}</Link>
                  ) : (
                    <button
                      disabled={!!checkingOutPlan}
                      onClick={() => handleCheckout(plan.planKey)}
                      style={{
                        width: "100%", padding: "13px 0", borderRadius: 8,
                        background: plan.featured ? BLUE : "rgba(255,255,255,0.06)",
                        border: plan.featured ? "none" : `1px solid ${BORDER}`,
                        color: "#fff", cursor: checkingOutPlan ? "not-allowed" : "pointer",
                        fontFamily: "'Barlow Condensed', sans-serif", fontWeight: 700,
                        fontSize: 15, letterSpacing: "0.06em", textTransform: "uppercase",
                        display: "flex", alignItems: "center", justifyContent: "center", gap: 8,
                        opacity: checkingOutPlan && !isLoading ? 0.5 : 1,
                        transition: "all 0.2s",
                      }}
                      onMouseEnter={e => { if (!checkingOutPlan) e.currentTarget.style.opacity = "0.88"; }}
                      onMouseLeave={e => { e.currentTarget.style.opacity = "1"; }}
                    >
                      {isLoading ? (
                        <><Loader2 size={16} className="animate-spin" /> Redirecting…</>
                      ) : plan.cta}
                    </button>
                  )}
                </div>
              );
            })}
          </div>

          {/* ── Compare note ── */}
          <p style={{ textAlign: "center", fontFamily: "'Barlow', sans-serif", fontSize: 13, color: "#4a6480", marginBottom: 80 }}>
            Need custom volume pricing?{" "}
            <a href="mailto:sales@aeroparts.app" style={{ color: BLUE, textDecoration: "none" }}>Contact our sales team →</a>
          </p>

          {/* ── MRO Services section ── */}
          <div style={{ borderTop: `1px solid ${BORDER}`, paddingTop: 72, marginBottom: 72 }}>
            <div style={{ textAlign: "center", marginBottom: 48 }}>
              <GoldLabel>MRO Services</GoldLabel>
              <h2 style={{
                fontFamily: "'Barlow Condensed', sans-serif", fontWeight: 800,
                fontSize: "clamp(26px, 4vw, 42px)", color: "#fff",
                textTransform: "uppercase", marginBottom: 12,
              }}>MRO Directory Listings</h2>
              <p style={{ fontFamily: "'Barlow', sans-serif", fontSize: 15, color: MUTED, maxWidth: 540, margin: "0 auto" }}>
                Get discovered by airlines, operators, and fleet managers searching for certified maintenance, repair &amp; overhaul providers.
              </p>
            </div>

            <div style={{ maxWidth: 960, margin: "0 auto", display: "grid", gridTemplateColumns: "1fr 1fr", gap: 28 }} className="mro-grid">
              {/* MRO card */}
              <div style={{
                background: `linear-gradient(180deg, rgba(245,166,35,0.08) 0%, ${CARD} 100%)`,
                border: `2px solid rgba(245,166,35,0.35)`,
                borderRadius: 14, padding: "36px 28px",
                position: "relative", display: "flex", flexDirection: "column",
              }}>
                <div style={{
                  position: "absolute", top: 20, right: 20,
                  background: `rgba(245,166,35,0.15)`, border: `1px solid rgba(245,166,35,0.4)`,
                  borderRadius: 4, padding: "3px 10px",
                  fontFamily: "'Barlow Condensed', sans-serif", fontWeight: 800,
                  fontSize: 11, color: GOLD, letterSpacing: "0.06em", textTransform: "uppercase",
                }}>Single Plan</div>

                <h3 style={{
                  fontFamily: "'Barlow Condensed', sans-serif", fontWeight: 800,
                  fontSize: 24, color: "#fff", textTransform: "uppercase", marginBottom: 16,
                }}>{MRO_TIER.name}</h3>

                <div style={{ marginBottom: 24 }}>
                  <div style={{ display: "flex", alignItems: "baseline", gap: 3 }}>
                    <span style={{ fontFamily: "'Barlow Condensed', sans-serif", fontWeight: 900, fontSize: 52, color: GOLD, lineHeight: 1 }}>
                      ${billingCycle === "yearly" ? MRO_TIER.yearlyPrice : MRO_TIER.monthlyPrice}
                    </span>
                    <span style={{ fontFamily: "'Barlow', sans-serif", fontSize: 14, color: MUTED }}>
                      {billingCycle === "yearly" ? "/yr" : "/mo"}
                    </span>
                  </div>
                  {billingCycle === "yearly" ? (
                    <>
                      <p style={{ fontFamily: "'Barlow', sans-serif", fontSize: 13, color: MUTED, marginTop: 4 }}>~${MRO_TIER.yearlyMonthly}/mo · billed annually</p>
                      <div style={{ display: "inline-flex", alignItems: "center", gap: 5, marginTop: 8, fontSize: 12, fontWeight: 600, color: "#4ade80", background: "rgba(34,197,94,0.1)", border: "1px solid rgba(34,197,94,0.25)", borderRadius: 20, padding: "3px 10px", fontFamily: "'Barlow', sans-serif" }}>
                        <Check size={11} strokeWidth={3} /> Save $20/yr
                      </div>
                    </>
                  ) : (
                    <p style={{ fontFamily: "'Barlow', sans-serif", fontSize: 13, color: MUTED, marginTop: 4 }}>per month, billed monthly</p>
                  )}
                </div>

                <div style={{ borderTop: `1px solid ${BORDER}`, paddingTop: 22, marginBottom: 28, flex: 1 }}>
                  {MRO_TIER.features.map(f => (
                    <div key={f} style={{ display: "flex", alignItems: "flex-start", gap: 10, marginBottom: 13 }}>
                      <div style={{ width: 18, height: 18, borderRadius: "50%", background: "rgba(245,166,35,0.12)", border: "1px solid rgba(245,166,35,0.4)", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0, marginTop: 1 }}>
                        <Check size={10} color={GOLD} strokeWidth={3} />
                      </div>
                      <span style={{ fontFamily: "'Barlow', sans-serif", fontSize: 14, color: "#c8daea" }}>{f}</span>
                    </div>
                  ))}
                </div>

                {currentPlan === "mro_provider" || currentPlan === "mro_verified" || currentPlan === "mro_premium" ? (
                  <div style={{ textAlign: "center", padding: "12px 0", borderRadius: 8, border: `1px solid ${BORDER}`, fontFamily: "'Barlow Condensed', sans-serif", fontWeight: 700, fontSize: 14, letterSpacing: "0.06em", textTransform: "uppercase", color: MUTED }}>
                    Current Plan
                  </div>
                ) : !user ? (
                  <Link
                    href="/seller/register"
                    style={{ display: "block", textAlign: "center", padding: "13px 0", borderRadius: 8, background: GOLD, border: "none", color: NAVY, textDecoration: "none", fontFamily: "'Barlow Condensed', sans-serif", fontWeight: 800, fontSize: 15, letterSpacing: "0.06em", textTransform: "uppercase" }}
                  >{MRO_TIER.cta}</Link>
                ) : (
                  <button
                    disabled={!!checkingOutPlan}
                    onClick={() => handleCheckout(MRO_TIER.planKey)}
                    style={{ width: "100%", padding: "13px 0", borderRadius: 8, background: GOLD, border: "none", color: NAVY, cursor: checkingOutPlan ? "not-allowed" : "pointer", fontFamily: "'Barlow Condensed', sans-serif", fontWeight: 800, fontSize: 15, letterSpacing: "0.06em", textTransform: "uppercase", opacity: checkingOutPlan ? 0.5 : 1, display: "flex", alignItems: "center", justifyContent: "center", gap: 8 }}
                  >
                    {checkingOutPlan === MRO_TIER.planKey ? <><Loader2 size={16} className="animate-spin" /> Redirecting…</> : MRO_TIER.cta}
                  </button>
                )}
              </div>

              {/* Feature callouts */}
              <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
                {[
                  { icon: Star,   title: "Verified MRO Badge",          desc: "Display a trust badge on your directory listing. Buyers filter by verified providers — stand out from unverified listings." },
                  { icon: Radio,  title: "Quote Request Notifications",  desc: "Receive instant email alerts whenever a buyer submits a quote request matching your service categories." },
                  { icon: Upload, title: "Unlimited Service Categories", desc: "List every capability — airframe, engine, avionics, NDT, and more — with no cap on categories or sub-types." },
                  { icon: Brain,  title: "Analytics & Tracking",         desc: "See how many buyers viewed your profile, which services drive the most quote requests, and your response rate." },
                ].map(({ icon: Icon, title, desc }) => (
                  <div key={title} style={{ display: "flex", gap: 16, padding: "18px 20px", borderRadius: 10, border: `1px solid ${BORDER}`, background: CARD }}>
                    <div style={{ width: 38, height: 38, borderRadius: 8, background: "rgba(25,118,210,0.12)", border: `1px solid rgba(25,118,210,0.2)`, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                      <Icon size={16} color={BLUE} />
                    </div>
                    <div>
                      <p style={{ fontFamily: "'Barlow Condensed', sans-serif", fontWeight: 700, fontSize: 15, color: "#fff", marginBottom: 4 }}>{title}</p>
                      <p style={{ fontFamily: "'Barlow', sans-serif", fontSize: 13, color: MUTED, lineHeight: 1.6, margin: 0 }}>{desc}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* ── FAQ ── */}
          <div style={{ maxWidth: 700, margin: "0 auto", borderTop: `1px solid ${BORDER}`, paddingTop: 56 }}>
            <div style={{ textAlign: "center", marginBottom: 36 }}>
              <SectionLabel>FAQ</SectionLabel>
              <h2 style={{ fontFamily: "'Barlow Condensed', sans-serif", fontWeight: 800, fontSize: 34, color: "#fff", textTransform: "uppercase" }}>Common Questions</h2>
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 28 }}>
              {[
                { q: "What's the difference between monthly and yearly billing?", a: "Monthly billing charges your card each month. Yearly billing charges once per year and saves you roughly 20% — you pay for 10 months and get 12." },
                { q: "How does billing work?", a: "All plans are billed through Stripe. You'll be redirected to a secure Stripe Checkout page to enter your payment details. You can manage, upgrade, or cancel at any time via the billing portal." },
                { q: "What happens when I hit my search limit?", a: "Solo Operator includes 50 searches per month. Once reached, you'll be prompted to upgrade to Fleet Manager for unlimited searches." },
                { q: "What happens if my payment fails?", a: "You get a 7-day grace period while Stripe retries your payment. During that time your plan stays active. If payment isn't resolved after 7 days, your account is downgraded." },
                { q: "What is the AOG hotline?", a: "Fleet Manager and Mission Control subscribers get priority phone access to our 24/7 AOG sourcing desk. We source critical aircraft parts globally with average response times under 4 hours." },
                { q: "What does Mission Control include?", a: "Mission Control adds ERP & MRO system integrations, a dedicated account manager, custom SLA contracts, white-glove AOG response, and unlimited multi-user seats. Contact sales for a tailored quote." },
                { q: "Can I cancel at any time?", a: "Yes. Cancelling through the billing portal keeps your access active until the end of the current billing period, then downgrades to free access. No penalties or lock-ins." },
              ].map(({ q, a }) => (
                <div key={q} style={{ borderBottom: `1px solid ${BORDER}`, paddingBottom: 24 }}>
                  <h3 style={{ fontFamily: "'Barlow Condensed', sans-serif", fontWeight: 700, fontSize: 18, color: "#fff", marginBottom: 8 }}>{q}</h3>
                  <p style={{ fontFamily: "'Barlow', sans-serif", fontSize: 14, color: MUTED, lineHeight: 1.7, margin: 0 }}>{a}</p>
                </div>
              ))}
            </div>
          </div>

        </div>
      </div>

      {/* Responsive MRO grid */}
      <style>{`
        @media (max-width: 700px) { .mro-grid { grid-template-columns: 1fr !important; } }
      `}</style>
    </MainLayout>
  );
}
