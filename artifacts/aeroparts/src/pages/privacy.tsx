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

export default function PrivacyPage() {
  return (
    <MainLayout>
      <div style={{ maxWidth: 760, margin: "0 auto", padding: "60px 24px 80px" }}>
        <h1 style={{ fontFamily: "'Barlow Condensed', sans-serif", fontWeight: 900, fontSize: 52, color: "#fff", textTransform: "uppercase", marginBottom: 8 }}>Privacy Policy</h1>
        <p style={{ fontFamily: "'Barlow', sans-serif", fontSize: 14, color: "#4a6480", marginBottom: 40 }}>Last updated: {DATE}</p>

        <H2>1. Information We Collect</H2>
        <P>Parts Link Aviation collects information you provide directly — including name, company, email address, phone number, and payment information — when you register, create listings, or contact us. We also collect usage data, log files, and cookies automatically when you use our platform.</P>

        <H2>2. How We Use Your Information</H2>
        <ul style={{ paddingLeft: 20, marginBottom: 12 }}>
          <Li>To provide and improve the Parts Link Aviation marketplace</Li>
          <Li>To process transactions and send billing notifications</Li>
          <Li>To facilitate communication between buyers and sellers</Li>
          <Li>To send platform updates, alerts, and marketing emails (opt-out available)</Li>
          <Li>To comply with legal obligations and prevent fraud</Li>
        </ul>

        <H2>3. Information Sharing</H2>
        <P>We do not sell your personal data. We share information only with:</P>
        <ul style={{ paddingLeft: 20, marginBottom: 12 }}>
          <Li>Verified counterparties in transactions you initiate</Li>
          <Li>Payment processors for billing</Li>
          <Li>Email service providers for notifications</Li>
          <Li>Law enforcement when required by applicable law</Li>
        </ul>

        <H2>4. Data Retention</H2>
        <P>We retain your data for as long as your account is active. Listing and transaction records are retained for 7 years for compliance and audit purposes. You may request deletion of personal data by contacting admin@partslinkaviation.com.</P>

        <H2>5. Security</H2>
        <P>We use industry-standard encryption (TLS 1.3), secure password hashing (bcrypt), and regular security audits to protect your data. No system is 100% secure — we notify affected users within 72 hours of a confirmed breach.</P>

        <H2>6. Your Rights (GDPR / CCPA)</H2>
        <ul style={{ paddingLeft: 20, marginBottom: 12 }}>
          <Li>Right to access — request a copy of your personal data</Li>
          <Li>Right to rectification — correct inaccurate data</Li>
          <Li>Right to erasure — request deletion ("right to be forgotten")</Li>
          <Li>Right to data portability — export your data in machine-readable format</Li>
          <Li>Right to opt out of marketing communications at any time</Li>
        </ul>

        <H2>7. Cookies</H2>
        <P>We use essential, analytics, and preference cookies. See our <a href="/cookies" style={{ color: "#1976d2", textDecoration: "none" }}>Cookie Policy</a> for details and opt-out instructions.</P>

        <H2>8. Contact</H2>
        <P>For privacy questions or data requests, contact our Data Protection Officer at: <a href="mailto:admin@partslinkaviation.com" style={{ color: "#1976d2", textDecoration: "none" }}>admin@partslinkaviation.com</a></P>

        <div style={{ marginTop: 48, padding: "20px 24px", borderTop: `1px solid ${BORDER}`, fontFamily: "'Barlow', sans-serif", fontSize: 13, color: "#4a6480" }}>
          Parts Link Aviation is a registered platform compliant with GDPR, CCPA, and applicable aviation data regulations.
        </div>
      </div>
    </MainLayout>
  );
}
