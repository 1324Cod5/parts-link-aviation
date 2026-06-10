import { MainLayout } from "@/components/layout/MainLayout";

const MUTED = "#7ea8c8";
const BORDER = "#1a3050";
const DATE = "May 26, 2026";

function H2({ children }: { children: React.ReactNode }) {
  return <h2 style={{ fontFamily: "'Barlow Condensed', sans-serif", fontWeight: 700, fontSize: 24, color: "#fff", marginBottom: 10, marginTop: 36 }}>{children}</h2>;
}
function P({ children }: { children: React.ReactNode }) {
  return <p style={{ fontFamily: "'Barlow', sans-serif", fontSize: 15, color: MUTED, lineHeight: 1.75, marginBottom: 12 }}>{children}</p>;
}
function Li({ children }: { children: React.ReactNode }) {
  return <li style={{ fontFamily: "'Barlow', sans-serif", fontSize: 15, color: MUTED, lineHeight: 1.75, marginBottom: 6 }}>{children}</li>;
}

export default function TermsPage() {
  return (
    <MainLayout>
      <div style={{ maxWidth: 760, margin: "0 auto", padding: "60px 24px 80px" }}>
        <h1 style={{ fontFamily: "'Barlow Condensed', sans-serif", fontWeight: 900, fontSize: 52, color: "#fff", textTransform: "uppercase", marginBottom: 8 }}>Terms of Service</h1>
        <p style={{ fontFamily: "'Barlow', sans-serif", fontSize: 14, color: "#4a6480", marginBottom: 40 }}>Last updated: {DATE} — Effective immediately upon registration</p>

        <H2>1. Acceptance of Terms</H2>
        <P>By accessing or using Parts Link Aviation ("the Platform"), you agree to be bound by these Terms of Service. If you do not agree, you may not use the Platform. These terms apply to all users — buyers, sellers, and MRO providers.</P>

        <H2>2. Eligibility</H2>
        <P>You must be at least 18 years old and authorized to act on behalf of any business entity you represent. Sellers must hold valid certifications required by applicable aviation regulations (FAA, EASA, TCCA, CAAC, or equivalent) for the parts they list.</P>

        <H2>3. Seller Obligations</H2>
        <ul style={{ paddingLeft: 20, marginBottom: 12 }}>
          <Li>All listed parts must be accurately described with correct part numbers, condition, and documentation status</Li>
          <Li>Sellers must hold legally transferable title to listed parts</Li>
          <Li>Counterfeit, unapproved, or undocumented parts are strictly prohibited</Li>
          <Li>Sellers must respond to buyer inquiries within 48 hours or listings may be suspended</Li>
          <Li>Sellers are responsible for accurate export control classification (ITAR/EAR)</Li>
        </ul>

        <H2>4. Buyer Obligations</H2>
        <ul style={{ paddingLeft: 20, marginBottom: 12 }}>
          <Li>Buyers must perform their own due diligence before purchasing aircraft parts</Li>
          <Li>Parts must only be used on aircraft in accordance with applicable airworthiness regulations</Li>
          <Li>Buyers are responsible for verifying part authenticity and documentation with their AMO/MRO</Li>
        </ul>

        <H2>5. Prohibited Conduct</H2>
        <P>The following are prohibited on the Platform: listing counterfeit or suspect unapproved parts (SUPs), circumventing the platform to conduct direct transactions to avoid fees, misrepresenting certification status, creating multiple accounts to evade suspensions, and any conduct that violates applicable aviation safety regulations.</P>

        <H2>6. Platform Fees</H2>
        <P>Subscription fees are charged as described on the Pricing page. All fees are non-refundable except where required by law. We reserve the right to change pricing with 30 days' notice to active subscribers.</P>

        <H2>7. Limitation of Liability</H2>
        <P>Parts Link Aviation is a marketplace facilitator and is not a party to any transaction between buyers and sellers. We make no warranty regarding the quality, safety, or suitability of listed parts. Our liability is limited to subscription fees paid in the 12 months preceding any claim.</P>

        <H2>8. Termination</H2>
        <P>We may suspend or terminate accounts that violate these terms, with or without notice, for violations including listing prohibited parts, fraudulent conduct, or non-payment. You may terminate your account at any time via account settings.</P>

        <H2>9. Governing Law</H2>
        <P>These terms are governed by the laws of the State of Delaware, USA. Disputes shall be resolved by binding arbitration under JAMS rules.</P>

        <H2>10. Contact</H2>
        <P>Legal inquiries: <a href="mailto:admin@partslinkaviation.com" style={{ color: "#1976d2", textDecoration: "none" }}>admin@partslinkaviation.com</a></P>

        <div style={{ marginTop: 48, padding: "20px 24px", borderTop: `1px solid ${BORDER}`, fontFamily: "'Barlow', sans-serif", fontSize: 13, color: "#4a6480" }}>
          By using Parts Link Aviation you acknowledge you have read, understood, and agree to these terms.
        </div>
      </div>
    </MainLayout>
  );
}
