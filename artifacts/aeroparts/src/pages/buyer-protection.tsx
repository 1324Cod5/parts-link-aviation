import { MainLayout } from "@/components/layout/MainLayout";
import { ShieldCheck, FileText, AlertCircle, CheckCircle2, Star, Ban } from "lucide-react";

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

const PILLARS = [
  {
    icon: FileText,
    title: "Seller Certification Review",
    desc: "All sellers must upload certification documents for every part they list. Our admin team reviews uploaded documents before a listing can receive the Docs Reviewed or Verified badge. Listings without documentation remain in Pending status.",
  },
  {
    icon: Star,
    title: "Trust Score System",
    desc: "Every seller account has a Trust Score based on verified listings, responsiveness to buyer inquiries, and account standing. Scores are visible on listings and in the MRO directory so buyers can make informed decisions.",
  },
  {
    icon: AlertCircle,
    title: "Report Fraudulent Listings",
    desc: "Buyers can report any listing they believe is fraudulent, inaccurate, or non-compliant. Reports are reviewed by our admin team within one business day. Suspect listings are hidden from search while under review.",
  },
  {
    icon: Ban,
    title: "Seller Suspension",
    desc: "Admins can suspend sellers who violate platform rules — including misrepresenting parts, uploading forged documents, or receiving repeated buyer complaints. Suspended sellers lose all listing visibility immediately.",
  },
  {
    icon: CheckCircle2,
    title: "Three-Tier Badge System",
    desc: "Pending → Docs Reviewed → Verified. Only parts that have passed admin documentation review can display the Docs Reviewed badge. Full Verified status requires additional seller vetting. Buyers should always check badge status before engaging.",
  },
  {
    icon: ShieldCheck,
    title: "Certification Document Requirements",
    desc: "All sellers must upload traceable airworthiness documentation — FAA 8130-3, EASA Form 1, or equivalent — for each listed part. Parts without supporting documents cannot advance beyond Pending status.",
  },
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
          Platform <span style={{ color: GOLD }}>Trust & Safety</span>
        </h1>
        <P>Parts Link Aviation is a discovery and listing platform. Buyers and sellers connect here, but transactions happen directly between parties outside the platform. We do not process payments, hold funds, or provide financial guarantees.</P>
        <P>What we do provide is a set of platform-level controls to help buyers identify trustworthy sellers and report bad actors.</P>

        <div style={{ background: "rgba(245,166,35,0.07)", border: "1px solid rgba(245,166,35,0.25)", borderRadius: 12, padding: "18px 22px", marginBottom: 32 }}>
          <p style={{ fontFamily: "'Barlow Condensed', sans-serif", fontWeight: 800, fontSize: 15, color: GOLD, marginBottom: 6 }}>Important: No Financial Protection</p>
          <p style={{ fontFamily: "'Barlow', sans-serif", fontSize: 14, color: MUTED, margin: 0, lineHeight: 1.65 }}>
            All transactions occur directly between buyer and seller, off-platform. Parts Link Aviation is not a party to any transaction, does not hold escrow, and cannot issue refunds or charge-backs. Buyers should conduct their own due diligence and use traceable payment methods.
          </p>
        </div>

        <H2>What the Platform Provides</H2>
        <div style={{ display: "flex", flexDirection: "column", gap: 14, marginBottom: 32 }}>
          {PILLARS.map(({ icon: Icon, title, desc }) => (
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

        <H2>Buyer Guidance</H2>
        <div style={{ display: "flex", flexDirection: "column", gap: 12, marginBottom: 32 }}>
          {[
            "Check a seller's badge status — Verified sellers have passed admin document review.",
            "Review the Trust Score — higher scores reflect consistent listing quality and responsiveness.",
            "Request full airworthiness documentation (8130-3 / EASA Form 1) before committing to any purchase.",
            "Use traceable payment methods and retain all correspondence with the seller.",
            "Report any listing that appears fraudulent or inaccurate using the Report button on the listing page.",
          ].map((step, i) => (
            <div key={i} style={{ display: "flex", gap: 16, alignItems: "flex-start" }}>
              <div style={{ width: 28, height: 28, borderRadius: "50%", background: BLUE, color: "#fff", fontFamily: "'Barlow Condensed', sans-serif", fontWeight: 800, fontSize: 14, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>{i + 1}</div>
              <p style={{ fontFamily: "'Barlow', sans-serif", fontSize: 15, color: MUTED, lineHeight: 1.6, margin: "4px 0 0" }}>{step}</p>
            </div>
          ))}
        </div>

        <div style={{ background: CARD, border: `1px solid ${BORDER}`, borderRadius: 12, padding: "20px 24px", marginTop: 32 }}>
          <p style={{ fontFamily: "'Barlow Condensed', sans-serif", fontWeight: 800, fontSize: 17, color: "#fff", marginBottom: 8 }}>Report a Listing or Seller</p>
          <p style={{ fontFamily: "'Barlow', sans-serif", fontSize: 15, color: MUTED, margin: 0 }}>
            To report a fraudulent listing or seller, email <a href="mailto:admin@partslinkaviation.com" style={{ color: BLUE, textDecoration: "none" }}>admin@partslinkaviation.com</a> with the listing ID and details of your concern. Our team reviews all reports within one business day.
          </p>
        </div>
      </div>
    </MainLayout>
  );
}
