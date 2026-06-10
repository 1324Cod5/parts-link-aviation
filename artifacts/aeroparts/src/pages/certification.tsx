import { MainLayout } from "@/components/layout/MainLayout";
import { FileCheck2, Upload, Eye, BadgeCheck, Clock } from "lucide-react";

const BLUE = "#1976d2";
const GOLD = "#f5a623";
const MUTED = "#7ea8c8";
const BORDER = "#1a3050";
const CARD = "#0d1f38";

function H2({ c = "#fff", children }: { c?: string; children: React.ReactNode }) {
  return <h2 style={{ fontFamily: "'Barlow Condensed', sans-serif", fontWeight: 700, fontSize: 26, color: c, marginBottom: 14, marginTop: 44 }}>{children}</h2>;
}
function P({ children }: { children: React.ReactNode }) {
  return <p style={{ fontFamily: "'Barlow', sans-serif", fontSize: 15, color: MUTED, lineHeight: 1.75, marginBottom: 12 }}>{children}</p>;
}

const DOC_TYPES = [
  { name: "FAA Form 8130-3",    standard: "FAA",   desc: "Required for most US-registered aircraft and parts entering US aviation. Includes trace data, condition, and release authority." },
  { name: "EASA Form 1",       standard: "EASA",  desc: "European Aviation Safety Agency release document. Required for parts entering EU, UK, and most EASA-member state aircraft." },
  { name: "TCCA Form 1",       standard: "TCCA",  desc: "Transport Canada Civil Aviation release. Required for Canadian-registered aircraft." },
  { name: "Overhaul Report",   standard: "OEM",   desc: "Manufacturer or MRO overhaul documentation with work scope, test results, and release signature." },
  { name: "Certificate of Conformance", standard: "QC", desc: "Quality conformance certificate from manufacturer confirming the part meets original type design data." },
  { name: "Test Report",       standard: "MRO",   desc: "Bench test or functional test report from an approved maintenance organization." },
];

const STAGES = [
  { icon: Upload,      label: "1. Document Upload",     desc: "Seller uploads certification documents during listing creation. Accepted formats: PDF, JPG, PNG (max 20 MB each)." },
  { icon: Eye,         label: "2. Initial Scan",        desc: "Our automated system checks for document structure, visible release authority blocks, and date validity. Incomplete documents are flagged immediately." },
  { icon: FileCheck2,  label: "3. Manual Review",       desc: "A qualified reviewer (minimum A&P certificate holder or equivalent) examines each document for authenticity, completeness, and consistency with the listed part number." },
  { icon: BadgeCheck,  label: "4. Badge Upgrade",       desc: "Listings that pass review are upgraded from Pending to Docs Reviewed. A full seller verification can further elevate to Verified." },
  { icon: Clock,       label: "5. Review Timeline",     desc: "Standard review: 24–48 hours. Expedited AOG review: available within 4 hours for Pro and Enterprise sellers." },
];

export default function CertificationPage() {
  return (
    <MainLayout>
      <div style={{ maxWidth: 820, margin: "0 auto", padding: "60px 24px 80px" }}>
        <div style={{ display: "inline-flex", alignItems: "center", gap: 8, background: "rgba(25,118,210,0.1)", border: "1px solid rgba(25,118,210,0.3)", borderRadius: 4, padding: "4px 14px", marginBottom: 16 }}>
          <FileCheck2 size={12} color={BLUE} />
          <span style={{ fontFamily: "'Barlow Condensed', sans-serif", fontWeight: 700, fontSize: 12, color: BLUE, letterSpacing: "0.08em", textTransform: "uppercase" }}>Documentation</span>
        </div>
        <h1 style={{ fontFamily: "'Barlow Condensed', sans-serif", fontWeight: 900, fontSize: 52, color: "#fff", textTransform: "uppercase", marginBottom: 12 }}>
          Certification <span style={{ color: GOLD }}>Process</span>
        </h1>
        <P>Every part listed on Parts Link Aviation must be accompanied by traceable airworthiness documentation. Our multi-stage review ensures buyers can trust the certification status of every listed component.</P>

        <H2>Accepted Documentation Types</H2>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: 32 }}>
          {DOC_TYPES.map(d => (
            <div key={d.name} style={{ background: CARD, border: `1px solid ${BORDER}`, borderRadius: 10, padding: "16px 18px" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
                <span style={{ fontFamily: "'Barlow Condensed', sans-serif", fontWeight: 700, fontSize: 16, color: "#fff" }}>{d.name}</span>
                <span style={{ fontFamily: "'Barlow', sans-serif", fontSize: 11, color: BLUE, background: "rgba(25,118,210,0.1)", border: "1px solid rgba(25,118,210,0.2)", padding: "2px 8px", borderRadius: 4 }}>{d.standard}</span>
              </div>
              <p style={{ fontFamily: "'Barlow', sans-serif", fontSize: 13, color: MUTED, margin: 0, lineHeight: 1.6 }}>{d.desc}</p>
            </div>
          ))}
        </div>

        <H2>Review Process</H2>
        <div style={{ display: "flex", flexDirection: "column", gap: 12, marginBottom: 32 }}>
          {STAGES.map(({ icon: Icon, label, desc }) => (
            <div key={label} style={{ background: CARD, border: `1px solid ${BORDER}`, borderRadius: 12, padding: "18px 20px", display: "flex", gap: 16 }}>
              <div style={{ width: 40, height: 40, borderRadius: 9, background: "rgba(245,166,35,0.1)", border: "1px solid rgba(245,166,35,0.25)", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                <Icon size={17} color={GOLD} />
              </div>
              <div>
                <h3 style={{ fontFamily: "'Barlow Condensed', sans-serif", fontWeight: 700, fontSize: 16, color: "#fff", marginBottom: 4 }}>{label}</h3>
                <p style={{ fontFamily: "'Barlow', sans-serif", fontSize: 14, color: MUTED, margin: 0, lineHeight: 1.65 }}>{desc}</p>
              </div>
            </div>
          ))}
        </div>

        <H2>Badge Levels Explained</H2>
        <div style={{ display: "flex", flexDirection: "column", gap: 10, marginBottom: 32 }}>
          {[
            { badge: "Pending Verification", color: "#6b7280", desc: "Listing has been submitted but documents have not yet been reviewed." },
            { badge: "Docs Reviewed",         color: "#3b82f6", desc: "Documents have passed our manual review. Seller identity has been confirmed." },
            { badge: "Verified",              color: "#f5a623", desc: "Full seller vetting complete — company registration, quality system, and background check passed." },
          ].map(b => (
            <div key={b.badge} style={{ display: "flex", alignItems: "center", gap: 14, background: CARD, border: `1px solid ${BORDER}`, borderRadius: 10, padding: "14px 18px" }}>
              <span style={{ width: 10, height: 10, borderRadius: "50%", background: b.color, flexShrink: 0 }} />
              <div>
                <span style={{ fontFamily: "'Barlow Condensed', sans-serif", fontWeight: 700, fontSize: 16, color: "#fff" }}>{b.badge}</span>
                <span style={{ fontFamily: "'Barlow', sans-serif", fontSize: 14, color: MUTED, marginLeft: 10 }}>{b.desc}</span>
              </div>
            </div>
          ))}
        </div>

        <P>Questions about the certification process? Contact <a href="mailto:admin@partslinkaviation.com" style={{ color: BLUE, textDecoration: "none" }}>admin@partslinkaviation.com</a></P>
      </div>
    </MainLayout>
  );
}
