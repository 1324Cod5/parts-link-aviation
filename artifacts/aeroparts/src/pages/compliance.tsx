import { MainLayout } from "@/components/layout/MainLayout";
import { ShieldCheck } from "lucide-react";

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

const FRAMEWORKS = [
  {
    code: "FAA",
    full: "Federal Aviation Administration",
    desc: "Parts Link Aviation requires FAA Form 8130-3 for all parts intended for US-registered aircraft. Sellers must comply with FAA AC 00-56B (Voluntary Industry Distributor Accreditation Program) standards.",
    items: ["8130-3 Authorized Release Certificate required", "Traceability to OEM or overhaul facility", "Shelf life and time/cycle tracking for life-limited parts", "Counterfeit part prevention per AC 21-43"],
  },
  {
    code: "EASA",
    full: "European Union Aviation Safety Agency",
    desc: "For parts entering EU-regulated aircraft, EASA Form 1 (or equivalent bilateral release) is required. Sellers in EASA jurisdiction must hold or work with EASA Part 145 approval.",
    items: ["EASA Form 1 (or equivalent) for EU aircraft", "Part 145 organization involvement for maintenance articles", "REACH compliance for chemical/composite parts", "CS-ETSO documentation where applicable"],
  },
  {
    code: "AS9120",
    full: "Aerospace Quality Management — Distribution",
    desc: "Sellers with AS9120 certification have demonstrated a quality management system that meets the aerospace supply chain standard for distributors. Parts Link Aviation recognizes AS9120B and AS9120C.",
    items: ["Independent quality management system", "Counterfeit parts prevention program", "First Article Inspection (FAI) capability", "Calibrated inspection tooling"],
  },
  {
    code: "ISO 9001:2015",
    full: "Quality Management Systems",
    desc: "ISO 9001:2015 certification demonstrates a baseline quality management system. While not aviation-specific, it's recognized as a foundation for sellers working toward AS9120.",
    items: ["Document control and record retention", "Corrective action processes", "Supplier evaluation program", "Customer focus and continuous improvement"],
  },
  {
    code: "ITAR / EAR",
    full: "Export Control Regulations",
    desc: "Many aircraft parts are subject to ITAR (International Traffic in Arms Regulations) or EAR (Export Administration Regulations). Sellers are responsible for classifying their parts and obtaining required export licenses.",
    items: ["ECCN or USML classification required on listings", "No unlicensed export to embargoed countries", "End-use certificates may be required", "Parts Link Aviation provides export control guidance but not compliance certification"],
  },
];

export default function CompliancePage() {
  return (
    <MainLayout>
      <div style={{ maxWidth: 820, margin: "0 auto", padding: "60px 24px 80px" }}>
        <div style={{ display: "inline-flex", alignItems: "center", gap: 8, background: "rgba(25,118,210,0.1)", border: "1px solid rgba(25,118,210,0.3)", borderRadius: 4, padding: "4px 14px", marginBottom: 16 }}>
          <ShieldCheck size={12} color={BLUE} />
          <span style={{ fontFamily: "'Barlow Condensed', sans-serif", fontWeight: 700, fontSize: 12, color: BLUE, letterSpacing: "0.08em", textTransform: "uppercase" }}>Regulatory</span>
        </div>
        <h1 style={{ fontFamily: "'Barlow Condensed', sans-serif", fontWeight: 900, fontSize: 52, color: "#fff", textTransform: "uppercase", marginBottom: 12 }}>
          Compliance <span style={{ color: GOLD }}>Overview</span>
        </h1>
        <P>Parts Link Aviation operates at the intersection of multiple international aviation regulatory frameworks. This page summarizes how the platform supports compliance for buyers and sellers across jurisdictions.</P>

        {/* Badges strip */}
        <div style={{ display: "flex", flexWrap: "wrap", gap: 10, marginBottom: 44 }}>
          {["FAA Approved", "EASA Part 145", "AS9120B/C", "ISO 9001:2015", "ITAR Compliant", "CAAC Auth"].map(b => (
            <span key={b} style={{ fontFamily: "'Barlow Condensed', sans-serif", fontWeight: 700, fontSize: 13, letterSpacing: "0.05em", textTransform: "uppercase", color: "#4ade80", background: "rgba(74,222,128,0.08)", border: "1px solid rgba(74,222,128,0.2)", borderRadius: 4, padding: "5px 14px" }}>{b}</span>
          ))}
        </div>

        {FRAMEWORKS.map(fw => (
          <div key={fw.code} style={{ marginBottom: 40 }}>
            <div style={{ display: "flex", alignItems: "baseline", gap: 12, marginBottom: 14, marginTop: 44 }}>
              <span style={{ fontFamily: "'Barlow Condensed', sans-serif", fontWeight: 900, fontSize: 28, color: GOLD }}>{fw.code}</span>
              <span style={{ fontFamily: "'Barlow', sans-serif", fontSize: 15, color: MUTED }}>{fw.full}</span>
            </div>
            <P>{fw.desc}</P>
            <div style={{ background: CARD, border: `1px solid ${BORDER}`, borderRadius: 12, padding: "18px 22px" }}>
              <ul style={{ listStyle: "none", padding: 0, margin: 0, display: "flex", flexDirection: "column", gap: 10 }}>
                {fw.items.map(item => (
                  <li key={item} style={{ display: "flex", gap: 10, alignItems: "flex-start" }}>
                    <span style={{ color: "#4ade80", fontSize: 14, lineHeight: "1.5", flexShrink: 0 }}>✓</span>
                    <span style={{ fontFamily: "'Barlow', sans-serif", fontSize: 14, color: MUTED, lineHeight: 1.65 }}>{item}</span>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        ))}

        <div style={{ background: "rgba(25,118,210,0.08)", border: "1px solid rgba(25,118,210,0.2)", borderRadius: 12, padding: "20px 24px", marginTop: 40 }}>
          <p style={{ fontFamily: "'Barlow Condensed', sans-serif", fontWeight: 800, fontSize: 17, color: "#fff", marginBottom: 8 }}>Compliance questions?</p>
          <p style={{ fontFamily: "'Barlow', sans-serif", fontSize: 15, color: MUTED, margin: 0 }}>
            Contact our compliance team at <a href="mailto:compliance@partslinkaviation.com" style={{ color: BLUE, textDecoration: "none" }}>compliance@partslinkaviation.com</a>
          </p>
        </div>
      </div>
    </MainLayout>
  );
}
