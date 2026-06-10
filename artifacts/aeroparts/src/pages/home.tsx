import { useState, useEffect } from "react";
import { Link, useLocation } from "wouter";
import { Search, Menu, X, Check, ChevronRight, Zap } from "lucide-react";
import {
  useGetFeaturedListings,
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
  { icon: "📡", name: "Avionics",        desc: "Navigation, comms & displays"    },
  { icon: "🔥", name: "Engines & APU",   desc: "Turbofan, turboprop & APU units"  },
  { icon: "⚙️", name: "Landing Gear",    desc: "Struts, actuators & doors"        },
  { icon: "💧", name: "Hydraulics",      desc: "Pumps, actuators & lines"         },
  { icon: "✈️", name: "Airframe",        desc: "Panels, frames & fairings"        },
  { icon: "💺", name: "Interiors",       desc: "Seats, galleys & overhead bins"   },
  { icon: "🛞", name: "Wheels & Brakes", desc: "Wheels, tires & brake assemblies" },
  { icon: "⚡", name: "Electrical",      desc: "Wiring, connectors & PCBs"        },
];

const FEATURES = [
  { icon: "⚡", title: "AOG Emergency Response",       desc: "Post urgent AOG requests and get matched with verified suppliers who can respond quickly. Full documentation included." },
  { icon: "🛡️", title: "Verified Certification Docs",  desc: "Every part comes with traceable 8130-3, EASA Form 1, or equivalent airworthiness documentation." },
  { icon: "🌐", title: "Global Supplier Network",       desc: "Connect with verified operators, MROs, and OEM distributors. Growing with every founding seller who joins." },
  { icon: "📊", title: "Real-Time Pricing Intelligence",desc: "Live market benchmarking so you know you're paying fair market value every time." },
  { icon: "🔔", title: "Smart Part Alerts",             desc: "Set watchlists for hard-to-find part numbers and get notified the moment stock appears." },
  { icon: "🔗", title: "ERP & MRO Integration",         desc: "Native connectors for AMOS, Ramco, SAP, and major MRO platforms. No manual re-keying." },
];

const STEPS = [
  { num: "01", title: "Submit Requirement",          desc: "Enter your part number, condition requirements, and urgency level. AOG requests are flagged immediately." },
  { num: "02", title: "Get Matched Quotes",          desc: "Verified suppliers respond in real time. Compare pricing, lead time, and certification documentation." },
  { num: "03", title: "Verify & Approve",            desc: "Review seller trust scores, certification docs, and audit history before committing." },
  { num: "04", title: "Receive & Return to Service", desc: "Parts ship with full documentation. Track delivery and log receipt directly in the platform." },
];

const PRICING = [
  {
    name: "Solo Operator",
    price: "$149",
    period: "/mo",
    tag: null,
    founding: true,
    features: ["Unlimited marketplace searches", "Access all verified listings on the platform", "Email support"],
    cta: "Claim Your Free Spot",
    href: "/seller/register",
    featured: false,
  },
  {
    name: "Fleet Manager",
    price: "$349",
    period: "/mo",
    tag: "MOST POPULAR",
    founding: false,
    features: ["Unlimited marketplace searches", "Full access to all verified listings", "Watchlist alerts", "API access", "Business-hours email support (Mon–Fri)"],
    cta: "Start Now",
    href: "/seller/register",
    featured: true,
  },
  {
    name: "Mission Control",
    price: "$799",
    period: "/mo",
    tag: "ENTERPRISE",
    founding: false,
    features: ["Everything in Fleet Manager", "ERP & MRO integration", "Multi-user seats (unlimited)"],
    cta: "Book a Demo",
    href: "/seller/register",
    featured: false,
  },
];


const QUICK_TAGS = ["CFM56 Blades", "737 Landing Gear", "A320 Avionics", "APU Honeywell", "Hydraulic Pump", "ILS System"];

const SEARCH_CATEGORIES = [
  "All Categories", "Avionics", "Engines & APU", "Landing Gear",
  "Hydraulics", "Airframe", "Interiors", "Wheels & Brakes", "Electrical",
];

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
            <div>
              <div style={{ fontFamily: "'Barlow Condensed', sans-serif", fontWeight: 700, fontSize: 18, color: "#fff", lineHeight: 1.1 }}>
                Parts Link <span style={{ color: GOLD }}>Aviation</span>
              </div>
              <div style={{ fontFamily: "'Barlow', sans-serif", fontSize: 10, color: "#4a6480", letterSpacing: 1, textTransform: "uppercase" }}>Parts Marketplace</div>
            </div>
          </Link>

          {/* Nav links */}
          <div className="hidden md:flex" style={{ display: "flex", alignItems: "center", gap: 4 }}>
            {[
              { label: "Parts",        href: "#parts" },
              { label: "Features",     href: "#features" },
              { label: "How It Works", href: "#how-it-works" },
              { label: "Pricing",      href: "#pricing" },
            ].map(({ label, href }) => (
              <a
                key={label}
                href={href}
                style={{ fontFamily: "'Barlow', sans-serif", fontSize: 14, fontWeight: 500, color: "#7ea8c8", textDecoration: "none", padding: "8px 12px", borderRadius: 6, transition: "color 0.2s" }}
                onMouseEnter={e => (e.currentTarget.style.color = "#fff")}
                onMouseLeave={e => (e.currentTarget.style.color = "#7ea8c8")}
              >{label}</a>
            ))}
          </div>

          {/* CTA group */}
          <div style={{ display: "flex", alignItems: "center", gap: 10 }} className="hidden md:flex">
            <a
              href="/rfqs/new?urgency=aog"
              style={{
                display: "flex", alignItems: "center", gap: 6, padding: "8px 16px", borderRadius: 6,
                background: "#991b1b", color: "#fff",
                fontFamily: "'Barlow Condensed', sans-serif", fontWeight: 700, fontSize: 13,
                letterSpacing: 0.5, textDecoration: "none",
              }}
            >
              <Zap size={13} />⚡ Submit AOG Request
            </a>
            <Link
              href="/seller/register"
              style={{
                padding: "8px 20px", borderRadius: 6,
                background: BLUE, color: "#fff",
                fontFamily: "'Barlow Condensed', sans-serif", fontWeight: 700, fontSize: 13,
                letterSpacing: 0.5, textDecoration: "none",
              }}
            ></a></Link>
          </div>

          {/* Mobile hamburger */}
          <button
            className="md:hidden"</div>a>
                  <Link href="/seller/login" style={{ padding: "8px 16px", borderRadius: 6, border: "1px solid #1a3050", color: "#7ea8c8", fontFamily: "'Barlow Condensed', sans-serif", fontWeight: 700, fontSize: 13, letterSpacing: 0.5, textDecoration: "none", textTransform: "uppercase" }}>Sign In</Link>Link>
                  <Link
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
              <a href="/rfqs/new?urgency=aog" style={{ flex: 1, textAlign: "center", padding: "10px", borderRadius: 6, background: "#991b1b", color: "#fff", fontFamily: "'Barlow Condensed', sans-serif", fontWeight: 700, fontSize: 12, textDecoration: "none" }}>⚡ AOG Request</a>
              <Link href="/seller/register" style={{ flex: 1, textAlign: "center", padding: "10px", borderRadius: 6, background: BLUE, color: "#fff", fontFamily: "'Barlow Condensed', sans-serif", fontWeight: 700, fontSize: 13, textDecoration: "none" }}>Get Started</Link>
            </div>
          </div>
        )}
      </div>
    </nav>
  );
}

// ─── Section: Launch Banner ───────────────────────────────────────────────────
function LaunchBanner() {
  return (
    <div style={{ background: "#061830", borderBottom: `1px solid rgba(25,118,210,0.25)`, marginTop: 68 }}>
      <div style={{ maxWidth: 1200, margin: "0 auto", padding: "10px 24px", display: "flex", alignItems: "center", justifyContent: "center", gap: 16, flexWrap: "wrap" }}>
        <span style={{ display: "inline-flex", alignItems: "center", gap: 8 }}>
          <span style={{ width: 7, height: 7, borderRadius: "50%", background: "#4ade80", display: "inline-block", boxShadow: "0 0 6px #4ade80", flexShrink: 0 }} />
          <span style={{ fontFamily: "'Barlow Condensed', sans-serif", fontWeight: 700, fontSize: 13, color: "#93c5fd", letterSpacing: 0.5, textTransform: "uppercase" }}>
            NOW LAUNCHING — Parts Link Aviation is open for founding sellers and early buyers
          </span>
        </span>
        <Link
          href="/seller/register"
          style={{ fontFamily: "'Barlow Condensed', sans-serif", fontWeight: 700, fontSize: 12, color: GOLD, textDecoration: "none", letterSpacing: 0.5, whiteSpace: "nowrap", border: `1px solid rgba(245,166,35,0.4)`, padding: "3px 12px", borderRadius: 4 }}
        >
          Apply Now →
        </Link>
      </div>
    </div>
  );
}

// ─── Section: Hero ────────────────────────────────────────────────────────────
function Hero({ onSearch }: { onSearch: (q: string, cat: string) => void }) {
  const [query, setQuery] = useState("");
  const [cat, setCat] = useState("All Categories");

  return (
    <section
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
        {/* Launch badge */}
        <div style={{ display: "inline-flex", alignItems: "center", gap: 8, marginBottom: 28, padding: "6px 16px", borderRadius: 20, background: "rgba(245,166,35,0.12)", border: `1px solid rgba(245,166,35,0.3)` }}>
          <span style={{ width: 6, height: 6, borderRadius: "50%", background: "#4ade80", display: "inline-block", boxShadow: "0 0 6px #4ade80" }} />
          <span style={{ fontFamily: "'Barlow', sans-serif", fontSize: 13, color: GOLD, fontWeight: 600 }}>
            NOW LAUNCHING — Founding Member Spots Available
          </span>
        </div>

        {/* Heading */}
        <h1 style={{
          fontFamily: "'Barlow Condensed', sans-serif", fontWeight: 900,
          fontSize: "clamp(40px, 7vw, 76px)", lineHeight: 1.02,
          color: "#fff", marginBottom: 24, letterSpacing: "-0.5px",
          textTransform: "uppercase",
        }}>
          The Aviation Parts<br />
          <span style={{ color: GOLD }}>Marketplace Built</span><br />
          for Transparency
        </h1>

        <p style={{ fontFamily: "'Barlow', sans-serif", fontWeight: 300, fontSize: "clamp(16px, 2vw, 20px)", color: "#7ea8c8", lineHeight: 1.6, maxWidth: 620, margin: "0 auto 44px" }}>
          Parts Link Aviation is launching now. List your certified inventory. Connect with verified buyers. No middlemen.
        </p>

        {/* CTA buttons */}
        <div style={{ display: "flex", flexWrap: "wrap", gap: 12, justifyContent: "center", marginBottom: 48 }}>
          <Link href="/seller/register" style={{
            padding: "14px 28px", borderRadius: 8, background: GOLD, color: "#0a1628",
            fontFamily: "'Barlow Condensed', sans-serif", fontWeight: 800, fontSize: 16,
            letterSpacing: 0.5, textDecoration: "none", display: "inline-flex", alignItems: "center", gap: 8,
          }}>
            Apply as Founding Seller →
          </Link>
          <a href="/marketplace" style={{
            padding: "14px 28px", borderRadius: 8, background: BLUE, color: "#fff",
            fontFamily: "'Barlow Condensed', sans-serif", fontWeight: 700, fontSize: 16,
            letterSpacing: 0.5, textDecoration: "none", display: "inline-flex", alignItems: "center", gap: 8,
          }}>
            <Search size={16} /> Browse Available Parts
          </a>
          <a href="#founding-seller" style={{
            padding: "14px 28px", borderRadius: 8, color: "#fff",
            border: `1px solid ${BORDER}`, background: "rgba(255,255,255,0.05)",
            fontFamily: "'Barlow Condensed', sans-serif", fontWeight: 700, fontSize: 16,
            letterSpacing: 0.5, textDecoration: "none",
          }}>
            Founding Seller Program
          </a>
        </div>

        {/* ─── Hero Search Bar ─────────────────────────────────────────────── */}
        <form
          onSubmit={e => { e.preventDefault(); onSearch(query, cat); }}
          style={{
            display: "flex", alignItems: "center",
            maxWidth: 680, margin: "0 auto 32px",
            background: "rgba(255,255,255,0.05)",
            border: `1px solid ${BORDER}`,
            borderRadius: 10,
            overflow: "hidden",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", paddingLeft: 16, flexShrink: 0 }}>
            <Search size={18} color="#7ea8c8" />
          </div>
          <input
            type="text"
            value={query}
            onChange={e => setQuery(e.target.value)}
            placeholder="Search by part number, description, or aircraft type…"
            style={{
              flex: 1,
              background: "transparent",
              border: "none",
              outline: "none",
              padding: "14px 12px",
              fontFamily: "'Barlow', sans-serif",
              fontSize: 15,
              color: "#fff",
            }}
          />
          <button
            type="submit"
            style={{
              padding: "12px 24px",
              background: GOLD,
              color: "#0a1628",
              border: "none",
              cursor: "pointer",
              fontFamily: "'Barlow Condensed', sans-serif",
              fontWeight: 800,
              fontSize: 15,
              letterSpacing: 0.5,
              flexShrink: 0,
            }}
          >
            Search
          </button>
        </form>

        {/* ─── Hero Stats Bar ──────────────────────────────────────────────── */}
        <div style={{
          display: "flex", flexWrap: "wrap", justifyContent: "center", gap: 0,
          borderTop: `1px solid rgba(25,118,210,0.2)`,
          paddingTop: 36,
        }}>
          {[
            { value: "0%",      label: "Commission on Sales"       },
            { value: "Free",    label: "To List Parts"             },
            { value: "100%",    label: "Transparent Pricing"       },
            { value: "< 24 hrs",label: "Listing Go-Live Time"      },
          ].map((s, i, arr) => (
            <div
              key={s.label}
              style={{
                padding: "0 36px",
                borderRight: i < arr.length - 1 ? `1px solid rgba(25,118,210,0.2)` : "none",
                textAlign: "center",
                marginBottom: 12,
              }}
            >
              <div style={{
                fontFamily: "'Barlow Condensed', sans-serif", fontWeight: 900,
                fontSize: 36, color: "#fff", lineHeight: 1.1,
                letterSpacing: "-0.5px",
              }}>{s.value}</div>
              <div style={{
                fontFamily: "'Barlow', sans-serif", fontSize: 12, color: "#4a8aaa",
                fontWeight: 500, letterSpacing: "0.06em", textTransform: "uppercase",
                marginTop: 4,
              }}>{s.label}</div>
            </div>
          ))}
        </div>

      </div>
    </section>
  );
}

// ─── Section: Founding Seller ─────────────────────────────────────────────────
function FoundingSellerSection() {
  return (
    <section id="founding-seller" style={{ background: DARK, padding: "80px 24px", borderTop: `1px solid ${BORDER}` }}>
      <div style={{ maxWidth: 860, margin: "0 auto", textAlign: "center" }}>

        {/* Gold label */}
        <div style={{ display: "inline-block", background: "rgba(245,166,35,0.12)", border: `1px solid rgba(245,166,35,0.3)`, borderRadius: 4, padding: "4px 14px", marginBottom: 20 }}>
          <span style={{ fontFamily: "'Barlow Condensed', sans-serif", fontWeight: 700, fontSize: 12, color: GOLD, letterSpacing: 1, textTransform: "uppercase" }}>Founding Seller Program</span>
        </div>

        {/* Spot counter */}
        <div style={{
          display: "inline-flex", alignItems: "center", gap: 8, padding: "7px 18px",
          background: "rgba(245,166,35,0.08)", border: `1px solid rgba(245,166,35,0.25)`,
          borderRadius: 20, marginBottom: 28, marginLeft: 12,
        }}>
          <span style={{ width: 7, height: 7, borderRadius: "50%", background: "#4ade80", display: "inline-block", boxShadow: "0 0 5px #4ade80" }} />
          <span style={{ fontFamily: "'Barlow', sans-serif", fontSize: 13, color: "#a0b4cc", fontWeight: 500 }}>
            <strong style={{ color: GOLD }}>0 of 50</strong> founding seller spots claimed
          </span>
        </div>

        <h2 style={{
          fontFamily: "'Barlow Condensed', sans-serif", fontWeight: 900,
          fontSize: "clamp(32px, 5vw, 56px)", color: "#fff",
          textTransform: "uppercase", lineHeight: 1.05, marginBottom: 16,
        }}>
          Join as a Founding Seller —<br />
          <span style={{ color: GOLD }}>List Free for 6 Months</span>
        </h2>

        <p style={{ fontFamily: "'Barlow', sans-serif", fontSize: 17, color: "#7ea8c8", lineHeight: 1.7, maxWidth: 660, margin: "0 auto 40px" }}>
          Be one of the first verified suppliers on Parts Link Aviation. Founding sellers get{" "}
          <strong style={{ color: GOLD }}>6 months of Solo Operator access completely free</strong>.{" "}
          No credit card required.
        </p>

        {/* Benefits row */}
        <div style={{ display: "flex", justifyContent: "center", gap: 32, flexWrap: "wrap", marginBottom: 40 }}>
          {[
            { icon: "🛡️", label: "Verified Seller Badge" },
            { icon: "📋", label: "Unlimited Listings" },
            { icon: "📊", label: "Buyer Analytics" },
            { icon: "⚡", label: "AOG Request Matching" },
          ].map(b => (
            <div key={b.label} style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <span style={{ fontSize: 18 }}>{b.icon}</span>
              <span style={{ fontFamily: "'Barlow', sans-serif", fontSize: 13, color: "#a0b4cc", fontWeight: 500 }}>{b.label}</span>
            </div>
          ))}
        </div>

        {/* CTAs */}
        <div style={{ display: "flex", flexWrap: "wrap", gap: 12, justifyContent: "center" }}>
          <Link
            href="/seller/register"
            style={{
              padding: "15px 36px", borderRadius: 8, background: GOLD, color: "#0a1628",
              fontFamily: "'Barlow Condensed', sans-serif", fontWeight: 800, fontSize: 16,
              letterSpacing: 0.5, textDecoration: "none",
            }}
          >
            Apply as Founding Seller
          </Link>
          <a
            href="#pricing"
            style={{
              padding: "15px 32px", borderRadius: 8,
              background: "rgba(255,255,255,0.06)", border: `1px solid ${BORDER}`,
              color: "#fff", fontFamily: "'Barlow Condensed', sans-serif", fontWeight: 700,
              fontSize: 16, letterSpacing: 0.5, textDecoration: "none",
            }}
          >
            Learn More
          </a>
        </div>
      </div>
    </section>
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
          Search available aircraft parts — with full documentation traceability on every listing
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
            8 Core Aviation Part Categories
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
              <div style={{ fontFamily: "'Barlow', sans-serif", fontSize: 13, color: "#7ea8c8", lineHeight: 1.4 }}>{cat.desc}</div>
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
            Built for<br /><span style={{ color: GOLD }}>Aviation Professionals</span>
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
          <p style={{ fontFamily: "'Barlow', sans-serif", fontSize: 15, color: "#7ea8c8" }}>Founding sellers list free for 6 months. No credit card required.</p>
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(300px, 1fr))", gap: 24 }}>
          {PRICING.map((plan, i) => (
            <div
              key={i}
              style={{
                background: plan.featured ? `linear-gradient(180deg, ${BLUE}22 0%, ${CARD_BG} 100%)` : CARD_BG,
                border: plan.founding ? `2px solid rgba(245,166,35,0.5)` : plan.featured ? `2px solid ${BLUE}` : `1px solid ${BORDER}`,
                borderRadius: 12, padding: 0,
                position: "relative", overflow: "hidden",
                boxShadow: plan.featured ? `0 0 40px rgba(25,118,210,0.2)` : plan.founding ? `0 0 32px rgba(245,166,35,0.1)` : "none",
                display: "flex", flexDirection: "column",
              }}
            >
              {/* Founding seller gold banner */}
              {plan.founding && (
                <div style={{
                  background: `linear-gradient(135deg, rgba(245,166,35,0.25), rgba(245,166,35,0.1))`,
                  borderBottom: `1px solid rgba(245,166,35,0.3)`,
                  padding: "10px 20px",
                  display: "flex", alignItems: "center", justifyContent: "space-between",
                }}>
                  <span style={{ fontFamily: "'Barlow Condensed', sans-serif", fontWeight: 800, fontSize: 12, color: GOLD, letterSpacing: 0.8, textTransform: "uppercase" }}>
                    ⭐ Founding Seller: First 6 Months Free
                  </span>
                </div>
              )}

              {plan.tag && !plan.founding && (
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

              <div style={{ padding: "28px 28px 28px" }}>
                <h3 style={{ fontFamily: "'Barlow Condensed', sans-serif", fontWeight: 700, fontSize: 22, color: "#fff", marginBottom: 8 }}>{plan.name}</h3>
                {plan.founding ? (
                  <div style={{ marginBottom: 28 }}>
                    <div style={{ display: "flex", alignItems: "baseline", gap: 4 }}>
                      <span style={{ fontFamily: "'Barlow Condensed', sans-serif", fontWeight: 900, fontSize: 40, color: "#4ade80", textDecoration: "line-through", opacity: 0.5 }}>{plan.price}</span>
                      <span style={{ fontFamily: "'Barlow Condensed', sans-serif", fontWeight: 900, fontSize: 40, color: "#4ade80" }}>Free</span>
                    </div>
                    <p style={{ fontFamily: "'Barlow', sans-serif", fontSize: 12, color: "#7ea8c8", marginTop: 4 }}>
                      Free during founding period, then {plan.price}/mo
                    </p>
                  </div>
                ) : (
                  <div style={{ display: "flex", alignItems: "baseline", gap: 2, marginBottom: 28 }}>
                    <span style={{ fontFamily: "'Barlow Condensed', sans-serif", fontWeight: 900, fontSize: 44, color: plan.featured ? "#60a5fa" : "#fff" }}>{plan.price}</span>
                    <span style={{ fontFamily: "'Barlow', sans-serif", fontSize: 14, color: "#7ea8c8" }}>{plan.period}</span>
                  </div>
                )}

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
                    background: plan.founding ? GOLD : plan.featured ? BLUE : "rgba(255,255,255,0.06)",
                    border: plan.founding ? "none" : plan.featured ? "none" : `1px solid ${BORDER}`,
                    color: plan.founding ? "#0a1628" : "#fff",
                    fontFamily: "'Barlow Condensed', sans-serif", fontWeight: 800,
                    fontSize: 15, letterSpacing: 0.5, textDecoration: "none",
                    transition: "all 0.2s",
                  }}
                >
                  {plan.cta}
                </Link>
              </div>
            </div>
          ))}
        </div>

        <p style={{ textAlign: "center", marginTop: 28, fontFamily: "'Barlow', sans-serif", fontSize: 13, color: "#4a6480" }}>
          Need enterprise or custom volume pricing? <a href="/contact" style={{ color: BLUE, textDecoration: "none" }}>Contact our team →</a>
        </p>
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
          Join at <br /><span style={{ color: GOLD }}>Launch</span>
        </h2>
        <p style={{ fontFamily: "'Barlow', sans-serif", fontSize: 17, color: "#7ea8c8", marginBottom: 40, lineHeight: 1.6 }}>
          Be among the first verified suppliers and buyers on Parts Link Aviation. Founding sellers list free for 6 months — no credit card required.
        </p>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 12, justifyContent: "center" }}>
          <Link
            href="/seller/register"
            style={{ padding: "15px 32px", borderRadius: 8, background: GOLD, color: "#0a1628", fontFamily: "'Barlow Condensed', sans-serif", fontWeight: 800, fontSize: 16, letterSpacing: 0.5, textDecoration: "none" }}
          >Apply as Founding Seller</Link>
          <Link
            href="/marketplace"
            style={{ padding: "15px 32px", borderRadius: 8, background: BLUE, color: "#fff", fontFamily: "'Barlow Condensed', sans-serif", fontWeight: 700, fontSize: 16, letterSpacing: 0.5, textDecoration: "none" }}
          >Browse Marketplace</Link>
          <a
            href="#waitlist"
            style={{ padding: "15px 32px", borderRadius: 8, background: "rgba(255,255,255,0.07)", border: `1px solid ${BORDER}`, color: "#fff", fontFamily: "'Barlow Condensed', sans-serif", fontWeight: 700, fontSize: 16, letterSpacing: 0.5, textDecoration: "none" }}
          >Buyer Waitlist</a>
        </div>
      </div>
    </section>
  );
}

// ─── Section: Buyer Waitlist ────────────────────────────────────────────────
function WaitlistSection() {
  const [email, setEmail] = useState("");
  const [aircraftType, setAircraftType] = useState("");
  const [partCategories, setPartCategories] = useState<string[]>([]);
  const [status, setStatus] = useState<"idle"|"loading"|"success"|"error">("idle");
  const [msg, setMsg] = useState("");

  const AIRCRAFT_TYPES = [
    "Commercial Airliner (737, A320, etc.)", "Regional Jet (CRJ, ERJ, etc.)",
    "Turboprop (ATR, Dash 8, etc.)", "Business Jet (Citation, Gulfstream, etc.)",
    "Helicopter", "Military Aircraft", "General Aviation (Cessna, Piper, etc.)",
    "Cargo / Freighter", "Other",
  ];
  const PART_CATS = [
    "Avionics & Navigation", "Engines & APU", "Landing Gear",
    "Airframe & Structural", "Hydraulics & Pneumatics",
    "Electrical Systems", "Interiors & Cabin",
    "Rotables & Repairables", "Expendables & Consumables",
  ];

  function toggleCat(cat: string) {
    setPartCategories(prev => prev.includes(cat) ? prev.filter(c => c !== cat) : [...prev, cat]);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!email) return;
    setStatus("loading");
    try {
      const res = await fetch("/api/waitlist-emails", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, aircraftType, partCategories }),
      });
      if (res.ok) { setStatus("success"); setMsg("You're on the list! We'll notify you when Parts Link Aviation opens."); }
      else { setStatus("error"); setMsg("Something went wrong — please try again."); }
    } catch { setStatus("error"); setMsg("Network error — please try again."); }
  }

  const inp: React.CSSProperties = { width: "100%", boxSizing: "border-box", background: CARD_BG, border: "1px solid " + BORDER, borderRadius: 8, padding: "12px 16px", color: "#fff", fontSize: 15, outline: "none" };

  return (
    <section id="waitlist" style={{ background: DARK, padding: "80px 24px", borderTop: "1px solid " + BORDER }}>
      <div style={{ maxWidth: 640, margin: "0 auto", textAlign: "center" }}>
        <h2 style={{ fontFamily: "'Barlow Condensed', sans-serif", fontWeight: 800, fontSize: 34, color: "#fff", marginBottom: 12 }}>Get Early Buyer Access</h2>
        <p style={{ color: "#8fa3be", fontSize: 16, marginBottom: 40, lineHeight: 1.6 }}>Join the waitlist and be first when we open to buyers. Tell us what you source so we can prioritize the right inventory.</p>

        {status === "success" ? (
          <div style={{ background: CARD_BG, border: "1px solid " + BORDER, borderRadius: 12, padding: "32px 24px" }}>
            <div style={{ fontSize: 40, marginBottom: 12 }}>✓</div>
            <p style={{ color: GOLD, fontWeight: 700, fontSize: 18, margin: 0 }}>{msg}</p>
          </div>
        ) : (
          <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: 20, textAlign: "left" }}>
            <div>
              <label style={{ display: "block", color: "#8fa3be", fontSize: 13, fontWeight: 600, marginBottom: 6, textTransform: "uppercase", letterSpacing: 0.5 }}>Your Email *</label>
              <input type="email" required value={email} onChange={e => setEmail(e.target.value)} placeholder="you@airline.com" style={inp} />
            </div>
            <div>
              <label style={{ display: "block", color: "#8fa3be", fontSize: 13, fontWeight: 600, marginBottom: 6, textTransform: "uppercase", letterSpacing: 0.5 }}>Primary Aircraft Type</label>
              <select value={aircraftType} onChange={e => setAircraftType(e.target.value)} style={{ ...inp, color: aircraftType ? "#fff" : "#8fa3be" }}>
                <option value="">Select aircraft type…</option>
                {AIRCRAFT_TYPES.map(t => <option key={t} value={t} style={{ color: "#fff", background: CARD_BG }}>{t}</option>)}
              </select>
            </div>
            <div>
              <label style={{ display: "block", color: "#8fa3be", fontSize: 13, fontWeight: 600, marginBottom: 10, textTransform: "uppercase", letterSpacing: 0.5 }}>Part Categories You Source</label>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
                {PART_CATS.map(cat => (
                  <label key={cat} style={{ display: "flex", alignItems: "center", gap: 10, cursor: "pointer", background: partCategories.includes(cat) ? BLUE + "22" : CARD_BG, border: "1px solid " + (partCategories.includes(cat) ? BLUE : BORDER), borderRadius: 8, padding: "10px 14px" }}>
                    <input type="checkbox" checked={partCategories.includes(cat)} onChange={() => toggleCat(cat)} style={{ accentColor: BLUE, width: 16, height: 16, cursor: "pointer" }} />
                    <span style={{ color: "#cdd9e9", fontSize: 13, lineHeight: 1.3 }}>{cat}</span>
                  </label>
                ))}
              </div>
            </div>
            {status === "error" && <p style={{ color: "#e74c3c", fontSize: 14, margin: 0 }}>{msg}</p>}
            <button type="submit" disabled={status === "loading"} style={{ padding: "14px 28px", borderRadius: 8, background: status === "loading" ? "#555" : GOLD, color: "#0a1628", fontFamily: "'Barlow Condensed', sans-serif", fontWeight: 800, fontSize: 16, letterSpacing: 0.5, border: "none", cursor: status === "loading" ? "not-allowed" : "pointer" }}>
              {status === "loading" ? "Joining…" : "Join the Waitlist →"}
            </button>
          </form>
        )}
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
        { label: "Submit AOG Request", href: "/rfqs/new?urgency=aog" },
        { label: "Compliance Overview", href: "/compliance" },
      ],
    },
    {
      heading: "Company",
      links: [
        { label: "About Parts Link Aviation", href: "/about" },
        { label: "Contact Us", href: "/contact" },
        { label: "Become a Founding Seller", href: "/seller/register" },
        { label: "Admin Portal", href: "/admin" },
      ],
    },
  ];

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
            <p style={{ fontFamily: "'Barlow', sans-serif", fontSize: 13, color: "#4a6480", lineHeight: 1.7, marginBottom: 16, maxWidth: 280 }}>
              A transparent marketplace for certified aircraft components. Connecting verified sellers with professional buyers worldwide.
            </p>
            <p style={{ fontFamily: "'Barlow', sans-serif", fontSize: 11, color: "#2a4060", lineHeight: 1.6, maxWidth: 280, fontStyle: "italic", marginBottom: 16 }}>
              All sellers are required to provide documentation for listed parts. Parts Link Aviation does not independently verify certifications.
            </p>
            <a href="mailto:admin@partslinkaviation.com" style={{ fontFamily: "'Barlow', sans-serif", fontSize: 13, color: "#4a6480", textDecoration: "none" }}
              onMouseEnter={e => (e.currentTarget.style.color = "#a0b4cc")}
              onMouseLeave={e => (e.currentTarget.style.color = "#4a6480")}
            >
              admin@partslinkaviation.com
            </a>
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
      <LaunchBanner />
      <Hero onSearch={handleSearch} />
      <FoundingSellerSection />
      <PartsSearch onSearch={handleSearch} />
      <CategoryGrid onSearch={handleSearch} />
      <Features />
      <HowItWorks />
      <Pricing />
      <CtaSection />
      <FeaturedListings />
      <WaitlistSection />
      <HomeFooter />
    </div>
  );
}
