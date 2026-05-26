import { useState, useEffect, useRef } from "react";
import { Link, useLocation } from "wouter";
import { Search, Menu, X, Check, Star, ChevronRight, Zap, Phone } from "lucide-react";
import {
  useGetMarketplaceStats,
  useGetFeaturedListings,
  getGetMarketplaceStatsQueryKey,
  getGetFeaturedListingsQueryKey,
} from "@workspace/api-client-react";
import { ListingCard } from "@/components/ui/listing-card";
import { Skeleton } from "@/components/ui/skeleton";
import { Card } from "@/components/ui/card";

// ─── Brand tokens ─────────────────────────────────────────────────────────────
const NAVY   = "#0a1628";
const BLUE   = "#1976d2";
const GOLD   = "#f5a623";
const DARK   = "#060e1a";
const CARD_BG = "#0d1f38";
const BORDER  = "#1a3050";

// ─── Static data ──────────────────────────────────────────────────────────────
const CATEGORIES = [
  { icon: "📡", name: "Avionics",        desc: "Navigation, comms & displays",   count: "312,400" },
  { icon: "🔥", name: "Engines & APU",   desc: "Turbofan, turboprop & APU units", count: "98,700"  },
  { icon: "⚙️", name: "Landing Gear",    desc: "Struts, actuators & doors",       count: "54,200"  },
  { icon: "💧", name: "Hydraulics",      desc: "Pumps, actuators & lines",        count: "87,500"  },
  { icon: "✈️", name: "Airframe",        desc: "Panels, frames & fairings",       count: "143,800" },
  { icon: "💺", name: "Interiors",       desc: "Seats, galleys & overhead bins",  count: "229,100" },
  { icon: "🛞", name: "Wheels & Brakes", desc: "Wheels, tires & brake assemblies",count: "31,600"  },
  { icon: "⚡", name: "Electrical",      desc: "Wiring, connectors & PCBs",       count: "176,300" },
];

const FEATURES = [
  { icon: "⚡", title: "AOG Emergency Response",       desc: "24/7 rapid-sourcing desk. Average response under 4 hours for aircraft-on-ground events worldwide." },
  { icon: "🛡️", title: "Verified Certification Docs",  desc: "Every part comes with traceable 8130-3, EASA Form 1, or equivalent airworthiness documentation." },
  { icon: "🌐", title: "Global Supplier Network",       desc: "4,200+ verified operators, MROs, and OEM distributors across 90+ countries." },
  { icon: "📊", title: "Real-Time Pricing Intelligence",desc: "Live market benchmarking so you know you're paying fair market value every time." },
  { icon: "🔔", title: "Smart Part Alerts",             desc: "Set watchlists for hard-to-find part numbers and get notified the moment stock appears." },
  { icon: "🔗", title: "ERP & MRO Integration",         desc: "Native connectors for AMOS, Ramco, SAP, and major MRO platforms. No manual re-keying." },
];

const STEPS = [
  { num: "01", title: "Submit Requirement",   desc: "Enter your part number, condition requirements, and urgency level. AOG requests are flagged immediately." },
  { num: "02", title: "Get Matched Quotes",   desc: "Verified suppliers respond in real time. Compare pricing, lead time, and certification documentation." },
  { num: "03", title: "Verify & Approve",     desc: "Review seller trust scores, certification docs, and audit history before committing." },
  { num: "04", title: "Receive & Return to Service", desc: "Parts ship with full documentation. Track delivery and log receipt directly in the platform." },
];

const PRICING = [
  {
    name: "Solo Operator",
    price: "$149",
    period: "/mo",
    tag: null,
    features: ["50 searches per month", "1.2M part catalog access", "Email support", "PDF export reports", "Basic price history"],
    cta: "Start Free Trial",
    href: "/seller/register",
    featured: false,
  },
  {
    name: "Fleet Manager",
    price: "$349",
    period: "/mo",
    tag: "MOST POPULAR",
    features: ["Unlimited searches", "Full 4.2M catalog", "AOG hotline access", "Real-time price benchmarking", "Watchlist alerts", "24/7 priority support", "API access"],
    cta: "Start Free Trial",
    href: "/seller/register",
    featured: true,
  },
  {
    name: "Mission Control",
    price: "$799",
    period: "/mo",
    tag: "ENTERPRISE",
    features: ["Everything in Fleet Manager", "ERP & MRO integration", "Dedicated account manager", "Custom contracts & SLA", "White-glove AOG response", "Multi-user seats (unlimited)", "On-site training"],
    cta: "Book a Demo",
    href: "/seller/register",
    featured: false,
  },
];

const TESTIMONIALS = [
  {
    stars: 5,
    quote: "Parts Link Aviation sourced a CFM56-7B HPT blade for us in under 3 hours during an AOG in Singapore. That's simply unmatched in this industry.",
    initials: "DM",
    name: "Capt. Daniel Morse",
    title: "VP of Maintenance, Pacific Air Cargo",
  },
  {
    stars: 5,
    quote: "We migrated our entire parts procurement to Parts Link Aviation last year. The pricing intelligence alone has saved us over $2M in over-market purchases.",
    initials: "SR",
    name: "Sarah Ramirez",
    title: "Director of Supply Chain, SkyBridge Airlines",
  },
  {
    stars: 5,
    quote: "The verified seller documentation workflow has eliminated our receiving inspection rework by 80%. Every part comes with exactly what our QA team needs.",
    initials: "JK",
    name: "James Kowalski",
    title: "Chief Inspector, Apex MRO Services",
  },
];

const TRUST_BADGES = [
  "FAA Approved Suppliers",
  "EASA Part 145 Certified",
  "AS9120 Compliant",
  "CAAC Authorized",
  "ITAR Registered",
  "ISO 9001:2015 Certified",
];

const QUICK_TAGS = ["CFM56 Blades", "737 Landing Gear", "A320 Avionics", "APU Honeywell", "Hydraulic Pump", "ILS System"];

const SEARCH_CATEGORIES = [
  "All Categories", "Avionics", "Engines & APU", "Landing Gear",
  "Hydraulics", "Airframe", "Interiors", "Wheels & Brakes", "Electrical",
];

// ─── Count-up hook ─────────────────────────────────────────────────────────────
function useCountUp(target: number, duration = 2000, active = false) {
  const [count, setCount] = useState(0);
  useEffect(() => {
    if (!active) return;
    const start = performance.now();
    const frame = (now: number) => {
      const elapsed = now - start;
      const progress = Math.min(elapsed / duration, 1);
      const eased = 1 - Math.pow(1 - progress, 3);
      setCount(Math.floor(eased * target));
      if (progress < 1) requestAnimationFrame(frame);
    };
    requestAnimationFrame(frame);
  }, [active, target, duration]);
  return count;
}

// ─── Section: Navbar ──────────────────────────────────────────────────────────
function Navbar() {
  const [open, setOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  useEffect(() => {
    const fn = () => setScrolled(window.scrollY > 20);
    window.addEventListener("scroll", fn, { passive: true });
    return () => window.removeEventListener("scroll", fn);
  }, []);

  return (
    <nav
      style={{
        position: "fixed", top: 0, left: 0, right: 0, zIndex: 100,
        background: scrolled ? "rgba(10,22,40,0.97)" : "transparent",
        backdropFilter: scrolled ? "blur(12px)" : "none",
        borderBottom: scrolled ? `1px solid ${BORDER}` : "1px solid transparent",
        transition: "all 0.3s ease",
      }}
    >
      <div style={{ maxWidth: 1280, margin: "0 auto", padding: "0 24px" }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", height: 68 }}>
          {/* Logo */}
          <Link href="/" style={{ display: "flex", alignItems: "center", gap: 10, textDecoration: "none" }}>
            <div style={{
              width: 38, height: 38, borderRadius: 8,
              background: `linear-gradient(135deg, ${BLUE}, #0d47a1)`,
              display: "flex", alignItems: "center", justifyContent: "center",
              fontFamily: "'Barlow Condensed', sans-serif", fontWeight: 900,
              fontSize: 16, color: "#fff", letterSpacing: -0.5, flexShrink: 0,
            }}>PL</div>
            <span style={{
              fontFamily: "'Barlow Condensed', sans-serif", fontWeight: 700,
              fontSize: 20, color: "#fff", letterSpacing: 0.5, whiteSpace: "nowrap",
            }}>Parts Link <span style={{ color: GOLD }}>Aviation</span></span>
          </Link>

          {/* Desktop links */}
          <div style={{ display: "flex", alignItems: "center", gap: 32 }} className="hidden md:flex">
            {["Parts", "Features", "How It Works", "Pricing"].map(lbl => (
              <a
                key={lbl}
                href={`#${lbl.toLowerCase().replace(/ /g, "-")}`}
                style={{ color: "#a0b4cc", fontFamily: "'Barlow', sans-serif", fontSize: 14, fontWeight: 500, textDecoration: "none", transition: "color 0.2s" }}
                onMouseEnter={e => (e.currentTarget.style.color = "#fff")}
                onMouseLeave={e => (e.currentTarget.style.color = "#a0b4cc")}
              >{lbl}</a>
            ))}
          </div>

          {/* CTA group */}
          <div style={{ display: "flex", alignItems: "center", gap: 10 }} className="hidden md:flex">
            <a
              href="#aog"
              style={{
                display: "flex", alignItems: "center", gap: 6, padding: "8px 16px", borderRadius: 6,
                background: "#dc2626", color: "#fff",
                fontFamily: "'Barlow Condensed', sans-serif", fontWeight: 700, fontSize: 13,
                letterSpacing: 0.5, textDecoration: "none",
                animation: "aog-pulse 2s ease-in-out infinite",
              }}
            >
              <Zap size={13} />⚡ AOG 24/7
            </a>
            <Link
              href="/seller/register"
              style={{
                padding: "8px 20px", borderRadius: 6,
                background: BLUE, color: "#fff",
                fontFamily: "'Barlow Condensed', sans-serif", fontWeight: 700, fontSize: 13,
                letterSpacing: 0.5, textDecoration: "none",
              }}
            >Get Started</Link>
          </div>

          {/* Mobile hamburger */}
          <button
            className="md:hidden"
            onClick={() => setOpen(!open)}
            style={{ background: "none", border: "none", color: "#fff", cursor: "pointer", padding: 4 }}
          >
            {open ? <X size={24} /> : <Menu size={24} />}
          </button>
        </div>

        {/* Mobile menu */}
        {open && (
          <div
            className="md:hidden"
            style={{ padding: "16px 0 20px", borderTop: `1px solid ${BORDER}`, display: "flex", flexDirection: "column", gap: 4 }}
          >
            {["Parts", "Features", "How It Works", "Pricing"].map(lbl => (
              <a
                key={lbl}
                href={`#${lbl.toLowerCase().replace(/ /g, "-")}`}
                onClick={() => setOpen(false)}
                style={{ color: "#a0b4cc", fontFamily: "'Barlow', sans-serif", fontSize: 15, fontWeight: 500, textDecoration: "none", padding: "10px 0" }}
              >{lbl}</a>
            ))}
            <div style={{ display: "flex", gap: 10, marginTop: 12 }}>
              <a href="#aog" style={{ flex: 1, textAlign: "center", padding: "10px", borderRadius: 6, background: "#dc2626", color: "#fff", fontFamily: "'Barlow Condensed', sans-serif", fontWeight: 700, fontSize: 13, textDecoration: "none" }}>⚡ AOG 24/7</a>
              <Link href="/seller/register" style={{ flex: 1, textAlign: "center", padding: "10px", borderRadius: 6, background: BLUE, color: "#fff", fontFamily: "'Barlow Condensed', sans-serif", fontWeight: 700, fontSize: 13, textDecoration: "none" }}>Get Started</Link>
            </div>
          </div>
        )}
      </div>
    </nav>
  );
}

// ─── Section: AOG Banner ──────────────────────────────────────────────────────
function AogBanner() {
  return (
    <div id="aog" style={{ background: "#991b1b", overflow: "hidden", position: "relative", marginTop: 68 }}>
      <div style={{ display: "flex", alignItems: "center", padding: "10px 0", whiteSpace: "nowrap", animation: "slide-banner 28s linear infinite" }}>
        {Array.from({ length: 4 }).map((_, i) => (
          <span key={i} style={{ display: "inline-flex", alignItems: "center", gap: 12, paddingRight: 80 }}>
            <span style={{ color: "#fca5a5", fontSize: 13, fontFamily: "'Barlow', sans-serif", fontWeight: 500 }}>
              ⚡ AOG EMERGENCY? We source critical aircraft parts 24/7 — average response time under 4 hours.
            </span>
            <a
              href="tel:18002376247"
              style={{ color: "#fff", fontFamily: "'Barlow Condensed', sans-serif", fontWeight: 700, fontSize: 13, letterSpacing: 0.5, textDecoration: "none", display: "inline-flex", alignItems: "center", gap: 4, background: "rgba(255,255,255,0.15)", padding: "3px 12px", borderRadius: 4 }}
            >
              <Phone size={11} /> Call 1-800-AERO-247 Now →
            </a>
          </span>
        ))}
      </div>
    </div>
  );
}

// ─── Section: Hero ────────────────────────────────────────────────────────────
function Hero({ onSearch }: { onSearch: (q: string, cat: string) => void }) {
  const ref = useRef<HTMLDivElement>(null);
  const [visible, setVisible] = useState(true);
  const [query, setQuery] = useState("");
  const [cat, setCat] = useState("All Categories");

  useEffect(() => {
    const obs = new IntersectionObserver(([e]) => { if (e.isIntersecting) setVisible(true); }, { threshold: 0.2 });
    if (ref.current) obs.observe(ref.current);
    return () => obs.disconnect();
  }, []);

  const c1 = useCountUp(4200000, 2200, visible);
  const c2 = useCountUp(4200, 2000, visible);
  const c3 = useCountUp(4, 1500, visible);
  const c4 = useCountUp(987, 2200, visible);

  const stats = [
    { value: c1 >= 4200000 ? "4.2M+" : `${(c1 / 1000000).toFixed(1)}M`, label: "Parts Listed" },
    { value: c2 >= 4200 ? "4,200+" : c2.toLocaleString(), label: "Verified Operators" },
    { value: `<${c3 >= 4 ? "4" : c3} hrs`, label: "AOG Response" },
    { value: `${c4 >= 987 ? "98.7" : (c4 / 10).toFixed(1)}%`, label: "Fulfillment Rate" },
  ];

  return (
    <section
      ref={ref}
      id="parts"
      style={{
        background: NAVY,
        backgroundImage: `
          linear-gradient(rgba(25,118,210,0.07) 1px, transparent 1px),
          linear-gradient(90deg, rgba(25,118,210,0.07) 1px, transparent 1px)
        `,
        backgroundSize: "60px 60px",
        padding: "100px 24px 80px",
        position: "relative",
        overflow: "hidden",
      }}
    >
      {/* Radial glow */}
      <div style={{
        position: "absolute", top: "30%", left: "50%", transform: "translate(-50%,-50%)",
        width: 800, height: 600, borderRadius: "50%",
        background: "radial-gradient(ellipse, rgba(25,118,210,0.12) 0%, transparent 70%)",
        pointerEvents: "none",
      }} />

      <div style={{ maxWidth: 900, margin: "0 auto", textAlign: "center", position: "relative", zIndex: 1 }}>
        {/* Badge */}
        <div style={{ display: "inline-flex", alignItems: "center", gap: 8, marginBottom: 28, padding: "6px 16px", borderRadius: 20, background: "rgba(25,118,210,0.15)", border: `1px solid rgba(25,118,210,0.35)` }}>
          <span style={{ width: 6, height: 6, borderRadius: "50%", background: "#4ade80", display: "inline-block", boxShadow: "0 0 6px #4ade80" }} />
          <span style={{ fontFamily: "'Barlow', sans-serif", fontSize: 13, color: "#93c5fd", fontWeight: 500 }}>
            The Aviation Parts Marketplace Trusted by 4,200+ Operators
          </span>
        </div>

        {/* Heading */}
        <h1 style={{
          fontFamily: "'Barlow Condensed', sans-serif", fontWeight: 900,
          fontSize: "clamp(40px, 7vw, 76px)", lineHeight: 1.02,
          color: "#fff", marginBottom: 24, letterSpacing: "-0.5px",
          textTransform: "uppercase",
        }}>
          Source Certified<br />
          <span style={{ color: GOLD }}>Aircraft Parts</span><br />
          At Mission Speed
        </h1>

        <p style={{ fontFamily: "'Barlow', sans-serif", fontWeight: 300, fontSize: "clamp(16px, 2vw, 20px)", color: "#7ea8c8", marginBottom: 44, lineHeight: 1.6, maxWidth: 620, margin: "0 auto 44px" }}>
          Connect with 4,200+ verified suppliers across 90+ countries. Full documentation traceability. AOG response in under 4 hours.
        </p>

        {/* CTA buttons */}
        <div style={{ display: "flex", flexWrap: "wrap", gap: 12, justifyContent: "center", marginBottom: 64 }}>
          <a href="#search-bar" style={{
            padding: "14px 28px", borderRadius: 8, background: BLUE, color: "#fff",
            fontFamily: "'Barlow Condensed', sans-serif", fontWeight: 700, fontSize: 16,
            letterSpacing: 0.5, textDecoration: "none", display: "inline-flex", alignItems: "center", gap: 8,
          }}>
            <Search size={16} /> Search Parts Now
          </a>
          <a href="#pricing" style={{
            padding: "14px 28px", borderRadius: 8, color: "#fff",
            border: `1px solid ${BORDER}`, background: "rgba(255,255,255,0.05)",
            fontFamily: "'Barlow Condensed', sans-serif", fontWeight: 700, fontSize: 16,
            letterSpacing: 0.5, textDecoration: "none",
          }}>
            View Pricing
          </a>
          <a href="tel:18002376247" style={{
            padding: "14px 28px", borderRadius: 8, background: "#991b1b", color: "#fff",
            fontFamily: "'Barlow Condensed', sans-serif", fontWeight: 700, fontSize: 16,
            letterSpacing: 0.5, textDecoration: "none", display: "inline-flex", alignItems: "center", gap: 8,
          }}>
            <Zap size={16} /> AOG Emergency
          </a>
        </div>

        {/* Stat counters */}
        <div style={{
          display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 1,
          background: BORDER, borderRadius: 12, overflow: "hidden",
          border: `1px solid ${BORDER}`,
          maxWidth: 720, margin: "0 auto",
        }}>
          {stats.map((s, i) => (
            <div key={i} style={{ background: CARD_BG, padding: "24px 16px", textAlign: "center" }}>
              <div style={{ fontFamily: "'Barlow Condensed', sans-serif", fontWeight: 800, fontSize: 28, color: "#fff", letterSpacing: -0.5 }}>{s.value}</div>
              <div style={{ fontFamily: "'Barlow', sans-serif", fontSize: 12, color: "#7ea8c8", marginTop: 4, textTransform: "uppercase", letterSpacing: 0.5 }}>{s.label}</div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

// ─── Section: Trust Bar ───────────────────────────────────────────────────────
function TrustBar() {
  return (
    <div style={{ background: DARK, borderTop: `1px solid ${BORDER}`, borderBottom: `1px solid ${BORDER}`, padding: "18px 24px", overflowX: "auto" }}>
      <div style={{ maxWidth: 1100, margin: "0 auto", display: "flex", alignItems: "center", justifyContent: "center", gap: 32, flexWrap: "wrap" }}>
        {TRUST_BADGES.map(badge => (
          <div key={badge} style={{ display: "flex", alignItems: "center", gap: 7, whiteSpace: "nowrap" }}>
            <div style={{ width: 18, height: 18, borderRadius: "50%", background: "rgba(34,197,94,0.15)", border: "1px solid #22c55e", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
              <Check size={10} color="#22c55e" strokeWidth={3} />
            </div>
            <span style={{ fontFamily: "'Barlow', sans-serif", fontSize: 12, fontWeight: 600, color: "#7ea8c8", letterSpacing: 0.3, textTransform: "uppercase" }}>{badge}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── Section: Search ─────────────────────────────────────────────────────────
function PartsSearch({ onSearch }: { onSearch: (q: string, cat: string) => void }) {
  const [query, setQuery] = useState("");
  const [cat, setCat] = useState("All Categories");

  return (
    <section id="search-bar" style={{ background: NAVY, padding: "64px 24px" }}>
      <div style={{ maxWidth: 800, margin: "0 auto", textAlign: "center" }}>
        <div style={{ display: "inline-block", background: "rgba(25,118,210,0.12)", border: `1px solid rgba(25,118,210,0.3)`, borderRadius: 4, padding: "4px 14px", marginBottom: 20 }}>
          <span style={{ fontFamily: "'Barlow Condensed', sans-serif", fontWeight: 700, fontSize: 12, color: BLUE, letterSpacing: 1, textTransform: "uppercase" }}>Part Search</span>
        </div>
        <h2 style={{ fontFamily: "'Barlow Condensed', sans-serif", fontWeight: 800, fontSize: "clamp(28px, 4vw, 42px)", color: "#fff", marginBottom: 12, textTransform: "uppercase" }}>
          Find Any Aircraft Part Instantly
        </h2>
        <p style={{ fontFamily: "'Barlow', sans-serif", color: "#7ea8c8", fontSize: 15, marginBottom: 32 }}>
          Search 4.2M+ parts across 4,200 verified suppliers
        </p>

        <form
          onSubmit={e => { e.preventDefault(); onSearch(query, cat); }}
          style={{ display: "flex", gap: 0, borderRadius: 10, overflow: "hidden", border: `1px solid ${BORDER}`, background: CARD_BG }}
        >
          <select
            value={cat}
            onChange={e => setCat(e.target.value)}
            style={{
              background: "rgba(255,255,255,0.05)", border: "none", borderRight: `1px solid ${BORDER}`,
              color: "#a0b4cc", fontFamily: "'Barlow', sans-serif", fontSize: 14, padding: "14px 12px",
              cursor: "pointer", outline: "none", flexShrink: 0,
            }}
          >
            {SEARCH_CATEGORIES.map(c => <option key={c} value={c} style={{ background: "#0d1f38" }}>{c}</option>)}
          </select>
          <input
            value={query}
            onChange={e => setQuery(e.target.value)}
            placeholder="Search by part number, description, or aircraft type..."
            style={{
              flex: 1, background: "transparent", border: "none", outline: "none",
              color: "#fff", fontFamily: "'Barlow', sans-serif", fontSize: 15, padding: "14px 16px",
              minWidth: 0,
            }}
          />
          <button
            type="submit"
            style={{
              background: BLUE, border: "none", color: "#fff", cursor: "pointer",
              padding: "14px 28px", fontFamily: "'Barlow Condensed', sans-serif",
              fontWeight: 700, fontSize: 15, letterSpacing: 0.5, flexShrink: 0,
            }}
          >
            <Search size={18} />
          </button>
        </form>

        <div style={{ display: "flex", flexWrap: "wrap", gap: 8, justifyContent: "center", marginTop: 20 }}>
          {QUICK_TAGS.map(tag => (
            <button
              key={tag}
              onClick={() => onSearch(tag, "All Categories")}
              style={{
                background: "rgba(25,118,210,0.1)", border: `1px solid rgba(25,118,210,0.25)`,
                color: "#93c5fd", padding: "5px 14px", borderRadius: 20, cursor: "pointer",
                fontFamily: "'Barlow', sans-serif", fontSize: 13, fontWeight: 500,
                transition: "all 0.2s",
              }}
              onMouseEnter={e => { e.currentTarget.style.background = "rgba(25,118,210,0.25)"; e.currentTarget.style.color = "#fff"; }}
              onMouseLeave={e => { e.currentTarget.style.background = "rgba(25,118,210,0.1)"; e.currentTarget.style.color = "#93c5fd"; }}
            >
              {tag}
            </button>
          ))}
        </div>
      </div>
    </section>
  );
}

// ─── Section: Category Grid ───────────────────────────────────────────────────
function CategoryGrid({ onSearch }: { onSearch: (q: string, cat: string) => void }) {
  return (
    <section style={{ background: DARK, padding: "80px 24px" }}>
      <div style={{ maxWidth: 1200, margin: "0 auto" }}>
        <div style={{ textAlign: "center", marginBottom: 48 }}>
          <div style={{ display: "inline-block", background: "rgba(245,166,35,0.12)", border: `1px solid rgba(245,166,35,0.3)`, borderRadius: 4, padding: "4px 14px", marginBottom: 16 }}>
            <span style={{ fontFamily: "'Barlow Condensed', sans-serif", fontWeight: 700, fontSize: 12, color: GOLD, letterSpacing: 1, textTransform: "uppercase" }}>Browse by Category</span>
          </div>
          <h2 style={{ fontFamily: "'Barlow Condensed', sans-serif", fontWeight: 800, fontSize: "clamp(28px, 4vw, 44px)", color: "#fff", textTransform: "uppercase" }}>
            4.2 Million Parts Across 8 Categories
          </h2>
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(260px, 1fr))", gap: 1, background: BORDER, borderRadius: 12, overflow: "hidden" }}>
          {CATEGORIES.map(cat => (
            <button
              key={cat.name}
              onClick={() => onSearch("", cat.name)}
              style={{
                background: CARD_BG, border: "none", cursor: "pointer", padding: "28px 24px",
                textAlign: "left", transition: "background 0.2s", position: "relative",
              }}
              onMouseEnter={e => { e.currentTarget.style.background = "#112240"; }}
              onMouseLeave={e => { e.currentTarget.style.background = CARD_BG; }}
            >
              <div style={{ fontSize: 32, marginBottom: 12, lineHeight: 1 }}>{cat.icon}</div>
              <div style={{ fontFamily: "'Barlow Condensed', sans-serif", fontWeight: 700, fontSize: 18, color: "#fff", marginBottom: 4 }}>{cat.name}</div>
              <div style={{ fontFamily: "'Barlow', sans-serif", fontSize: 13, color: "#7ea8c8", marginBottom: 16, lineHeight: 1.4 }}>{cat.desc}</div>
              <div style={{ display: "inline-flex", alignItems: "center", gap: 4, background: "rgba(25,118,210,0.15)", border: `1px solid rgba(25,118,210,0.3)`, borderRadius: 4, padding: "3px 10px" }}>
                <span style={{ fontFamily: "'Barlow Condensed', sans-serif", fontWeight: 700, fontSize: 12, color: "#93c5fd" }}>{cat.count} Parts</span>
              </div>
            </button>
          ))}
        </div>
      </div>
    </section>
  );
}

// ─── Section: Features ────────────────────────────────────────────────────────
function Features() {
  return (
    <section id="features" style={{ background: NAVY, padding: "80px 24px", backgroundImage: `linear-gradient(rgba(25,118,210,0.04) 1px, transparent 1px), linear-gradient(90deg, rgba(25,118,210,0.04) 1px, transparent 1px)`, backgroundSize: "60px 60px" }}>
      <div style={{ maxWidth: 1200, margin: "0 auto" }}>
        <div style={{ textAlign: "center", marginBottom: 56 }}>
          <div style={{ display: "inline-block", background: "rgba(25,118,210,0.12)", border: `1px solid rgba(25,118,210,0.3)`, borderRadius: 4, padding: "4px 14px", marginBottom: 16 }}>
            <span style={{ fontFamily: "'Barlow Condensed', sans-serif", fontWeight: 700, fontSize: 12, color: BLUE, letterSpacing: 1, textTransform: "uppercase" }}>Platform Capabilities</span>
          </div>
          <h2 style={{ fontFamily: "'Barlow Condensed', sans-serif", fontWeight: 800, fontSize: "clamp(28px, 4vw, 44px)", color: "#fff", textTransform: "uppercase", marginBottom: 12 }}>
            Military-Grade Features for<br /><span style={{ color: GOLD }}>Aviation Professionals</span>
          </h2>
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(340px, 1fr))", gap: 1, background: BORDER, borderRadius: 12, overflow: "hidden" }}>
          {FEATURES.map((f, i) => (
            <div
              key={i}
              style={{ background: CARD_BG, padding: "32px 28px", transition: "background 0.2s" }}
              onMouseEnter={e => { e.currentTarget.style.background = "#112240"; }}
              onMouseLeave={e => { e.currentTarget.style.background = CARD_BG; }}
            >
              <div style={{ fontSize: 28, marginBottom: 16 }}>{f.icon}</div>
              <h3 style={{ fontFamily: "'Barlow Condensed', sans-serif", fontWeight: 700, fontSize: 20, color: "#fff", marginBottom: 10 }}>{f.title}</h3>
              <p style={{ fontFamily: "'Barlow', sans-serif", fontSize: 14, color: "#7ea8c8", lineHeight: 1.6, margin: 0 }}>{f.desc}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

// ─── Section: How It Works ────────────────────────────────────────────────────
function HowItWorks() {
  return (
    <section id="how-it-works" style={{ background: DARK, padding: "80px 24px" }}>
      <div style={{ maxWidth: 1100, margin: "0 auto" }}>
        <div style={{ textAlign: "center", marginBottom: 56 }}>
          <div style={{ display: "inline-block", background: "rgba(245,166,35,0.12)", border: `1px solid rgba(245,166,35,0.3)`, borderRadius: 4, padding: "4px 14px", marginBottom: 16 }}>
            <span style={{ fontFamily: "'Barlow Condensed', sans-serif", fontWeight: 700, fontSize: 12, color: GOLD, letterSpacing: 1, textTransform: "uppercase" }}>Process</span>
          </div>
          <h2 style={{ fontFamily: "'Barlow Condensed', sans-serif", fontWeight: 800, fontSize: "clamp(28px, 4vw, 44px)", color: "#fff", textTransform: "uppercase" }}>
            From Requirement to <span style={{ color: GOLD }}>Return to Service</span>
          </h2>
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(230px, 1fr))", gap: 24, position: "relative" }}>
          {STEPS.map((step, i) => (
            <div key={i} style={{ textAlign: "center" }}>
              <div style={{
                width: 64, height: 64, borderRadius: "50%", margin: "0 auto 20px",
                background: `linear-gradient(135deg, ${BLUE}, #0d47a1)`,
                display: "flex", alignItems: "center", justifyContent: "center",
                fontFamily: "'Barlow Condensed', sans-serif", fontWeight: 900, fontSize: 22, color: "#fff",
                boxShadow: `0 0 24px rgba(25,118,210,0.4)`,
              }}>
                {step.num}
              </div>
              <h3 style={{ fontFamily: "'Barlow Condensed', sans-serif", fontWeight: 700, fontSize: 20, color: "#fff", marginBottom: 10 }}>{step.title}</h3>
              <p style={{ fontFamily: "'Barlow', sans-serif", fontSize: 14, color: "#7ea8c8", lineHeight: 1.6, margin: 0 }}>{step.desc}</p>
              {i < STEPS.length - 1 && (
                <div className="hidden lg:flex" style={{ position: "absolute", top: 32, left: `calc(${(i + 1) * 25}% - 16px)`, color: BORDER, fontSize: 24, alignItems: "center" }}>
                  <ChevronRight size={20} color="#1a3050" />
                </div>
              )}
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

// ─── Section: Pricing ─────────────────────────────────────────────────────────
function Pricing() {
  return (
    <section id="pricing" style={{ background: NAVY, padding: "80px 24px", backgroundImage: `linear-gradient(rgba(25,118,210,0.04) 1px, transparent 1px), linear-gradient(90deg, rgba(25,118,210,0.04) 1px, transparent 1px)`, backgroundSize: "60px 60px" }}>
      <div style={{ maxWidth: 1100, margin: "0 auto" }}>
        <div style={{ textAlign: "center", marginBottom: 56 }}>
          <div style={{ display: "inline-block", background: "rgba(25,118,210,0.12)", border: `1px solid rgba(25,118,210,0.3)`, borderRadius: 4, padding: "4px 14px", marginBottom: 16 }}>
            <span style={{ fontFamily: "'Barlow Condensed', sans-serif", fontWeight: 700, fontSize: 12, color: BLUE, letterSpacing: 1, textTransform: "uppercase" }}>Pricing</span>
          </div>
          <h2 style={{ fontFamily: "'Barlow Condensed', sans-serif", fontWeight: 800, fontSize: "clamp(28px, 4vw, 44px)", color: "#fff", textTransform: "uppercase", marginBottom: 12 }}>
            Plans for Every <span style={{ color: GOLD }}>Operation</span>
          </h2>
          <p style={{ fontFamily: "'Barlow', sans-serif", fontSize: 15, color: "#7ea8c8" }}>No contracts. Cancel anytime. 14-day free trial on all plans.</p>
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(300px, 1fr))", gap: 24 }}>
          {PRICING.map((plan, i) => (
            <div
              key={i}
              style={{
                background: plan.featured ? `linear-gradient(180deg, ${BLUE}22 0%, ${CARD_BG} 100%)` : CARD_BG,
                border: plan.featured ? `2px solid ${BLUE}` : `1px solid ${BORDER}`,
                borderRadius: 12, padding: "36px 28px",
                position: "relative", overflow: "hidden",
                boxShadow: plan.featured ? `0 0 40px rgba(25,118,210,0.2)` : "none",
              }}
            >
              {plan.tag && (
                <div style={{
                  position: "absolute", top: 20, right: 20,
                  background: plan.featured ? BLUE : "rgba(245,166,35,0.15)",
                  border: `1px solid ${plan.featured ? BLUE : "rgba(245,166,35,0.4)"}`,
                  borderRadius: 4, padding: "3px 10px",
                  fontFamily: "'Barlow Condensed', sans-serif", fontWeight: 700, fontSize: 11,
                  color: plan.featured ? "#fff" : GOLD, letterSpacing: 0.5, textTransform: "uppercase",
                }}>
                  {plan.tag}
                </div>
              )}

              <h3 style={{ fontFamily: "'Barlow Condensed', sans-serif", fontWeight: 700, fontSize: 22, color: "#fff", marginBottom: 8 }}>{plan.name}</h3>
              <div style={{ display: "flex", alignItems: "baseline", gap: 2, marginBottom: 28 }}>
                <span style={{ fontFamily: "'Barlow Condensed', sans-serif", fontWeight: 900, fontSize: 44, color: plan.featured ? "#60a5fa" : "#fff" }}>{plan.price}</span>
                <span style={{ fontFamily: "'Barlow', sans-serif", fontSize: 14, color: "#7ea8c8" }}>{plan.period}</span>
              </div>

              <div style={{ borderTop: `1px solid ${BORDER}`, paddingTop: 24, marginBottom: 28 }}>
                {plan.features.map((f, j) => (
                  <div key={j} style={{ display: "flex", alignItems: "flex-start", gap: 10, marginBottom: 12 }}>
                    <div style={{ width: 18, height: 18, borderRadius: "50%", background: "rgba(34,197,94,0.1)", border: "1px solid rgba(34,197,94,0.4)", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0, marginTop: 1 }}>
                      <Check size={10} color="#4ade80" strokeWidth={3} />
                    </div>
                    <span style={{ fontFamily: "'Barlow', sans-serif", fontSize: 14, color: "#a0b4cc", lineHeight: 1.4 }}>{f}</span>
                  </div>
                ))}
              </div>

              <Link
                href={plan.href as any}
                style={{
                  display: "block", textAlign: "center", padding: "13px 0", borderRadius: 8,
                  background: plan.featured ? BLUE : "rgba(255,255,255,0.06)",
                  border: plan.featured ? "none" : `1px solid ${BORDER}`,
                  color: "#fff", fontFamily: "'Barlow Condensed', sans-serif", fontWeight: 700,
                  fontSize: 15, letterSpacing: 0.5, textDecoration: "none",
                  transition: "all 0.2s",
                }}
                onMouseEnter={(e: React.MouseEvent<HTMLAnchorElement>) => { if (!plan.featured) e.currentTarget.style.background = "rgba(255,255,255,0.1)"; }}
                onMouseLeave={(e: React.MouseEvent<HTMLAnchorElement>) => { if (!plan.featured) e.currentTarget.style.background = "rgba(255,255,255,0.06)"; }}
              >
                {plan.cta}
              </Link>
            </div>
          ))}
        </div>

        <p style={{ textAlign: "center", marginTop: 28, fontFamily: "'Barlow', sans-serif", fontSize: 13, color: "#4a6480" }}>
          Looking for enterprise volume pricing? <a href="mailto:sales@aeroparts.app" style={{ color: BLUE, textDecoration: "none" }}>Contact our sales team →</a>
        </p>
      </div>
    </section>
  );
}

// ─── Section: Testimonials ────────────────────────────────────────────────────
function Testimonials() {
  return (
    <section style={{ background: DARK, padding: "80px 24px" }}>
      <div style={{ maxWidth: 1100, margin: "0 auto" }}>
        <div style={{ textAlign: "center", marginBottom: 48 }}>
          <div style={{ display: "inline-block", background: "rgba(245,166,35,0.12)", border: `1px solid rgba(245,166,35,0.3)`, borderRadius: 4, padding: "4px 14px", marginBottom: 16 }}>
            <span style={{ fontFamily: "'Barlow Condensed', sans-serif", fontWeight: 700, fontSize: 12, color: GOLD, letterSpacing: 1, textTransform: "uppercase" }}>Trusted Globally</span>
          </div>
          <h2 style={{ fontFamily: "'Barlow Condensed', sans-serif", fontWeight: 800, fontSize: "clamp(28px, 4vw, 44px)", color: "#fff", textTransform: "uppercase" }}>
            What the Industry Says
          </h2>
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(300px, 1fr))", gap: 20 }}>
          {TESTIMONIALS.map((t, i) => (
            <div key={i} style={{ background: CARD_BG, border: `1px solid ${BORDER}`, borderRadius: 12, padding: "28px 24px" }}>
              <div style={{ display: "flex", gap: 3, marginBottom: 16 }}>
                {Array.from({ length: t.stars }).map((_, j) => <Star key={j} size={14} color={GOLD} fill={GOLD} />)}
              </div>
              <p style={{ fontFamily: "'Barlow', sans-serif", fontSize: 15, color: "#c8daea", lineHeight: 1.7, marginBottom: 24, fontStyle: "italic" }}>
                "{t.quote}"
              </p>
              <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                <div style={{
                  width: 42, height: 42, borderRadius: "50%",
                  background: `linear-gradient(135deg, ${BLUE}, #0d47a1)`,
                  display: "flex", alignItems: "center", justifyContent: "center",
                  fontFamily: "'Barlow Condensed', sans-serif", fontWeight: 700, fontSize: 14, color: "#fff",
                  flexShrink: 0,
                }}>
                  {t.initials}
                </div>
                <div>
                  <div style={{ fontFamily: "'Barlow Condensed', sans-serif", fontWeight: 700, fontSize: 15, color: "#fff" }}>{t.name}</div>
                  <div style={{ fontFamily: "'Barlow', sans-serif", fontSize: 12, color: "#7ea8c8" }}>{t.title}</div>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

// ─── Section: CTA ─────────────────────────────────────────────────────────────
function CtaSection() {
  return (
    <section style={{ background: NAVY, padding: "80px 24px", textAlign: "center", backgroundImage: `linear-gradient(rgba(25,118,210,0.06) 1px, transparent 1px), linear-gradient(90deg, rgba(25,118,210,0.06) 1px, transparent 1px)`, backgroundSize: "60px 60px" }}>
      <div style={{ maxWidth: 720, margin: "0 auto" }}>
        <h2 style={{ fontFamily: "'Barlow Condensed', sans-serif", fontWeight: 900, fontSize: "clamp(36px, 6vw, 64px)", color: "#fff", marginBottom: 8, textTransform: "uppercase", lineHeight: 1 }}>
          Ready to Fly<br /><span style={{ color: GOLD }}>Faster?</span>
        </h2>
        <p style={{ fontFamily: "'Barlow', sans-serif", fontSize: 17, color: "#7ea8c8", marginBottom: 40, lineHeight: 1.6 }}>
          Join 4,200+ aviation operators already using Parts Link Aviation to source critical components faster, smarter, and with full documentation compliance.
        </p>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 12, justifyContent: "center" }}>
          <Link
            href="/seller/register"
            style={{ padding: "15px 32px", borderRadius: 8, background: BLUE, color: "#fff", fontFamily: "'Barlow Condensed', sans-serif", fontWeight: 700, fontSize: 16, letterSpacing: 0.5, textDecoration: "none" }}
          >Start Free Trial</Link>
          <a
            href="#how-it-works"
            style={{ padding: "15px 32px", borderRadius: 8, background: "rgba(255,255,255,0.07)", border: `1px solid ${BORDER}`, color: "#fff", fontFamily: "'Barlow Condensed', sans-serif", fontWeight: 700, fontSize: 16, letterSpacing: 0.5, textDecoration: "none" }}
          >Book a Demo</a>
          <a
            href="tel:18002376247"
            style={{ padding: "15px 32px", borderRadius: 8, background: "#991b1b", color: "#fff", fontFamily: "'Barlow Condensed', sans-serif", fontWeight: 700, fontSize: 16, letterSpacing: 0.5, textDecoration: "none", display: "inline-flex", alignItems: "center", gap: 8 }}
          >
            <Zap size={16} /> AOG Hotline
          </a>
        </div>
      </div>
    </section>
  );
}

// ─── Section: Footer ──────────────────────────────────────────────────────────
function HomeFooter() {
  const FOOTER_LINKS = [
    {
      heading: "Platform",
      links: [
        { label: "Marketplace", href: "/marketplace" },
        { label: "RFQ Board", href: "/rfqs" },
        { label: "MRO Services", href: "/mro" },
        { label: "Pricing", href: "/pricing" },
        { label: "Seller Portal", href: "/seller/login" },
      ],
    },
    {
      heading: "Resources",
      links: [
        { label: "Documentation Guide", href: "/developer" },
        { label: "AOG Response Protocol", href: "/contact" },
        { label: "Compliance Overview", href: "/compliance" },
        { label: "API Integration", href: "/developer" },
        { label: "Seller Help Center", href: "/seller-guidelines" },
      ],
    },
    {
      heading: "Company",
      links: [
        { label: "About Parts Link Aviation", href: "/contact" },
        { label: "Contact Sales", href: "/contact" },
        { label: "Become a Supplier", href: "/seller/register" },
        { label: "Admin Portal", href: "/admin" },
        { label: "Status Page", href: "/contact" },
      ],
    },
  ];

  const FOOTER_BADGES = ["FAA Approved", "EASA Part 145", "AS9120", "ISO 9001:2015", "ITAR Reg", "CAAC Auth"];

  return (
    <footer style={{ background: DARK, borderTop: `1px solid ${BORDER}`, padding: "60px 24px 32px" }}>
      <div style={{ maxWidth: 1200, margin: "0 auto" }}>
        <div style={{ display: "grid", gridTemplateColumns: "2fr 1fr 1fr 1fr", gap: 48, marginBottom: 48 }} className="footer-grid">
          {/* Brand column */}
          <div>
            <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 16 }}>
              <div style={{ width: 36, height: 36, borderRadius: 8, background: `linear-gradient(135deg, ${BLUE}, #0d47a1)`, display: "flex", alignItems: "center", justifyContent: "center", fontFamily: "'Barlow Condensed', sans-serif", fontWeight: 900, fontSize: 15, color: "#fff" }}>PL</div>
              <span style={{ fontFamily: "'Barlow Condensed', sans-serif", fontWeight: 700, fontSize: 18, color: "#fff" }}>Parts Link <span style={{ color: GOLD }}>Aviation</span></span>
            </div>
            <p style={{ fontFamily: "'Barlow', sans-serif", fontSize: 13, color: "#4a6480", lineHeight: 1.7, marginBottom: 20, maxWidth: 280 }}>
              The aviation industry's trusted procurement marketplace. Source certified parts from 4,200+ verified operators worldwide.
            </p>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
              {FOOTER_BADGES.map(b => (
                <span key={b} style={{ fontFamily: "'Barlow', sans-serif", fontSize: 10, fontWeight: 600, color: "#22c55e", background: "rgba(34,197,94,0.08)", border: "1px solid rgba(34,197,94,0.2)", borderRadius: 3, padding: "2px 8px", letterSpacing: 0.3, textTransform: "uppercase" }}>{b}</span>
              ))}
            </div>
          </div>

          {/* Link columns */}
          {FOOTER_LINKS.map(col => (
            <div key={col.heading}>
              <h4 style={{ fontFamily: "'Barlow Condensed', sans-serif", fontWeight: 700, fontSize: 13, color: "#fff", letterSpacing: 1, textTransform: "uppercase", marginBottom: 20 }}>{col.heading}</h4>
              <ul style={{ listStyle: "none", padding: 0, margin: 0, display: "flex", flexDirection: "column", gap: 12 }}>
                {col.links.map(l => (
                  <li key={l.label}>
                    <a
                      href={l.href}
                      style={{ fontFamily: "'Barlow', sans-serif", fontSize: 13, color: "#4a6480", textDecoration: "none", transition: "color 0.2s" }}
                      onMouseEnter={e => (e.currentTarget.style.color = "#a0b4cc")}
                      onMouseLeave={e => (e.currentTarget.style.color = "#4a6480")}
                    >{l.label}</a>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>

        <div style={{ borderTop: `1px solid ${BORDER}`, paddingTop: 24, display: "flex", flexWrap: "wrap", justifyContent: "space-between", alignItems: "center", gap: 12 }}>
          <span style={{ fontFamily: "'Barlow', sans-serif", fontSize: 12, color: "#2a4060" }}>
            © {new Date().getFullYear()} Parts Link Aviation. All rights reserved.
          </span>
          <div style={{ display: "flex", gap: 20 }}>
            {[{ l: "Privacy Policy", h: "/privacy" }, { l: "Terms of Service", h: "/terms" }, { l: "Cookie Policy", h: "/cookies" }].map(({ l, h }) => (
              <a key={l} href={h} style={{ fontFamily: "'Barlow', sans-serif", fontSize: 12, color: "#2a4060", textDecoration: "none" }}
                onMouseEnter={e => (e.currentTarget.style.color = "#4a6480")}
                onMouseLeave={e => (e.currentTarget.style.color = "#2a4060")}
              >{l}</a>
            ))}
          </div>
        </div>
      </div>
    </footer>
  );
}

// ─── Featured Listings (existing section kept) ────────────────────────────────
function FeaturedListings() {
  const { data: featuredListings, isLoading } = useGetFeaturedListings({
    query: { queryKey: getGetFeaturedListingsQueryKey() }
  });

  if (!isLoading && (!featuredListings || featuredListings.length === 0)) return null;

  return (
    <section style={{ background: DARK, padding: "80px 24px", borderTop: `1px solid ${BORDER}` }}>
      <div style={{ maxWidth: 1200, margin: "0 auto" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end", marginBottom: 36, flexWrap: "wrap", gap: 12 }}>
          <div>
            <h2 style={{ fontFamily: "'Barlow Condensed', sans-serif", fontWeight: 800, fontSize: 32, color: "#fff", textTransform: "uppercase", marginBottom: 4 }}>Featured Verified Listings</h2>
            <p style={{ fontFamily: "'Barlow', sans-serif", fontSize: 14, color: "#7ea8c8" }}>Premium components ready for dispatch with full documentation.</p>
          </div>
          <Link href="/marketplace" style={{ fontFamily: "'Barlow Condensed', sans-serif", fontWeight: 700, fontSize: 14, color: BLUE, textDecoration: "none", letterSpacing: 0.5, whiteSpace: "nowrap" }}>
            View All Parts →
          </Link>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          {isLoading
            ? Array.from({ length: 4 }).map((_, i) => (
                <Card key={i} className="h-full flex flex-col bg-card overflow-hidden border-border">
                  <Skeleton className="aspect-video w-full rounded-none" />
                  <div className="p-4 flex-1">
                    <Skeleton className="h-6 w-2/3 mb-2" />
                    <Skeleton className="h-4 w-1/3 mb-4" />
                    <Skeleton className="h-4 w-full mb-2" />
                    <Skeleton className="h-4 w-full" />
                  </div>
                </Card>
              ))
            : featuredListings?.map(listing => (
                <ListingCard key={listing.id} listing={listing} />
              ))}
        </div>
      </div>
    </section>
  );
}

// ─── Keyframe injection ───────────────────────────────────────────────────────
const STYLES = `
@keyframes slide-banner {
  0%   { transform: translateX(0); }
  100% { transform: translateX(-50%); }
}
@keyframes aog-pulse {
  0%, 100% { box-shadow: 0 0 0 0 rgba(220,38,38,0.5); }
  50%       { box-shadow: 0 0 0 8px rgba(220,38,38,0); }
}
.footer-grid {
  grid-template-columns: 2fr 1fr 1fr 1fr;
}
@media (max-width: 900px) {
  .footer-grid {
    grid-template-columns: 1fr 1fr !important;
    gap: 32px !important;
  }
}
@media (max-width: 560px) {
  .footer-grid {
    grid-template-columns: 1fr !important;
  }
}
`;

// ─── Page ─────────────────────────────────────────────────────────────────────
export default function Home() {
  const [, setLocation] = useLocation();

  const handleSearch = (q: string, cat: string) => {
    const params = new URLSearchParams();
    if (q) params.set("q", q);
    if (cat && cat !== "All Categories") params.set("category", cat);
    setLocation(`/marketplace${params.toString() ? "?" + params.toString() : ""}`);
  };

  return (
    <div style={{ minHeight: "100vh", background: NAVY }}>
      <style dangerouslySetInnerHTML={{ __html: STYLES }} />
      <Navbar />
      <AogBanner />
      <Hero onSearch={handleSearch} />
      <TrustBar />
      <PartsSearch onSearch={handleSearch} />
      <CategoryGrid onSearch={handleSearch} />
      <Features />
      <HowItWorks />
      <Pricing />
      <Testimonials />
      <CtaSection />
      <FeaturedListings />
      <HomeFooter />
    </div>
  );
}
