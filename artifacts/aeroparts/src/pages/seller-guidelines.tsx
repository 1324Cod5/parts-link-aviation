import { MainLayout } from "@/components/layout/MainLayout";
import { CheckCircle2, XCircle, AlertTriangle } from "lucide-react";

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

const ALLOWED = [
  "Parts with traceable airworthiness documentation (8130-3, EASA Form 1, etc.)",
  "Rotables with accurate time/cycle tracking and current status",
  "Expendables with valid shelf life and lot traceability",
  "Aircraft structural parts with full material certifications",
  "Avionics and electrical components with installation and test records",
  "Engines and APUs with complete back-to-birth documentation",
];

const PROHIBITED = [
  "Suspect unapproved parts (SUPs) or counterfeit parts of any kind",
  "Parts with altered, erased, or falsified documentation",
  "Life-limited parts that have exceeded their TBO/TBR/TBC",
  "Parts from unknown or unverified sources without traceability",
  "Parts listed as 'scrap' or 'for parts only' without clear labeling",
  "Pyrotechnic devices, hazardous materials, or weapons components",
  "Parts under active airworthiness directive (AD) without disclosure",
];

const LISTING_RULES = [
  { rule: "Part Numbers", detail: "Must exactly match the part number on the associated documentation. No wildcards or partial part numbers." },
  { rule: "Condition",    detail: "Select the most conservative condition accurately. New, Overhauled, Serviceable, As-Removed, or Repaired — do not overstate." },
  { rule: "Photos",       detail: "At least one clear photo of the actual part is strongly recommended. Stock photos are not permitted for used parts." },
  { rule: "Price",        detail: "Price must be in USD. 'Contact for Price' is permitted only when price genuinely varies based on quantity or configuration." },
  { rule: "Aircraft",     detail: "Specify the aircraft applicability accurately. Incorrect applicability claims are grounds for listing removal." },
  { rule: "Trace",        detail: "Include chain of custody and trace history text. The more complete, the faster your review will complete." },
];

export default function SellerGuidelinesPage() {
  return (
    <MainLayout>
      <div style={{ maxWidth: 820, margin: "0 auto", padding: "60px 24px 80px" }}>
        <div style={{ display: "inline-flex", alignItems: "center", gap: 8, background: "rgba(245,166,35,0.1)", border: "1px solid rgba(245,166,35,0.3)", borderRadius: 4, padding: "4px 14px", marginBottom: 16 }}>
          <CheckCircle2 size={12} color={GOLD} />
          <span style={{ fontFamily: "'Barlow Condensed', sans-serif", fontWeight: 700, fontSize: 12, color: GOLD, letterSpacing: "0.08em", textTransform: "uppercase" }}>Sellers</span>
        </div>
        <h1 style={{ fontFamily: "'Barlow Condensed', sans-serif", fontWeight: 900, fontSize: 52, color: "#fff", textTransform: "uppercase", marginBottom: 12 }}>
          Seller <span style={{ color: GOLD }}>Guidelines</span>
        </h1>
        <P>Parts Link Aviation is a curated marketplace for certified aviation components. These guidelines exist to maintain the integrity and safety standards that define how parts are listed, documented, and transacted on this platform.</P>

        {/* Allowed */}
        <H2>Permitted Listings</H2>
        <div style={{ background: CARD, border: "1px solid rgba(74,222,128,0.2)", borderRadius: 12, padding: "18px 22px", marginBottom: 24 }}>
          {ALLOWED.map(item => (
            <div key={item} style={{ display: "flex", gap: 12, alignItems: "flex-start", marginBottom: 12 }}>
              <CheckCircle2 size={16} color="#4ade80" style={{ flexShrink: 0, marginTop: 1 }} />
              <span style={{ fontFamily: "'Barlow', sans-serif", fontSize: 14, color: MUTED, lineHeight: 1.6 }}>{item}</span>
            </div>
          ))}
        </div>

        {/* Prohibited */}
        <H2>Strictly Prohibited</H2>
        <div style={{ background: CARD, border: "1px solid rgba(239,68,68,0.2)", borderRadius: 12, padding: "18px 22px", marginBottom: 24 }}>
          {PROHIBITED.map(item => (
            <div key={item} style={{ display: "flex", gap: 12, alignItems: "flex-start", marginBottom: 12 }}>
              <XCircle size={16} color="#ef4444" style={{ flexShrink: 0, marginTop: 1 }} />
              <span style={{ fontFamily: "'Barlow', sans-serif", fontSize: 14, color: MUTED, lineHeight: 1.6 }}>{item}</span>
            </div>
          ))}
        </div>

        {/* Listing rules */}
        <H2>Listing Quality Standards</H2>
        <div style={{ display: "flex", flexDirection: "column", gap: 10, marginBottom: 32 }}>
          {LISTING_RULES.map(({ rule, detail }) => (
            <div key={rule} style={{ background: CARD, border: `1px solid ${BORDER}`, borderRadius: 10, padding: "14px 18px", display: "flex", gap: 14 }}>
              <span style={{ fontFamily: "'Barlow Condensed', sans-serif", fontWeight: 800, fontSize: 14, color: "#fff", minWidth: 100, letterSpacing: "0.04em", textTransform: "uppercase", paddingTop: 1 }}>{rule}</span>
              <span style={{ fontFamily: "'Barlow', sans-serif", fontSize: 14, color: MUTED, lineHeight: 1.65 }}>{detail}</span>
            </div>
          ))}
        </div>

        {/* Enforcement */}
        <H2>Enforcement</H2>
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          {[
            { level: "Warning",    color: "#facc15", desc: "First violation of listing quality standards. Listing is temporarily hidden pending correction." },
            { level: "Suspension", color: "#f97316", desc: "Repeated violations or first-time serious violations. Account suspended for 30 days." },
            { level: "Permanent Ban", color: "#ef4444", desc: "Listing of counterfeit parts, fraudulent documentation, or export control violations. No appeal." },
          ].map(({ level, color, desc }) => (
            <div key={level} style={{ background: CARD, border: `1px solid ${BORDER}`, borderRadius: 10, padding: "14px 18px", display: "flex", gap: 14, alignItems: "flex-start" }}>
              <AlertTriangle size={16} color={color} style={{ flexShrink: 0, marginTop: 2 }} />
              <div>
                <span style={{ fontFamily: "'Barlow Condensed', sans-serif", fontWeight: 700, fontSize: 16, color }}>
                  {level}
                </span>
                <span style={{ fontFamily: "'Barlow', sans-serif", fontSize: 14, color: MUTED, marginLeft: 8 }}>{desc}</span>
              </div>
            </div>
          ))}
        </div>

        <div style={{ marginTop: 48, padding: "20px 24px", background: "rgba(25,118,210,0.06)", border: "1px solid rgba(25,118,210,0.2)", borderRadius: 12 }}>
          <p style={{ fontFamily: "'Barlow', sans-serif", fontSize: 15, color: MUTED, margin: 0 }}>
            Questions about listing eligibility? Contact <a href="mailto:sellers@partslinkaviation.com" style={{ color: BLUE, textDecoration: "none" }}>sellers@partslinkaviation.com</a>
          </p>
        </div>
      </div>
    </MainLayout>
  );
}
