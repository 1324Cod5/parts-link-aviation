import { MainLayout } from "@/components/layout/MainLayout";

const MUTED = "#7ea8c8";
const BORDER = "#1a3050";
const CARD = "#0d1f38";
const DATE = "May 26, 2026";

function H2({ children }: { children: React.ReactNode }) {
  return <h2 style={{ fontFamily: "'Barlow Condensed', sans-serif", fontWeight: 700, fontSize: 24, color: "#fff", marginBottom: 10, marginTop: 36 }}>{children}</h2>;
}
function P({ children }: { children: React.ReactNode }) {
  return <p style={{ fontFamily: "'Barlow', sans-serif", fontSize: 15, color: MUTED, lineHeight: 1.75, marginBottom: 12 }}>{children}</p>;
}

const COOKIE_TYPES = [
  { name: "Essential", purpose: "Authentication sessions, security tokens, CSRF protection. Cannot be disabled.", retention: "Session / 30 days", required: true },
  { name: "Analytics", purpose: "Aggregate usage statistics (page views, search queries, feature usage). No personal data leaves the platform.", retention: "12 months", required: false },
  { name: "Preferences", purpose: "UI settings such as filter preferences, language, and display options.", retention: "12 months", required: false },
  { name: "Marketing", purpose: "Conversion tracking and retargeting for advertising campaigns. Only used if you click an external ad.", retention: "90 days", required: false },
];

export default function CookiesPage() {
  return (
    <MainLayout>
      <div style={{ maxWidth: 760, margin: "0 auto", padding: "60px 24px 80px" }}>
        <h1 style={{ fontFamily: "'Barlow Condensed', sans-serif", fontWeight: 900, fontSize: 52, color: "#fff", textTransform: "uppercase", marginBottom: 8 }}>Cookie Policy</h1>
        <p style={{ fontFamily: "'Barlow', sans-serif", fontSize: 14, color: "#4a6480", marginBottom: 40 }}>Last updated: {DATE}</p>

        <H2>What Are Cookies?</H2>
        <P>Cookies are small text files stored on your browser when you visit a website. Parts Link Aviation uses cookies to keep you logged in, remember your preferences, and improve platform performance.</P>

        <H2>Types of Cookies We Use</H2>
        <div style={{ display: "flex", flexDirection: "column", gap: 12, marginBottom: 24 }}>
          {COOKIE_TYPES.map(c => (
            <div key={c.name} style={{ background: CARD, border: `1px solid ${BORDER}`, borderRadius: 10, padding: "18px 20px" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
                <span style={{ fontFamily: "'Barlow Condensed', sans-serif", fontWeight: 700, fontSize: 16, color: "#fff" }}>{c.name}</span>
                <span style={{ fontFamily: "'Barlow', sans-serif", fontSize: 11, fontWeight: 600, letterSpacing: "0.06em", textTransform: "uppercase", color: c.required ? "#4ade80" : "#7ea8c8", background: c.required ? "rgba(74,222,128,0.1)" : "rgba(126,168,200,0.1)", border: `1px solid ${c.required ? "rgba(74,222,128,0.3)" : "rgba(126,168,200,0.2)"}`, padding: "2px 10px", borderRadius: 4 }}>
                  {c.required ? "Required" : "Optional"}
                </span>
              </div>
              <p style={{ fontFamily: "'Barlow', sans-serif", fontSize: 14, color: MUTED, marginBottom: 6 }}>{c.purpose}</p>
              <p style={{ fontFamily: "'Barlow', sans-serif", fontSize: 12, color: "#4a6480" }}>Retention: {c.retention}</p>
            </div>
          ))}
        </div>

        <H2>Managing Cookies</H2>
        <P>You can control cookies through your browser settings. Disabling essential cookies will prevent you from logging in. Most browsers allow you to block or delete cookies via Settings → Privacy → Cookies.</P>
        <P>To opt out of analytics cookies, email <a href="mailto:admin@partslinkaviation.com" style={{ color: "#1976d2", textDecoration: "none" }}>admin@partslinkaviation.com</a>.</P>

        <H2>Third-Party Cookies</H2>
        <P>We use Resend (email delivery) for transactional notifications. This service may set its own cookies subject to its privacy policy. We do not use Google Analytics or Meta Pixel on authenticated pages.</P>

        <H2>Updates</H2>
        <P>We may update this policy when we add new features. Material changes will be announced on the platform 14 days in advance.</P>

        <div style={{ marginTop: 48, padding: "20px 24px", borderTop: `1px solid ${BORDER}`, fontFamily: "'Barlow', sans-serif", fontSize: 13, color: "#4a6480" }}>
          Questions? Contact <a href="mailto:admin@partslinkaviation.com" style={{ color: "#1976d2", textDecoration: "none" }}>admin@partslinkaviation.com</a>
        </div>
      </div>
    </MainLayout>
  );
}
