import { MainLayout } from "@/components/layout/MainLayout";
import { ShieldCheck, FileText, Scale, AlertCircle, CheckCircle2 } from "lucide-react";

const BLUE = "#1976d2";
const GOLD = "#f5a623";
const MUTED = "#7ea8c8";
const BORDER = "#1a3050";
const CARD = "#0d1f38";

function H2({ children }: { children: React.ReactNode }) {
  return <h2 style={{ fontFamily: "'Barlow Condensed', sans-serif", fontWeight: 700, fontSize: 26, color: "#fff", marginBottom: 14, marginTop: 44 }}>{children}</h2>;
}
function P({ children }: { children: React.ReactNode }) {
  return <p style={{ fontFamily: "'Barlow', sans-serif", fontSize: 15, color: MUTED, lineHeight: 1.75, marginBottom: 12 }}>{children}</p>;
}

const PROTECTIONS = [
  { icon: FileText,    title: "Document Verification",   desc: "Every listing requires traceable documentation — FAA 8130-3, EASA Form 1, or equivalent. Our team reviews uploaded documents before a listing can receive the Docs Reviewed or Verified badge." },
  { icon: ShieldCheck, title: "Seller Vetting",          desc: "All sellers complete identity verification. Verified Vendor status requires company registration documents, quality system evidence (AS9120 or equivalent), and a background check." },
  { icon: Scale,       title: "Dispute Resolution",      desc: "If a received part does not match its listing, submit a dispute within 14 days. Our dedicated disputes team investigates both sides and issues a binding resolution within 5 business days." },
  { icon: AlertCircle, title: "Counterfeit Reporting",   desc: "Zero tolerance for suspect unapproved parts. Listings suspected of being counterfeit are removed within 2 hours of report and referred to FAA/EASA as required." },
  { icon: CheckCircle2, title: "Three-Tier Badge System", desc: "Pending → Docs Reviewed → Verified. Only parts that have passed documentation review and seller vetting can display the Verified badge." },
];

const STEPS = [
  "Submit a dispute via your order history within 14 days of delivery",
  "Upload supporting evidence — photos, inspection report, receiving paperwork",
  "Parts Link Aviation notifies the seller and opens a mediation window (48 hours)",
  "If unresolved, our disputes team issues a binding decision within 5 business days",
  "Approved claims result in full refund or re-shipment at seller's cost",
];

export default function BuyerProtectionPage() {
  return (
    <MainLayout>
      <div style={{ maxWidth: 820, margin: "0 auto", padding: "60px 24px 80px" }}>
        <div style={{ display: "inline-flex", alignItems: "center", gap: 8, background: "rgba(25,118,210,0.1)", border: "1px solid rgba(25,118,210,0.3)", borderRadius: 4, padding: "4px 14px", marginBottom: 16 }}>
          <ShieldCheck size={12} color={BLUE} />
          <span style={{ fontFamily: "'Barlow Condensed', sans-serif", fontWeight: 700, fontSize: 12, color: BLUE, letterSpacing: "0.08em", textTransform: "uppercase" }}>Trust & Safety</span>
        </div>
        <h1 style={{ fontFamily: "'Barlow Condensed', sans-serif", fontWeight: 900, fontSize: 52, color: "#fff", textTransform: "uppercase", marginBottom: 12 }}>
          Buyer <span style={{ color: GOLD }}>Protection</span>
        </h1>
        <P>Parts Link Aviation is built on the principle that every buyer deserves confidence. Our multi-layer protection system covers documentation verification, seller vetting, and structured dispute resolution.</P>

        {/* Protection pillars */}
        <H2>How We Protect Buyers</H2>
        <div style={{ display: "flex", flexDirection: "column", gap: 14, marginBottom: 32 }}>
          {PROTECTIONS.map(({ icon: Icon, title, desc }) => (
            <div key={title} style={{ background: CARD, border: `1px solid ${BORDER}`, borderRadius: 12, padding: "20px 22px", display: "flex", gap: 16 }}>
              <div style={{ width: 42, height: 42, borderRadius: 10, background: "rgba(25,118,210,0.1)", border: "1px solid rgba(25,118,210,0.2)", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                <Icon size={18} color={BLUE} />
              </div>
              <div>
                <h3 style={{ fontFamily: "'Barlow Condensed', sans-serif", fontWeight: 700, fontSize: 18, color: "#fff", marginBottom: 6 }}>{title}</h3>
                <p style={{ fontFamily: "'Barlow', sans-serif", fontSize: 14, color: MUTED, lineHeight: 1.7, margin: 0 }}>{desc}</p>
              </div>
            </div>
          ))}
        </div>

        {/* Dispute process */}
        <H2>Dispute Resolution Process</H2>
        <div style={{ display: "flex", flexDirection: "column", gap: 12, marginBottom: 32 }}>
          {STEPS.map((step, i) => (
            <div key={i} style={{ display: "flex", gap: 16, alignItems: "flex-start" }}>
              <div style={{ width: 28, height: 28, borderRadius: "50%", background: BLUE, color: "#fff", fontFamily: "'Barlow Condensed', sans-serif", fontWeight: 800, fontSize: 14, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>{i + 1}</div>
              <p style={{ fontFamily: "'Barlow', sans-serif", fontSize: 15, color: MUTED, lineHeight: 1.6, margin: "4px 0 0" }}>{step}</p>
            </div>
          ))}
        </div>

        {/* What's NOT covered */}
        <H2>What Is Not Covered</H2>
        <P>Buyer Protection does not cover parts that have been installed on aircraft, parts where the buyer's receiving inspection failed to note discrepancies at time of delivery, or purchases made outside of the Parts Link Aviation platform.</P>

        <div style={{ background: "rgba(245,166,35,0.08)", border: "1px solid rgba(245,166,35,0.25)", borderRadius: 12, padding: "20px 24px", marginTop: 32 }}>
          <p style={{ fontFamily: "'Barlow Condensed', sans-serif", fontWeight: 800, fontSize: 17, color: "#f5a623", marginBottom: 8 }}>Need to file a dispute?</p>
          <p style={{ fontFamily: "'Barlow', sans-serif", fontSize: 15, color: MUTED, margin: 0 }}>Contact our disputes team at <a href="mailto:disputes@partslinkaviation.com" style={{ color: BLUE, textDecoration: "none" }}>disputes@partslinkaviation.com</a> or call <a href="tel:+18002376247" style={{ color: BLUE, textDecoration: "none" }}>1-800-AERO-247</a>.</p>
        </div>
      </div>
    </MainLayout>
  );
}
